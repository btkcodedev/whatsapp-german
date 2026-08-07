/**
 * unified-bot.ts — All-in-one WhatsApp bot
 *
 * Handles:
 *  1. Daily channel posts (via node-cron)
 *  2. Interactive DM features (always-on)
 *  
 * Single deployment, single authentication, persistent session on disk.
 * No env var size limits, no GitHub Actions needed.
 */

import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';
import express from 'express';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import {
  getUser, createUser, updateUser,
  saveWordHistory, getWordHistory, getWeakWords,
  getDailyRequests, incrementDailyRequests,
  saveFlashcardAttempt,
} from './db';
import {
  CEFRLevel, generateWord, generateFlashcard,
  formatWordMessage, formatFlashcardQuestion, formatFlashcardResult,
} from './vocabulary';

dotenv.config();

// ─── Configuration ─────────────────────────────────────────────────────────

const MAX_EXTRA_WORDS = 3;
const VALID_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const PROGRESS_FILE = path.resolve('data/progress.json');

// In-memory map to track pending flashcard answers
const pendingFlashcards = new Map<string, any>();

// ─── Health Check Server ───────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  const sessionExists = fs.existsSync('.wwebjs_auth/session');
  res.json({
    status: 'ok',
    service: 'whatsapp-german-unified-bot',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    sessionActive: sessionExists
  });
});

app.listen(PORT, () => {
  console.log(`🔧 Health check server running on port ${PORT}`);
});

// ─── Progress Management (Channel Posts) ───────────────────────────────────

interface ChannelProgress {
  currentDay: number;
  level: CEFRLevel;
  wordsUsed: Array<{ german: string; english: string; topic: string; day_number: number }>;
}

function getProgress(): ChannelProgress {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  }
  return { 
    currentDay: 1, 
    level: (process.env.CHANNEL_LEVEL as CEFRLevel) || 'A1', 
    wordsUsed: [] 
  };
}

function saveProgress(p: ChannelProgress) {
  const dir = path.dirname(PROGRESS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

// ─── WhatsApp Client ───────────────────────────────────────────────────────

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ],
  },
});

client.on('qr', (qr) => {
  console.log('\n📱 Scan QR code to link WhatsApp:\n');
  qrcode.generate(qr, { small: true});
  console.log('\n👆 Settings → Linked Devices → Link Device\n');
});

client.on('ready', () => {
  console.log('✅ WhatsApp Client Ready!');
  console.log('📱 Session persists on disk at: .wwebjs_auth/');
  console.log('🤖 DM Bot: Active');
  console.log('📅 Channel Posts: Scheduled daily at 8:00 AM IST');
});

client.on('auth_failure', async (msg) => {
  console.error('❌ Auth failure:', msg);
  console.log('🔄 Session expired. Re-authenticate:');
  console.log('   Railway/Render: Use shell and run "npm run setup"');
  console.log('   VPS: SSH and run "npm run setup"');
  process.exit(1);
});

client.on('disconnected', (reason) => {
  console.log('📱 Disconnected:', reason);
  if (reason === 'LOGOUT') {
    console.log('🚨 Logged out from phone - re-authentication needed');
    process.exit(1);
  }
});

// ─── Daily Channel Posting ─────────────────────────────────────────────────

async function postDailyWord() {
  const CHANNEL_ID = process.env.CHANNEL_ID;
  if (!CHANNEL_ID) {
    console.log('⚠️ CHANNEL_ID not set, skipping channel post');
    return;
  }

  try {
    const progress = getProgress();
    const level: CEFRLevel = (process.env.CHANNEL_LEVEL as CEFRLevel) || progress.level || 'A1';

    console.log(`\n📰 Generating Day ${progress.currentDay} word for channel (${level})...`);
    const word = await generateWord(progress.currentDay, level, progress.wordsUsed);
    const message = formatWordMessage(word);

    console.log(`📖 Word: "${word.german}" (${word.english})`);

    // Post to channel
    const channel = await (client as any).getChannelByInviteCode(CHANNEL_ID);
    await channel.sendMessage(message);
    console.log('✅ Posted to channel!');

    // Update progress
    progress.wordsUsed.push({
      german: word.german,
      english: word.english,
      topic: word.topic,
      day_number: progress.currentDay,
    });
    progress.currentDay++;
    progress.level = level;
    saveProgress(progress);

  } catch (error) {
    console.error('❌ Failed to post daily word:', error);
  }
}

// Schedule daily posts at 8:00 AM IST (2:30 AM UTC)
cron.schedule('30 2 * * *', () => {
  console.log('\n⏰ Scheduled daily word post triggered');
  postDailyWord();
});

// ─── DM Bot Message Handler ────────────────────────────────────────────────

client.on('message', async (msg: Message) => {
  const from: string = (msg as any).from ?? '';
  if (!from.endsWith('@c.us')) return;  // Only 1-on-1 chats
  if ((msg as any).fromMe) return;      // Ignore own messages

  const body = ((msg as any).body ?? '').trim();
  const bodyLower = body.toLowerCase();

  try {
    let user = getUser(from);

    // Auto-register new users
    if (!user) {
      createUser(from);
      user = getUser(from);
    }

    // State: NEW → show welcome
    if (user.state === 'NEW') {
      updateUser(from, { state: 'AWAITING_LEVEL' });
      await msg.reply(
        `🇩🇪 *Willkommen! Welcome to German Daily Words!*\n\n` +
        `I help you learn German with AI-powered daily words and flashcards.\n\n` +
        `First, what's your German level?\n\n` +
        `Reply with:\n` +
        `▸ *A1* — Complete beginner\n` +
        `▸ *A2* — Basic\n` +
        `▸ *B1* — Intermediate\n` +
        `▸ *B2* — Upper intermediate\n` +
        `▸ *C1* — Advanced\n` +
        `▸ *C2* — Mastery`
      );
      return;
    }

    // State: AWAITING_LEVEL → validate level
    if (user.state === 'AWAITING_LEVEL') {
      const chosen = body.toUpperCase() as CEFRLevel;
      if (!VALID_LEVELS.includes(chosen)) {
        await msg.reply(`Please reply with: A1, A2, B1, B2, C1, or C2`);
        return;
      }
      updateUser(from, { level: chosen, state: 'ACTIVE' });
      await msg.reply(
        `✅ Level set to *${chosen}*!\n\n` +
        `Commands:\n` +
        `▸ *more* — extra word (max ${MAX_EXTRA_WORDS}/day)\n` +
        `▸ *flashcard* — quiz yourself\n` +
        `▸ *level* — change level\n` +
        `▸ *help* — show this menu\n\n` +
        `Viel Erfolg! 🚀`
      );
      return;
    }

    // Handle flashcard answers
    if (pendingFlashcards.has(from)) {
      const card = pendingFlashcards.get(from);
      pendingFlashcards.delete(from);
      const normalize = (s: string) => s.trim().toLowerCase().replace(/[^\w\säöü]/gi, '');
      const correct = normalize(body) === normalize(card.answer);
      saveFlashcardAttempt(from, card.german, correct);
      await msg.reply(formatFlashcardResult(card, body));
      return;
    }

    // Command: more
    if (bodyLower === 'more') {
      const today = new Date().toISOString().split('T')[0];
      const requestCount = getDailyRequests(from, today);

      if (requestCount >= MAX_EXTRA_WORDS) {
        await msg.reply(`You've reached today's limit of ${MAX_EXTRA_WORDS} extra words. Try again tomorrow! 💪`);
        return;
      }

      const history = getWordHistory(from);
      const dayNum = user.current_day || history.length + 1;
      const word = await generateWord(dayNum, user.level, history);

      saveWordHistory(from, dayNum, word.german, word.english, word.topic, user.level);
      updateUser(from, { current_day: dayNum + 1 });
      incrementDailyRequests(from, today);

      await msg.reply(formatWordMessage(word));
      return;
    }

    // Command: flashcard
    if (bodyLower === 'flashcard') {
      const history = getWordHistory(from);
      if (history.length < 5) {
        await msg.reply(`Learn at least 5 words before trying flashcards! Use *more* to get more words.`);
        return;
      }

      const weakWords = getWeakWords(from);
      const card = await generateFlashcard(history, weakWords, user.level);
      pendingFlashcards.set(from, card);
      await msg.reply(formatFlashcardQuestion(card));
      return;
    }

    // Command: level
    if (bodyLower === 'level') {
      updateUser(from, { state: 'AWAITING_LEVEL' });
      await msg.reply(`What's your new level?\n\nReply with: A1, A2, B1, B2, C1, or C2`);
      return;
    }

    // Command: help
    if (bodyLower === 'help') {
      await msg.reply(
        `🇩🇪 *German Learning Bot Commands*\n\n` +
        `▸ *more* — Get extra word (${MAX_EXTRA_WORDS}/day)\n` +
        `▸ *flashcard* — Quiz on learned words\n` +
        `▸ *level* — Change your CEFR level\n` +
        `▸ *help* — Show this menu\n\n` +
        `Your level: *${user.level}*`
      );
      return;
    }

    // Unknown command
    await msg.reply(`I didn't understand that. Try: *more*, *flashcard*, *level*, or *help*`);

  } catch (error) {
    console.error('Message handler error:', error);
    await msg.reply(`Sorry, something went wrong. Please try again.`);
  }
});

// ─── Initialize ────────────────────────────────────────────────────────────

console.log('🤖 Starting Unified WhatsApp German Bot...');
console.log('📦 Session storage: .wwebjs_auth/ (persistent disk)');
console.log('🔧 Health endpoint: http://localhost:' + PORT + '/health\n');

client.initialize();