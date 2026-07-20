import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve(__dirname, '../data/database.sqlite');

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    // Create Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      phone_number TEXT PRIMARY KEY,
      current_word_id INTEGER DEFAULT 1,
      subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create Daily Requests table
    db.run(`CREATE TABLE IF NOT EXISTS daily_requests (
      phone_number TEXT,
      request_date TEXT,
      request_count INTEGER DEFAULT 0,
      PRIMARY KEY (phone_number, request_date)
    )`);
  }
});

// Helper functions for DB access
export const getUser = (phoneNumber: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE phone_number = ?', [phoneNumber], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const createUser = (phoneNumber: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR IGNORE INTO users (phone_number) VALUES (?)', [phoneNumber], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

export const updateUserProgress = (phoneNumber: string, newWordId: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE users SET current_word_id = ? WHERE phone_number = ?', [newWordId, phoneNumber], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

export const getDailyRequests = (phoneNumber: string, date: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get('SELECT request_count FROM daily_requests WHERE phone_number = ? AND request_date = ?', [phoneNumber, date], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const incrementDailyRequests = (phoneNumber: string, date: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO daily_requests (phone_number, request_date, request_count) 
      VALUES (?, ?, 1)
      ON CONFLICT(phone_number, request_date) 
      DO UPDATE SET request_count = request_count + 1
    `, [phoneNumber, date], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};
