import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Book, AnalysisResult, StyleProfile } from '../types';
import StyleBars from '../components/StyleBars';

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

  useEffect(() => {
    loadData();
  }, [bookId]);

  async function loadData() {
    const [bookData, analysisData, styleData] = await Promise.all([
      window.api.getBook(bookId),
      window.api.getAnalysisResults(bookId),
      window.api.getStyleProfile(bookId),
    ]);
    setBook(bookData);
    setResults(analysisData);
    setStyleProfile(styleData);
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setError('');
    try {
      const newResults = await window.api.runAnalysis(bookId);
      setResults(newResults);
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
      const profile = await window.api.generateStyleProfile(bookId);
      setStyleProfile(profile);
    } catch (e: any) {
      setError(e.message || 'Style analysis failed');
    } finally {
      setGeneratingStyle(false);
    }
  }

  async function handleDelete() {
    if (confirm(`Delete "${book?.title}"? This cannot be undone.`)) {
      await window.api.deleteBook(bookId);
      navigate('/');
    }
  }

  if (!book) return <div className="loading">Loading...</div>;

  return (
    <div>
      <Link to="/" className="back-link">Back to Library</Link>

      <h2>{book.title}</h2>
      <p style={{ color: '#888', marginBottom: 20 }}>{book.author}</p>

      {error && <div className="error">{error}</div>}

      <div className="actions">
        <button onClick={handleAnalyze} disabled={analyzing}>
          {analyzing ? 'Analyzing...' : results.length > 0 ? 'Re-analyze' : 'Analyze Book'}
        </button>
        <button onClick={handleStyleProfile} disabled={generatingStyle} className="secondary">
          {generatingStyle ? 'Generating...' : styleProfile ? 'Regenerate Style' : 'Generate Style Profile'}
        </button>
        <button onClick={handleDelete} className="danger">Delete</button>
      </div>

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
