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
    <div style={{ display: 'flex', gap: 24, maxWidth: 1400 }}>

      {/* ── Left: portfolio list ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em', margin: 0 }}>Portfolio</h1>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '4px 0 0' }}>
              CI improvement pipelines — from raw idea to finished project
            </p>
          </div>
          <button onClick={() => setShowNew(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 12,
              background: 'linear-gradient(135deg, #F97316 0%, #E8820C 100%)',
              boxShadow: '0 4px 20px rgba(249,115,22,0.32)',
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
            + Add Portfolio
          </button>
        </div>

        {/* Hero summary bar */}
        {portfolios.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Portfolios', value: activePortfolios.length, color: '#E8820C' },
              { label: 'Total Ideas', value: totalIdeas, color: '#3B7FDE' },
              { label: 'Active Projects', value: totalActive, color: '#16A34A' },
              { label: 'Completed', value: totalDoneAll, color: '#a78bfa' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12,
                padding: '12px 16px',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', marginBottom: 4 }}>{label}</div>
                <div style={{
                  fontSize: 28, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em',
                  background: `linear-gradient(135deg, #ffffff 0%, ${color} 100%)`,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
          {[['active', 'Active'], ['archived', 'Archived']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 600,
                color: tab === id ? 'var(--text-1)' : 'var(--text-3)',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1,
              }}>
              {label}
              {id === 'active' && activePortfolios.length > 0 && (
                <span style={{
                  marginLeft: 7, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999,
                  background: 'rgba(249,115,22,0.12)', color: 'var(--accent)',
                }}>
                  {activePortfolios.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Portfolio cards */}
        {shown.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '56px 32px',
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px dashed rgba(255,255,255,0.1)',
            borderRadius: 16,
          }}>
            <div style={{ fontSize: 32, opacity: 0.2, marginBottom: 12 }}>◈</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>No portfolios yet</div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, maxWidth: 360, margin: '0 auto 20px' }}>
              A portfolio groups CI projects under one strategic objective.<br />
              Create one per area — e.g. Pick Efficiency, Quality, Safety.
            </p>
            <button onClick={() => setShowNew(true)}
              style={{
                padding: '10px 24px', borderRadius: 12,
                background: 'linear-gradient(135deg, #F97316 0%, #E8820C 100%)',
                border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(249,115,22,0.3)',
              }}>
              Create your first portfolio →
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {shown.map(p => {
              const s = summaries[p.id]
              const areaColor = AREA_COLORS[p.area_focus] || '#6B7280'
              const totalAll = s ? s.totalIdeas : 0
              const pct = totalAll > 0 ? Math.round(((s?.finishedCount || 0) / totalAll) * 100) : 0

              return (
                <div key={p.id}
                  onClick={() => { if (menuOpen === p.id) return; onOpenPortfolio(p) }}
                  style={{
                    position: 'relative',
                    background: 'rgba(255,255,255,0.04)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderTop: `3px solid ${areaColor}`,
                    borderRadius: 14,
                    padding: 18,
                    cursor: 'pointer',
                    transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-3px)'
                    e.currentTarget.style.boxShadow = `0 12px 36px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)`
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {/* Top row: tags + ring */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                        background: `${areaColor}18`, color: areaColor,
                        border: `1px solid ${areaColor}30`,
                      }}>{p.area_focus}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 999,
                        background: 'rgba(255,255,255,0.06)', color: '#64748B',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}>{KPI_LABELS[p.primary_kpi] || p.primary_kpi}</span>
                    </div>
                    {/* Progress ring */}
                    <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                      <svg viewBox="0 0 44 44" style={{ width: 44, height: 44, transform: 'rotate(-90deg)' }}>
                        <circle cx="22" cy="22" r="16" fill="none" strokeWidth="3" stroke="rgba(255,255,255,0.06)" />
                        <circle cx="22" cy="22" r="16" fill="none" strokeWidth="3"
                          stroke={areaColor} strokeLinecap="round"
                          strokeDasharray={`${(pct / 100) * 100.53} 100.53`} />
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: areaColor }}>{pct}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Name */}
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                    {p.name}
                  </div>

                  {/* Strategic objective */}
                  {p.strategic_objective && (
                    <div style={{
                      fontSize: 11, color: '#64748B', marginBottom: 12, lineHeight: 1.5,
                      overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      {p.strategic_objective}
                    </div>
                  )}

                  {/* Pipeline pills */}
                  {s ? (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: p.strategic_objective ? 0 : 12 }}>
                      {[
                        ['Ideas', s.ideaCount, '#64748B'],
                        ['Scoping', (s.definitionCount || 0) + (s.validationCount || 0), '#8b5cf6'],
                        ['Active', s.assignedCount, '#16A34A'],
                        ['Done', s.finishedCount, '#4ade80'],
                      ].map(([label, count, color]) => (
                        <div key={label} style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: 10, fontWeight: 600,
                          padding: '3px 8px', borderRadius: 999,
                          background: count > 0 ? `${color}14` : 'rgba(255,255,255,0.04)',
                          color: count > 0 ? color : '#374151',
                          border: `1px solid ${count > 0 ? color + '25' : 'rgba(255,255,255,0.06)'}`,
                        }}>
                          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>{count}</span>
                          <span style={{ opacity: 0.8 }}>{label}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ height: 24, width: 180, borderRadius: 999, background: 'rgba(255,255,255,0.06)' }} />
                  )}

                  {/* Footer: pending badge + context menu */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    {s?.pendingIdeas > 0 ? (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                        background: 'rgba(249,115,22,0.12)', color: '#F97316',
                        border: '1px solid rgba(249,115,22,0.2)',
                      }}>
                        {s.pendingIdeas} pending review
                      </span>
                    ) : <span />}
                    <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)}
                        style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: '#64748B', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16, lineHeight: 1,
                        }}
                        title="Options">
                        ⋯
                      </button>
                      {menuOpen === p.id && (
                        <div style={{
                          position: 'absolute', right: 0, top: 34, zIndex: 20,
                          width: 144, borderRadius: 12,
                          background: 'rgba(22,26,38,0.96)',
                          backdropFilter: 'blur(20px)',
                          WebkitBackdropFilter: 'blur(20px)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                          overflow: 'hidden',
                        }}>
                          {tab === 'active' ? (
                            <button onClick={() => archivePortfolio(p.id)}
                              style={{ width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 12, fontWeight: 500, background: 'none', border: 'none', color: '#CBD5E1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                              📦 Archive
                            </button>
                          ) : (
                            <button onClick={() => unarchivePortfolio(p.id)}
                              style={{ width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 12, fontWeight: 500, background: 'none', border: 'none', color: '#CBD5E1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                              ↩ Restore
                            </button>
                          )}
                          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />
                          <button onClick={() => deletePortfolio(p.id)}
                            style={{ width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 12, fontWeight: 500, background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                            🗑 Delete
                          </button>
                        </div>
                      )}
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
        <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Pipeline funnel */}
          <div style={{
            background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 16,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', marginBottom: 14 }}>Pipeline</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Pending Review', value: totalPending, color: '#F97316' },
                { label: 'Scoping', value: totalScoping, color: '#8b5cf6' },
                { label: 'Active Projects', value: totalActive, color: '#16A34A' },
                { label: 'Completed', value: totalDoneAll, color: '#4ade80' },
              ].map(({ label, value, color }) => {
                const maxVal = Math.max(totalPending, totalScoping, totalActive, totalDoneAll, 1)
                const barW = Math.round((value / maxVal) * 100)
                return (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>{label}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: value > 0 ? color : '#475569', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 999, width: `${barW}%`, background: value > 0 ? color : 'transparent', transition: 'width 600ms cubic-bezier(0.34,1.56,0.64,1)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* By Portfolio */}
          <div style={{
            background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 16,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', marginBottom: 12 }}>By Portfolio</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activePortfolios.map(p => {
                const s = summaries[p.id]
                const areaColor = AREA_COLORS[p.area_focus] || '#6B7280'
                const total = s?.totalIdeas || 0
                const done = s?.finishedCount || 0
                const pct = total > 0 ? Math.round((done / total) * 100) : 0
                return (
                  <button key={p.id} onClick={() => onOpenPortfolio(p)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: '#94A3B8', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: areaColor, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: areaColor }} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Total Ideas */}
          <div style={{
            background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 16,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', marginBottom: 8 }}>Total Ideas</div>
            <div style={{
              fontSize: 36, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1,
              background: 'linear-gradient(135deg, #ffffff 0%, #3B7FDE 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              {allSummaries.reduce((n, s) => n + (s?.totalIdeas || 0), 0)}
            </div>
            <div style={{ fontSize: 11, marginTop: 4, color: '#64748B' }}>
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
