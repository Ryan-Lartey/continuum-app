import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api.js'

const WASTE_LABELS = {
  transport: 'Transport', inventory: 'Inventory', motion: 'Motion',
  waiting: 'Waiting', overproduction: 'Overproduction', overprocessing: 'Over-processing',
  defects: 'Defects', skills: 'Skills',
}

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function GlobalSearch({ isOpen, onClose, onNavigate, onOpenProject, onOpenPortfolio }) {
  const [query, setQuery] = useState('')
  const [allProjects, setAllProjects] = useState([])
  const [allPortfolios, setAllPortfolios] = useState([])
  const [allObservations, setAllObservations] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  const debouncedQuery = useDebounce(query, 200)

  // Fetch data when overlay opens
  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setLoading(true)
    Promise.all([
      api.getProjects().catch(() => []),
      api.getPortfolios().catch(() => []),
      api.getObservations().catch(() => []),
    ]).then(([projects, portfolios, observations]) => {
      setAllProjects(projects)
      setAllPortfolios(portfolios)
      setAllObservations(observations)
      setLoading(false)
    })
  }, [isOpen])

  // Auto-focus input
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Esc to close
  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  const q = debouncedQuery.toLowerCase().trim()

  const matchedProjects = q
    ? allProjects.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.problem_statement || '').toLowerCase().includes(q)
      ).slice(0, 5)
    : []

  const matchedPortfolios = q
    ? allPortfolios.filter(pf =>
        (pf.name || '').toLowerCase().includes(q) ||
        (pf.description || '').toLowerCase().includes(q)
      ).slice(0, 5)
    : []

  const matchedObservations = q
    ? allObservations.filter(o =>
        (o.description || '').toLowerCase().includes(q) ||
        (o.waste_type || '').toLowerCase().includes(q)
      ).slice(0, 5)
    : []

  const hasResults = matchedProjects.length + matchedPortfolios.length + matchedObservations.length > 0

  function handleSelectProject(p) {
    if (onOpenProject) onOpenProject(p)
    else if (onNavigate) onNavigate('projects', p)
    onClose()
  }

  function handleSelectPortfolio(pf) {
    if (onOpenPortfolio) onOpenPortfolio(pf.id)
    onClose()
  }

  function handleSelectObservation() {
    if (onNavigate) onNavigate('floor')
    onClose()
  }

  if (!isOpen) return null

  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    zIndex: 300,
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '10vh',
  }

  const cardStyle = {
    background: 'var(--bg-card)',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '560px',
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid var(--border)',
    boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
  }

  const inputStyle = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--text-1)',
    fontSize: '16px',
    padding: '16px 20px',
  }

  const dividerStyle = { borderBottom: '1px solid var(--border)', margin: '0' }

  const sectionLabelStyle = {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.06em',
    color: 'var(--text-3)',
    padding: '10px 16px 4px',
    textTransform: 'uppercase',
  }

  const resultRowStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '8px 16px',
    cursor: 'pointer',
    borderRadius: '8px',
    margin: '0 4px',
    transition: 'background 0.1s',
  }

  const TYPE_MAP = { quick_win: 'Quick Win', yellow_belt: 'Yellow Belt', green_belt: 'Green Belt', black_belt: 'Black Belt' }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={cardStyle} onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 4px' }}>
          <span style={{ paddingLeft: '16px', color: 'var(--text-3)', fontSize: '16px' }}>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search projects, ideas, observations…"
            style={inputStyle}
          />
          {loading && (
            <span style={{ paddingRight: '16px', color: 'var(--text-3)', fontSize: '12px' }}>Loading…</span>
          )}
        </div>
        <div style={dividerStyle} />

        {/* Results */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {!q ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: '14px' }}>
              Type to search…
            </div>
          ) : !hasResults && !loading ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: '14px' }}>
              Nothing found for "{debouncedQuery}"
            </div>
          ) : (
            <>
              {matchedProjects.length > 0 && (
                <div>
                  <div style={sectionLabelStyle}>Projects</div>
                  {matchedProjects.map(p => (
                    <ResultRow
                      key={p.id}
                      title={p.title}
                      subtitle={[p.stage, TYPE_MAP[p.project_type]].filter(Boolean).join(' · ')}
                      accent="#3B7FDE"
                      icon="◆"
                      rowStyle={resultRowStyle}
                      onClick={() => handleSelectProject(p)}
                    />
                  ))}
                </div>
              )}

              {matchedPortfolios.length > 0 && (
                <div>
                  <div style={sectionLabelStyle}>Ideas / Portfolio</div>
                  {matchedPortfolios.map(pf => (
                    <ResultRow
                      key={pf.id}
                      title={pf.name}
                      subtitle={pf.description ? pf.description.slice(0, 60) : ''}
                      accent="#E8820C"
                      icon="◈"
                      rowStyle={resultRowStyle}
                      onClick={() => handleSelectPortfolio(pf)}
                    />
                  ))}
                </div>
              )}

              {matchedObservations.length > 0 && (
                <div>
                  <div style={sectionLabelStyle}>Observations</div>
                  {matchedObservations.map(o => (
                    <ResultRow
                      key={o.id}
                      title={o.description ? o.description.slice(0, 70) : 'Observation'}
                      subtitle={WASTE_LABELS[o.waste_type] || o.waste_type || ''}
                      accent="#7C3AED"
                      icon="●"
                      rowStyle={resultRowStyle}
                      onClick={handleSelectObservation}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div style={{ ...dividerStyle }} />
        <div style={{ padding: '8px 16px', display: 'flex', gap: '12px', color: 'var(--text-3)', fontSize: '11px' }}>
          <span>↵ Select</span>
          <span>Esc Close</span>
          <span style={{ marginLeft: 'auto' }}>Cmd+/ to open</span>
        </div>
      </div>
    </div>
  )
}

function ResultRow({ title, subtitle, accent, icon, rowStyle, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{
        ...rowStyle,
        background: hovered ? `${accent}18` : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: accent, fontSize: '12px', flexShrink: 0 }}>{icon}</span>
        <span style={{ color: 'var(--text-1)', fontSize: '13px', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </span>
      </div>
      {subtitle && (
        <div style={{ color: 'var(--text-3)', fontSize: '11px', paddingLeft: '20px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}
