import { useState, useEffect } from 'react';
import { Tag } from '../types';

export default function Tags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTag, setNewTag] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    loadTags();
  }, []);

  async function loadTags() {
    const result = await window.api.getTags();
    setTags(result);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTag.trim()) return;
    await window.api.createTag(newTag.trim());
    setNewTag('');
    await loadTags();
  }

  async function handleUpdate(id: number) {
    if (!editingName.trim()) return;
    await window.api.updateTag(id, editingName.trim());
    setEditingId(null);
    await loadTags();
  }

  async function handleDelete(id: number) {
    await window.api.deleteTag(id);
    await loadTags();
  }

  return (
    <div>
      <h2>Tags</h2>
      <p style={{ color: '#888', marginBottom: 20 }}>
        Create tags to organize and categorize your books.
      </p>

      <form onSubmit={handleCreate}>
        <div className="form-row">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder='e.g., "dark romance", "enemies to lovers", "fae"'
          />
          <button type="submit">Add</button>
        </div>
      </form>

      {tags.length === 0 ? (
        <div className="empty-state">
          <p>No tags yet. Create some above.</p>
        </div>
      ) : (
        tags.map((tag) => (
          <div key={tag.id} className="preference-item">
            {editingId === tag.id ? (
              <div className="form-row" style={{ flex: 1, marginBottom: 0 }}>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUpdate(tag.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                />
                <button onClick={() => handleUpdate(tag.id)}>Save</button>
                <button className="secondary" onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            ) : (
              <>
                <span>{tag.name}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="secondary" onClick={() => { setEditingId(tag.id); setEditingName(tag.name); }}>Edit</button>
                  <button className="danger" onClick={() => handleDelete(tag.id)}>Remove</button>
                </div>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}
