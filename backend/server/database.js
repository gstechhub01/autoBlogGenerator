import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

// Create or open the database file
const dbDir = path.join(process.cwd(), 'database');

// Ensure the database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'blog-articles.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Unable to open database:', err.message);
  } else {
    console.log('✅ Database opened successfully');
  }
});

// Create the table for storing articles
const createArticlesTable = () => {
  const query = `
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      keyword TEXT NOT NULL,
      content TEXT,
      date_generated TEXT NOT NULL,
      status TEXT NOT NULL
    )
  `;

  db.run(query, (err) => {
    if (err) {
      console.error('❌ Error creating articles table:', err.message);
    } else {
      console.log('✅ Articles table created or exists.');
    }
  });
};

// Create the table for storing keywords
const createKeywordsTable = () => {
  const query = `
    CREATE TABLE IF NOT EXISTS keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL,
      site TEXT NOT NULL,
      published INTEGER DEFAULT 0,
      scheduled_time TEXT
    )
  `;
  db.run(query, (err) => {
    if (err) {
      console.error('❌ Error creating keywords table:', err.message);
    } else {
      console.log('✅ Keywords table created or exists.');
    }
  });
};

// Bulk insert or update keywords
function bulkSaveKeywords(keywords, site, scheduledTime = null) {
  if (!Array.isArray(keywords) || !site) return;
  const stmt = db.prepare(`INSERT OR IGNORE INTO keywords (keyword, site, published, scheduled_time) VALUES (?, ?, 0, ?)`);
  keywords.forEach(kw => {
    stmt.run(kw, site, scheduledTime);
  });
  stmt.finalize();
}

// Mark keyword as published
function markKeywordPublished(keyword, site) {
  db.run(`UPDATE keywords SET published = 1 WHERE keyword = ? AND site = ?`, [keyword, site]);
}

// Get unpublished keywords for a site, with limit
function getUnpublishedKeywords(site, limit = 5, callback) {
  db.all(`SELECT * FROM keywords WHERE site = ? AND published = 0 LIMIT ?`, [site, limit], (err, rows) => {
    if (err) {
      callback(err, null);
    } else {
      callback(null, rows);
    }
  });
}

// Create tables when the app starts
createArticlesTable();
createKeywordsTable();

export { db, bulkSaveKeywords, markKeywordPublished, getUnpublishedKeywords };
