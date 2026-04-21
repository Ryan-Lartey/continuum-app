import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import ProjectDetail from './ProjectDetail.jsx'

const STAGES = ['All', 'Define', 'Measure', 'Analyse', 'Improve', 'Control', 'Closed']
const STAGE_COLORS = {
  Identify: '#E8820C', Define: '#3B7FDE', Measure: '#7C3AED',
  Analyse: '#DC2626', Improve: '#16A34A', Control: '#059669', Closed: '#6B7280'
}
const METRICS = { uph: 'UPH', accuracy: 'Pick Accuracy', dpmo: 'DPMO', dts: 'DTS' }
const DMAIC = ['Define', 'Measure', 'Analyse', 'Improve', 'Control']

const TYPE_LABELS = ['All', 'Quick Win', 'Yellow Belt', 'Green Belt', 'Black Belt', 'Investigation']
const TYPE_VALUES = { 'Quick Win': 'quick_win', 'Yellow Belt': 'yellow_belt', 'Green Belt': 'green_belt', 'Black Belt': 'black_belt', 'Investigation': 'investigation' }
const TYPE_COLORS = { 'Quick Win': '#16A34A', 'Yellow Belt': '#CA8A04', 'Green Belt': '#15803D', 'Black Belt': '#1E3A5F', 'Investigation': '#e11d48' }

const STAGE_ORDER = ['Define', 'Measure', 'Analyse', 'Improve', 'Control', 'Closed']

export default function ProjectsView({ openProject, onOpenAgent, onOpenPortfolio, onNavigate, demoMode }) {
  const [projects, setProjects]         = useState([])
  const [portfolios, setPortfolios]     = useState([])
  const [filter, setFilter]             = useState('All')
  const [typeFilter, setTypeFilter]     = useState('All')
  const [sortBy, setSortBy]             = useState('updated')
  const [selected, setSelected]         = useState(openProject || null)
  const [search, setSearch]             = useState('')

  useEffect(() => { loadProjects() }, [])
  useEffect(() => {
    if (openProject && !openProject._prefill) setSelected(openProject)
  }, [openProject])

  async function loadProjects() {
    const [ps, pfs] = await Promise.all([
      api.getProjects().catch(() => []),
      api.getPortfolios().catch(() => []),
    ])
    setProjects(ps)
    setPortfolios(pfs)
  }

  async function deleteProject(p, e) {
    e.stopPropagation()
    if (!window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return
    await api.deleteProject(p.id)
    setProjects(prev => prev.filter(x => x.id !== p.id))
    if (selected?.id === p.id) setSelected(null)
  }

  const searchLower = search.toLowerCase()
  const filtered = projects
    .filter(p => filter === 'All' || p.stage === filter)
    .filter(p => typeFilter === 'All' || p.project_type === TYPE_VALUES[typeFilter])
    .filter(p => !search || p.title.toLowerCase().includes(searchLower) || (p.problem_statement || '').toLowerCase().includes(searchLower))
    .slice()
    .sort((a, b) => {
      if (sortBy === 'updated') return new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
      if (sortBy === 'progress') {
        const pa = a.progress != null ? a.progress : STAGE_ORDER.indexOf(a.stage)
        const pb = b.progress != null ? b.progress : STAGE_ORDER.indexOf(b.stage)
        return pb - pa
      }
      if (sortBy === 'name') return (a.title || '').localeCompare(b.title || '')
      return 0
    })

  const activeCount = projects.filter(p => p.stage !== 'Closed').length
  const inputStyle = { background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }

  return (
    <div className="flex gap-5 h-[calc(100vh-48px)] max-w-[1400px]">

      {/* Left: Project list */}
      <div className="w-80 flex-shrink-0 flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>Projects</h1>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>{activeCount} active · {projects.length} total</p>
          </div>
        </div>

        <div className="mb-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="w-full text-xs rounded-xl px-3 py-2 border"
            style={inputStyle} />
        </div>

        <div className="flex gap-1.5 flex-wrap mb-2">
          {STAGES.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              style={filter === s
                ? { background: STAGE_COLORS[s] || '#E8820C', color: 'white' }
                : { background: 'var(--bg-input)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              {s}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 flex-wrap mb-2">
          {TYPE_LABELS.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              style={typeFilter === t
                ? { background: TYPE_COLORS[t] || '#6B7280', color: 'white' }
                : { background: 'var(--bg-input)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end mb-3">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="text-xs rounded-lg px-2 py-1 border"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-2)' }}>
            <option value="updated">Last Updated</option>
            <option value="progress">Progress</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filtered.length === 0 ? (
            <div className="card p-6 text-center">
              <div className="text-3xl mb-2" style={{ color: 'var(--text-3)' }}>◆</div>
              <div className="text-sm mb-1" style={{ color: 'var(--text-2)' }}>{search ? 'No projects found' : 'No projects yet'}</div>
              {!search && (
                <div className="text-xs" style={{ color: 'var(--text-3)' }}>Projects are created from Portfolio → Validation. Log observations on the Floor Walk to start the pipeline.</div>
              )}
            </div>
          ) : filtered.map(p => {
            const color      = STAGE_COLORS[p.stage] || '#6B7280'
            const stageIdx   = DMAIC.indexOf(p.stage)
            const nextAction = p.actions?.find(a => !a.done)
            const doneActs   = p.actions?.filter(a => a.done).length || 0
            const totalActs  = p.actions?.length || 0
            const isSelected = selected?.id === p.id
            const portfolio  = portfolios.find(pf => pf.id === p.portfolio_id)

            return (
              <button key={p.id} onClick={() => setSelected(p)}
                className="w-full text-left rounded-2xl p-3.5 transition-all border-2 group"
                style={{
                  background:  isSelected ? `${color}10` : 'var(--bg-card)',
                  borderColor: isSelected ? color : 'transparent',
                  boxShadow:   isSelected ? `0 0 0 1px ${color}30` : '0 1px 3px rgba(0,0,0,0.2)',
                }}>
                <div className="flex items-start gap-2 mb-2">
                  <span className="font-semibold text-sm flex-1 leading-snug text-left" style={{ color: 'var(--text-1)' }}>{p.title}</span>
                  {p.project_type === 'investigation' && (
                    <span className="text-[10px] flex-shrink-0 font-bold px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(225,29,72,0.12)', color: '#e11d48' }}>🔍</span>
                  )}
                  {p.charter?.escalatedFrom && (
                    <span className="text-[10px] flex-shrink-0 font-bold px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>🔗 Escalated</span>
                  )}
                  <span className="status-pill text-[10px] flex-shrink-0" style={{ background: `${color}18`, color }}>{p.stage}</span>
                </div>

                {portfolio && (
                  <div className="mb-1.5">
                    <span
                      onClick={e => { e.stopPropagation(); onOpenPortfolio?.(portfolio.id) }}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 hover:opacity-70 transition-opacity cursor-pointer"
                      style={{ background: 'rgba(232,130,12,0.12)', color: '#E8820C' }}>
                      ◈ {portfolio.name}
                    </span>
                  </div>
                )}

                <div className="flex gap-0.5 mb-2">
                  {DMAIC.map((s, i) => (
                    <div key={s} className="flex-1 h-1 rounded-full transition-all"
                      style={{ background: i < stageIdx ? '#16A34A' : i === stageIdx ? color : 'rgba(255,255,255,0.08)' }} />
                  ))}
                </div>

                <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-3)' }}>
                  {p.metric_id && <span>{METRICS[p.metric_id] || p.metric_id}</span>}
                  {totalActs > 0 && (
                    <span style={{ color: doneActs === totalActs ? '#4ade80' : 'var(--text-3)' }}>
                      {doneActs}/{totalActs} actions
                    </span>
                  )}
                  {nextAction && (
                    <span className="truncate max-w-[90px]" style={{ color: '#fb923c' }}>→ {nextAction.text}</span>
                  )}
                  <button
                    onClick={(e) => deleteProject(p, e)}
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity px-1 hover:text-red-400"
                    style={{ color: 'var(--text-3)' }}
                    title="Delete project">
                    ✕
                  </button>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right: Project detail */}
      <div className="flex-1 min-w-0 h-full overflow-y-auto">
        {selected ? (
          <ProjectDetail
            key={selected.id}
            project={selected}
            onClose={() => setSelected(null)}
            onProjectUpdated={(updated) => {
              setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))
              setSelected(updated)
            }}
            onOpenPortfolio={onOpenPortfolio}
            onNavigate={onNavigate}
            inline={true}
            demoMode={demoMode}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="text-6xl mb-4" style={{ color: 'var(--text-3)' }}>◆</div>
            <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-2)' }}>Select a project</h2>
            <p className="text-sm max-w-xs" style={{ color: 'var(--text-3)' }}>Choose a project from the list to view its guide, actions, charter, and KPI chart</p>
          </div>
        )}
      </div>

    </div>
  )
}
