/**
 * index.ts — Daily channel poster
 *
 * Run by a GitHub Actions cron every morning. Connects to WhatsApp using
 * the session saved by `npm run link`, generates the Word of the Day via
 * Gemini, posts it to the WhatsApp Channel with a native-speaker
 * pronunciation voice note, then disconnects. One shot, no long-running
 * server needed.
 *
 * Optional: set DM_NUMBER (comma-separated, full international format, e.g.
 * 918111891130) to also receive the word and pronunciation as a direct
 * message. Everything past the channel text + progress save is best-effort:
 * a DM, pronunciation, or transcode failure never fails the channel post.
 */
import { makeWASocket, DisconnectReason } from '@whiskeysockets/baileys';
import dotenv from 'dotenv';
import { connectDB, getChannelProgress, saveChannelProgress } from './db';
import { useMongoAuthState } from './waAuth';
import { CEFRLevel, generateWord, formatWordMessage } from './vocabulary';
import { getPronunciationOpus } from './pronunciation';

dotenv.config();

const errMsg = (e: unknown) => (e as any)?.message || String(e);

/** Reject if `p` hasn't settled within `ms`, so one bad send can't stall the run. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`send timed out after ${ms}ms`)), ms);
  });
  p.catch(() => {}); // keep a late rejection from going unhandled after the race
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

async function postWordOfTheDay(): Promise<void> {
  const CHANNEL_INVITE = process.env.CHANNEL_ID;
  if (!CHANNEL_INVITE) throw new Error('CHANNEL_ID is not set.');

  await connectDB();
  const { state, saveCreds } = await useMongoAuthState();

  const defaultLevel: CEFRLevel = (process.env.CHANNEL_LEVEL as CEFRLevel) || 'A1';
  const progress = await getChannelProgress(defaultLevel);
  const level: CEFRLevel = (process.env.CHANNEL_LEVEL as CEFRLevel) || (progress.level as CEFRLevel) || 'A1';

  console.log(`Generating Day ${progress.currentDay} word for level ${level}...`);
  const word = await generateWord(progress.currentDay, level, progress.wordsUsed as any);
  const message = formatWordMessage(word);
  console.log(`Word: "${word.german}" (${word.english})`);

  return new Promise<void>((resolve, reject) => {
    const sock = makeWASocket({ auth: state, syncFullHistory: false });
    sock.ev.on('creds.update', saveCreds);

    let settled = false;

    sock.ev.on('connection.update', async (update) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr) {
        settled = true;
        sock.end(undefined);
        reject(new Error(
          'No linked WhatsApp session found in MongoDB. Run `npm run link` locally once to scan the QR, then re-run.'
        ));
        return;
      }

      if (connection === 'open') {
        try {
          const meta = await sock.newsletterMetadata('invite', CHANNEL_INVITE);
          if (!meta?.id) throw new Error(`Could not resolve channel from CHANNEL_ID "${CHANNEL_INVITE}"`);

          await sock.sendMessage(meta.id, { text: message });
          console.log('Posted to channel.');

          await saveChannelProgress({
            currentDay: progress.currentDay + 1,
            level,
            wordsUsed: [
              ...(progress.wordsUsed as any),
              { german: word.german, english: word.english, topic: word.topic, day_number: progress.currentDay },
            ],
          });

          // Everything below is best-effort. The channel post and progress
          // save above are already committed, so a failure here must never
          // reject: sends are wrapped and time-boxed so they cannot stall.

          // Native-speaker pronunciation clip (may be null: no recording for
          // this word, or ffmpeg missing). Fetched once, reused for all targets.
          const audio = await getPronunciationOpus(word.german, word.example).catch(() => null);

          const sendTo = async (jid: string, label: string) => {
            try {
              await withTimeout(sock.sendMessage(jid, { text: message }), 15_000);
              console.log(`Sent word to ${label}.`);
            } catch (err) {
              console.warn(`Word send to ${label} failed (channel post unaffected): ${errMsg(err)}`);
              return; // no point trying the audio if the text failed
            }
            if (!audio) return;
            try {
              await withTimeout(
                sock.sendMessage(jid, { audio, mimetype: 'audio/ogg; codecs=opus', ptt: true }),
                20_000
              );
              console.log(`Sent pronunciation to ${label}.`);
            } catch (err) {
              console.warn(`Pronunciation send to ${label} failed: ${errMsg(err)}`);
            }
          };

          // Pronunciation clip to the channel (the text there is already sent
          // above; this just adds the audio for channel followers).
          if (audio) {
            try {
              await withTimeout(
                sock.sendMessage(meta.id, { audio, mimetype: 'audio/ogg; codecs=opus', ptt: true }),
                20_000
              );
              console.log('Sent pronunciation to channel.');
            } catch (err) {
              console.warn(`Pronunciation send to channel failed: ${errMsg(err)}`);
            }
          }

          // Optional DM copy (word + pronunciation) to each DM_NUMBER.
          const dmRaw = process.env.DM_NUMBER;
          if (dmRaw) {
            const dmNumbers = dmRaw.split(',').map((n) => n.replace(/[^0-9]/g, '')).filter(Boolean);
            for (const num of dmNumbers) {
              await sendTo(`${num}@s.whatsapp.net`, num);
            }
          }

          settled = true;
          await sock.end(undefined);
          resolve();
        } catch (err) {
          settled = true;
          await sock.end(undefined);
          reject(err);
        }
      }

      if (connection === 'close' && !settled) {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        settled = true;
        reject(new Error(
          statusCode === DisconnectReason.loggedOut
            ? 'Session was logged out. Run `npm run link` locally to re-scan the QR.'
            : `Connection closed before posting (code ${statusCode})`
        ));
      }
    });

    // Generous: connect is usually seconds, but the best-effort pronunciation
    // path (Wiktionary + Piper + transcode + per-target sends) can add a bit.
    setTimeout(() => {
      if (!settled) {
        settled = true;
        sock.end(undefined);
        reject(new Error('Timeout: WhatsApp did not finish within 3 minutes'));
      }
    }, 180_000);
  });
}

postWordOfTheDay()
  .then(() => { console.log('Done.'); process.exit(0); })
  .catch((err) => { console.error('Error:', err.message || err); process.exit(1); });
