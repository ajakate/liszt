import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Book, AnalysisResult, StyleProfile, UsageInfo } from '../types';
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
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingStyle, setGeneratingStyle] = useState(false);
  const [error, setError] = useState('');
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const [lastAnalysisCost, setLastAnalysisCost] = useState<UsageInfo | null>(null);
  const [lastStyleCost, setLastStyleCost] = useState<UsageInfo | null>(null);

  useEffect(() => {
    loadData();
  }, [bookId]);

  async function loadData() {
    const [bookData, analysisData, styleData, estimate] = await Promise.all([
      window.api.getBook(bookId),
      window.api.getAnalysisResults(bookId),
      window.api.getStyleProfile(bookId),
      window.api.estimateCost(bookId),
    ]);
    setBook(bookData);
    setResults(analysisData);
    setStyleProfile(styleData);
    setEstimatedCost(estimate);
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setError('');
    try {
      const { results: newResults, usage } = await window.api.runAnalysis(bookId);
      setResults(newResults);
      setLastAnalysisCost(usage);
    } catch (e: any) {
      setError(e.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleStyleProfile() {
    setGeneratingStyle(true);
    setError('');
    try {
      const result = await window.api.generateStyleProfile(bookId);
      setStyleProfile(result);
      setLastStyleCost(result.usage);
    } catch (e: any) {
      setError(e.message || 'Style analysis failed');
    } finally {
      setGeneratingStyle(false);
    }
  }

  async function handleRating(rating: number | null) {
    await window.api.setRating(bookId, rating);
    setBook((prev) => prev ? { ...prev, rating } : prev);
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

      <h2>{book.title}</h2>
      <p style={{ color: '#888', marginBottom: 4 }}>{book.author}</p>
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
        <button onClick={handleStyleProfile} disabled={generatingStyle} className="secondary">
          {generatingStyle ? 'Generating...' : styleProfile ? 'Regenerate Style' : 'Generate Style Profile'}
        </button>
        <button onClick={handleDelete} className="danger">Delete</button>
      </div>

      {lastAnalysisCost && (
        <div className="cost-badge">
          Analysis cost: {formatCost(lastAnalysisCost.cost)} ({lastAnalysisCost.input_tokens.toLocaleString()} in / {lastAnalysisCost.output_tokens.toLocaleString()} out tokens)
        </div>
      )}

      {lastStyleCost && (
        <div className="cost-badge">
          Style profile cost: {formatCost(lastStyleCost.cost)} ({lastStyleCost.input_tokens.toLocaleString()} in / {lastStyleCost.output_tokens.toLocaleString()} out tokens)
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

      {styleProfile && (
        <div className="section">
          <h3>Writing Style Profile</h3>
          <div className="card">
            <p style={{ marginBottom: 16, lineHeight: 1.6 }}>{styleProfile.description}</p>
            <StyleBars scores={styleProfile.scores} />
          </div>
        </div>
      )}
    </div>
  );
}
