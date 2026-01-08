export type HealthResponse = {
  ok: boolean
  server_time: string
}

export type SourceConfig = {
  path: string
  include_globs: string[]
  exclude_globs: string[]
}

export type Project = {
  id: string
  name: string
  default_timezone: string
  multiline_enabled: boolean
  timestamp_regex: string
  sources: SourceConfig[]
  created_at: string
  updated_at: string
}

export type IndexStatus = {
  state: 'idle' | 'running' | 'error' | string
  message?: string | null
  files_scanned: number
  events_indexed: number
}

export async function fetchHealth(): Promise<HealthResponse> {
  const resp = await fetch('/api/health')
  if (!resp.ok) {
    throw new Error(`health failed: ${resp.status}`)
  }
  return resp.json() as Promise<HealthResponse>
}

export async function fetchProjects(): Promise<Project[]> {
  const resp = await fetch('/api/projects')
  if (!resp.ok) throw new Error(`projects list failed: ${resp.status}`)
  return resp.json() as Promise<Project[]>
}

export async function createProject(name: string): Promise<Project> {
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

export async function updateProject(id: string, patch: Partial<Project>): Promise<Project | null> {
  const resp = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`update project failed: ${resp.status} ${text}`)
  }
  const body = (await resp.json()) as Project | null
  return body
}

export async function rebuildIndex(projectId: string): Promise<{ started: boolean }> {
  const resp = await fetch(`/api/projects/${encodeURIComponent(projectId)}/index/rebuild`, {
    method: 'POST',
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`rebuild index failed: ${resp.status} ${text}`)
  }
  return resp.json() as Promise<{ started: boolean }>
}

export async function fetchIndexStatus(projectId: string): Promise<IndexStatus> {
  const resp = await fetch(`/api/projects/${encodeURIComponent(projectId)}/index/status`)
  if (!resp.ok) throw new Error(`index status failed: ${resp.status}`)
  return resp.json() as Promise<IndexStatus>
}
