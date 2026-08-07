/**
 * bot.ts — Persistent DM bot
 *
 * Handles:
 *  - Onboarding: level selection (A1–C2)
 *  - "more"      → extra word of the day (max 3)
 *  - "flashcard" → quiz on past words (spaced repetition)
 *  - "level"     → change level
 *  - "help"      → command list
 *
 * Run with: npm run bot
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

// ─── Health Check Server for Render ───────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'whatsapp-german-bot',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.listen(PORT, () => {
  console.log(`🔧 Health check server running on port ${PORT}`);
});

// ─── WhatsApp Session Restoration for Render ──────────────────────────────

async function restoreSession() {
  const authData = process.env.WWEBJS_AUTH;
  
  // Only restore in production and if WWEBJS_AUTH exists
  if (!authData || process.env.NODE_ENV !== 'production') {
    console.log('⚠️  No WWEBJS_AUTH found or not in production mode');
    console.log('📱 Will use local session or show QR code for authentication');
    return;
  }
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Create auth directory if it doesn't exist
    const authDir = '.wwebjs_auth';
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }
    
    // Write base64 to temp file first (avoid command line length limits)
    const tempFile = path.join(authDir, 'temp_session.tar.gz');
    fs.writeFileSync(tempFile, Buffer.from(authData, 'base64'));
    
    // Extract from temp file
    const { execSync } = require('child_process');
    execSync(`tar -xzf ${tempFile} -C ${authDir}`);
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    
    console.log('✅ WhatsApp session restored from environment');
  } catch (error) {
    console.log('⚠️  Could not restore session:', error.message);
    console.log('📱 Will show QR code for authentication');
  }
}

const MAX_EXTRA_WORDS = 3;
const VALID_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// In-memory map to track pending flashcard answers: phoneNumber → FlashCard
const pendingFlashcards = new Map<string, any>();

// ─── Bot Client ────────────────────────────────────────────────────────────

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
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ DM Bot is online and ready!');
  console.log('📱 WhatsApp Web session is active');
  console.log('🔗 Health check available at /health');
});

client.on('auth_failure', async (msg) => {
  console.error('❌ Auth failure:', msg);
  console.log('🔄 Session expired. Please re-run setup locally and update WWEBJS_AUTH');
  
  // In production, log the error but don't crash
  if (process.env.NODE_ENV === 'production') {
    console.log('⚠️ Production mode: Service will restart and try again');
    process.exit(1); // Let Render restart the service
  }
});

client.on('disconnected', (reason) => {
  console.log('📱 WhatsApp disconnected:', reason);
  
  if (reason === 'LOGOUT') {
    console.log('🚨 WhatsApp session was logged out manually from phone');
    console.log('📋 Please re-run setup locally and update WWEBJS_AUTH');
    
    if (process.env.NODE_ENV === 'production') {
      process.exit(1); // Let Render restart
    }
  }
});

// ─── Message Handler ───────────────────────────────────────────────────────

client.on('message', async (msg: Message) => {
  // Only handle 1-on-1 DMs (not groups, not channel posts, not own messages)
  const from: string = (msg as any).from ?? '';
  if (!from.endsWith('@c.us')) return;  // @c.us = individual chat; groups = @g.us
  if ((msg as any).fromMe) return;

  const body = ((msg as any).body ?? '').trim();
  const bodyLower = body.toLowerCase();

  try {
    let user = getUser(from);

    // ── Auto-register ──────────────────────────────────────────────────────
    if (!user) {
      createUser(from);
      user = getUser(from);
    }

    // ── State: NEW → send welcome + level picker ───────────────────────────
    if (user.state === 'NEW') {
      updateUser(from, { state: 'AWAITING_LEVEL' });
      await msg.reply(
        `🇩🇪 *Willkommen! Welcome to German Daily Words!*\n\n` +
        `I post a new German word every morning to the channel — and you can DM me for extras and flashcards.\n\n` +
        `First, what's your German level?\n\n` +
        `Reply with one of:\n` +
        `▸ *A1* — Complete beginner\n` +
        `▸ *A2* — Basic user\n` +
        `▸ *B1* — Intermediate\n` +
        `▸ *B2* — Upper intermediate\n` +
        `▸ *C1* — Advanced\n` +
        `▸ *C2* — Mastery`
      );
      return;
    }

    // ── State: AWAITING_LEVEL → validate and set level ────────────────────
    if (user.state === 'AWAITING_LEVEL') {
      const chosen = body.toUpperCase() as CEFRLevel;
      if (!VALID_LEVELS.includes(chosen)) {
        await msg.reply(`Please reply with one of: A1, A2, B1, B2, C1, or C2.`);
        return;
      }
      updateUser(from, { level: chosen, state: 'ACTIVE' });
      await msg.reply(
        `✅ Level set to *${chosen}*!\n\n` +
        `You'll receive a new *${chosen}*-level word every morning in the channel.\n\n` +
        `Commands you can use anytime:\n` +
        `▸ *more* — get an extra word (up to ${MAX_EXTRA_WORDS}/day)\n` +
        `▸ *flashcard* — quiz yourself on past words\n` +
        `▸ *level* — change your level\n` +
        `▸ *help* — show this menu\n\n` +
        `Viel Erfolg! Good luck! 🚀`
      );
      return;
    }

    // ── State: ACTIVE ──────────────────────────────────────────────────────

    // Check if we're waiting for a flashcard answer
    if (pendingFlashcards.has(from)) {
      const card = pendingFlashcards.get(from);
      pendingFlashcards.delete(from);
      const normalized = (s: string) => s.trim().toLowerCase().replace(/[^\w\säöü]/gi, '');
      const correct = normalized(body) === normalized(card.answer);
      saveFlashcardAttempt(from, card.german, correct);
      await msg.reply(formatFlashcardResult(card, body));
      return;
    }

    // ── Commands ───────────────────────────────────────────────────────────

    if (bodyLower === 'level') {
      updateUser(from, { state: 'AWAITING_LEVEL' });
      await msg.reply(
        `What level would you like to switch to?\n\n` +
        `▸ A1 | A2 | B1 | B2 | C1 | C2\n\n` +
        `*(Your progress history is kept — only new words will match the new level.)*`
      );
      return;
    }

    if (bodyLower === 'help') {
      await msg.reply(
        `🇩🇪 *German Daily Bot — Commands*\n\n` +
        `▸ *more* — extra word today (max ${MAX_EXTRA_WORDS}/day)\n` +
        `▸ *flashcard* — quiz on words you've learned\n` +
        `▸ *level* — change your CEFR level (currently *${user.level}*)\n` +
        `▸ *help* — show this menu`
      );
      return;
    }

    if (['more', 'extra', 'weiter', 'next', 'mehr'].includes(bodyLower)) {
      const today = new Date().toISOString().split('T')[0];
      const dailyReqs = getDailyRequests(from, today);
      const reqCount = dailyReqs?.request_count ?? 0;

      if (reqCount >= MAX_EXTRA_WORDS) {
        await msg.reply(
          `🛑 You've used all ${MAX_EXTRA_WORDS} extra words for today!\n\n` +
          `Your next word arrives automatically tomorrow morning. Bis morgen! 👋`
        );
        return;
      }

      const history = getWordHistory(from, 60);
      const nextDay = user.current_day + 1;
      const word = await generateWord(nextDay, user.level as CEFRLevel, history);

      incrementDailyRequests(from, today);
      updateUser(from, { current_day: nextDay });
      saveWordHistory(from, nextDay, word.german, word.english, word.topic, word.level);

      const remaining = MAX_EXTRA_WORDS - (reqCount + 1);
      const suffix =
        remaining > 0
          ? `\n\n_${remaining} extra request(s) left today._`
          : `\n\n_That's your last extra word today — great dedication! 👏_`;

      await msg.reply(formatWordMessage(word) + suffix);
      return;
    }

    if (['flashcard', 'quiz', 'test', 'üben'].includes(bodyLower)) {
      const history = getWordHistory(from, 60);
      if (history.length === 0) {
        await msg.reply(
          `You haven't learned any words yet! Reply *more* to get your first word, or wait for tomorrow's daily word. 📚`
        );
        return;
      }

      const weakWords = getWeakWords(from, 10);
      const card = await generateFlashcard(history, weakWords, user.level as CEFRLevel);
      pendingFlashcards.set(from, card);
      await msg.reply(formatFlashcardQuestion(card));
      return;
    }

    // ── Default ────────────────────────────────────────────────────────────
    await msg.reply(
      `Hi! I didn't understand that. Reply *help* to see what I can do. 😊`
    );
  } catch (err: any) {
    console.error(`Error handling message from ${from}:`, err.message);
    await msg.reply(`Something went wrong on my end. Please try again in a moment. 🙏`);
  }
});

// ─── Initialize Bot ────────────────────────────────────────────────────────

async function startBot() {
  await restoreSession();
  client.initialize();
}

// ─── Scheduled Channel Posting ─────────────────────────────────────────────

const PROGRESS_FILE = path.resolve('data/progress.json');

interface ChannelProgress {
  currentDay: number;
  level: CEFRLevel;
  wordsUsed: Array<{ german: string; english: string; topic: string; day_number: number }>;
}

function getChannelProgress(): ChannelProgress {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  }
  return { 
    currentDay: 1, 
    level: (process.env.CHANNEL_LEVEL as CEFRLevel) || 'A1', 
    wordsUsed: [] 
  };
}

function saveChannelProgress(p: ChannelProgress) {
  const dir = path.dirname(PROGRESS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

// Schedule daily channel post at 8:00 AM IST (2:30 AM UTC)
cron.schedule('30 2 * * *', async () => {
  console.log('⏰ Scheduled channel post triggered');
  await postToChannel();
}, {
  timezone: 'Asia/Kolkata'
});

async function postToChannel() {
  const CHANNEL_ID = process.env.CHANNEL_ID;
  
  if (!CHANNEL_ID) {
    console.log('⚠️ CHANNEL_ID not set, skipping channel post');
    return;
  }

  try {
    const progress = getChannelProgress();
    const level: CEFRLevel = (process.env.CHANNEL_LEVEL as CEFRLevel) || progress.level || 'A1';

    console.log(`📝 Generating Day ${progress.currentDay} word for level ${level}...`);
    const word = await generateWord(progress.currentDay, level, progress.wordsUsed);
    const message = formatWordMessage(word);

    console.log(`📖 Word: "${word.german}" (${word.english})`);

    // Post to channel
    const channel = await (client as any).getChannelByInviteCode(CHANNEL_ID);
    await channel.sendMessage(message);
    
    console.log('✅ Posted to channel successfully!');

    // Update progress
    progress.wordsUsed.push({
      german: word.german,
      english: word.english,
      topic: word.topic,
      day_number: progress.currentDay,
    });
    progress.currentDay++;
    progress.level = level;
    saveChannelProgress(progress);

  } catch (error: any) {
    console.error('❌ Failed to post to channel:', error.message);
  }
}

// Manual trigger endpoint for testing
app.post('/api/post-channel', async (req, res) => {
  try {
    await postToChannel();
    res.json({ success: true, message: 'Channel post triggered' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

startBot().catch(console.error);