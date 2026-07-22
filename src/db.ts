import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.resolve('data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = path.resolve(dbDir, 'database.sqlite');

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('✅ Connected to SQLite database.');
    initSchema();
  }
});

function initSchema() {
  db.serialize(() => {
    // Users — stores level, onboarding state, and progress
    db.run(`CREATE TABLE IF NOT EXISTS users (
      phone_number    TEXT PRIMARY KEY,
      level           TEXT DEFAULT 'A1',          -- A1/A2/B1/B2/C1/C2
      state           TEXT DEFAULT 'NEW',          -- NEW | AWAITING_LEVEL | ACTIVE
      current_day     INTEGER DEFAULT 1,
      subscribed_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Word history per user — Gemini uses this as memory
    db.run(`CREATE TABLE IF NOT EXISTS word_history (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number    TEXT,
      day_number      INTEGER,
      german          TEXT,
      english         TEXT,
      topic           TEXT,
      level           TEXT,
      taught_at       DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Daily extra-word request counter
    db.run(`CREATE TABLE IF NOT EXISTS daily_requests (
      phone_number    TEXT,
      request_date    TEXT,
      request_count   INTEGER DEFAULT 0,
      PRIMARY KEY (phone_number, request_date)
    )`);

    // Flashcard attempts — for spaced repetition tracking
    db.run(`CREATE TABLE IF NOT EXISTS flashcard_attempts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number    TEXT,
      german          TEXT,
      correct         INTEGER,                     -- 1=correct, 0=wrong
      attempted_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

export const getUser = (phoneNumber: string): Promise<any> =>
  new Promise((resolve, reject) =>
    db.get('SELECT * FROM users WHERE phone_number = ?', [phoneNumber], (err, row) =>
      err ? reject(err) : resolve(row)
    )
  );

export const createUser = (phoneNumber: string): Promise<void> =>
  new Promise((resolve, reject) =>
    db.run(
      "INSERT OR IGNORE INTO users (phone_number, state) VALUES (?, 'NEW')",
      [phoneNumber],
      (err) => (err ? reject(err) : resolve())
    )
  );

export const updateUser = (phoneNumber: string, fields: Record<string, any>): Promise<void> => {
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  return new Promise((resolve, reject) =>
    db.run(
      `UPDATE users SET ${setClause} WHERE phone_number = ?`,
      [...values, phoneNumber],
      (err) => (err ? reject(err) : resolve())
    )
  );
};

export const saveWordHistory = (
  phoneNumber: string,
  dayNumber: number,
  german: string,
  english: string,
  topic: string,
  level: string
): Promise<void> =>
  new Promise((resolve, reject) =>
    db.run(
      'INSERT INTO word_history (phone_number, day_number, german, english, topic, level) VALUES (?,?,?,?,?,?)',
      [phoneNumber, dayNumber, german, english, topic, level],
      (err) => (err ? reject(err) : resolve())
    )
  );

// Returns last N words for a user (for Gemini memory)
export const getWordHistory = (phoneNumber: string, limit = 30): Promise<any[]> =>
  new Promise((resolve, reject) =>
    db.all(
      'SELECT * FROM word_history WHERE phone_number = ? ORDER BY day_number DESC LIMIT ?',
      [phoneNumber, limit],
      (err, rows) => (err ? reject(err) : resolve(rows))
    )
  );

// Returns words the user got wrong most (for flashcard prioritization)
export const getWeakWords = (phoneNumber: string, limit = 10): Promise<any[]> =>
  new Promise((resolve, reject) =>
    db.all(
      `SELECT wh.german, wh.english, 
              SUM(CASE WHEN fa.correct = 0 THEN 1 ELSE 0 END) as wrong_count
       FROM word_history wh
       LEFT JOIN flashcard_attempts fa ON fa.phone_number = wh.phone_number AND fa.german = wh.german
       WHERE wh.phone_number = ?
       GROUP BY wh.german, wh.english
       ORDER BY wrong_count DESC
       LIMIT ?`,
      [phoneNumber, limit],
      (err, rows) => (err ? reject(err) : resolve(rows || []))
    )
  );

export const saveFlashcardAttempt = (
  phoneNumber: string,
  german: string,
  correct: boolean
): Promise<void> =>
  new Promise((resolve, reject) =>
    db.run(
      'INSERT INTO flashcard_attempts (phone_number, german, correct) VALUES (?,?,?)',
      [phoneNumber, german, correct ? 1 : 0],
      (err) => (err ? reject(err) : resolve())
    )
  );

export const getDailyRequests = (phoneNumber: string, date: string): Promise<any> =>
  new Promise((resolve, reject) =>
    db.get(
      'SELECT request_count FROM daily_requests WHERE phone_number = ? AND request_date = ?',
      [phoneNumber, date],
      (err, row) => (err ? reject(err) : resolve(row))
    )
  );

export const incrementDailyRequests = (phoneNumber: string, date: string): Promise<void> =>
  new Promise((resolve, reject) =>
    db.run(
      `INSERT INTO daily_requests (phone_number, request_date, request_count)
       VALUES (?, ?, 1)
       ON CONFLICT(phone_number, request_date)
       DO UPDATE SET request_count = request_count + 1`,
      [phoneNumber, date],
      (err) => (err ? reject(err) : resolve())
    )
  );
