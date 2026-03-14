import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
import Library from './pages/Library';
import BookDetail from './pages/BookDetail';
import Preferences from './pages/Preferences';
import Tags from './pages/Tags';
import Compare from './pages/Compare';
import Settings from './pages/Settings';

function App() {
  return (
    <HashRouter>
      <div className="app">
        <nav className="sidebar">
          <h1 className="app-title">Liszt</h1>
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
