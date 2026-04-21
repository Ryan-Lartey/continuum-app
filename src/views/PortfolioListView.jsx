import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'

const AREAS = ['All', 'Inbound', 'Stow', 'Pick', 'Pack', 'Dispatch', 'Yard', 'Admin']
const KPI_LABELS = { uph: 'UPH', accuracy: 'Pick Accuracy', dpmo: 'DPMO', dts: 'DTS', custom: 'Custom' }
const AREA_COLORS = {
  Pick: '#E8820C', Pack: '#3B7FDE', Inbound: '#7C3AED', Stow: '#16A34A',
  Dispatch: '#DC2626', Yard: '#0891B2', Admin: '#6B7280', All: '#6B7280',
}

export default function PortfolioListView({ onOpenPortfolio }) {
  const [portfolios, setPortfolios]   = useState([])
  const [summaries, setSummaries]     = useState({})
  const [tab, setTab]                 = useState('active')
  const [showNew, setShowNew]         = useState(false)
  const [creating, setCreating]       = useState(false)
  const [menuOpen, setMenuOpen]       = useState(null)
  const [form, setForm]               = useState({
    name: '', strategic_objective: '', primary_kpi: 'uph',
    impact_goal: '', impact_unit: 'UPH improvement', area_focus: 'All',
  })

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!menuOpen) return
    const close = () => setMenuOpen(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menuOpen])

  async function load() {
    const ps = await api.getPortfolios().catch(() => [])
    setPortfolios(ps)
    for (const p of ps) {
      api.getPortfolioSummary(p.id).then(s => setSummaries(prev => ({ ...prev, [p.id]: s }))).catch(() => {})
    }
  }

  async function archivePortfolio(id) {
    await api.updatePortfolio(id, { status: 'archived' }).catch(() => {})
    setPortfolios(prev => prev.map(p => p.id === id ? { ...p, status: 'archived' } : p))
    setMenuOpen(null)
  }

  async function unarchivePortfolio(id) {
    await api.updatePortfolio(id, { status: 'active' }).catch(() => {})
    setPortfolios(prev => prev.map(p => p.id === id ? { ...p, status: 'active' } : p))
    setMenuOpen(null)
  }

  async function deletePortfolio(id) {
    if (!window.confirm('Delete this portfolio and all its ideas? This cannot be undone.')) return
    await api.deletePortfolio(id).catch(() => {})
    setPortfolios(prev => prev.filter(p => p.id !== id))
    setMenuOpen(null)
  }

  async function create(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setCreating(true)
    try {
      const p = await api.createPortfolio({ ...form, impact_goal: form.impact_goal ? parseFloat(form.impact_goal) : 0 })
      setPortfolios(prev => [p, ...prev])
      setShowNew(false)
      setForm({ name: '', strategic_objective: '', primary_kpi: 'uph', impact_goal: '', impact_unit: 'UPH improvement', area_focus: 'All' })
      onOpenPortfolio(p)
    } finally { setCreating(false) }
  }

  const shown = portfolios.filter(p => tab === 'active' ? p.status === 'active' : p.status === 'archived')
  const inputStyle = { background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }

  // Aggregate stats across all active portfolios
  const allSummaries = Object.values(summaries)
  const totalIdeas    = allSummaries.reduce((n, s) => n + (s?.ideaCount || 0), 0)
  const totalScoping  = allSummaries.reduce((n, s) => n + (s?.definitionCount || 0) + (s?.validationCount || 0), 0)
  const totalActive   = allSummaries.reduce((n, s) => n + (s?.assignedCount || 0), 0)
  const totalDoneAll  = allSummaries.reduce((n, s) => n + (s?.finishedCount || 0), 0)
  const totalPending  = allSummaries.reduce((n, s) => n + (s?.pendingIdeas || 0), 0)
  const activePortfolios = portfolios.filter(p => p.status === 'active')

  return (
    <div className="flex gap-6 max-w-[1400px]">

      {/* ── Left: portfolio list ── */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)', letterSpacing: '-0.03em' }}>Portfolio</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
              CI improvement pipelines — from raw idea to finished project
            </p>
          </div>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}>
            + Add Portfolio
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-5 border-b" style={{ borderColor: 'var(--border)' }}>
          {[['active', 'Active'], ['archived', 'Archived']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className="px-4 py-2 text-sm font-medium relative"
              style={{
                color: tab === id ? 'var(--text-1)' : 'var(--text-3)',
                borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1,
              }}>
              {label}
              {id === 'active' && activePortfolios.length > 0 && (
                <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(249,115,22,0.12)', color: 'var(--accent)' }}>
                  {activePortfolios.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Portfolio cards */}
        {shown.length === 0 ? (
          <div className="card p-14 text-center">
            <div className="text-base font-semibold mb-2" style={{ color: 'var(--text-2)' }}>No portfolios yet</div>
            <p className="text-sm mb-5" style={{ color: 'var(--text-3)' }}>
              A portfolio groups CI projects under one strategic objective.<br />
              Create one per area — e.g. Pick Efficiency, Quality, Safety.
            </p>
            <button onClick={() => setShowNew(true)}
              className="px-5 py-2.5 rounded text-sm font-semibold text-white"
              style={{ background: 'var(--accent)' }}>
              Create your first portfolio →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {shown.map(p => {
              const s = summaries[p.id]
              const areaColor = AREA_COLORS[p.area_focus] || '#6B7280'
              const totalAll = s ? s.totalIdeas : 0
              const pct = totalAll > 0 ? Math.round(((s?.finishedCount || 0) / totalAll) * 100) : 0

              return (
                <div key={p.id} className="card cursor-pointer group relative"
                  style={{ transition: 'border-color 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = `${areaColor}40`}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  onClick={() => { if (menuOpen === p.id) return; onOpenPortfolio(p) }}>
                  <div className="flex items-center gap-4 px-4 py-3.5">
                    {/* Progress ring */}
                    <div className="flex-shrink-0 relative w-9 h-9">
                      <svg viewBox="0 0 36 36" className="w-9 h-9 -rotate-90">
                        <circle cx="18" cy="18" r="13" fill="none" strokeWidth="2.5" stroke="var(--bg-input)" />
                        <circle cx="18" cy="18" r="13" fill="none" strokeWidth="2.5"
                          stroke={areaColor} strokeLinecap="round"
                          strokeDasharray={`${pct * 0.817} 81.7`} />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span style={{ fontSize: 8, fontWeight: 700, color: areaColor }}>{pct}%</span>
                      </div>
                    </div>

                    {/* Name + tags */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{p.name}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: `${areaColor}15`, color: areaColor }}>
                          {p.area_focus}
                        </span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
                          {KPI_LABELS[p.primary_kpi] || p.primary_kpi}
                        </span>
                      </div>
                      {/* Pipeline bar */}
                      {s ? (
                        <div className="flex items-center gap-3">
                          {[
                            ['Ideas', s.ideaCount, 'var(--text-3)'],
                            ['Scoping', s.definitionCount + s.validationCount, '#8b5cf6'],
                            ['Active', s.assignedCount, '#16a34a'],
                            ['Done', s.finishedCount, '#4ade80'],
                          ].map(([label, count, color]) => (
                            <span key={label} className="text-xs" style={{ color: count > 0 ? color : 'var(--text-3)' }}>
                              {count} {label}
                            </span>
                          ))}
                          {s.pendingIdeas > 0 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--accent)' }}>
                              {s.pendingIdeas} pending review
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="h-2 w-32 rounded animate-pulse" style={{ background: 'var(--bg-input)' }} />
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--accent)' }}>Open →</span>
                      <div className="relative" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)}
                          className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-100"
                          style={{ color: 'var(--text-3)', background: 'var(--bg-input)' }}
                          title="Options">
                          ⋯
                        </button>
                        {menuOpen === p.id && (
                          <div className="absolute right-0 top-8 z-20 w-36 rounded-xl shadow-xl border overflow-hidden"
                            style={{ background: 'var(--bg-card)', borderColor: 'var(--border2)' }}>
                            {tab === 'active' ? (
                              <button onClick={() => archivePortfolio(p.id)}
                                className="w-full text-left px-3 py-2.5 text-xs font-medium hover:opacity-80 flex items-center gap-2"
                                style={{ color: 'var(--text-2)' }}>
                                📦 Archive
                              </button>
                            ) : (
                              <button onClick={() => unarchivePortfolio(p.id)}
                                className="w-full text-left px-3 py-2.5 text-xs font-medium hover:opacity-80 flex items-center gap-2"
                                style={{ color: 'var(--text-2)' }}>
                                ↩ Restore
                              </button>
                            )}
                            <div style={{ height: 1, background: 'var(--border)' }} />
                            <button onClick={() => deletePortfolio(p.id)}
                              className="w-full text-left px-3 py-2.5 text-xs font-medium hover:opacity-80 flex items-center gap-2"
                              style={{ color: '#f87171' }}>
                              🗑 Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Right: pipeline summary ── */}
      {activePortfolios.length > 0 && (
        <div className="w-64 flex-shrink-0 space-y-3 pt-14">

          {/* Pipeline funnel */}
          <div className="card p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-4"
              style={{ color: 'var(--text-3)', letterSpacing: '0.08em' }}>Pipeline</div>
            <div className="space-y-2.5">
              {[
                { label: 'Pending Review', value: totalPending,  color: 'var(--accent)' },
                { label: 'Scoping',        value: totalScoping,  color: '#8b5cf6' },
                { label: 'Active Projects',value: totalActive,   color: '#16a34a' },
                { label: 'Completed',      value: totalDoneAll,  color: '#4ade80' },
              ].map(({ label, value, color }) => {
                const maxVal = Math.max(totalPending, totalScoping, totalActive, totalDoneAll, 1)
                const barW = Math.round((value / maxVal) * 100)
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>{label}</span>
                      <span className="text-xs font-semibold tabular-nums" style={{ color: value > 0 ? color : 'var(--text-3)' }}>{value}</span>
                    </div>
                    <div className="h-1 rounded-full" style={{ background: 'var(--bg-input)' }}>
                      <div className="h-1 rounded-full transition-all duration-500"
                        style={{ width: `${barW}%`, background: value > 0 ? color : 'transparent' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Portfolios breakdown */}
          <div className="card p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-3)', letterSpacing: '0.08em' }}>By Portfolio</div>
            <div className="space-y-2">
              {activePortfolios.map(p => {
                const s = summaries[p.id]
                const areaColor = AREA_COLORS[p.area_focus] || '#6B7280'
                const total = s?.totalIdeas || 0
                const done  = s?.finishedCount || 0
                const pct   = total > 0 ? Math.round((done / total) * 100) : 0
                return (
                  <button key={p.id} onClick={() => onOpenPortfolio(p)}
                    className="w-full text-left hover:opacity-80 transition-opacity">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs truncate" style={{ color: 'var(--text-2)', maxWidth: 140 }}>{p.name}</span>
                      <span className="text-[10px] font-semibold tabular-nums" style={{ color: areaColor }}>{pct}%</span>
                    </div>
                    <div className="h-0.5 rounded-full" style={{ background: 'var(--bg-input)' }}>
                      <div className="h-0.5 rounded-full" style={{ width: `${pct}%`, background: areaColor }} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="card p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-3)', letterSpacing: '0.08em' }}>Total Ideas</div>
            <div className="text-3xl font-bold" style={{ color: 'var(--text-1)', letterSpacing: '-0.04em' }}>
              {allSummaries.reduce((n, s) => n + (s?.totalIdeas || 0), 0)}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              across {activePortfolios.length} portfolio{activePortfolios.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}

      {/* New Portfolio Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="w-full max-w-lg rounded-3xl p-6 shadow-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-xl" style={{ color: 'var(--text-1)' }}>New Portfolio</h3>
              <button onClick={() => setShowNew(false)} className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'var(--bg-input)', color: 'var(--text-2)' }}>✕</button>
            </div>

            <form onSubmit={create} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-3)' }}>Portfolio Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Pick Efficiency FY2026" required
                  className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle} />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-3)' }}>Strategic Objective</label>
                <textarea value={form.strategic_objective} onChange={e => setForm(f => ({ ...f, strategic_objective: e.target.value }))}
                  placeholder="e.g. Increase UPH across all Pick zones from an average of 80 to 100 by end of FY2026"
                  rows={2} className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none" style={inputStyle} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-3)' }}>Primary KPI</label>
                  <select value={form.primary_kpi} onChange={e => setForm(f => ({ ...f, primary_kpi: e.target.value }))}
                    className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle}>
                    <option value="uph">UPH</option>
                    <option value="accuracy">Pick Accuracy</option>
                    <option value="dpmo">DPMO</option>
                    <option value="dts">DTS</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-3)' }}>Area Focus</label>
                  <select value={form.area_focus} onChange={e => setForm(f => ({ ...f, area_focus: e.target.value }))}
                    className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle}>
                    {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-3)' }}>Impact Goal</label>
                  <input value={form.impact_goal} onChange={e => setForm(f => ({ ...f, impact_goal: e.target.value }))}
                    type="number" step="any" placeholder="e.g. 20"
                    className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle} />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-3)' }}>Unit</label>
                  <input value={form.impact_unit} onChange={e => setForm(f => ({ ...f, impact_unit: e.target.value }))}
                    placeholder="e.g. UPH improvement"
                    className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle} />
                </div>
              </div>

              <button type="submit" disabled={!form.name.trim() || creating}
                className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-40 mt-2"
                style={{ background: '#E8820C' }}>
                {creating ? 'Creating…' : 'CREATE PORTFOLIO →'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
