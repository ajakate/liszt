export interface Book {
  id: number;
  title: string;
  author: string;
  file_path: string;
  text_preview: string;
  word_count: number;
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

export interface StyleScores {
  prose_density: number;
  dialogue_ratio: number;
  sentence_length: number;
  vocabulary_complexity: number;
  tone_lightness: number;
  pacing: number;
  metaphor_usage: number;
  emotional_intensity: number;
  formality: number;
  descriptiveness: number;
}

export interface StyleProfile {
  book_id: number;
  title?: string;
  author?: string;
  scores: StyleScores;
  description: string;
}

export interface ModelOption {
  id: string;
  name: string;
}

declare global {
  interface Window {
    api: {
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
      runAnalysis: (bookId: number) => Promise<{ results: AnalysisResult[]; usage: UsageInfo }>;
      getAnalysisResults: (bookId: number) => Promise<AnalysisResult[]>;
      generateStyleProfile: (bookId: number) => Promise<StyleProfile & { usage: UsageInfo }>;
      getStyleProfile: (bookId: number) => Promise<StyleProfile | null>;
      getAllStyleProfiles: () => Promise<StyleProfile[]>;
      getTotalCost: () => Promise<number>;
      estimateCost: (bookId: number) => Promise<number>;
      showConfirm: (message: string) => Promise<boolean>;
    };
  }
}
