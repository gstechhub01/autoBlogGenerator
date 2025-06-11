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

// Create tables when the app starts
createArticlesTable();

export { db };
