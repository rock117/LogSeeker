import { useEffect, useState } from 'react'
import { fetchHealth, type HealthResponse } from '../api/client'

type Project = {
  id: string
  name: string
  default_timezone: string
  multiline_enabled: boolean
  timestamp_regex: string
  sources: Array<{
    path: string
    include_globs: string[]
    exclude_globs: string[]
  }>
  created_at: string
  updated_at: string
}

async function fetchProjects(): Promise<Project[]> {
  const resp = await fetch('/api/projects')
  if (!resp.ok) throw new Error(`projects list failed: ${resp.status}`)
  return resp.json() as Promise<Project[]>
}

async function createProject(name: string): Promise<Project> {
  const resp = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, sources: [] }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`create project failed: ${resp.status} ${text}`)
  }
  return resp.json() as Promise<Project>
}

export default function ProjectsPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch((e) => setError(String(e)))
  }, [])

  const reloadProjects = async () => {
    setLoadingProjects(true)
    try {
      setProjects(await fetchProjects())
    } finally {
      setLoadingProjects(false)
    }
  }

  useEffect(() => {
    reloadProjects().catch((e) => setError(String(e)))
  }, [])

  const onCreate = async () => {
    const name = newName.trim()
    if (!name) return
    try {
      await createProject(name)
      setNewName('')
      await reloadProjects()
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Projects</h2>
      <div className="hint">Create and manage your log search projects.</div>

      <div style={{ marginTop: 16 }} className="row">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New project name"
        />
        <button onClick={onCreate}>Create</button>
        <button onClick={() => reloadProjects().catch((e) => setError(String(e)))}>
          Refresh
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        {loadingProjects ? (
          <div className="hint">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="hint">No projects yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {projects.map((p) => (
              <div
                key={p.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: 12,
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div className="hint" style={{ marginTop: 6 }}>
                  id: {p.id}
                </div>
                <div className="hint">
                  sources: {p.sources.length} | tz: {p.default_timezone} | multiline:{' '}
                  {String(p.multiline_enabled)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="hint">Backend connectivity check:</div>
        {error ? (
          <pre style={{ color: '#ffb3b3' }}>{error}</pre>
        ) : health ? (
          <pre>{JSON.stringify(health, null, 2)}</pre>
        ) : (
          <div className="hint">Loading...</div>
        )}
      </div>
    </div>
  )
}
