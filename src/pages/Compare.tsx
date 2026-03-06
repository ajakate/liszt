import { useState, useEffect } from 'react';
import { StyleProfile, StyleScores } from '../types';
import StyleBars from '../components/StyleBars';

function cosineSimilarity(a: StyleScores, b: StyleScores): number {
  const keys = Object.keys(a) as (keyof StyleScores)[];
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (const key of keys) {
    const va = a[key] || 0;
    const vb = b[key] || 0;
    dotProduct += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export default function Compare() {
  const [profiles, setProfiles] = useState<StyleProfile[]>([]);
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    window.api?.getAllStyleProfiles().then(setProfiles).catch(console.error);
  }, []);

  function toggleSelect(bookId: number) {
    setSelected((prev) =>
      prev.includes(bookId) ? prev.filter((id) => id !== bookId) : prev.length < 2 ? [...prev, bookId] : [prev[1], bookId]
    );
  }

  const profileA = profiles.find((p) => p.book_id === selected[0]);
  const profileB = profiles.find((p) => p.book_id === selected[1]);
  const similarity = profileA && profileB ? cosineSimilarity(profileA.scores, profileB.scores) : null;

  return (
    <div>
      <h2>Compare Writing Styles</h2>

      {profiles.length < 2 ? (
        <div className="empty-state">
          <p>Generate style profiles for at least 2 books to compare them.</p>
        </div>
      ) : (
        <>
          <p style={{ color: '#888', marginBottom: 16 }}>Select two books to compare:</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
            {profiles.map((p) => (
              <button
                key={p.book_id}
                onClick={() => toggleSelect(p.book_id)}
                className={selected.includes(p.book_id) ? '' : 'secondary'}
              >
                {p.title}
              </button>
            ))}
          </div>

          {similarity !== null && (
            <div className="card" style={{ textAlign: 'center', marginBottom: 24 }}>
              <div className="similarity-score">{Math.round(similarity * 100)}%</div>
              <div className="similarity-label">Style Similarity</div>
            </div>
          )}

          <div className="compare-grid">
            {profileA && (
              <div className="card">
                <h3>{profileA.title}</h3>
                <p style={{ color: '#888', marginBottom: 12, fontSize: 13 }}>{profileA.description}</p>
                <StyleBars scores={profileA.scores} />
              </div>
            )}
            {profileB && (
              <div className="card">
                <h3>{profileB.title}</h3>
                <p style={{ color: '#888', marginBottom: 12, fontSize: 13 }}>{profileB.description}</p>
                <StyleBars scores={profileB.scores} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
