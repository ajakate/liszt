import { useState } from 'react';
import { FeatureEntry } from '../types';

const CATEGORY_LABELS: Record<string, string> = {
  sentence_structure: 'Sentence Structure',
  punctuation: 'Punctuation',
  dialogue: 'Dialogue',
  vocabulary: 'Vocabulary',
  pos_distribution: 'Parts of Speech',
};

function zScoreToPercent(z: number): number {
  // Map z-score to 0-100% bar width. z of -3 = 0%, z of +3 = 100%
  return Math.max(0, Math.min(100, ((z + 3) / 6) * 100));
}

function formatValue(value: number): string {
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 1) return value.toFixed(2);
  return value.toFixed(4);
}

interface Props {
  features: Record<string, number>;
  zScores: Record<string, number>;
  registry: FeatureEntry[];
}

export default function StyleBars({ features, zScores, registry }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Group registry by category
  const categories: Record<string, FeatureEntry[]> = {};
  for (const entry of registry) {
    if (!categories[entry.category]) categories[entry.category] = [];
    categories[entry.category].push(entry);
  }

  function toggleCategory(cat: string) {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  }

  return (
    <div>
      {Object.entries(categories).map(([category, entries]) => (
        <div key={category} className="feature-category">
          <div className="category-header" onClick={() => toggleCategory(category)}>
            <span className="category-toggle">{collapsed[category] ? '▶' : '▼'}</span>
            <span className="category-title">{CATEGORY_LABELS[category] || category}</span>
          </div>
          {!collapsed[category] && (
            <div className="category-features">
              {entries.map(entry => {
                const z = zScores[entry.feature_name] || 0;
                const raw = features[entry.feature_name];
                return (
                  <div key={entry.feature_name} className="style-bar" title={entry.description}>
                    <span className="label">{entry.description}</span>
                    <div className="bar">
                      <div className="bar-fill" style={{ width: `${zScoreToPercent(z)}%` }} />
                    </div>
                    <span className="value" title={`z: ${z.toFixed(2)}`}>
                      {raw !== undefined ? formatValue(raw) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
