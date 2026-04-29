import { useState, useEffect, useMemo } from 'react';
import { Book, ContextGroup } from '../types';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';

const COLORS = [
  '#e94560', '#0f3460', '#4ecdc4', '#f7b731', '#a55eea',
  '#26de81', '#fc5c65', '#45aaf2', '#fd9644', '#778ca3',
  '#2bcbba', '#eb3b5a', '#8854d0', '#20bf6b', '#fa8231',
];

function pagify(wordCount: number): number {
  return Math.round(wordCount / 250);
}

function lengthBucket(pages: number): string {
  if (pages <= 150) return 'Short (<=150p)';
  if (pages <= 300) return 'Medium (151-300p)';
  return 'Long (>300p)';
}

function toTimestamp(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getTime();
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

export default function Metrics() {
  const [books, setBooks] = useState<Book[]>([]);
  const [bookContextGroups, setBookContextGroups] = useState<Record<number, { id: number; name: string }[]>>({});
  const [bookTags, setBookTags] = useState<Record<number, { id: number; name: string }[]>>({});
  const [contextGroups, setContextGroups] = useState<ContextGroup[]>([]);

  useEffect(() => {
    Promise.all([
      window.api.getBooks(),
      window.api.getAllBookContextGroups(),
      window.api.getAllBookTags(),
      window.api.getContextGroups(),
    ]).then(([b, bcg, bt, cg]) => {
      setBooks(b);
      setContextGroups(cg);

      const cgMap: Record<number, { id: number; name: string }[]> = {};
      for (const r of bcg) {
        if (!cgMap[r.book_id]) cgMap[r.book_id] = [];
        cgMap[r.book_id].push({ id: r.id, name: r.name });
      }
      setBookContextGroups(cgMap);

      const tagMap: Record<number, { id: number; name: string }[]> = {};
      for (const r of bt) {
        if (!tagMap[r.book_id]) tagMap[r.book_id] = [];
        tagMap[r.book_id].push({ id: r.id, name: r.name });
      }
      setBookTags(tagMap);
    });
  }, []);

  const readBooks = useMemo(() =>
    books.filter(b => b.date_read && b.rating !== null && b.rating > 0)
      .sort((a, b) => a.date_read!.localeCompare(b.date_read!)),
    [books]
  );

  // --- Pie: Context Groups ---
  const genreData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const book of books) {
      const groups = bookContextGroups[book.id];
      if (groups && groups.length > 0) {
        for (const g of groups) {
          counts[g.name] = (counts[g.name] || 0) + 1;
        }
      } else {
        counts['Unassigned'] = (counts['Unassigned'] || 0) + 1;
      }
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [books, bookContextGroups]);

  // --- Pie: Book Lengths ---
  const lengthData = useMemo(() => {
    const counts: Record<string, number> = { 'Short (<=150p)': 0, 'Medium (151-300p)': 0, 'Long (>300p)': 0 };
    for (const book of books) {
      const bucket = lengthBucket(pagify(book.word_count || 0));
      counts[bucket]++;
    }
    return Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [books]);

  // --- Reading Pace Timeline ---
  const paceData = useMemo(() =>
    readBooks.map(b => ({
      timestamp: toTimestamp(b.date_read!),
      pages: pagify(b.word_count || 0),
      rating: b.rating!,
      title: b.title,
    })),
    [readBooks]
  );

  // --- Cumulative Pages ---
  const cumulativeData = useMemo(() => {
    let total = 0;
    return readBooks.map(b => {
      total += pagify(b.word_count || 0);
      return { timestamp: toTimestamp(b.date_read!), pages: total, title: b.title };
    });
  }, [readBooks]);

  // --- Ratings Over Time ---
  const ratingsData = useMemo(() =>
    readBooks.map(b => ({
      timestamp: toTimestamp(b.date_read!),
      rating: b.rating!,
      title: b.title,
    })),
    [readBooks]
  );

  // --- Avg Rating by Context Group ---
  const avgRatingByGroup = useMemo(() => {
    const sums: Record<string, { total: number; count: number }> = {};
    for (const book of books) {
      if (book.rating === null || book.rating === undefined || book.rating === 0) continue;
      const groups = bookContextGroups[book.id];
      if (groups && groups.length > 0) {
        for (const g of groups) {
          if (!sums[g.name]) sums[g.name] = { total: 0, count: 0 };
          sums[g.name].total += book.rating;
          sums[g.name].count++;
        }
      }
    }
    return Object.entries(sums)
      .map(([name, { total, count }]) => ({ name, avg: Math.round((total / count) * 10) / 10, count }))
      .sort((a, b) => b.avg - a.avg);
  }, [books, bookContextGroups]);

  // --- Heatmap: Tags vs Avg Rating ---
  const tagRatingData = useMemo(() => {
    const sums: Record<string, { total: number; count: number }> = {};
    for (const book of books) {
      if (book.rating === null || book.rating === undefined || book.rating === 0) continue;
      const tags = bookTags[book.id];
      if (tags) {
        for (const t of tags) {
          if (!sums[t.name]) sums[t.name] = { total: 0, count: 0 };
          sums[t.name].total += book.rating;
          sums[t.name].count++;
        }
      }
    }
    return Object.entries(sums)
      .map(([name, { total, count }]) => ({ name, avg: Math.round((total / count) * 10) / 10, count }))
      .sort((a, b) => b.avg - a.avg);
  }, [books, bookTags]);

  // --- Summary Stats ---
  const summary = useMemo(() => {
    const rated = books.filter(b => b.rating !== null && b.rating !== undefined && b.rating > 0);
    const totalPages = books.reduce((s, b) => s + pagify(b.word_count || 0), 0);
    const avgRating = rated.length > 0 ? rated.reduce((s, b) => s + b.rating!, 0) / rated.length : 0;
    const avgPages = rated.length > 0 ? rated.reduce((s, b) => s + pagify(b.word_count || 0), 0) / rated.length : 0;
    return {
      totalBooks: books.length,
      totalPages,
      booksRead: rated.length,
      avgRating: Math.round(avgRating * 10) / 10,
      avgPages: Math.round(avgPages),
    };
  }, [books]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 6, padding: '8px 12px', fontSize: 13 }}>
        {d.title && <div style={{ color: '#e94560', fontWeight: 500 }}>{d.title}</div>}
        {d.timestamp && <div style={{ color: '#888' }}>{formatTimestamp(d.timestamp)}</div>}
        {d.pages !== undefined && <div style={{ color: '#e0e0e0' }}>{d.pages} pages</div>}
        {d.rating !== undefined && <div style={{ color: '#e0e0e0' }}>Rating: {d.rating}/10</div>}
      </div>
    );
  };

  if (books.length === 0) {
    return (
      <div>
        <h2>Metrics</h2>
        <div className="empty-state"><p>Import some books to see reading metrics.</p></div>
      </div>
    );
  }

  return (
    <div>
      <h2>Metrics</h2>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Books', value: summary.totalBooks },
          { label: 'Read', value: summary.booksRead },
          { label: 'Total Pages', value: summary.totalPages.toLocaleString() },
          { label: 'Avg Rating', value: `${summary.avgRating}/10` },
          { label: 'Avg Length', value: `${summary.avgPages}p` },
        ].map(s => (
          <div key={s.label} className="card" style={{ flex: '1 1 140px', textAlign: 'center', minWidth: 120 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#e94560' }}>{s.value}</div>
            <div style={{ color: '#888', fontSize: 12 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16, marginBottom: 24 }}>
        {genreData.length > 0 && (
          <div className="card">
            <h3>Books by Context Group</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={genreData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }: any) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`} labelLine={false}>
                  {genreData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {lengthData.length > 0 && (
          <div className="card">
            <h3>Book Lengths</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={lengthData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }: any) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`} labelLine={false}>
                  {lengthData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {paceData.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Reading Pace Timeline</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
              <XAxis dataKey="timestamp" type="number" domain={['dataMin', 'dataMax']} tickFormatter={formatTimestamp} tick={{ fill: '#888', fontSize: 12 }} />
              <YAxis dataKey="pages" name="Pages" tick={{ fill: '#888', fontSize: 12 }} />
              <ZAxis dataKey="rating" range={[60, 300]} name="Rating" />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={paceData} fill="#e94560" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      {cumulativeData.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Cumulative Pages Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cumulativeData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
              <XAxis dataKey="timestamp" type="number" domain={['dataMin', 'dataMax']} tickFormatter={formatTimestamp} tick={{ fill: '#888', fontSize: 12 }} />
              <YAxis tick={{ fill: '#888', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="pages" stroke="#e94560" strokeWidth={2} dot={{ fill: '#e94560', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {ratingsData.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Ratings Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={ratingsData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
              <XAxis dataKey="timestamp" type="number" domain={['dataMin', 'dataMax']} tickFormatter={formatTimestamp} tick={{ fill: '#888', fontSize: 12 }} />
              <YAxis domain={[0, 10]} tick={{ fill: '#888', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="rating" stroke="#4ecdc4" strokeWidth={2} dot={{ fill: '#4ecdc4', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {avgRatingByGroup.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Average Rating by Context Group</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, avgRatingByGroup.length * 40)}>
            <BarChart data={avgRatingByGroup} layout="vertical" margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
              <XAxis type="number" domain={[0, 10]} tick={{ fill: '#888', fontSize: 12 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#888', fontSize: 12 }} width={120} />
              <Tooltip
                formatter={(value: any, _name: any, props: any) => [`${value} (${props.payload.count} books)`, 'Avg Rating']}
                contentStyle={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 6, fontSize: 13 }}
              />
              <Bar dataKey="avg" fill="#e94560" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tagRatingData.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Average Rating by Tag</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tagRatingData.map(t => (
              <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 140, fontSize: 13, color: '#a0a0b8', textAlign: 'right', flexShrink: 0 }}>{t.name}</span>
                <div style={{ flex: 1, height: 20, background: '#0f3460', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                  <div
                    style={{
                      width: `${(t.avg / 10) * 100}%`,
                      height: '100%',
                      background: t.avg >= 7 ? '#26de81' : t.avg >= 5 ? '#f7b731' : '#e94560',
                      borderRadius: 4,
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
                <span style={{ width: 60, fontSize: 13, color: '#888', flexShrink: 0 }}>{t.avg}/10 ({t.count})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
