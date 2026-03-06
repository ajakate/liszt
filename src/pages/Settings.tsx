import { useState, useEffect } from 'react';
import { ModelOption } from '../types';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [models, setModels] = useState<ModelOption[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.api?.getApiKey().then(setApiKey).catch(console.error);
    window.api?.getModel().then(setModel).catch(console.error);
    window.api?.getAvailableModels().then(setModels).catch(console.error);
  }, []);

  async function handleSaveKey() {
    await window.api.setApiKey(apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleModelChange(newModel: string) {
    setModel(newModel);
    await window.api.setModel(newModel);
  }

  return (
    <div>
      <h2>Settings</h2>

      <div className="card">
        <h3>Claude API Key</h3>
        <p style={{ color: '#888', marginBottom: 12, fontSize: 13 }}>
          Get your API key from{' '}
          <span style={{ color: '#e94560' }}>console.anthropic.com</span>
        </p>
        <div className="form-row">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
          />
          <button onClick={handleSaveKey}>
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Model</h3>
        <p style={{ color: '#888', marginBottom: 12, fontSize: 13 }}>
          Choose which Claude model to use for analysis. Cheaper models are faster but less nuanced.
        </p>
        <select
          value={model}
          onChange={(e) => handleModelChange(e.target.value)}
          style={{
            background: '#16213e',
            border: '1px solid #0f3460',
            color: '#e0e0e0',
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 14,
            width: '100%',
          }}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
