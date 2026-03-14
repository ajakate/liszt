import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book } from '../types';

function formatPageCount(wordCount: number): string {
  const pages = Math.round(wordCount / 250);
  return `~${pages} pages`;
}

export default function Library() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadBooks();
  }, []);

  async function loadBooks() {
    const result = await window.api.getBooks();
    setBooks(result);
  }

  async function handleImport() {
    setLoading(true);
    try {
      const imported = await window.api.importBook();
      if (imported.length > 0) {
        await loadBooks();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="actions">
        <h2>Library</h2>
        <button onClick={handleImport} disabled={loading} style={{ marginLeft: 'auto' }}>
          {loading ? 'Importing...' : 'Import Book'}
        </button>
      </div>

      {books.length === 0 ? (
        <div className="empty-state">
          <p>No books yet. Import an EPUB to get started.</p>
        </div>
      ) : (
        <div className="book-grid">
          {books.map((book) => (
            <div key={book.id} className="card book-card" onClick={() => navigate(`/book/${book.id}`)}>
              <h3>{book.title}</h3>
              <div className="author">{book.author}</div>
              <div style={{ color: '#888', fontSize: 12, marginBottom: 6 }}>
                {book.word_count?.toLocaleString()} words ({formatPageCount(book.word_count || 0)})
              </div>
              <div className="preview">{book.text_preview?.substring(0, 150)}...</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
