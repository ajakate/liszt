import { app, BrowserWindow, ipcMain, dialog, nativeImage, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { initDatabase, getDatabase } from './database';
import { extractEpubText, extractEpubMetadata } from './epub';
import { analyzeBook, scoreContentTags, estimateCost, DEFAULT_MODEL, AVAILABLE_MODELS } from './claude';
import { computeAllFeatures, getFeatureRegistry } from './stylometrics';
import { recomputeFeatureStatistics, getBookZScores, computeSimilarity } from './feature-stats';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Liszt',
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist-renderer', 'index.html'));
  }
}

app.whenReady().then(() => {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  app.dock?.setIcon(nativeImage.createFromPath(iconPath));

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        {
          label: `About Liszt`,
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About Liszt',
              message: `Liszt v${app.getVersion()}`,
              detail: 'Why waste your time?',
              icon: nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon.png')),
            });
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  initDatabase();
  createWindow();
  registerIpcHandlers();
});

app.on('window-all-closed', () => {
  app.quit();
});

// Helper: store computed features for a book
function storeBookFeatures(db: ReturnType<typeof getDatabase>, bookId: number, text: string) {
  const { features, charNgrams } = computeAllFeatures(text);

  // Clear old features
  db.prepare('DELETE FROM book_features WHERE book_id = ?').run(bookId);
  db.prepare('DELETE FROM book_char_ngrams WHERE book_id = ?').run(bookId);

  const insertFeature = db.prepare('INSERT INTO book_features (book_id, feature_name, feature_value) VALUES (?, ?, ?)');
  for (const [name, value] of Object.entries(features)) {
    insertFeature.run(bookId, name, value);
  }

  const insertNgram = db.prepare('INSERT INTO book_char_ngrams (book_id, ngram, frequency) VALUES (?, ?, ?)');
  for (const [ngram, freq] of Object.entries(charNgrams)) {
    insertNgram.run(bookId, ngram, freq);
  }
}

function registerIpcHandlers() {
  const db = getDatabase();

  // App info
  ipcMain.handle('app:getVersion', () => app.getVersion());

  // Dialogs
  ipcMain.handle('dialog:confirm', async (_event, message: string) => {
    const result = await dialog.showMessageBox(mainWindow!, {
      type: 'question',
      buttons: ['Cancel', 'Delete'],
      defaultId: 0,
      message,
    });
    return result.response === 1;
  });

  // Settings
  ipcMain.handle('settings:getApiKey', () => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('api_key') as { value: string } | undefined;
    return row?.value || '';
  });

  ipcMain.handle('settings:setApiKey', (_event, apiKey: string) => {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('api_key', apiKey);
  });

  ipcMain.handle('settings:getModel', () => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('model') as { value: string } | undefined;
    return row?.value || DEFAULT_MODEL;
  });

  ipcMain.handle('settings:setModel', (_event, model: string) => {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('model', model);
  });

  ipcMain.handle('settings:getAvailableModels', () => {
    return AVAILABLE_MODELS;
  });

  // Preferences (questions)
  ipcMain.handle('preferences:getAll', () => {
    return db.prepare('SELECT * FROM preferences ORDER BY created_at').all();
  });

  ipcMain.handle('preferences:add', (_event, question: string) => {
    const result = db.prepare('INSERT INTO preferences (question) VALUES (?)').run(question);
    return result.lastInsertRowid;
  });

  ipcMain.handle('preferences:delete', (_event, id: number) => {
    db.prepare('DELETE FROM preferences WHERE id = ?').run(id);
  });

  // Books
  ipcMain.handle('books:import', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      filters: [{ name: 'eBooks', extensions: ['epub'] }],
      properties: ['openFile', 'multiSelections'],
    });

    if (result.canceled || result.filePaths.length === 0) return [];

    const imported = [];
    for (const filePath of result.filePaths) {
      try {
        const metadata = extractEpubMetadata(filePath);
        const text = extractEpubText(filePath);
        const textPreview = text.substring(0, 5000);
        const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

        const insertResult = db.prepare(
          'INSERT INTO books (title, author, file_path, text_content, text_preview, word_count) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(metadata.title, metadata.author, filePath, text, textPreview, wordCount);

        const bookId = insertResult.lastInsertRowid as number;

        // Compute stylometric features on import
        storeBookFeatures(db, bookId, text);

        imported.push({
          id: bookId,
          title: metadata.title,
          author: metadata.author,
          file_path: filePath,
          text_preview: textPreview,
          word_count: wordCount,
        });
      } catch (e: any) {
        console.error(`Failed to import ${filePath}: ${e.message}`);
      }
    }

    // Recompute global statistics after all imports
    if (imported.length > 0) {
      recomputeFeatureStatistics(db);
    }

    return imported;
  });

  ipcMain.handle('books:getAll', () => {
    return db.prepare('SELECT id, title, author, file_path, text_preview, word_count, rating, created_at FROM books ORDER BY created_at DESC').all();
  });

  ipcMain.handle('books:get', (_event, id: number) => {
    return db.prepare('SELECT id, title, author, file_path, text_preview, word_count, rating, created_at FROM books WHERE id = ?').get(id);
  });

  ipcMain.handle('books:delete', (_event, id: number) => {
    db.prepare('DELETE FROM book_features WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM book_char_ngrams WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM book_tags WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM content_scores WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM usage_log WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM analysis_results WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM style_profiles WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM books WHERE id = ?').run(id);
    recomputeFeatureStatistics(db);
  });

  ipcMain.handle('books:setRating', (_event, id: number, rating: number | null) => {
    db.prepare('UPDATE books SET rating = ? WHERE id = ?').run(rating, id);
  });

  ipcMain.handle('books:updateMeta', (_event, id: number, title: string, author: string) => {
    db.prepare('UPDATE books SET title = ?, author = ? WHERE id = ?').run(title, author, id);
  });

  // Analysis
  ipcMain.handle('analysis:run', async (_event, bookId: number) => {
    const apiKey = (db.prepare('SELECT value FROM settings WHERE key = ?').get('api_key') as { value: string } | undefined)?.value;
    if (!apiKey) throw new Error('API key not set. Please set your Claude API key in Settings.');

    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId) as any;
    if (!book) throw new Error('Book not found');

    const preferences = db.prepare('SELECT * FROM preferences').all() as any[];
    if (preferences.length === 0) throw new Error('No preferences set. Add some questions in Preferences first.');

    const model = (db.prepare('SELECT value FROM settings WHERE key = ?').get('model') as { value: string } | undefined)?.value || DEFAULT_MODEL;
    const questions = preferences.map((p: any) => p.question);

    const { results, usage } = await analyzeBook(apiKey, model, book.title, book.author, book.text_content, questions);

    db.prepare('DELETE FROM analysis_results WHERE book_id = ?').run(bookId);

    const insert = db.prepare('INSERT INTO analysis_results (book_id, question, answer) VALUES (?, ?, ?)');
    for (const result of results) {
      insert.run(bookId, result.question, result.answer);
    }

    db.prepare('INSERT INTO usage_log (book_id, operation, model, input_tokens, output_tokens, cost) VALUES (?, ?, ?, ?, ?, ?)').run(
      bookId, 'analysis', usage.model, usage.input_tokens, usage.output_tokens, usage.cost
    );

    // Also score content tags if any exist
    const contentTags = db.prepare('SELECT * FROM content_tags').all() as { id: number; name: string; description: string }[];
    let contentUsage = null;
    if (contentTags.length > 0) {
      const { scores, usage: cUsage } = await scoreContentTags(apiKey, model, book.title, book.author, book.text_content, contentTags);

      db.prepare('DELETE FROM content_scores WHERE book_id = ?').run(bookId);
      const insertScore = db.prepare('INSERT OR REPLACE INTO content_scores (book_id, tag_id, score, explanation) VALUES (?, ?, ?, ?)');
      for (const s of scores) {
        insertScore.run(bookId, s.tag_id, s.score, s.explanation);
      }

      db.prepare('INSERT INTO usage_log (book_id, operation, model, input_tokens, output_tokens, cost) VALUES (?, ?, ?, ?, ?, ?)').run(
        bookId, 'content_scoring', cUsage.model, cUsage.input_tokens, cUsage.output_tokens, cUsage.cost
      );
      contentUsage = cUsage;
    }

    return { results, usage, contentUsage };
  });

  ipcMain.handle('analysis:getResults', (_event, bookId: number) => {
    return db.prepare('SELECT * FROM analysis_results WHERE book_id = ? ORDER BY id').all(bookId);
  });

  // Style profiles (new fingerprint system)
  ipcMain.handle('style:generate', (_event, bookId: number) => {
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId) as any;
    if (!book) throw new Error('Book not found');

    storeBookFeatures(db, bookId, book.text_content);
    recomputeFeatureStatistics(db);

    return getStyleProfileData(db, bookId);
  });

  ipcMain.handle('style:getProfile', (_event, bookId: number) => {
    return getStyleProfileData(db, bookId);
  });

  ipcMain.handle('style:getAllProfiles', () => {
    const books = db.prepare(
      'SELECT DISTINCT b.id, b.title, b.author FROM books b JOIN book_features bf ON b.id = bf.book_id'
    ).all() as { id: number; title: string; author: string }[];

    return books.map(book => {
      const profile = getStyleProfileData(db, book.id);
      return profile ? { ...profile, title: book.title, author: book.author } : null;
    }).filter(Boolean);
  });

  ipcMain.handle('style:compare', (_event, bookIdA: number, bookIdB: number) => {
    return computeSimilarity(db, bookIdA, bookIdB);
  });

  ipcMain.handle('style:topMatches', (_event, bookId: number, limit: number = 3) => {
    const otherBooks = db.prepare(
      'SELECT DISTINCT b.id, b.title, b.author, b.rating FROM books b JOIN book_features bf ON b.id = bf.book_id WHERE b.id != ?'
    ).all(bookId) as { id: number; title: string; author: string; rating: number | null }[];

    const scored = otherBooks.map(book => {
      const sim = computeSimilarity(db, bookId, book.id);
      return { book_id: book.id, title: book.title, author: book.author, rating: book.rating, similarity: sim.overall };
    });

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit);
  });

  ipcMain.handle('style:getFeatureRegistry', () => {
    return db.prepare('SELECT * FROM feature_registry ORDER BY category, feature_name').all();
  });

  // Usage / cost tracking
  ipcMain.handle('usage:getTotalCost', () => {
    const row = db.prepare('SELECT COALESCE(SUM(cost), 0) as total FROM usage_log').get() as any;
    return row.total;
  });

  ipcMain.handle('usage:estimateCost', (_event, bookId: number) => {
    const book = db.prepare('SELECT text_content FROM books WHERE id = ?').get(bookId) as any;
    if (!book) return 0;
    const model = (db.prepare('SELECT value FROM settings WHERE key = ?').get('model') as { value: string } | undefined)?.value || DEFAULT_MODEL;
    const textLength = book.text_content.length;
    return estimateCost(model, textLength);
  });

  // Tags
  ipcMain.handle('tags:getAll', () => {
    return db.prepare('SELECT * FROM tags ORDER BY name').all();
  });

  ipcMain.handle('tags:create', (_event, name: string) => {
    const result = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name.trim());
    return result.lastInsertRowid;
  });

  ipcMain.handle('tags:update', (_event, id: number, name: string) => {
    db.prepare('UPDATE tags SET name = ? WHERE id = ?').run(name.trim(), id);
  });

  ipcMain.handle('tags:delete', (_event, id: number) => {
    db.prepare('DELETE FROM book_tags WHERE tag_id = ?').run(id);
    db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  });

  ipcMain.handle('tags:getForBook', (_event, bookId: number) => {
    return db.prepare(
      'SELECT t.* FROM tags t JOIN book_tags bt ON t.id = bt.tag_id WHERE bt.book_id = ? ORDER BY t.name'
    ).all(bookId);
  });

  ipcMain.handle('tags:addToBook', (_event, bookId: number, tagId: number) => {
    db.prepare('INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?, ?)').run(bookId, tagId);
  });

  ipcMain.handle('tags:removeFromBook', (_event, bookId: number, tagId: number) => {
    db.prepare('DELETE FROM book_tags WHERE book_id = ? AND tag_id = ?').run(bookId, tagId);
  });

  ipcMain.handle('tags:getAllBookTags', () => {
    return db.prepare(
      'SELECT bt.book_id, t.id, t.name FROM book_tags bt JOIN tags t ON bt.tag_id = t.id ORDER BY t.name'
    ).all();
  });

  // Content tags
  ipcMain.handle('contentTags:getAll', () => {
    return db.prepare('SELECT * FROM content_tags ORDER BY name').all();
  });

  ipcMain.handle('contentTags:create', (_event, name: string, description: string) => {
    const result = db.prepare('INSERT INTO content_tags (name, description) VALUES (?, ?)').run(name.trim(), description.trim());
    return result.lastInsertRowid;
  });

  ipcMain.handle('contentTags:update', (_event, id: number, name: string, description: string) => {
    db.prepare('UPDATE content_tags SET name = ?, description = ? WHERE id = ?').run(name.trim(), description.trim(), id);
  });

  ipcMain.handle('contentTags:delete', (_event, id: number) => {
    db.prepare('DELETE FROM content_scores WHERE tag_id = ?').run(id);
    db.prepare('DELETE FROM content_tags WHERE id = ?').run(id);
  });

  ipcMain.handle('contentScores:getForBook', (_event, bookId: number) => {
    return db.prepare(
      'SELECT cs.score, cs.explanation, ct.id as tag_id, ct.name, ct.description FROM content_scores cs JOIN content_tags ct ON cs.tag_id = ct.id WHERE cs.book_id = ? ORDER BY ct.name'
    ).all(bookId);
  });

  // Database export/import
  ipcMain.handle('db:export', async () => {
    const dbPath = path.join(app.getPath('userData'), 'liszt.db');
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: 'liszt.db',
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    });
    if (result.canceled || !result.filePath) return false;

    // Checkpoint WAL to ensure all data is in the main file
    db.pragma('wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(dbPath, result.filePath);
    return true;
  });

  ipcMain.handle('db:isDev', () => {
    return !!(process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL);
  });

  ipcMain.handle('db:import', async () => {
    const isDev = !!(process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL);
    if (!isDev) throw new Error('Database import is only available in development mode.');

    const result = await dialog.showOpenDialog(mainWindow!, {
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return false;

    const dbPath = path.join(app.getPath('userData'), 'liszt.db');

    // Close current DB, copy new one, then restart
    db.close();
    fs.copyFileSync(result.filePaths[0], dbPath);

    // Remove WAL/SHM files if they exist from the old DB
    try { fs.unlinkSync(dbPath + '-wal'); } catch {}
    try { fs.unlinkSync(dbPath + '-shm'); } catch {}

    app.relaunch();
    app.exit(0);
    return true;
  });
}

// Helper to build style profile data from new tables
function getStyleProfileData(db: ReturnType<typeof getDatabase>, bookId: number) {
  const features = db.prepare('SELECT feature_name, feature_value FROM book_features WHERE book_id = ?').all(bookId) as {
    feature_name: string;
    feature_value: number;
  }[];

  if (features.length === 0) return null;

  const featureMap: Record<string, number> = {};
  for (const f of features) featureMap[f.feature_name] = f.feature_value;

  const ngrams = db.prepare('SELECT ngram, frequency FROM book_char_ngrams WHERE book_id = ?').all(bookId) as {
    ngram: string;
    frequency: number;
  }[];

  const ngramMap: Record<string, number> = {};
  for (const ng of ngrams) ngramMap[ng.ngram] = ng.frequency;

  const zScores = getBookZScores(db, bookId);

  return {
    book_id: bookId,
    features: featureMap,
    charNgrams: ngramMap,
    zScores,
  };
}
