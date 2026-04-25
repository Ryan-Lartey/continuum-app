import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api.js'
import ObsCard from '../components/ObsCard.jsx'
import PresentationHotspot from '../components/PresentationHotspot.jsx'

const AREAS = ['Inbound', 'ICQA', 'Pick', 'Pack', 'Slam', 'Sort', 'Loading', 'Admin']
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
  Inbound: ['inbound', 'receiving', 'goods in', 'unload', 'delivery', 'intake', 'receive'],
  ICQA:    ['icqa', 'inventory control', 'quality audit', 'bin check', 'count', 'location audit', 'stock check'],
  Pick:    ['pick', 'picking', 'picker', 'pick zone', 'pick aisle', 'zone a', 'zone b', 'zone c'],
  Pack:    ['pack', 'packing', 'packer', 'boxing', 'carton', 'packing station', 'tape'],
  Slam:    ['slam', 'slammer', 'slam station', 'label', 'label station', 'print and apply'],
  Sort:    ['sort', 'sorting', 'sorter', 'chute', 'sort station', 'divert'],
  Loading: ['loading', 'load', 'trailer', 'dispatch', 'ship', 'shipping', 'outbound dock', 'trailers', 'despatch', 'loading bay'],
  Admin:   ['admin', 'office', 'paperwork', 'system error', 'computer', 'screen', 'log in'],
}

const glass = {
  background: 'rgba(17,17,20,0.6)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 14,
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

function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 64, h = 16
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ opacity: 0.6 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
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
  const [ideaSent, setIdeaSent]         = useState(null)
  const [pendingIdeaObs, setPendingIdeaObs] = useState(null)
  const [sentIdeaIds, setSentIdeaIds]       = useState(new Set())
  const [showCreatePf, setShowCreatePf]     = useState(false)
  const [newPfName, setNewPfName]           = useState('')
  const [newPfArea, setNewPfArea]           = useState('Pick')
  const [creatingPf, setCreatingPf]         = useState(false)
  const [converting, setConverting]         = useState(false)
  const [converted, setConverted]           = useState(null)
  const [editedTitle, setEditedTitle]       = useState('')

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
    setConverting(true)
    try {
      const result = await api.convertObservation(obs)
      setConverted(result)
      setEditedTitle(result.idea?.title || '')
      if (result.recommendation?.action === 'use_existing' && result.recommendation?.portfolio_id) {
        setIdeaPortfolio(String(result.recommendation.portfolio_id))
      }
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
        name: newPfName.trim(), area_focus: newPfArea, primary_kpi: 'uph',
        impact_goal: 0, impact_unit: 'improvement', strategic_objective: '',
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
      await api.createIdea({ portfolio_id: parseInt(ideaPortfolio), title, description: description || '', waste_type, area: areaVal || '', source })
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
      if (linkProject) {
        const p = await api.getProject(parseInt(linkProject))
        linkedProjectName = p.title
        const existing = p.charter?.clues || []
        await api.updateProject(p.id, {
          charter: { ...(p.charter || {}), clues: [...existing, { id: Date.now(), title: obsText.slice(0, 60), description: obsText, type: 'Floor Observation', area, wasteType }] },
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
        charter: { ...(p.charter || {}), clues: [...existing, { id: Date.now(), title: lastObs.text.slice(0, 60), description: lastObs.text, type: 'Floor Observation', area: lastObs.area, wasteType: lastObs.wasteType }] },
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
  const byWaste  = {}
  for (const o of last7) byWaste[o.waste_type] = (byWaste[o.waste_type] || 0) + 1
  const topWaste = Object.entries(byWaste).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const todayObs = observations.filter(o => o.date === new Date().toISOString().split('T')[0])

  const OUTBOUND_AREAS = ['Pick', 'Pack', 'Slam', 'Sort', 'Loading']
  const ZONE_DEFS = [
    { zoneName: 'Inbound',  areaNames: ['Inbound'],       color: '#3B7FDE' },
    { zoneName: 'ICQA',     areaNames: ['ICQA'],           color: '#7C3AED' },
    { zoneName: 'Outbound', areaNames: OUTBOUND_AREAS,     color: '#0891B2' },
  ]
  const zoneCards = ZONE_DEFS.map(({ zoneName, areaNames, color }) => {
    const zoneObs  = todayObs.filter(o => areaNames.includes(o.area))
    const weekObs  = last7.filter(o => areaNames.includes(o.area))
    const hasRed   = zoneObs.some(o => o.severity >= 3) || weekObs.length >= 4
    const hasAmber = zoneObs.some(o => o.severity >= 2) || weekObs.length >= 2
    const statusColor = hasRed ? '#EF4444' : hasAmber ? '#F59E0B' : '#22C55E'
    const statusLabel = hasRed ? 'Behind' : hasAmber ? 'Watch' : 'On Track'
    const topWasteZone = Object.entries(
      weekObs.reduce((acc, o) => { acc[o.waste_type] = (acc[o.waste_type] || 0) + 1; return acc }, {})
    ).sort((a, b) => b[1] - a[1])[0]
    const sparkData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      return observations.filter(o => areaNames.includes(o.area) && o.date === d).length
    })
    // per-area breakdown for Outbound
    const subBreakdown = zoneName === 'Outbound' ? OUTBOUND_AREAS.map(a => ({
      area: a,
      today: todayObs.filter(o => o.area === a).length,
      week: last7.filter(o => o.area === a).length,
    })) : null
    return { zoneName, areaNames, zoneObs, weekObs, statusColor, statusLabel, topWasteZone, sparkData, subBreakdown, color }
  })

  return (
    <div style={{ maxWidth: 1400 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Geist, sans-serif', fontSize: 30, fontWeight: 800, letterSpacing: '-0.04em', color: '#f0f0f2', lineHeight: 1.1 }}>
            Floor Walk
          </h1>
          <p style={{ fontSize: 13, color: '#8b8b97', marginTop: 4 }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            <span style={{ margin: '0 8px', color: 'rgba(255,255,255,0.15)' }}>·</span>
            {todayObs.length} obs today · {last7.length} this week
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onOpenAgent('gemba-agent', null)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)', cursor: 'pointer' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>radio_button_checked</span>
            Gemba Agent
          </button>
        </div>
      </div>

      {/* Pattern alerts */}
      {patterns.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {patterns.map(p => (
            <div key={p.waste_type} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)', borderLeft: '3px solid #f97316', boxShadow: '0 0 12px rgba(249,115,22,0.08)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f97316' }}>warning</span>
              <div>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#fb923c' }}>{p.waste_type}</span>
                <span style={{ fontSize: 12, marginLeft: 6, color: '#fca5a5' }}>{p.area}</span>
                <span style={{ fontSize: 12, marginLeft: 8, fontWeight: 700, color: '#fb923c' }}>{p.count}× this week</span>
              </div>
              <span style={{ fontSize: 11, marginLeft: 'auto', color: '#8b8b97' }}>Pattern detected</span>
            </div>
          ))}
        </div>
      )}

      {/* Zone cards grid — 3 top-level sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {zoneCards.map(({ zoneName, zoneObs, weekObs, statusColor, statusLabel, topWasteZone, sparkData, subBreakdown, color }) => (
          <div key={zoneName}
            style={{ ...glass, padding: 20, display: 'flex', flexDirection: 'column', cursor: 'default', borderTop: `2px solid ${statusColor}`, transition: 'box-shadow 220ms ease' }}>
            {/* Name + badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontFamily: 'Geist, sans-serif', fontWeight: 800, fontSize: 16, color: '#f0f0f2' }}>{zoneName}</span>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.07em', padding: '2px 8px', borderRadius: 999, background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}30` }}>
                {statusLabel.toUpperCase()}
              </span>
            </div>
            {/* Stats: today + week */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#4a4a57', marginBottom: 4 }}>Today</div>
                <div style={{ fontFamily: 'Geist, sans-serif', fontSize: 32, fontWeight: 800, letterSpacing: '-0.05em', color: zoneObs.length > 0 ? statusColor : '#f0f0f2', lineHeight: 1 }}>{zoneObs.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#4a4a57', marginBottom: 4 }}>7-Day</div>
                <div style={{ fontFamily: 'Geist, sans-serif', fontSize: 32, fontWeight: 800, letterSpacing: '-0.05em', color: weekObs.length > 3 ? '#F59E0B' : '#8b8b97', lineHeight: 1 }}>{weekObs.length}</div>
              </div>
            </div>
            {/* Outbound: sub-area mini breakdown */}
            {subBreakdown && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {subBreakdown.map(sub => (
                  <div key={sub.area} style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 7, background: sub.today > 0 ? `${statusColor}12` : 'rgba(255,255,255,0.04)', color: sub.today > 0 ? statusColor : '#4a4a57', border: `1px solid ${sub.today > 0 ? statusColor + '30' : 'rgba(255,255,255,0.06)'}` }}>
                    {sub.area} {sub.today > 0 && <span style={{ fontWeight: 800 }}>·{sub.today}</span>}
                  </div>
                ))}
              </div>
            )}
            {/* Bottom: top waste + sparkline */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 'auto' }}>
              {topWasteZone ? (
                <span style={{ fontSize: 10, color: '#4a4a57', fontWeight: 600 }}>{topWasteZone[0]} ×{topWasteZone[1]}</span>
              ) : (
                <span style={{ fontSize: 10, color: '#4a4a57' }}>No obs</span>
              )}
              <Sparkline data={sparkData} color={statusColor} />
            </div>
          </div>
        ))}
      </div>

      {/* Main 3-col grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* Left col: quick capture */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...glass, padding: 22, position: 'relative' }}>
            <PresentationHotspot id="floor-observation" demoMode={demoMode} />
            <h2 style={{ fontFamily: 'Geist, sans-serif', fontSize: 17, fontWeight: 700, color: '#f0f0f2', marginBottom: 18 }}>Log Observation</h2>

            <form onSubmit={handleSubmit}>
              <textarea
                value={obsText}
                onChange={e => setObsText(e.target.value)}
                placeholder="What did you see? Where, how long, what impact…"
                rows={4}
                autoFocus
                style={{
                  width: '100%', boxSizing: 'border-box', fontSize: 13, borderRadius: 10, padding: '10px 12px',
                  resize: 'none', marginBottom: 16, outline: 'none', fontFamily: 'Inter, sans-serif',
                  background: '#18181c', color: '#f0f0f2',
                  border: `1px solid ${severity === 3 ? '#DC2626' : obsText.trim() ? '#f97316' : 'rgba(255,255,255,0.08)'}`,
                }} />

              {/* Area pills */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#4a4a57', marginBottom: 8 }}>Area</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {AREAS.map(a => (
                    <button type="button" key={a} onClick={() => setArea(a)}
                      style={{ padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms',
                        background: area === a ? '#f97316' : 'rgba(255,255,255,0.04)',
                        color: area === a ? 'white' : '#8b8b97',
                        border: `1px solid ${area === a ? '#f97316' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {/* Severity */}
              <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#4a4a57', flexShrink: 0, width: 60 }}>Severity</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { val: 1, label: 'Low',      color: '#16A34A', bg: 'rgba(22,163,74,0.12)'  },
                    { val: 2, label: 'Medium',   color: '#E8820C', bg: 'rgba(232,130,12,0.12)' },
                    { val: 3, label: 'Critical', color: '#DC2626', bg: 'rgba(220,38,38,0.12)'  },
                  ].map(({ val, label, color, bg }) => (
                    <button type="button" key={val} onClick={() => setSeverity(val)}
                      style={{ padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        background: severity === val ? bg : 'rgba(255,255,255,0.04)',
                        color: severity === val ? color : '#4a4a57',
                        border: `1px solid ${severity === val ? color + '60' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Link to project */}
              <div style={{ marginBottom: 14 }}>
                {!showLinkProject ? (
                  <button type="button" onClick={() => setShowLinkProject(true)}
                    style={{ fontSize: 11, fontWeight: 600, color: '#4a4a57', background: 'none', border: 'none', cursor: 'pointer' }}>
                    + Link to project
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select value={linkProject} onChange={e => setLinkProject(e.target.value)}
                      style={{ flex: 1, fontSize: 12, borderRadius: 8, padding: '6px 10px', background: '#18181c', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f0f2' }}>
                      <option value="">No project link</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                    <button type="button" onClick={() => { setShowLinkProject(false); setLinkProject('') }}
                      style={{ fontSize: 11, color: '#4a4a57', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                  </div>
                )}
              </div>

              {/* Auto-detected waste */}
              {obsText.trim().length >= 10 && (
                <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#4a4a57' }}>Waste</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: `${WASTE_COLORS[wasteType]}18`, color: WASTE_COLORS[wasteType], border: `1px solid ${WASTE_COLORS[wasteType]}40` }}>
                    {autoDetected ? '✦ ' : ''}{wasteType}
                  </span>
                  {autoDetected && <span style={{ fontSize: 10, color: '#4a4a57' }}>auto-detected</span>}
                </div>
              )}

              <button type="submit" disabled={!obsText.trim() || saving}
                style={{ width: '100%', padding: '11px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, color: 'white', border: 'none', cursor: obsText.trim() && !saving ? 'pointer' : 'not-allowed', opacity: !obsText.trim() || saving ? 0.4 : 1, background: saved ? '#16A34A' : 'linear-gradient(135deg,#f97316,#ea580c)', transition: 'all 150ms' }}>
                {saved ? '✓ Logged' : saving ? 'Saving…' : 'Log Observation →'}
              </button>
            </form>

            {raisePrompt && !ideaSent && (
              <div style={{ marginTop: 14, borderRadius: 10, padding: 14, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#f87171', marginBottom: 6 }}>
                  ⚠ {raisePrompt.waste_type} in {raisePrompt.area} — {raisePrompt.count}× this week
                </p>
                <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10 }}>Same waste, same area. Send to a portfolio to evaluate before committing to a project.</p>
                {!showCreatePf ? (
                  <>
                    <select value={ideaPortfolio} onChange={e => setIdeaPortfolio(e.target.value)}
                      style={{ width: '100%', fontSize: 12, borderRadius: 8, padding: '6px 10px', marginBottom: 6, background: '#18181c', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f0f2', boxSizing: 'border-box' }}>
                      <option value="">{portfolios.length > 0 ? 'Select portfolio…' : 'No portfolios yet'}</option>
                      {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button onClick={() => setShowCreatePf(true)} style={{ fontSize: 11, fontWeight: 700, color: '#f97316', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 8, display: 'block' }}>+ Create new portfolio</button>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => sendAsIdea({ title: `${raisePrompt.waste_type} Waste — ${area}`, waste_type: raisePrompt.waste_type, areaVal: area, source: 'pattern', description: `${raisePrompt.count} occurrences in 7 days. Last observed: ${lastObs?.text?.slice(0, 80) || ''}` })}
                        disabled={!ideaPortfolio || sendingIdea}
                        style={{ flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'white', background: '#DC2626', border: 'none', cursor: !ideaPortfolio || sendingIdea ? 'not-allowed' : 'pointer', opacity: !ideaPortfolio || sendingIdea ? 0.4 : 1 }}>
                        {sendingIdea ? 'Sending…' : 'Send as Idea →'}
                      </button>
                      <button onClick={() => setRaisePrompt(null)} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, background: 'rgba(255,255,255,0.04)', color: '#8b8b97', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>Dismiss</button>
                    </div>
                  </>
                ) : (
                  <div style={{ borderRadius: 10, padding: 12, marginBottom: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#4a4a57', marginBottom: 8 }}>New Portfolio</div>
                    <input value={newPfName} onChange={e => setNewPfName(e.target.value)} placeholder="Portfolio name…"
                      style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, borderRadius: 8, padding: '6px 10px', marginBottom: 6, background: '#111114', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f0f2' }} />
                    <select value={newPfArea} onChange={e => setNewPfArea(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, borderRadius: 8, padding: '6px 10px', marginBottom: 8, background: '#111114', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f0f2' }}>
                      {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => createPortfolioInline()} disabled={!newPfName.trim() || creatingPf}
                        style={{ flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'white', background: '#f97316', border: 'none', cursor: 'pointer', opacity: !newPfName.trim() || creatingPf ? 0.4 : 1 }}>
                        {creatingPf ? 'Creating…' : 'Create →'}
                      </button>
                      <button onClick={() => setShowCreatePf(false)}
                        style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, background: 'transparent', color: '#8b8b97', border: 'none', cursor: 'pointer' }}>Back</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {ideaSent && (
              <div style={{ marginTop: 14, borderRadius: 10, padding: 14, textAlign: 'center', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>✓ Idea added to {ideaSent.portfolioName}</p>
                <p style={{ fontSize: 11, marginTop: 4, color: '#8b8b97' }}>Go to Portfolio → Ideas to review and define it</p>
                <button onClick={() => { onNavigate?.('portfolio'); setIdeaSent(null) }}
                  style={{ marginTop: 8, fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 8, background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: 'none', cursor: 'pointer' }}>
                  Open Portfolio →
                </button>
              </div>
            )}

            {lastObs?.linkedProjectName && !clueAdded && (
              <div style={{ marginTop: 14, borderRadius: 10, padding: 14, background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>✓ Linked to {lastObs.linkedProjectName}</p>
                <p style={{ fontSize: 11, marginTop: 4, color: '#8b8b97' }}>Added as a clue to the project charter</p>
              </div>
            )}

            {lastObs && !lastObs.linkedProjectName && !clueAdded && projects.length > 0 && (
              <div style={{ marginTop: 14, borderRadius: 10, padding: 14, background: 'rgba(59,127,222,0.06)', border: '1px solid rgba(59,127,222,0.2)' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>Add to a project as a clue?</p>
                <p style={{ fontSize: 11, color: '#8b8b97', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{lastObs.text.slice(0, 55)}{lastObs.text.length > 55 ? '…' : ''}"</p>
                <select value={clueProject} onChange={e => setClueProject(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, borderRadius: 8, padding: '6px 10px', marginBottom: 8, background: '#18181c', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f0f2' }}>
                  <option value="">Select project…</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={addClueToProject} disabled={!clueProject || addingClue}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'white', background: '#3B7FDE', border: 'none', cursor: 'pointer', opacity: !clueProject || addingClue ? 0.4 : 1 }}>
                    {addingClue ? 'Adding…' : 'Add as Clue →'}
                  </button>
                  <button onClick={() => setLastObs(null)}
                    style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, background: 'rgba(255,255,255,0.04)', color: '#8b8b97', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            {clueAdded && (
              <div style={{ marginTop: 14, borderRadius: 10, padding: 14, textAlign: 'center', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>✓ Clue added to project</p>
              </div>
            )}
          </div>

          {/* Top waste bar */}
          {topWaste.length > 0 && (
            <div style={{ ...glass, padding: 18 }}>
              <h3 style={{ fontFamily: 'Geist, sans-serif', fontSize: 14, fontWeight: 700, color: '#f0f0f2', marginBottom: 14 }}>Top Waste This Week</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {topWaste.map(([waste, count]) => {
                  const color = WASTE_COLORS[waste] || '#6B7280'
                  const pct   = Math.round((count / last7.length) * 100)
                  return (
                    <div key={waste}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color }}>{waste}</span>
                        <span style={{ fontSize: 12, color: '#4a4a57' }}>{count}</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.04)' }}>
                        <div style={{ height: 4, borderRadius: 999, width: `${pct}%`, background: color, transition: 'width 600ms ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Middle col: active projects + filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {projects.length > 0 && (
            <div style={{ ...glass, padding: 18 }}>
              <h3 style={{ fontFamily: 'Geist, sans-serif', fontSize: 14, fontWeight: 700, color: '#f0f0f2', marginBottom: 14 }}>Active Projects</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {projects.slice(0, 6).map(p => (
                  <button key={p.id} onClick={() => onNavigate?.('projects', p)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', textAlign: 'left', transition: 'background 150ms' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#f0f0f2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                      <div style={{ fontSize: 10, color: '#4a4a57', marginTop: 2 }}>{p.stage} · {p.area}</div>
                    </div>
                    <span style={{ fontSize: 12, color: '#4a4a57', marginLeft: 8, flexShrink: 0 }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Area filter */}
          <div style={{ ...glass, padding: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#4a4a57', marginBottom: 10 }}>Filter by Area</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {['All', ...AREAS].map(a => (
                <button key={a} onClick={() => setFilterArea(a)}
                  style={{ padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: filterArea === a ? '#f0f0f2' : 'rgba(255,255,255,0.04)',
                    color: filterArea === a ? '#09090b' : '#8b8b97',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}>
                  {a === 'All' ? 'All areas' : a}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#4a4a57', marginBottom: 10 }}>Filter by Waste</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['All', ...WASTE_TYPES].map(w => (
                <button key={w} onClick={() => setFilterWaste(w)}
                  style={{ padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: filterWaste === w && w !== 'All' ? WASTE_COLORS[w] : filterWaste === w ? '#f0f0f2' : 'rgba(255,255,255,0.04)',
                    color: filterWaste === w && w !== 'All' ? 'white' : filterWaste === w ? '#09090b' : '#8b8b97',
                    border: filterWaste === w && w !== 'All' ? `1px solid ${WASTE_COLORS[w]}` : '1px solid rgba(255,255,255,0.08)',
                  }}>
                  {w === 'All' ? 'All waste' : w}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right col: active observations */}
        <div style={{ ...glass, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'Geist, sans-serif', fontSize: 15, fontWeight: 700, color: '#f0f0f2' }}>Active Observations</h3>
              <span style={{ fontSize: 11, color: '#4a4a57', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.06)' }}>
                {filtered.length}
              </span>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#4a4a57', display: 'block', marginBottom: 12 }}>radio_button_checked</span>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#4a4a57' }}>No observations yet</div>
                <div style={{ fontSize: 11, marginTop: 6, color: '#4a4a57' }}>Log your first floor walk observation</div>
              </div>
            ) : (
              filtered.slice(0, 60).map(o => (
                <ObsCard key={o.id} obs={o} onDelete={handleDelete}
                  sentAsIdea={sentIdeaIds.has(o.id)}
                  onSendAsIdea={(obs) => openObsModal(obs)} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Obs → Idea modal */}
      {pendingIdeaObs && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={closeObsModal}>
          <div style={{ width: '100%', maxWidth: 440, borderRadius: 18, boxShadow: '0 24px 60px rgba(0,0,0,0.6)', background: '#111114', border: '1px solid rgba(255,255,255,0.08)' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 12px' }}>
              <div>
                <h3 style={{ fontFamily: 'Geist, sans-serif', fontSize: 15, fontWeight: 700, color: '#f0f0f2' }}>Send as Idea</h3>
                <p style={{ fontSize: 11, marginTop: 2, color: '#4a4a57' }}>AI is converting your observation</p>
              </div>
              <button onClick={closeObsModal}
                style={{ width: 28, height: 28, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, background: 'rgba(255,255,255,0.06)', color: '#8b8b97', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ margin: '0 20px 16px', borderRadius: 10, padding: 12, background: '#18181c', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${WASTE_COLORS[pendingIdeaObs.waste_type] || '#6B7280'}18`, color: WASTE_COLORS[pendingIdeaObs.waste_type] || '#6B7280' }}>
                  {pendingIdeaObs.waste_type}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', color: '#8b8b97' }}>
                  {pendingIdeaObs.area}
                </span>
              </div>
              <p style={{ fontSize: 12, color: '#8b8b97', lineHeight: 1.5 }}>
                {pendingIdeaObs.text.slice(0, 140)}{pendingIdeaObs.text.length > 140 ? '…' : ''}
              </p>
            </div>

            {converting && (
              <div style={{ padding: '0 20px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20, color: '#a78bfa', animation: 'spin 1s linear infinite' }}>◈</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#f0f0f2' }}>Analysing observation…</p>
                  <p style={{ fontSize: 11, marginTop: 2, color: '#4a4a57' }}>Converting to idea · evaluating portfolio fit</p>
                </div>
              </div>
            )}

            {!converting && converted?.error && (
              <div style={{ padding: '0 20px 20px' }}>
                <p style={{ fontSize: 12, color: '#f87171', marginBottom: 12 }}>AI conversion failed. You can still send manually.</p>
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
                  onCancel={closeObsModal} pColor="#f97316" areas={AREAS}
                />
              </div>
            )}

            {!converting && converted && !converted.error && (
              <div style={{ padding: '0 20px 20px' }}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#a78bfa' }}>✦ AI Idea Draft</span>
                    <span style={{ fontSize: 10, color: '#4a4a57' }}>edit title if needed</span>
                  </div>
                  <input value={editedTitle} onChange={e => setEditedTitle(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, fontWeight: 600, borderRadius: 10, padding: '9px 12px', marginBottom: 8, background: '#18181c', border: '1px solid rgba(167,139,250,0.4)', color: '#f0f0f2' }} />
                  <p style={{ fontSize: 12, color: '#8b8b97', lineHeight: 1.5 }}>{converted.idea?.description}</p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', color: '#8b8b97' }}>{converted.idea?.area}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', color: '#8b8b97' }}>{converted.idea?.waste_type}</span>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#4a4a57', marginBottom: 8 }}>Portfolio</div>
                  {converted.recommendation?.action === 'use_existing' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ borderRadius: 10, padding: 12, background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>✓ Match found</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#f0f0f2' }}>{converted.recommendation.portfolio_name}</span>
                        </div>
                        <p style={{ fontSize: 11, color: '#8b8b97' }}>{converted.recommendation.reason}</p>
                      </div>
                      <select value={ideaPortfolio} onChange={e => setIdeaPortfolio(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, borderRadius: 10, padding: '8px 12px', background: '#18181c', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f0f2' }}>
                        <option value="">Override portfolio…</option>
                        {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}
                  {converted.recommendation?.action === 'create_new' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ borderRadius: 10, padding: 12, background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#f97316' }}>⚠ No matching portfolio</span>
                        </div>
                        <p style={{ fontSize: 11, color: '#8b8b97' }}>{converted.recommendation.reason}</p>
                      </div>
                      {!showCreatePf ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <button onClick={() => setShowCreatePf(true)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, padding: '10px 14px', background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.22)', cursor: 'pointer' }}>
                            <div>
                              <p style={{ fontSize: 12, fontWeight: 700, color: '#f97316' }}>+ Create "{converted.recommendation.new_name}"</p>
                              <p style={{ fontSize: 10, marginTop: 2, color: '#8b8b97' }}>{converted.recommendation.new_area} · {converted.recommendation.new_objective?.slice(0, 55)}…</p>
                            </div>
                            <span style={{ fontSize: 12, color: '#f97316', marginLeft: 8 }}>→</span>
                          </button>
                          {portfolios.length > 0 && (
                            <select value={ideaPortfolio} onChange={e => setIdeaPortfolio(e.target.value)}
                              style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, borderRadius: 10, padding: '8px 12px', background: '#18181c', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f0f2' }}>
                              <option value="">Or send to existing portfolio…</option>
                              {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          )}
                        </div>
                      ) : (
                        <div style={{ borderRadius: 10, padding: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#4a4a57', marginBottom: 10 }}>New Portfolio</div>
                          <input value={newPfName} onChange={e => setNewPfName(e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, borderRadius: 10, padding: '9px 12px', marginBottom: 8, background: '#111114', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f0f2' }} />
                          <select value={newPfArea} onChange={e => setNewPfArea(e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, borderRadius: 10, padding: '9px 12px', marginBottom: 10, background: '#111114', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f0f2' }}>
                            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                          </select>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => createPortfolioInline()} disabled={!newPfName.trim() || creatingPf}
                              style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, color: 'white', background: '#f97316', border: 'none', cursor: 'pointer', opacity: !newPfName.trim() || creatingPf ? 0.4 : 1 }}>
                              {creatingPf ? 'Creating…' : 'Create & Select →'}
                            </button>
                            <button onClick={() => setShowCreatePf(false)}
                              style={{ padding: '9px 14px', borderRadius: 10, fontSize: 13, background: 'transparent', color: '#8b8b97', border: 'none', cursor: 'pointer' }}>Back</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={async () => {
                    await sendAsIdea({ title: editedTitle || converted.idea?.title || `${pendingIdeaObs.waste_type} Waste — ${pendingIdeaObs.area}`, waste_type: converted.idea?.waste_type || pendingIdeaObs.waste_type, areaVal: converted.idea?.area || pendingIdeaObs.area, source: 'floor_walk', description: converted.idea?.description || pendingIdeaObs.text, obsId: pendingIdeaObs.id })
                    closeObsModal()
                  }}
                  disabled={!ideaPortfolio || sendingIdea}
                  style={{ width: '100%', padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 700, color: 'white', border: 'none', cursor: !ideaPortfolio || sendingIdea ? 'not-allowed' : 'pointer', opacity: !ideaPortfolio || sendingIdea ? 0.4 : 1, background: 'linear-gradient(135deg,#f97316,#ea580c)', transition: 'opacity 150ms' }}>
                  {sendingIdea ? 'Sending…' : ideaPortfolio ? 'Send to Portfolio →' : 'Select a portfolio first'}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!showCreatePf ? (
        <>
          <select value={ideaPortfolio} onChange={e => setIdeaPortfolio(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, borderRadius: 10, padding: '9px 12px', background: '#18181c', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f0f2' }}>
            <option value="">{portfolios.length > 0 ? 'Select portfolio…' : 'No portfolios yet'}</option>
            {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={() => setShowCreatePf(true)} style={{ fontSize: 12, fontWeight: 700, color: pColor, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            + Create new portfolio
          </button>
        </>
      ) : (
        <div style={{ borderRadius: 10, padding: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <input value={newPfName} onChange={e => setNewPfName(e.target.value)} placeholder="Portfolio name…"
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, borderRadius: 10, padding: '9px 12px', marginBottom: 8, background: '#111114', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f0f2' }} />
          <select value={newPfArea} onChange={e => setNewPfArea(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, borderRadius: 10, padding: '9px 12px', marginBottom: 10, background: '#111114', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f0f2' }}>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => createPortfolioInline()} disabled={!newPfName.trim() || creatingPf}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'white', background: pColor, border: 'none', cursor: 'pointer', opacity: !newPfName.trim() || creatingPf ? 0.4 : 1 }}>
              {creatingPf ? 'Creating…' : 'Create & Select →'}
            </button>
            <button onClick={() => setShowCreatePf(false)} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, color: '#8b8b97', background: 'transparent', border: 'none', cursor: 'pointer' }}>Back</button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onSend} disabled={!ideaPortfolio || sendingIdea}
          style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, color: 'white', background: pColor, border: 'none', cursor: !ideaPortfolio || sendingIdea ? 'not-allowed' : 'pointer', opacity: !ideaPortfolio || sendingIdea ? 0.4 : 1 }}>
          {sendingIdea ? 'Sending…' : 'Send as Idea →'}
        </button>
        <button onClick={onCancel} style={{ padding: '10px 16px', borderRadius: 10, fontSize: 13, background: 'rgba(255,255,255,0.04)', color: '#8b8b97', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  )
}
