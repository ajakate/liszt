import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // App
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

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
  compareStyles: (bookIdA: number, bookIdB: number) => ipcRenderer.invoke('style:compare', bookIdA, bookIdB),
  getFeatureRegistry: () => ipcRenderer.invoke('style:getFeatureRegistry'),

  // Usage
  getTotalCost: () => ipcRenderer.invoke('usage:getTotalCost'),
  estimateCost: (bookId: number) => ipcRenderer.invoke('usage:estimateCost', bookId),

  // Tags
  getTags: () => ipcRenderer.invoke('tags:getAll'),
  createTag: (name: string) => ipcRenderer.invoke('tags:create', name),
  updateTag: (id: number, name: string) => ipcRenderer.invoke('tags:update', id, name),
  deleteTag: (id: number) => ipcRenderer.invoke('tags:delete', id),
  getBookTags: (bookId: number) => ipcRenderer.invoke('tags:getForBook', bookId),
  addTagToBook: (bookId: number, tagId: number) => ipcRenderer.invoke('tags:addToBook', bookId, tagId),
  removeTagFromBook: (bookId: number, tagId: number) => ipcRenderer.invoke('tags:removeFromBook', bookId, tagId),
  getAllBookTags: () => ipcRenderer.invoke('tags:getAllBookTags'),

  // Dialogs
  showConfirm: (message: string) => ipcRenderer.invoke('dialog:confirm', message),
});
