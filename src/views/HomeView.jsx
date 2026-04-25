import { useState, useEffect, useRef } from 'react'
import { api, streamAgent } from '../lib/api.js'
import PresentationHotspot from '../components/PresentationHotspot.jsx'

const DEFAULT_TARGETS = { UPH: 100, Accuracy: 99.5, DPMO: 500, DTS: 98 }

function buildMetrics(targets) {
  const t = targets || DEFAULT_TARGETS
  return [
    { id: 'uph',      label: 'UPH',      unit: '',  target: t.UPH ?? 100,       higher: true  },
    { id: 'accuracy', label: 'Accuracy', unit: '%', target: t.Accuracy ?? 99.5,  higher: true  },
    { id: 'dpmo',     label: 'DPMO',     unit: '',  target: t.DPMO ?? 500,       higher: false },
    { id: 'dts',      label: 'DTS',      unit: '%', target: t.DTS ?? 98,         higher: true  },
  ]
}

const STAGE_COLORS = {
  Identify: '#E8820C', Define: '#3B7FDE', Measure: '#7C3AED',
  Analyse: '#DC2626', Improve: '#16A34A', Control: '#059669', Closed: '#6B7280',
}
const STAGE_ICONS = {
  Identify: '🔍', Define: '📋', Measure: '📊', Analyse: '🔬',
  Improve: '⚡', Control: '✅', Closed: '✓',
}
const WASTE_COLORS = {
  Transport: '#3B7FDE', Inventory: '#7C3AED', Motion: '#16A34A', Waiting: '#E8820C',
  Overproduction: '#DC2626', Overprocessing: '#0891B2', Defects: '#B91C1C', Skills: '#059669',
}
const DMAIC = ['Identify', 'Define', 'Measure', 'Analyse', 'Improve', 'Control']
const TODAY = new Date().toISOString().split('T')[0]
let _briefGenDate = null

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function renderBold(line) {
  const parts = line.split(/\*\*(.+?)\*\*/g)
  return parts.map((p, i) => i % 2 === 1
    ? <strong key={i} style={{ color: 'var(--text-1)', fontWeight: 700 }}>{p}</strong>
    : p)
}

function BriefMarkdown({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^\|/.test(line)) {
      const tableLines = []
      while (i < lines.length && /^\|/.test(lines[i])) {
        const cells = lines[i].split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
        if (!cells.every(c => /^[-:]+$/.test(c.trim()))) tableLines.push(cells)
        i++
      }
      if (tableLines.length >= 2) {
        elements.push(
          <div key={`t${i}`} style={{ overflowX: 'auto', margin: '4px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                {tableLines[0].map((h, hi) => <th key={hi} style={{ textAlign: 'left', padding: '3px 8px', fontWeight: 700, color: 'var(--text-3)', fontSize: 10, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h.trim()}</th>)}
              </tr></thead>
              <tbody>{tableLines.slice(1).map((row, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid var(--border)' }}>
                  {row.map((cell, ci) => <td key={ci} style={{ padding: '3px 8px', color: 'var(--text-2)', fontSize: 11 }}>{cell.trim()}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
        )
      }
      continue
    }
    if (/^### /.test(line)) elements.push(<div key={i} style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-1)', marginTop: 8, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{line.slice(4)}</div>)
    else if (/^## /.test(line)) elements.push(<div key={i} style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-1)', marginTop: 10, marginBottom: 2 }}>{line.slice(3)}</div>)
    else if (/^# /.test(line)) elements.push(<div key={i} style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-1)', marginTop: 12, marginBottom: 3 }}>{line.slice(2)}</div>)
    else if (/^[-*] /.test(line)) elements.push(<div key={i} style={{ display: 'flex', gap: 6, marginBottom: 2 }}><span style={{ color: 'var(--text-3)', flexShrink: 0 }}>•</span><span>{renderBold(line.slice(2))}</span></div>)
    else if (/^---+$/.test(line.trim())) elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '6px 0' }} />)
    else if (line.trim() === '') elements.push(<div key={i} style={{ height: 5 }} />)
    else elements.push(<div key={i} style={{ marginBottom: 1 }}>{renderBold(line)}</div>)
    i++
  }
  return <div style={{ fontSize: 12, lineHeight: 1.65, color: 'var(--text-2)' }}>{elements}</div>
}

const HEADCOUNT_KEY = `continuum_headcount_${TODAY}`
function loadHeadcount() {
  try { return JSON.parse(localStorage.getItem(HEADCOUNT_KEY)) || { inbound: '', outbound: '', pick: '' } }
  catch { return { inbound: '', outbound: '', pick: '' } }
}
function headcountString(hc) {
  if (!hc.inbound && !hc.outbound && !hc.pick) return ''
  return `Current headcount: Inbound: ${hc.inbound || '—'}, Outbound: ${hc.outbound || '—'}, Pick: ${hc.pick || '—'}.`
}

// ─── Glass card shared style ──────────────────────────────────────────────────
const glass = {
  background: 'rgba(17,17,20,0.6)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 14,
}

export default function HomeView({ onOpenAgent, onNavigate, onOpenPortfolio, demoMode }) {
  const [latestKpis, setLatestKpis]         = useState({})
  const [allKpis, setAllKpis]               = useState([])
  const [projects, setProjects]             = useState([])
  const [brief, setBrief]                   = useState(null)
  const [signals, setSignals]               = useState([])
  const [patterns, setPatterns]             = useState([])
  const [todayObs, setTodayObs]             = useState(0)
  const [briefStreaming, setBriefStreaming]  = useState(false)
  const [briefStreamText, setBriefStreamText] = useState('')
  const [tier2Today, setTier2Today]         = useState(null)
  const [priorities, setPriorities]         = useState([])
  const [priorityIdx, setPriorityIdx]       = useState(0)
  const [priorityLoading, setPriorityLoading] = useState(false)
  const [checkedPriorities, setCheckedPriorities] = useState([])
  const [articulateText, setArticulateText] = useState('')
  const [articulateLoading, setArticulateLoading] = useState(false)
  const [showArticulate, setShowArticulate] = useState(false)
  const [portfolios, setPortfolios]         = useState([])
  const [allObs, setAllObs]                 = useState([])
  const [taskTab, setTaskTab]               = useState('upcoming')
  const [tier2Prepped, setTier2Prepped]     = useState(false)
  const [recentIdeas, setRecentIdeas]       = useState([])
  const [kpiTargets, setKpiTargets]         = useState(DEFAULT_TARGETS)
  const [headcount, setHeadcount]           = useState(loadHeadcount)
  const [headcountSaved, setHeadcountSaved] = useState(false)
  const [nudges, setNudges]                 = useState([])
  const [sections, setSections]             = useState([])
  const autoGenFired    = useRef(false)
  const prioritiesFired = useRef(false)

  function saveHeadcount() {
    localStorage.setItem(HEADCOUNT_KEY, JSON.stringify(headcount))
    setHeadcountSaved(true)
    setTimeout(() => setHeadcountSaved(false), 2000)
  }

  useEffect(() => {
    api.getSite().then(s => { if (s.kpi_targets) setKpiTargets(s.kpi_targets) }).catch(() => {})
    Promise.all([
      api.getLatestKpis().catch(() => ({})),
      api.getKpis().catch(() => []),
      api.getProjects().catch(() => []),
      api.getLatestBrief().catch(() => null),
      api.getPatterns().catch(() => []),
      api.getObservations().catch(() => []),
      api.getTier2Today().catch(() => null),
      api.getPortfolios().catch(() => []),
      api.getIdeas({ limit: 5 }).catch(() => []),
      api.getSections().catch(() => []),
    ]).then(([kpis, allK, ps, latestBrief, pats, obs, t2, pfs, ideas, secs]) => {
      setLatestKpis(kpis)
      setAllKpis(allK)
      setProjects(ps.filter(p => p.stage !== 'Closed'))
      setBrief(latestBrief)
      setPatterns(pats)
      setTodayObs(obs.filter(o => o.date === TODAY).length)
      if (t2) setTier2Today(t2)
      setPortfolios(pfs)
      setRecentIdeas(Array.isArray(ideas) ? ideas : [])
      setSections(Array.isArray(secs) ? secs : [])
      setAllObs(obs)

      const briefIsError = (latestBrief?.content || '').includes('No API key configured')
      const briefExists = latestBrief && (latestBrief.created_at || '').startsWith(TODAY) && !briefIsError
      if (briefIsError) setBrief(null)
      const hour = new Date().getHours()
      if (!briefExists && hour >= 5 && _briefGenDate !== TODAY) {
        _briefGenDate = TODAY
        autoGenFired.current = true
        autoGenerateBrief(kpis, ps, pats)
      }
      if (!prioritiesFired.current) {
        prioritiesFired.current = true
        generatePriorities(kpis, ps, pats, obs)
      }

      const dismissed = new Set(JSON.parse(sessionStorage.getItem('continuum_dismissed_nudges') || '[]'))
      const computed = []
      const now = new Date()
      ps.filter(p => p.stage !== 'Closed' && p.stage !== 'finished').forEach(p => {
        const updatedAt = p.updated_at ? new Date(p.updated_at) : null
        if (!updatedAt) return
        const days = Math.floor((now - updatedAt) / 86400000)
        if (days > 14) {
          const id = `stalled-project-${p.id}`
          if (!dismissed.has(id)) computed.push({ id, icon: '⚠', message: `${p.title} hasn't moved in ${days} days. Want to update it?`, action: 'Open Projects', onAction: () => onNavigate('projects', p), urgency: days })
        }
      })
      const cutoff14 = new Date(now - 14 * 86400000).toISOString().split('T')[0]
      const recentObs = obs.filter(o => o.date >= cutoff14)
      const wasteCounts = {}
      recentObs.forEach(o => { if (o.waste_type) wasteCounts[o.waste_type] = (wasteCounts[o.waste_type] || 0) + 1 })
      Object.entries(wasteCounts).forEach(([type, count]) => {
        if (count >= 3) {
          const id = `waste-pattern-${type}`
          if (!dismissed.has(id)) computed.push({ id, icon: '📊', message: `You've logged ${count} ${type} observations recently. Want to raise an idea?`, action: 'Go to Floor', onAction: () => onNavigate('floor'), urgency: count * 2 })
        }
      })
      const latestKpiEntry = allK.length > 0 ? allK[allK.length - 1] : null
      if (latestKpiEntry) {
        const kpiDate = latestKpiEntry.date || (latestKpiEntry.created_at || '').split('T')[0]
        const kpiDays = kpiDate ? Math.floor((now - new Date(kpiDate)) / 86400000) : null
        if (kpiDays !== null && kpiDays > 2) {
          const id = 'kpis-not-logged'
          if (!dismissed.has(id)) computed.push({ id, icon: '📉', message: `KPIs haven't been logged in ${kpiDays} day${kpiDays !== 1 ? 's' : ''}. Log now?`, action: 'Log KPIs', onAction: () => onNavigate('data'), urgency: kpiDays * 3 })
        }
      } else {
        const id = 'kpis-not-logged'
        if (!dismissed.has(id)) computed.push({ id, icon: '📉', message: `No KPIs logged yet. Log now?`, action: 'Log KPIs', onAction: () => onNavigate('data'), urgency: 10 })
      }
      if (Array.isArray(ideas)) {
        ideas.forEach(idea => {
          if ((idea.stage || '').toLowerCase() === 'definition') {
            const updatedAt = idea.updated_at ? new Date(idea.updated_at) : null
            if (!updatedAt) return
            const days = Math.floor((now - updatedAt) / 86400000)
            if (days > 14) {
              const id = `idea-stuck-${idea.id}`
              if (!dismissed.has(id)) computed.push({ id, icon: '💡', message: `'${idea.title}' has been in definition for ${days} days. Review it?`, action: 'View Portfolio', onAction: () => onNavigate('portfolio'), urgency: days })
            }
          }
        })
      }
      computed.sort((a, b) => b.urgency - a.urgency)
      setNudges(computed.slice(0, 3))
    })
  }, [])

  useEffect(() => {
    setSignals(Object.entries(latestKpis).filter(([, v]) => v?.signal).map(([k]) => k))
  }, [latestKpis])

  function autoGenerateBrief(kpis, ps, pats) {
    setBriefStreaming(true)
    setBriefStreamText('')
    const signalList = Object.entries(kpis).filter(([, v]) => v?.signal).map(([k]) => k)
    const hcStr = headcountString(loadHeadcount())
    const prompt = `Generate my morning brief. KPIs: ${JSON.stringify(kpis)}. Active projects: ${ps.map(p => p.title + ' (' + p.stage + ')').join(', ') || 'none'}. SPC signals: ${signalList.join(', ') || 'none'}. Waste patterns: ${pats.map(p => p.waste_type + ' x' + p.count).join(', ') || 'none'}.${hcStr ? ' ' + hcStr : ''} Be sharp, brief, actionable. No preamble.`
    let accumulated = ''
    streamAgent('chief-of-staff', [{ role: 'user', content: prompt }], null,
      chunk => { accumulated += chunk; setBriefStreamText(accumulated) },
      () => {
        api.saveBrief({ date: TODAY, content: accumulated, type: 'daily' }).then(saved => setBrief(saved)).catch(() => {
          setBrief({ content: accumulated, created_at: new Date().toISOString() })
        })
        setBriefStreaming(false)
        setBriefStreamText('')
      },
      () => { setBriefStreaming(false); setBriefStreamText('') }
    )
  }

  function generatePriorities(kpis, ps, pats, obs) {
    setPriorityLoading(true)
    setPriorities([])
    setPriorityIdx(0)
    setCheckedPriorities([])
    setShowArticulate(false)
    setArticulateText('')
    const todayCount = obs.filter(o => o.date === TODAY).length
    const overdue    = ps.flatMap(p => (p.actions || []).filter(a => !a.done && a.due && a.due < TODAY).map(a => `${a.text} (${p.title})`))
    const projectData = ps.map(p => {
      const next = (p.actions || []).find(a => !a.done)
      const done = (p.actions || []).filter(a => a.done).length
      const tot  = (p.actions || []).length
      const typeLabel = p.project_type === 'quick_win' ? 'Quick Win'
        : p.project_type === 'yellow_belt' ? 'Yellow Belt'
        : p.project_type === 'green_belt' ? 'Green Belt'
        : p.project_type === 'black_belt' ? 'Black Belt'
        : p.project_type === 'investigation' ? 'Investigation'
        : p.project_type || 'Unknown'
      return `${p.title} [${p.stage}, ${typeLabel}] — ${done}/${tot} actions done${next ? ', next: ' + next.text : ''}`
    }).join('\n')
    const METRICS = buildMetrics(kpiTargets)
    const kpiLines = Object.entries(kpis).map(([k, v]) => {
      const m    = METRICS.find(x => x.id === k)
      const diff = v?.value !== undefined && m ? ((v.value - m.target) / m.target * 100).toFixed(1) : null
      return `${k.toUpperCase()}: ${v?.value ?? 'not logged'} (target ${m?.target ?? '—'}${diff !== null ? `, ${diff > 0 ? '+' : ''}${diff}%` : ''})`
    }).join('\n')
    const hcStr = headcountString(loadHeadcount())
    const prompt = `You are Ryan's CI coach at an Amazon FC (ID Logistics). Generate his prioritised action queue for right now.\n\nData:\nKPIs:\n${kpiLines || 'No KPIs logged today'}\n\nProjects:\n${projectData || 'None'}\n\nFloor observations today: ${todayCount}\nOverdue actions: ${overdue.length > 0 ? overdue.join('; ') : 'none'}\nWaste patterns (48h): ${pats.map(p => p.waste_type + ' ×' + p.count).join(', ') || 'none'}\nCurrent time: ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}${hcStr ? '\n' + hcStr : ''}\n\nOutput a JSON array of 3-5 priorities. Each object must have exactly these fields:\n- "action": what to do right now — specific, starts with a verb, uses real numbers from the data\n- "why": one sentence explaining why this is the priority — be concrete\n- "type": one of "task" | "floor" | "data" | "meeting" | "escalation"\n\nOrder by urgency and impact. Only include things that genuinely need doing today.\nOutput ONLY the JSON array. No markdown. No explanation.`
    let acc = ''
    streamAgent('chief-of-staff', [{ role: 'user', content: prompt }], null,
      chunk => { acc += chunk },
      () => {
        try {
          const parsed = JSON.parse(acc.replace(/```json|```/g, '').trim())
          if (Array.isArray(parsed)) setPriorities(parsed)
        } catch { setPriorities([{ action: 'Could not parse priorities — refresh to try again', why: '', type: 'task' }]) }
        setPriorityLoading(false)
      },
      () => { setPriorityLoading(false) }
    )
  }

  function generateArticulate(priority) {
    setArticulateLoading(true)
    setArticulateText('')
    setShowArticulate(true)
    const METRICS = buildMetrics(kpiTargets)
    const kpiLines = Object.entries(latestKpis).map(([k, v]) => {
      const m = METRICS.find(x => x.id === k)
      return `${k.toUpperCase()}: ${v?.value ?? '—'} vs target ${m?.target ?? '—'}`
    }).join(', ')
    const prompt = `Ryan needs to raise this with his ops manager or in his Tier 2 meeting:\n\n"${priority.action}"\nWhy it matters: ${priority.why}\nKPI context: ${kpiLines || 'no KPIs logged'}\n\nWrite his talking points in exactly this format — no intro, no outro:\n\n**Situation:** [1 sentence — what's happening, with the number if available]\n**Impact:** [1 sentence — what this means for the operation]\n**What I'm doing:** [1 sentence — his plan or what he's already done]\n**Ask:** [1 sentence — what he needs from management, or "No ask — informing you" if none]\n\nFirst person. Confident. Meeting-ready. No waffle.`
    let acc = ''
    streamAgent('chief-of-staff', [{ role: 'user', content: prompt }], null,
      chunk => { acc += chunk; setArticulateText(acc) },
      () => { setArticulateLoading(false) },
      () => { setArticulateLoading(false) }
    )
  }

  // ─── Computed ────────────────────────────────────────────────────────────────
  const METRICS = buildMetrics(kpiTargets)
  const todayKpiLogged = Object.values(latestKpis).some(k => k?.date === TODAY)
  const briefToday     = brief && (brief.created_at || '').startsWith(TODAY)
  const overdueActions = projects.flatMap(p =>
    (p.actions || []).filter(a => !a.done && a.due && a.due < TODAY).map(a => ({ ...a, project: p.title }))
  )
  const allTasks      = projects.flatMap(p => (p.actions || []).map(a => ({ ...a, projectTitle: p.title })))
  const upcomingTasks = allTasks.filter(a => !a.done && a.status !== 'Complete' && (!a.due || a.due >= TODAY))
  const overdueTasks  = allTasks.filter(a => !a.done && a.status !== 'Complete' && a.due && a.due < TODAY)
  const displayBriefContent = briefStreaming ? briefStreamText : brief?.content
  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const hour = new Date().getHours()
  const shiftLabel = hour >= 6 && hour < 18 ? 'Day Shift' : 'Night Shift'

  function openTier2() {
    const kpiLines = Object.entries(latestKpis).map(([k, v]) => {
      const m = METRICS.find(x => x.id === k)
      return `${k.toUpperCase()}: ${v?.value ?? 'not logged'} (target ${m?.target ?? '—'})${v?.signal ? ' ⚠ SIGNAL' : ''}`
    }).join(', ')
    const patternLines = patterns.map(p => `${p.waste_type} ×${p.count} in ${p.area}`).join(', ')
    const overdueLines = overdueActions.map(a => `${a.text} (${a.project})`).join('; ')
    const hcStr = headcountString(headcount)
    const msg = `Prepare my Tier 2 brief for right now.\n\nKPIs: ${kpiLines || 'not logged yet'}\nWaste patterns: ${patternLines || 'none'}\nOverdue actions: ${overdueLines || 'none'}\nActive projects: ${projects.map(p => p.title + ' [' + p.stage + ']').join(', ') || 'none'}${hcStr ? '\n' + hcStr : ''}\n\nGive me: key KPI status (RAG), top 2 talking points, and any escalations I need to raise.`
    setTier2Prepped(true)
    onOpenAgent('situation-room', msg)
  }

  const routinePills = [
    { label: 'Brief',  done: briefToday || briefStreaming, onClick: () => autoGenerateBrief(latestKpis, projects, patterns) },
    { label: 'KPIs',   done: todayKpiLogged,               onClick: () => onNavigate('data') },
    { label: 'Floor',  done: todayObs > 0,                 onClick: () => onNavigate('floor') },
    { label: 'Tier 2', done: tier2Prepped,                 onClick: openTier2 },
  ]
  const routineDone = routinePills.filter(p => p.done).length
  const allGreen    = routineDone === 4

  const todayObsList = allObs.filter(o => o.date === TODAY)

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  function sectionRag(s) {
    if (!s || s.score_status === 'no_data' || s.score === null) return { color: '#94A3B8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)', label: 'No Data' }
    if (s.score >= 80) return { color: '#22C55E', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', label: 'Healthy' }
    if (s.score >= 60) return { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', label: 'At Risk' }
    return { color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', label: 'Critical' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1400 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: 4 }}>
        <div>
          <h1 style={{ fontFamily: 'Geist, Inter, sans-serif', fontSize: 30, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text-1)', margin: 0 }}>
            {getGreeting()}, Ryan
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{dateStr}</span>
            <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.12)', display: 'inline-block' }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#4ade80', background: 'rgba(74,222,128,0.1)', padding: '3px 10px', borderRadius: 999, border: '1px solid rgba(74,222,128,0.2)', letterSpacing: '0.02em' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px rgba(74,222,128,0.7)' }} />
              Live · {shiftLabel}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {signals.length > 0 && (
            <button onClick={() => onNavigate('data')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', cursor: 'pointer' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171', boxShadow: '0 0 6px rgba(239,68,68,0.7)' }} />
              {signals.length} SPC signal{signals.length > 1 ? 's' : ''}
            </button>
          )}
          {overdueActions.length > 0 && (
            <button onClick={() => onNavigate('projects')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', cursor: 'pointer' }}>
              ⚠ {overdueActions.length} overdue
            </button>
          )}
          {patterns.map(p => (
            <div key={p.waste_type} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', color: '#fb923c' }}>
              ⚠ {p.waste_type} ×{p.count}
            </div>
          ))}
        </div>
      </div>

      {/* ── Routine pills ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {routinePills.map(p => (
          <button key={p.label} onClick={p.onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', background: p.done ? 'rgba(74,222,128,0.1)' : 'var(--bg-input)', color: p.done ? '#4ade80' : 'var(--text-3)', border: `1px solid ${p.done ? 'rgba(74,222,128,0.25)' : 'var(--border)'}` }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.done ? '#4ade80' : 'rgba(255,255,255,0.15)', display: 'inline-block', transition: 'background 0.15s' }} />
            {p.label}
          </button>
        ))}
        <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 4, color: allGreen ? '#4ade80' : 'var(--text-3)' }}>
          {allGreen ? '✓ All done' : `${routineDone}/4`}
        </span>
      </div>

      {/* ── Nudges ── */}
      {nudges.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PresentationHotspot id="home-nudges" demoMode={demoMode} />
          {nudges.map(nudge => (
            <div key={nudge.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', ...glass, borderLeft: '3px solid #fb923c', borderRadius: 12 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{nudge.icon}</span>
              <p style={{ flex: 1, fontSize: 13, color: 'var(--text-2)', margin: 0 }}>{nudge.message}</p>
              <button onClick={nudge.onAction} style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 8, background: 'rgba(251,146,60,0.12)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.2)', cursor: 'pointer' }}>{nudge.action}</button>
              <button onClick={() => {
                const d = new Set(JSON.parse(sessionStorage.getItem('continuum_dismissed_nudges') || '[]'))
                d.add(nudge.id)
                sessionStorage.setItem('continuum_dismissed_nudges', JSON.stringify([...d]))
                setNudges(prev => prev.filter(n => n.id !== nudge.id))
              }} style={{ fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Section Health row ── */}
      {sections.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)' }}>Warehouse Health</span>
            <button onClick={() => onNavigate('data')} style={{ fontSize: 12, color: '#f97316', background: 'none', border: 'none', cursor: 'pointer' }}>View Details →</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sections.length}, 1fr)`, gap: 12 }}>
            {sections.map(s => {
              const rag = sectionRag(s)
              return (
                <button key={s.id} onClick={() => onNavigate('data')} style={{ ...glass, borderTop: `2px solid ${rag.color}`, borderRadius: 12, padding: '16px 14px', cursor: 'pointer', textAlign: 'left', transition: 'all 220ms cubic-bezier(0.34,1.56,0.64,1)', background: 'rgba(17,17,20,0.6)' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 32px ${rag.color}20` }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)' }}>{s.label}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 7px', borderRadius: 5, background: rag.bg, color: rag.color, border: `1px solid ${rag.border}` }}>{rag.label}</span>
                  </div>
                  <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.04em', fontFamily: 'Geist, Inter, sans-serif', lineHeight: 1, marginBottom: 6, background: `linear-gradient(135deg, #ffffff 20%, ${rag.color} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {s.score !== null ? `${Math.round(s.score)}%` : '—'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
                    {s.last_shift ? s.last_shift.date : 'No shift data'}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Projects + Observations 2-col ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Active Projects */}
        <div style={{ ...glass, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h3 style={{ fontFamily: 'Geist, Inter, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em' }}>Active Projects</h3>
            <button onClick={() => onNavigate('projects')} style={{ fontSize: 12, color: '#f97316', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>View All →</button>
          </div>
          {projects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>◆</div>
              <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 12px' }}>No active projects</p>
              <button onClick={() => onNavigate('projects')} style={{ padding: '6px 16px', borderRadius: 8, background: 'linear-gradient(135deg, #f97316, #ea6c0a)', color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(249,115,22,0.3)' }}>Start one →</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {projects.slice(0, 5).map(p => {
                const color = STAGE_COLORS[p.stage] || '#6B7280'
                const icon  = STAGE_ICONS[p.stage] || '◆'
                const done  = (p.actions || []).filter(a => a.done || a.status === 'Complete').length
                const total = (p.actions || []).length
                return (
                  <button key={p.id} onClick={() => onNavigate('projects', p)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', width: '100%' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>
                      {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                        <span style={{ color }}>{p.stage}</span>
                        {total > 0 && <span> · {done}/{total} tasks</span>}
                      </div>
                    </div>
                    <span style={{ flexShrink: 0, padding: '3px 9px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: `${color}15`, color, border: `1px solid ${color}30`, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{p.stage}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Today's Observations */}
        <div style={{ ...glass, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h3 style={{ fontFamily: 'Geist, Inter, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em' }}>Today's Observations</h3>
            <button onClick={() => onNavigate('floor')} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)', color: '#f97316', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 300, lineHeight: 1 }}>+</button>
          </div>
          {todayObsList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>◎</div>
              <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 12px' }}>No observations today</p>
              <button onClick={() => onNavigate('floor')} style={{ padding: '6px 16px', borderRadius: 8, background: 'rgba(249,115,22,0.1)', color: '#f97316', fontSize: 12, fontWeight: 700, border: '1px solid rgba(249,115,22,0.25)', cursor: 'pointer' }}>Start floor walk →</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {todayObsList.slice(0, 3).map((o, i) => {
                const wc = WASTE_COLORS[o.waste_type] || '#8b8b97'
                return (
                  <div key={i} style={{ padding: '12px 14px 12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)', background: `linear-gradient(to right, ${wc}08, transparent)`, borderLeft: `3px solid ${wc}`, position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 5, background: `${wc}18`, color: wc, border: `1px solid ${wc}30` }}>{o.waste_type}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {o.created_at ? new Date(o.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-1)', margin: '0 0 8px', lineHeight: 1.5 }}>{o.text.slice(0, 90)}{o.text.length > 90 ? '…' : ''}</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 4 }}>{o.area}</span>
                    </div>
                  </div>
                )
              })}
              {todayObsList.length > 3 && (
                <button onClick={() => onNavigate('floor')} style={{ fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', padding: '4px 0' }}>+{todayObsList.length - 3} more →</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Headcount + Tasks row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20 }}>

        {/* Headcount */}
        <div style={{ ...glass, padding: 20, minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)' }}>Headcount Today</span>
            <button onClick={saveHeadcount} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 7, background: headcountSaved ? 'rgba(74,222,128,0.12)' : 'var(--bg-input)', color: headcountSaved ? '#4ade80' : 'var(--text-3)', border: 'none', cursor: 'pointer' }}>
              {headcountSaved ? '✓ Saved' : 'Save'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[{ key: 'inbound', label: 'Inbound' }, { key: 'outbound', label: 'Outbound' }, { key: 'pick', label: 'Pick' }].map(({ key, label }) => (
              <div key={key} style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: 6 }}>{label}</label>
                <input type="number" min="0" value={headcount[key]}
                  onChange={e => setHeadcount(prev => ({ ...prev, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 9, background: 'var(--bg-input)', color: 'var(--text-1)', border: '1px solid var(--border)', outline: 'none', textAlign: 'center', fontSize: 14, fontWeight: 700, boxSizing: 'border-box' }}
                  placeholder="—" />
              </div>
            ))}
          </div>
        </div>

        {/* Tasks */}
        <div style={{ ...glass, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontFamily: 'Geist, Inter, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em' }}>Tasks</h3>
            <div style={{ display: 'flex', gap: 4, padding: '4px', background: 'var(--bg-input)', borderRadius: 9 }}>
              {[{ id: 'upcoming', label: 'Upcoming', count: upcomingTasks.length }, { id: 'overdue', label: 'Overdue', count: overdueTasks.length }].map(tab => (
                <button key={tab.id} onClick={() => setTaskTab(tab.id)} style={{ padding: '4px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.15s', background: taskTab === tab.id ? 'var(--bg-card)' : 'transparent', color: taskTab === tab.id ? 'var(--text-1)' : 'var(--text-3)' }}>
                  {tab.label} {tab.count > 0 && <span style={{ marginLeft: 4, padding: '1px 5px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: tab.id === 'overdue' ? 'rgba(239,68,68,0.2)' : 'rgba(59,127,222,0.2)', color: tab.id === 'overdue' ? '#f87171' : '#60a5fa' }}>{tab.count}</span>}
                </button>
              ))}
            </div>
          </div>
          {(taskTab === 'upcoming' ? upcomingTasks : overdueTasks).length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '16px 0', margin: 0 }}>No {taskTab} tasks</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
              {(taskTab === 'upcoming' ? upcomingTasks : overdueTasks).slice(0, 6).map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ color: taskTab === 'overdue' ? '#f87171' : 'var(--text-3)', fontSize: 12, marginTop: 1 }}>○</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.text}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                      {t.projectTitle}{t.due && <span style={{ color: taskTab === 'overdue' ? '#f87171' : 'inherit' }}> · Due {t.due}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Priority Queue ── */}
      {(() => {
        const current   = priorities[priorityIdx]
        const remaining = priorities.length - checkedPriorities.length
        const isMeeting = current?.type === 'meeting' || current?.type === 'escalation'
        return (
          <div style={{ ...glass, padding: 20, position: 'relative' }}>
            <PresentationHotspot id="home-priorities" demoMode={demoMode} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#f97316' }}>What to do next</span>
                {priorities.length > 0 && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {priorities.map((_, i) => (
                      <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: checkedPriorities.includes(i) ? '#4ade80' : i === priorityIdx ? '#f97316' : 'var(--border)', display: 'inline-block' }} />
                    ))}
                  </div>
                )}
                {priorityLoading && <span style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>generating…</span>}
              </div>
              <button onClick={() => generatePriorities(latestKpis, projects, patterns, [])} disabled={priorityLoading} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, background: 'var(--bg-input)', color: 'var(--text-3)', border: 'none', cursor: 'pointer', opacity: priorityLoading ? 0.4 : 1 }}>↻ Refresh</button>
            </div>

            {current && !checkedPriorities.includes(priorityIdx) ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                  <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>
                    {priorities.filter((_, i) => !checkedPriorities.includes(i)).indexOf(current) + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-1)', margin: '0 0 5px' }}>{current.action}</p>
                    {current.why && <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>{current.why}</p>}
                    {isMeeting && (
                      <span style={{ display: 'inline-block', marginTop: 8, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                        ↗ Raise with manager
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => {
                    setCheckedPriorities(prev => [...prev, priorityIdx])
                    setShowArticulate(false); setArticulateText('')
                    const next = priorities.findIndex((_, i) => i > priorityIdx && !checkedPriorities.includes(i))
                    if (next !== -1) setPriorityIdx(next)
                  }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700, background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: 'none', cursor: 'pointer' }}>✓ Done</button>
                  <button onClick={() => {
                    setShowArticulate(false); setArticulateText('')
                    const next = priorities.findIndex((_, i) => i > priorityIdx && !checkedPriorities.includes(i))
                    if (next !== -1) setPriorityIdx(next)
                  }} style={{ padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: 'var(--bg-input)', color: 'var(--text-3)', border: 'none', cursor: 'pointer' }}>Skip →</button>
                  {isMeeting && (
                    <button onClick={() => { showArticulate ? setShowArticulate(false) : generateArticulate(current) }} disabled={articulateLoading} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700, background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: 'none', cursor: 'pointer', opacity: articulateLoading ? 0.5 : 1 }}>
                      {articulateLoading ? '…' : showArticulate ? '↑ Hide' : '↗ How to raise this'}
                    </button>
                  )}
                </div>
                {showArticulate && (articulateText || articulateLoading) && (
                  <div style={{ marginTop: 14, padding: '14px 16px', borderRadius: 10, background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.15)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#60a5fa' }}>Talking points</span>
                      <button onClick={() => navigator.clipboard?.writeText(articulateText)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: 'none', cursor: 'pointer' }}>Copy</button>
                    </div>
                    <BriefMarkdown text={articulateText} />
                    {articulateLoading && <span style={{ display: 'inline-block', width: 4, height: 12, background: 'var(--text-3)', marginLeft: 2, verticalAlign: 'middle' }} />}
                  </div>
                )}
              </div>
            ) : priorityLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-input)', animation: 'pulse 1.5s infinite' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 12, borderRadius: 6, background: 'var(--bg-input)', width: '55%', marginBottom: 8 }} />
                  <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-input)', width: '35%' }} />
                </div>
              </div>
            ) : remaining === 0 && priorities.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                <span style={{ fontSize: 20, color: '#4ade80' }}>✓</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#4ade80', margin: '0 0 3px' }}>All priorities done</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>Good shift — refresh for an updated list</p>
                </div>
              </div>
            ) : null}
          </div>
        )
      })()}

      {/* ── Morning Brief ── */}
      <div style={{ ...glass, padding: 20, position: 'relative' }}>
        <PresentationHotspot id="home-brief" demoMode={demoMode} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ fontFamily: 'Geist, Inter, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em' }}>Morning Brief</h3>
          <button onClick={() => autoGenerateBrief(latestKpis, projects, patterns)} disabled={briefStreaming} style={{ fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 8, background: 'rgba(249,115,22,0.1)', color: '#fb923c', border: 'none', cursor: 'pointer', opacity: briefStreaming ? 0.5 : 1 }}>
            {briefStreaming ? '…' : '↻ Refresh'}
          </button>
        </div>
        {displayBriefContent ? (
          <>
            {brief && !briefStreaming && (
              <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '0 0 8px' }}>
                {new Date(brief.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              <BriefMarkdown text={displayBriefContent} />
              {briefStreaming && <span style={{ display: 'inline-block', width: 4, height: 12, background: 'var(--text-3)', marginLeft: 2, verticalAlign: 'middle' }} />}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            {briefStreaming
              ? <span style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>Generating brief…</span>
              : <><div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>◈</div><p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Generating your brief…</p></>
            }
          </div>
        )}
      </div>

      {/* ── Quick Agents ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {[
          { label: 'Prepare Tier 2', sub: 'RAG status · talking points · escalations', icon: '⬡', color: '#f87171', onClick: openTier2 },
          { label: 'Gemba Agent',    sub: 'Structure floor obs · identify waste',       icon: '◎', color: '#4ade80', onClick: () => onOpenAgent('gemba-agent', null) },
          { label: 'DMAIC Coach',    sub: 'Guide project stage · root cause · actions', icon: '◆', color: '#a78bfa', onClick: () => onOpenAgent('project-agent', null) },
        ].map(btn => (
          <button key={btn.label} onClick={btn.onClick} style={{ ...glass, padding: '14px 16px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 220ms cubic-bezier(0.34,1.56,0.64,1)' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = `${btn.color}30` }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: 20, width: 32, textAlign: 'center', flexShrink: 0, color: btn.color }}>
              {btn.icon}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 3 }}>{btn.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{btn.sub}</div>
            </div>
            <span style={{ color: 'var(--text-3)', fontSize: 16, flexShrink: 0 }}>→</span>
          </button>
        ))}
      </div>

    </div>
  )
}
