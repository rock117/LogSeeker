import React, { createContext, useContext, useMemo, useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import ProjectsPage from './pages/ProjectsPage'
import SearchPage from './pages/SearchPage'
import SettingsPage from './pages/SettingsPage'
import { fetchProjects, type Project } from './api/client'
import './styles.css'

interface AppContextType {
  currentProject: Project | null
  setCurrentProject: (project: Project | null) => void
  setCurrentProjectId: (projectId: string | null) => void
  projects: Project[]
  reloadProjects: () => Promise<void>
  projectsLoading: boolean
}

const AppContext = createContext<AppContextType | null>(null)

export const useAppContext = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within AppContext.Provider')
  }
  return context
}

function Sidebar() {
  const location = useLocation()
  const { currentProject, projects, setCurrentProjectId, projectsLoading } = useAppContext()

  const navigationItems = [
    { path: '/', label: 'Projects', icon: '📁' },
    { path: '/search', label: 'Search', icon: '🔍' },
    { path: '/settings', label: 'Settings', icon: '⚙️' }
  ]

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <Link to="/" className="sidebar-brand">
          <div className="sidebar-brand-icon">🔍</div>
          <span>LogSeeker</span>
        </Link>
      </div>
      
      <nav className="sidebar-nav">
        {navigationItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`sidebar-nav-item ${
              location.pathname === item.path ? 'active' : ''
            }`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      
      <div className="sidebar-footer">
        <div className="sidebar-project-info">Active Project</div>
        <select
          className="form-select"
          value={currentProject?.id ?? ''}
          onChange={(e) => setCurrentProjectId(e.target.value || null)}
          disabled={projectsLoading || projects.length === 0}
          style={{ marginTop: 8 }}
        >
          {projects.length === 0 ? <option value="">No projects</option> : <option value="">Select a project…</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {currentProject ? (
          <div className="text-xs text-gray-400 mt-1">
            {currentProject.sources.length} source{currentProject.sources.length !== 1 ? 's' : ''}
          </div>
        ) : (
          <div className="text-xs text-gray-400 mt-1">Choose a project to search and configure.</div>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)

  const reloadProjects = async () => {
    setProjectsLoading(true)
    try {
      const list = await fetchProjects()
      setProjects(list)
    } finally {
      setProjectsLoading(false)
    }
  }

  useEffect(() => {
    reloadProjects().catch(console.error)
  }, [])

  useEffect(() => {
    if (projects.length === 0) return
    if (currentProject) return
    const lastId = localStorage.getItem('logseeker-current-project-id')
    const restored = lastId ? projects.find((p) => p.id === lastId) : null
    if (restored) {
      setCurrentProjectState(restored)
      return
    }

    if (projects.length === 1) {
      setCurrentProjectState(projects[0])
      localStorage.setItem('logseeker-current-project-id', projects[0].id)
      return
    }
  }, [projects, currentProject])

  const setCurrentProject = (project: Project | null) => {
    setCurrentProjectState(project)
    if (project) {
      localStorage.setItem('logseeker-current-project-id', project.id)
    } else {
      localStorage.removeItem('logseeker-current-project-id')
    }
  }

  const setCurrentProjectId = (projectId: string | null) => {
    if (!projectId) {
      setCurrentProject(null)
      return
    }
    const found = projects.find((p) => p.id === projectId)
    if (found) {
      setCurrentProject(found)
    }
  }

  const ctxValue = useMemo<AppContextType>(
    () => ({
      currentProject,
      setCurrentProject,
      setCurrentProjectId,
      projects,
      reloadProjects,
      projectsLoading,
    }),
    [currentProject, projects, projectsLoading],
  )

  return (
    <AppContext.Provider value={ctxValue}>
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<ProjectsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </AppContext.Provider>
  )
}
