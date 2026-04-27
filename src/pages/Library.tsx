import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book, Tag, ContextGroup } from '../types';

type SortKey = 'title' | 'author' | 'rating' | 'word_count' | 'tags' | 'context_groups' | 'created_at';
type SortDir = 'asc' | 'desc';

function formatPageCount(wordCount: number): string {
  const pages = Math.round(wordCount / 250);
  return `~${pages} pages`;
}

function loadFilter<T>(key: string, fallback: T): T {
  try {
    const v = sessionStorage.getItem(`library:${key}`);
    return v !== null ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

function saveFilter(key: string, value: any) {
  sessionStorage.setItem(`library:${key}`, JSON.stringify(value));
}

export default function Library() {
  const [books, setBooks] = useState<Book[]>([]);
  const [bookTags, setBookTags] = useState<Record<number, { id: number; name: string }[]>>({});
  const [allTagsList, setAllTagsList] = useState<Tag[]>([]);
  const [bookContextGroups, setBookContextGroups] = useState<Record<number, { id: number; name: string }[]>>({});
  const [allContextGroups, setAllContextGroups] = useState<ContextGroup[]>([]);
  const [filterContextGroups, setFilterContextGroups] = useState<Set<string>>(() => new Set(loadFilter<string[]>('filterContextGroups', [])));
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>(() => loadFilter('sortKey', 'created_at'));
  const [sortDir, setSortDir] = useState<SortDir>(() => loadFilter('sortDir', 'desc'));
  const [filterTags, setFilterTags] = useState<Set<string>>(() => new Set(loadFilter<string[]>('filterTags', [])));
  const [statusFilter, setStatusFilter] = useState<string>(() => loadFilter('statusFilter', 'all'));
  const [search, setSearch] = useState(() => loadFilter('search', ''));
  const navigate = useNavigate();

  useEffect(() => { saveFilter('sortKey', sortKey); }, [sortKey]);
  useEffect(() => { saveFilter('sortDir', sortDir); }, [sortDir]);
  useEffect(() => { saveFilter('filterTags', Array.from(filterTags)); }, [filterTags]);
  useEffect(() => { saveFilter('statusFilter', statusFilter); }, [statusFilter]);
  useEffect(() => { saveFilter('search', search); }, [search]);
  useEffect(() => { saveFilter('filterContextGroups', Array.from(filterContextGroups)); }, [filterContextGroups]);

  useEffect(() => {
    loadBooks();
  }, []);

  async function loadBooks() {
    const [result, allBookTags, tags, allBookCGs, cGroups] = await Promise.all([
      window.api.getBooks(),
      window.api.getAllBookTags(),
      window.api.getTags(),
      window.api.getAllBookContextGroups(),
      window.api.getContextGroups(),
    ]);
    setBooks(result);
    setAllTagsList(tags);
    setAllContextGroups(cGroups);

    const tagMap: Record<number, { id: number; name: string }[]> = {};
    for (const bt of allBookTags) {
      if (!tagMap[bt.book_id]) tagMap[bt.book_id] = [];
      tagMap[bt.book_id].push({ id: bt.id, name: bt.name });
    }
    setBookTags(tagMap);

    const cgMap: Record<number, { id: number; name: string }[]> = {};
    for (const bcg of allBookCGs) {
      if (!cgMap[bcg.book_id]) cgMap[bcg.book_id] = [];
      cgMap[bcg.book_id].push({ id: bcg.id, name: bcg.name });
    }
    setBookContextGroups(cgMap);
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

  async function toggleBookTag(bookId: number, tagId: number) {
    const hasTag = bookTags[bookId]?.some(t => t.id === tagId);
    if (hasTag) {
      await window.api.removeTagFromBook(bookId, tagId);
    } else {
      await window.api.addTagToBook(bookId, tagId);
    }
    const updated = await window.api.getBookTags(bookId);
    setBookTags(prev => ({ ...prev, [bookId]: updated }));
  }

  async function toggleBookContextGroup(bookId: number, groupId: number) {
    const hasGroup = bookContextGroups[bookId]?.some(g => g.id === groupId);
    if (hasGroup) {
      await window.api.removeContextGroupFromBook(bookId, groupId);
    } else {
      await window.api.addContextGroupToBook(bookId, groupId);
    }
    const updated = await window.api.getBookContextGroups(bookId);
    setBookContextGroups(prev => ({ ...prev, [bookId]: updated }));
  }

  const stats = useMemo(() => {
    const total = books.length;
    const dnf = books.filter(b => b.rating === 0).length;
    const rated = books.filter(b => b.rating !== null && b.rating > 0).length;
    const unrated = total - dnf - rated;
    return { total, dnf, rated, unrated };
  }, [books]);

  // Collect all unique tags for the filter dropdown
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const tags of Object.values(bookTags)) {
      for (const tag of tags) tagSet.add(tag.name);
    }
    return Array.from(tagSet).sort();
  }, [bookTags]);

  const allContextGroupNames = useMemo(() => {
    const nameSet = new Set<string>();
    for (const groups of Object.values(bookContextGroups)) {
      for (const g of groups) nameSet.add(g.name);
    }
    return Array.from(nameSet).sort();
  }, [bookContextGroups]);

  const filteredAndSorted = useMemo(() => {
    let filtered = books;

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(b =>
        b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
      );
    }

    // Filter by status
    if (statusFilter === 'dnf') {
      filtered = filtered.filter(b => b.rating === 0);
    } else if (statusFilter === 'no-dnf') {
      filtered = filtered.filter(b => b.rating !== 0);
    } else if (statusFilter === 'unread') {
      filtered = filtered.filter(b => b.rating === null || b.rating === undefined);
    } else if (statusFilter === 'read') {
      filtered = filtered.filter(b => b.rating !== null && b.rating !== undefined && b.rating > 0);
    }

    // Filter by tags (book must have at least one selected tag)
    if (filterTags.size > 0) {
      filtered = filtered.filter(b => bookTags[b.id]?.some(t => filterTags.has(t.name)));
    }

    // Filter by context groups
    if (filterContextGroups.size > 0) {
      filtered = filtered.filter(b => bookContextGroups[b.id]?.some(g => filterContextGroups.has(g.name)));
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
        case 'context_groups': {
          const ga = bookContextGroups[a.id]?.map(g => g.name).join(', ') || '';
          const gb = bookContextGroups[b.id]?.map(g => g.name).join(', ') || '';
          cmp = ga.localeCompare(gb);
          break;
        }
        case 'created_at':
          cmp = (a.created_at || '').localeCompare(b.created_at || '');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [books, bookTags, bookContextGroups, sortKey, sortDir, filterTags, filterContextGroups, statusFilter, search]);

  const hasActiveFilters = search !== '' || statusFilter !== 'all' || filterTags.size > 0 || filterContextGroups.size > 0 || sortKey !== 'created_at' || sortDir !== 'desc';

  function resetFilters() {
    setSearch('');
    setStatusFilter('all');
    setFilterTags(new Set());
    setFilterContextGroups(new Set());
    setSortKey('created_at');
    setSortDir('desc');
  }

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

      {books.length > 0 && (
        <p style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>
          {stats.total} books — {stats.rated} read, {stats.unrated} unread, {stats.dnf} DNF
        </p>
      )}

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
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All books</option>
              <option value="read">Read</option>
              <option value="unread">Unread</option>
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

            {allContextGroupNames.length > 0 && (
              <div className="tag-filter">
                {allContextGroupNames.map(name => (
                  <button
                    key={name}
                    className={`tag-btn${filterContextGroups.has(name) ? ' tag-active' : ''}`}
                    onClick={() => {
                      const next = new Set(filterContextGroups);
                      if (next.has(name)) next.delete(name);
                      else next.add(name);
                      setFilterContextGroups(next);
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}

            {hasActiveFilters && (
              <button className="secondary" style={{ padding: '4px 12px', fontSize: 12 }} onClick={resetFilters}>
                Clear filters
              </button>
            )}
          </div>

          <table className="library-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('title')}>Title{sortIndicator('title')}</th>
                <th onClick={() => handleSort('author')}>Author{sortIndicator('author')}</th>
                <th onClick={() => handleSort('rating')}>Rating{sortIndicator('rating')}</th>
                <th onClick={() => handleSort('word_count')}>Words{sortIndicator('word_count')}</th>
                <th onClick={() => handleSort('tags')}>Tags{sortIndicator('tags')}</th>
                <th onClick={() => handleSort('context_groups')}>Context{sortIndicator('context_groups')}</th>
                <th onClick={() => handleSort('created_at')}>Added{sortIndicator('created_at')}</th>
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
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {allTagsList.map(tag => {
                        const active = bookTags[book.id]?.some(t => t.id === tag.id);
                        return (
                          <button
                            key={tag.id}
                            className={`tag-btn${active ? ' tag-active' : ''}`}
                            style={{ padding: '1px 8px', fontSize: 11 }}
                            onClick={() => toggleBookTag(book.id, tag.id)}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {allContextGroups.map(group => {
                        const active = bookContextGroups[book.id]?.some(g => g.id === group.id);
                        return (
                          <button
                            key={group.id}
                            className={`tag-btn${active ? ' tag-active' : ''}`}
                            style={{ padding: '1px 8px', fontSize: 11 }}
                            onClick={() => toggleBookContextGroup(book.id, group.id)}
                          >
                            {group.name}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td style={{ color: '#888', fontSize: 13 }}>
                    {book.created_at ? new Date(book.created_at).toLocaleDateString() : '—'}
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
