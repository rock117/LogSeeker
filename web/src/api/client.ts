export type HealthResponse = {
  ok: boolean
  server_time: string
}

export async function fetchHealth(): Promise<HealthResponse> {
  const resp = await fetch('/api/health')
  if (!resp.ok) {
    throw new Error(`health failed: ${resp.status}`)
  }
  return resp.json() as Promise<HealthResponse>
}
