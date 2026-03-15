import Database from 'better-sqlite3';

export function recomputeFeatureStatistics(db: Database.Database): void {
  const rows = db.prepare('SELECT feature_name, feature_value FROM book_features').all() as {
    feature_name: string;
    feature_value: number;
  }[];

  // Group values by feature
  const groups: Record<string, number[]> = {};
  for (const row of rows) {
    if (!groups[row.feature_name]) groups[row.feature_name] = [];
    groups[row.feature_name].push(row.feature_value);
  }

  const bookCount = (db.prepare('SELECT COUNT(*) as count FROM books').get() as { count: number }).count;

  const upsert = db.prepare(
    'INSERT OR REPLACE INTO feature_statistics (feature_name, mean_value, std_dev, book_count) VALUES (?, ?, ?, ?)'
  );

  const transaction = db.transaction(() => {
    for (const [name, values] of Object.entries(groups)) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
      const stdDev = Math.sqrt(variance);
      upsert.run(name, mean, stdDev, bookCount);
    }
  });

  transaction();

  // Also compute n-gram statistics
  const ngramRows = db.prepare('SELECT ngram, frequency FROM book_char_ngrams').all() as {
    ngram: string;
    frequency: number;
  }[];

  const ngramGroups: Record<string, number[]> = {};
  for (const row of ngramRows) {
    if (!ngramGroups[row.ngram]) ngramGroups[row.ngram] = [];
    ngramGroups[row.ngram].push(row.frequency);
  }

  const ngramTransaction = db.transaction(() => {
    for (const [ngram, values] of Object.entries(ngramGroups)) {
      const featureName = `ngram_${ngram}`;
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
      const stdDev = Math.sqrt(variance);
      upsert.run(featureName, mean, stdDev, bookCount);
    }
  });

  ngramTransaction();
}

export function getBookZScores(db: Database.Database, bookId: number): Record<string, number> {
  const features = db.prepare('SELECT feature_name, feature_value FROM book_features WHERE book_id = ?').all(bookId) as {
    feature_name: string;
    feature_value: number;
  }[];

  const ngrams = db.prepare('SELECT ngram, frequency FROM book_char_ngrams WHERE book_id = ?').all(bookId) as {
    ngram: string;
    frequency: number;
  }[];

  const stats = db.prepare('SELECT feature_name, mean_value, std_dev FROM feature_statistics').all() as {
    feature_name: string;
    mean_value: number;
    std_dev: number;
  }[];

  const statsMap: Record<string, { mean: number; stdDev: number }> = {};
  for (const s of stats) {
    statsMap[s.feature_name] = { mean: s.mean_value, stdDev: s.std_dev };
  }

  const zScores: Record<string, number> = {};

  for (const f of features) {
    const s = statsMap[f.feature_name];
    if (s && s.stdDev > 0.0001) {
      zScores[f.feature_name] = (f.feature_value - s.mean) / s.stdDev;
    } else {
      zScores[f.feature_name] = 0;
    }
  }

  for (const ng of ngrams) {
    const key = `ngram_${ng.ngram}`;
    const s = statsMap[key];
    if (s && s.stdDev > 0.0001) {
      zScores[key] = (ng.frequency - s.mean) / s.stdDev;
    } else {
      zScores[key] = 0;
    }
  }

  return zScores;
}

function cosineSimOnVectors(a: Record<string, number>, b: Record<string, number>, keys: string[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (const key of keys) {
    const va = a[key] || 0;
    const vb = b[key] || 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function computeSimilarity(
  db: Database.Database,
  bookIdA: number,
  bookIdB: number
): { overall: number; byCategory: Record<string, number> } {
  const zA = getBookZScores(db, bookIdA);
  const zA_entries = db.prepare('SELECT feature_name, feature_value FROM book_features WHERE book_id = ?').all(bookIdA) as { feature_name: string; feature_value: number }[];
  const zB = getBookZScores(db, bookIdB);

  // Get feature registry for category grouping
  const registry = db.prepare('SELECT feature_name, category FROM feature_registry').all() as {
    feature_name: string;
    category: string;
  }[];

  const categoryFeatures: Record<string, string[]> = {};
  for (const r of registry) {
    if (!categoryFeatures[r.category]) categoryFeatures[r.category] = [];
    categoryFeatures[r.category].push(r.feature_name);
  }

  // Per-category similarity using z-scores
  const byCategory: Record<string, number> = {};
  const allScalarKeys: string[] = [];

  for (const [category, features] of Object.entries(categoryFeatures)) {
    byCategory[category] = cosineSimOnVectors(zA, zB, features);
    allScalarKeys.push(...features);
  }

  // N-gram keys (union of both books)
  const ngramKeys = new Set<string>();
  for (const key of Object.keys(zA)) {
    if (key.startsWith('ngram_')) ngramKeys.add(key);
  }
  for (const key of Object.keys(zB)) {
    if (key.startsWith('ngram_')) ngramKeys.add(key);
  }

  const scalarSim = cosineSimOnVectors(zA, zB, allScalarKeys);
  const ngramSim = ngramKeys.size > 0 ? cosineSimOnVectors(zA, zB, Array.from(ngramKeys)) : 0;

  // Weighted overall: 70% scalar features, 30% character n-grams
  const overall = 0.7 * scalarSim + 0.3 * ngramSim;

  return { overall, byCategory };
}
