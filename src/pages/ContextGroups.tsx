import { useState, useEffect } from 'react';
import { ContextGroup } from '../types';

export default function ContextGroups() {
  const [groups, setGroups] = useState<ContextGroup[]>([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    const result = await window.api.getContextGroups();
    setGroups(result);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await window.api.createContextGroup(newName.trim());
    setNewName('');
    await loadGroups();
  }

  async function handleUpdate(id: number) {
    if (!editingName.trim()) return;
    await window.api.updateContextGroup(id, editingName.trim());
    setEditingId(null);
    await loadGroups();
  }

  async function handleDelete(id: number) {
    const confirmed = await window.api.showConfirm('Delete this context group? It will be removed from all books and content tags.');
    if (confirmed) {
      await window.api.deleteContextGroup(id);
      await loadGroups();
    }
  }

  return (
    <div>
      <h2>Context Groups</h2>
      <p style={{ color: '#888', marginBottom: 20 }}>
        Context groups scope which content fingerprint tags get scored when you analyze a book.
        Assign groups to both books and content tags — only matching tags will be scored.
      </p>

      <form onSubmit={handleCreate}>
        <div className="form-row">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder='e.g., "Fantasy", "Literary Fiction", "Romance"'
          />
          <button type="submit">Add</button>
        </div>
      </form>

      {groups.length === 0 ? (
        <div className="empty-state">
          <p>No context groups yet. Create some above.</p>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.id} className="preference-item">
            {editingId === group.id ? (
              <div className="form-row" style={{ flex: 1, marginBottom: 0 }}>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUpdate(group.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                />
                <button onClick={() => handleUpdate(group.id)}>Save</button>
                <button className="secondary" onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            ) : (
              <>
                <span>{group.name}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="secondary" onClick={() => { setEditingId(group.id); setEditingName(group.name); }}>Edit</button>
                  <button className="danger" onClick={() => handleDelete(group.id)}>Remove</button>
                </div>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}
