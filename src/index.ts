/**
 * index.ts — Daily channel poster
 *
 * Run by a GitHub Actions cron every morning. Connects to WhatsApp using
 * the session saved by `npm run link`, generates the Word of the Day via
 * Gemini, posts it to the WhatsApp Channel, then disconnects. One shot —
 * no long-running server needed.
 */
import { makeWASocket, DisconnectReason } from '@whiskeysockets/baileys';
import dotenv from 'dotenv';
import { connectDB, getChannelProgress, saveChannelProgress } from './db';
import { useMongoAuthState } from './waAuth';
import { CEFRLevel, generateWord, formatWordMessage } from './vocabulary';

dotenv.config();

async function postWordOfTheDay(): Promise<void> {
  const CHANNEL_INVITE = process.env.CHANNEL_ID;
  if (!CHANNEL_INVITE) throw new Error('CHANNEL_ID is not set.');

  await connectDB();
  const { state, saveCreds } = await useMongoAuthState();

  const defaultLevel: CEFRLevel = (process.env.CHANNEL_LEVEL as CEFRLevel) || 'A1';
  const progress = await getChannelProgress(defaultLevel);
  const level: CEFRLevel = (process.env.CHANNEL_LEVEL as CEFRLevel) || (progress.level as CEFRLevel) || 'A1';

  console.log(`🤖 Generating Day ${progress.currentDay} word for level ${level}...`);
  const word = await generateWord(progress.currentDay, level, progress.wordsUsed as any);
  const message = formatWordMessage(word);
  console.log(`📖 Word: "${word.german}" (${word.english})`);

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
          console.log('✅ Posted to channel!');

          await saveChannelProgress({
            currentDay: progress.currentDay + 1,
            level,
            wordsUsed: [
              ...(progress.wordsUsed as any),
              { german: word.german, english: word.english, topic: word.topic, day_number: progress.currentDay },
            ],
          });

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

    setTimeout(() => {
      if (!settled) {
        settled = true;
        sock.end(undefined);
        reject(new Error('Timeout: WhatsApp did not connect within 2 minutes'));
      }
    }, 120_000);
  });
}

postWordOfTheDay()
  .then(() => { console.log('✅ Done!'); process.exit(0); })
  .catch((err) => { console.error('❌', err.message || err); process.exit(1); });
