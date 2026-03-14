import { app, BrowserWindow, ipcMain, dialog, nativeImage } from 'electron';
import * as path from 'path';
import { initDatabase, getDatabase } from './database';
import { extractEpubText, extractEpubMetadata } from './epub';
import { analyzeBook, estimateCost, DEFAULT_MODEL, AVAILABLE_MODELS } from './claude';
import { computeStyleProfile } from './stylometrics';

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
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist-renderer', 'index.html'));
  }
}

app.whenReady().then(() => {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  app.dock?.setIcon(nativeImage.createFromPath(iconPath));
  initDatabase();
  createWindow();
  registerIpcHandlers();
});

app.on('window-all-closed', () => {
  app.quit();
});

function registerIpcHandlers() {
  const db = getDatabase();

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

        // Compute style profile on import (instant, no API cost)
        const { scores, description } = computeStyleProfile(text);
        db.prepare('INSERT OR REPLACE INTO style_profiles (book_id, profile_json, description) VALUES (?, ?, ?)').run(
          bookId, JSON.stringify(scores), description
        );

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

    return imported;
  });

  ipcMain.handle('books:getAll', () => {
    return db.prepare('SELECT id, title, author, file_path, text_preview, word_count, rating, created_at FROM books ORDER BY created_at DESC').all();
  });

  ipcMain.handle('books:get', (_event, id: number) => {
    return db.prepare('SELECT id, title, author, file_path, text_preview, word_count, rating, created_at FROM books WHERE id = ?').get(id);
  });

  ipcMain.handle('books:delete', (_event, id: number) => {
    db.prepare('DELETE FROM book_tags WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM usage_log WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM analysis_results WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM style_profiles WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM books WHERE id = ?').run(id);
  });

  ipcMain.handle('books:setRating', (_event, id: number, rating: number | null) => {
    db.prepare('UPDATE books SET rating = ? WHERE id = ?').run(rating, id);
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

    // Clear old results for this book
    db.prepare('DELETE FROM analysis_results WHERE book_id = ?').run(bookId);

    // Store new results
    const insert = db.prepare('INSERT INTO analysis_results (book_id, question, answer) VALUES (?, ?, ?)');
    for (const result of results) {
      insert.run(bookId, result.question, result.answer);
    }

    // Log usage
    db.prepare('INSERT INTO usage_log (book_id, operation, model, input_tokens, output_tokens, cost) VALUES (?, ?, ?, ?, ?, ?)').run(
      bookId, 'analysis', usage.model, usage.input_tokens, usage.output_tokens, usage.cost
    );

    return { results, usage };
  });

  ipcMain.handle('analysis:getResults', (_event, bookId: number) => {
    return db.prepare('SELECT * FROM analysis_results WHERE book_id = ? ORDER BY id').all(bookId);
  });

  // Style profiles
  ipcMain.handle('style:generate', (_event, bookId: number) => {
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId) as any;
    if (!book) throw new Error('Book not found');

    const { scores, description } = computeStyleProfile(book.text_content);

    db.prepare('INSERT OR REPLACE INTO style_profiles (book_id, profile_json, description) VALUES (?, ?, ?)').run(
      bookId,
      JSON.stringify(scores),
      description
    );

    return { book_id: bookId, scores, description };
  });

  ipcMain.handle('style:getProfile', (_event, bookId: number) => {
    const row = db.prepare('SELECT * FROM style_profiles WHERE book_id = ?').get(bookId) as any;
    if (!row) return null;
    return {
      book_id: row.book_id,
      scores: JSON.parse(row.profile_json),
      description: row.description,
    };
  });

  ipcMain.handle('style:getAllProfiles', () => {
    const rows = db.prepare(
      `SELECT sp.*, b.title, b.author FROM style_profiles sp JOIN books b ON sp.book_id = b.id`
    ).all() as any[];
    return rows.map((row: any) => ({
      book_id: row.book_id,
      title: row.title,
      author: row.author,
      scores: JSON.parse(row.profile_json),
      description: row.description,
    }));
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
}
