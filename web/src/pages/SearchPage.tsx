import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAppContext } from '../App'

interface SearchFilters {
  timeRange: 'last-hour' | 'last-day' | 'last-week' | 'custom'
  logLevel: 'all' | 'error' | 'warning' | 'info' | 'debug'
  sortBy: 'timestamp-desc' | 'timestamp-asc' | 'relevance'
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [filters, setFilters] = useState<SearchFilters>({
    timeRange: 'last-day',
    logLevel: 'all',
    sortBy: 'timestamp-desc'
  })
  const [showFilters, setShowFilters] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { currentProject, projects, projectsLoading, setCurrentProjectId, reloadProjects } = useAppContext()

  const projectReady = useMemo(() => {
    if (!currentProject) return false
    return currentProject.sources.length > 0
  }, [currentProject])

  useEffect(() => {
    // Load search history from localStorage
    const saved = localStorage.getItem('logseeker-search-history')
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved))
      } catch (e) {
        console.warn('Failed to parse search history')
      }
    }
  }, [])

  const saveSearchToHistory = (searchQuery: string) => {
    const newHistory = [searchQuery, ...searchHistory.filter(q => q !== searchQuery)].slice(0, 10)
    setSearchHistory(newHistory)
    localStorage.setItem('logseeker-search-history', JSON.stringify(newHistory))
  }

  const handleSearch = async () => {
    if (!currentProject || !query.trim()) return
    
    setSearching(true)
    setError(null)
    
    try {
      saveSearchToHistory(query.trim())
      
      // TODO: 实现搜索 API 调用
      // const searchResults = await searchInProject(currentProject.id, query, filters)
      // setResults(searchResults)
      console.log(`Searching in project ${currentProject.name} for: ${query}`, filters)
      
      // 模拟搜索延迟
      await new Promise(resolve => setTimeout(resolve, 1500))
      setResults([])
    } catch (err) {
      setError('Search failed. Please try again.')
      console.error('Search failed:', err)
    } finally {
      setSearching(false)
    }
  }

  if (!currentProject) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Log Search</h1>
            <p className="page-description">Select a project and start searching immediately.</p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Choose Project</h2>
          </div>
          <div className="card-body">
            {projects.length === 0 ? (
              <div className="empty-state" style={{ padding: '48px 24px' }}>
                <div className="empty-state-icon">�</div>
                <div className="empty-state-title">No Projects Yet</div>
                <div className="empty-state-description">
                  Create a project first, then configure sources to index logs.
                </div>
                <div className="empty-state-action">
                  <Link to="/" className="btn btn-primary">Create Project</Link>
                </div>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label form-label-required">Project</label>
                <div className="input-group">
                  <select
                    className="form-select"
                    value=""
                    onChange={(e) => setCurrentProjectId(e.target.value || null)}
                    disabled={projectsLoading}
                  >
                    <option value="">Select a project…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-secondary"
                    onClick={() => reloadProjects().catch(() => {})}
                    disabled={projectsLoading}
                  >
                    {projectsLoading ? <div className="spinner"></div> : '↻'} Refresh
                  </button>
                </div>
                <div className="form-help">You can also switch project anytime via the left sidebar.</div>
              </div>
            )}
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
            <h1 className="page-title">Log Search</h1>
            <p className="page-description">
              Search through indexed log entries using advanced query syntax with filters and sorting options.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="status-badge status-info">
              📁 {currentProject.name}
            </div>
            <div className="text-sm text-gray-500">
              {currentProject.sources.length} source{currentProject.sources.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {!projectReady && (
          <div className="mt-4">
            <div className="status-badge status-warning">
              Setup required: configure data sources and rebuild index before searching.
            </div>
            <div className="mt-2">
              <Link to="/settings" className="btn btn-secondary btn-sm">⚙️ Configure Project</Link>
            </div>
          </div>
        )}
      </div>

      {/* Search Interface */}
      <div className="card mb-6">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h2 className="card-title">Search Query</h2>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn btn-ghost btn-sm"
            >
              ⚙️ {showFilters ? 'Hide' : 'Show'} Filters
            </button>
          </div>
        </div>
        
        <div className="card-body">
          {/* Main Search Input */}
          <div className="form-group">
            <div className="input-group">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter search query... e.g., error AND (timeout OR connection)"
                className="form-input"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                disabled={searching || !projectReady}
              />
              <button 
                onClick={handleSearch}
                disabled={searching || !query.trim() || !projectReady}
                className="btn btn-primary"
              >
                {searching ? (
                  <><div className="spinner"></div> Searching...</>
                ) : (
                  <>🔍 Search</>
                )}
              </button>
            </div>
            {error && <div className="form-error">{error}</div>}
          </div>

          {/* Search Filters */}
          {showFilters && (
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
              <div className="form-group">
                <label className="form-label">Time Range</label>
                <select 
                  className="form-select"
                  value={filters.timeRange}
                  onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value as any }))}
                >
                  <option value="last-hour">Last Hour</option>
                  <option value="last-day">Last 24 Hours</option>
                  <option value="last-week">Last Week</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Log Level</label>
                <select 
                  className="form-select"
                  value={filters.logLevel}
                  onChange={(e) => setFilters(prev => ({ ...prev, logLevel: e.target.value as any }))}
                >
                  <option value="all">All Levels</option>
                  <option value="error">Error</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                  <option value="debug">Debug</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Sort By</label>
                <select 
                  className="form-select"
                  value={filters.sortBy}
                  onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
                >
                  <option value="timestamp-desc">Newest First</option>
                  <option value="timestamp-asc">Oldest First</option>
                  <option value="relevance">Relevance</option>
                </select>
              </div>
            </div>
          )}

          {/* Search History */}
          {searchHistory.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-sm font-medium text-gray-700 mb-2">Recent Searches</div>
              <div className="flex flex-wrap gap-2">
                {searchHistory.slice(0, 5).map((historyQuery, idx) => (
                  <button
                    key={idx}
                    onClick={() => setQuery(historyQuery)}
                    className="btn btn-ghost btn-sm text-xs"
                    style={{ padding: '4px 8px' }}
                  >
                    {historyQuery}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search Syntax Help */}
      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title">Search Syntax Guide</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Boolean Operators</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="flex items-center gap-3">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">error AND timeout</code>
                  <span className="text-sm text-gray-600">Both terms must appear</span>
                </div>
                <div className="flex items-center gap-3">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">error OR warning</code>
                  <span className="text-sm text-gray-600">Either term can appear</span>
                </div>
                <div className="flex items-center gap-3">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">NOT error</code>
                  <span className="text-sm text-gray-600">Exclude this term</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Advanced Syntax</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="flex items-center gap-3">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">"exact phrase"</code>
                  <span className="text-sm text-gray-600">Exact phrase match</span>
                </div>
                <div className="flex items-center gap-3">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">field:value</code>
                  <span className="text-sm text-gray-600">Field-specific search</span>
                </div>
                <div className="flex items-center gap-3">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">(error OR warn) AND api</code>
                  <span className="text-sm text-gray-600">Grouped conditions</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Results */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Search Results</h3>
        </div>
        
        <div className="card-body">
          {searching ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto 16px' }}></div>
                <div className="text-gray-600">Searching through logs...</div>
                <div className="text-sm text-gray-500 mt-2">
                  Query: <code>{query}</code>
                </div>
              </div>
            </div>
          ) : results.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-4 pb-4 border-b">
                <div className="flex items-center gap-3">
                  <div className="status-badge status-success">
                    {results.length} result{results.length !== 1 ? 's' : ''}
                  </div>
                  <div className="text-sm text-gray-500">
                    Sorted by {filters.sortBy.replace('-', ' ')}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-ghost btn-sm">📥 Export</button>
                  <button className="btn btn-ghost btn-sm">🔗 Share</button>
                </div>
              </div>
              
              {/* TODO: 渲染搜索结果 */}
              <div className="empty-state">
                <div className="empty-state-icon">🚧</div>
                <div className="empty-state-title">Results Display Coming Soon</div>
                <div className="empty-state-description">
                  Search results rendering with highlighting and context will be implemented when the backend search API is ready.
                </div>
              </div>
            </div>
          ) : query.trim() ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-title">No Results Found</div>
              <div className="empty-state-description">
                No log entries match your search criteria. Try adjusting your query, filters, or check if the logs are properly indexed.
              </div>
              <div className="empty-state-action">
                <Link to="/settings" className="btn btn-secondary btn-sm">
                  ⚙️ Check Index Status
                </Link>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">💡</div>
              <div className="empty-state-title">Ready to Search</div>
              <div className="empty-state-description">
                Enter a search query above to find log entries. Use the syntax guide to build powerful queries.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
