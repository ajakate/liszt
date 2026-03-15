import nlp from 'compromise';
import { WORD_FREQUENCIES } from './word-frequencies';

// --- Types ---

export interface BookFeatureMap {
  [featureName: string]: number;
}

export interface CharNgramMap {
  [ngram: string]: number;
}

export interface ComputedFeatures {
  features: BookFeatureMap;
  charNgrams: CharNgramMap;
}

export interface FeatureRegistryEntry {
  feature_name: string;
  category: string;
  description: string;
}

// --- Feature Registry ---

export function getFeatureRegistry(): FeatureRegistryEntry[] {
  return [
    // Sentence structure
    { feature_name: 'sentence_length_mean', category: 'sentence_structure', description: 'Average words per sentence' },
    { feature_name: 'sentence_length_variance', category: 'sentence_structure', description: 'Standard deviation of sentence length' },
    { feature_name: 'short_sentence_ratio', category: 'sentence_structure', description: 'Fraction of sentences under 8 words' },
    { feature_name: 'long_sentence_ratio', category: 'sentence_structure', description: 'Fraction of sentences over 25 words' },

    // Punctuation
    { feature_name: 'comma_density', category: 'punctuation', description: 'Commas per 1000 words' },
    { feature_name: 'semicolon_density', category: 'punctuation', description: 'Semicolons per 1000 words' },
    { feature_name: 'dash_density', category: 'punctuation', description: 'Dashes per 1000 words' },
    { feature_name: 'exclamation_density', category: 'punctuation', description: 'Exclamation marks per 1000 words' },
    { feature_name: 'question_density', category: 'punctuation', description: 'Question marks per 1000 words' },

    // Dialogue
    { feature_name: 'dialogue_ratio', category: 'dialogue', description: 'Words in dialogue / total words' },
    { feature_name: 'avg_dialogue_block_length', category: 'dialogue', description: 'Average words per dialogue block' },
    { feature_name: 'dialogue_turn_frequency', category: 'dialogue', description: 'Dialogue blocks per 1000 words' },

    // Vocabulary
    { feature_name: 'type_token_ratio', category: 'vocabulary', description: 'Unique words / total words (10k sample)' },
    { feature_name: 'yules_k', category: 'vocabulary', description: "Yule's K vocabulary richness measure" },
    { feature_name: 'rare_word_ratio', category: 'vocabulary', description: 'Fraction of words not in top 5000' },

    // POS distribution
    { feature_name: 'noun_ratio', category: 'pos_distribution', description: 'Fraction of tokens that are nouns' },
    { feature_name: 'verb_ratio', category: 'pos_distribution', description: 'Fraction of tokens that are verbs' },
    { feature_name: 'adjective_ratio', category: 'pos_distribution', description: 'Fraction of tokens that are adjectives' },
    { feature_name: 'adverb_ratio', category: 'pos_distribution', description: 'Fraction of tokens that are adverbs' },
    { feature_name: 'pronoun_ratio', category: 'pos_distribution', description: 'Fraction of tokens that are pronouns' },
    { feature_name: 'determiner_ratio', category: 'pos_distribution', description: 'Fraction of tokens that are determiners' },
    { feature_name: 'conjunction_ratio', category: 'pos_distribution', description: 'Fraction of tokens that are conjunctions' },
  ];
}

// --- Text Helpers ---

const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'ave', 'blvd',
  'gen', 'sgt', 'cpl', 'pvt', 'lt', 'col', 'maj', 'capt', 'cmdr',
  'etc', 'vs', 'vol', 'dept', 'est', 'approx', 'govt', 'inc', 'corp',
]);

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z']+/g) || [];
}

function getSentences(text: string): string[] {
  const raw = text.split(/(?<=[.!?])\s+/);
  const sentences: string[] = [];
  let buffer = '';

  for (const segment of raw) {
    buffer += (buffer ? ' ' : '') + segment;
    const lastWord = buffer.trim().split(/\s+/).pop()?.replace(/[.!?]+$/, '').toLowerCase() || '';
    if (ABBREVIATIONS.has(lastWord)) continue;
    if (/[.!?]\s*$/.test(buffer) || buffer === raw[raw.length - 1]) {
      if (buffer.trim().length > 0) sentences.push(buffer.trim());
      buffer = '';
    }
  }
  if (buffer.trim().length > 0) sentences.push(buffer.trim());

  return sentences.filter(s => s.split(/\s+/).filter(w => w.length > 0).length >= 3);
}

function getDialogueBlocks(text: string): string[] {
  const blocks: string[] = [];
  const pattern = /[""\u201C](.*?)[""\u201D]/gs;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match[1].trim().length > 0) blocks.push(match[1]);
  }
  return blocks;
}

// --- Sentence Structure Features ---

function computeSentenceStructure(sentences: string[]): BookFeatureMap {
  if (sentences.length === 0) {
    return { sentence_length_mean: 0, sentence_length_variance: 0, short_sentence_ratio: 0, long_sentence_ratio: 0 };
  }

  const lengths = sentences.map(s => s.split(/\s+/).filter(w => w.length > 0).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = Math.sqrt(lengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / lengths.length);
  const shortRatio = lengths.filter(l => l < 8).length / lengths.length;
  const longRatio = lengths.filter(l => l > 25).length / lengths.length;

  return {
    sentence_length_mean: mean,
    sentence_length_variance: variance,
    short_sentence_ratio: shortRatio,
    long_sentence_ratio: longRatio,
  };
}

// --- Punctuation Features ---

function computePunctuation(text: string, totalWords: number): BookFeatureMap {
  if (totalWords === 0) {
    return { comma_density: 0, semicolon_density: 0, dash_density: 0, exclamation_density: 0, question_density: 0 };
  }

  const per1k = (count: number) => (count / totalWords) * 1000;

  return {
    comma_density: per1k((text.match(/,/g) || []).length),
    semicolon_density: per1k((text.match(/;/g) || []).length),
    dash_density: per1k((text.match(/\u2014|--|---/g) || []).length),
    exclamation_density: per1k((text.match(/!/g) || []).length),
    question_density: per1k((text.match(/\?/g) || []).length),
  };
}

// --- Dialogue Features ---

function computeDialogue(text: string, totalWords: number): BookFeatureMap {
  if (totalWords === 0) {
    return { dialogue_ratio: 0, avg_dialogue_block_length: 0, dialogue_turn_frequency: 0 };
  }

  const blocks = getDialogueBlocks(text);
  const blockLengths = blocks.map(b => b.split(/\s+/).filter(w => w.length > 0).length);
  const dialogueWords = blockLengths.reduce((a, b) => a + b, 0);

  return {
    dialogue_ratio: dialogueWords / totalWords,
    avg_dialogue_block_length: blocks.length > 0 ? dialogueWords / blocks.length : 0,
    dialogue_turn_frequency: (blocks.length / totalWords) * 1000,
  };
}

// --- Vocabulary Features ---

function computeVocabulary(words: string[]): BookFeatureMap {
  if (words.length === 0) {
    return { type_token_ratio: 0, yules_k: 0, rare_word_ratio: 0 };
  }

  // Type-token ratio on 10k sample
  const sample = words.slice(0, 10000);
  const ttr = new Set(sample).size / sample.length;

  // Yule's K — length-independent vocabulary richness
  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;

  const spectrumMap: Record<number, number> = {};
  for (const count of Object.values(freq)) {
    spectrumMap[count] = (spectrumMap[count] || 0) + 1;
  }

  const N = words.length;
  let M2 = 0;
  for (const [i, vi] of Object.entries(spectrumMap)) {
    M2 += Number(i) * Number(i) * vi;
  }
  const M1 = N;
  const yulesK = N > 1 ? 10000 * (M2 - M1) / (M1 * M1) : 0;

  // Rare word ratio
  const contentWords = words.filter(w => w.length > 2);
  const rareCount = contentWords.filter(w => !WORD_FREQUENCIES[w]).length;
  const rareRatio = contentWords.length > 0 ? rareCount / contentWords.length : 0;

  return {
    type_token_ratio: ttr,
    yules_k: yulesK,
    rare_word_ratio: rareRatio,
  };
}

// --- POS Distribution Features ---

function computePOS(text: string, totalWords: number): BookFeatureMap {
  if (totalWords === 0) {
    return {
      noun_ratio: 0, verb_ratio: 0, adjective_ratio: 0, adverb_ratio: 0,
      pronoun_ratio: 0, determiner_ratio: 0, conjunction_ratio: 0,
    };
  }

  // Sample ~30k words spread evenly across the text for performance
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const sampleSize = Math.min(30000, words.length);
  let sampleText: string;

  if (words.length <= sampleSize) {
    sampleText = text;
  } else {
    const step = Math.floor(words.length / sampleSize);
    const sampled: string[] = [];
    for (let i = 0; i < words.length && sampled.length < sampleSize; i += step) {
      sampled.push(words[i]);
    }
    sampleText = sampled.join(' ');
  }

  const doc = nlp(sampleText);
  const sampleTotal = sampleSize;

  const nouns = doc.nouns().out('array').length;
  const verbs = doc.verbs().out('array').length;
  const adjectives = doc.adjectives().out('array').length;
  const adverbs = doc.adverbs().out('array').length;

  // compromise doesn't have direct pronoun/determiner/conjunction extraction
  // Use match patterns instead
  const pronouns = doc.match('#Pronoun').out('array').length;
  const determiners = doc.match('#Determiner').out('array').length;
  const conjunctions = doc.match('#Conjunction').out('array').length;

  return {
    noun_ratio: nouns / sampleTotal,
    verb_ratio: verbs / sampleTotal,
    adjective_ratio: adjectives / sampleTotal,
    adverb_ratio: adverbs / sampleTotal,
    pronoun_ratio: pronouns / sampleTotal,
    determiner_ratio: determiners / sampleTotal,
    conjunction_ratio: conjunctions / sampleTotal,
  };
}

// --- Character N-Gram Fingerprints ---

function computeCharNgrams(text: string, n: number = 4, topK: number = 40): CharNgramMap {
  // Normalize: lowercase, collapse whitespace
  const normalized = text.toLowerCase().replace(/\s+/g, ' ');
  if (normalized.length < n) return {};

  const counts: Record<string, number> = {};
  let total = 0;

  for (let i = 0; i <= normalized.length - n; i++) {
    const gram = normalized.substring(i, i + n);
    counts[gram] = (counts[gram] || 0) + 1;
    total++;
  }

  if (total === 0) return {};

  // Sort by frequency, take top K, normalize
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK);

  const result: CharNgramMap = {};
  for (const [gram, count] of sorted) {
    result[gram] = count / total;
  }
  return result;
}

// --- Main Entry Point ---

export function computeAllFeatures(text: string): ComputedFeatures {
  const words = tokenize(text);
  const sentences = getSentences(text);
  const totalWords = words.length;

  const features: BookFeatureMap = {
    ...computeSentenceStructure(sentences),
    ...computePunctuation(text, totalWords),
    ...computeDialogue(text, totalWords),
    ...computeVocabulary(words),
    ...computePOS(text, totalWords),
  };

  const charNgrams = computeCharNgrams(text);

  return { features, charNgrams };
}
