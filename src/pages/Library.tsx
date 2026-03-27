import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book } from '../types';

type SortKey = 'title' | 'author' | 'rating' | 'word_count' | 'tags';
type SortDir = 'asc' | 'desc';

function formatPageCount(wordCount: number): string {
  const pages = Math.round(wordCount / 250);
  return `~${pages} pages`;
}

export default function Library() {
  const [books, setBooks] = useState<Book[]>([]);
  const [bookTags, setBookTags] = useState<Record<number, { id: number; name: string }[]>>({});
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterTags, setFilterTags] = useState<Set<string>>(new Set());
  const [showDNF, setShowDNF] = useState<boolean | null>(null); // null = all, true = DNF only, false = exclude DNF
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadBooks();
  }, []);

  async function loadBooks() {
    const [result, allBookTags] = await Promise.all([
      window.api.getBooks(),
      window.api.getAllBookTags(),
    ]);
    setBooks(result);

    const tagMap: Record<number, { id: number; name: string }[]> = {};
    for (const bt of allBookTags) {
      if (!tagMap[bt.book_id]) tagMap[bt.book_id] = [];
      tagMap[bt.book_id].push({ id: bt.id, name: bt.name });
    }
    setBookTags(tagMap);
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

  // Collect all unique tags for the filter dropdown
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const tags of Object.values(bookTags)) {
      for (const tag of tags) tagSet.add(tag.name);
    }
    return Array.from(tagSet).sort();
  }, [bookTags]);

  const filteredAndSorted = useMemo(() => {
    let filtered = books;

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(b =>
        b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
      );
    }

    // Filter by DNF
    if (showDNF === true) {
      filtered = filtered.filter(b => b.rating === 0);
    } else if (showDNF === false) {
      filtered = filtered.filter(b => b.rating !== 0);
    }

    // Filter by tags (book must have at least one selected tag)
    if (filterTags.size > 0) {
      filtered = filtered.filter(b => bookTags[b.id]?.some(t => filterTags.has(t.name)));
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'author':
          cmp = a.author.localeCompare(b.author);
          break;
        case 'rating': {
          const ra = a.rating ?? -1;
          const rb = b.rating ?? -1;
          cmp = ra - rb;
          break;
        }
        case 'word_count':
          cmp = (a.word_count || 0) - (b.word_count || 0);
          break;
        case 'tags': {
          const ta = bookTags[a.id]?.map(t => t.name).join(', ') || '';
          const tb = bookTags[b.id]?.map(t => t.name).join(', ') || '';
          cmp = ta.localeCompare(tb);
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [books, bookTags, sortKey, sortDir, filterTags, showDNF, search]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
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
        <>
          <div className="library-filters">
            <input
              type="text"
              placeholder="Search by title or author..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ maxWidth: 250 }}
            />
            <select
              value={showDNF === null ? 'all' : showDNF ? 'dnf' : 'no-dnf'}
              onChange={e => {
                const v = e.target.value;
                setShowDNF(v === 'all' ? null : v === 'dnf');
              }}
            >
              <option value="all">All books</option>
              <option value="dnf">DNF only</option>
              <option value="no-dnf">Exclude DNF</option>
            </select>

            <div className="tag-filter">
              {allTags.map(tag => (
                <button
                  key={tag}
                  className={`tag-btn${filterTags.has(tag) ? ' tag-active' : ''}`}
                  onClick={() => {
                    const next = new Set(filterTags);
                    if (next.has(tag)) next.delete(tag);
                    else next.add(tag);
                    setFilterTags(next);
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <table className="library-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('title')}>Title{sortIndicator('title')}</th>
                <th onClick={() => handleSort('author')}>Author{sortIndicator('author')}</th>
                <th onClick={() => handleSort('rating')}>Rating{sortIndicator('rating')}</th>
                <th onClick={() => handleSort('word_count')}>Words{sortIndicator('word_count')}</th>
                <th onClick={() => handleSort('tags')}>Tags{sortIndicator('tags')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map(book => (
                <tr key={book.id} onClick={() => navigate(`/book/${book.id}`)}>
                  <td className="title-cell">{book.title}</td>
                  <td>{book.author}</td>
                  <td>
                    {book.rating !== null && book.rating !== undefined
                      ? book.rating === 0
                        ? <span className="dnf-badge">DNF</span>
                        : <span className="rating-value">{book.rating}/10</span>
                      : <span className="no-rating">—</span>
                    }
                  </td>
                  <td>
                    <span className="word-count">{(book.word_count || 0).toLocaleString()}</span>
                    <span className="page-count">{formatPageCount(book.word_count || 0)}</span>
                  </td>
                  <td>
                    {bookTags[book.id]?.map(tag => (
                      <span key={tag.id} className="tag-badge">{tag.name}</span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
