import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';

let db: Database.Database;

type Migration = {
  version: number;
  description: string;
  up: (db: Database.Database) => void;
};

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Initial schema',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS preferences (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          question TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS books (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          author TEXT,
          file_path TEXT NOT NULL,
          text_content TEXT NOT NULL,
          text_preview TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS analysis_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          book_id INTEGER NOT NULL,
          question TEXT NOT NULL,
          answer TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (book_id) REFERENCES books(id)
        );

        CREATE TABLE IF NOT EXISTS style_profiles (
          book_id INTEGER PRIMARY KEY,
          profile_json TEXT NOT NULL,
          description TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (book_id) REFERENCES books(id)
        );

        CREATE TABLE IF NOT EXISTS usage_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          book_id INTEGER,
          operation TEXT NOT NULL,
          model TEXT NOT NULL,
          input_tokens INTEGER NOT NULL,
          output_tokens INTEGER NOT NULL,
          cost REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (book_id) REFERENCES books(id)
        );
      `);
    },
  },
  {
    version: 2,
    description: 'Add word_count to books',
    up: (db) => {
      db.exec('ALTER TABLE books ADD COLUMN word_count INTEGER DEFAULT 0');
    },
  },
  {
    version: 3,
    description: 'Add rating to books',
    up: (db) => {
      db.exec('ALTER TABLE books ADD COLUMN rating INTEGER');
    },
  },
  {
    version: 4,
    description: 'Add tags and book_tags',
    up: (db) => {
      db.exec(`
        CREATE TABLE tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE book_tags (
          book_id INTEGER NOT NULL,
          tag_id INTEGER NOT NULL,
          PRIMARY KEY (book_id, tag_id),
          FOREIGN KEY (book_id) REFERENCES books(id),
          FOREIGN KEY (tag_id) REFERENCES tags(id)
        );
      `);
    },
  },
  // To add a new migration, append here:
];

function getSchemaVersion(db: Database.Database): number {
  // user_version is a built-in SQLite pragma — no extra table needed
  const row = db.pragma('user_version', { simple: true }) as number;
  return row;
}

function setSchemaVersion(db: Database.Database, version: number) {
  db.pragma(`user_version = ${version}`);
}

function runMigrations(db: Database.Database) {
  const currentVersion = getSchemaVersion(db);

  const pending = migrations.filter((m) => m.version > currentVersion);
  if (pending.length === 0) return;

  const migrate = db.transaction(() => {
    for (const migration of pending) {
      console.log(`Running migration v${migration.version}: ${migration.description}`);
      migration.up(db);
      setSchemaVersion(db, migration.version);
    }
  });

  migrate();
}

export function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'liszt.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  runMigrations(db);
}

export function getDatabase() {
  return db;
}
