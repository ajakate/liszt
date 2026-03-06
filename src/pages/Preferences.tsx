import { useState, useEffect } from 'react';
import { Preference } from '../types';

export default function Preferences() {
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [newQuestion, setNewQuestion] = useState('');

  useEffect(() => {
    loadPreferences();
  }, []);

  async function loadPreferences() {
    const result = await window.api.getPreferences();
    setPreferences(result);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newQuestion.trim()) return;
    await window.api.addPreference(newQuestion.trim());
    setNewQuestion('');
    await loadPreferences();
  }

  async function handleDelete(id: number) {
    await window.api.deletePreference(id);
    await loadPreferences();
  }

  return (
    <div>
      <h2>Preferences</h2>
      <p style={{ color: '#888', marginBottom: 20 }}>
        Add questions you want answered about every book you analyze.
      </p>

      <form onSubmit={handleAdd}>
        <div className="form-row">
          <input
            type="text"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder='e.g., "Does an animal die?" or "Is there a love triangle?"'
          />
          <button type="submit">Add</button>
        </div>
      </form>

      {preferences.length === 0 ? (
        <div className="empty-state">
          <p>No preferences yet. Add some questions above.</p>
        </div>
      ) : (
        preferences.map((pref) => (
          <div key={pref.id} className="preference-item">
            <span>{pref.question}</span>
            <button className="danger" onClick={() => handleDelete(pref.id)}>Remove</button>
          </div>
        ))
      )}
    </div>
  );
}
