import { NavLink, Route, Routes } from 'react-router-dom'
import ProjectsPage from './pages/ProjectsPage'
import SearchPage from './pages/SearchPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <div className="container">
      <aside className="sidebar">
        <div className="brand">LogSeeker</div>
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Projects
          </NavLink>
          <NavLink to="/search" className={({ isActive }) => (isActive ? 'active' : '')}>
            Search
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
            Settings
          </NavLink>
        </nav>
        <div style={{ marginTop: 12 }} className="hint">
          MVP skeleton. Next we’ll wire these pages to real APIs.
        </div>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}
