import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Book, AnalysisResult, StyleProfile, StyleMatch, ContentScore, UsageInfo, Tag, ContextGroup, FeatureEntry } from '../types';
import StyleBars from '../components/StyleBars';

function formatCost(cost: number): string {
  if (cost < 0.01) return `<$0.01`;
  return `$${cost.toFixed(2)}`;
}

function formatPageCount(wordCount: number): string {
  return `~${Math.round(wordCount / 250)} pages`;
}

export default function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bookId = Number(id);

  const [book, setBook] = useState<Book | null>(null);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [styleProfile, setStyleProfile] = useState<StyleProfile | null>(null);
  const [featureRegistry, setFeatureRegistry] = useState<FeatureEntry[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  const [error, setError] = useState('');
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const [lastAnalysisCost, setLastAnalysisCost] = useState<UsageInfo | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [bookTags, setBookTags] = useState<Tag[]>([]);
  const [styleMatches, setStyleMatches] = useState<StyleMatch[]>([]);
  const [contentScores, setContentScores] = useState<ContentScore[]>([]);
  const [allContextGroups, setAllContextGroups] = useState<ContextGroup[]>([]);
  const [bookContextGroups, setBookContextGroups] = useState<ContextGroup[]>([]);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');

  useEffect(() => {
    loadData();
  }, [bookId]);

  async function loadData() {
    const [bookData, analysisData, styleData, estimate, tags, bTags, registry, matches, scores, cGroups, bGroups] = await Promise.all([
      window.api.getBook(bookId),
      window.api.getAnalysisResults(bookId),
      window.api.getStyleProfile(bookId),
      window.api.estimateCost(bookId),
      window.api.getTags(),
      window.api.getBookTags(bookId),
      window.api.getFeatureRegistry(),
      window.api.getTopStyleMatches(bookId),
      window.api.getContentScores(bookId),
      window.api.getContextGroups(),
      window.api.getBookContextGroups(bookId),
    ]);
    setBook(bookData);
    setResults(analysisData);
    setStyleProfile(styleData);
    setEstimatedCost(estimate);
    setAllTags(tags);
    setBookTags(bTags);
    setFeatureRegistry(registry);
    setStyleMatches(matches);
    setContentScores(scores);
    setAllContextGroups(cGroups);
    setBookContextGroups(bGroups);
  }

  async function toggleTag(tagId: number) {
    const hasTag = bookTags.some((t) => t.id === tagId);
    if (hasTag) {
      await window.api.removeTagFromBook(bookId, tagId);
    } else {
      await window.api.addTagToBook(bookId, tagId);
    }
    const updated = await window.api.getBookTags(bookId);
    setBookTags(updated);
  }

  async function toggleContextGroup(groupId: number) {
    const hasGroup = bookContextGroups.some((g) => g.id === groupId);
    if (hasGroup) {
      await window.api.removeContextGroupFromBook(bookId, groupId);
    } else {
      await window.api.addContextGroupToBook(bookId, groupId);
    }
    const updated = await window.api.getBookContextGroups(bookId);
    setBookContextGroups(updated);
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setError('');
    try {
      const { results: newResults, usage } = await window.api.runAnalysis(bookId);
      setResults(newResults);
      setLastAnalysisCost(usage);
      const scores = await window.api.getContentScores(bookId);
      setContentScores(scores);
    } catch (e: any) {
      setError(e.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }


  async function handleRating(rating: number | null) {
    await window.api.setRating(bookId, rating);
    setBook((prev) => prev ? { ...prev, rating } : prev);
  }

  async function handleSaveMeta() {
    await window.api.updateBookMeta(bookId, editTitle.trim(), editAuthor.trim());
    setBook(prev => prev ? { ...prev, title: editTitle.trim(), author: editAuthor.trim() } : prev);
    setEditing(false);
  }

  async function handleDelete() {
    const confirmed = await window.api.showConfirm(`Delete "${book?.title}"? This cannot be undone.`);
    if (confirmed) {
      await window.api.deleteBook(bookId);
      navigate('/');
    }
  }

  if (!book) return <div className="loading">Loading...</div>;

  return (
    <div>
      <Link to="/" className="back-link">Back to Library</Link>

      {editing ? (
        <div style={{ marginBottom: 12 }}>
          <div className="form-row">
            <input
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              placeholder="Title"
            />
          </div>
          <div className="form-row">
            <input
              type="text"
              value={editAuthor}
              onChange={e => setEditAuthor(e.target.value)}
              placeholder="Author"
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSaveMeta} disabled={!editTitle.trim()}>Save</button>
            <button className="secondary" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <h2>{book.title}</h2>
            <button
              className="secondary"
              style={{ padding: '2px 8px', fontSize: 12 }}
              onClick={() => { setEditTitle(book.title); setEditAuthor(book.author); setEditing(true); }}
            >Edit</button>
          </div>
          <p style={{ color: '#888', marginBottom: 4 }}>{book.author}</p>
        </>
      )}
      <p style={{ color: '#666', marginBottom: 12, fontSize: 13 }}>
        {book.word_count?.toLocaleString()} words ({formatPageCount(book.word_count || 0)})
      </p>

      <div className="rating-row">
        <span className="rating-label">Rating:</span>
        {[0,1,2,3,4,5,6,7,8,9,10].map((val) => (
          <button
            key={val}
            className={`rating-btn ${book.rating === val ? 'rating-active' : ''}`}
            onClick={() => handleRating(book.rating === val ? null : val)}
            title={val === 0 ? 'Did not finish' : `${val}/10`}
          >
            {val === 0 ? 'DNF' : val}
          </button>
        ))}
      </div>

      <div className="tag-row">
        <span className="rating-label">Date read:</span>
        <input
          type="date"
          value={book.date_read || ''}
          onChange={async (e) => {
            const val = e.target.value || null;
            await window.api.setDateRead(bookId, val);
            setBook(prev => prev ? { ...prev, date_read: val } : prev);
          }}
          style={{
            background: '#16213e',
            border: '1px solid #0f3460',
            color: '#e0e0e0',
            padding: '4px 8px',
            borderRadius: 6,
            fontSize: 13,
            width: 'auto',
          }}
        />
        {book.date_read && (
          <button
            className="secondary"
            style={{ padding: '2px 8px', fontSize: 11 }}
            onClick={async () => {
              await window.api.setDateRead(bookId, null);
              setBook(prev => prev ? { ...prev, date_read: null } : prev);
            }}
          >
            Clear
          </button>
        )}
      </div>

      {allTags.length > 0 && (
        <div className="tag-row">
          <span className="rating-label">Tags:</span>
          {allTags.map((tag) => {
            const active = bookTags.some((t) => t.id === tag.id);
            return (
              <button
                key={tag.id}
                className={`tag-btn ${active ? 'tag-active' : ''}`}
                onClick={() => toggleTag(tag.id)}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      )}

      {allContextGroups.length > 0 && (
        <div className="tag-row">
          <span className="rating-label">Context:</span>
          {allContextGroups.map((group) => {
            const active = bookContextGroups.some((g) => g.id === group.id);
            return (
              <button
                key={group.id}
                className={`tag-btn ${active ? 'tag-active' : ''}`}
                onClick={() => toggleContextGroup(group.id)}
              >
                {group.name}
              </button>
            );
          })}
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {estimatedCost !== null && (
        <p style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>
          Estimated cost per analysis: {formatCost(estimatedCost)}
        </p>
      )}

      <div className="actions">
        <button onClick={handleAnalyze} disabled={analyzing}>
          {analyzing ? 'Analyzing...' : results.length > 0 ? 'Re-analyze' : 'Analyze Book'}
        </button>
<button onClick={handleDelete} className="danger">Delete</button>
      </div>

      {lastAnalysisCost && (
        <div className="cost-badge">
          Analysis cost: {formatCost(lastAnalysisCost.cost)} ({lastAnalysisCost.input_tokens.toLocaleString()} in / {lastAnalysisCost.output_tokens.toLocaleString()} out tokens)
        </div>
      )}

      {results.length > 0 && (
        <div className="section">
          <h3>Analysis Results</h3>
          <div className="card">
            {results.map((r) => (
              <div key={r.id} className="analysis-result">
                <div className="question">{r.question}</div>
                <div className="answer">{r.answer}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {contentScores.length > 0 && (
        <div className="section">
          <h3>Content Fingerprint</h3>
          <div className="card">
            {contentScores.map(cs => (
              <div key={cs.tag_id} className="analysis-result">
                <div className="question">
                  {cs.name}
                  <span style={{ color: '#e94560', fontWeight: 600, marginLeft: 8 }}>{cs.score}/10</span>
                </div>
                {cs.explanation && <div className="answer">{cs.explanation}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {styleMatches.length > 0 && (
        <div className="section">
          <h3>Most Similar in Library</h3>
          {styleMatches.map((m) => (
            <Link key={m.book_id} to={`/book/${m.book_id}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ color: '#e94560', fontWeight: 500 }}>{m.title}</span>
                  <span style={{ color: '#888', fontSize: 13, marginLeft: 8 }}>{m.author}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {m.rating !== null && (
                    <span style={{ color: '#888', fontSize: 13 }}>
                      {m.rating === 0 ? 'DNF' : `${m.rating}/10`}
                    </span>
                  )}
                  <span style={{ color: '#e94560', fontWeight: 600 }}>
                    {Math.round(m.similarity * 100)}%
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {styleProfile && featureRegistry.length > 0 && (
        <div className="section">
          <h3>Writing Style Fingerprint</h3>
          <div className="card">
            <StyleBars
              features={styleProfile.features}
              zScores={styleProfile.zScores}
              registry={featureRegistry}
            />
          </div>
        </div>
      )}
    </div>
  );
}
