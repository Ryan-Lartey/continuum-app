import { useState, useEffect } from 'react'
import { api, streamAgent } from '../lib/api.js'

const METRICS = [
  { id: 'uph',      label: 'UPH',      unit: '',  target: 100,  higher: true  },
  { id: 'accuracy', label: 'Accuracy', unit: '%', target: 99.5, higher: true  },
  { id: 'dpmo',     label: 'DPMO',     unit: '',  target: 500,  higher: false },
  { id: 'dts',      label: 'DTS',      unit: '%', target: 98,   higher: true  },
]

const STAGE_COLORS = {
  Identify: '#E8820C', Define: '#3B7FDE', Measure: '#7C3AED',
  Analyse: '#DC2626', Improve: '#16A34A', Control: '#059669', Closed: '#6B7280',
}

const TODAY = new Date().toISOString().split('T')[0]

export default function Tier2View({ onNavigate }) {
  const [latestKpis, setLatestKpis]         = useState({})
  const [projects, setProjects]             = useState([])
  const [tier2Notes, setTier2Notes]         = useState('')
  const [tier2Actions, setTier2Actions]     = useState('')
  const [tier2Saving, setTier2Saving]       = useState(false)
  const [tier2Saved, setTier2Saved]         = useState(false)
  const [tier2Today, setTier2Today]         = useState(null)
  const [tier2GenLoading, setTier2GenLoading] = useState(false)
  const [todayObs, setTodayObs]             = useState(0)
  const [patterns, setPatterns]             = useState([])

  useEffect(() => {
    Promise.all([
      api.getLatestKpis().catch(() => ({})),
      api.getProjects().catch(() => []),
      api.getTier2Today().catch(() => null),
      api.getObservations().catch(() => []),
      api.getPatterns().catch(() => []),
    ]).then(([kpis, ps, t2, obs, pats]) => {
      setLatestKpis(kpis)
      setProjects(ps.filter(p => p.stage !== 'Closed'))
      setTodayObs(obs.filter(o => o.date === TODAY).length)
      setPatterns(pats)
      if (t2) {
        setTier2Today(t2)
        setTier2Notes(t2.notes || '')
        setTier2Actions((t2.actions || []).map(a => a.text || a).join('\n'))
      }
    })
  }, [])

  function generateTier2Prep() {
    if (tier2GenLoading) return
    setTier2GenLoading(true)
    setTier2Notes('')
    const kpiLines = Object.entries(latestKpis).map(([k, v]) => {
      const m = METRICS.find(x => x.id === k)
      const diff = v?.value !== undefined && m ? ((v.value - m.target) / m.target * 100).toFixed(1) : null
      return `${k.toUpperCase()}: ${v?.value ?? '—'} vs target ${v?.target ?? m?.target ?? '—'}${diff !== null ? ` (${diff > 0 ? '+' : ''}${diff}%)` : ''}`
    }).join('\n')
    const projectLines = projects.map(p => {
      const next = (p.actions || []).find(a => !a.done)
      return `- ${p.title} [${p.stage}]${next ? ' — next: ' + next.text : ''}`
    }).join('\n')
    const overdueCount = projects.flatMap(p => (p.actions || []).filter(a => !a.done && a.due && a.due < TODAY)).length
    const prompt = `Write Ryan's Tier 2 meeting talking points. He presents to his ops manager at an Amazon FC.

Data:
KPIs today:
${kpiLines || 'No KPIs logged yet'}

Active projects:
${projectLines || 'None'}

Floor observations today: ${todayObs}
Overdue actions: ${overdueCount}
Waste patterns (48h): ${patterns.map(p => p.waste_type + ' ×' + p.count).join(', ') || 'none'}

Write ONLY the talking points in this format — no intro, no outro:

**KPI Update:** [what's on/off target, use numbers, 1-2 sentences]
**Projects:** [one line per project: what stage, what's the next move]
**Watch points:** [only include if there are real issues — overdue, SPC signals, patterns]

Rules: short sentences, meeting-ready language, use actual numbers. Write it so he can read it aloud.`

    let acc = ''
    streamAgent('chief-of-staff', [{ role: 'user', content: prompt }], null,
      chunk => { acc += chunk; setTier2Notes(acc) },
      () => { setTier2GenLoading(false) },
      () => { setTier2GenLoading(false) }
    )
  }

  async function saveTier2() {
    if (tier2Saving) return
    setTier2Saving(true)
    const actions = tier2Actions.split('\n').filter(Boolean).map(t => ({ text: t.trim(), done: false }))
    const saved = await api.saveTier2({ date: TODAY, notes: tier2Notes, actions }).catch(() => null)
    if (saved) setTier2Today(saved)
    setTier2Saving(false)
    setTier2Saved(true)
    setTimeout(() => setTier2Saved(false), 2000)
  }

  const kpiSummary = METRICS.map(m => {
    const kpi = latestKpis[m.id]
    const val = kpi?.value
    const r   = val !== undefined ? (m.higher ? val / m.target : m.target / val) : null
    const color = r === null ? '#6b7280' : r >= 0.98 ? '#4ade80' : r >= 0.93 ? '#fb923c' : '#f87171'
    const diff  = val !== undefined ? ((val - m.target) / m.target * 100) : null
    return { ...m, val, color, diff }
  })

  const overdueActions = projects.flatMap(p =>
    (p.actions || []).filter(a => !a.done && a.due && a.due < TODAY).map(a => ({ ...a, project: p.title }))
  )

  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-5 max-w-[900px]">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-1)' }}>Before Tier 2</h1>
          <p className="text-sm mt-0.5" style={{ color: tier2Today ? '#4ade80' : '#fb923c' }}>
            {tier2Today ? '✓ Prepped today' : 'Not prepped yet — fill your talking points before the meeting'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={generateTier2Prep} disabled={tier2GenLoading}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50"
            style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
            {tier2GenLoading ? '…generating' : '⚡ Fill with AI'}
          </button>
          <button onClick={saveTier2} disabled={tier2Saving || (!tier2Notes.trim() && !tier2Actions.trim())}
            className="text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-40 transition-all"
            style={{ background: tier2Saved ? 'rgba(74,222,128,0.15)' : 'rgba(232,130,12,0.12)', color: tier2Saved ? '#4ade80' : '#fb923c' }}>
            {tier2Saved ? '✓ Saved' : tier2Saving ? '…' : 'Save'}
          </button>
        </div>
      </div>

      {/* KPI Snapshot */}
      <div className="card p-5">
        <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-3)' }}>KPI Snapshot</div>
        <div className="grid grid-cols-4 gap-4">
          {kpiSummary.map(m => (
            <div key={m.id} className="text-center rounded-xl p-4" style={{ background: 'var(--bg-input)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>{m.label}</div>
              <div className="text-3xl font-bold" style={{ color: m.color }}>{m.val ?? '—'}</div>
              <div className="text-[10px] mt-1.5" style={{ color: m.color }}>
                {m.diff !== null ? `${m.diff > 0 ? '+' : ''}${m.diff.toFixed(1)}% vs target` : `Target ${m.target}${m.unit}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Project Updates */}
      {projects.length > 0 && (
        <div className="card p-5">
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>Project Updates</div>
          <div className="space-y-2">
            {projects.map(p => {
              const color = STAGE_COLORS[p.stage] || '#6B7280'
              const next  = (p.actions || []).find(a => !a.done)
              const done  = (p.actions || []).filter(a => a.done).length
              const total = (p.actions || []).length
              return (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: 'var(--bg-input)' }}>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: `${color}18`, color }}>{p.stage}</span>
                  <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-1)' }}>{p.title}</span>
                  {total > 0 && <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>{done}/{total} tasks</span>}
                  {next && <span className="text-xs truncate max-w-[180px] flex-shrink-0" style={{ color: '#fb923c' }}>→ {next.text}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Talking Points */}
      <div className="card p-5">
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>Talking Points</div>
        <textarea
          value={tier2Notes}
          onChange={e => setTier2Notes(e.target.value)}
          placeholder="What to raise today — KPI status, issues, blockers, wins… (use AI fill to generate from your data)"
          rows={7}
          className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none leading-relaxed"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
      </div>

      {/* Actions from meeting */}
      <div className="card p-5">
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>Actions Agreed in Meeting</div>
        <textarea
          value={tier2Actions}
          onChange={e => setTier2Actions(e.target.value)}
          placeholder="Actions agreed in the meeting — one per line…"
          rows={4}
          className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
        <button onClick={saveTier2} disabled={tier2Saving || (!tier2Notes.trim() && !tier2Actions.trim())}
          className="mt-3 text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-40 transition-all"
          style={{ background: tier2Saved ? 'rgba(74,222,128,0.15)' : 'rgba(232,130,12,0.15)', color: tier2Saved ? '#4ade80' : '#fb923c' }}>
          {tier2Saved ? '✓ Saved' : tier2Saving ? '…' : 'Save Tier 2 Notes'}
        </button>
      </div>

      {/* Overdue warning */}
      {overdueActions.length > 0 && (
        <div className="card p-5 border" style={{ borderColor: 'rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.04)' }}>
          <div className="text-xs font-bold mb-3" style={{ color: '#f87171' }}>
            ⚠ {overdueActions.length} overdue action{overdueActions.length > 1 ? 's' : ''} — worth raising in Tier 2
          </div>
          <div className="space-y-1.5">
            {overdueActions.map((a, i) => (
              <div key={i} className="text-sm flex items-center gap-2 flex-wrap">
                <span style={{ color: 'var(--text-3)' }}>{a.project}:</span>
                <span style={{ color: 'var(--text-2)' }}>{a.text}</span>
                <span style={{ color: '#f87171' }}>Due {a.due}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
