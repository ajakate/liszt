import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { initDatabase, getDatabase } from './database';
import { extractEpubText, extractEpubMetadata } from './epub';
import { analyzeBook, generateStyleProfile, estimateCost, DEFAULT_MODEL, AVAILABLE_MODELS } from './claude';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Liszt',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();
  registerIpcHandlers();
});

app.on('window-all-closed', () => {
  app.quit();
});

function registerIpcHandlers() {
  const db = getDatabase();

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
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const metadata = extractEpubMetadata(filePath);
    const text = extractEpubText(filePath);

    // Store a truncated version of the text for the DB (full text can be very large)
    const textPreview = text.substring(0, 5000);
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

    const insertResult = db.prepare(
      'INSERT INTO books (title, author, file_path, text_content, text_preview, word_count) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(metadata.title, metadata.author, filePath, text, textPreview, wordCount);

    return {
      id: insertResult.lastInsertRowid,
      title: metadata.title,
      author: metadata.author,
      file_path: filePath,
      text_preview: textPreview,
      word_count: wordCount,
    };
  });

  ipcMain.handle('books:getAll', () => {
    return db.prepare('SELECT id, title, author, file_path, text_preview, word_count, created_at FROM books ORDER BY created_at DESC').all();
  });

  ipcMain.handle('books:get', (_event, id: number) => {
    return db.prepare('SELECT id, title, author, file_path, text_preview, word_count, created_at FROM books WHERE id = ?').get(id);
  });

  ipcMain.handle('books:delete', (_event, id: number) => {
    db.prepare('DELETE FROM analysis_results WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM style_profiles WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM books WHERE id = ?').run(id);
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

    // Use first ~100k chars of text (Claude context limit consideration)
    const textSample = book.text_content.substring(0, 100000);

    const { results, usage } = await analyzeBook(apiKey, model, book.title, book.author, textSample, questions);

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
  ipcMain.handle('style:generate', async (_event, bookId: number) => {
    const apiKey = (db.prepare('SELECT value FROM settings WHERE key = ?').get('api_key') as { value: string } | undefined)?.value;
    if (!apiKey) throw new Error('API key not set. Please set your Claude API key in Settings.');

    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId) as any;
    if (!book) throw new Error('Book not found');

    const model = (db.prepare('SELECT value FROM settings WHERE key = ?').get('model') as { value: string } | undefined)?.value || DEFAULT_MODEL;
    const textSample = book.text_content.substring(0, 100000);

    const { profile, usage } = await generateStyleProfile(apiKey, model, book.title, book.author, textSample);

    db.prepare('INSERT OR REPLACE INTO style_profiles (book_id, profile_json, description) VALUES (?, ?, ?)').run(
      bookId,
      JSON.stringify(profile.scores),
      profile.description
    );

    // Log usage
    db.prepare('INSERT INTO usage_log (book_id, operation, model, input_tokens, output_tokens, cost) VALUES (?, ?, ?, ?, ?, ?)').run(
      bookId, 'style_profile', usage.model, usage.input_tokens, usage.output_tokens, usage.cost
    );

    return { ...profile, usage };
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
    const textLength = Math.min(book.text_content.length, 100000);
    return estimateCost(model, textLength);
  });
}
