import { useState, useEffect } from 'react';
import { ContentTag } from '../types';

export default function ContentTags() {
  const [tags, setTags] = useState<ContentTag[]>([]);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  useEffect(() => {
    loadTags();
  }, []);

  async function loadTags() {
    const result = await window.api.getContentTags();
    setTags(result);
  }

  async function handleAdd() {
    if (!newName.trim() || !newDesc.trim()) return;
    await window.api.createContentTag(newName, newDesc);
    setNewName('');
    setNewDesc('');
    await loadTags();
  }

  async function handleDelete(id: number) {
    const confirmed = await window.api.showConfirm('Delete this content tag? Scores for this tag will also be removed.');
    if (confirmed) {
      await window.api.deleteContentTag(id);
      await loadTags();
    }
  }

  async function handleUpdate() {
    if (editingId === null || !editName.trim() || !editDesc.trim()) return;
    await window.api.updateContentTag(editingId, editName, editDesc);
    setEditingId(null);
    await loadTags();
  }

  function startEdit(tag: ContentTag) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditDesc(tag.description);
  }

  return (
    <div>
      <h2>Content Fingerprint</h2>
      <p style={{ color: '#888', marginBottom: 16 }}>
        Define content tags to score books against when you run an analysis.
        Each tag will be rated 0–10 by Claude based on the book's text.
      </p>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="form-row">
          <input
            type="text"
            placeholder="Tag name (e.g. enemies to lovers trope)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
        </div>
        <div className="form-row">
          <input
            type="text"
            placeholder="Description (e.g. two characters that start as enemies but fall in love)"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
        </div>
        <button onClick={handleAdd} disabled={!newName.trim() || !newDesc.trim()}>
          Add Tag
        </button>
      </div>

      {tags.length === 0 ? (
        <div className="empty-state">
          <p>No content tags yet. Add some above to start fingerprinting your books.</p>
        </div>
      ) : (
        <div>
          {tags.map(tag => (
            <div key={tag.id} className="card" style={{ marginBottom: 8 }}>
              {editingId === tag.id ? (
                <>
                  <div className="form-row">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                    />
                  </div>
                  <div className="form-row">
                    <input
                      type="text"
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleUpdate()}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleUpdate} disabled={!editName.trim() || !editDesc.trim()}>Save</button>
                    <button className="secondary" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{tag.name}</div>
                    <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>{tag.description}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 16 }}>
                    <button className="secondary" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => startEdit(tag)}>Edit</button>
                    <button className="danger" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => handleDelete(tag.id)}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
