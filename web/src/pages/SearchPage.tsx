import { useState } from 'react'

export default function SearchPage() {
  const [query, setQuery] = useState('error AND timeout')

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Search</h2>
      <div className="hint">
        Next step: wire this to <code>/api/projects/:id/search</code>.
      </div>

      <div style={{ marginTop: 16 }} className="row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Try: error AND (timeout OR reset)'
        />
        <button disabled>Search</button>
      </div>

      <div style={{ marginTop: 16 }} className="hint">
        Results will show here (time desc + highlighted matches).
      </div>
    </div>
  )
}
