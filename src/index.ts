/**
 * index.ts — One-shot channel poster
 *
 * Run by GitHub Actions cron every morning.
 * Generates the Word of the Day via Gemini and posts it to the WhatsApp Channel.
 *
 * Level is set via CHANNEL_LEVEL env var (default: A1).
 * Progress is stored in data/progress.json and committed back to the repo.
 */

import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { CEFRLevel, generateWord, formatWordMessage } from './vocabulary';

dotenv.config();

const PROGRESS_FILE = path.resolve('data/progress.json');

interface ChannelProgress {
  currentDay: number;
  level: CEFRLevel;
  wordsUsed: Array<{ german: string; english: string; topic: string; day_number: number }>;
}

function getProgress(): ChannelProgress {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  }
  return { currentDay: 1, level: (process.env.CHANNEL_LEVEL as CEFRLevel) || 'A1', wordsUsed: [] };
}

function saveProgress(p: ChannelProgress) {
  const dir = path.dirname(PROGRESS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

async function postWordOfTheDay() {
  const CHANNEL_ID = process.env.CHANNEL_ID;
  if (!CHANNEL_ID) throw new Error('CHANNEL_ID is not set.');

  const progress = getProgress();
  const level: CEFRLevel = (process.env.CHANNEL_LEVEL as CEFRLevel) || progress.level || 'A1';

  console.log(`🤖 Generating Day ${progress.currentDay} word for level ${level}...`);
  const word = await generateWord(progress.currentDay, level, progress.wordsUsed);
  const message = formatWordMessage(word);
  console.log(`📖 Word: "${word.german}" (${word.english})`);

  // Update progress BEFORE posting (so a crash doesn't double-post)
  progress.wordsUsed.push({
    german: word.german,
    english: word.english,
    topic: word.topic,
    day_number: progress.currentDay,
  });
  progress.currentDay++;
  progress.level = level;
  saveProgress(progress);

  // Connect and post
  return new Promise<void>((resolve, reject) => {
    const client = new Client({
      authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      },
    });

    let posted = false;

    client.on('qr', (qr) => {
      console.log('\n📱 QR code (first-time only):\n');
      qrcode.generate(qr, { small: true });
    });

    client.on('ready', async () => {
      console.log('✅ WhatsApp connected!');
      try {
        const channel = await (client as any).getChannelByInviteCode(CHANNEL_ID);
        await channel.sendMessage(message);
        console.log('✅ Posted to channel!');
        posted = true;
        await client.destroy();
        resolve();
      } catch (err) {
        await client.destroy();
        reject(err);
      }
    });

    client.on('auth_failure', async (msg) => {
      await client.destroy();
      reject(new Error(`Auth failure: ${msg}`));
    });

    client.initialize();

    setTimeout(async () => {
      if (!posted) {
        await client.destroy();
        reject(new Error('Timeout: WhatsApp did not connect within 2 minutes'));
      }
    }, 120_000);
  });
}

postWordOfTheDay()
  .then(() => { console.log('✅ Done!'); process.exit(0); })
  .catch((err) => { console.error('❌', err.message); process.exit(1); });
