import { useEffect, useState } from 'react'
import { createProject, fetchHealth, fetchProjects, type HealthResponse, type Project } from '../api/client'
import { useAppContext } from '../App'

export default function ProjectsPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [newName, setNewName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const { currentProject, setCurrentProject } = useAppContext()

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [healthData, projectsData] = await Promise.all([
          fetchHealth(),
          fetchProjects()
        ])
        setHealth(healthData)
        setProjects(projectsData)
      } catch (err) {
        setError('Failed to load initial data')
        console.error(err)
      } finally {
        setLoadingInitial(false)
      }
    }
    
    loadInitialData()
  }, [])

  const handleSelectProject = (project: Project) => {
    setCurrentProject(project)
  }

  const reloadProjects = async () => {
    setLoadingProjects(true)
    try {
      const projectsData = await fetchProjects()
      setProjects(projectsData)
    } catch (err) {
      setError('Failed to reload projects')
    } finally {
      setLoadingProjects(false)
    }
  }

  const onCreate = async () => {
    const name = newName.trim()
    if (!name) return
    
    setIsCreating(true)
    setError(null)
    
    try {
      const newProject = await createProject(name)
      setNewName('')
      setProjects(prev => [...prev, newProject])
      setCurrentProject(newProject)
    } catch (e) {
      setError(String(e))
    } finally {
      setIsCreating(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getProjectStatus = (project: Project) => {
    if (project.sources.length === 0) {
      return { label: 'Setup Required', type: 'warning' }
    }
    return { label: 'Ready', type: 'success' }
  }

  if (loadingInitial) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
          <div className="text-center">
            <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto 16px' }}></div>
            <div className="text-gray-600">Loading projects...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="page-title">Project Management</h1>
            <p className="page-description">
              Create and manage log analysis projects. Each project maintains its own configuration, 
              data sources, and search indices.
            </p>
          </div>
          
          {health && (
            <div className="flex items-center gap-3">
              <div className={`status-badge ${
                health.ok ? 'status-success' : 'status-error'
              }`}>
                {health.ok ? '● Connected' : '● Disconnected'}
              </div>
              <div className="text-sm text-gray-500">
                {new Date(health.server_time).toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card mb-8">
        <div className="card-header">
          <h2 className="card-title">Create New Project</h2>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">Project Name</label>
            <div className="input-group">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Production Logs, API Gateway, Database Audit..."
                className="form-input"
                disabled={isCreating}
                onKeyPress={(e) => e.key === 'Enter' && onCreate()}
              />
              <button
                onClick={onCreate}
                disabled={isCreating || !newName.trim()}
                className="btn btn-primary"
              >
                {isCreating ? (
                  <><div className="spinner"></div> Creating...</>
                ) : (
                  <>+ Create Project</>
                )}
              </button>
              <button 
                onClick={reloadProjects}
                disabled={loadingProjects}
                className="btn btn-secondary"
              >
                {loadingProjects ? <div className="spinner"></div> : '↻'} Refresh
              </button>
            </div>
            {error && <div className="form-error">{error}</div>}
            <div className="form-help">
              Choose a descriptive name that identifies the log source or system
            </div>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="section-title">Your Projects ({projects.length})</h2>
        </div>
        
        {projects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">�</div>
            <div className="empty-state-title">No Projects Created</div>
            <div className="empty-state-description">
              Get started by creating your first log analysis project. 
              You'll be able to configure data sources and start searching logs.
            </div>
            <div className="empty-state-action">
              <button 
                onClick={() => document.querySelector<HTMLInputElement>('input[placeholder*="Project Name"]')?.focus()}
                className="btn btn-primary"
              >
                Create Your First Project
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))' }}>
            {projects.map((project) => {
              const status = getProjectStatus(project)
              const isSelected = currentProject?.id === project.id
              
              return (
                <div
                  key={project.id}
                  className={`card card-interactive ${
                    isSelected ? 'card-selected' : ''
                  }`}
                  onClick={() => handleSelectProject(project)}
                >
                  <div className="card-header">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="card-title">{project.name}</h3>
                        <div className="text-sm text-gray-500 mt-1">
                          ID: {project.id}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {isSelected && (
                          <div className="status-badge status-info">● Selected</div>
                        )}
                        <div className={`status-badge status-${status.type}`}>
                          {status.label}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="card-body">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Data Sources</span>
                        <span className="text-lg font-semibold text-gray-900">
                          {project.sources.length}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Timezone</span>
                        <span className="text-sm text-gray-700">
                          {project.default_timezone}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <span>📝</span>
                        <span>Multiline: {project.multiline_enabled ? 'On' : 'Off'}</span>
                      </div>
                    </div>
                    
                    {project.sources.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                          Source Directories
                        </div>
                        <div className="flex flex-col gap-1">
                          {project.sources.slice(0, 2).map((source, idx) => (
                            <code key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {source.path}
                            </code>
                          ))}
                          {project.sources.length > 2 && (
                            <div className="text-xs text-gray-500">
                              +{project.sources.length - 2} more directories...
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="card-footer">
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>Created {formatDate(project.created_at)}</span>
                      <span>Updated {formatDate(project.updated_at)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      
      {/* Next Steps */}
      {currentProject && (
        <div className="card mt-8" style={{ background: 'var(--primary-50)', borderColor: 'var(--primary-200)' }}>
          <div className="card-body">
            <div className="flex items-start gap-4">
              <div className="text-2xl">🎯</div>
              <div>
                <h3 className="font-semibold text-primary-700 mb-2">Next Steps</h3>
                <p className="text-primary-600 mb-3">
                  You've selected <strong>{currentProject.name}</strong>. 
                  {currentProject.sources.length === 0 
                    ? 'Configure data sources to start analyzing logs.'
                    : 'You can now search through your logs or update the configuration.'
                  }
                </p>
                <div className="flex gap-3">
                  <a href="/settings" className="btn btn-primary btn-sm">
                    ⚙️ Configure Project
                  </a>
                  {currentProject.sources.length > 0 && (
                    <a href="/search" className="btn btn-secondary btn-sm">
                      🔍 Search Logs
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
