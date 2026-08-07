import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.resolve('data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = path.resolve(dbDir, 'database.sqlite');

// better-sqlite3 is synchronous by default — simpler API
export const db = new Database(dbPath);

console.log('✅ Connected to SQLite database (better-sqlite3).');
initSchema();

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      phone_number    TEXT PRIMARY KEY,
      level           TEXT DEFAULT 'A1',
      state           TEXT DEFAULT 'NEW',
      current_day     INTEGER DEFAULT 1,
      subscribed_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS word_history (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number    TEXT,
      day_number      INTEGER,
      german          TEXT,
      english         TEXT,
      topic           TEXT,
      level           TEXT,
      taught_at       DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS daily_requests (
      phone_number    TEXT,
      request_date    TEXT,
      request_count   INTEGER DEFAULT 0,
      PRIMARY KEY (phone_number, request_date)
    );

    CREATE TABLE IF NOT EXISTS flashcard_attempts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number    TEXT,
      german          TEXT,
      correct         INTEGER,
      attempted_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// ─── Helpers (synchronous, return values directly) ────────────────────────

export const getUser = (phoneNumber: string) => {
  return db.prepare('SELECT * FROM users WHERE phone_number = ?').get(phoneNumber);
};

export const createUser = (phoneNumber: string) => {
  db.prepare("INSERT OR IGNORE INTO users (phone_number, state) VALUES (?, 'NEW')").run(phoneNumber);
};

export const updateUser = (phoneNumber: string, fields: Record<string, any>) => {
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  db.prepare(`UPDATE users SET ${setClause} WHERE phone_number = ?`).run(...values, phoneNumber);
};

export const saveWordHistory = (
  phoneNumber: string,
  dayNumber: number,
  german: string,
  english: string,
  topic: string,
  level: string
) => {
  db.prepare(
    'INSERT INTO word_history (phone_number, day_number, german, english, topic, level) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(phoneNumber, dayNumber, german, english, topic, level);
};

export const getWordHistory = (phoneNumber: string, limit = 100) => {
  return db.prepare('SELECT * FROM word_history WHERE phone_number = ? ORDER BY taught_at DESC LIMIT ?').all(phoneNumber, limit);
};

export const getWeakWords = (phoneNumber: string, limit = 20) => {
  return db.prepare(`
    SELECT wh.german, wh.english, wh.topic, COUNT(fa.id) as wrong_count
    FROM word_history wh
    LEFT JOIN flashcard_attempts fa ON fa.german = wh.german AND fa.phone_number = wh.phone_number AND fa.correct = 0
    WHERE wh.phone_number = ?
    GROUP BY wh.german
    ORDER BY wrong_count DESC, wh.taught_at ASC
    LIMIT ?
  `).all(phoneNumber, limit);
};

export const getDailyRequests = (phoneNumber: string, date: string) => {
  const row = db.prepare('SELECT request_count FROM daily_requests WHERE phone_number = ? AND request_date = ?').get(phoneNumber, date);
  return row?.request_count ?? 0;
};

export const incrementDailyRequests = (phoneNumber: string, date: string) => {
  db.prepare(`
    INSERT INTO daily_requests (phone_number, request_date, request_count)
    VALUES (?, ?, 1)
    ON CONFLICT(phone_number, request_date) DO UPDATE SET request_count = request_count + 1
  `).run(phoneNumber, date);
};

export const saveFlashcardAttempt = (phoneNumber: string, german: string, correct: boolean) => {
  db.prepare('INSERT INTO flashcard_attempts (phone_number, german, correct) VALUES (?, ?, ?)').run(phoneNumber, german, correct ? 1 : 0);
};
