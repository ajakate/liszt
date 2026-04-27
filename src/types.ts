export interface Book {
  id: number;
  title: string;
  author: string;
  file_path: string;
  text_preview: string;
  word_count: number;
  rating: number | null;
  created_at: string;
}

export interface Preference {
  id: number;
  question: string;
  created_at: string;
}

export interface AnalysisResult {
  id: number;
  book_id: number;
  question: string;
  answer: string;
  created_at: string;
}

export interface UsageInfo {
  input_tokens: number;
  output_tokens: number;
  cost: number;
  model: string;
}

export interface FeatureEntry {
  feature_name: string;
  category: string;
  description: string;
}

export interface StyleProfile {
  book_id: number;
  title?: string;
  author?: string;
  features: Record<string, number>;
  zScores: Record<string, number>;
  charNgrams: Record<string, number>;
}

export interface StyleComparison {
  overall: number;
  byCategory: Record<string, number>;
}

export interface StyleMatch {
  book_id: number;
  title: string;
  author: string;
  rating: number | null;
  similarity: number;
}

export interface ContentTag {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

export interface ContentScore {
  tag_id: number;
  name: string;
  description: string;
  score: number;
  explanation: string;
}

export interface Tag {
  id: number;
  name: string;
  created_at: string;
}

export interface ModelOption {
  id: string;
  name: string;
}

declare global {
  interface Window {
    api: {
      getVersion: () => Promise<string>;
      getApiKey: () => Promise<string>;
      setApiKey: (key: string) => Promise<void>;
      getModel: () => Promise<string>;
      setModel: (model: string) => Promise<void>;
      getAvailableModels: () => Promise<ModelOption[]>;
      getPreferences: () => Promise<Preference[]>;
      addPreference: (question: string) => Promise<number>;
      deletePreference: (id: number) => Promise<void>;
      importBook: () => Promise<Book[]>;
      getBooks: () => Promise<Book[]>;
      getBook: (id: number) => Promise<Book>;
      deleteBook: (id: number) => Promise<void>;
      setRating: (id: number, rating: number | null) => Promise<void>;
      updateBookMeta: (id: number, title: string, author: string) => Promise<void>;
      runAnalysis: (bookId: number) => Promise<{ results: AnalysisResult[]; usage: UsageInfo }>;
      getAnalysisResults: (bookId: number) => Promise<AnalysisResult[]>;
      generateStyleProfile: (bookId: number) => Promise<StyleProfile>;
      getStyleProfile: (bookId: number) => Promise<StyleProfile | null>;
      getAllStyleProfiles: () => Promise<StyleProfile[]>;
      compareStyles: (bookIdA: number, bookIdB: number) => Promise<StyleComparison>;
      getFeatureRegistry: () => Promise<FeatureEntry[]>;
      getTopStyleMatches: (bookId: number, limit?: number) => Promise<StyleMatch[]>;
      getContentTags: () => Promise<ContentTag[]>;
      createContentTag: (name: string, description: string) => Promise<number>;
      updateContentTag: (id: number, name: string, description: string) => Promise<void>;
      deleteContentTag: (id: number) => Promise<void>;
      getContentScores: (bookId: number) => Promise<ContentScore[]>;
      getTotalCost: () => Promise<number>;
      estimateCost: (bookId: number) => Promise<number>;
      getTags: () => Promise<Tag[]>;
      createTag: (name: string) => Promise<number>;
      updateTag: (id: number, name: string) => Promise<void>;
      deleteTag: (id: number) => Promise<void>;
      getBookTags: (bookId: number) => Promise<Tag[]>;
      addTagToBook: (bookId: number, tagId: number) => Promise<void>;
      removeTagFromBook: (bookId: number, tagId: number) => Promise<void>;
      getAllBookTags: () => Promise<{ book_id: number; id: number; name: string }[]>;
      exportDb: () => Promise<boolean>;
      importDb: () => Promise<boolean>;
      isDev: () => Promise<boolean>;
      showConfirm: (message: string) => Promise<boolean>;
    };
  }
}
