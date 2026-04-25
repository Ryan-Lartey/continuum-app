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

function ProgressRing({ pct, color, size = 44 }) {
  const r = 15, circ = 2 * Math.PI * r
  const dash = Math.min(Math.max(pct, 0), 100) / 100 * circ
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ flexShrink: 0 }}>
      <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3.5" />
      <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="3.5"
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        transform="rotate(-90 20 20)" />
      <text x="20" y="24" textAnchor="middle" fontSize="8" fontWeight="700" fill={color}>{Math.round(pct)}%</text>
    </svg>
  )
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
  const [tier2Today, setTier2Today]         = useState(null) // kept for compat
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
  const autoGenFired    = useRef(false)
  const prioritiesFired = useRef(false)

  const [recentIdeas, setRecentIdeas] = useState([])
  const [kpiTargets, setKpiTargets]   = useState(DEFAULT_TARGETS)

  // ─── Headcount ───
  const [headcount, setHeadcount] = useState(loadHeadcount)
  const [headcountSaved, setHeadcountSaved] = useState(false)

  function saveHeadcount() {
    localStorage.setItem(HEADCOUNT_KEY, JSON.stringify(headcount))
    setHeadcountSaved(true)
    setTimeout(() => setHeadcountSaved(false), 2000)
  }

  // ─── Nudges ───
  const [nudges, setNudges] = useState([])

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
    ]).then(([kpis, allK, ps, latestBrief, pats, obs, t2, pfs, ideas]) => {
      setLatestKpis(kpis)
      setAllKpis(allK)
      setProjects(ps.filter(p => p.stage !== 'Closed'))
      setBrief(latestBrief)
      setPatterns(pats)
      setTodayObs(obs.filter(o => o.date === TODAY).length)
      if (t2) setTier2Today(t2)
      setPortfolios(pfs)
      setRecentIdeas(Array.isArray(ideas) ? ideas : [])
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
      // Store obs for activity feed
      setAllObs(obs)

      // ─── Nudges rules engine ───
      const dismissed = new Set(JSON.parse(sessionStorage.getItem('continuum_dismissed_nudges') || '[]'))
      const computed = []
      const now = new Date()

      // Rule 1: Stalled project (>14 days, not finished)
      ps.filter(p => p.stage !== 'Closed' && p.stage !== 'finished').forEach(p => {
        const updatedAt = p.updated_at ? new Date(p.updated_at) : null
        if (!updatedAt) return
        const days = Math.floor((now - updatedAt) / 86400000)
        if (days > 14) {
          const id = `stalled-project-${p.id}`
          if (!dismissed.has(id)) {
            computed.push({ id, icon: '⚠', message: `${p.title} hasn't moved in ${days} days. Want to update it?`, action: 'Open Projects', onAction: () => onNavigate('projects', p), urgency: days })
          }
        }
      })

      // Rule 2: Repeated waste pattern in 14 days
      const cutoff14 = new Date(now - 14 * 86400000).toISOString().split('T')[0]
      const recentObs = obs.filter(o => o.date >= cutoff14)
      const wasteCounts = {}
      recentObs.forEach(o => { if (o.waste_type) wasteCounts[o.waste_type] = (wasteCounts[o.waste_type] || 0) + 1 })
      Object.entries(wasteCounts).forEach(([type, count]) => {
        if (count >= 3) {
          const id = `waste-pattern-${type}`
          if (!dismissed.has(id)) {
            computed.push({ id, icon: '📊', message: `You've logged ${count} ${type} observations recently. Want to raise an idea?`, action: 'Go to Floor', onAction: () => onNavigate('floor'), urgency: count * 2 })
          }
        }
      })

      // Rule 3: KPIs not logged in >2 days
      const latestKpiEntry = allK.length > 0 ? allK[allK.length - 1] : null
      if (latestKpiEntry) {
        const kpiDate = latestKpiEntry.date || (latestKpiEntry.created_at || '').split('T')[0]
        const kpiDays = kpiDate ? Math.floor((now - new Date(kpiDate)) / 86400000) : null
        if (kpiDays !== null && kpiDays > 2) {
          const id = 'kpis-not-logged'
          if (!dismissed.has(id)) {
            computed.push({ id, icon: '📉', message: `KPIs haven't been logged in ${kpiDays} day${kpiDays !== 1 ? 's' : ''}. Log now?`, action: 'Log KPIs', onAction: () => onNavigate('data'), urgency: kpiDays * 3 })
          }
        }
      } else {
        const id = 'kpis-not-logged'
        if (!dismissed.has(id)) {
          computed.push({ id, icon: '📉', message: `No KPIs logged yet. Log now?`, action: 'Log KPIs', onAction: () => onNavigate('data'), urgency: 10 })
        }
      }

      // Rule 4: Idea stuck in definition >14 days
      if (Array.isArray(ideas)) {
        ideas.forEach(idea => {
          if ((idea.stage || '').toLowerCase() === 'definition') {
            const updatedAt = idea.updated_at ? new Date(idea.updated_at) : null
            if (!updatedAt) return
            const days = Math.floor((now - updatedAt) / 86400000)
            if (days > 14) {
              const id = `idea-stuck-${idea.id}`
              if (!dismissed.has(id)) {
                computed.push({ id, icon: '💡', message: `'${idea.title}' has been in definition for ${days} days. Review it?`, action: 'View Portfolio', onAction: () => onNavigate('portfolio'), urgency: days })
              }
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
    const kpiLines = Object.entries(kpis).map(([k, v]) => {
      const m    = METRICS.find(x => x.id === k)
      const diff = v?.value !== undefined && m ? ((v.value - m.target) / m.target * 100).toFixed(1) : null
      return `${k.toUpperCase()}: ${v?.value ?? 'not logged'} (target ${m?.target ?? '—'}${diff !== null ? `, ${diff > 0 ? '+' : ''}${diff}%` : ''})`
    }).join('\n')

    const hcStr = headcountString(loadHeadcount())
    const prompt = `You are Ryan's CI coach at an Amazon FC (ID Logistics). Generate his prioritised action queue for right now.

Data:
KPIs:
${kpiLines || 'No KPIs logged today'}

Projects:
${projectData || 'None'}

Floor observations today: ${todayCount}
Overdue actions: ${overdue.length > 0 ? overdue.join('; ') : 'none'}
Waste patterns (48h): ${pats.map(p => p.waste_type + ' ×' + p.count).join(', ') || 'none'}
Current time: ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}${hcStr ? '\n' + hcStr : ''}

Output a JSON array of 3-5 priorities. Each object must have exactly these fields:
- "action": what to do right now — specific, starts with a verb, uses real numbers from the data
- "why": one sentence explaining why this is the priority — be concrete
- "type": one of "task" | "floor" | "data" | "meeting" | "escalation"

Order by urgency and impact. Only include things that genuinely need doing today.
Output ONLY the JSON array. No markdown. No explanation.`

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
    const kpiLines = Object.entries(latestKpis).map(([k, v]) => {
      const m = METRICS.find(x => x.id === k)
      return `${k.toUpperCase()}: ${v?.value ?? '—'} vs target ${m?.target ?? '—'}`
    }).join(', ')
    const prompt = `Ryan needs to raise this with his ops manager or in his Tier 2 meeting:

"${priority.action}"
Why it matters: ${priority.why}
KPI context: ${kpiLines || 'no KPIs logged'}

Write his talking points in exactly this format — no intro, no outro:

**Situation:** [1 sentence — what's happening, with the number if available]
**Impact:** [1 sentence — what this means for the operation]
**What I'm doing:** [1 sentence — his plan or what he's already done]
**Ask:** [1 sentence — what he needs from management, or "No ask — informing you" if none]

First person. Confident. Meeting-ready. No waffle.`

    let acc = ''
    streamAgent('chief-of-staff', [{ role: 'user', content: prompt }], null,
      chunk => { acc += chunk; setArticulateText(acc) },
      () => { setArticulateLoading(false) },
      () => { setArticulateLoading(false) }
    )
  }

  // ─── Computed ───
  const METRICS = buildMetrics(kpiTargets)
  const todayKpiLogged = Object.values(latestKpis).some(k => k?.date === TODAY)
  const briefToday     = brief && (brief.created_at || '').startsWith(TODAY)
  const overdueActions = projects.flatMap(p =>
    (p.actions || []).filter(a => !a.done && a.due && a.due < TODAY).map(a => ({ ...a, project: p.title }))
  )

  const allTasks       = projects.flatMap(p => (p.actions || []).map(a => ({ ...a, projectTitle: p.title })))
  const upcomingTasks  = allTasks.filter(a => !a.done && a.status !== 'Complete' && (!a.due || a.due >= TODAY))
  const overdueTasks   = allTasks.filter(a => !a.done && a.status !== 'Complete' && a.due && a.due < TODAY)
  const completedTasks = allTasks.filter(a => a.done || a.status === 'Complete')
  const activeTasks    = taskTab === 'upcoming' ? upcomingTasks : taskTab === 'overdue' ? overdueTasks : completedTasks

  const kpiItems = allKpis.slice(-12).map(k => ({
    label: `${METRICS.find(m => m.id === k.metric_id)?.label || k.metric_id?.toUpperCase()} logged: ${k.value}`,
    date: k.date,
    sortKey: k.created_at || k.date,
    icon: '▲',
    color: '#60a5fa',
  }))
  const todayObsItems = allObs.filter(o => o.date === TODAY).map(o => ({
    label: `Floor obs (${o.area}): ${o.text.slice(0,50)}${o.text.length>50?'…':''}`,
    date: o.date,
    sortKey: o.created_at || o.date,
    icon: '◎',
    color: '#4ade80',
  }))
  const ideaItems = recentIdeas.map(idea => ({
    label: `Idea created: ${idea.title}`,
    date: (idea.created_at || '').slice(0,10),
    sortKey: idea.created_at || '',
    icon: '◈',
    color: '#fb923c',
  }))
  const recentActivity = [...kpiItems, ...todayObsItems, ...ideaItems]
    .sort((a,b) => (b.sortKey||'').localeCompare(a.sortKey||''))
    .slice(0,10)

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
    { label: 'Brief',    done: briefToday || briefStreaming, onClick: () => autoGenerateBrief(latestKpis, projects, patterns) },
    { label: 'KPIs',     done: todayKpiLogged,              onClick: () => onNavigate('data') },
    { label: 'Floor',    done: todayObs > 0,                onClick: () => onNavigate('floor') },
    { label: 'Tier 2',   done: tier2Prepped,                onClick: openTier2 },
  ]
  const routineDone = routinePills.filter(p => p.done).length
  const allGreen    = routineDone === 4

  const displayBriefContent = briefStreaming ? briefStreamText : brief?.content
  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-5 max-w-[1400px]">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-1)' }}>{getGreeting()}, Ryan</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>{dateStr}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {signals.length > 0 && (
            <button onClick={() => onNavigate('data')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border"
              style={{ background: 'rgba(220,38,38,0.1)', borderColor: 'rgba(220,38,38,0.25)', color: '#f87171' }}>
              <span className="signal-dot"><span className="w-2 h-2 rounded-full bg-red-500 relative z-10 block" /></span>
              {signals.length} SPC signal{signals.length > 1 ? 's' : ''}
            </button>
          )}
          {overdueActions.length > 0 && (
            <button onClick={() => onNavigate('projects')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border"
              style={{ background: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.2)', color: '#f87171' }}>
              ⚠ {overdueActions.length} overdue action{overdueActions.length > 1 ? 's' : ''}
            </button>
          )}
          {patterns.map(p => (
            <div key={p.waste_type} className="px-4 py-2 rounded-xl text-sm font-medium border"
              style={{ background: 'rgba(232,130,12,0.1)', borderColor: 'rgba(232,130,12,0.25)', color: '#fb923c' }}>
              ⚠ {p.waste_type} ×{p.count} this week
            </div>
          ))}
        </div>
      </div>

      {/* Routine pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {routinePills.map(p => (
          <button key={p.label}
            onClick={p.onClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: p.done ? 'rgba(74,222,128,0.1)' : 'var(--bg-input)',
              color:      p.done ? '#4ade80' : 'var(--text-3)',
              border:     `1px solid ${p.done ? 'rgba(74,222,128,0.25)' : 'var(--border)'}`,
              cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = p.done ? 'rgba(74,222,128,0.18)' : 'var(--bg-card)' }}
            onMouseLeave={e => { e.currentTarget.style.background = p.done ? 'rgba(74,222,128,0.1)' : 'var(--bg-input)' }}>
            <span>{p.done ? '●' : '○'}</span>
            <span>{p.label}</span>
          </button>
        ))}
        <span className="text-xs font-semibold ml-1" style={{ color: allGreen ? '#4ade80' : 'var(--text-3)' }}>
          {allGreen ? '✓ All done' : `${routineDone}/4`}
        </span>
      </div>

      {/* ─── Nudge Cards ─── */}
      {nudges.length > 0 && (
        <div className="space-y-2" style={{ position: 'relative' }}>
          <PresentationHotspot id="home-nudges" demoMode={demoMode} />
          {nudges.map(nudge => (
            <div key={nudge.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: '3px solid #fb923c' }}>
              <span className="text-base flex-shrink-0">{nudge.icon}</span>
              <p className="flex-1 text-sm" style={{ color: 'var(--text-2)' }}>{nudge.message}</p>
              <button onClick={nudge.onAction}
                className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(251,146,60,0.12)', color: '#fb923c' }}>
                {nudge.action}
              </button>
              <button onClick={() => {
                const dismissed = new Set(JSON.parse(sessionStorage.getItem('continuum_dismissed_nudges') || '[]'))
                dismissed.add(nudge.id)
                sessionStorage.setItem('continuum_dismissed_nudges', JSON.stringify([...dismissed]))
                setNudges(prev => prev.filter(n => n.id !== nudge.id))
              }} className="flex-shrink-0 text-xs px-1.5 py-1 rounded-lg transition-opacity hover:opacity-70"
                style={{ color: 'var(--text-3)' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* ─── Headcount Today ─── */}
      <div className="card p-4" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Headcount Today</span>
          <button onClick={saveHeadcount}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity"
            style={{ background: headcountSaved ? 'rgba(74,222,128,0.12)' : 'var(--bg-input)', color: headcountSaved ? '#4ade80' : 'var(--text-3)' }}>
            {headcountSaved ? '✓ Saved' : 'Save'}
          </button>
        </div>
        <div className="flex items-center gap-3">
          {[
            { key: 'inbound', label: 'Inbound' },
            { key: 'outbound', label: 'Outbound' },
            { key: 'pick', label: 'Pick' },
          ].map(({ key, label }) => (
            <div key={key} className="flex-1">
              <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--text-3)' }}>{label}</label>
              <input
                type="number"
                min="0"
                value={headcount[key]}
                onChange={e => setHeadcount(prev => ({ ...prev, [key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm text-center font-semibold"
                style={{ background: 'var(--bg-input)', color: 'var(--text-1)', border: '1px solid var(--border)', outline: 'none' }}
                placeholder="—"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ─── Overview 2×2 ─── */}
      <div className="grid grid-cols-2 gap-5">

        {/* Recent Projects */}
        <div className="card p-5" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text-1)', fontWeight: 700, letterSpacing: '-0.03em' }}>Recent Projects</h2>
            <button onClick={() => onNavigate('projects')}
              className="text-[10px] font-bold uppercase tracking-widest hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-3)' }}>View All →</button>
          </div>
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="text-3xl mb-1" style={{ color: 'var(--text-3)', opacity: 0.5 }}>◆</div>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>No active projects</p>
              <button onClick={() => onNavigate('projects')} className="text-xs font-semibold mt-1 px-3 py-1.5 rounded-lg" style={{ background: 'linear-gradient(135deg, #f97316, #ea6c0a)', color: '#fff', boxShadow: '0 2px 12px rgba(249,115,22,0.2)' }}>Start one →</button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {projects.slice(0, 5).map(p => {
                const color    = STAGE_COLORS[p.stage] || '#6B7280'
                const done     = (p.actions || []).filter(a => a.done || a.status === 'Complete').length
                const total    = (p.actions || []).length
                const stageIdx = DMAIC.indexOf(p.stage)
                const pct      = total > 0 ? done / total * 100 : stageIdx >= 0 ? stageIdx / DMAIC.length * 100 : 0
                return (
                  <button key={p.id} onClick={() => onNavigate('projects', p)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:opacity-80 transition-all transition-colors"
                    style={{ background: 'var(--bg-input)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-input)' }}>
                    <ProgressRing pct={pct} color={color} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>{p.title}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                        <span className="font-semibold" style={{ color }}>{p.stage}</span>
                        {total > 0 && <span> · {done}/{total} tasks</span>}
                      </div>
                    </div>
                    <span className="text-base flex-shrink-0" style={{ color: 'var(--text-3)' }}>›</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="card p-5" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-1)', fontWeight: 700, letterSpacing: '-0.03em' }}>Tasks</h2>
          <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: 'var(--bg-input)' }}>
            {[
              { id: 'upcoming',  label: 'Upcoming',  count: upcomingTasks.length },
              { id: 'overdue',   label: 'Overdue',   count: overdueTasks.length },
              { id: 'completed', label: 'Completed', count: completedTasks.length },
            ].map(tab => (
              <button key={tab.id} onClick={() => setTaskTab(tab.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: taskTab === tab.id ? 'var(--bg-card)' : 'transparent', color: taskTab === tab.id ? 'var(--text-1)' : 'var(--text-3)' }}>
                {tab.label}
                {tab.count > 0 && (
                  <span className="px-1.5 rounded-full text-[10px] font-bold"
                    style={{
                      background: taskTab === tab.id ? (tab.id === 'overdue' ? 'rgba(220,38,38,0.2)' : tab.id === 'completed' ? 'rgba(74,222,128,0.2)' : 'rgba(59,127,222,0.2)') : 'rgba(255,255,255,0.06)',
                      color: taskTab === tab.id ? (tab.id === 'overdue' ? '#f87171' : tab.id === 'completed' ? '#4ade80' : '#60a5fa') : 'var(--text-3)',
                    }}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>
          {activeTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="text-3xl mb-1" style={{ color: 'var(--text-3)', opacity: 0.5 }}>○</div>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>No {taskTab} tasks</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {activeTasks.slice(0, 8).map((t, i) => (
                <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors"
                  style={{ background: 'var(--bg-input)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-input)' }}>
                  <span className="flex-shrink-0 text-xs mt-0.5"
                    style={{ color: taskTab === 'completed' ? '#4ade80' : taskTab === 'overdue' ? '#f87171' : 'var(--text-3)' }}>
                    {taskTab === 'completed' ? '✓' : '○'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>{t.text}</div>
                    <div className="text-[10px] mt-0.5 flex gap-2 flex-wrap" style={{ color: 'var(--text-3)' }}>
                      <span>{t.projectTitle}</span>
                      {t.due && <span style={{ color: taskTab === 'overdue' ? '#f87171' : 'inherit' }}>· Due {t.due}</span>}
                      {t.owner && <span>· {t.owner}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Portfolios + Activity ─── */}
      <div className="grid grid-cols-2 gap-5">

        {/* Portfolios */}
        <div className="card p-5" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text-1)', fontWeight: 700, letterSpacing: '-0.03em' }}>Portfolios</h2>
            <button onClick={() => onNavigate('portfolio')}
              className="text-[10px] font-bold uppercase tracking-widest hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-3)' }}>View All →</button>
          </div>
          {portfolios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="text-3xl mb-1" style={{ color: 'var(--text-3)', opacity: 0.5 }}>◈</div>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>No portfolios yet</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {portfolios.slice(0, 4).map(pf => {
                const pfProjects = projects.filter(p => p.portfolio_id === pf.id)
                return (
                  <button key={pf.id} onClick={() => onOpenPortfolio?.(pf.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:opacity-80 transition-all transition-colors"
                    style={{ background: 'var(--bg-input)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-input)' }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(232,130,12,0.12)' }}>
                      <span style={{ color: '#E8820C', fontSize: 14 }}>◈</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>{pf.name}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                        {pfProjects.length} project{pfProjects.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <span className="text-base flex-shrink-0" style={{ color: 'var(--text-3)' }}>›</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card p-5" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--text-1)', fontWeight: 700, letterSpacing: '-0.03em' }}>Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="text-3xl mb-1" style={{ color: 'var(--text-3)', opacity: 0.5 }}>○</div>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>No activity logged yet</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {recentActivity.map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors" style={{ background: 'var(--bg-input)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-input)' }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: `${a.color}15` }}>
                    <span className="text-[10px]" style={{ color: a.color }}>{a.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>{a.label}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>{a.date}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Priority Queue ─── */}
      {(() => {
        // hotspot-priorities wrapper is inside the card below
        const current   = priorities[priorityIdx]
        const remaining = priorities.length - checkedPriorities.length
        const isMeeting = current?.type === 'meeting' || current?.type === 'escalation'
        return (
          <div className="card p-5" style={{ position: 'relative', boxShadow: '0 4px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <PresentationHotspot id="home-priorities" demoMode={demoMode} />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#E8820C' }}>What to do next</span>
                {priorities.length > 0 && (
                  <div className="flex gap-1">
                    {priorities.map((_, i) => (
                      <span key={i} className="w-2 h-2 rounded-full"
                        style={{ background: checkedPriorities.includes(i) ? '#4ade80' : i === priorityIdx ? '#E8820C' : 'var(--border)' }} />
                    ))}
                  </div>
                )}
                {priorityLoading && <span className="text-[10px] animate-pulse" style={{ color: 'var(--text-3)' }}>working out priorities…</span>}
              </div>
              <button onClick={() => generatePriorities(latestKpis, projects, patterns, [])}
                disabled={priorityLoading}
                className="text-xs px-2.5 py-1 rounded-lg disabled:opacity-40"
                style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
                ↻ Refresh
              </button>
            </div>

            {current && !checkedPriorities.includes(priorityIdx) ? (
              <div>
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'rgba(232,130,12,0.15)', color: '#E8820C' }}>
                    {priorities.filter((_, i) => !checkedPriorities.includes(i)).indexOf(current) + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-1)' }}>{current.action}</p>
                    {current.why && <p className="text-xs" style={{ color: 'var(--text-3)' }}>{current.why}</p>}
                    {isMeeting && (
                      <span className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>
                        ↗ Needs raising with manager
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => {
                    setCheckedPriorities(prev => [...prev, priorityIdx])
                    setShowArticulate(false); setArticulateText('')
                    const next = priorities.findIndex((_, i) => i > priorityIdx && !checkedPriorities.includes(i))
                    if (next !== -1) setPriorityIdx(next)
                  }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>
                    ✓ Done
                  </button>
                  <button onClick={() => {
                    setShowArticulate(false); setArticulateText('')
                    const next = priorities.findIndex((_, i) => i > priorityIdx && !checkedPriorities.includes(i))
                    if (next !== -1) setPriorityIdx(next)
                  }} className="px-4 py-2 rounded-xl text-sm font-medium"
                    style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
                    Skip →
                  </button>
                  {isMeeting && (
                    <button onClick={() => { showArticulate ? setShowArticulate(false) : generateArticulate(current) }}
                      disabled={articulateLoading}
                      className="flex items-center gap-1.5 ml-auto px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                      style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa' }}>
                      {articulateLoading ? '…' : showArticulate ? '↑ Hide' : '↗ How to raise this'}
                    </button>
                  )}
                </div>
                {showArticulate && (articulateText || articulateLoading) && (
                  <div className="mt-4 rounded-xl p-4 border" style={{ background: 'rgba(96,165,250,0.05)', borderColor: 'rgba(96,165,250,0.2)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#60a5fa' }}>Talking points</span>
                      <button onClick={() => navigator.clipboard?.writeText(articulateText)}
                        className="text-[10px] px-2 py-1 rounded-lg"
                        style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa' }}>Copy</button>
                    </div>
                    <BriefMarkdown text={articulateText} />
                    {articulateLoading && <span className="inline-block w-1 h-3 animate-pulse ml-0.5 align-middle" style={{ background: 'var(--text-3)' }} />}
                  </div>
                )}
              </div>
            ) : priorityLoading ? (
              <div className="flex items-center gap-3 py-2">
                <div className="w-7 h-7 rounded-full animate-pulse" style={{ background: 'var(--bg-input)' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-3 rounded-full animate-pulse" style={{ background: 'var(--bg-input)', width: '60%' }} />
                  <div className="h-2.5 rounded-full animate-pulse" style={{ background: 'var(--bg-input)', width: '40%' }} />
                </div>
              </div>
            ) : remaining === 0 && priorities.length > 0 ? (
              <div className="flex items-center gap-3 py-2">
                <span className="text-xl" style={{ color: '#4ade80' }}>✓</span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#4ade80' }}>All priorities done</p>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>Good shift — refresh for an updated list</p>
                </div>
              </div>
            ) : null}
          </div>
        )
      })()}

      {/* Morning Brief */}
      <div className="card p-5" style={{ position: 'relative', boxShadow: '0 4px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <PresentationHotspot id="home-brief" demoMode={demoMode} />
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text-1)', fontWeight: 700, letterSpacing: '-0.03em' }}>Morning Brief</h2>
          <button onClick={() => autoGenerateBrief(latestKpis, projects, patterns)} disabled={briefStreaming}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40"
            style={{ background: 'rgba(232,130,12,0.12)', color: '#fb923c' }}>
            {briefStreaming ? '…' : '↻ Refresh'}
          </button>
        </div>
        {displayBriefContent ? (
          <>
            {brief && !briefStreaming && (
              <p className="text-[10px] mb-2" style={{ color: 'var(--text-3)' }}>
                {new Date(brief.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            <div className="overflow-y-auto max-h-56">
              <BriefMarkdown text={displayBriefContent} />
              {briefStreaming && <span className="inline-block w-1 h-3 animate-pulse ml-0.5 align-middle" style={{ background: 'var(--text-3)' }} />}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            {briefStreaming
              ? <span className="text-xs animate-pulse" style={{ color: 'var(--text-3)' }}>Generating brief…</span>
              : <><div className="text-3xl mb-3" style={{ color: 'var(--text-3)', opacity: 0.5 }}>◈</div><p className="text-xs" style={{ color: 'var(--text-3)' }}>Generating your brief…</p></>
            }
          </div>
        )}
      </div>

      {/* Quick agents */}
      <div className="grid grid-cols-3 gap-3">

        {/* Tier 2 Prep — pre-loaded with live context */}
        <button
          onClick={openTier2}
          className="card px-4 py-3 text-left flex items-center gap-3 hover:opacity-80 transition-all"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-lg w-7 flex-shrink-0 text-center" style={{ color: '#f87171' }}>⬡</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>Prepare Tier 2</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>RAG status · talking points · escalations</div>
          </div>
          <span className="ml-auto text-sm flex-shrink-0" style={{ color: 'var(--text-3)' }}>→</span>
        </button>

        {/* Gemba Agent */}
        <button onClick={() => onOpenAgent('gemba-agent', null)}
          className="card px-4 py-3 text-left flex items-center gap-3 hover:opacity-80 transition-all"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-lg w-7 flex-shrink-0 text-center" style={{ color: '#4ade80' }}>◎</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>Gemba Agent</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>Structure floor obs · identify waste</div>
          </div>
          <span className="ml-auto text-sm flex-shrink-0" style={{ color: 'var(--text-3)' }}>→</span>
        </button>

        {/* Project Coach */}
        <button onClick={() => onOpenAgent('project-agent', null)}
          className="card px-4 py-3 text-left flex items-center gap-3 hover:opacity-80 transition-all"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-lg w-7 flex-shrink-0 text-center" style={{ color: '#a78bfa' }}>◆</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>DMAIC Coach</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>Guide project stage · root cause · actions</div>
          </div>
          <span className="ml-auto text-sm flex-shrink-0" style={{ color: 'var(--text-3)' }}>→</span>
        </button>

      </div>

    </div>
  )
}
