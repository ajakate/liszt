import { useState, useEffect } from 'react';
import { ContentTag, ContextGroup } from '../types';

export default function ContentTags() {
  const [tags, setTags] = useState<ContentTag[]>([]);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [contextGroups, setContextGroups] = useState<ContextGroup[]>([]);
  const [tagGroupMap, setTagGroupMap] = useState<Record<number, number[]>>({});
  const [newGroups, setNewGroups] = useState<Set<number>>(new Set());
  const [filterGroup, setFilterGroup] = useState<number | null>(null);

  useEffect(() => {
    loadTags();
    loadContextGroups();
  }, []);

  async function loadTags() {
    const result = await window.api.getContentTags();
    setTags(result);
  }

  async function loadContextGroups() {
    const [groups, allAssignments] = await Promise.all([
      window.api.getContextGroups(),
      window.api.getAllContentTagContextGroups(),
    ]);
    setContextGroups(groups);
    const map: Record<number, number[]> = {};
    for (const a of allAssignments) {
      if (!map[a.content_tag_id]) map[a.content_tag_id] = [];
      map[a.content_tag_id].push(a.id);
    }
    setTagGroupMap(map);
  }

  async function toggleGroup(contentTagId: number, groupId: number) {
    const assigned = tagGroupMap[contentTagId]?.includes(groupId);
    if (assigned) {
      await window.api.removeContextGroupToContentTag(contentTagId, groupId);
    } else {
      await window.api.addContextGroupToContentTag(contentTagId, groupId);
    }
    await loadContextGroups();
  }

  async function handleAdd() {
    if (!newName.trim() || !newDesc.trim()) return;
    const id = await window.api.createContentTag(newName, newDesc);
    for (const groupId of newGroups) {
      await window.api.addContextGroupToContentTag(id, groupId);
    }
    setNewName('');
    setNewDesc('');
    setNewGroups(new Set());
    await loadTags();
    await loadContextGroups();
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
        {contextGroups.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: '#888', fontSize: 13 }}>Groups:</span>
            {contextGroups.map(g => {
              const active = newGroups.has(g.id);
              return (
                <button
                  key={g.id}
                  className={`tag-btn ${active ? 'tag-active' : ''}`}
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => {
                    const next = new Set(newGroups);
                    if (active) next.delete(g.id); else next.add(g.id);
                    setNewGroups(next);
                  }}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        )}
        <button onClick={handleAdd} disabled={!newName.trim() || !newDesc.trim()}>
          Add Tag
        </button>
      </div>

      {contextGroups.length > 0 && tags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: '#888', fontSize: 13 }}>Filter:</span>
          <button
            className={`tag-btn ${filterGroup === null ? 'tag-active' : ''}`}
            style={{ fontSize: 11, padding: '2px 8px' }}
            onClick={() => setFilterGroup(null)}
          >
            All
          </button>
          {contextGroups.map(g => (
            <button
              key={g.id}
              className={`tag-btn ${filterGroup === g.id ? 'tag-active' : ''}`}
              style={{ fontSize: 11, padding: '2px 8px' }}
              onClick={() => setFilterGroup(filterGroup === g.id ? null : g.id)}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {tags.length === 0 ? (
        <div className="empty-state">
          <p>No content tags yet. Add some above to start fingerprinting your books.</p>
        </div>
      ) : (
        <div>
          {tags.filter(tag => filterGroup === null || tagGroupMap[tag.id]?.includes(filterGroup)).map(tag => (
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
                <div>
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
                  {contextGroups.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                      {contextGroups.map(g => {
                        const active = tagGroupMap[tag.id]?.includes(g.id);
                        return (
                          <button
                            key={g.id}
                            className={`tag-btn ${active ? 'tag-active' : ''}`}
                            style={{ fontSize: 11, padding: '2px 8px' }}
                            onClick={() => toggleGroup(tag.id, g.id)}
                          >
                            {g.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
