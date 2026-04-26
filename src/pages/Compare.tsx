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
  const [selectedA, setSelectedA] = useState<number | null>(null);
  const [selectedB, setSelectedB] = useState<number | null>(null);
  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');
  const [focusA, setFocusA] = useState(false);
  const [focusB, setFocusB] = useState(false);
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
    if (selectedA !== null && selectedB !== null) {
      window.api.compareStyles(selectedA, selectedB)
        .then(setComparison)
        .catch(console.error);
    } else {
      setComparison(null);
    }
  }, [selectedA, selectedB]);

  const sorted = [...profiles].sort((a, b) => (a.title || '').localeCompare(b.title || ''));

  function filterProfiles(search: string) {
    if (!search) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(p => (p.title || '').toLowerCase().includes(q) || (p.author || '').toLowerCase().includes(q));
  }

  function selectA(p: StyleProfile) {
    setSelectedA(p.book_id);
    setSearchA(`${p.title} — ${p.author}`);
    setFocusA(false);
  }

  function selectB(p: StyleProfile) {
    setSelectedB(p.book_id);
    setSearchB(`${p.title} — ${p.author}`);
    setFocusB(false);
  }

  const profileA = profiles.find((p) => p.book_id === selectedA);
  const profileB = profiles.find((p) => p.book_id === selectedB);

  return (
    <div>
      <h2>Compare Writing Styles</h2>

      {profiles.length < 2 ? (
        <div className="empty-state">
          <p>Import at least 2 books to compare their writing styles.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <label style={{ color: '#888', fontSize: 13, marginBottom: 4, display: 'block' }}>Book A</label>
              <input
                type="text"
                placeholder="Search by title or author..."
                value={searchA}
                onChange={e => { setSearchA(e.target.value); setSelectedA(null); setFocusA(true); }}
                onFocus={() => setFocusA(true)}
                onBlur={() => setTimeout(() => setFocusA(false), 150)}
              />
              {focusA && (
                <div className="autocomplete-list">
                  {filterProfiles(searchA).map(p => (
                    <div key={p.book_id} className="autocomplete-item" onMouseDown={() => selectA(p)}>
                      <span>{p.title}</span>
                      <span style={{ color: '#888', fontSize: 12, marginLeft: 8 }}>{p.author}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <label style={{ color: '#888', fontSize: 13, marginBottom: 4, display: 'block' }}>Book B</label>
              <input
                type="text"
                placeholder="Search by title or author..."
                value={searchB}
                onChange={e => { setSearchB(e.target.value); setSelectedB(null); setFocusB(true); }}
                onFocus={() => setFocusB(true)}
                onBlur={() => setTimeout(() => setFocusB(false), 150)}
              />
              {focusB && (
                <div className="autocomplete-list">
                  {filterProfiles(searchB).map(p => (
                    <div key={p.book_id} className="autocomplete-item" onMouseDown={() => selectB(p)}>
                      <span>{p.title}</span>
                      <span style={{ color: '#888', fontSize: 12, marginLeft: 8 }}>{p.author}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
