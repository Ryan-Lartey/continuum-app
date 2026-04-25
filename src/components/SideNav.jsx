import { useState, useEffect, useRef } from 'react'
import { api, streamAgent } from '../lib/api.js'
import PresentationHotspot from './PresentationHotspot.jsx'
import {
  LayoutDashboard, Activity, Target, Kanban,
  TrendingUp, FileBarChart, GitFork,
  Settings, BookOpen,
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
    api.getSite().then(s => {
      setSiteNotes(s.site_notes || '')
      setSettingsSiteName(s.site_name || 'Amazon FC')
      setSettingsShift(s.shift_pattern || 'Day')
      setSettingsTargets(s.kpi_targets || DEFAULT_TARGETS)
    }).catch(() => {})
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

  return (
    <aside
      className="w-52 flex-shrink-0 flex flex-col h-screen sticky top-0"
      style={{
        background: 'linear-gradient(180deg, #0d0d10 0%, #0a0a0d 100%)',
        borderRight: '1px solid rgba(255,255,255,0.055)',
      }}
    >

      {/* ── Logo ── */}
      <div className="px-4 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.055)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 8px rgba(249,115,22,0.25)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
              <path d="M6 1L11 4V8L6 11L1 8V4L6 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <circle cx="6" cy="6" r="1.5" fill="white"/>
            </svg>
          </div>
          <div>
            <div
              className="font-semibold"
              style={{ color: 'var(--text-1)', fontSize: 14, letterSpacing: '-0.03em' }}
            >
              Continuum
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="rounded-full flex-shrink-0"
                style={{ width: 4, height: 4, background: '#4ade80', boxShadow: '0 0 4px rgba(74,222,128,0.6)', display: 'inline-block' }}
              />
              <span className="text-[9px] font-medium" style={{ color: 'var(--text-3)', letterSpacing: '0.02em' }}>
                Live
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="px-2 py-3 space-y-0.5 flex-shrink-0">
        {NAV.map(({ id, Icon, label }) => {
          const isActive  = active === id
          const hasSignal = id === 'data' && signals.length > 0
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left relative"
              style={{
                background: isActive
                  ? 'linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(249,115,22,0.04) 100%)'
                  : 'transparent',
                border: isActive
                  ? '1px solid rgba(249,115,22,0.15)'
                  : '1px solid transparent',
                borderRadius: 8,
                color: isActive ? '#f97316' : 'var(--text-2)',
                transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  e.currentTarget.style.color = 'var(--text-2)'
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              <Icon
                size={14}
                strokeWidth={isActive ? 2 : 1.75}
                style={isActive ? { filter: 'drop-shadow(0 0 4px rgba(249,115,22,0.4))' } : {}}
              />
              <span
                className="flex-1"
                style={{ fontSize: 12, fontWeight: isActive ? 600 : 500 }}
              >
                {label}
              </span>
              {hasSignal && (
                <span className="signal-dot flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 relative z-10 block" />
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="flex-1" />

      {/* ── Command input ── */}
      <div
        className="px-2 pb-3 pt-3 space-y-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.055)' }}
      >
        {/* Tip / response box */}
        {tip && (
          <div
            className="text-[10px] leading-relaxed rounded-lg px-2.5 py-2 flex items-start gap-1.5"
            style={{
              background: tip.type === 'warn'
                ? 'rgba(249,115,22,0.08)'
                : tip.type === 'info'
                  ? 'rgba(96,165,250,0.07)'
                  : 'rgba(74,222,128,0.07)',
              color: tip.type === 'warn' ? '#fb923c' : tip.type === 'info' ? '#93c5fd' : '#4ade80',
              border: `1px solid ${tip.type === 'warn' ? 'rgba(249,115,22,0.2)' : tip.type === 'info' ? 'rgba(96,165,250,0.15)' : 'rgba(74,222,128,0.15)'}`,
              backdropFilter: 'blur(10px)',
              borderRadius: 8,
            }}
          >
            <span className="flex-1">{tip.text || (loading && tip.type === 'info' ? 'Thinking…' : '')}</span>
            <button onClick={() => setTip(null)} className="opacity-40 hover:opacity-80 flex-shrink-0 text-xs">✕</button>
          </div>
        )}

        {/* Command input wrapper */}
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10,
            padding: '8px 8px 6px',
          }}
        >
          <div className="flex items-center justify-between px-0.5 mb-1.5">
            <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>Ask anything</span>
            <span
              className="font-mono"
              style={{ fontSize: 10, color: 'var(--text-3)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '1px 4px' }}
            >
              ⌘K
            </span>
          </div>
          <form onSubmit={handleSubmit}>
            <div
              className="flex items-center gap-2 px-2.5 py-2"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 7,
                position: 'relative',
              }}
            >
              <PresentationHotspot id="sidenav-ai" demoMode={demoMode} />
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, opacity: 0.35 }}>
                <circle cx="4" cy="4" r="3" stroke="currentColor" strokeWidth="1.25"/>
                <path d="M7 7L9 9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              </svg>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={loading ? 'Processing…' : 'Type a command…'}
                disabled={loading}
                className="flex-1 text-xs bg-transparent min-w-0"
                style={{ color: 'var(--text-1)', outline: 'none', border: 'none', boxShadow: 'none' }}
              />
              {input.trim() && (
                <button
                  type="submit"
                  className="flex items-center justify-center text-white flex-shrink-0 font-bold rounded-md"
                  style={{
                    width: 18,
                    height: 18,
                    fontSize: 9,
                    background: 'linear-gradient(135deg, #f97316, #c2410c)',
                    boxShadow: '0 1px 4px rgba(249,115,22,0.35)',
                  }}
                >
                  ↑
                </button>
              )}
            </div>
          </form>
        </div>

        {/* User profile row */}
        <div className="flex items-center gap-1.5 px-1 pt-0.5">
          <div
            className="flex items-center justify-center text-white flex-shrink-0 font-bold rounded-md"
            style={{
              width: 20,
              height: 20,
              background: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)',
              fontSize: 9,
              boxShadow: '0 1px 4px rgba(249,115,22,0.3)',
            }}
          >
            R
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate" style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)', lineHeight: 1.2 }}>Ryan</div>
            <div className="truncate" style={{ fontSize: 10, color: 'var(--text-3)', lineHeight: 1.2 }}>{settingsSiteName}</div>
          </div>
          <button
            onClick={() => setShowKnowledge(true)}
            title="Site Knowledge"
            className="flex-shrink-0 flex items-center justify-center"
            style={{
              color: 'var(--text-3)',
              background: 'transparent',
              borderRadius: 4,
              padding: 3,
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <BookOpen size={12} strokeWidth={1.75} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            title="Settings"
            className="flex-shrink-0 flex items-center justify-center"
            style={{
              color: 'var(--text-3)',
              background: 'transparent',
              borderRadius: 4,
              padding: 3,
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Settings size={12} strokeWidth={1.75} />
          </button>
          <button
            onClick={() => {
              if (demoMode || window.confirm('Switching to demo mode will reload the app. Continue?')) {
                onToggleDemo?.()
              }
            }}
            title={demoMode ? 'Exit Demo Mode' : 'Enter Demo Mode'}
            className="flex-shrink-0 flex items-center justify-center text-[10px]"
            style={{
              color: demoMode ? '#fb923c' : 'var(--text-3)',
              fontWeight: demoMode ? 700 : 400,
              background: 'transparent',
              borderRadius: 4,
              padding: 3,
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            🎭
          </button>
        </div>

        {/* Demo mode pill */}
        {demoMode && (
          <div className="px-1">
            <div
              className="text-[10px] font-bold text-center py-1 rounded-full"
              style={{
                background: 'linear-gradient(135deg, rgba(249,115,22,0.2) 0%, rgba(194,65,12,0.1) 100%)',
                color: '#fb923c',
                letterSpacing: '0.08em',
                border: '1px solid rgba(249,115,22,0.25)',
                boxShadow: '0 0 12px rgba(249,115,22,0.1)',
              }}
            >
              DEMO MODE
            </div>
          </div>
        )}
      </div>

      {/* ── Settings Modal ── */}
      {showSettings && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShowSettings(false)}
        >
          <div
            className="w-[380px] overflow-hidden"
            style={{
              background: 'var(--bg-card)',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Gradient top accent line */}
            <div style={{ height: 2, background: 'linear-gradient(90deg, rgba(249,115,22,0.7) 0%, rgba(249,115,22,0.15) 60%, transparent 100%)' }} />

            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Site Settings</div>
                <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>Configure KPI targets and site details</div>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="flex items-center justify-center rounded-md"
                style={{
                  width: 24,
                  height: 24,
                  color: 'var(--text-3)',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  fontSize: 12,
                }}
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Site name */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-3)' }}>Site Name</label>
                <input
                  value={settingsSiteName}
                  onChange={e => setSettingsSiteName(e.target.value)}
                  className="w-full text-sm px-3 py-2"
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    color: 'var(--text-1)',
                    outline: 'none',
                  }}
                />
              </div>
              {/* Shift pattern */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-3)' }}>Shift Pattern</label>
                <select
                  value={settingsShift}
                  onChange={e => setSettingsShift(e.target.value)}
                  className="w-full text-sm px-3 py-2"
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    color: 'var(--text-1)',
                    outline: 'none',
                  }}
                >
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
                        type="number"
                        step={step}
                        value={settingsTargets[key] ?? ''}
                        onChange={e => setSettingsTargets(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                        className="w-full text-sm px-3 py-2"
                        style={{
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 8,
                          color: 'var(--text-1)',
                          outline: 'none',
                        }}
                      />
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
                className="w-full py-2.5 text-sm font-bold text-white disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #f97316, #c2410c)',
                  borderRadius: 10,
                  boxShadow: '0 4px 16px rgba(249,115,22,0.3), 0 1px 0 rgba(255,255,255,0.1) inset',
                  transition: 'opacity 0.15s',
                }}
              >
                {settingsSaving ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Site Knowledge Panel ── */}
      {showKnowledge && (
        <div className="fixed inset-0 z-50 flex items-end justify-start" onClick={() => setShowKnowledge(false)}>
          <div
            className="w-72 mb-4 ml-4 overflow-hidden"
            style={{
              background: 'var(--bg-card)',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Gradient top accent line */}
            <div style={{ height: 2, background: 'linear-gradient(90deg, rgba(249,115,22,0.7) 0%, rgba(249,115,22,0.15) 60%, transparent 100%)' }} />

            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Site Knowledge</div>
                <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>Notes fed into every AI response</div>
              </div>
              <button
                onClick={() => setShowKnowledge(false)}
                className="flex items-center justify-center rounded-md"
                style={{
                  width: 22,
                  height: 22,
                  color: 'var(--text-3)',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  fontSize: 11,
                }}
              >
                ✕
              </button>
            </div>

            {/* Existing notes */}
            {siteNotes && (
              <div className="px-4 py-3 max-h-48 overflow-y-auto" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
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
                className="w-full text-xs px-3 py-2 resize-none"
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  color: 'var(--text-1)',
                  outline: 'none',
                }}
              />
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
                className="w-full mt-2 py-2 text-xs font-bold text-white disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #f97316, #c2410c)',
                  borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(249,115,22,0.25)',
                }}
              >
                {noteSaving ? 'Saving…' : 'Save Note →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
