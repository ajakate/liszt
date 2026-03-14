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

export interface StyleScores {
  sentence_length_mean: number;
  sentence_length_variance: number;
  paragraph_length: number;
  vocabulary_richness: number;
  hapax_ratio: number;
  function_word_density: number;
  dialogue_ratio: number;
  adverb_density: number;
  em_dash_frequency: number;
  exclamation_frequency: number;
  semicolon_frequency: number;
  vocabulary_commonality: number;
  latinate_ratio: number;
  said_bookism_ratio: number;
  intensifier_density: number;
  simile_density: number;
}

export interface StyleProfile {
  book_id: number;
  title?: string;
  author?: string;
  scores: StyleScores;
  description: string;
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
      runAnalysis: (bookId: number) => Promise<{ results: AnalysisResult[]; usage: UsageInfo }>;
      getAnalysisResults: (bookId: number) => Promise<AnalysisResult[]>;
      generateStyleProfile: (bookId: number) => Promise<StyleProfile>;
      getStyleProfile: (bookId: number) => Promise<StyleProfile | null>;
      getAllStyleProfiles: () => Promise<StyleProfile[]>;
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
      showConfirm: (message: string) => Promise<boolean>;
    };
  }
}
