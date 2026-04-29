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
  updateBookMeta: (id: number, title: string, author: string) => ipcRenderer.invoke('books:updateMeta', id, title, author),
  setDateRead: (id: number, dateRead: string | null) => ipcRenderer.invoke('books:setDateRead', id, dateRead),

  // Analysis
  runAnalysis: (bookId: number) => ipcRenderer.invoke('analysis:run', bookId),
  getAnalysisResults: (bookId: number) => ipcRenderer.invoke('analysis:getResults', bookId),

  // Style
  generateStyleProfile: (bookId: number) => ipcRenderer.invoke('style:generate', bookId),
  getStyleProfile: (bookId: number) => ipcRenderer.invoke('style:getProfile', bookId),
  getAllStyleProfiles: () => ipcRenderer.invoke('style:getAllProfiles'),
  compareStyles: (bookIdA: number, bookIdB: number) => ipcRenderer.invoke('style:compare', bookIdA, bookIdB),
  getFeatureRegistry: () => ipcRenderer.invoke('style:getFeatureRegistry'),
  getTopStyleMatches: (bookId: number, limit?: number) => ipcRenderer.invoke('style:topMatches', bookId, limit),

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

  // Content tags
  getContentTags: () => ipcRenderer.invoke('contentTags:getAll'),
  createContentTag: (name: string, description: string) => ipcRenderer.invoke('contentTags:create', name, description),
  updateContentTag: (id: number, name: string, description: string) => ipcRenderer.invoke('contentTags:update', id, name, description),
  deleteContentTag: (id: number) => ipcRenderer.invoke('contentTags:delete', id),
  getContentScores: (bookId: number) => ipcRenderer.invoke('contentScores:getForBook', bookId),

  // Context groups
  getContextGroups: () => ipcRenderer.invoke('contextGroups:getAll'),
  createContextGroup: (name: string) => ipcRenderer.invoke('contextGroups:create', name),
  updateContextGroup: (id: number, name: string) => ipcRenderer.invoke('contextGroups:update', id, name),
  deleteContextGroup: (id: number) => ipcRenderer.invoke('contextGroups:delete', id),
  getBookContextGroups: (bookId: number) => ipcRenderer.invoke('contextGroups:getForBook', bookId),
  addContextGroupToBook: (bookId: number, groupId: number) => ipcRenderer.invoke('contextGroups:addToBook', bookId, groupId),
  removeContextGroupFromBook: (bookId: number, groupId: number) => ipcRenderer.invoke('contextGroups:removeFromBook', bookId, groupId),
  getAllBookContextGroups: () => ipcRenderer.invoke('contextGroups:getAllBookGroups'),
  getContentTagContextGroups: (contentTagId: number) => ipcRenderer.invoke('contextGroups:getForContentTag', contentTagId),
  addContextGroupToContentTag: (contentTagId: number, groupId: number) => ipcRenderer.invoke('contextGroups:addToContentTag', contentTagId, groupId),
  removeContextGroupToContentTag: (contentTagId: number, groupId: number) => ipcRenderer.invoke('contextGroups:removeFromContentTag', contentTagId, groupId),
  getAllContentTagContextGroups: () => ipcRenderer.invoke('contextGroups:getAllContentTagGroups'),

  // Database
  exportDb: () => ipcRenderer.invoke('db:export'),
  importDb: () => ipcRenderer.invoke('db:import'),
  isDev: () => ipcRenderer.invoke('db:isDev'),

  // Dialogs
  showConfirm: (message: string) => ipcRenderer.invoke('dialog:confirm', message),
});
