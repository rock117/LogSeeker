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

export default function SettingsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [sources, setSources] = useState<string[]>([])
  const [status, setStatus] = useState<IndexStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pollTimer = useRef<number | null>(null)

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  )

  const loadProjects = async () => {
    const list = await fetchProjects()
    setProjects(list)
    if (!selectedId && list.length > 0) {
      setSelectedId(list[0].id)
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
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Settings</h2>
      <div className="hint">
        Project settings (Option A: type directory paths). Default timezone is <code>+08:00</code>.
      </div>

      <div style={{ marginTop: 16 }} className="row">
        <div className="hint" style={{ minWidth: 72 }}>
          Project
        </div>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'rgba(255, 255, 255, 0.9)',
            color: 'var(--text)',
          }}
        >
          {projects.length === 0 ? <option value="">(no projects)</option> : null}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button onClick={() => loadProjects().catch((e) => setError(String(e)))} disabled={busy}>
          Refresh
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 600 }}>Source directories</div>
          <button onClick={onAddSource} disabled={busy || !selectedProject}>
            Add
          </button>
        </div>
        <div className="hint" style={{ marginTop: 6 }}>
          One line per directory. We will recursively scan <code>.log</code> and <code>.txt</code>.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {sources.length === 0 ? <div className="hint">No sources.</div> : null}
          {sources.map((s, idx) => (
            <div key={idx} className="row">
              <input
                type="text"
                value={s}
                onChange={(e) => onChangeSource(idx, e.target.value)}
                placeholder="e.g. C:\\logs\\service-a"
              />
              <button onClick={() => onRemoveSource(idx)} disabled={busy}>
                Remove
              </button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12 }} className="row">
          <button onClick={onSave} disabled={busy || !selectedProject}>
            Save
          </button>
          <button onClick={onRebuild} disabled={busy || !selectedProject}>
            Rebuild Index
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 600 }}>Index status</div>
        {status ? <pre style={{ marginTop: 8 }}>{JSON.stringify(status, null, 2)}</pre> : <div className="hint">No status.</div>}
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="hint">Default timestamp formats supported:</div>
        <pre>
{`2026-01-06T00:00:10.139126+08:00
2026-01-06T00:00:10 +08:00
2026-01-06T00:00:10`}
        </pre>
      </div>

      {error ? (
        <div style={{ marginTop: 12 }}>
          <pre style={{ color: '#b42318' }}>{error}</pre>
        </div>
      ) : null}
    </div>
  )
}
