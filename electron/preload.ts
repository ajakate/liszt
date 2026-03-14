import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Settings
  getApiKey: () => ipcRenderer.invoke('settings:getApiKey'),
  setApiKey: (key: string) => ipcRenderer.invoke('settings:setApiKey', key),
  getModel: () => ipcRenderer.invoke('settings:getModel'),
  setModel: (model: string) => ipcRenderer.invoke('settings:setModel', model),
  getAvailableModels: () => ipcRenderer.invoke('settings:getAvailableModels'),

  // Preferences
  getPreferences: () => ipcRenderer.invoke('preferences:getAll'),
  addPreference: (question: string) => ipcRenderer.invoke('preferences:add', question),
  deletePreference: (id: number) => ipcRenderer.invoke('preferences:delete', id),

  // Books
  importBook: () => ipcRenderer.invoke('books:import'),
  getBooks: () => ipcRenderer.invoke('books:getAll'),
  getBook: (id: number) => ipcRenderer.invoke('books:get', id),
  deleteBook: (id: number) => ipcRenderer.invoke('books:delete', id),
  setRating: (id: number, rating: number | null) => ipcRenderer.invoke('books:setRating', id, rating),

  // Analysis
  runAnalysis: (bookId: number) => ipcRenderer.invoke('analysis:run', bookId),
  getAnalysisResults: (bookId: number) => ipcRenderer.invoke('analysis:getResults', bookId),

  // Style
  generateStyleProfile: (bookId: number) => ipcRenderer.invoke('style:generate', bookId),
  getStyleProfile: (bookId: number) => ipcRenderer.invoke('style:getProfile', bookId),
  getAllStyleProfiles: () => ipcRenderer.invoke('style:getAllProfiles'),

  // Usage
  getTotalCost: () => ipcRenderer.invoke('usage:getTotalCost'),
  estimateCost: (bookId: number) => ipcRenderer.invoke('usage:estimateCost', bookId),

  // Dialogs
  showConfirm: (message: string) => ipcRenderer.invoke('dialog:confirm', message),
});
