import { WORD_FREQUENCIES } from './word-frequencies';

// --- Static word lists ---

const FUNCTION_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'when',
  'at', 'by', 'for', 'with', 'about', 'against', 'between', 'through',
  'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up',
  'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further',
  'than', 'once', 'here', 'there', 'where', 'why', 'how', 'all', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'too', 'very', 'just', 'because',
  'as', 'until', 'while', 'of', 'do', 'does', 'did', 'doing', 'done',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'has', 'have', 'had', 'having', 'will', 'would', 'shall', 'should',
  'may', 'might', 'must', 'can', 'could',
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
  'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  'into', 'upon', 'also', 'still', 'even', 'yet', 'already', 'now',
  'never', 'always', 'often', 'sometimes', 'perhaps', 'however',
  'although', 'though', 'whether', 'either', 'neither', 'rather',
  'quite', 'since', 'unless', 'despite', 'without', 'within',
]);

// Words ending in -ly that are NOT adverbs
const LY_EXCEPTIONS = new Set([
  'family', 'only', 'early', 'holy', 'ugly', 'belly', 'fly', 'july',
  'italy', 'rely', 'supply', 'apply', 'ally', 'bully', 'jelly', 'silly',
  'hilly', 'rally', 'tally', 'folly', 'jolly', 'molly', 'polly', 'billy',
  'willy', 'lily', 'likely', 'lonely', 'friendly', 'lovely', 'lively',
  'costly', 'deadly', 'elderly', 'ghostly', 'goodly', 'heavenly', 'homely',
  'kindly', 'manly', 'orderly', 'scholarly', 'shapely', 'timely', 'worldly',
  'curly', 'surly', 'woolly', 'gnarly',
]);

const BOOKISM_VERBS = new Set([
  'murmured', 'whispered', 'breathed', 'snarled', 'hissed', 'exclaimed',
  'declared', 'muttered', 'stammered', 'growled', 'purred', 'rasped',
  'crooned', 'drawled', 'intoned', 'gasped', 'sighed', 'moaned', 'groaned',
  'shrieked', 'screamed', 'barked', 'snapped', 'cooed', 'chirped',
  'bellowed', 'roared', 'thundered', 'pleaded', 'begged', 'demanded',
  'commanded', 'ordered', 'insisted', 'whimpered', 'sobbed', 'wailed',
  'choked', 'squeaked', 'squealed', 'huffed', 'panted', 'grunted',
  'murmur', 'whisper', 'breathe', 'snarl', 'hiss', 'exclaim',
  'declare', 'mutter', 'stammer', 'growl', 'purr', 'rasp',
  'croon', 'drawl', 'intone', 'gasp', 'sigh', 'moan', 'groan',
  'shriek', 'scream', 'bark', 'snap', 'coo', 'chirp',
  'bellow', 'roar', 'thunder', 'plead', 'beg', 'demand',
  'command', 'insist', 'whimper', 'sob', 'wail',
  'choke', 'squeak', 'squeal', 'huff', 'pant', 'grunt',
]);

const INTENSIFIERS = new Set([
  'very', 'really', 'utterly', 'absolutely', 'incredibly', 'impossibly',
  'remarkably', 'extremely', 'profoundly', 'tremendously', 'completely',
  'totally', 'entirely', 'thoroughly', 'perfectly', 'deeply', 'highly',
  'exceedingly', 'immensely', 'infinitely', 'overwhelmingly', 'desperately',
  'fiercely', 'terribly', 'awfully', 'dreadfully', 'frightfully',
  'achingly', 'blindingly', 'staggeringly', 'devastatingly', 'painfully',
]);

const LATINATE_SUFFIXES = [
  'tion', 'sion', 'ment', 'ance', 'ence', 'ous', 'ious', 'eous',
  'ive', 'ible', 'able', 'ity', 'ual', 'ular', 'ary', 'ory',
  'ify', 'ize', 'ate', 'ude', 'ure',
];

const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'ave', 'blvd',
  'gen', 'sgt', 'cpl', 'pvt', 'lt', 'col', 'maj', 'capt', 'cmdr',
  'etc', 'vs', 'vol', 'dept', 'est', 'approx', 'govt', 'inc', 'corp',
]);

const DEFAULT_RANK = 5000;

// --- Text processing helpers ---

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z']+/g) || [];
}

function getContentWords(words: string[]): string[] {
  return words.filter(w => !FUNCTION_WORDS.has(w) && w.length > 2);
}

function getSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace or end
  // But avoid splitting on abbreviations
  const raw = text.split(/(?<=[.!?])\s+/);
  const sentences: string[] = [];
  let buffer = '';

  for (const segment of raw) {
    buffer += (buffer ? ' ' : '') + segment;
    // Check if the segment ends with an abbreviation
    const lastWord = buffer.trim().split(/\s+/).pop()?.replace(/[.!?]+$/, '').toLowerCase() || '';
    if (ABBREVIATIONS.has(lastWord)) {
      continue; // Don't split here, accumulate
    }
    if (/[.!?]\s*$/.test(buffer) || buffer === raw[raw.length - 1]) {
      if (buffer.trim().length > 0) {
        sentences.push(buffer.trim());
      }
      buffer = '';
    }
  }
  if (buffer.trim().length > 0) {
    sentences.push(buffer.trim());
  }

  return sentences.filter(s => {
    const words = s.split(/\s+/).filter(w => w.length > 0);
    return words.length >= 3; // Filter out tiny fragments
  });
}

function getParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).filter(p => p.trim().length > 30);
}

function countDialogueWords(text: string): number {
  // Match text between quotation marks (straight and curly)
  const dialoguePattern = /[""\u201C](.*?)[""\u201D]/gs;
  let totalWords = 0;
  let match;
  while ((match = dialoguePattern.exec(text)) !== null) {
    totalWords += match[1].split(/\s+/).filter(w => w.length > 0).length;
  }
  return totalWords;
}

// --- Feature computation ---

function computeSentenceLengthMean(sentences: string[]): number {
  if (sentences.length === 0) return 0;
  const lengths = sentences.map(s => s.split(/\s+/).filter(w => w.length > 0).length);
  return lengths.reduce((a, b) => a + b, 0) / lengths.length;
}

function computeSentenceLengthVariance(sentences: string[]): number {
  if (sentences.length < 2) return 0;
  const lengths = sentences.map(s => s.split(/\s+/).filter(w => w.length > 0).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / lengths.length;
  return Math.sqrt(variance); // standard deviation
}

function computeParagraphLength(paragraphs: string[], sentences: string[]): number {
  if (paragraphs.length === 0) return 0;
  // Average sentences per paragraph (approximate)
  return sentences.length / paragraphs.length;
}

function computeVocabularyRichness(words: string[]): number {
  // Type-token ratio on a 10k word sample to avoid TTR decay
  const sample = words.slice(0, 10000);
  if (sample.length === 0) return 0;
  const unique = new Set(sample);
  return unique.size / sample.length;
}

function computeHapaxRatio(words: string[]): number {
  const freq: Record<string, number> = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }
  const unique = Object.keys(freq).length;
  if (unique === 0) return 0;
  const hapax = Object.values(freq).filter(c => c === 1).length;
  return hapax / unique;
}

function computeFunctionWordDensity(words: string[]): number {
  if (words.length === 0) return 0;
  const count = words.filter(w => FUNCTION_WORDS.has(w)).length;
  return count / words.length;
}

function computeDialogueRatio(text: string, totalWords: number): number {
  if (totalWords === 0) return 0;
  return countDialogueWords(text) / totalWords;
}

function computeAdverbDensity(words: string[]): number {
  if (words.length === 0) return 0;
  const count = words.filter(w => w.endsWith('ly') && w.length > 3 && !LY_EXCEPTIONS.has(w)).length;
  return count / words.length;
}

function computeEmDashFrequency(text: string, totalWords: number): number {
  if (totalWords === 0) return 0;
  // Count em-dashes (unicode), double hyphens, and triple hyphens
  const count = (text.match(/\u2014|--|---/g) || []).length;
  return (count / totalWords) * 1000;
}

function computeExclamationFrequency(text: string, sentenceCount: number): number {
  if (sentenceCount === 0) return 0;
  const count = (text.match(/!/g) || []).length;
  return (count / sentenceCount) * 1000;
}

function computeSemicolonFrequency(text: string, sentenceCount: number): number {
  if (sentenceCount === 0) return 0;
  const count = (text.match(/;/g) || []).length;
  return (count / sentenceCount) * 1000;
}

function computeVocabularyCommonality(contentWords: string[]): number {
  if (contentWords.length === 0) return 0;
  // Sample up to 5000 content words for performance
  const sample = contentWords.slice(0, 5000);
  let totalRank = 0;
  for (const w of sample) {
    totalRank += WORD_FREQUENCIES[w] || DEFAULT_RANK;
  }
  return totalRank / sample.length;
  // Lower number = more common vocabulary, higher = more obscure
}

function computeLatinateRatio(contentWords: string[]): number {
  if (contentWords.length === 0) return 0;
  let count = 0;
  for (const w of contentWords) {
    if (w.length < 5) continue; // Too short to have a meaningful suffix
    for (const suffix of LATINATE_SUFFIXES) {
      if (w.endsWith(suffix)) {
        count++;
        break;
      }
    }
  }
  return count / contentWords.length;
}

function computeSaidBookismRatio(words: string[]): number {
  // Count "said" and bookism verbs
  let saidCount = 0;
  let bookismCount = 0;
  for (const w of words) {
    if (w === 'said') saidCount++;
    else if (BOOKISM_VERBS.has(w)) bookismCount++;
  }
  const total = saidCount + bookismCount;
  if (total === 0) return 5; // No dialogue tags found, neutral
  return saidCount / total; // 1.0 = all "said", 0.0 = all bookisms
}

function computeIntensifierDensity(words: string[]): number {
  if (words.length === 0) return 0;
  const count = words.filter(w => INTENSIFIERS.has(w)).length;
  return (count / words.length) * 1000;
}

function computeSimileDensity(text: string, sentenceCount: number): number {
  if (sentenceCount === 0) return 0;
  const patterns = [
    /\blike\s+(?:a|an|the)\b/gi,
    /\bas\s+(?:though|if)\b/gi,
    /\bas\s+\w+\s+as\b/gi,
  ];
  let count = 0;
  for (const pattern of patterns) {
    count += (text.match(pattern) || []).length;
  }
  return (count / sentenceCount) * 1000;
}

// --- Normalization ---

function normalize(value: number, min: number, max: number, invert = false): number {
  const clamped = Math.max(min, Math.min(max, value));
  let score = 1 + ((clamped - min) / (max - min)) * 9;
  if (invert) score = 11 - score;
  return Math.round(score * 10) / 10; // One decimal place
}

// --- Description generation ---

function describeLevel(score: number): string {
  if (score <= 3) return 'low';
  if (score <= 7) return 'moderate';
  return 'high';
}

function generateDescription(scores: StyleScores): string {
  const parts: string[] = [];

  const sl = describeLevel(scores.sentence_length_mean);
  const sv = describeLevel(scores.sentence_length_variance);
  parts.push(`${sl === 'low' ? 'Short' : sl === 'high' ? 'Long' : 'Medium-length'} sentences with ${sv} variation in length.`);

  const vr = describeLevel(scores.vocabulary_richness);
  const vc = describeLevel(scores.vocabulary_commonality);
  if (vr === 'high' || vc === 'low') {
    parts.push(`Rich, varied vocabulary${vc === 'low' ? ' that tends toward uncommon word choices' : ''}.`);
  } else if (vr === 'low') {
    parts.push('Limited, repetitive vocabulary.');
  }

  const dr = describeLevel(scores.dialogue_ratio);
  parts.push(`${dr === 'low' ? 'Narration-heavy' : dr === 'high' ? 'Dialogue-heavy' : 'Balanced dialogue and narration'}.`);

  const sb = describeLevel(scores.said_bookism_ratio);
  if (sb === 'low') {
    parts.push('Heavy use of elaborate dialogue tags ("murmured", "breathed", etc.) over plain "said".');
  }

  const ad = describeLevel(scores.adverb_density);
  const id = describeLevel(scores.intensifier_density);
  if (ad === 'high' || id === 'high') {
    const both = ad === 'high' && id === 'high';
    parts.push(`${both ? 'Heavy' : 'Notable'} use of ${ad === 'high' ? 'adverbs' : ''}${both ? ' and ' : ''}${id === 'high' ? 'intensifiers' : ''}.`);
  }

  const sd = describeLevel(scores.simile_density);
  if (sd === 'high') {
    parts.push('Frequent use of similes and comparisons.');
  }

  const lr = describeLevel(scores.latinate_ratio);
  if (lr === 'high') {
    parts.push('Leans toward formal, Latinate vocabulary.');
  }

  return parts.join(' ');
}

// --- Main export ---

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

export interface ComputedStyleProfile {
  scores: StyleScores;
  description: string;
}

export function computeStyleProfile(text: string): ComputedStyleProfile {
  const words = tokenize(text);
  const contentWords = getContentWords(words);
  const sentences = getSentences(text);
  const paragraphs = getParagraphs(text);
  const totalWords = words.length;
  const sentenceCount = sentences.length;

  const rawScores = {
    sentence_length_mean: computeSentenceLengthMean(sentences),
    sentence_length_variance: computeSentenceLengthVariance(sentences),
    paragraph_length: computeParagraphLength(paragraphs, sentences),
    vocabulary_richness: computeVocabularyRichness(words),
    hapax_ratio: computeHapaxRatio(words),
    function_word_density: computeFunctionWordDensity(words),
    dialogue_ratio: computeDialogueRatio(text, totalWords),
    adverb_density: computeAdverbDensity(words),
    em_dash_frequency: computeEmDashFrequency(text, totalWords),
    exclamation_frequency: computeExclamationFrequency(text, sentenceCount),
    semicolon_frequency: computeSemicolonFrequency(text, sentenceCount),
    vocabulary_commonality: computeVocabularyCommonality(contentWords),
    latinate_ratio: computeLatinateRatio(contentWords),
    said_bookism_ratio: computeSaidBookismRatio(words),
    intensifier_density: computeIntensifierDensity(words),
    simile_density: computeSimileDensity(text, sentenceCount),
  };

  // Normalize to 1-10 scale
  const scores: StyleScores = {
    sentence_length_mean: normalize(rawScores.sentence_length_mean, 8, 30),
    sentence_length_variance: normalize(rawScores.sentence_length_variance, 3, 18),
    paragraph_length: normalize(rawScores.paragraph_length, 1, 12),
    vocabulary_richness: normalize(rawScores.vocabulary_richness, 0.3, 0.7),
    hapax_ratio: normalize(rawScores.hapax_ratio, 0.3, 0.7),
    function_word_density: normalize(rawScores.function_word_density, 0.35, 0.55),
    dialogue_ratio: normalize(rawScores.dialogue_ratio, 0.0, 0.5),
    adverb_density: normalize(rawScores.adverb_density, 0.005, 0.035),
    em_dash_frequency: normalize(rawScores.em_dash_frequency, 0, 15),
    exclamation_frequency: normalize(rawScores.exclamation_frequency, 0, 150),
    semicolon_frequency: normalize(rawScores.semicolon_frequency, 0, 40),
    // Invert: lower avg rank = more common = higher score
    vocabulary_commonality: normalize(rawScores.vocabulary_commonality, 500, 3000, true),
    latinate_ratio: normalize(rawScores.latinate_ratio, 0.02, 0.12),
    // said_bookism_ratio: higher = more "said" usage (plainer style)
    said_bookism_ratio: normalize(rawScores.said_bookism_ratio, 0.2, 1.0),
    intensifier_density: normalize(rawScores.intensifier_density, 0, 12),
    simile_density: normalize(rawScores.simile_density, 0, 80),
  };

  const description = generateDescription(scores);

  return { scores, description };
}
