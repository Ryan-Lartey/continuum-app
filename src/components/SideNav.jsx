import { useState, useEffect, useRef } from 'react'
import { api, streamAgent } from '../lib/api.js'
import PresentationHotspot from './PresentationHotspot.jsx'
import {
  LayoutDashboard, Activity, Target, Kanban,
  TrendingUp, FileBarChart, GitFork,
} from 'lucide-react'

const NAV = [
  { id: 'home',          Icon: LayoutDashboard, label: 'Dashboard'     },
  { id: 'floor',         Icon: Activity,        label: 'Floor Walk'    },
  { id: 'projects',      Icon: Target,          label: 'Projects'      },
  { id: 'portfolio',     Icon: Kanban,          label: 'Portfolio'     },
  { id: 'data',          Icon: TrendingUp,      label: 'Data'          },
  { id: 'reports',       Icon: FileBarChart,    label: 'Reports'       },
  { id: 'process-maps',  Icon: GitFork,         label: 'Process Maps'  },
]

const AREAS = ['Inbound', 'Stow', 'Pick', 'Pack', 'Dispatch', 'Yard', 'Admin']
const WASTE_TYPES = ['Transport', 'Inventory', 'Motion', 'Waiting', 'Overproduction', 'Overprocessing', 'Defects', 'Skills']

function routeInput(text) {
  const t = text.toLowerCase()
  // KPI patterns — must have metric keyword AND a number
  if (/uph|accuracy|dpmo|dts/.test(t) && /\d/.test(t)) return 'kpi'
  // Observation patterns — area or waste type mentioned
  if (AREAS.some(a => t.includes(a.toLowerCase())) || WASTE_TYPES.some(w => t.includes(w.toLowerCase()))) return 'observation'
  // Meeting/Tier patterns
  if (/tier\s*[23]|meeting|brief|prep|stand.?up|handover/.test(t)) return 'situation-room'
  // Report patterns
  if (/report|gm\s*report|weekly|summary|present/.test(t)) return 'gm-report'
  // Project/DMAIC patterns
  if (/project|dmaic|root.?cause|5.?why|countermeasure|charter|baseline|improve|solve|problem|investigation|investigate/.test(t)) return 'project-agent'
  // Simple factual questions — answer inline without opening agent panel
  if (/^(what|how many|show me|list|count|when).{0,60}\?/.test(t)) return 'inline'
  return 'chief-of-staff'
}

function parseKpiInput(text) {
  const today = new Date().toISOString().split('T')[0]
  const patterns = [
    { id: 'uph',      regex: /uph[\s:]+(\d+(?:\.\d+)?)/i },
    { id: 'accuracy', regex: /(?:acc(?:uracy)?|pick acc(?:uracy)?)[\s:]+(\d+(?:\.\d+)?)/i },
    { id: 'dpmo',     regex: /dpmo[\s:]+(\d+(?:\.\d+)?)/i },
    { id: 'dts',      regex: /dts[\s:]+(\d+(?:\.\d+)?)/i },
  ]
  return patterns.flatMap(p => {
    const m = text.match(p.regex)
    return m ? [{ metric_id: p.id, value: parseFloat(m[1]), date: today }] : []
  })
}

const DEFAULT_TARGETS = { UPH: 100, Accuracy: 99.5, DPMO: 500, DTS: 98 }

export default function SideNav({ active, onChange, onOpenAgent, onKpiLogged, onObsLogged, signals = [], demoMode = false, onToggleDemo }) {
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [tip, setTip]                 = useState(null)
  const [latestKpis, setLatestKpis]   = useState({})
  const [showKnowledge, setShowKnowledge] = useState(false)
  const [noteInput, setNoteInput]     = useState('')
  const [siteNotes, setSiteNotes]     = useState('')
  const [noteSaving, setNoteSaving]   = useState(false)
  const [cmdHistory, setCmdHistory]   = useState([])
  const [historyIdx, setHistoryIdx]   = useState(-1)
  const [inlineRoute, setInlineRoute] = useState(null)
  const inputRef = useRef(null)

  // Settings modal state
  const [showSettings, setShowSettings] = useState(false)
  const [settingsSiteName, setSettingsSiteName] = useState('Amazon FC')
  const [settingsShift, setSettingsShift] = useState('Day')
  const [settingsTargets, setSettingsTargets] = useState(DEFAULT_TARGETS)
  const [settingsSaving, setSettingsSaving] = useState(false)

  useEffect(() => {
    api.getLatestKpis().then(setLatestKpis).catch(() => {})
    api.getSite().then(s => {
      setSiteNotes(s.site_notes || '')
      setSettingsSiteName(s.site_name || 'Amazon FC')
      setSettingsShift(s.shift_pattern || 'Day')
      setSettingsTargets(s.kpi_targets || DEFAULT_TARGETS)
    }).catch(() => {})
    const interval = setInterval(() => {
      api.getLatestKpis().then(setLatestKpis).catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Cmd+K / Ctrl+K global shortcut to focus command input
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function pushHistory(text) {
    setCmdHistory(prev => {
      const deduped = prev.filter(h => h !== text)
      return [text, ...deduped].slice(0, 20)
    })
    setHistoryIdx(-1)
  }

  function handleInputKeyDown(e) {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHistoryIdx(prev => {
        const next = Math.min(prev + 1, cmdHistory.length - 1)
        setInput(cmdHistory[next] ?? '')
        return next
      })
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHistoryIdx(prev => {
        const next = Math.max(prev - 1, -1)
        setInput(next === -1 ? '' : cmdHistory[next])
        return next
      })
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    const route = routeInput(text)
    setInput('')
    setHistoryIdx(-1)

    if (route === 'kpi') {
      const entries = parseKpiInput(text)
      if (!entries.length) { onOpenAgent('chief-of-staff', text); pushHistory(text); return }
      setLoading(true)
      try {
        const results = await Promise.all(entries.map(e => api.addKpi(e)))
        const hasSignal = results.some(r => r.signal)
        setTip({ type: hasSignal ? 'warn' : 'ok', text: hasSignal ? `Signal detected on ${results[0].metric_label}` : `${entries.length} KPI${entries.length > 1 ? 's' : ''} logged` })
        onKpiLogged?.(results)
        api.getLatestKpis().then(setLatestKpis).catch(() => {})
        pushHistory(text)
      } finally { setLoading(false) }
      return
    }
    if (route === 'observation') {
      const area  = AREAS.find(a => text.toLowerCase().includes(a.toLowerCase())) || 'Pick'
      const waste = WASTE_TYPES.find(w => text.toLowerCase().includes(w.toLowerCase())) || 'Waiting'
      const today = new Date().toISOString().split('T')[0]
      setLoading(true)
      try {
        const result = await api.addObservation({ area, waste_type: waste, severity: 2, text, date: today })
        setTip({ type: result.patternCount >= 3 ? 'warn' : 'ok', text: result.patternCount >= 3 ? `Pattern: ${waste} ×${result.patternCount} this week` : `Observation logged — ${area}` })
        onObsLogged?.(result)
        pushHistory(text)
      } finally { setLoading(false) }
      return
    }
    if (route === 'inline') {
      setLoading(true)
      setInlineRoute('inline')
      setTip({ type: 'info', text: '' })
      let accumulated = ''
      streamAgent(
        'chief-of-staff',
        [{ role: 'user', content: text }],
        null,
        (chunk) => { accumulated += chunk; setTip({ type: 'info', text: accumulated }) },
        () => { setLoading(false); setInlineRoute(null) },
        () => { setLoading(false); setInlineRoute(null); setTip({ type: 'warn', text: 'Error fetching response.' }) }
      )
      pushHistory(text)
      return
    }
    onOpenAgent(route, text)
    setTip(null)
    pushHistory(text)
  }

  const METRIC_LABELS  = { uph: 'UPH', accuracy: 'ACC', dpmo: 'DPMO', dts: 'DTS' }
  const METRIC_TARGETS = { uph: 100, accuracy: 99.5, dpmo: 500, dts: 98 }
  const HIGHER_BETTER  = { uph: true, accuracy: true, dpmo: false, dts: true }

  return (
    <aside className="w-52 flex-shrink-0 flex flex-col h-screen sticky top-0 border-r"
      style={{ background: 'var(--bg-nav)', borderColor: 'var(--border)' }}>

      {/* ── Logo ── */}
      <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1L11 4V8L6 11L1 8V4L6 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <circle cx="6" cy="6" r="1.5" fill="white"/>
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Continuum</div>
            <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>CI Management</div>
          </div>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="px-2 py-3 space-y-0.5 flex-shrink-0">
        {NAV.map(({ id, Icon, label }) => {
          const isActive  = active === id
          const hasSignal = id === 'data' && signals.length > 0
          return (
            <button key={id} onClick={() => onChange(id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-left relative"
              style={{
                background: isActive ? 'rgba(249,115,22,0.08)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-2)',
              }}>
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full"
                  style={{ background: 'var(--accent)' }} />
              )}
              <Icon size={14} strokeWidth={isActive ? 2 : 1.75} />
              <span className="text-xs font-medium flex-1">{label}</span>
              {hasSignal && (
                <span className="signal-dot flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 relative z-10 block" />
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* ── KPI strip ── */}
      <div className="mx-2 mt-1 mb-2 rounded px-3 py-2.5"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
        <div className="text-[10px] font-semibold uppercase tracking-widest mb-2.5"
          style={{ color: 'var(--text-3)', letterSpacing: '0.08em' }}>Live KPIs</div>
        <div className="space-y-1.5">
          {['uph', 'accuracy', 'dpmo', 'dts'].map(m => {
            const d      = latestKpis[m]
            const val    = d?.value
            const target = METRIC_TARGETS[m]
            const higher = HIGHER_BETTER[m]
            let rag = 'grey'
            if (val !== undefined) {
              const ratio = higher ? val / target : target / val
              rag = ratio >= 0.98 ? 'green' : ratio >= 0.93 ? 'amber' : 'red'
            }
            const ragColor = { green: '#4ade80', amber: '#fb923c', red: '#f87171', grey: '#3f3f46' }[rag]
            return (
              <div key={m} className="flex items-center justify-between">
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{METRIC_LABELS[m]}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: ragColor, fontVariantNumeric: 'tabular-nums' }}>
                  {val !== undefined ? val.toLocaleString() : '—'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex-1" />

      {/* ── Command input ── */}
      <div className="px-2 pb-4 space-y-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
        {tip && (
          <div className="text-[10px] leading-relaxed rounded px-2.5 py-1.5 flex items-start gap-1.5"
            style={{
              background: tip.type === 'warn' ? 'rgba(249,115,22,0.08)' : tip.type === 'info' ? 'rgba(96,165,250,0.07)' : 'rgba(74,222,128,0.07)',
              color: tip.type === 'warn' ? '#fb923c' : tip.type === 'info' ? '#93c5fd' : '#4ade80',
              border: `1px solid ${tip.type === 'warn' ? 'rgba(249,115,22,0.2)' : tip.type === 'info' ? 'rgba(96,165,250,0.15)' : 'rgba(74,222,128,0.15)'}`,
            }}>
            <span className="flex-1">{tip.text || (loading && tip.type === 'info' ? 'Thinking…' : '')}</span>
            <button onClick={() => setTip(null)} className="opacity-40 hover:opacity-80 flex-shrink-0 text-xs">✕</button>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 rounded px-3 py-2 border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', position: 'relative' }}>
            <PresentationHotspot id="sidenav-ai" demoMode={demoMode} />
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
              <circle cx="4" cy="4" r="3" stroke="currentColor" strokeWidth="1.25"/>
              <path d="M7 7L9 9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
            </svg>
            <input value={input} onChange={e => setInput(e.target.value)}
              placeholder={loading ? 'Processing…' : 'Ask anything…'}
              disabled={loading}
              className="flex-1 text-xs bg-transparent min-w-0"
              style={{ color: 'var(--text-1)', outline: 'none', border: 'none', boxShadow: 'none' }}
            />
            {input.trim() && (
              <button type="submit"
                className="w-4 h-4 rounded flex items-center justify-center text-white flex-shrink-0"
                style={{ background: 'var(--accent)', fontSize: 9 }}>↑</button>
            )}
          </div>
        </form>

        <div className="flex items-center gap-2 px-1 pt-0.5">
          <div className="w-5 h-5 rounded flex items-center justify-center text-white flex-shrink-0"
            style={{ background: 'var(--accent)', fontSize: 9, fontWeight: 700 }}>R</div>
          <div className="text-[10px] truncate flex-1" style={{ color: 'var(--text-3)' }}>Ryan · Amazon FC</div>
          <button onClick={() => setShowKnowledge(true)}
            title="Site Knowledge"
            className="flex-shrink-0 text-[10px] hover:opacity-80"
            style={{ color: 'var(--text-3)' }}>◈</button>
          <button onClick={() => setShowSettings(true)}
            title="Settings"
            className="flex-shrink-0 text-[10px] hover:opacity-80"
            style={{ color: 'var(--text-3)' }}>⚙</button>
          <button
            onClick={() => {
              if (demoMode || window.confirm('Switching to demo mode will reload the app. Continue?')) {
                onToggleDemo?.()
              }
            }}
            title={demoMode ? 'Exit Demo Mode' : 'Enter Demo Mode'}
            className="flex-shrink-0 text-[10px] hover:opacity-80"
            style={{ color: demoMode ? '#fb923c' : 'var(--text-3)', fontWeight: demoMode ? 700 : 400 }}>
            🎭
          </button>
        </div>
        {demoMode && (
          <div className="px-1 mt-1">
            <div className="text-[10px] font-bold text-center py-0.5 rounded"
              style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c', letterSpacing: '0.05em' }}>
              DEMO
            </div>
          </div>
        )}
      </div>

      {/* ── Settings Modal ── */}
      {showSettings && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowSettings(false)}>
          <div className="w-[380px] rounded-2xl shadow-2xl border"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border2)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <div className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Site Settings</div>
                <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>Configure KPI targets and site details</div>
              </div>
              <button onClick={() => setShowSettings(false)} className="text-sm" style={{ color: 'var(--text-3)' }}>✕</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Site name */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-3)' }}>Site Name</label>
                <input value={settingsSiteName} onChange={e => setSettingsSiteName(e.target.value)}
                  className="w-full text-sm rounded-xl px-3 py-2 border"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
              </div>
              {/* Shift pattern */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-3)' }}>Shift Pattern</label>
                <select value={settingsShift} onChange={e => setSettingsShift(e.target.value)}
                  className="w-full text-sm rounded-xl px-3 py-2 border"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }}>
                  <option value="Day">Day</option>
                  <option value="Day+Night">Day+Night</option>
                  <option value="24-7">24-7</option>
                </select>
              </div>
              {/* KPI targets */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>KPI Targets</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'UPH', label: 'UPH', step: '1' },
                    { key: 'Accuracy', label: 'Accuracy (%)', step: '0.1' },
                    { key: 'DPMO', label: 'DPMO', step: '1' },
                    { key: 'DTS', label: 'DTS (%)', step: '0.1' },
                  ].map(({ key, label, step }) => (
                    <div key={key}>
                      <label className="block text-[10px] mb-1" style={{ color: 'var(--text-3)' }}>{label}</label>
                      <input
                        type="number" step={step}
                        value={settingsTargets[key] ?? ''}
                        onChange={e => setSettingsTargets(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                        className="w-full text-sm rounded-xl px-3 py-2 border"
                        style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 pb-5">
              <button
                disabled={settingsSaving}
                onClick={async () => {
                  setSettingsSaving(true)
                  try {
                    await api.patchSite({ site_name: settingsSiteName, shift_pattern: settingsShift, kpi_targets: settingsTargets })
                    setShowSettings(false)
                  } finally { setSettingsSaving(false) }
                }}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                style={{ background: 'var(--accent)' }}>
                {settingsSaving ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Site Knowledge Panel ── */}
      {showKnowledge && (
        <div className="fixed inset-0 z-50 flex items-end justify-start" onClick={() => setShowKnowledge(false)}>
          <div className="w-72 mb-4 ml-4 rounded-2xl shadow-2xl border"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border2)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <div className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Site Knowledge</div>
                <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>Notes fed into every AI response</div>
              </div>
              <button onClick={() => setShowKnowledge(false)} className="text-xs" style={{ color: 'var(--text-3)' }}>✕</button>
            </div>

            {/* Existing notes */}
            {siteNotes && (
              <div className="px-4 py-3 border-b max-h-48 overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
                <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>What Continuum knows</div>
                <div className="text-xs space-y-1.5" style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
                  {siteNotes.split('\n\n').map((note, i) => (
                    <div key={i} className="text-xs" style={{ color: 'var(--text-2)' }}>{note}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Add note */}
            <div className="px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Tell Continuum something</div>
              <textarea
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                placeholder="e.g. Zone A has 3 pick aisles, currently understaffed on nights. Wave release happens at 07:00, 10:00, 14:00…"
                rows={4}
                className="w-full text-xs rounded-xl border px-3 py-2 resize-none"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
              <button
                onClick={async () => {
                  if (!noteInput.trim()) return
                  setNoteSaving(true)
                  try {
                    const updated = await api.addSiteNote(noteInput.trim())
                    setSiteNotes(updated.site_notes || '')
                    setNoteInput('')
                  } finally { setNoteSaving(false) }
                }}
                disabled={!noteInput.trim() || noteSaving}
                className="w-full mt-2 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40"
                style={{ background: 'var(--accent)' }}>
                {noteSaving ? 'Saving…' : 'Save Note →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
