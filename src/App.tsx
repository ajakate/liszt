import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
import Library from './pages/Library';
import BookDetail from './pages/BookDetail';
import Preferences from './pages/Preferences';
import Tags from './pages/Tags';
import Compare from './pages/Compare';
import Settings from './pages/Settings';

function App() {
  const [version, setVersion] = useState('');

  useEffect(() => {
    window.api?.getVersion().then(setVersion).catch(() => {});
  }, []);

  return (
    <HashRouter>
      <div className="app">
        <nav className="sidebar">
          <h1 className="app-title">Liszt</h1>
          {version && <span className="app-version">v{version}</span>}
          <NavLink to="/" end>Library</NavLink>
          <NavLink to="/preferences">Preferences</NavLink>
          <NavLink to="/tags">Tags</NavLink>
          <NavLink to="/compare">Compare Styles</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <main className="content">
          <Routes>
            <Route path="/" element={<Library />} />
            <Route path="/book/:id" element={<BookDetail />} />
            <Route path="/preferences" element={<Preferences />} />
            <Route path="/tags" element={<Tags />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

export default App;
