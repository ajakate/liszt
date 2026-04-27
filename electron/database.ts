import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';
import { computeAllFeatures, getFeatureRegistry } from './stylometrics';
import { recomputeFeatureStatistics } from './feature-stats';

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
  {
    version: 5,
    description: 'Clear old Claude-generated style profiles',
    up: (db) => {
      db.exec('DELETE FROM style_profiles');
    },
  },
  {
    version: 6,
    description: 'Legacy stylometric profiles (no-op, superseded by v7)',
    up: () => {},
  },
  {
    version: 7,
    description: 'Stylometric fingerprinting tables and backfill',
    up: (db) => {
      db.exec(`
        CREATE TABLE feature_registry (
          feature_name TEXT PRIMARY KEY,
          category TEXT NOT NULL,
          description TEXT
        );

        CREATE TABLE book_features (
          book_id INTEGER NOT NULL,
          feature_name TEXT NOT NULL,
          feature_value REAL NOT NULL,
          PRIMARY KEY (book_id, feature_name),
          FOREIGN KEY (book_id) REFERENCES books(id)
        );

        CREATE TABLE book_char_ngrams (
          book_id INTEGER NOT NULL,
          ngram TEXT NOT NULL,
          frequency REAL NOT NULL,
          PRIMARY KEY (book_id, ngram),
          FOREIGN KEY (book_id) REFERENCES books(id)
        );

        CREATE TABLE feature_statistics (
          feature_name TEXT PRIMARY KEY,
          mean_value REAL NOT NULL,
          std_dev REAL NOT NULL,
          book_count INTEGER NOT NULL
        );
      `);

      // Seed feature registry
      const insertReg = db.prepare('INSERT INTO feature_registry (feature_name, category, description) VALUES (?, ?, ?)');
      for (const entry of getFeatureRegistry()) {
        insertReg.run(entry.feature_name, entry.category, entry.description);
      }

      // Backfill existing books
      const books = db.prepare('SELECT id, text_content FROM books').all() as { id: number; text_content: string }[];
      const insertFeature = db.prepare('INSERT INTO book_features (book_id, feature_name, feature_value) VALUES (?, ?, ?)');
      const insertNgram = db.prepare('INSERT INTO book_char_ngrams (book_id, ngram, frequency) VALUES (?, ?, ?)');

      for (const book of books) {
        console.log(`  Computing features for book ${book.id}...`);
        const { features, charNgrams } = computeAllFeatures(book.text_content);
        for (const [name, value] of Object.entries(features)) {
          insertFeature.run(book.id, name, value);
        }
        for (const [ngram, freq] of Object.entries(charNgrams)) {
          insertNgram.run(book.id, ngram, freq);
        }
      }

      // Compute initial statistics
      if (books.length > 0) {
        recomputeFeatureStatistics(db);
      }
    },
  },
  {
    version: 8,
    description: 'Content fingerprint tags and scores',
    up: (db) => {
      db.exec(`
        CREATE TABLE content_tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE content_scores (
          book_id INTEGER NOT NULL,
          tag_id INTEGER NOT NULL,
          score INTEGER NOT NULL,
          explanation TEXT NOT NULL DEFAULT '',
          PRIMARY KEY (book_id, tag_id),
          FOREIGN KEY (book_id) REFERENCES books(id),
          FOREIGN KEY (tag_id) REFERENCES content_tags(id)
        );
      `);
    },
  },
  {
    version: 9,
    description: 'Context groups for scoping content fingerprints',
    up: (db) => {
      db.exec(`
        CREATE TABLE context_groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE book_context_groups (
          book_id INTEGER NOT NULL,
          context_group_id INTEGER NOT NULL,
          PRIMARY KEY (book_id, context_group_id),
          FOREIGN KEY (book_id) REFERENCES books(id),
          FOREIGN KEY (context_group_id) REFERENCES context_groups(id)
        );

        CREATE TABLE content_tag_context_groups (
          content_tag_id INTEGER NOT NULL,
          context_group_id INTEGER NOT NULL,
          PRIMARY KEY (content_tag_id, context_group_id),
          FOREIGN KEY (content_tag_id) REFERENCES content_tags(id),
          FOREIGN KEY (context_group_id) REFERENCES context_groups(id)
        );
      `);
    },
  },
];

function getSchemaVersion(db: Database.Database): number {
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
