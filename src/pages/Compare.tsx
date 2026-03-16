import { useState, useEffect, useCallback } from 'react';
import { StyleProfile, StyleComparison, FeatureEntry } from '../types';
import StyleBars from '../components/StyleBars';

const CATEGORY_LABELS: Record<string, string> = {
  sentence_structure: 'Sentence Structure',
  punctuation: 'Punctuation',
  dialogue: 'Dialogue',
  vocabulary: 'Vocabulary',
  pos_distribution: 'Parts of Speech',
};

export default function Compare() {
  const [profiles, setProfiles] = useState<StyleProfile[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [comparison, setComparison] = useState<StyleComparison | null>(null);
  const [registry, setRegistry] = useState<FeatureEntry[]>([]);
  const [showExplainer, setShowExplainer] = useState(false);

  useEffect(() => {
    Promise.all([
      window.api?.getAllStyleProfiles(),
      window.api?.getFeatureRegistry(),
    ]).then(([p, r]) => {
      setProfiles(p || []);
      setRegistry(r || []);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (selected.length === 2) {
      window.api.compareStyles(selected[0], selected[1])
        .then(setComparison)
        .catch(console.error);
    } else {
      setComparison(null);
    }
  }, [selected]);

  function toggleSelect(bookId: number) {
    setSelected((prev) =>
      prev.includes(bookId) ? prev.filter((id) => id !== bookId) : prev.length < 2 ? [...prev, bookId] : [prev[1], bookId]
    );
  }

  const profileA = profiles.find((p) => p.book_id === selected[0]);
  const profileB = profiles.find((p) => p.book_id === selected[1]);

  return (
    <div>
      <h2>Compare Writing Styles</h2>

      {profiles.length < 2 ? (
        <div className="empty-state">
          <p>Import at least 2 books to compare their writing styles.</p>
        </div>
      ) : (
        <>
          <p style={{ color: '#888', marginBottom: 16 }}>Select two books to compare:</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
            {[...profiles].sort((a, b) => (a.title || '').localeCompare(b.title || '')).map((p) => (
              <button
                key={p.book_id}
                onClick={() => toggleSelect(p.book_id)}
                className={selected.includes(p.book_id) ? '' : 'secondary'}
              >
                {p.title}
              </button>
            ))}
          </div>

          {comparison && (
            <>
              <div className="card" style={{ textAlign: 'center', marginBottom: 24 }}>
                <div className="similarity-score">{Math.round(comparison.overall * 100)}%</div>
                <div className="similarity-label">
                  Overall Style Similarity
                  <button
                    className="explainer-toggle"
                    onClick={() => setShowExplainer(prev => !prev)}
                    title="What does this mean?"
                  >
                    ?
                  </button>
                </div>
                {showExplainer && (
                  <p className="similarity-explainer">
                    80%+ very similar style. 50–80% some shared habits. Below 50% distinctly different.
                    Negative means opposite tendencies. Scores improve with more books in your library.
                  </p>
                )}
              </div>

              <div className="category-similarity">
                {Object.entries(comparison.byCategory).map(([category, score]) => (
                  <div key={category} className="category-sim-row">
                    <span className="category-sim-label">{CATEGORY_LABELS[category] || category}</span>
                    <div className="bar">
                      <div className="bar-fill" style={{ width: `${Math.max(0, score * 100)}%` }} />
                    </div>
                    <span className="category-sim-value">{Math.round(score * 100)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="compare-grid">
            {profileA && registry.length > 0 && (
              <div className="card">
                <h3>{profileA.title}</h3>
                <StyleBars features={profileA.features} zScores={profileA.zScores} registry={registry} />
              </div>
            )}
            {profileB && registry.length > 0 && (
              <div className="card">
                <h3>{profileB.title}</h3>
                <StyleBars features={profileB.features} zScores={profileB.zScores} registry={registry} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
