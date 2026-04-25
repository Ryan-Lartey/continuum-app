import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api.js'
import ObsCard from '../components/ObsCard.jsx'
import PresentationHotspot from '../components/PresentationHotspot.jsx'

const AREAS = ['Inbound', 'Stow', 'Pick', 'Pack', 'Dispatch', 'Yard', 'Admin']
const WASTE_TYPES = ['Transport', 'Inventory', 'Motion', 'Waiting', 'Overproduction', 'Overprocessing', 'Defects', 'Skills']

const WASTE_COLORS = {
  Transport:      '#3B7FDE', Inventory:      '#7C3AED', Motion:       '#16A34A', Waiting:       '#E8820C',
  Overproduction: '#DC2626', Overprocessing: '#0891B2', Defects:      '#B91C1C', Skills:        '#059669',
}

const WASTE_KEYWORDS = {
  Transport:      ['transport', 'carry', 'carrying', 'moving product', 'travel', 'travelling', 'walking to', 'long distance', 'pick path', 'route', 'conveyor', 'forklift', 'transfer', 'move items', 'bringing'],
  Inventory:      ['inventory', 'overstock', 'buffer stock', 'excess stock', 'storage', 'product sitting', 'piled up', 'too much stock', 'holding area', 'backlog', 'bins full', 'full shelves'],
  Motion:         ['motion', 'reaching', 'bending', 'stretching', 'looking for', 'searching for', 'walking back', 'unnecessary movement', 'excessive movement', 'scanning multiple', 'turn around', 'repeated movement'],
  Waiting:        ['wait', 'waiting', 'idle', 'queue', 'queuing', 'delay', 'delayed', 'blocked', 'bottleneck', 'paused', 'stood', 'standing around', 'held up', 'hold up', 'nothing to do', 'no work', 'tote', 'not arrived'],
  Overproduction: ['overproduction', 'too many', 'more than needed', 'ahead of demand', 'unnecessary output', 'over-pick', 'picking too much', 'excess labels'],
  Overprocessing: ['rework', 'checked twice', 'unnecessary steps', 'extra steps', 'double handling', 'reprocess', 'redundant check', 'over-checking', 'duplicate scan', 'scan twice', 'rescanned'],
  Defects:        ['defect', 'error', 'mistake', 'wrong item', 'incorrect', 'damaged', 'mispick', 'quality issue', 'return', 'reject', 'broken', 'missing item', 'accuracy', 'wrong location', 'wrong bin'],
  Skills:         ['untrained', 'not trained', 'skill', 'knowledge gap', 'experience', 'underutilized', 'wrong person', 'capability', 'doesn\'t know', 'unfamiliar', 'training', 'new starter'],
}

const AREA_KEYWORDS = {
  Inbound:  ['inbound', 'receiving', 'goods in', 'unload', 'delivery', 'intake', 'receive'],
  Stow:     ['stow', 'stowing', 'put away', 'putaway', 'binning', 'bin location', 'shelving'],
  Pick:     ['pick', 'picking', 'picker', 'pick zone', 'pick aisle', 'zone a', 'zone b', 'zone c'],
  Pack:     ['pack', 'packing', 'packer', 'boxing', 'carton', 'packing station', 'tape'],
  Dispatch: ['dispatch', 'ship', 'shipping', 'outbound', 'loading dock', 'trailers', 'despatch'],
  Yard:     ['yard', 'dock', 'trailer', 'lorry', 'loading bay', 'outside', 'gate'],
  Admin:    ['admin', 'office', 'paperwork', 'system error', 'computer', 'screen', 'log in'],
}

function detectFromText(text) {
  const lower = text.toLowerCase()
  let bestWaste = null, bestWasteScore = 0
  for (const [waste, keywords] of Object.entries(WASTE_KEYWORDS)) {
    const score = keywords.filter(k => lower.includes(k)).length
    if (score > bestWasteScore) { bestWasteScore = score; bestWaste = waste }
  }
  let bestArea = null, bestAreaScore = 0
  for (const [area, keywords] of Object.entries(AREA_KEYWORDS)) {
    const score = keywords.filter(k => lower.includes(k)).length
    if (score > bestAreaScore) { bestAreaScore = score; bestArea = area }
  }
  return { waste: bestWasteScore > 0 ? bestWaste : null, area: bestAreaScore > 0 ? bestArea : null }
}

export default function FloorView({ onOpenAgent, onNavigate, demoMode }) {
  const [observations, setObservations] = useState([])
  const [patterns, setPatterns]         = useState([])
  const [projects, setProjects]         = useState([])
  const [area, setArea]                 = useState('Pick')
  const [wasteType, setWasteType]       = useState('Waiting')
  const [severity, setSeverity]         = useState(2)
  const [linkProject, setLinkProject]   = useState('')
  const [showLinkProject, setShowLinkProject] = useState(false)
  const [obsText, setObsText]           = useState('')
  const [autoDetected, setAutoDetected] = useState(false)
  const [saving, setSaving]             = useState(false)
  const detectTimer = useRef(null)
  const [saved, setSaved]               = useState(false)
  const [filterArea, setFilterArea]     = useState('All')
  const [filterWaste, setFilterWaste]   = useState('All')
  const [raisePrompt, setRaisePrompt]   = useState(null)
  const [lastObs, setLastObs]           = useState(null)
  const [clueProject, setClueProject]   = useState('')
  const [addingClue, setAddingClue]     = useState(false)
  const [clueAdded, setClueAdded]       = useState(false)
  const [portfolios, setPortfolios]     = useState([])
  const [ideaPortfolio, setIdeaPortfolio] = useState('')
  const [sendingIdea, setSendingIdea]   = useState(false)
  const [ideaSent, setIdeaSent]         = useState(null) // { portfolioName, title }
  const [pendingIdeaObs, setPendingIdeaObs] = useState(null) // obs object for modal
  const [sentIdeaIds, setSentIdeaIds]       = useState(new Set())
  const [showCreatePf, setShowCreatePf]     = useState(false) // inline portfolio creator
  const [newPfName, setNewPfName]           = useState('')
  const [newPfArea, setNewPfArea]           = useState('Pick')
  const [creatingPf, setCreatingPf]         = useState(false)
  const [converting, setConverting]         = useState(false) // AI converting obs → idea
  const [converted, setConverted]           = useState(null)  // { idea, recommendation }
  const [editedTitle, setEditedTitle]       = useState('')    // user-editable AI title

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (detectTimer.current) clearTimeout(detectTimer.current)
    if (obsText.trim().length < 10) return
    detectTimer.current = setTimeout(() => {
      const { waste, area: detectedArea } = detectFromText(obsText)
      if (waste) { setWasteType(waste); setAutoDetected(true) }
      if (detectedArea) setArea(detectedArea)
    }, 500)
    return () => clearTimeout(detectTimer.current)
  }, [obsText])

  function closeObsModal() {
    setPendingIdeaObs(null)
    setShowCreatePf(false)
    setConverted(null)
    setEditedTitle('')
    setIdeaPortfolio('')
  }

  async function openObsModal(obs) {
    setIdeaPortfolio('')
    setConverted(null)
    setEditedTitle('')
    setShowCreatePf(false)
    setPendingIdeaObs(obs)
    // immediately kick off AI conversion
    setConverting(true)
    try {
      const result = await api.convertObservation(obs)
      setConverted(result)
      setEditedTitle(result.idea?.title || '')
      // auto-select portfolio if AI found a match
      if (result.recommendation?.action === 'use_existing' && result.recommendation?.portfolio_id) {
        setIdeaPortfolio(String(result.recommendation.portfolio_id))
      }
      // pre-fill new portfolio fields if AI suggests creating one
      if (result.recommendation?.action === 'create_new') {
        setNewPfName(result.recommendation.new_name || '')
        setNewPfArea(result.recommendation.new_area || 'Pick')
        setShowCreatePf(true)
      }
    } catch {
      setConverted({ error: true })
    } finally {
      setConverting(false)
    }
  }

  async function createPortfolioInline(onCreated) {
    if (!newPfName.trim()) return
    setCreatingPf(true)
    try {
      const pf = await api.createPortfolio({
        name: newPfName.trim(),
        area_focus: newPfArea,
        primary_kpi: 'uph',
        impact_goal: 0,
        impact_unit: 'improvement',
        strategic_objective: '',
      })
      setPortfolios(prev => [...prev, pf])
      setIdeaPortfolio(String(pf.id))
      setShowCreatePf(false)
      setNewPfName('')
      setNewPfArea('Pick')
      onCreated?.(pf)
    } finally { setCreatingPf(false) }
  }

  async function loadData() {
    const [obs, pats, ps, pfs] = await Promise.all([
      api.getObservations().catch(() => []),
      api.getPatterns().catch(() => []),
      api.getProjects().catch(() => []),
      api.getPortfolios().catch(() => []),
    ])
    setObservations(obs)
    setPatterns(pats)
    setProjects(ps.filter(p => p.stage !== 'Closed'))
    setPortfolios(pfs)
  }

  async function sendAsIdea({ title, waste_type, areaVal, source, description, obsId }) {
    if (!ideaPortfolio) return
    setSendingIdea(true)
    try {
      const pf = portfolios.find(p => p.id === parseInt(ideaPortfolio))
      await api.createIdea({
        portfolio_id: parseInt(ideaPortfolio),
        title,
        description: description || '',
        waste_type,
        area: areaVal || '',
        source,
      })
      if (obsId) setSentIdeaIds(prev => new Set([...prev, obsId]))
      setIdeaSent({ portfolioName: pf?.name || 'portfolio', title })
      setRaisePrompt(null)
      setTimeout(() => { setIdeaSent(null); setIdeaPortfolio('') }, 3500)
    } finally { setSendingIdea(false) }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!obsText.trim()) return
    setSaving(true)
    let linkedProjectName = null
    try {
      const today = new Date().toISOString().split('T')[0]
      await api.addObservation({ area, waste_type: wasteType, severity, text: obsText, date: today })

      // Link to project as clue if selected
      if (linkProject) {
        const p = await api.getProject(parseInt(linkProject))
        linkedProjectName = p.title
        const existing = p.charter?.clues || []
        await api.updateProject(p.id, {
          charter: {
            ...(p.charter || {}),
            clues: [...existing, {
              id: Date.now(),
              title: obsText.slice(0, 60),
              description: obsText,
              type: 'Floor Observation',
              area,
              wasteType,
            }],
          },
        })
      }

      setLastObs({ area, wasteType, text: obsText, linkedProjectName })
      setObsText('')
      setAutoDetected(false)
      setSeverity(2)
      setLinkProject('')
      setShowLinkProject(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
      await loadData()
      const obs7   = await api.getObservations().catch(() => [])
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const count  = obs7.filter(o => o.waste_type === wasteType && o.area === area && o.created_at >= cutoff).length
      if (count >= 3) setRaisePrompt({ waste_type: wasteType, area, count })
    } finally { setSaving(false) }
  }

  async function addClueToProject() {
    if (!clueProject || !lastObs) return
    setAddingClue(true)
    try {
      const p = await api.getProject(parseInt(clueProject))
      const existing = p.charter?.clues || []
      await api.updateProject(p.id, {
        charter: {
          ...(p.charter || {}),
          clues: [...existing, {
            id: Date.now(),
            title: lastObs.text.slice(0, 60),
            description: lastObs.text,
            type: 'Floor Observation',
            area: lastObs.area,
            wasteType: lastObs.wasteType,
          }],
        },
      })
      setClueAdded(true)
      setTimeout(() => { setClueAdded(false); setLastObs(null); setClueProject('') }, 2000)
    } finally { setAddingClue(false) }
  }

  async function handleDelete(id) {
    await api.deleteObservation(id).catch(() => {})
    setObservations(prev => prev.filter(o => o.id !== id))
  }

  const filtered = observations.filter(o =>
    (filterArea === 'All' || o.area === filterArea) &&
    (filterWaste === 'All' || o.waste_type === filterWaste)
  )

  const last7 = observations.filter(o => {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    return o.created_at >= cutoff
  })
  const byWaste   = {}
  for (const o of last7) byWaste[o.waste_type] = (byWaste[o.waste_type] || 0) + 1
  const topWaste  = Object.entries(byWaste).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const todayObs  = observations.filter(o => o.date === new Date().toISOString().split('T')[0])

  // ─── Area stat cards derived from today's observations ───
  const AREA_KEYS = ['Inbound', 'Stow', 'Pick', 'Pack', 'Dispatch', 'Yard']
  const areaStats = AREA_KEYS.map(areaName => {
    const areaObs  = todayObs.filter(o => o.area === areaName)
    const weekObs  = last7.filter(o => o.area === areaName)
    const hasRed   = areaObs.some(o => o.severity >= 3) || weekObs.length >= 4
    const hasAmber = areaObs.some(o => o.severity >= 2) || weekObs.length >= 2
    const status   = hasRed ? 'behind' : hasAmber ? 'at-risk' : 'on-track'
    const statusLabel = hasRed ? 'BEHIND' : hasAmber ? 'WATCH' : 'ON TRACK'
    const statusColor = hasRed ? '#EF4444' : hasAmber ? '#F59E0B' : '#22C55E'
    const topWasteArea = Object.entries(
      weekObs.reduce((acc, o) => { acc[o.waste_type] = (acc[o.waste_type] || 0) + 1; return acc }, {})
    ).sort((a, b) => b[1] - a[1])[0]

    return { areaName, areaObs, weekObs, status, statusLabel, statusColor, topWasteArea }
  })

  return (
    <div className="max-w-[1400px]">

      {/* ─── Header ─── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)', letterSpacing: '-0.04em' }}>Floor Walk</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            <span className="mx-2" style={{ color: 'var(--border2)' }}>·</span>
            {todayObs.length} obs today · {last7.length} this week
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onOpenAgent('gemba-agent', null)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)' }}>
            ◎ Gemba Agent
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white btn-primary">
            ▶ Start Walk
          </button>
        </div>
      </div>

      {/* ─── Area stat cards ─── */}
      <div className="flex gap-3 mb-5" style={{ overflowX: 'auto', paddingBottom: 2 }}>
        {areaStats.map(({ areaName, areaObs, weekObs, status, statusLabel, statusColor, topWasteArea }, idx) => (
          <div key={areaName}
            className={`area-stat-card ${status}`}
            style={{
              animationDelay: `${idx * 60}ms`,
              animation: 'fadeIn 0.3s ease both',
            }}>
            {/* Area name + status badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B' }}>
                {areaName}
              </span>
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
                padding: '2px 7px', borderRadius: 999,
                background: `${statusColor}15`, color: statusColor,
                border: `1px solid ${statusColor}30`,
              }}>
                {statusLabel}
              </span>
            </div>

            {/* Main stat: today's obs count */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 9, color: '#475569', fontWeight: 600, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Today</div>
                <div style={{
                  fontSize: 32, fontWeight: 800, lineHeight: 1,
                  letterSpacing: '-0.03em',
                  background: areaObs.length > 0
                    ? `linear-gradient(135deg, #fff 0%, ${statusColor} 100%)`
                    : 'linear-gradient(135deg, #fff 0%, #475569 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>
                  {areaObs.length}
                </div>
              </div>
              <div style={{ paddingBottom: 4 }}>
                <div style={{ fontSize: 9, color: '#475569', fontWeight: 600, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Week</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: weekObs.length > 3 ? '#F59E0B' : '#64748B', lineHeight: 1 }}>
                  {weekObs.length}
                </div>
              </div>
            </div>

            {/* Top waste tag */}
            {topWasteArea ? (
              <div style={{
                fontSize: 10, fontWeight: 600,
                padding: '3px 8px', borderRadius: 6,
                background: 'rgba(255,255,255,0.04)',
                color: '#64748B',
                border: '1px solid rgba(255,255,255,0.06)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {topWasteArea[0]} ×{topWasteArea[1]}
              </div>
            ) : (
              <div style={{ fontSize: 10, color: '#334155', fontWeight: 500 }}>No observations</div>
            )}
          </div>
        ))}
      </div>

      {/* Pattern alerts */}
      {patterns.length > 0 && (
        <div className="flex gap-3 mb-4 flex-wrap">
          {patterns.map(p => (
            <div key={p.waste_type} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border"
              style={{ background: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.2)', borderLeft: '3px solid #EF4444' }}>
              <span style={{ color: '#EF4444', fontSize: 16 }}>⚡</span>
              <div>
                <span className="font-semibold text-sm" style={{ color: '#f87171' }}>{p.waste_type}</span>
                <span className="text-xs ml-1.5" style={{ color: '#fca5a5' }}>{p.area}</span>
                <span className="text-xs ml-2 font-bold" style={{ color: '#f87171' }}>{p.count}× this week</span>
              </div>
              <span className="text-xs ml-auto" style={{ color: '#94A3B8' }}>Pattern detected</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-5 gap-5 items-start">

        {/* ─── Quick capture form ─── */}
        <div className="col-span-2 space-y-4">
          <div className="card p-5" style={{ position: 'relative' }}>
            <PresentationHotspot id="floor-observation" demoMode={demoMode} />
            <h2 className="font-semibold mb-4" style={{ color: 'var(--text-1)' }}>Log Observation</h2>

            <form onSubmit={handleSubmit}>
              {/* Text first — hero field */}
              <textarea
                value={obsText}
                onChange={e => setObsText(e.target.value)}
                placeholder="What did you see? Where, how long, what impact…"
                rows={4}
                autoFocus
                className="w-full text-sm rounded-xl px-3 py-2.5 resize-none mb-4 border"
                style={{
                  background:   'var(--bg-input)',
                  borderColor:  severity === 3 ? '#DC2626' : obsText.trim() ? '#E8820C' : 'var(--border2)',
                  color:        'var(--text-1)',
                  outline:      'none',
                }} />

              {/* Area */}
              <div className="mb-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Area</div>
                <div className="flex flex-wrap gap-1.5">
                  {AREAS.map(a => (
                    <button type="button" key={a} onClick={() => setArea(a)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                      style={{
                        background:  area === a ? '#E8820C' : 'var(--bg-input)',
                        color:       area === a ? 'white' : 'var(--text-2)',
                        border:      `1px solid ${area === a ? '#E8820C' : 'var(--border)'}`,
                      }}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {/* Severity selector */}
              <div className="mb-3">
                <div className="flex items-center gap-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide w-16 flex-shrink-0" style={{ color: 'var(--text-3)' }}>Severity</div>
                  <div className="flex gap-1.5">
                    {[
                      { val: 1, label: 'Low',      color: '#16A34A', bg: 'rgba(22,163,74,0.12)'    },
                      { val: 2, label: 'Medium',   color: '#E8820C', bg: 'rgba(232,130,12,0.12)'   },
                      { val: 3, label: 'Critical', color: '#DC2626', bg: 'rgba(220,38,38,0.12)'    },
                    ].map(({ val, label, color, bg }) => (
                      <button type="button" key={val} onClick={() => setSeverity(val)}
                        className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                        style={{
                          background:  severity === val ? bg : 'var(--bg-input)',
                          color:       severity === val ? color : 'var(--text-3)',
                          border:      `1px solid ${severity === val ? color + '60' : 'var(--border)'}`,
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Link to project — collapsible */}
              <div className="mb-3">
                {!showLinkProject ? (
                  <button type="button" onClick={() => setShowLinkProject(true)}
                    className="text-[11px] font-semibold"
                    style={{ color: 'var(--text-3)' }}>
                    + Link to project
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <select value={linkProject} onChange={e => setLinkProject(e.target.value)}
                      className="flex-1 text-xs rounded-lg px-2.5 py-1.5 border"
                      style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }}>
                      <option value="">No project link</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                    <button type="button" onClick={() => { setShowLinkProject(false); setLinkProject('') }}
                      className="text-[10px] flex-shrink-0"
                      style={{ color: 'var(--text-3)' }}>✕</button>
                  </div>
                )}
              </div>

              {/* Waste type — auto-detected, read-only */}
              {obsText.trim().length >= 10 && (
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Waste</span>
                  {autoDetected ? (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5"
                      style={{ background: `${WASTE_COLORS[wasteType]}18`, color: WASTE_COLORS[wasteType], border: `1px solid ${WASTE_COLORS[wasteType]}40` }}>
                      ✦ {wasteType}
                    </span>
                  ) : (
                    <span className="text-[10px] px-2.5 py-1 rounded-full"
                      style={{ background: `${WASTE_COLORS[wasteType]}18`, color: WASTE_COLORS[wasteType], border: `1px solid ${WASTE_COLORS[wasteType]}40` }}>
                      {wasteType}
                    </span>
                  )}
                  <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>· keep typing to refine</span>
                </div>
              )}

              <button type="submit" disabled={!obsText.trim() || saving}
                className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-all"
                style={{ background: saved ? '#16A34A' : '#E8820C' }}>
                {saved ? '✓ Logged' : saving ? 'Saving…' : 'Log →'}
              </button>
            </form>

            {raisePrompt && !ideaSent && (
              <div className="mt-3 rounded-xl p-3 border" style={{ background: 'rgba(220,38,38,0.06)', borderColor: 'rgba(220,38,38,0.2)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: '#f87171' }}>
                  ⚠ {raisePrompt.waste_type} in {raisePrompt.area} — {raisePrompt.count}× this week
                </p>
                <p className="text-xs mb-2.5" style={{ color: 'var(--text-2)' }}>
                  Same waste, same area. Send to a portfolio to evaluate before committing to a project.
                </p>
                {!showCreatePf ? (
                  <>
                    <select value={ideaPortfolio} onChange={e => setIdeaPortfolio(e.target.value)}
                      className="w-full text-xs rounded-lg px-2.5 py-1.5 mb-1 border"
                      style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }}>
                      <option value="">{portfolios.length > 0 ? 'Select portfolio…' : 'No portfolios yet'}</option>
                      {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button onClick={() => setShowCreatePf(true)}
                      className="text-[10px] font-semibold mb-2 block"
                      style={{ color: '#E8820C' }}>
                      + Create new portfolio
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => sendAsIdea({
                          title: `${raisePrompt.waste_type} Waste — ${area}`,
                          waste_type: raisePrompt.waste_type,
                          areaVal: area,
                          source: 'pattern',
                          description: `${raisePrompt.count} occurrences in 7 days. Last observed: ${lastObs?.text?.slice(0, 80) || ''}`,
                        })}
                        disabled={!ideaPortfolio || sendingIdea}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                        style={{ background: '#DC2626' }}>
                        {sendingIdea ? 'Sending…' : 'Send as Idea →'}
                      </button>
                      <button onClick={() => setRaisePrompt(null)}
                        className="px-3 py-1.5 rounded-lg text-xs"
                        style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
                        Dismiss
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg p-2.5 mb-2 space-y-2" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                    <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>New Portfolio</div>
                    <input value={newPfName} onChange={e => setNewPfName(e.target.value)}
                      placeholder="Portfolio name…"
                      className="w-full text-xs rounded-lg px-2.5 py-1.5 border"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
                    <select value={newPfArea} onChange={e => setNewPfArea(e.target.value)}
                      className="w-full text-xs rounded-lg px-2.5 py-1.5 border"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border2)', color: 'var(--text-1)' }}>
                      {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => createPortfolioInline()}
                        disabled={!newPfName.trim() || creatingPf}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                        style={{ background: '#E8820C' }}>
                        {creatingPf ? 'Creating…' : 'Create →'}
                      </button>
                      <button onClick={() => setShowCreatePf(false)}
                        className="px-3 py-1.5 rounded-lg text-xs"
                        style={{ background: 'transparent', color: 'var(--text-3)' }}>
                        Back
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Idea sent confirmation */}
            {ideaSent && (
              <div className="mt-3 rounded-xl p-3 text-center border" style={{ background: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.2)' }}>
                <p className="text-xs font-semibold" style={{ color: '#4ade80' }}>✓ Idea added to {ideaSent.portfolioName}</p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>Go to Portfolio → Ideas to review and define it</p>
                <button onClick={() => { onNavigate?.('portfolio'); setIdeaSent(null) }}
                  className="mt-2 text-xs font-semibold px-3 py-1 rounded-lg"
                  style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>
                  Open Portfolio →
                </button>
              </div>
            )}

            {/* Linked-at-submit confirmation */}
            {lastObs?.linkedProjectName && !clueAdded && (
              <div className="mt-3 rounded-xl p-3 border" style={{ background: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.2)' }}>
                <p className="text-xs font-semibold" style={{ color: '#4ade80' }}>✓ Linked to {lastObs.linkedProjectName}</p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>Added as a clue to the project charter</p>
              </div>
            )}

            {/* Link last observation as a clue to an existing project (post-submit, only if not already linked) */}
            {lastObs && !lastObs.linkedProjectName && !clueAdded && projects.length > 0 && (
              <div className="mt-3 rounded-xl p-3 border" style={{ background: 'rgba(59,127,222,0.06)', borderColor: 'rgba(59,127,222,0.2)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: '#60a5fa' }}>Add to a project as a clue?</p>
                <p className="text-[11px] mb-2 truncate" style={{ color: 'var(--text-3)' }}>
                  "{lastObs.text.slice(0, 55)}{lastObs.text.length > 55 ? '…' : ''}"
                </p>
                <select value={clueProject} onChange={e => setClueProject(e.target.value)}
                  className="w-full text-xs rounded-lg px-2.5 py-1.5 mb-2 border"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }}>
                  <option value="">Select project…</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <div className="flex gap-2">
                  <button onClick={addClueToProject} disabled={!clueProject || addingClue}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                    style={{ background: '#3B7FDE' }}>
                    {addingClue ? 'Adding…' : 'Add as Clue →'}
                  </button>
                  <button onClick={() => setLastObs(null)}
                    className="px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            {clueAdded && (
              <div className="mt-3 rounded-xl p-3 text-center" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
                <p className="text-xs font-semibold" style={{ color: '#4ade80' }}>✓ Clue added to project</p>
              </div>
            )}
          </div>

          {/* Active projects — quick nav after logging */}
          {projects.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-1)' }}>Active Projects</h3>
              <div className="space-y-2">
                {projects.slice(0, 5).map(p => (
                  <button key={p.id} onClick={() => onNavigate?.('projects', p)}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left transition-all"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate" style={{ color: 'var(--text-1)' }}>{p.title}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>{p.stage} · {p.area}</div>
                    </div>
                    <span className="text-xs ml-2 flex-shrink-0" style={{ color: 'var(--text-3)' }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Top waste this week */}
          {topWaste.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-1)' }}>Top Waste This Week</h3>
              <div className="space-y-2.5">
                {topWaste.map(([waste, count]) => {
                  const color = WASTE_COLORS[waste] || '#6B7280'
                  const pct   = Math.round((count / last7.length) * 100)
                  return (
                    <div key={waste}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium" style={{ color }}>{waste}</span>
                        <span className="text-xs" style={{ color: 'var(--text-3)' }}>{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-input)' }}>
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ─── Observations list ─── */}
        <div className="col-span-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {['All', ...AREAS].map(a => (
              <button key={a} onClick={() => setFilterArea(a)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  background: filterArea === a ? 'var(--text-1)' : 'var(--bg-input)',
                  color:      filterArea === a ? 'var(--bg-page)' : 'var(--text-2)',
                  border:     '1px solid var(--border)',
                }}>
                {a === 'All' ? 'All areas' : a}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {['All', ...WASTE_TYPES].map(w => (
              <button key={w} onClick={() => setFilterWaste(w)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={filterWaste === w && w !== 'All'
                  ? { background: WASTE_COLORS[w], color: 'white',             border: `1px solid ${WASTE_COLORS[w]}` }
                  : filterWaste === w
                    ? { background: 'var(--text-1)', color: 'var(--bg-page)',  border: '1px solid var(--border)' }
                    : { background: 'var(--bg-input)', color: 'var(--text-2)', border: '1px solid var(--border)' }
                }>
                {w === 'All' ? 'All waste' : w}
              </button>
            ))}
          </div>

          <div className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{filtered.length} observations</div>

          {filtered.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="text-4xl mb-3" style={{ color: 'var(--text-3)' }}>◎</div>
              <div className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>No observations yet</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Log your first floor walk observation on the left</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.slice(0, 60).map(o => (
                <ObsCard key={o.id} obs={o} onDelete={handleDelete}
                  sentAsIdea={sentIdeaIds.has(o.id)}
                  onSendAsIdea={(obs) => openObsModal(obs)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Obs → Idea modal (AI-powered) */}
      {pendingIdeaObs && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={closeObsModal}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl fade-in"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <h3 className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>Send as Idea</h3>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>AI is converting your observation</p>
              </div>
              <button onClick={closeObsModal}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
                style={{ background: 'var(--bg-input)', color: 'var(--text-2)' }}>✕</button>
            </div>

            {/* Original observation */}
            <div className="mx-5 mb-4 rounded-xl p-3" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
              <div className="flex gap-1.5 mb-1.5">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: `${WASTE_COLORS[pendingIdeaObs.waste_type] || '#6B7280'}18`, color: WASTE_COLORS[pendingIdeaObs.waste_type] || '#6B7280' }}>
                  {pendingIdeaObs.waste_type}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--bg-page)', color: 'var(--text-3)' }}>
                  {pendingIdeaObs.area}
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
                {pendingIdeaObs.text.slice(0, 140)}{pendingIdeaObs.text.length > 140 ? '…' : ''}
              </p>
            </div>

            {/* Loading state */}
            {converting && (
              <div className="px-5 pb-5 flex items-center gap-3">
                <span className="animate-spin text-lg" style={{ color: '#a78bfa' }}>◈</span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Analysing observation…</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Converting to idea · evaluating portfolio fit</p>
                </div>
              </div>
            )}

            {/* Error state */}
            {!converting && converted?.error && (
              <div className="px-5 pb-5">
                <p className="text-xs mb-3" style={{ color: '#f87171' }}>AI conversion failed. You can still send manually.</p>
                <ManualSendForm
                  portfolios={portfolios} ideaPortfolio={ideaPortfolio} setIdeaPortfolio={setIdeaPortfolio}
                  showCreatePf={showCreatePf} setShowCreatePf={setShowCreatePf}
                  newPfName={newPfName} setNewPfName={setNewPfName}
                  newPfArea={newPfArea} setNewPfArea={setNewPfArea}
                  creatingPf={creatingPf} createPortfolioInline={createPortfolioInline}
                  sendingIdea={sendingIdea}
                  onSend={async () => {
                    await sendAsIdea({ title: `${pendingIdeaObs.waste_type} Waste — ${pendingIdeaObs.area}`, waste_type: pendingIdeaObs.waste_type, areaVal: pendingIdeaObs.area, source: 'floor_walk', description: pendingIdeaObs.text, obsId: pendingIdeaObs.id })
                    closeObsModal()
                  }}
                  onCancel={closeObsModal}
                  pColor="#E8820C"
                  areas={AREAS}
                />
              </div>
            )}

            {/* AI result */}
            {!converting && converted && !converted.error && (
              <div className="px-5 pb-5 space-y-4">

                {/* Idea draft */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#a78bfa' }}>✦ AI Idea Draft</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>edit title if needed</span>
                  </div>
                  <input
                    value={editedTitle}
                    onChange={e => setEditedTitle(e.target.value)}
                    className="w-full text-sm font-semibold rounded-xl border px-3 py-2 mb-2"
                    style={{ background: 'var(--bg-input)', borderColor: 'rgba(167,139,250,0.4)', color: 'var(--text-1)' }}
                  />
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>
                    {converted.idea?.description}
                  </p>
                  <div className="flex gap-1.5 mt-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>{converted.idea?.area}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>{converted.idea?.waste_type}</span>
                  </div>
                </div>

                {/* Portfolio recommendation */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Portfolio</div>

                  {converted.recommendation?.action === 'use_existing' && (
                    <div className="space-y-2">
                      <div className="rounded-xl p-3" style={{ background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.2)' }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold" style={{ color: '#4ade80' }}>✓ Match found</span>
                          <span className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>{converted.recommendation.portfolio_name}</span>
                        </div>
                        <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{converted.recommendation.reason}</p>
                      </div>
                      <select value={ideaPortfolio} onChange={e => setIdeaPortfolio(e.target.value)}
                        className="w-full text-xs rounded-xl border px-3 py-2"
                        style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }}>
                        <option value="">Override portfolio…</option>
                        {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}

                  {converted.recommendation?.action === 'create_new' && (
                    <div className="space-y-2">
                      <div className="rounded-xl p-3" style={{ background: 'rgba(232,130,12,0.07)', border: '1px solid rgba(232,130,12,0.2)' }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold" style={{ color: '#E8820C' }}>⚠ No matching portfolio</span>
                        </div>
                        <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{converted.recommendation.reason}</p>
                      </div>
                      {!showCreatePf ? (
                        <div className="space-y-2">
                          <button onClick={() => setShowCreatePf(true)}
                            className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left"
                            style={{ background: 'rgba(232,130,12,0.08)', border: '1px solid rgba(232,130,12,0.25)' }}>
                            <div>
                              <p className="text-xs font-bold" style={{ color: '#E8820C' }}>+ Create "{converted.recommendation.new_name}"</p>
                              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>{converted.recommendation.new_area} · {converted.recommendation.new_objective?.slice(0, 55)}…</p>
                            </div>
                            <span className="text-xs ml-2 flex-shrink-0" style={{ color: '#E8820C' }}>→</span>
                          </button>
                          {portfolios.length > 0 && (
                            <select value={ideaPortfolio} onChange={e => setIdeaPortfolio(e.target.value)}
                              className="w-full text-xs rounded-xl border px-3 py-2"
                              style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }}>
                              <option value="">Or send to existing portfolio…</option>
                              {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                          <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>New Portfolio</div>
                          <input value={newPfName} onChange={e => setNewPfName(e.target.value)}
                            className="w-full text-sm rounded-xl border px-3 py-2"
                            style={{ background: 'var(--bg-card)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
                          <select value={newPfArea} onChange={e => setNewPfArea(e.target.value)}
                            className="w-full text-sm rounded-xl border px-3 py-2"
                            style={{ background: 'var(--bg-card)', borderColor: 'var(--border2)', color: 'var(--text-1)' }}>
                            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                          </select>
                          <div className="flex gap-2">
                            <button onClick={() => createPortfolioInline()}
                              disabled={!newPfName.trim() || creatingPf}
                              className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40"
                              style={{ background: '#E8820C' }}>
                              {creatingPf ? 'Creating…' : 'Create & Select →'}
                            </button>
                            <button onClick={() => setShowCreatePf(false)}
                              className="px-3 py-1.5 rounded-lg text-xs"
                              style={{ color: 'var(--text-3)' }}>Back</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Send button */}
                <button
                  onClick={async () => {
                    await sendAsIdea({
                      title: editedTitle || converted.idea?.title || `${pendingIdeaObs.waste_type} Waste — ${pendingIdeaObs.area}`,
                      waste_type: converted.idea?.waste_type || pendingIdeaObs.waste_type,
                      areaVal: converted.idea?.area || pendingIdeaObs.area,
                      source: 'floor_walk',
                      description: converted.idea?.description || pendingIdeaObs.text,
                      obsId: pendingIdeaObs.id,
                    })
                    closeObsModal()
                  }}
                  disabled={!ideaPortfolio || sendingIdea}
                  className="w-full py-3 rounded-xl text-white text-sm font-bold disabled:opacity-40"
                  style={{ background: '#E8820C' }}>
                  {sendingIdea ? 'Sending…' : ideaPortfolio ? `Send to Portfolio →` : 'Select a portfolio first'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ManualSendForm({ portfolios, ideaPortfolio, setIdeaPortfolio, showCreatePf, setShowCreatePf,
  newPfName, setNewPfName, newPfArea, setNewPfArea, creatingPf, createPortfolioInline,
  sendingIdea, onSend, onCancel, pColor, areas }) {
  return (
    <div className="space-y-3">
      {!showCreatePf ? (
        <>
          <select value={ideaPortfolio} onChange={e => setIdeaPortfolio(e.target.value)}
            className="w-full text-sm rounded-xl border px-3 py-2.5"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }}>
            <option value="">{portfolios.length > 0 ? 'Select portfolio…' : 'No portfolios yet'}</option>
            {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={() => setShowCreatePf(true)} className="text-xs font-semibold" style={{ color: pColor }}>
            + Create new portfolio
          </button>
        </>
      ) : (
        <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
          <input value={newPfName} onChange={e => setNewPfName(e.target.value)} placeholder="Portfolio name…"
            className="w-full text-sm rounded-xl border px-3 py-2"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
          <select value={newPfArea} onChange={e => setNewPfArea(e.target.value)}
            className="w-full text-sm rounded-xl border px-3 py-2"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border2)', color: 'var(--text-1)' }}>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={() => createPortfolioInline()} disabled={!newPfName.trim() || creatingPf}
              className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40"
              style={{ background: pColor }}>
              {creatingPf ? 'Creating…' : 'Create & Select →'}
            </button>
            <button onClick={() => setShowCreatePf(false)} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: 'var(--text-3)' }}>Back</button>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onSend} disabled={!ideaPortfolio || sendingIdea}
          className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-40"
          style={{ background: pColor }}>
          {sendingIdea ? 'Sending…' : 'Send as Idea →'}
        </button>
        <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm"
          style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>Cancel</button>
      </div>
    </div>
  )
}
