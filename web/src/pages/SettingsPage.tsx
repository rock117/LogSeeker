import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchIndexStatus,
  fetchProjects,
  rebuildIndex,
  updateProject,
  type IndexStatus,
  type Project,
  type SourceConfig,
} from '../api/client'
import { useAppContext } from '../App'

export default function SettingsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const { currentProject, setCurrentProject } = useAppContext()
  const [sources, setSources] = useState<string[]>([])
  const [status, setStatus] = useState<IndexStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [refreshingProjects, setRefreshingProjects] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pollTimer = useRef<number | null>(null)

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  )

  const loadProjects = async () => {
    setRefreshingProjects(true)
    try {
      const list = await fetchProjects()
      setProjects(list)
    
      // 如果有全局选中的项目，优先使用它
      if (currentProject && list.find(p => p.id === currentProject.id)) {
        setSelectedId(currentProject.id)
      } else if (!selectedId && list.length > 0) {
        setSelectedId(list[0].id)
      }
    } finally {
      setRefreshingProjects(false)
    }
  }

  const handleProjectSelect = (projectId: string) => {
    setSelectedId(projectId)
    const project = projects.find(p => p.id === projectId)
    if (project) {
      setCurrentProject(project)
    }
  }

  const loadStatus = async (projectId: string) => {
    setStatus(await fetchIndexStatus(projectId))
  }

  const startPolling = (projectId: string) => {
    stopPolling()
    pollTimer.current = window.setInterval(() => {
      loadStatus(projectId).catch(() => {})
    }, 800)
  }

  const stopPolling = () => {
    if (pollTimer.current !== null) {
      window.clearInterval(pollTimer.current)
      pollTimer.current = null
    }
  }

  useEffect(() => {
    loadProjects().catch((e) => setError(String(e)))
    return () => stopPolling()
  }, [])

  useEffect(() => {
    setError(null)
    if (!selectedProject) return

    stopPolling()
    setSources(selectedProject.sources.map((s) => s.path))
    loadStatus(selectedProject.id).catch(() => {})
  }, [selectedId])

  const onAddSource = () => {
    setSources((prev) => [...prev, ''])
  }

  const onRemoveSource = (idx: number) => {
    setSources((prev) => prev.filter((_, i) => i !== idx))
  }

  const onChangeSource = (idx: number, value: string) => {
    setSources((prev) => prev.map((v, i) => (i === idx ? value : v)))
  }

  const onSave = async () => {
    if (!selectedProject) return
    setBusy(true)
    setError(null)
    try {
      const cleaned = sources.map((s) => s.trim()).filter((s) => s.length > 0)
      const payloadSources: SourceConfig[] = cleaned.map((path) => ({
        path,
        include_globs: ['**/*.log', '**/*.txt'],
        exclude_globs: [],
      }))
      await updateProject(selectedProject.id, { sources: payloadSources } as Partial<Project>)
      await loadProjects()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const onRebuild = async () => {
    if (!selectedProject) return
    setBusy(true)
    setError(null)
    try {
      await rebuildIndex(selectedProject.id)
      await loadStatus(selectedProject.id)
      startPolling(selectedProject.id)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Project Configuration</h1>
          <p className="page-description">
            Configure data sources, indexing settings, and manage project-specific options for log analysis.
          </p>
        </div>
      </div>

      <div className="settings-layout">
        <div className="col" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Project Selection */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h2 className="card-title">Project</h2>
                <button
                  onClick={() => loadProjects().catch((e) => setError(String(e)))}
                  disabled={refreshingProjects || busy}
                  className="btn btn-secondary btn-xs"
                  style={{ minWidth: 92 }}
                >
                  <span style={{ width: 16, display: 'inline-flex', justifyContent: 'center' }}>
                    {refreshingProjects ? <div className="spinner"></div> : '↻'}
                  </span>
                  <span>Refresh</span>
                </button>
              </div>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label form-label-required">Active Project</label>
                <select
                  value={selectedId}
                  onChange={(e) => handleProjectSelect(e.target.value)}
                  className="form-select"
                  disabled={busy || refreshingProjects}
                >
                  {projects.length === 0 ? (
                    <option value="">No projects available</option>
                  ) : (
                    projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))
                  )}
                </select>
                <div className="form-help">Switching project will update the forms below.</div>
              </div>
            </div>
          </div>

          {/* Configuration Sections */}
          {selectedProject ? (
            <>
              {/* Data Sources Configuration */}
              <div className="card">
                <div className="card-header">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="card-title">Data Sources</h3>
                      <p className="text-sm text-gray-600 mt-1">Directories containing log files for indexing</p>
                    </div>
                    <button
                      onClick={onAddSource}
                      disabled={busy}
                      className="btn btn-secondary btn-xs"
                      style={{ minWidth: 92 }}
                    >
                      <span style={{ width: 16, display: 'inline-flex', justifyContent: 'center' }}>+</span>
                      <span>Add</span>
                    </button>
                  </div>
                </div>
                <div className="card-body">
                  <div className="form-help mb-4">
                    Use absolute paths. We scan <code>*.log</code> and <code>*.txt</code> recursively.
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {sources.length === 0 ? (
                      <div className="empty-state" style={{ padding: '32px 16px' }}>
                        <div className="empty-state-icon">📂</div>
                        <div className="empty-state-title">No directories configured</div>
                        <div className="empty-state-description">Add at least one directory to enable indexing and search.</div>
                      </div>
                    ) : (
                      sources.map((source, idx) => (
                        <div key={idx} className="input-group">
                          <input
                            type="text"
                            value={source}
                            onChange={(e) => onChangeSource(idx, e.target.value)}
                            placeholder="e.g. C:\\logs\\service-a"
                            className="form-input"
                            disabled={busy}
                          />
                          <button
                            onClick={() => onRemoveSource(idx)}
                            disabled={busy}
                            className="btn btn-ghost btn-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-6" style={{ justifyContent: 'flex-end' }}>
                    <button
                      onClick={onSave}
                      disabled={busy || !selectedProject}
                      className="btn btn-primary btn-sm"
                    >
                      {busy ? <div className="spinner"></div> : '💾'} Save
                    </button>
                    <button
                      onClick={onRebuild}
                      disabled={busy || !selectedProject || sources.length === 0}
                      className="btn btn-warning btn-sm"
                    >
                      {busy ? <div className="spinner"></div> : '🔄'} Rebuild Index
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="card">
              <div className="card-body">
                <div className="empty-state" style={{ padding: '32px 16px' }}>
                  <div className="empty-state-icon">⚙️</div>
                  <div className="empty-state-title">No Project Selected</div>
                  <div className="empty-state-description">Select a project to configure sources and indexing.</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="col" style={{ display: 'flex', flexDirection: 'column', gap: 24, position: 'sticky', top: 24 }}>
          {/* Index Status */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Index Status</h3>
            </div>
            <div className="card-body">
              {!selectedProject ? (
                <div className="text-sm text-gray-500">Select a project to view index status.</div>
              ) : status ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="flex items-center gap-4">
                    <div className={`status-badge ${
                      status.state === 'running' ? 'status-warning' :
                      status.state === 'error' ? 'status-error' : 'status-success'
                    }`}>
                      {status.state === 'running' && <div className="spinner"></div>}
                      {status.state.toUpperCase()}
                    </div>
                    <div className="text-sm text-gray-600">
                      Files: {status.files_scanned} | Events: {status.events_indexed}
                    </div>
                  </div>

                  {status.message && (
                    <div className="p-4 rounded bg-gray-50 border">
                      <div className="text-sm font-medium text-gray-700 mb-1">Details</div>
                      <code className="text-sm text-gray-600">{status.message}</code>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div
                      className="text-center p-4 rounded"
                      style={{ backgroundColor: 'var(--primary-50)', border: '1px solid var(--primary-100)' }}
                    >
                      <div className="text-2xl font-bold" style={{ color: 'var(--primary-700)' }}>{status.files_scanned}</div>
                      <div className="text-sm" style={{ color: 'var(--primary-700)' }}>Files</div>
                    </div>
                    <div
                      className="text-center p-4 rounded"
                      style={{ backgroundColor: 'var(--success-50)', border: '1px solid var(--success-200)' }}
                    >
                      <div className="text-2xl font-bold" style={{ color: 'var(--success-700)' }}>{status.events_indexed}</div>
                      <div className="text-sm" style={{ color: 'var(--success-700)' }}>Events</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">No status information available.</div>
              )}
            </div>
          </div>

          {/* Project Information */}
          {selectedProject && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Project Info</h3>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div className="text-xs text-gray-500" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Name</div>
                    <div className="text-sm text-gray-900">{selectedProject.name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Project ID</div>
                    <div className="text-sm text-gray-900">{selectedProject.id}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Timezone</div>
                      <div className="text-sm text-gray-900">{selectedProject.default_timezone}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Multiline</div>
                      <div className="text-sm text-gray-900">{selectedProject.multiline_enabled ? 'Enabled' : 'Disabled'}</div>
                    </div>
                  </div>
                  <div className="pt-3" style={{ borderTop: '1px solid var(--gray-200)' }}>
                    <div className="text-xs text-gray-500">Created: {new Date(selectedProject.created_at).toLocaleString()}</div>
                    <div className="text-xs text-gray-500">Updated: {new Date(selectedProject.updated_at).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Timestamp Format Help */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Timestamp Formats</h3>
            </div>
            <div className="card-body">
              <div className="form-help mb-3">Examples detected by LogSeeker:</div>
              <div className="bg-gray-50 p-4 rounded">
                <pre className="text-sm text-gray-700" style={{ margin: 0 }}>
{`2026-01-06T00:00:10.139126+08:00
2026-01-06T00:00:10 +08:00
2026-01-06T00:00:10
2026-01-06 00:00:10
Jan 06 00:00:10`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="card mt-6" style={{ borderColor: 'var(--error-500)', background: 'var(--error-50)' }}>
          <div className="card-body">
            <div className="flex items-start gap-3">
              <div className="text-error-600 text-xl">⚠️</div>
              <div>
                <div className="font-semibold text-error-700 mb-2">Configuration Error</div>
                <pre className="text-sm text-error-600">{error}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
