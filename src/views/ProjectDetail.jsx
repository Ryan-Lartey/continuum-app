import { useState, useEffect } from 'react'
import { api, streamAgent } from '../lib/api.js'
import ControlChart from '../components/ControlChart.jsx'
import { jsPDF } from 'jspdf'
import PresentationHotspot from '../components/PresentationHotspot.jsx'
import {
  LineChart, Line, XAxis, YAxis, ReferenceLine, Tooltip, ResponsiveContainer,
} from 'recharts'

const PHASES = ['Define', 'Measure', 'Analyze', 'Improve', 'Control']
const PHASE_COLORS = {
  Define: '#3B7FDE', Measure: '#7C3AED', Analyze: '#DC2626',
  Improve: '#16A34A', Control: '#059669',
}
const PHASE_STAGE = {
  Define: 'Define', Measure: 'Measure', Analyze: 'Analyse',
  Improve: 'Improve', Control: 'Control',
}
const METRIC_LABELS = { uph: 'UPH', accuracy: 'Pick Accuracy', dpmo: 'DPMO', dts: 'DTS' }

const WASTE_TYPES = ['', 'Waiting', 'Motion', 'Overprocessing', 'Defects', 'Inventory', 'Transport', 'Unused Talent']
const WASTE_COLORS = {
  Waiting: '#f59e0b', Motion: '#3b82f6', Overprocessing: '#8b5cf6',
  Defects: '#ef4444', Inventory: '#f97316', Transport: '#06b6d4', 'Unused Talent': '#6b7280',
}

const TOOLS = [
  { id: 'charter',   phase: 'Define',   title: 'Charter',
    desc: 'Define the problem, goal, business case, and scope. This is the foundation of your project.' },
  { id: 'sipoc',     phase: 'Define',   title: 'SIPOC',
    desc: 'Map Suppliers → Inputs → Process → Outputs → Customers to understand the full scope.' },
  { id: 'baseline',  phase: 'Measure',  title: 'Baseline',
    desc: 'Establish current performance as a reference point. This will be used to verify your improvement.' },
  { id: 'process',   phase: 'Measure',  title: 'As-Is Process',
    desc: 'Map the current state step-by-step. Flag each step with waste type and add a before photo.' },
  { id: 'clues',     phase: 'Analyze',  title: 'Clues',
    desc: 'Gather insights from floor walk observations. Clues will help identify potential root causes.' },
  { id: 'rootcause', phase: 'Analyze',  title: 'Root Cause',
    desc: 'Use the 5 Whys to drill down to the true root cause of the problem.' },
  { id: 'solutions', phase: 'Improve',  title: 'Solutions',
    desc: 'Identify and commit to countermeasures that directly address the root cause.' },
  { id: 'tobemap',   phase: 'Improve',  title: 'To-Be Process',
    desc: 'Map the improved future state process. Document what changes and add an after photo.' },
  { id: 'actions',   phase: 'Improve',  title: 'Action Plan',
    desc: 'Assign ownership and due dates to each committed solution.' },
  { id: 'results',   phase: 'Control',  title: 'Results',
    desc: 'Log post-improvement data to verify and quantify the improvement achieved.' },
  { id: 'handoff',   phase: 'Control',  title: 'Project Handoff',
    desc: 'Document results, savings, lessons learned, and formally hand off the process to the owner.' },
  { id: 'monitor',   phase: 'Control',  title: 'Monitoring Plan',
    desc: 'Define what you will monitor, how often, and who responds when triggers are hit.' },
  { id: 'transfer',  phase: 'Control',  title: 'Transfer Opportunities',
    desc: 'Identify where this solution can be replicated across other areas or shifts.' },
  { id: 'summary',   phase: 'Control',  title: 'Project Summary',
    desc: 'Auto-generate an executive summary to present to management.' },
  { id: 'before_photo',         phase: 'Measure',  title: 'Before Photo',
    desc: 'Capture the current state with photos and observations' },
  { id: 'after_photo',          phase: 'Control',  title: 'After Photo',
    desc: 'Document the improved state with photos and evidence' },
  { id: 'fishbone',             phase: 'Analyze',  title: 'Fishbone Diagram',
    desc: 'Map causes across 6M categories: Man, Machine, Method, Material, Measurement, Environment' },
  { id: 'data_collection_plan', phase: 'Measure',  title: 'Data Collection Plan',
    desc: 'Define what to measure, how, frequency and who is responsible' },
  { id: 'screener',             phase: 'Define',   title: 'Screener',
    desc: 'Assess opportunity: impact, effort, strategic fit and urgency' },
  { id: 'voc',                  phase: 'Define',   title: 'Voice of Customer',
    desc: 'Capture stakeholder needs and complaints driving this project' },
  { id: 'confirm_stats',        phase: 'Analyze',  title: 'Confirm with Stats',
    desc: 'Statistical confirmation of root cause hypothesis' },
  { id: 'confirm',              phase: 'Analyze',  title: 'Confirm Root Cause',
    desc: 'Confirm root cause findings before moving to recommendation' },
  { id: 'verify',               phase: 'Improve',  title: 'Verify',
    desc: 'Confirm the solution worked with before/after evidence' },
  { id: 'recommendation',       phase: 'Control',  title: 'Recommendation',
    desc: 'Document findings and either close or escalate to a full improvement project' },
]

const PROJECT_TYPES = {
  quick_win: {
    label: 'Quick Win',
    color: '#10b981',
    tools: ['charter', 'process', 'before_photo', 'rootcause', 'solutions', 'after_photo', 'summary']
  },
  yellow_belt: {
    label: 'Yellow Belt',
    color: '#f59e0b',
    tools: ['charter', 'process', 'before_photo', 'baseline', 'rootcause', 'solutions', 'tobemap', 'after_photo', 'handoff', 'summary']
  },
  green_belt: {
    label: 'Green Belt',
    color: '#3B7FDE',
    tools: ['charter', 'sipoc', 'process', 'before_photo', 'data_collection_plan', 'baseline', 'clues', 'fishbone', 'rootcause', 'verify', 'solutions', 'tobemap', 'after_photo', 'monitor', 'handoff', 'summary']
  },
  black_belt: {
    label: 'Black Belt',
    color: '#7C3AED',
    tools: ['charter', 'screener', 'sipoc', 'voc', 'process', 'before_photo', 'data_collection_plan', 'baseline', 'clues', 'fishbone', 'rootcause', 'confirm_stats', 'verify', 'solutions', 'tobemap', 'after_photo', 'monitor', 'transfer', 'handoff', 'summary']
  },
  investigation: {
    label: 'Investigation',
    color: '#e11d48',
    tools: ['screener', 'charter', 'sipoc', 'process', 'data_collection_plan', 'clues', 'fishbone', 'rootcause', 'confirm', 'recommendation']
  }
}

export default function ProjectDetail({ project: initialProject, onClose, onProjectUpdated, onOpenPortfolio, onNavigate, inline = false, demoMode }) {
  const [project, setProject]           = useState(initialProject)
  const [kpiData, setKpiData]           = useState([])
  const [observations, setObservations] = useState([])
  const [toolIdx, setToolIdx]           = useState(0)
  const [generating, setGenerating]     = useState(null)
  const [aiClues, setAiClues]           = useState([])
  const [cluesLoading, setCluesLoading] = useState(false)
  const [showPresent, setShowPresent]   = useState(false)
  const [kpiLogVal, setKpiLogVal]       = useState('')
  const [kpiLogDate, setKpiLogDate]     = useState(new Date().toISOString().split('T')[0])
  const [loggingKpi, setLoggingKpi]     = useState(false)
  const [newSolution, setNewSolution]   = useState('')
  const [newClue, setNewClue]           = useState('')
  const [newActionText, setNewActionText]   = useState('')
  const [newActionOwner, setNewActionOwner] = useState('')
  const [newActionDue, setNewActionDue]     = useState('')
  const [newActionStart, setNewActionStart] = useState('')
  const [newActionStatus, setNewActionStatus] = useState('Not Started')
  const [showGantt, setShowGantt]           = useState(false)
  const [showAddTask, setShowAddTask]       = useState(false)
  const [editingMetric, setEditingMetric]   = useState(false)
  const [mEdit, setMEdit]               = useState({ metric: '', baseline: '', target: '', custom: '' })
  const [showTimeline, setShowTimeline]     = useState(false)
  const [monitorDraft, setMonitorDraft]     = useState({ metric: '', frequency: '', trigger: '', responder: '', action: '' })
  const [transferArea, setTransferArea]     = useState('')
  const [transferBenefit, setTransferBenefit] = useState('')
  const [transferNotes, setTransferNotes]   = useState('')
  const [asIsNewStep, setAsIsNewStep]       = useState({ text: '', time: '', waste: '' })
  const [tobeNewStep, setTobeNewStep]       = useState({ text: '', time: '', note: '' })
  const [showAsIsMapPicker, setShowAsIsMapPicker] = useState(false)
  const [showTobeMapPicker, setShowTobeMapPicker] = useState(false)
  const [libraryMaps, setLibraryMaps]             = useState([])
  const [loadingMaps, setLoadingMaps]             = useState(false)
  const [baselineAutoFill, setBaselineAutoFill] = useState(null)
  const [pushToActionConfirm, setPushToActionConfirm] = useState(false)
  const [exportingA3, setExportingA3]           = useState(false)
  const [fishboneInputs, setFishboneInputs]     = useState({ Man: '', Machine: '', Method: '', Material: '', Measurement: '', Environment: '' })
  const [escalating, setEscalating]             = useState(false)
  const [escalateSuccess, setEscalateSuccess]   = useState(null)
  const [pmInputs, setPmInputs]                 = useState({})  // keyed by metric rowId: { date, value, note }

  useEffect(() => { loadData() }, [initialProject.id])

  async function loadData() {
    const [p, obs] = await Promise.all([
      api.getProject(initialProject.id).catch(() => initialProject),
      api.getObservations().catch(() => []),
    ])
    setProject(p)
    setObservations(obs)
    if (p.metric_id) api.getMetricData(p.metric_id).then(setKpiData).catch(() => {})

    // Baseline auto-fill: fetch latest KPI snapshot and store the value for this metric
    if (p.metric_id && p.metric_id !== 'custom') {
      api.getLatestKpis().then(latest => {
        const entry = Array.isArray(latest)
          ? latest.find(k => k.metric_id === p.metric_id)
          : (latest && latest[p.metric_id] != null ? { value: latest[p.metric_id] } : null)
        if (entry && entry.value != null) setBaselineAutoFill(entry.value)
      }).catch(() => {})
    }

    const cl = typeof p.stage_checklist === 'object' && p.stage_checklist ? p.stage_checklist : {}
    const active = p.project_type
      ? TOOLS.filter(t => (PROJECT_TYPES[p.project_type]?.tools || []).includes(t.id))
      : TOOLS
    const idx = cl.currentTool ? active.findIndex(t => t.id === cl.currentTool) : 0
    setToolIdx(Math.max(0, idx))
  }

  async function update(changes) {
    const updated = await api.updateProject(project.id, changes)
    setProject(updated)
    onProjectUpdated?.(updated)
    return updated
  }

  async function updateCharter(field, value) {
    return update({ charter: { ...(project.charter || {}), [field]: value } })
  }

  async function openMapPicker(which) {
    if (which === 'asis') { setShowAsIsMapPicker(p => !p); setShowTobeMapPicker(false) }
    else                  { setShowTobeMapPicker(p => !p); setShowAsIsMapPicker(false) }
    if (!libraryMaps.length) {
      setLoadingMaps(true)
      const maps = await api.getMaps().catch(() => [])
      setLibraryMaps(maps)
      setLoadingMaps(false)
    }
  }

  function importMapIntoAsIs(m) {
    const nodes = m.data?.nodes || []
    const steps = nodes.map(n => ({ id: Date.now() + Math.random(), text: n.label || '', time: '', waste: n.waste || '' }))
    updateCharter('processSteps', steps)
    updateCharter('importedMapId', m.id)
    setShowAsIsMapPicker(false)
    // Store link in localStorage
    try {
      const raw = localStorage.getItem('continuum_map_links')
      const links = raw ? JSON.parse(raw) : {}
      links[m.id] = [...new Set([...(links[m.id] || []), project.id])]
      localStorage.setItem('continuum_map_links', JSON.stringify(links))
    } catch {}
  }

  function importMapIntoTobe(m) {
    const nodes = m.data?.nodes || []
    const steps = nodes.map(n => ({ id: Date.now() + Math.random(), text: n.label || '', time: '', note: '' }))
    updateCharter('tobeSteps', steps)
    updateCharter('importedTobeMapId', m.id)
    setShowTobeMapPicker(false)
    try {
      const raw = localStorage.getItem('continuum_map_links')
      const links = raw ? JSON.parse(raw) : {}
      links[m.id] = [...new Set([...(links[m.id] || []), project.id])]
      localStorage.setItem('continuum_map_links', JSON.stringify(links))
    } catch {}
  }

  // ─── Navigation ───

  const activeTools = project.project_type
    ? TOOLS.filter(t => (PROJECT_TYPES[project.project_type]?.tools || []).includes(t.id))
    : TOOLS
  const tool     = activeTools[toolIdx]
  const checklist = typeof project.stage_checklist === 'object' && project.stage_checklist ? project.stage_checklist : {}
  const charter   = project.charter || {}

  const completedCount = activeTools.filter(t => checklist[t.id]).length
  const progressPct    = Math.round((completedCount / activeTools.length) * 100)
  const phaseColor     = PHASE_COLORS[tool?.phase] || '#6B7280'
  const typeConfig     = PROJECT_TYPES[project.project_type] || null
  const isAdvancedType = ['green_belt', 'black_belt'].includes(project?.project_type)

  const latestKpi  = kpiData.length > 0 ? kpiData[kpiData.length - 1]?.value : null
  const metaDir    = { uph: true, accuracy: true, dpmo: false, dts: true }[project.metric_id] ?? true
  const pctChange  = latestKpi != null && project.baseline != null
    ? (metaDir ? (latestKpi - project.baseline) / project.baseline * 100
               : (project.baseline - latestKpi) / project.baseline * 100)
    : null

  // ─── Stall detection ───
  const daysSinceUpdate = project.updated_at
    ? Math.floor((Date.now() - new Date(project.updated_at).getTime()) / (1000 * 60 * 60 * 24))
    : null

  const inputStyle = { background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }

  // ─── A3 PDF Export ───
  async function exportA3Pdf() {
    setExportingA3(true)
    try {
      const metricName = project.metric_id === 'custom'
        ? (charter.customMetricName || 'Custom')
        : (METRIC_LABELS[project.metric_id] || project.metric_id?.toUpperCase() || 'Metric')

      const committedSolutions = (charter.solutions || []).filter(s => s.selected).map(s => `• ${s.text}`).join('\n')
      const fiveWhysText = Array.isArray(charter.fiveWhys)
        ? charter.fiveWhys.filter(Boolean).map((w, i) => `Why ${i + 1}: ${w}`).join('\n')
        : ''
      const rootCause = charter.rootCauseSummary || fiveWhysText || 'Not documented'
      const resultText = pctChange != null
        ? `${project.baseline} → ${latestKpi} (${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}%)`
        : project.baseline != null ? `Baseline: ${project.baseline} → Target: ${project.target_value ?? '?'}` : 'Pending'
      const monPlan = Array.isArray(charter.monitoringPlan) && charter.monitoringPlan.length > 0
        ? charter.monitoringPlan.map(r => `• ${r.metric} — ${r.frequency}${r.trigger ? ` | Trigger: ${r.trigger}` : ''}${r.responder ? ` | Owner: ${r.responder}` : ''}`).join('\n')
        : (charter.handoff?.nextTarget ? charter.handoff.nextTarget : 'Not yet defined')

      // Generate A3 content via streamAgent for richer next steps, fall back to local data
      let nextStepsText = ''
      await new Promise((resolve) => {
        const prompt = `Write a concise CI project next steps / control plan (3–5 bullet points, plain text, no markdown headers) for:
Project: "${project.title}"
Metric: ${metricName} | Result: ${resultText}
Solutions: ${committedSolutions || 'Not documented'}
Output only the bullet points, each starting with •`
        let acc = ''
        streamAgent('chief-of-staff', [{ role: 'user', content: prompt }], null,
          chunk => { acc += chunk },
          () => { nextStepsText = acc.trim(); resolve() },
          () => { nextStepsText = monPlan; resolve() }
        )
      })

      // Build PDF — A4 landscape
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const W = 297
      const MARGIN = 14
      const COL = (W - MARGIN * 2 - 8) / 2
      let y = MARGIN

      // Title bar
      doc.setFillColor(10, 15, 30)
      doc.rect(0, 0, W, 18, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('A3 Report', MARGIN, 12)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(180, 180, 180)
      doc.text(`${project.title}  |  ${typeConfig?.label || 'CI Project'}  |  ${project.area || ''}  |  ${metricName}  |  ${new Date().toLocaleDateString()}`, MARGIN + 22, 12)

      y = 24

      function drawSection(title, body, x, sectionY, colW, color) {
        const [r, g, b] = color
        doc.setFillColor(r, g, b)
        doc.rect(x, sectionY, colW, 5, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'bold')
        doc.text(title.toUpperCase(), x + 3, sectionY + 3.5)

        doc.setTextColor(30, 30, 40)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        const lines = doc.splitTextToSize(body || 'Not documented', colW - 6)
        doc.text(lines, x + 3, sectionY + 10)
        return sectionY + 10 + lines.length * 4 + 4
      }

      const sections = [
        { title: 'Problem Statement', body: charter.problemStatement || 'Not documented', color: [59, 127, 222] },
        { title: 'Root Cause', body: rootCause, color: [220, 38, 38] },
        { title: 'Countermeasures', body: committedSolutions || 'Not documented', color: [22, 163, 74] },
        { title: `Results  —  Baseline vs Current  (${metricName})`, body: resultText, color: [5, 150, 105] },
        { title: 'Goal Statement', body: charter.goalStatement || `${metricName}: ${project.baseline ?? '?'} → ${project.target_value ?? '?'}`, color: [124, 58, 237] },
        { title: 'Next Steps / Control Plan', body: nextStepsText || monPlan, color: [5, 150, 105] },
      ]

      // Lay out in two columns
      let leftY = y
      let rightY = y
      sections.forEach((s, i) => {
        if (i % 2 === 0) {
          leftY = drawSection(s.title, s.body, MARGIN, leftY, COL, s.color)
        } else {
          rightY = drawSection(s.title, s.body, MARGIN + COL + 8, rightY, COL, s.color)
        }
      })

      // Footer
      const footerY = 205
      doc.setDrawColor(220, 220, 220)
      doc.line(MARGIN, footerY, W - MARGIN, footerY)
      doc.setFontSize(7)
      doc.setTextColor(160, 160, 160)
      doc.text('Generated by Continuum CI Management', MARGIN, footerY + 5)
      doc.text(`${new Date().toLocaleDateString()}`, W - MARGIN, footerY + 5, { align: 'right' })

      doc.save(`A3_${project.title.replace(/[^a-z0-9]/gi, '_')}.pdf`)
    } finally {
      setExportingA3(false)
    }
  }

  async function selectType(type) {
    const firstTool = PROJECT_TYPES[type]?.tools[0] || 'charter'
    await update({ project_type: type, stage_checklist: { currentTool: firstTool } })
    setToolIdx(0)
  }

  async function completeTool() {
    const newCl = { ...checklist, [tool.id]: true }
    const nextIdx = toolIdx + 1
    if (nextIdx < activeTools.length) {
      newCl.currentTool = activeTools[nextIdx].id
      setToolIdx(nextIdx)
    }
    const phaseAllDone = activeTools.filter(t => t.phase === tool.phase).every(t => newCl[t.id])
    let stageUpdate = {}
    if (phaseAllDone) {
      const nextPhase = PHASES[PHASES.indexOf(tool.phase) + 1]
      stageUpdate = { stage: nextPhase ? PHASE_STAGE[nextPhase] : 'Closed' }
    }
    await update({ stage_checklist: newCl, ...stageUpdate })
  }

  function prevTool() {
    if (toolIdx <= 0) return
    const newIdx = toolIdx - 1
    setToolIdx(newIdx)
    update({ stage_checklist: { ...checklist, currentTool: activeTools[newIdx].id } })
  }

  function goToTool(idx) {
    if (idx === toolIdx) return
    setToolIdx(idx)
    update({ stage_checklist: { ...checklist, currentTool: activeTools[idx].id } })
  }

  // ─── AI ───

  async function generateField(field, prompt) {
    setGenerating(field)
    let acc = ''
    streamAgent('chief-of-staff', [{ role: 'user', content: prompt }], null,
      chunk => { acc += chunk },
      async () => { await updateCharter(field, acc.trim()); setGenerating(null) },
      () => { setGenerating(null) }
    )
  }

  async function generateSolutionsAI() {
    setGenerating('solutions_ai')
    const fiveWhys = Array.isArray(charter.fiveWhys) ? charter.fiveWhys.filter(Boolean) : []
    const rootCauseContext = charter.rootCauseSummary
      || (fiveWhys.length > 0 ? fiveWhys[fiveWhys.length - 1] : null)
      || project.title
    const fiveWhysText = fiveWhys.length > 0
      ? `\n5 Whys: ${fiveWhys.map((w, i) => `Why ${i + 1}: ${w}`).join(' → ')}`
      : ''
    const prompt = `Generate 5 practical countermeasures to address this root cause for CI project "${project.title}" at an Amazon FC.
Root cause: ${rootCauseContext}${fiveWhysText}
Output ONLY a JSON array: [{"text":"..."}]`
    let acc = ''
    streamAgent('chief-of-staff', [{ role: 'user', content: prompt }], null,
      chunk => { acc += chunk },
      async () => {
        try {
          const parsed = JSON.parse(acc.replace(/```json|```/g, '').trim())
          const existing = charter.solutions || []
          const added = parsed.map(s => ({ text: s.text || s, selected: false, id: Date.now() + Math.random() }))
          await updateCharter('solutions', [...existing, ...added])
        } catch { /* ignore parse error */ }
        setGenerating(null)
      },
      () => { setGenerating(null) }
    )
  }

  async function generateClues() {
    if (cluesLoading) return
    setCluesLoading(true)
    setAiClues([])
    const recentObs = observations.slice(-40).map(o => ({ area: o.area, waste: o.waste_type, text: o.text.slice(0, 100) }))
    const prompt = `Lean Six Sigma coach analyzing floor walk observations for CI project: "${project.title}".
Identify 3-5 patterns that are clues for root cause analysis.
Observations: ${JSON.stringify(recentObs)}
Output ONLY JSON: [{"title":"...","description":"...","type":"Frequency|Trend|Outlier|Pattern"}]`
    let acc = ''
    streamAgent('chief-of-staff', [{ role: 'user', content: prompt }], null,
      chunk => { acc += chunk },
      () => {
        try {
          const parsed = JSON.parse(acc.replace(/```json|```/g, '').trim())
          setAiClues(Array.isArray(parsed) ? parsed : [])
        } catch { setAiClues([]) }
        setCluesLoading(false)
      },
      () => { setCluesLoading(false) }
    )
  }

  async function logKpi(e) {
    e.preventDefault()
    if (!project.metric_id || !kpiLogVal) return
    setLoggingKpi(true)
    try {
      await api.addKpi({ metric_id: project.metric_id, value: parseFloat(kpiLogVal), date: kpiLogDate })
      setKpiLogVal('')
      setKpiData(await api.getMetricData(project.metric_id).catch(() => []))
    } finally { setLoggingKpi(false) }
  }

  async function saveMetric(e) {
    e.preventDefault()
    const changes = {
      metric_id: mEdit.metric || null,
      baseline:  mEdit.baseline !== '' ? parseFloat(mEdit.baseline) : null,
      target_value: mEdit.target !== '' ? parseFloat(mEdit.target) : null,
    }
    if (mEdit.metric === 'custom' && mEdit.custom) {
      changes.charter = { ...(project.charter || {}), customMetricName: mEdit.custom }
    }
    await update(changes)
    if (mEdit.metric && mEdit.metric !== 'custom') {
      setKpiData(await api.getMetricData(mEdit.metric).catch(() => []))
    }
    setEditingMetric(false)
  }

  // ─── Tool Renderers ───

  function renderCharter() {
    const p = project
    const fields = [
      { key: 'problemStatement', label: 'Problem Statement',
        placeholder: 'What is wrong? Where? Since when? What impact is it having?',
        prompt: `Write a clear problem statement for this CI project at an Amazon FC. Project: "${p.title}". 2-3 sentences. Format: "Currently [X] is [issue]. This is causing [impact]. A target of [goal] has been identified." Output only the text.` },
      { key: 'goalStatement', label: 'Goal Statement',
        placeholder: 'Increase/Decrease [metric] from [baseline] to [target] by [date]',
        prompt: `Write a SMART goal statement for CI project: "${p.title}" | Metric: ${p.metric_id || 'TBD'} | Baseline: ${p.baseline || 'TBD'} | Target: ${p.target_value || 'TBD'}. Format: "Increase/Decrease [metric] from [X] to [Y] by [date]". Output only the text.` },
      { key: 'businessCase', label: 'Business Case',
        placeholder: "Why does this matter? What's the cost/quality/safety impact of NOT fixing this?",
        prompt: `Write a compelling 2-3 sentence business case for CI project: "${p.title}" at an Amazon FC. Focus on operational cost, customer impact, or safety. Output only the text.` },
      { key: 'scopeIn', label: 'Scope',
        placeholder: 'What is in scope? Which departments, processes, time periods?',
        prompt: `Write a scope definition (3-4 bullet points using •) for CI project: "${p.title}". Be specific about what is included. Output only the scope text.` },
    ]

    return (
      <div className="space-y-5">
        <div>
          <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Team Members</label>
          <input value={charter.teamMembers || ''} onChange={e => updateCharter('teamMembers', e.target.value)}
            placeholder="e.g. Ryan (CI Lead), John (Operations Manager), Sarah (Area Manager)"
            className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle} />
        </div>
        {fields.map(f => (
          <div key={f.key}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{f.label}</label>
              <button onClick={() => generateField(f.key, f.prompt)} disabled={generating === f.key}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-lg disabled:opacity-50"
                style={{ background: 'rgba(59,127,222,0.12)', color: '#60a5fa' }}>
                {generating === f.key ? '⏳ Drafting…' : '⚡ AI Draft'}
              </button>
            </div>
            <textarea value={charter[f.key] || ''} onChange={e => updateCharter(f.key, e.target.value)}
              placeholder={f.placeholder} rows={3}
              className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none" style={inputStyle} />
          </div>
        ))}
      </div>
    )
  }

  function renderBaseline() {
    const metricName = project.metric_id === 'custom'
      ? (charter.customMetricName || 'Custom')
      : (METRIC_LABELS[project.metric_id] || project.metric_id?.toUpperCase())

    if (editingMetric || !project.metric_id) {
      return (
        <form onSubmit={saveMetric} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Metric</label>
            <select value={mEdit.metric} onChange={e => setMEdit(p => ({ ...p, metric: e.target.value }))}
              className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle}>
              <option value="">Select metric…</option>
              <option value="uph">UPH (Units Per Hour)</option>
              <option value="accuracy">Pick Accuracy (%)</option>
              <option value="dpmo">DPMO (Defects Per Million)</option>
              <option value="dts">DTS (Dock to Stock Time)</option>
              <option value="custom">Custom metric…</option>
            </select>
          </div>
          {mEdit.metric === 'custom' && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Metric Name</label>
              <input value={mEdit.custom} onChange={e => setMEdit(p => ({ ...p, custom: e.target.value }))}
                placeholder="e.g. Scan Rate, Cycle Time, Error Rate"
                className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Baseline (current)</label>
              <input value={mEdit.baseline} onChange={e => setMEdit(p => ({ ...p, baseline: e.target.value }))}
                type="number" step="any" placeholder="Current value"
                className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Target (goal)</label>
              <input value={mEdit.target} onChange={e => setMEdit(p => ({ ...p, target: e.target.value }))}
                type="number" step="any" placeholder="Goal value"
                className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle} />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={!mEdit.metric}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
              style={{ background: phaseColor }}>Save Baseline</button>
            {project.metric_id && (
              <button type="button" onClick={() => setEditingMetric(false)}
                className="px-4 py-2.5 rounded-xl text-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )
    }

    return (
      <div className="space-y-5">
        {/* Belt-specific context note */}
        {(project.project_type === 'yellow_belt' || project.project_type === 'quick_win') && (
          <div className="px-4 py-3 rounded-xl text-xs leading-relaxed"
            style={{ background: `${phaseColor}0A`, borderLeft: `3px solid ${phaseColor}`, color: 'var(--text-2)' }}>
            <span className="font-bold" style={{ color: phaseColor }}>
              {project.project_type === 'quick_win' ? '⚡ Quick Win' : 'Y Yellow Belt'} Baseline
            </span>
            {project.project_type === 'quick_win'
              ? ' — Capture roughly where things stand now, or skip if the problem is obvious. This is a reference point, not a formal measurement.'
              : ' — Record the current state as a reference snapshot. You\'re not doing statistical process control — just capturing "where we started" so your Results section can show before vs. after.'}
          </div>
        )}
        <div className="p-4 rounded-xl border" style={{ background: `${phaseColor}0A`, borderColor: `${phaseColor}30` }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: phaseColor }}>Goal Statement</div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
            {charter.goalStatement || `${metricName}: ${project.baseline} → ${project.target_value ?? '?'}`}
          </p>
        </div>

        <div className="flex items-end gap-6">
          <div>
            <div className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Metric</div>
            <div className="text-base font-bold" style={{ color: 'var(--text-2)' }}>{metricName}</div>
          </div>
          <div>
            <div className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Baseline</div>
            <div className="text-4xl font-bold" style={{ color: 'var(--text-2)' }}>{project.baseline}</div>
          </div>
          <div className="text-xl mb-2" style={{ color: 'var(--border)' }}>→</div>
          <div>
            <div className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Target</div>
            <div className="text-4xl font-bold" style={{ color: phaseColor }}>{project.target_value ?? '?'}</div>
          </div>
          <button onClick={() => {
            setMEdit({ metric: project.metric_id || '', baseline: project.baseline ?? '', target: project.target_value ?? '', custom: charter.customMetricName || '' })
            setEditingMetric(true)
          }} className="ml-auto text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
            Edit →
          </button>
        </div>

        {kpiData.length > 1 && (
          <div>
            <ControlChart metricId={project.metric_id} data={kpiData} height={160} />
            <p className="text-xs mt-2" style={{ color: 'var(--text-3)' }}>
              {kpiData.length} data points · Mean: {(kpiData.reduce((s, d) => s + d.value, 0) / kpiData.length).toFixed(1)}
            </p>
          </div>
        )}

        <form onSubmit={logKpi} className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <input value={kpiLogVal} onChange={e => setKpiLogVal(e.target.value)} type="number" step="any"
            placeholder={`Log ${metricName} value…`}
            className="flex-1 text-sm rounded-xl border px-3 py-2" style={inputStyle} />
          <input value={kpiLogDate} onChange={e => setKpiLogDate(e.target.value)} type="date"
            className="text-sm rounded-xl border px-3 py-2" style={inputStyle} />
          <button type="submit" disabled={!kpiLogVal || loggingKpi}
            className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
            style={{ background: phaseColor }}>
            {loggingKpi ? '…' : 'Log'}
          </button>
        </form>

        {/* Project-specific measurements (Green Belt / Black Belt only) */}
        {isAdvancedType && (() => {
          const projectMetricData = charter.projectMetricData || {}
          const trackedEntries = Object.entries(projectMetricData).filter(([, m]) => !m._hidden && Array.isArray(m.entries))
          return (
            <div className="pt-3 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Project-specific measurements</div>
              {trackedEntries.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                  Define metrics in your Data Collection Plan to track project-specific measurements here.
                </p>
              ) : (
                <div className="space-y-3">
                  {trackedEntries.map(([rowId, metric]) => {
                    const entries = metric.entries
                    if (entries.length === 0) return (
                      <div key={rowId} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: 'var(--bg-input)' }}>
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>{metric.label}</span>
                        <span className="text-xs" style={{ color: 'var(--text-3)' }}>No data yet</span>
                      </div>
                    )
                    const mean = entries.reduce((s, e) => s + e.value, 0) / entries.length
                    const baseline = entries[0].value
                    const sparkData = entries.map(e => ({ value: e.value }))
                    const sparkMin = Math.min(...entries.map(e => e.value))
                    const sparkMax = Math.max(...entries.map(e => e.value))
                    const sparkPad = (sparkMax - sparkMin) * 0.2 || 1
                    const sparkDomain = [sparkMin - sparkPad, sparkMax + sparkPad]
                    const last = entries[entries.length - 1].value
                    const trend = metric.higherIsBetter ? (last >= baseline ? '#4ade80' : '#f87171') : (last <= baseline ? '#4ade80' : '#f87171')
                    return (
                      <div key={rowId} className="flex items-center gap-4 px-3 py-3 rounded-xl border"
                        style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }}>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-1)' }}>{metric.label}</div>
                          <div className="flex items-center gap-3 mt-1 text-[11px]">
                            <span style={{ color: 'var(--text-3)' }}>Baseline: <strong style={{ color: 'var(--text-2)' }}>{baseline}{metric.unit ? ` ${metric.unit}` : ''}</strong></span>
                            <span style={{ color: 'var(--text-3)' }}>Mean: <strong style={{ color: 'var(--text-2)' }}>{mean.toFixed(1)}{metric.unit ? ` ${metric.unit}` : ''}</strong></span>
                          </div>
                        </div>
                        <div style={{ width: 80, height: 32, flexShrink: 0 }}>
                          <ResponsiveContainer width="100%" height={32}>
                            <LineChart data={sparkData}>
                              <YAxis domain={sparkDomain} hide />
                              <Line type="monotone" dataKey="value" stroke={trend} strokeWidth={1.5} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}

        <div className="flex items-center gap-4 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm flex-1" style={{ color: 'var(--text-3)' }}>Is this baseline confirmed?</p>
          <button onClick={completeTool}
            className="px-5 py-2 rounded-xl text-sm font-bold text-white" style={{ background: '#16A34A' }}>YES ✓</button>
          <button onClick={() => setEditingMetric(true)}
            className="px-5 py-2 rounded-xl text-sm font-bold" style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>NO</button>
        </div>
      </div>
    )
  }

  function renderSipoc() {
    const sipoc = charter.sipoc || { suppliers: '', inputs: '', process: '', outputs: '', customers: '' }
    const cols = [
      { key: 'suppliers', label: 'Suppliers', color: '#3B7FDE', placeholder: 'Who provides inputs?\ne.g. Vendor, IT, HR' },
      { key: 'inputs',    label: 'Inputs',    color: '#7C3AED', placeholder: 'What do they provide?\ne.g. Scan guns, labels, SOPs' },
      { key: 'process',   label: 'Process',   color: '#E8820C', placeholder: 'High-level steps\ne.g. Pick → Pack → Ship' },
      { key: 'outputs',   label: 'Outputs',   color: '#16A34A', placeholder: 'What is produced?\ne.g. Picked tote, scanned item' },
      { key: 'customers', label: 'Customers', color: '#059669', placeholder: 'Who receives output?\ne.g. Pack station, sorter' },
    ]
    return (
      <div className="space-y-4">
        <div className="text-xs p-3 rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
          Map the end-to-end process at a high level before diving into detail. This helps confirm scope and stakeholders.
        </div>
        <div className="grid grid-cols-5 gap-2">
          {cols.map(c => (
            <div key={c.key}>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5 text-center py-1 rounded-t-xl"
                style={{ background: `${c.color}20`, color: c.color }}>{c.label}</div>
              <textarea
                value={sipoc[c.key] || ''}
                onChange={e => updateCharter('sipoc', { ...sipoc, [c.key]: e.target.value })}
                placeholder={c.placeholder}
                rows={6}
                className="w-full text-xs rounded-b-xl border px-2 py-2 resize-none"
                style={{ ...inputStyle, borderColor: `${c.color}30` }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderProcess() {
    const steps = Array.isArray(charter.processSteps) ? charter.processSteps : []
    const hasSteps = steps.length > 0

    function addStep(e) {
      e.preventDefault()
      if (!asIsNewStep.text.trim()) return
      updateCharter('processSteps', [...steps, { ...asIsNewStep, id: Date.now() }])
      setAsIsNewStep({ text: '', time: '', waste: '' })
    }
    function removeStep(id) {
      updateCharter('processSteps', steps.filter(s => s.id !== id))
    }
    function updateStep(id, field, val) {
      updateCharter('processSteps', steps.map(s => s.id === id ? { ...s, [field]: val } : s))
    }
    function handlePhoto(e) {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = ev => updateCharter('beforePhoto', ev.target.result)
      reader.readAsDataURL(file)
    }

    async function aiGenerateSteps() {
      const desc = charter.processDescription?.trim()
      if (!desc) return
      setGenerating('processSteps')
      let acc = ''
      const prompt = `You are a Lean Six Sigma expert. Convert this process description into a structured step-by-step process map for a CI project at an Amazon FC.

Project: "${project.title}"
Process description: "${desc}"

Break it into 5–9 discrete steps. For any step that contains waste (waiting, motion, overprocessing, defects, inventory, transport, unused talent), set the waste field to the waste type. Estimate time per step where possible.

Output ONLY valid JSON array with no markdown:
[{"text":"step description","time":"estimated time or empty","waste":"WasteType or empty string"}]`
      streamAgent('chief-of-staff', [{ role: 'user', content: prompt }], null,
        chunk => { acc += chunk },
        async () => {
          try {
            const parsed = JSON.parse(acc.replace(/```json|```/g, '').trim())
            await updateCharter('processSteps', parsed.map(s => ({ ...s, id: Date.now() + Math.random() })))
          } catch { /* ignore */ }
          setGenerating(null)
        },
        () => setGenerating(null)
      )
    }

    return (
      <div className="space-y-5">

        {/* Map Library Import */}
        <div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openMapPicker('asis')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all hover:opacity-80"
              style={{ background: showAsIsMapPicker ? `${phaseColor}15` : 'var(--bg-input)', color: showAsIsMapPicker ? phaseColor : 'var(--text-2)', borderColor: showAsIsMapPicker ? `${phaseColor}40` : 'var(--border)' }}>
              📎 Import from Map Library
            </button>
            {charter.importedMapId && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${phaseColor}15`, color: phaseColor }}>
                🔗 Linked from library
              </span>
            )}
          </div>
          {showAsIsMapPicker && (
            <div className="mt-2 rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              {loadingMaps ? (
                <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-3)' }}>Loading maps…</div>
              ) : libraryMaps.length === 0 ? (
                <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-3)' }}>No maps in library yet. Create them in Reports → Map Library.</div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {libraryMaps.map(m => (
                    <button key={m.id} onClick={() => importMapIntoAsIs(m)}
                      className="w-full text-left px-4 py-2.5 hover:opacity-80 transition-opacity flex items-center justify-between gap-3"
                      style={{ background: 'transparent' }}>
                      <div>
                        <div className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{m.title}</div>
                        {m.area && <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>{m.area} · {m.data?.nodes?.length || 0} steps</div>}
                      </div>
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--accent)' }}>Import →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 1: Describe */}
        <div className="rounded-2xl border p-4 space-y-3" style={{ background: `${phaseColor}06`, borderColor: `${phaseColor}25` }}>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0"
              style={{ background: phaseColor, color: 'white' }}>1</span>
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: phaseColor }}>Describe the Current Process</span>
          </div>
          <textarea
            value={charter.processDescription || ''}
            onChange={e => updateCharter('processDescription', e.target.value)}
            placeholder="Describe what happens in this process from start to finish, in plain English. Include who does what, how long things take, and where problems tend to occur.

e.g. Associates walk to a pick station and receive a scan assignment. They pick items from bins and scan each one. Completed totes are placed on a conveyor and transported to consolidation. There is often a wait at consolidation during peak hours..."
            rows={5}
            className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none leading-relaxed"
            style={inputStyle} />
          <button
            onClick={aiGenerateSteps}
            disabled={generating === 'processSteps' || !charter.processDescription?.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all"
            style={{ background: phaseColor }}>
            {generating === 'processSteps' ? '⏳ Generating map…' : '⚡ Generate Process Map'}
          </button>
          {!charter.processDescription?.trim() && (
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Describe the process above first, then AI will break it into structured steps</p>
          )}
        </div>

        {/* Step 2: Editable map */}
        {hasSteps && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0"
                style={{ background: phaseColor, color: 'white' }}>2</span>
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: phaseColor }}>Edit the Process Map</span>
              <span className="text-xs ml-auto" style={{ color: 'var(--text-3)' }}>Click any field to edit · Flag waste type on each step</span>
            </div>

            <div className="space-y-2">
              {steps.map((s, i) => {
                const wc = WASTE_COLORS[s.waste]
                return (
                  <div key={s.id || i} className="flex items-start gap-2 group">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-2"
                      style={{ background: `${phaseColor}20`, color: phaseColor }}>{i + 1}</div>
                    <div className="flex-1 rounded-xl border px-3 py-2.5 transition-all hover:border-opacity-60"
                      style={{ background: 'var(--bg-input)', borderColor: wc ? `${wc}50` : 'var(--border2)', borderLeftWidth: wc ? 3 : 1, borderLeftColor: wc || 'var(--border2)' }}>
                      <input value={s.text} onChange={e => updateStep(s.id, 'text', e.target.value)}
                        className="w-full bg-transparent text-sm outline-none mb-2 font-medium" style={{ color: 'var(--text-1)' }} />
                      <div className="flex items-center gap-3">
                        <input value={s.time || ''} onChange={e => updateStep(s.id, 'time', e.target.value)}
                          placeholder="Time…" className="bg-transparent text-xs outline-none w-20 border-b" style={{ color: 'var(--text-3)', borderColor: 'var(--border)' }} />
                        <select value={s.waste || ''} onChange={e => updateStep(s.id, 'waste', e.target.value)}
                          className="bg-transparent text-xs outline-none flex-1 rounded px-1"
                          style={{ color: wc || 'var(--text-3)', background: wc ? `${wc}10` : 'transparent' }}>
                          {WASTE_TYPES.map(w => <option key={w} value={w}>{w || '— No waste —'}</option>)}
                        </select>
                        {wc && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: `${wc}20`, color: wc }}>⚡ {s.waste}</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => removeStep(s.id)}
                      className="opacity-0 group-hover:opacity-100 mt-2.5 text-xs transition-opacity" style={{ color: 'var(--text-3)' }}>✕</button>
                  </div>
                )
              })}
            </div>

            {steps.some(s => s.waste) && (
              <div className="flex flex-wrap gap-2 px-1">
                {[...new Set(steps.filter(s => s.waste).map(s => s.waste))].map(w => (
                  <span key={w} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${WASTE_COLORS[w]}15`, color: WASTE_COLORS[w] }}>
                    {steps.filter(s => s.waste === w).length}× {w}
                  </span>
                ))}
              </div>
            )}

            {/* Add step inline */}
            <form onSubmit={addStep} className="flex gap-2 items-end pt-1">
              <input value={asIsNewStep.text} onChange={e => setAsIsNewStep(s => ({ ...s, text: e.target.value }))}
                placeholder="+ Add a step…"
                className="flex-1 text-sm rounded-xl border px-3 py-2" style={inputStyle} />
              <input value={asIsNewStep.time} onChange={e => setAsIsNewStep(s => ({ ...s, time: e.target.value }))}
                placeholder="Time" className="w-20 text-sm rounded-xl border px-3 py-2" style={inputStyle} />
              <select value={asIsNewStep.waste} onChange={e => setAsIsNewStep(s => ({ ...s, waste: e.target.value }))}
                className="text-sm rounded-xl border px-3 py-2" style={inputStyle}>
                {WASTE_TYPES.map(w => <option key={w} value={w}>{w || 'No waste'}</option>)}
              </select>
              <button type="submit" disabled={!asIsNewStep.text.trim()}
                className="px-3 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                style={{ background: phaseColor }}>Add</button>
            </form>
          </div>
        )}

        {/* Step 3: Before Photo */}
        <div className="pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>3</span>
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Before Photo</span>
          </div>
          {charter.beforePhoto ? (
            <div className="relative group">
              <img src={charter.beforePhoto} alt="Before" className="w-full rounded-xl object-cover max-h-64" />
              <button onClick={() => updateCharter('beforePhoto', null)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-full flex items-center justify-center text-xs"
                style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}>✕</button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed cursor-pointer hover:opacity-70 transition-opacity"
              style={{ borderColor: `${phaseColor}35`, background: `${phaseColor}04` }}>
              <span className="text-xl">📷</span>
              <span className="text-sm font-semibold" style={{ color: phaseColor }}>Upload Before Photo</span>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>Current state before improvement</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
          )}
        </div>
      </div>
    )
  }

  function renderTobemap() {
    const steps = Array.isArray(charter.tobeSteps) ? charter.tobeSteps : []
    const hasSteps = steps.length > 0
    const committedSolutions = (charter.solutions || []).filter(s => s.selected)
    const asIsSteps = charter.processSteps || []

    function addStep(e) {
      e.preventDefault()
      if (!tobeNewStep.text.trim()) return
      updateCharter('tobeSteps', [...steps, { ...tobeNewStep, id: Date.now() }])
      setTobeNewStep({ text: '', time: '', note: '' })
    }
    function removeStep(id) {
      updateCharter('tobeSteps', steps.filter(s => s.id !== id))
    }
    function updateStep(id, field, val) {
      updateCharter('tobeSteps', steps.map(s => s.id === id ? { ...s, [field]: val } : s))
    }
    function handlePhoto(e) {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = ev => updateCharter('afterPhoto', ev.target.result)
      reader.readAsDataURL(file)
    }

    async function aiGenerateTobeSteps() {
      if (!committedSolutions.length && !asIsSteps.length) return
      setGenerating('tobeSteps')
      const asIsText = asIsSteps.map((s, i) => `${i + 1}. ${s.text}${s.waste ? ` [${s.waste}]` : ''}`).join('\n')
      const solutionsText = committedSolutions.map(s => `• ${s.text}`).join('\n')
      const extraContext = charter.tobeDescription?.trim()
      const prompt = `You are a Lean Six Sigma expert. Generate the To-Be (improved future state) process map for this CI project.

Project: "${project.title}"

As-Is process (current state):
${asIsText || '(not mapped yet)'}

Committed solutions being implemented:
${solutionsText || '(not specified)'}
${extraContext ? `\nAdditional context: ${extraContext}` : ''}

Create the improved process — eliminate waste steps, show how solutions change each step, and add any new steps the solutions introduce. For each step include a note explaining what changed vs the As-Is.

Output ONLY valid JSON array with no markdown:
[{"text":"step description","time":"estimated time or empty","note":"what improved vs as-is, or empty if unchanged"}]`
      let acc = ''
      streamAgent('chief-of-staff', [{ role: 'user', content: prompt }], null,
        chunk => { acc += chunk },
        async () => {
          try {
            const parsed = JSON.parse(acc.replace(/```json|```/g, '').trim())
            await updateCharter('tobeSteps', parsed.map(s => ({ ...s, id: Date.now() + Math.random() })))
          } catch { /* ignore */ }
          setGenerating(null)
        },
        () => setGenerating(null)
      )
    }

    const wasteCount = asIsSteps.filter(s => s.waste).length
    const canGenerate = committedSolutions.length > 0 || asIsSteps.length > 0

    return (
      <div className="space-y-5">

        {/* Map Library Import */}
        <div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openMapPicker('tobe')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all hover:opacity-80"
              style={{ background: showTobeMapPicker ? 'rgba(22,163,74,0.12)' : 'var(--bg-input)', color: showTobeMapPicker ? '#16A34A' : 'var(--text-2)', borderColor: showTobeMapPicker ? 'rgba(22,163,74,0.4)' : 'var(--border)' }}>
              📎 Import from Map Library
            </button>
            {charter.importedTobeMapId && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(22,163,74,0.12)', color: '#16A34A' }}>
                🔗 Linked from library
              </span>
            )}
          </div>
          {showTobeMapPicker && (
            <div className="mt-2 rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              {loadingMaps ? (
                <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-3)' }}>Loading maps…</div>
              ) : libraryMaps.length === 0 ? (
                <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-3)' }}>No maps in library yet. Create them in Reports → Map Library.</div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {libraryMaps.map(m => (
                    <button key={m.id} onClick={() => importMapIntoTobe(m)}
                      className="w-full text-left px-4 py-2.5 hover:opacity-80 transition-opacity flex items-center justify-between gap-3"
                      style={{ background: 'transparent' }}>
                      <div>
                        <div className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{m.title}</div>
                        {m.area && <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>{m.area} · {m.data?.nodes?.length || 0} steps</div>}
                      </div>
                      <span className="text-xs flex-shrink-0" style={{ color: '#16A34A' }}>Import →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 1: Solutions context (read-only, drives generation) */}
        <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'rgba(22,163,74,0.06)', borderColor: 'rgba(22,163,74,0.25)' }}>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0"
              style={{ background: '#16A34A', color: 'white' }}>1</span>
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#16A34A' }}>Solutions Driving This Map</span>
          </div>

          {committedSolutions.length > 0 ? (
            <div className="space-y-1.5">
              {committedSolutions.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-2)' }}>
                  <span style={{ color: '#4ade80', flexShrink: 0 }}>✓</span>
                  <span>{s.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>No solutions committed yet — go to Solutions tool first and select countermeasures</p>
          )}

          {asIsSteps.length > 0 && (
            <div className="flex items-center gap-3 pt-1 border-t text-xs" style={{ borderColor: 'rgba(22,163,74,0.2)', color: 'var(--text-3)' }}>
              <span>As-Is: <strong style={{ color: 'var(--text-2)' }}>{asIsSteps.length} steps</strong></span>
              {wasteCount > 0 && <span style={{ color: '#f87171' }}>{wasteCount} waste steps to eliminate</span>}
            </div>
          )}

          <div>
            <label className="text-[10px] uppercase tracking-wide font-semibold mb-1 block" style={{ color: 'var(--text-3)' }}>Additional context (optional)</label>
            <textarea
              value={charter.tobeDescription || ''}
              onChange={e => updateCharter('tobeDescription', e.target.value)}
              placeholder="Any extra context for the improved state — e.g. new equipment, layout changes, team restructure..."
              rows={2}
              className="w-full text-sm rounded-xl border px-3 py-2 resize-none"
              style={inputStyle} />
          </div>

          <button
            onClick={aiGenerateTobeSteps}
            disabled={generating === 'tobeSteps' || !canGenerate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
            style={{ background: '#16A34A' }}>
            {generating === 'tobeSteps' ? '⏳ Generating map…' : '⚡ Generate To-Be from Solutions'}
          </button>
        </div>

        {/* Step 2: Editable To-Be steps */}
        {hasSteps && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0"
                style={{ background: '#16A34A', color: 'white' }}>2</span>
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#16A34A' }}>Edit the To-Be Map</span>
              <span className="text-xs ml-auto" style={{ color: 'var(--text-3)' }}>Click any field to edit · Green notes = improvement vs As-Is</span>
            </div>
            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={s.id || i} className="flex items-start gap-2 group">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-2"
                    style={{ background: 'rgba(22,163,74,0.2)', color: '#16A34A' }}>{i + 1}</div>
                  <div className="flex-1 rounded-xl border px-3 py-2.5 transition-all"
                    style={{ background: 'var(--bg-input)', borderColor: s.note ? 'rgba(22,163,74,0.4)' : 'var(--border2)', borderLeftWidth: s.note ? 3 : 1, borderLeftColor: s.note ? '#16A34A' : 'var(--border2)' }}>
                    <input value={s.text} onChange={e => updateStep(s.id, 'text', e.target.value)}
                      className="w-full bg-transparent text-sm outline-none mb-2 font-medium" style={{ color: 'var(--text-1)' }} />
                    <div className="flex items-center gap-3">
                      <input value={s.time || ''} onChange={e => updateStep(s.id, 'time', e.target.value)}
                        placeholder="Time…" className="bg-transparent text-xs outline-none w-20 border-b" style={{ color: 'var(--text-3)', borderColor: 'var(--border)' }} />
                      <input value={s.note || ''} onChange={e => updateStep(s.id, 'note', e.target.value)}
                        placeholder="What improved vs As-Is?…" className="bg-transparent text-xs outline-none flex-1" style={{ color: s.note ? '#4ade80' : 'var(--text-3)' }} />
                    </div>
                  </div>
                  <button onClick={() => removeStep(s.id)}
                    className="opacity-0 group-hover:opacity-100 mt-2.5 text-xs transition-opacity" style={{ color: 'var(--text-3)' }}>✕</button>
                </div>
              ))}
            </div>

            {/* Add step inline */}
            <form onSubmit={addStep} className="flex gap-2 items-end pt-1">
              <input value={tobeNewStep.text} onChange={e => setTobeNewStep(s => ({ ...s, text: e.target.value }))}
                placeholder="+ Add a step…" className="flex-1 text-sm rounded-xl border px-3 py-2" style={inputStyle} />
              <input value={tobeNewStep.time} onChange={e => setTobeNewStep(s => ({ ...s, time: e.target.value }))}
                placeholder="Time" className="w-20 text-sm rounded-xl border px-3 py-2" style={inputStyle} />
              <input value={tobeNewStep.note} onChange={e => setTobeNewStep(s => ({ ...s, note: e.target.value }))}
                placeholder="What improved?" className="w-36 text-sm rounded-xl border px-3 py-2" style={inputStyle} />
              <button type="submit" disabled={!tobeNewStep.text.trim()}
                className="px-3 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                style={{ background: '#16A34A' }}>Add</button>
            </form>
          </div>
        )}

        {/* After Photo */}
        <div className="pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-4 mb-3">
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>After Photo</div>
            {charter.beforePhoto && (
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>Before photo logged in As-Is Process ✓</span>
            )}
          </div>
          {charter.afterPhoto ? (
            <div className="relative group">
              <img src={charter.afterPhoto} alt="After" className="w-full rounded-xl object-cover max-h-64" />
              <button onClick={() => updateCharter('afterPhoto', null)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-full flex items-center justify-center text-xs"
                style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}>✕</button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer hover:opacity-70 transition-opacity"
              style={{ borderColor: 'rgba(22,163,74,0.4)', background: 'rgba(22,163,74,0.04)' }}>
              <span className="text-2xl">📷</span>
              <span className="text-sm font-semibold" style={{ color: '#16A34A' }}>Upload After Photo</span>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>Shows the improved state after implementation</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
          )}
        </div>

        {/* Before/After side by side if both exist */}
        {charter.beforePhoto && charter.afterPhoto && (
          <div className="pt-2">
            <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-3)' }}>Before / After Comparison</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold mb-1.5" style={{ color: '#f87171' }}>Before</div>
                <img src={charter.beforePhoto} alt="Before" className="w-full rounded-xl object-cover" style={{ maxHeight: 200 }} />
              </div>
              <div>
                <div className="text-xs font-semibold mb-1.5" style={{ color: '#4ade80' }}>After</div>
                <img src={charter.afterPhoto} alt="After" className="w-full rounded-xl object-cover" style={{ maxHeight: 200 }} />
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderClues() {
    const loggedClues = charter.clues || []

    function addClue(c) {
      updateCharter('clues', [...loggedClues, { ...c, id: Date.now() }])
    }
    function removeClue(id) {
      updateCharter('clues', loggedClues.filter(c => c.id !== id))
    }

    return (
      <div className="space-y-5">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>AI Generated</span>
              {aiClues.length > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${phaseColor}20`, color: phaseColor }}>{aiClues.length}</span>
              )}
            </div>
            <button onClick={generateClues} disabled={cluesLoading || observations.length === 0}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
              style={{ background: `${phaseColor}15`, color: phaseColor }}>
              {cluesLoading ? '⏳ Analysing…' : observations.length === 0 ? 'No floor walk data' : '⚡ Analyse Observations'}
            </button>
          </div>

          {cluesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--bg-input)' }} />)}
            </div>
          ) : aiClues.length > 0 ? (
            <div className="space-y-2">
              {aiClues.map((c, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-xl border"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold" style={{ color: phaseColor }}>{c.title}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `${phaseColor}15`, color: phaseColor }}>{c.type}</span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-2)' }}>{c.description}</p>
                  </div>
                  <button onClick={() => addClue(c)}
                    className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg text-white whitespace-nowrap"
                    style={{ background: phaseColor }}>ADD TO CLUES</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-xl text-center" style={{ background: 'var(--bg-input)' }}>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                {observations.length > 0
                  ? `${observations.length} floor walk observations ready to analyse`
                  : 'Log floor walk observations first to generate AI clues'}
              </p>
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Add Clue Manually</div>
          <form onSubmit={e => { e.preventDefault(); if (!newClue.trim()) return; addClue({ title: newClue, description: '', type: 'Manual' }); setNewClue('') }}
            className="flex gap-2">
            <input value={newClue} onChange={e => setNewClue(e.target.value)}
              placeholder="Describe a pattern or clue you've noticed…"
              className="flex-1 text-sm rounded-xl border px-3 py-2" style={inputStyle} />
            <button type="submit" disabled={!newClue.trim()}
              className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
              style={{ background: phaseColor }}>Add</button>
          </form>
          {onNavigate && (
            <button onClick={() => onNavigate('floor')}
              className="mt-2 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg w-full"
              style={{ background: 'rgba(22,163,74,0.08)', color: '#4ade80', border: '1px solid rgba(22,163,74,0.15)' }}>
              ◎ Go to Floor Walk to log an observation
            </button>
          )}
        </div>

        {loggedClues.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Logged Clues</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>{loggedClues.length}</span>
            </div>
            <div className="space-y-2">
              {loggedClues.map((c, i) => (
                <div key={c.id || i} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.15)' }}>
                  <span style={{ color: '#4ade80' }}>✓</span>
                  <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-1)' }}>{c.title}</span>
                  <button onClick={() => removeClue(c.id)} className="text-xs" style={{ color: 'var(--text-3)' }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderRootCause() {
    const fiveWhys = Array.isArray(charter.fiveWhys) ? charter.fiveWhys : ['', '', '', '', '']
    function setWhy(i, val) {
      const updated = [...fiveWhys]; updated[i] = val
      updateCharter('fiveWhys', updated)
    }

    return (
      <div className="space-y-5">
        {charter.problemStatement && (
          <div className="p-4 rounded-xl border" style={{ background: `${phaseColor}0A`, borderColor: `${phaseColor}30` }}>
            <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: phaseColor }}>Problem</div>
            <p className="text-sm" style={{ color: 'var(--text-1)' }}>{charter.problemStatement}</p>
          </div>
        )}

        <div className="space-y-3">
          {fiveWhys.map((why, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mt-1"
                style={{ background: `${phaseColor}20`, color: phaseColor }}>{i + 1}</div>
              <div className="flex-1">
                <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-3)' }}>Why {i + 1}?</div>
                <input value={why} onChange={e => setWhy(i, e.target.value)}
                  placeholder={i === 0 ? 'Why is the problem occurring?' : `Why ${i + 1}?`}
                  className="w-full text-sm rounded-xl border px-3 py-2.5"
                  style={{ ...inputStyle, borderColor: why ? phaseColor + '60' : 'var(--border2)' }} />
              </div>
            </div>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Root Cause Statement</div>
            <button
              onClick={() => generateField('rootCauseSummary', `Based on this 5 Whys analysis for project "${project.title}":
${fiveWhys.map((w, i) => `Why ${i + 1}: ${w || '(not answered)'}`).join('\n')}
Write a clear 1-2 sentence root cause statement. Output only the statement.`)}
              disabled={generating === 'rootCauseSummary' || fiveWhys.filter(Boolean).length < 2}
              className="text-xs font-semibold px-3 py-1 rounded-lg disabled:opacity-50"
              style={{ background: `${phaseColor}15`, color: phaseColor }}>
              {generating === 'rootCauseSummary' ? '⏳' : '⚡ Generate'}
            </button>
          </div>
          <textarea value={charter.rootCauseSummary || ''} onChange={e => updateCharter('rootCauseSummary', e.target.value)}
            placeholder="The root cause is…" rows={3}
            className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none" style={inputStyle} />
        </div>
      </div>
    )
  }

  function renderSolutions() {
    const solutions = charter.solutions || []
    const selectedCount = solutions.filter(s => s.selected).length

    return (
      <div className="space-y-5">
        {charter.rootCauseSummary && (
          <div className="p-4 rounded-xl border" style={{ background: `${phaseColor}0A`, borderColor: `${phaseColor}30` }}>
            <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: phaseColor }}>Root Cause</div>
            <p className="text-sm" style={{ color: 'var(--text-1)' }}>{charter.rootCauseSummary}</p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
              Solutions {selectedCount > 0 && <span style={{ color: phaseColor }}>· {selectedCount} committed</span>}
            </div>
            <button onClick={generateSolutionsAI} disabled={generating === 'solutions_ai'}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
              style={{ background: `${phaseColor}15`, color: phaseColor }}>
              {generating === 'solutions_ai' ? '⏳ Generating…' : '⚡ AI Suggest'}
            </button>
          </div>

          <form onSubmit={e => {
            e.preventDefault(); if (!newSolution.trim()) return
            updateCharter('solutions', [...solutions, { text: newSolution, selected: true, id: Date.now() }])
            setNewSolution('')
          }} className="flex gap-2 mb-3">
            <input value={newSolution} onChange={e => setNewSolution(e.target.value)}
              placeholder="Add a countermeasure…"
              className="flex-1 text-sm rounded-xl border px-3 py-2" style={inputStyle} />
            <button type="submit" disabled={!newSolution.trim()}
              className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
              style={{ background: phaseColor }}>Add</button>
          </form>

          {solutions.length > 0 ? (
            <div className="space-y-2">
              {solutions.map((s, i) => (
                <div key={s.id || i} className="flex items-center gap-3">
                  <button onClick={() => {
                    const updated = solutions.map((x, j) => j === i ? { ...x, selected: !x.selected } : x)
                    updateCharter('solutions', updated)
                  }} className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:opacity-80 transition-all"
                    style={{ background: s.selected ? `${phaseColor}12` : 'var(--bg-input)', border: `1px solid ${s.selected ? phaseColor + '40' : 'var(--border)'}` }}>
                    <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{ background: s.selected ? phaseColor : 'transparent', borderColor: s.selected ? phaseColor : 'rgba(255,255,255,0.2)' }}>
                      {s.selected && <span className="text-white text-[10px] font-bold">✓</span>}
                    </span>
                    <span className="text-sm flex-1" style={{ color: 'var(--text-1)' }}>{s.text}</span>
                    <span className="text-xs" style={{ color: s.selected ? phaseColor : 'var(--text-3)' }}>
                      {s.selected ? 'Committed' : 'Tap to select'}
                    </span>
                  </button>
                  <button onClick={() => updateCharter('solutions', solutions.filter((_, j) => j !== i))}
                    className="text-xs px-2 py-1" style={{ color: 'var(--text-3)' }}>✕</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-xl text-center" style={{ background: 'var(--bg-input)' }}>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>Add solutions or use AI to generate ideas based on your root cause</p>
            </div>
          )}

          {/* Push committed solutions to Action Plan */}
          {selectedCount > 0 && (
            <div className="pt-3 border-t flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
              {pushToActionConfirm ? (
                <span className="text-xs font-semibold flex-1" style={{ color: '#4ade80' }}>
                  ✓ {selectedCount} task{selectedCount !== 1 ? 's' : ''} added to Action Plan
                </span>
              ) : (
                <span className="text-xs flex-1" style={{ color: 'var(--text-3)' }}>
                  {selectedCount} committed solution{selectedCount !== 1 ? 's' : ''} ready
                </span>
              )}
              <button
                onClick={async () => {
                  const committed = solutions.filter(s => s.selected)
                  const existing = project.actions || []
                  const newActions = committed.map(s => ({
                    text: s.text, owner: '', start_date: null, due: null,
                    status: 'Not Started', done: false,
                  }))
                  await update({ actions: [...existing, ...newActions] })
                  setPushToActionConfirm(true)
                  setTimeout(() => setPushToActionConfirm(false), 3000)
                }}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                style={{ background: phaseColor }}>
                Push to Action Plan →
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderActions() {
    const actions = project.actions || []
    const today = new Date()

    const STATUS_COLORS = {
      'Not Started': '#6B7280',
      'In Progress': '#3B7FDE',
      'Complete':    '#16A34A',
      'Blocked':     '#DC2626',
    }
    const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Complete', 'Blocked']

    function getStatus(a) {
      if (a.status) return a.status
      return a.done ? 'Complete' : 'Not Started'
    }

    function setStatus(i, status) {
      update({ actions: actions.map((x, j) => j === i ? { ...x, status, done: status === 'Complete' } : x) })
    }

    function addTask(e) {
      e.preventDefault()
      if (!newActionText.trim()) return
      update({ actions: [...actions, {
        text: newActionText, owner: newActionOwner,
        start_date: newActionStart || null, due: newActionDue || null,
        status: newActionStatus, done: newActionStatus === 'Complete',
      }]})
      setNewActionText(''); setNewActionOwner(''); setNewActionStart(''); setNewActionDue(''); setNewActionStatus('Not Started')
      setShowAddTask(false)
    }

    const completeCount = actions.filter(a => getStatus(a) === 'Complete').length

    // ── Gantt chart ──
    function renderGantt() {
      const withDates = actions.filter(a => a.start_date && a.due)
      if (withDates.length === 0) return (
        <div className="p-6 rounded-xl text-center" style={{ background: 'var(--bg-input)' }}>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>Add start and due dates to tasks to generate a Gantt chart</p>
        </div>
      )

      const allDates = withDates.flatMap(a => [new Date(a.start_date), new Date(a.due)])
      const minMs = Math.min(...allDates.map(d => d.getTime()))
      const maxMs = Math.max(...allDates.map(d => d.getTime()))
      const totalMs = Math.max(1, maxMs - minMs)

      // Generate week tick marks
      const ticks = []
      const tickStart = new Date(minMs)
      tickStart.setDate(tickStart.getDate() - tickStart.getDay()) // start of week
      for (let d = new Date(tickStart); d.getTime() <= maxMs + 7 * 86400000; d.setDate(d.getDate() + 7)) {
        const pct = ((d.getTime() - minMs) / totalMs) * 100
        if (pct >= -5 && pct <= 105) ticks.push({ pct: Math.max(0, pct), label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) })
      }

      const todayPct = ((today.getTime() - minMs) / totalMs) * 100

      return (
        <div className="space-y-2">
          {/* Tick header */}
          <div className="relative h-6 ml-36">
            {ticks.map((t, i) => (
              <div key={i} className="absolute top-0 flex flex-col items-center" style={{ left: `${t.pct}%`, transform: 'translateX(-50%)' }}>
                <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{t.label}</span>
              </div>
            ))}
            {todayPct >= 0 && todayPct <= 100 && (
              <div className="absolute top-0 bottom-0" style={{ left: `${todayPct}%`, width: 1, background: '#f87171', opacity: 0.6 }} />
            )}
          </div>

          {/* Task rows */}
          {withDates.map((a, i) => {
            const startPct = ((new Date(a.start_date).getTime() - minMs) / totalMs) * 100
            const widthPct = ((new Date(a.due).getTime() - new Date(a.start_date).getTime()) / totalMs) * 100
            const sc = STATUS_COLORS[getStatus(a)] || '#6B7280'
            return (
              <div key={i} className="flex items-center gap-3">
                <div className="w-32 flex-shrink-0 text-xs font-medium truncate" style={{ color: 'var(--text-2)' }}>{a.text}</div>
                <div className="flex-1 relative h-7 rounded-lg overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                  <div className="absolute top-1 bottom-1 rounded-md flex items-center px-2"
                    style={{ left: `${Math.max(0, startPct)}%`, width: `${Math.max(2, widthPct)}%`, background: `${sc}cc`, minWidth: 8 }}>
                    {widthPct > 8 && <span className="text-[10px] font-bold text-white truncate">{a.owner || ''}</span>}
                  </div>
                  {todayPct >= 0 && todayPct <= 100 && (
                    <div className="absolute top-0 bottom-0" style={{ left: `${todayPct}%`, width: 1, background: '#f87171', opacity: 0.5 }} />
                  )}
                </div>
                <span className="text-[10px] font-bold flex-shrink-0 px-1.5 py-0.5 rounded-full"
                  style={{ background: `${sc}18`, color: sc }}>{getStatus(a)}</span>
              </div>
            )
          })}

          {actions.length > withDates.length && (
            <p className="text-xs pt-1" style={{ color: 'var(--text-3)' }}>
              {actions.length - withDates.length} task(s) without dates not shown
            </p>
          )}
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* Committed solutions banner */}
        {(charter.solutions || []).filter(s => s.selected).length > 0 && (
          <div className="p-3 rounded-xl border" style={{ background: `${phaseColor}0A`, borderColor: `${phaseColor}30` }}>
            <div className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: phaseColor }}>Committed Solutions</div>
            <div className="flex flex-wrap gap-1.5">
              {charter.solutions.filter(s => s.selected).map((s, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${phaseColor}15`, color: phaseColor }}>• {s.text}</span>
              ))}
            </div>
          </div>
        )}

        {/* Header row */}
        <div className="flex items-center gap-2">
          <div>
            <span className="text-xs font-semibold" style={{ color: completeCount === actions.length && actions.length > 0 ? '#4ade80' : 'var(--text-3)' }}>
              {completeCount}/{actions.length} complete
            </span>
          </div>
          <div className="flex-1" />
          <button onClick={() => setShowGantt(g => !g)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={showGantt
              ? { background: phaseColor, color: 'white' }
              : { background: 'var(--bg-input)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
            ▤ {showGantt ? 'List View' : 'Gantt Chart'}
          </button>
          <button onClick={() => setShowAddTask(t => !t)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
            style={{ background: phaseColor }}>
            + Add Task
          </button>
        </div>

        {/* Add task form */}
        {showAddTask && (
          <form onSubmit={addTask} className="space-y-3 p-4 rounded-2xl border" style={{ background: `${phaseColor}06`, borderColor: `${phaseColor}25` }}>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: phaseColor }}>New Task</div>
            <input value={newActionText} onChange={e => setNewActionText(e.target.value)}
              placeholder="Task description…" className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle} autoFocus />
            <div className="grid grid-cols-2 gap-2">
              <input value={newActionOwner} onChange={e => setNewActionOwner(e.target.value)}
                placeholder="Who…" className="text-sm rounded-xl border px-3 py-2" style={inputStyle} />
              <select value={newActionStatus} onChange={e => setNewActionStatus(e.target.value)}
                className="text-sm rounded-xl border px-3 py-2" style={inputStyle}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wide font-semibold mb-1 block" style={{ color: 'var(--text-3)' }}>Start Date</label>
                <input value={newActionStart} onChange={e => setNewActionStart(e.target.value)} type="date"
                  className="w-full text-sm rounded-xl border px-3 py-2" style={inputStyle} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide font-semibold mb-1 block" style={{ color: 'var(--text-3)' }}>Due Date</label>
                <input value={newActionDue} onChange={e => setNewActionDue(e.target.value)} type="date"
                  className="w-full text-sm rounded-xl border px-3 py-2" style={inputStyle} />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAddTask(false)}
                className="flex-1 py-2 rounded-xl text-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>Cancel</button>
              <button type="submit" disabled={!newActionText.trim()}
                className="flex-1 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                style={{ background: phaseColor }}>Add Task →</button>
            </div>
          </form>
        )}

        {/* Gantt or list */}
        {showGantt ? renderGantt() : (
          actions.length > 0 ? (
            <div className="space-y-2">
              {actions.map((a, i) => {
                const st = getStatus(a)
                const sc = STATUS_COLORS[st]
                const overdue = st !== 'Complete' && a.due && new Date(a.due) < today
                return (
                  <div key={i} className="rounded-2xl border p-4 space-y-2.5" style={{ background: 'var(--bg-input)', borderColor: `${sc}25` }}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: st === 'Complete' ? 'var(--text-3)' : 'var(--text-1)', textDecoration: st === 'Complete' ? 'line-through' : 'none' }}>{a.text}</p>
                      </div>
                      <select value={st} onChange={e => setStatus(i, e.target.value)}
                        className="text-[11px] font-bold px-2 py-1 rounded-full border-0 outline-none"
                        style={{ background: `${sc}20`, color: sc }}>
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button onClick={() => update({ actions: actions.filter((_, j) => j !== i) })}
                        className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>✕</button>
                    </div>
                    <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-3)' }}>
                      {a.owner && <span>👤 {a.owner}</span>}
                      {a.start_date && <span>Start: {a.start_date}</span>}
                      {a.due && (
                        <span style={{ color: overdue ? '#f87171' : 'var(--text-3)' }}>
                          {overdue ? '⚠ Due: ' : 'Due: '}{a.due}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-8 rounded-2xl text-center" style={{ background: 'var(--bg-input)' }}>
              <div className="text-2xl mb-2">📋</div>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-2)' }}>No tasks yet</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Add tasks to implement your committed solutions</p>
            </div>
          )
        )}

        {/* Solutions implemented date */}
        <div className="pt-3 border-t flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Solutions Implemented Date</div>
          <input value={charter.solutionsImplementedDate || ''} onChange={e => updateCharter('solutionsImplementedDate', e.target.value)}
            type="date" className="text-sm rounded-xl border px-3 py-1.5" style={inputStyle} />
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>Marks the before/after split on verification chart</span>
        </div>
      </div>
    )
  }

  function renderResults() {
    const metricName = project.metric_id === 'custom'
      ? (charter.customMetricName || 'Metric')
      : (METRIC_LABELS[project.metric_id] || project.metric_id?.toUpperCase() || 'Metric')

    const isSimple = project.project_type === 'quick_win' || project.project_type === 'yellow_belt' || !project.project_type

    // ── Simple before/after (Quick Win + Yellow Belt) ──
    if (isSimple) {
      const ba = charter.beforeAfter || {}
      const beforeVal = parseFloat(ba.beforeVal ?? project.baseline)
      const afterVal  = parseFloat(ba.afterVal)
      const hasNumbers = !isNaN(beforeVal) && !isNaN(afterVal)
      const improvement = hasNumbers
        ? (metaDir
            ? (afterVal - beforeVal) / beforeVal * 100
            : (beforeVal - afterVal) / beforeVal * 100)
        : null

      async function saveBA(field, value) {
        await updateCharter('beforeAfter', { ...ba, [field]: value })
      }

      return (
        <div className="space-y-5">
          {/* Belt context note */}
          <div className="px-4 py-3 rounded-xl text-xs leading-relaxed"
            style={{ background: `${phaseColor}0A`, borderLeft: `3px solid ${phaseColor}`, color: 'var(--text-2)' }}>
            <span className="font-bold" style={{ color: phaseColor }}>
              {project.project_type === 'quick_win' ? '⚡ Quick Win' : 'Y Yellow Belt'} Results
            </span>
            {' — '}
            {project.project_type === 'quick_win'
              ? 'Document what changed and how you know it worked. No formal data logging needed.'
              : 'Capture the before/after state. Your process maps are your primary evidence — numbers are supporting context.'}
          </div>

          {/* Baseline reference from Measure phase */}
          {(project.baseline != null || baselineAutoFill != null) && (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border text-xs"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--text-3)' }}>Baseline from Measure:</span>
              <span className="font-bold text-sm" style={{ color: 'var(--text-2)' }}>
                {project.baseline ?? baselineAutoFill}
                {baselineAutoFill != null && project.baseline == null && (
                  <span className="ml-1 text-[10px] font-normal" style={{ color: 'var(--text-3)' }}>(auto-fetched)</span>
                )}
              </span>
              {project.target_value != null && (
                <>
                  <span style={{ color: 'var(--border)' }}>→</span>
                  <span style={{ color: 'var(--text-3)' }}>Target:</span>
                  <span className="font-bold text-sm" style={{ color: phaseColor }}>{project.target_value}</span>
                </>
              )}
              {hasNumbers && improvement != null && (
                <>
                  <span style={{ color: 'var(--border)' }}>·</span>
                  <span className="font-bold" style={{ color: improvement >= 0 ? '#4ade80' : '#f87171' }}>
                    {improvement >= 0 ? '+' : ''}{improvement.toFixed(1)}% vs baseline
                  </span>
                </>
              )}
            </div>
          )}

          {/* Before/After numbers (optional) */}
          {project.metric_id && (
            <div className="flex items-end gap-6 flex-wrap">
              <div>
                <div className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Before ({metricName})</div>
                <input
                  type="number" step="any"
                  defaultValue={ba.beforeVal ?? project.baseline ?? ''}
                  onBlur={e => saveBA('beforeVal', e.target.value)}
                  placeholder={project.baseline ?? '—'}
                  className="text-3xl font-bold w-28 bg-transparent border-b-2 outline-none pb-1"
                  style={{ borderColor: 'var(--border2)', color: 'var(--text-2)' }} />
              </div>
              <div className="text-xl mb-3" style={{ color: 'var(--border)' }}>→</div>
              <div>
                <div className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>After ({metricName})</div>
                <input
                  type="number" step="any"
                  defaultValue={ba.afterVal ?? ''}
                  onBlur={e => saveBA('afterVal', e.target.value)}
                  placeholder="Enter result"
                  className="text-3xl font-bold w-28 bg-transparent border-b-2 outline-none pb-1"
                  style={{ borderColor: improvement > 0 ? '#4ade80' : 'var(--border2)', color: improvement != null ? (improvement >= 0 ? '#4ade80' : '#f87171') : 'var(--text-1)' }} />
              </div>
              {improvement != null && (
                <div className="ml-auto text-right pb-1">
                  <div className="text-3xl font-bold" style={{ color: improvement >= 0 ? '#4ade80' : '#f87171' }}>
                    {improvement >= 0 ? '+' : ''}{improvement.toFixed(1)}%
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-3)' }}>improvement</div>
                </div>
              )}
            </div>
          )}

          {/* Before description */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-3)' }}>
              Before State — what was happening?
            </label>
            <textarea
              defaultValue={ba.beforeDesc || ''}
              onBlur={e => saveBA('beforeDesc', e.target.value)}
              rows={3} placeholder="Describe the problem as it was before the improvement…"
              className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none"
              style={inputStyle} />
          </div>

          {/* After description */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-3)' }}>
              After State — what changed?
            </label>
            <textarea
              defaultValue={ba.afterDesc || ''}
              onBlur={e => saveBA('afterDesc', e.target.value)}
              rows={3} placeholder="Describe what is different now. What did you implement and what is the visible result?…"
              className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none"
              style={inputStyle} />
          </div>

          {/* Evidence */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-3)' }}>
              Evidence — how do you know it worked?
            </label>
            <textarea
              defaultValue={ba.evidence || ''}
              onBlur={e => saveBA('evidence', e.target.value)}
              rows={2} placeholder="e.g. Observation count dropped, team feedback confirmed, supervisor verified, process map shows eliminated step…"
              className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none"
              style={inputStyle} />
          </div>
        </div>
      )
    }

    // ── Full data-driven results (Green Belt + Black Belt) ──
    const implDate = charter.solutionsImplementedDate
    const beforeData = implDate ? kpiData.filter(d => d.date < implDate) : kpiData
    const afterData  = implDate ? kpiData.filter(d => d.date >= implDate) : []
    const beforeMean = beforeData.length ? beforeData.reduce((s, d) => s + d.value, 0) / beforeData.length : null
    const afterMean  = afterData.length  ? afterData.reduce((s, d) => s + d.value, 0)  / afterData.length  : null

    return (
      <div className="space-y-5">
        {/* Belt context note */}
        <div className="px-4 py-3 rounded-xl text-xs leading-relaxed"
          style={{ background: `${phaseColor}0A`, borderLeft: `3px solid ${phaseColor}`, color: 'var(--text-2)' }}>
          <span className="font-bold" style={{ color: phaseColor }}>
            {project.project_type === 'green_belt' ? 'G Green Belt' : 'B Black Belt'} Results
          </span>
          {' — '}
          Log actual {metricName} data points over time. The chart will verify your improvement held and calculate statistical significance.
        </div>

        <div className="flex items-end gap-6 flex-wrap">
          <div>
            <div className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>
              Baseline{project.baseline == null && baselineAutoFill != null ? <span className="ml-1 font-normal opacity-60">(auto)</span> : ''}
            </div>
            <div className="text-4xl font-bold" style={{ color: 'var(--text-2)' }}>{project.baseline ?? baselineAutoFill ?? '—'}</div>
          </div>
          <div className="text-xl mb-2" style={{ color: 'var(--border)' }}>→</div>
          <div>
            <div className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Now</div>
            <div className="text-4xl font-bold" style={{ color: latestKpi != null ? (pctChange >= 0 ? '#4ade80' : '#f87171') : 'var(--text-3)' }}>
              {latestKpi ?? '—'}
            </div>
          </div>
          <div className="text-xl mb-2" style={{ color: 'var(--border)' }}>→</div>
          <div>
            <div className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Target</div>
            <div className="text-4xl font-bold" style={{ color: phaseColor }}>{project.target_value ?? '—'}</div>
          </div>
          {pctChange != null && (
            <div className="ml-auto text-right pb-1">
              <div className="text-3xl font-bold" style={{ color: pctChange >= 0 ? '#4ade80' : '#f87171' }}>
                {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}%
              </div>
              <div className="text-xs" style={{ color: 'var(--text-3)' }}>improvement</div>
            </div>
          )}
        </div>

        {kpiData.length > 1 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                Optimization Verification Chart
              </div>
              {implDate && <span className="text-xs" style={{ color: 'var(--text-3)' }}>Solutions implemented: {implDate}</span>}
            </div>
            <ControlChart metricId={project.metric_id} data={kpiData} height={180} />
            {implDate && beforeMean != null && afterMean != null && (
              <div className="flex gap-6 mt-2">
                <div className="text-xs" style={{ color: 'var(--text-3)' }}>
                  Before mean: <span className="font-bold" style={{ color: 'var(--text-2)' }}>{beforeMean.toFixed(1)}</span>
                </div>
                <div className="text-xs" style={{ color: 'var(--text-3)' }}>
                  After mean: <span className="font-bold" style={{ color: '#4ade80' }}>{afterMean.toFixed(1)}</span>
                </div>
                {beforeMean > 0 && (
                  <div className="text-xs font-bold" style={{ color: '#4ade80' }}>
                    {metaDir
                      ? `${((afterMean - beforeMean) / beforeMean * 100).toFixed(1)}% improvement`
                      : `${((beforeMean - afterMean) / beforeMean * 100).toFixed(1)}% improvement`}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <form onSubmit={logKpi} className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <input value={kpiLogVal} onChange={e => setKpiLogVal(e.target.value)} type="number" step="any"
            placeholder={`Log ${metricName} value…`}
            className="flex-1 text-sm rounded-xl border px-3 py-2" style={inputStyle} />
          <input value={kpiLogDate} onChange={e => setKpiLogDate(e.target.value)} type="date"
            className="text-sm rounded-xl border px-3 py-2" style={inputStyle} />
          <button type="submit" disabled={!kpiLogVal || loggingKpi}
            className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
            style={{ background: phaseColor }}>
            {loggingKpi ? '…' : 'Log'}
          </button>
        </form>
      </div>
    )
  }

  function renderSummary() {
    const committedSolutions = (charter.solutions || []).filter(s => s.selected).map(s => s.text).join(', ')
    const resultText = pctChange != null ? `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}% improvement (${project.baseline} → ${latestKpi})` : 'Pending'

    return (
      <div className="space-y-5">
        <button
          onClick={() => generateField('summary', `Generate a professional executive summary for this CI project at an Amazon FC.
Project: "${project.title}"
Problem: ${charter.problemStatement || 'Not documented'}
Goal: ${charter.goalStatement || `${project.metric_id?.toUpperCase() || 'KPI'} from ${project.baseline} to ${project.target_value}`}
Root Cause: ${charter.rootCauseSummary || 'Not documented'}
Solutions Implemented: ${committedSolutions || 'Not documented'}
Result: ${resultText}
Team: ${charter.teamMembers || 'Not specified'}

Write a professional executive summary with these sections: Background, Problem Statement, Goal, Root Cause, Solutions Implemented, Results. Keep it concise and suitable for a senior manager. Output only the summary text.`)}
          disabled={generating === 'summary'}
          className="w-full py-3.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
          style={{ background: `${phaseColor}15`, color: phaseColor, border: `1px solid ${phaseColor}30` }}>
          {generating === 'summary' ? '⏳ Generating Executive Summary…' : '⚡ Generate Executive Summary'}
        </button>

        {charter.summary ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Executive Summary</div>
              <button onClick={() => setShowPresent(true)}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                style={{ background: phaseColor }}>◈ Present A3</button>
            </div>
            <textarea value={charter.summary} onChange={e => updateCharter('summary', e.target.value)}
              rows={14} className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none leading-relaxed"
              style={inputStyle} />
          </div>
        ) : (
          <div className="p-5 rounded-xl" style={{ background: 'var(--bg-input)' }}>
            <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-3)' }}>Project Overview</div>
            <div className="space-y-2.5">
              {[
                ['Problem',   charter.problemStatement, 'var(--text-2)'],
                ['Goal',      charter.goalStatement, 'var(--text-2)'],
                ['Root Cause',charter.rootCauseSummary, 'var(--text-2)'],
                ['Solutions', (charter.solutions || []).filter(s => s.selected).length > 0 ? `${(charter.solutions || []).filter(s => s.selected).length} committed` : null, phaseColor],
                ['Result',    pctChange != null ? resultText : null, pctChange != null && pctChange >= 0 ? '#4ade80' : 'var(--text-3)'],
              ].filter(([, val]) => val).map(([label, val, color]) => (
                <div key={label} className="flex gap-3">
                  <span className="text-xs w-24 flex-shrink-0 font-semibold" style={{ color: 'var(--text-3)' }}>{label}</span>
                  <span className="text-xs flex-1" style={{ color }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderHandoff() {
    const h = charter.handoff || {}
    function setH(field, val) {
      updateCharter('handoff', { ...h, [field]: val })
    }

    const textFields = [
      { key: 'results',         label: 'Results Achieved',                    placeholder: 'What was the quantified improvement? e.g. UPH increased from 84 to 97 (+15.5%), 3 UPH recovered across 8 stations.' },
      { key: 'dosDonts',        label: "Dos and Don'ts for Future Efforts",    placeholder: "DO: involve operators early, measure daily during first 4 weeks...\nDON'T: skip the gemba walk phase, rely on anecdotal data..." },
      { key: 'customerImpact',  label: 'Positive Impacts on External Customers', placeholder: 'How did this improvement benefit the end customer? e.g. faster order fulfilment, fewer mis-picks reaching customers...' },
      { key: 'hardSavings',     label: 'Hard Savings',                         placeholder: 'Quantifiable cost savings. e.g. £12,400/yr labour savings from 3 UPH gain across 8 stations on 2 shifts.' },
      { key: 'softSavings',     label: 'Soft Savings',                         placeholder: 'Non-quantifiable benefits. e.g. improved associate morale, reduced supervisor escalations, better ergonomics.' },
      { key: 'lessonsLearned',  label: 'Lessons Learned',                      placeholder: 'What would you do differently? What worked well? What surprised you during the project?' },
      { key: 'nextTarget',      label: 'Next Target or Improvement Idea',      placeholder: 'What is the logical next CI project? Where did you see the next biggest opportunity during this project?' },
    ]

    const yesNoFields = [
      { key: 'ownerMonitoring', label: 'Has the Process Owner agreed to continued monitoring of the new process?' },
      { key: 'ownerDocs',       label: 'Has the Process Owner received new process documentation?' },
      { key: 'teamTrained',     label: 'Has the team been trained on the new process?' },
      { key: 'sopUpdated',      label: 'Has the SOP been updated and published?' },
    ]

    const allSignedOff = yesNoFields.every(f => h[f.key] === 'yes')
    const completedFields = textFields.filter(f => h[f.key]?.trim()).length

    return (
      <div className="space-y-6">
        {/* Progress bar */}
        <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: `${phaseColor}06`, borderColor: `${phaseColor}20` }}>
          <div className="flex-1">
            <div className="text-xs font-bold mb-1" style={{ color: phaseColor }}>Handoff Completion</div>
            <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-input)' }}>
              <div className="h-1.5 rounded-full transition-all"
                style={{ width: `${Math.round(((completedFields / textFields.length) + (allSignedOff ? 1 : 0)) / 2 * 100)}%`, background: phaseColor }} />
            </div>
          </div>
          <span className="text-xs font-bold" style={{ color: phaseColor }}>{completedFields}/{textFields.length} sections · {allSignedOff ? '✓ Signed off' : 'Awaiting sign-off'}</span>
        </div>

        {/* Text sections */}
        {textFields.map((f, i) => (
          <div key={f.key}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                style={{ background: h[f.key]?.trim() ? 'rgba(74,222,128,0.15)' : `${phaseColor}20`, color: h[f.key]?.trim() ? '#4ade80' : phaseColor }}>
                {h[f.key]?.trim() ? '✓' : i + 1}
              </span>
              <label className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{f.label}</label>
            </div>
            <textarea
              value={h[f.key] || ''}
              onChange={e => setH(f.key, e.target.value)}
              placeholder={f.placeholder}
              rows={f.key === 'dosDonts' || f.key === 'lessonsLearned' ? 4 : 3}
              className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none leading-relaxed"
              style={{ ...inputStyle, borderColor: h[f.key]?.trim() ? 'rgba(74,222,128,0.3)' : 'var(--border2)' }} />
          </div>
        ))}

        {/* Process Owner Sign-off */}
        <div className="pt-4 border-t space-y-4" style={{ borderColor: 'var(--border)' }}>
          <div className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Process Owner Sign-off Checklist</div>
          {yesNoFields.map(f => (
            <div key={f.key} className="flex items-center justify-between gap-4 p-3 rounded-xl"
              style={{ background: h[f.key] === 'yes' ? 'rgba(74,222,128,0.07)' : 'var(--bg-input)', border: `1px solid ${h[f.key] === 'yes' ? 'rgba(74,222,128,0.25)' : 'var(--border)'}` }}>
              <span className="text-sm flex-1" style={{ color: 'var(--text-1)' }}>{f.label}</span>
              <div className="flex gap-2 flex-shrink-0">
                {['yes', 'no'].map(v => (
                  <button key={v} onClick={() => setH(f.key, h[f.key] === v ? null : v)}
                    className="px-4 py-1.5 rounded-full text-xs font-bold transition-all uppercase"
                    style={h[f.key] === v
                      ? { background: v === 'yes' ? '#16A34A' : '#DC2626', color: 'white' }
                      : { background: 'var(--bg-input)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {allSignedOff && (
            <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)' }}>
              <span style={{ color: '#4ade80' }}>✓</span>
              <span className="text-sm font-semibold" style={{ color: '#4ade80' }}>All sign-offs complete — project is ready to close</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderMonitor() {
    const plan = charter.monitoringPlan || []
    const blank = { metric: '', frequency: '', trigger: '', responder: '', action: '' }
    const draft = monitorDraft

    function addRow() {
      if (!draft.metric.trim()) return
      updateCharter('monitoringPlan', [...plan, { ...draft, id: Date.now() }])
      setMonitorDraft({ ...blank })
    }
    function removeRow(id) {
      updateCharter('monitoringPlan', plan.filter(r => r.id !== id))
    }

    return (
      <div className="space-y-5">
        <div className="text-xs p-3 rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
          A monitoring plan ensures the gains are sustained. Define what will be tracked, by whom, and what happens when performance dips.
        </div>

        {plan.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ borderCollapse: 'separate', borderSpacing: '0 4px' }}>
              <thead>
                <tr className="text-left">
                  {['Metric', 'Frequency', 'Trigger', 'Responder', 'Response Action', ''].map(h => (
                    <th key={h} className="pb-2 px-2 font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.map((r, i) => (
                  <tr key={r.id || i} style={{ background: 'var(--bg-input)' }}>
                    {['metric', 'frequency', 'trigger', 'responder', 'action'].map(f => (
                      <td key={f} className="px-2 py-2 rounded-none first:rounded-l-xl last:rounded-r-xl" style={{ color: 'var(--text-1)' }}>
                        <input value={r[f] || ''} onChange={e => {
                          const updated = plan.map((x, j) => j === i ? { ...x, [f]: e.target.value } : x)
                          updateCharter('monitoringPlan', updated)
                        }} className="w-full bg-transparent text-xs outline-none" />
                      </td>
                    ))}
                    <td className="px-2 py-2">
                      <button onClick={() => removeRow(r.id)} className="text-xs" style={{ color: 'var(--text-3)' }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="space-y-2 p-4 rounded-xl border" style={{ background: `${phaseColor}06`, borderColor: `${phaseColor}20` }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: phaseColor }}>Add Monitoring Row</div>
          <div className="grid grid-cols-2 gap-2">
            {[['metric', 'What to monitor'], ['frequency', 'Frequency (e.g. Daily)'], ['trigger', 'Trigger threshold'], ['responder', 'Who responds']].map(([f, ph]) => (
              <input key={f} value={draft[f]} onChange={e => setMonitorDraft(d => ({ ...d, [f]: e.target.value }))}
                placeholder={ph} className="text-sm rounded-xl border px-3 py-2" style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
            ))}
          </div>
          <input value={draft.action} onChange={e => setMonitorDraft(d => ({ ...d, action: e.target.value }))}
            placeholder="Response action if triggered…"
            className="w-full text-sm rounded-xl border px-3 py-2" style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
          <button onClick={addRow} disabled={!draft.metric.trim()}
            className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
            style={{ background: phaseColor }}>+ Add Row</button>
        </div>
      </div>
    )
  }

  function renderTransfer() {
    const opps = charter.transferOpps || []
    const newArea = transferArea
    const newBenefit = transferBenefit
    const newNotes = transferNotes

    function addOpp(e) {
      e.preventDefault()
      if (!newArea.trim()) return
      updateCharter('transferOpps', [...opps, { area: newArea, benefit: newBenefit, notes: newNotes, id: Date.now(), applied: false }])
      setTransferArea(''); setTransferBenefit(''); setTransferNotes('')
    }
    function toggleApplied(id) {
      updateCharter('transferOpps', opps.map(o => o.id === id ? { ...o, applied: !o.applied } : o))
    }

    return (
      <div className="space-y-5">
        <div className="text-xs p-3 rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
          Where else can this solution be applied? Identify areas, shifts, or departments that have the same root cause.
        </div>

        {opps.length > 0 && (
          <div className="space-y-2">
            {opps.map((o, i) => (
              <div key={o.id || i} className="flex items-start gap-3 p-4 rounded-xl border transition-all"
                style={{ background: o.applied ? 'rgba(74,222,128,0.07)' : 'var(--bg-input)', borderColor: o.applied ? 'rgba(74,222,128,0.25)' : 'var(--border)' }}>
                <button onClick={() => toggleApplied(o.id)}
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                  style={{ background: o.applied ? '#16A34A' : 'transparent', borderColor: o.applied ? '#16A34A' : 'rgba(255,255,255,0.18)' }}>
                  {o.applied && <span className="text-white text-[10px] font-bold">✓</span>}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{o.area}</div>
                  {o.benefit && <div className="text-xs mt-0.5" style={{ color: phaseColor }}>↑ {o.benefit}</div>}
                  {o.notes && <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{o.notes}</div>}
                </div>
                <button onClick={() => updateCharter('transferOpps', opps.filter((_, j) => j !== i))}
                  className="text-xs" style={{ color: 'var(--text-3)' }}>✕</button>
              </div>
            ))}
            <div className="text-xs" style={{ color: 'var(--text-3)' }}>
              {opps.filter(o => o.applied).length}/{opps.length} opportunities applied
            </div>
          </div>
        )}

        <form onSubmit={addOpp} className="space-y-2 p-4 rounded-xl border" style={{ background: `${phaseColor}06`, borderColor: `${phaseColor}20` }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: phaseColor }}>Add Transfer Opportunity</div>
          <input value={transferArea} onChange={e => setTransferArea(e.target.value)}
            placeholder="Area / zone / shift (e.g. Pick Zone B, Night Shift)"
            className="w-full text-sm rounded-xl border px-3 py-2" style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
          <div className="grid grid-cols-2 gap-2">
            <input value={transferBenefit} onChange={e => setTransferBenefit(e.target.value)}
              placeholder="Expected benefit (e.g. +3 UPH)"
              className="text-sm rounded-xl border px-3 py-2" style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
            <input value={transferNotes} onChange={e => setTransferNotes(e.target.value)}
              placeholder="Notes"
              className="text-sm rounded-xl border px-3 py-2" style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
          </div>
          <button type="submit" disabled={!newArea.trim()}
            className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
            style={{ background: phaseColor }}>+ Add</button>
        </form>
      </div>
    )
  }

  function renderBeforePhoto() {
    function handlePhoto(e) {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = ev => updateCharter('beforePhoto', ev.target.result)
      reader.readAsDataURL(file)
    }
    return (
      <div className="space-y-5">
        <div className="text-xs p-3 rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
          Capture the current state before any changes are made. This becomes your evidence baseline.
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Photo</div>
          {charter.beforePhoto ? (
            <div className="relative group">
              <img src={charter.beforePhoto} style={{ maxWidth: '100%', borderRadius: 8, marginBottom: 8 }} alt="Before" />
              <button onClick={() => updateCharter('beforePhoto', null)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-full flex items-center justify-center text-xs"
                style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}>✕</button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer hover:opacity-70 transition-opacity"
              style={{ borderColor: `${phaseColor}35`, background: `${phaseColor}04` }}>
              <span className="text-2xl">📷</span>
              <span className="text-sm font-semibold" style={{ color: phaseColor }}>Upload Before Photo</span>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>Current state before any improvement</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
          )}
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Observations / what you see here</label>
          <textarea value={charter.beforePhotoNote || ''} onChange={e => updateCharter('beforePhotoNote', e.target.value)}
            rows={3} placeholder="Describe what you see in this photo — waste, layout issues, process problems..."
            className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none" style={inputStyle} />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Date taken</label>
          <input type="date" value={charter.beforePhotoDate || ''} onChange={e => updateCharter('beforePhotoDate', e.target.value)}
            className="text-sm rounded-xl border px-3 py-2" style={inputStyle} />
        </div>
      </div>
    )
  }

  function renderAfterPhoto() {
    function handlePhoto(e) {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = ev => updateCharter('afterPhoto', ev.target.result)
      reader.readAsDataURL(file)
    }
    return (
      <div className="space-y-5">
        <div className="text-xs p-3 rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
          Capture the improved state. Compare directly with your Before Photo to show the impact.
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Photo</div>
          {charter.afterPhoto ? (
            <div className="relative group">
              <img src={charter.afterPhoto} style={{ maxWidth: '100%', borderRadius: 8, marginBottom: 8 }} alt="After" />
              <button onClick={() => updateCharter('afterPhoto', null)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-full flex items-center justify-center text-xs"
                style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}>✕</button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer hover:opacity-70 transition-opacity"
              style={{ borderColor: 'rgba(22,163,74,0.4)', background: 'rgba(22,163,74,0.04)' }}>
              <span className="text-2xl">📷</span>
              <span className="text-sm font-semibold" style={{ color: '#16A34A' }}>Upload After Photo</span>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>Improved state after implementation</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
          )}
        </div>
        {charter.beforePhoto && charter.afterPhoto && (
          <div>
            <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-3)' }}>Before / After Comparison</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold mb-1.5" style={{ color: '#f87171' }}>Before</div>
                <img src={charter.beforePhoto} alt="Before" className="w-full rounded-xl object-cover" style={{ maxHeight: 200 }} />
              </div>
              <div>
                <div className="text-xs font-semibold mb-1.5" style={{ color: '#4ade80' }}>After</div>
                <img src={charter.afterPhoto} alt="After" className="w-full rounded-xl object-cover" style={{ maxHeight: 200 }} />
              </div>
            </div>
          </div>
        )}
        <div>
          <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Observations / what you see here</label>
          <textarea value={charter.afterPhotoNote || ''} onChange={e => updateCharter('afterPhotoNote', e.target.value)}
            rows={3} placeholder="Describe the improvement visible in this photo..."
            className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none" style={inputStyle} />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Date taken</label>
          <input type="date" value={charter.afterPhotoDate || ''} onChange={e => updateCharter('afterPhotoDate', e.target.value)}
            className="text-sm rounded-xl border px-3 py-2" style={inputStyle} />
        </div>
      </div>
    )
  }

  function renderFishbone() {
    const FISHBONE_COLORS = {
      Man: '#3B7FDE', Machine: '#e11d48', Method: '#10b981',
      Material: '#f59e0b', Measurement: '#7C3AED', Environment: '#06b6d4'
    }
    const categories = ['Man', 'Machine', 'Method', 'Material', 'Measurement', 'Environment']
    const fishbone = charter.fishbone || { Man: [], Machine: [], Method: [], Material: [], Measurement: [], Environment: [] }
    const totalCauses = categories.reduce((sum, cat) => sum + (fishbone[cat] || []).length, 0)

    function addCause(cat) {
      const val = fishboneInputs[cat]?.trim()
      if (!val) return
      const updated = { ...fishbone, [cat]: [...(fishbone[cat] || []), val] }
      updateCharter('fishbone', updated)
      setFishboneInputs(prev => ({ ...prev, [cat]: '' }))
    }

    function removeCause(cat, idx) {
      const updated = { ...fishbone, [cat]: (fishbone[cat] || []).filter((_, i) => i !== idx) }
      updateCharter('fishbone', updated)
    }

    return (
      <div className="space-y-5">
        <div className="text-xs p-3 rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
          Map potential causes across the 6 categories. Add as many causes as you find.
        </div>
        <div className="text-xs font-semibold px-3 py-2 rounded-xl border" style={{ background: `${phaseColor}08`, borderColor: `${phaseColor}20`, color: phaseColor }}>
          {totalCauses} cause{totalCauses !== 1 ? 's' : ''} identified across 6 categories
        </div>
        <div className="grid grid-cols-2 gap-4">
          {categories.map(cat => {
            const color = FISHBONE_COLORS[cat]
            const causes = fishbone[cat] || []
            return (
              <div key={cat} className="rounded-xl border overflow-hidden" style={{ borderColor: `${color}30` }}>
                <div className="px-3 py-2 text-xs font-bold uppercase tracking-wide" style={{ background: `${color}20`, color }}>
                  {cat}
                </div>
                <div className="p-3 space-y-2" style={{ background: 'var(--bg-input)' }}>
                  {causes.map((cause, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs group">
                      <span className="flex-1" style={{ color: 'var(--text-1)' }}>• {cause}</span>
                      <button onClick={() => removeCause(cat, i)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-3)' }}>✕</button>
                    </div>
                  ))}
                  <div className="flex gap-1 pt-1">
                    <input
                      value={fishboneInputs[cat] || ''}
                      onChange={e => setFishboneInputs(prev => ({ ...prev, [cat]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCause(cat))}
                      placeholder="Add cause…"
                      className="flex-1 text-xs rounded-lg border px-2 py-1.5 min-w-0"
                      style={{ ...inputStyle, borderColor: `${color}25` }} />
                    <button onClick={() => addCause(cat)}
                      className="px-2 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
                      style={{ background: `${color}20`, color }}>Add</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function renderDataCollectionPlan() {
    const plan = charter.dataCollectionPlan || []
    const projectMetricData = charter.projectMetricData || {}
    const columns = ['what', 'how', 'frequency', 'owner', 'target']
    const headers = ['What to Measure', 'How (method)', 'Frequency', 'Owner', 'Target / Goal']

    function addRow() {
      updateCharter('dataCollectionPlan', [...plan, { id: Date.now(), what: '', how: '', frequency: '', owner: '', target: '' }])
    }
    function removeRow(id) {
      updateCharter('dataCollectionPlan', plan.filter(r => r.id !== id))
      // keep metric data but row is gone; data stays in projectMetricData
    }
    function updateCell(id, field, val) {
      updateCharter('dataCollectionPlan', plan.map(r => r.id === id ? { ...r, [field]: val } : r))
    }

    function toggleTrack(row) {
      const existing = projectMetricData[row.id]
      if (existing) {
        // toggle OFF: keep data, user sees it again when they toggle back
        // We set a flag to hide the section without deleting data
        const updated = { ...projectMetricData, [row.id]: { ...existing, _hidden: !existing._hidden } }
        updateCharter('projectMetricData', updated)
      } else {
        // toggle ON: create new entry
        const targetNum = parseFloat(row.target)
        const newEntry = {
          label: row.what || 'Unnamed metric',
          unit: '',
          target: isNaN(targetNum) ? null : targetNum,
          higherIsBetter: false,
          entries: [],
          _hidden: false,
        }
        updateCharter('projectMetricData', { ...projectMetricData, [row.id]: newEntry })
      }
    }

    function updateMetricField(rowId, field, val) {
      const current = projectMetricData[rowId] || {}
      updateCharter('projectMetricData', { ...projectMetricData, [rowId]: { ...current, [field]: val } })
    }

    return (
      <div className="space-y-5">
        <div className="text-xs p-3 rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
          Define exactly what you will measure, how, and who is responsible.
        </div>
        {plan.length > 0 && (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                <thead>
                  <tr className="text-left">
                    {headers.map(h => (
                      <th key={h} className="pb-2 px-2 font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{h}</th>
                    ))}
                    {isAdvancedType && (
                      <th className="pb-2 px-2 font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Track</th>
                    )}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {plan.map(row => {
                    const metricEntry = projectMetricData[row.id]
                    const isTracked = !!metricEntry && !metricEntry._hidden
                    return (
                      <tr key={row.id} style={{ background: isTracked ? `${phaseColor}0A` : 'var(--bg-input)', borderRadius: 12 }}>
                        {columns.map(f => (
                          <td key={f} className="px-2 py-2 first:rounded-l-xl">
                            <input value={row[f] || ''} onChange={e => updateCell(row.id, f, e.target.value)}
                              className="w-full bg-transparent text-xs outline-none min-w-[80px]" style={{ color: 'var(--text-1)' }} />
                          </td>
                        ))}
                        {isAdvancedType && (
                          <td className="px-2 py-2">
                            <button
                              onClick={() => toggleTrack(row)}
                              className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold transition-all"
                              style={isTracked
                                ? { background: `${phaseColor}20`, color: phaseColor, border: `1px solid ${phaseColor}40` }
                                : { background: 'var(--bg-card)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                              {isTracked ? '● Track' : '○ Track'}
                            </button>
                          </td>
                        )}
                        <td className="px-2 py-2 rounded-r-xl">
                          <button onClick={() => removeRow(row.id)} className="text-xs" style={{ color: 'var(--text-3)' }}>✕</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Track configuration panels — one per tracked row */}
            {isAdvancedType && plan.filter(row => {
              const m = projectMetricData[row.id]
              return !!m && !m._hidden
            }).map(row => {
              const m = projectMetricData[row.id]
              return (
                <div key={row.id} className="rounded-xl border p-3 space-y-2"
                  style={{ borderLeft: '3px solid var(--accent)', background: 'var(--bg-input)', borderColor: `${phaseColor}30`, borderLeftColor: phaseColor }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: phaseColor }}>Tracking: {m.label}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-3)' }}>Unit</label>
                      <input
                        value={m.unit || ''}
                        onChange={e => updateMetricField(row.id, 'unit', e.target.value)}
                        placeholder="e.g. metres, mins, %"
                        className="text-xs rounded-lg border px-2 py-1.5 w-36"
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-3)' }}>Direction</label>
                      <div className="flex gap-1">
                        {[true, false].map(val => (
                          <button key={String(val)} onClick={() => updateMetricField(row.id, 'higherIsBetter', val)}
                            className="px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                            style={m.higherIsBetter === val
                              ? { background: phaseColor, color: 'white' }
                              : { background: 'var(--bg-card)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                            {val ? '↑ Higher better' : '↓ Lower better'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <button onClick={addRow}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: `${phaseColor}15`, color: phaseColor, border: `1px solid ${phaseColor}25` }}>
          + Add Row
        </button>

        {/* Project Metrics Panel */}
        {isAdvancedType && renderProjectMetrics()}
      </div>
    )
  }

  function renderProjectMetrics() {
    const projectMetricData = charter.projectMetricData || {}
    const trackedEntries = Object.entries(projectMetricData).filter(([, m]) => !m._hidden)
    const today = new Date().toISOString().split('T')[0]

    if (trackedEntries.length === 0) return null

    return (
      <div className="space-y-4 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="text-xs font-bold uppercase tracking-wide" style={{ color: phaseColor }}>Project Metrics</div>

        {trackedEntries.map(([rowId, metric]) => {
          const entries = Array.isArray(metric.entries) ? metric.entries : []
          const inputs = pmInputs[rowId] || { date: today, value: '', note: '' }

          // Determine trend direction vs target
          const target = metric.target
          const hasTarget = target != null && !isNaN(target)
          let lineColor = 'var(--accent)'
          if (entries.length >= 2 && hasTarget) {
            const last = entries[entries.length - 1].value
            const prev = entries[entries.length - 2].value
            const movingTowardTarget = metric.higherIsBetter
              ? last >= prev  // higher is better: going up = good
              : last <= prev  // lower is better: going down = good
            lineColor = movingTowardTarget ? '#4ade80' : '#f87171'
          }

          const chartData = entries.map(e => ({ date: e.date, value: e.value }))

          // Determine Y axis domain
          const allValues = entries.map(e => e.value)
          if (hasTarget) allValues.push(target)
          const minVal = allValues.length ? Math.min(...allValues) : 0
          const maxVal = allValues.length ? Math.max(...allValues) : 10
          const pad = (maxVal - minVal) * 0.15 || 1
          const yDomain = [Math.floor(minVal - pad), Math.ceil(maxVal + pad)]

          function logEntry(e) {
            e.preventDefault()
            if (!inputs.value) return
            const newEntry = {
              id: Date.now(),
              date: inputs.date || today,
              value: parseFloat(inputs.value),
              note: inputs.note || '',
            }
            const updatedEntries = [...entries, newEntry]
            const updatedMetric = { ...metric, entries: updatedEntries }
            updateCharter('projectMetricData', { ...(charter.projectMetricData || {}), [rowId]: updatedMetric })
            setPmInputs(prev => ({ ...prev, [rowId]: { date: today, value: '', note: '' } }))
          }

          function deleteEntry(entryId) {
            const updatedEntries = entries.filter(en => en.id !== entryId)
            const updatedMetric = { ...metric, entries: updatedEntries }
            updateCharter('projectMetricData', { ...(charter.projectMetricData || {}), [rowId]: updatedMetric })
          }

          const last5 = entries.slice(-5).reverse()

          return (
            <div key={rowId} className="rounded-xl border p-4 space-y-3"
              style={{ background: 'var(--bg-card)', borderLeft: '3px solid var(--accent)', borderLeftColor: phaseColor, borderColor: `${phaseColor}25` }}>

              {/* Header */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{metric.label}</span>
                {hasTarget && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${phaseColor}15`, color: phaseColor }}>
                    Target: {target}{metric.unit ? ` ${metric.unit}` : ''}
                  </span>
                )}
                <span className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
                  {metric.higherIsBetter ? '↑ Higher is better' : '↓ Lower is better'}
                </span>
              </div>

              {/* Log form */}
              <form onSubmit={logEntry} className="flex gap-2 flex-wrap items-end">
                <input
                  type="date"
                  value={inputs.date}
                  onChange={e => setPmInputs(prev => ({ ...prev, [rowId]: { ...inputs, date: e.target.value } }))}
                  className="text-xs rounded-lg border px-2 py-1.5"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
                <input
                  type="number" step="any"
                  value={inputs.value}
                  onChange={e => setPmInputs(prev => ({ ...prev, [rowId]: { ...inputs, value: e.target.value } }))}
                  placeholder={hasTarget ? `Target: ${target}${metric.unit ? ` ${metric.unit}` : ''}` : 'Value'}
                  className="text-xs rounded-lg border px-2 py-1.5 w-36"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
                <input
                  type="text"
                  value={inputs.note}
                  onChange={e => setPmInputs(prev => ({ ...prev, [rowId]: { ...inputs, note: e.target.value } }))}
                  placeholder="Optional note"
                  className="text-xs rounded-lg border px-2 py-1.5 flex-1 min-w-[120px]"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
                <button type="submit" disabled={!inputs.value}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40"
                  style={{ background: phaseColor }}>
                  Log
                </button>
              </form>

              {/* Chart */}
              {entries.length > 0 ? (
                <div>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} />
                      <YAxis domain={yDomain} tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} width={36} />
                      {hasTarget && (
                        <ReferenceLine y={target} stroke={phaseColor} strokeDasharray="4 3" strokeOpacity={0.6}
                          label={{ value: `Target: ${target}`, position: 'right', fontSize: 8, fill: phaseColor }} />
                      )}
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                        labelStyle={{ color: 'var(--text-3)' }}
                        formatter={(value, name, props) => {
                          const entry = entries.find(en => en.date === props.payload.date && en.value === value)
                          return [
                            <span>
                              {value}{metric.unit ? ` ${metric.unit}` : ''}
                              {entry?.note ? <span style={{ color: 'var(--text-3)' }}> — {entry.note}</span> : ''}
                            </span>,
                            metric.label,
                          ]
                        }} />
                      <Line
                        type="monotone" dataKey="value"
                        stroke={lineColor} strokeWidth={2}
                        dot={{ fill: lineColor, r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs py-2" style={{ color: 'var(--text-3)' }}>
                  No data logged yet. Add your first measurement above.
                </p>
              )}

              {/* Last 5 entries */}
              {last5.length > 0 && (
                <div className="space-y-1 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                  {last5.map(en => (
                    <div key={en.id} className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-2)' }}>
                      <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>{en.date}</span>
                      <span className="font-bold" style={{ color: phaseColor }}>{en.value}{metric.unit ? ` ${metric.unit}` : ''}</span>
                      {en.note && <span style={{ color: 'var(--text-3)' }}>{en.note}</span>}
                      <button onClick={() => deleteEntry(en.id)} className="ml-auto text-[10px] opacity-50 hover:opacity-100" style={{ color: 'var(--text-3)' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  function renderScreener() {
    const sc = charter.screener || { customerImpact: '', operationalImpact: '', strategicAlignment: '', urgency: '', dataAvailable: false, notes: '', score: 0 }
    function setSc(field, val) {
      const updated = { ...sc, [field]: val }
      const score = (parseInt(updated.customerImpact) || 0) + (parseInt(updated.operationalImpact) || 0) +
        (parseInt(updated.strategicAlignment) || 0) + (parseInt(updated.urgency) || 0)
      updated.score = score
      updateCharter('screener', updated)
    }

    const score = sc.score || 0
    const scoreBadge = score <= 8
      ? { bg: 'rgba(220,38,38,0.12)', color: '#f87171', label: 'Low Priority' }
      : score <= 14
        ? { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', label: 'Medium Priority' }
        : { bg: 'rgba(16,185,129,0.12)', color: '#34d399', label: 'High Priority' }

    const scoreFields = [
      { key: 'customerImpact',     label: 'Customer Impact',       hint: '1 = minimal, 5 = critical' },
      { key: 'operationalImpact',  label: 'Operational Impact',    hint: '1 = minimal, 5 = site-critical' },
      { key: 'strategicAlignment', label: 'Strategic Alignment',   hint: '1 = not aligned, 5 = fully aligned' },
      { key: 'urgency',            label: 'Urgency',               hint: '1 = can wait, 5 = immediate action' },
    ]

    return (
      <div className="space-y-5">
        <div className="text-xs p-3 rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
          Assess whether this opportunity is worth pursuing before committing resources.
        </div>

        <div className="space-y-4">
          {scoreFields.map(f => (
            <div key={f.key}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{f.label}</label>
                <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{f.hint}</span>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setSc(f.key, n)}
                    className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
                    style={{
                      background: parseInt(sc[f.key]) === n ? phaseColor : 'var(--bg-input)',
                      color: parseInt(sc[f.key]) === n ? 'white' : 'var(--text-3)',
                      border: `1px solid ${parseInt(sc[f.key]) === n ? phaseColor : 'var(--border)'}`,
                    }}>{n}</button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }}>
          <label className="text-sm flex-1" style={{ color: 'var(--text-1)' }}>Data available to measure this?</label>
          <button onClick={() => setSc('dataAvailable', !sc.dataAvailable)}
            className="px-4 py-1.5 rounded-full text-xs font-bold transition-all"
            style={sc.dataAvailable
              ? { background: '#16A34A', color: 'white' }
              : { background: 'var(--bg-input)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
            {sc.dataAvailable ? 'Yes ✓' : 'No'}
          </button>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-xl border" style={{ background: scoreBadge.bg, borderColor: `${scoreBadge.color}30` }}>
          <div>
            <div className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: scoreBadge.color }}>Score</div>
            <div className="text-3xl font-bold" style={{ color: scoreBadge.color }}>{score} / 20</div>
          </div>
          <div className="flex-1">
            <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ background: scoreBadge.bg, color: scoreBadge.color }}>
              {scoreBadge.label}
            </span>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Screener notes / rationale</label>
          <textarea value={sc.notes || ''} onChange={e => setSc('notes', e.target.value)}
            rows={3} placeholder="Explain the scoring and any key considerations..."
            className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none" style={inputStyle} />
        </div>
      </div>
    )
  }

  function renderVOC() {
    const voc = charter.voc || []

    function addEntry() {
      updateCharter('voc', [...voc, { id: Date.now(), stakeholder: '', need: '', quote: '', priority: 'Medium' }])
    }
    function removeEntry(id) {
      updateCharter('voc', voc.filter(v => v.id !== id))
    }
    function updateEntry(id, field, val) {
      updateCharter('voc', voc.map(v => v.id === id ? { ...v, [field]: val } : v))
    }

    const PRIORITY_COLORS = { High: '#e11d48', Medium: '#f59e0b', Low: '#6b7280' }

    return (
      <div className="space-y-5">
        <div className="text-xs p-3 rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
          Capture what stakeholders are saying. Who is affected and what do they need?
        </div>

        {voc.map(entry => {
          const pc = PRIORITY_COLORS[entry.priority] || '#6b7280'
          return (
            <div key={entry.id} className="p-4 rounded-xl border space-y-3" style={{ background: 'var(--bg-input)', borderColor: `${pc}25` }}>
              <div className="flex items-center gap-2">
                <div className="text-xs font-bold uppercase tracking-wide" style={{ color: pc }}>VOC Entry</div>
                <select value={entry.priority} onChange={e => updateEntry(entry.id, 'priority', e.target.value)}
                  className="text-xs font-semibold px-2 py-1 rounded-full border-0 outline-none ml-auto"
                  style={{ background: `${pc}15`, color: pc }}>
                  {['High', 'Medium', 'Low'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <button onClick={() => removeEntry(entry.id)} className="text-xs" style={{ color: 'var(--text-3)' }}>✕</button>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide font-semibold mb-1 block" style={{ color: 'var(--text-3)' }}>Stakeholder name / role</label>
                <input value={entry.stakeholder || ''} onChange={e => updateEntry(entry.id, 'stakeholder', e.target.value)}
                  placeholder="e.g. Pack Associate, Area Manager…"
                  className="w-full text-sm rounded-xl border px-3 py-2" style={inputStyle} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide font-semibold mb-1 block" style={{ color: 'var(--text-3)' }}>Need or complaint</label>
                <textarea value={entry.need || ''} onChange={e => updateEntry(entry.id, 'need', e.target.value)}
                  rows={2} placeholder="What are they saying? What do they need?"
                  className="w-full text-sm rounded-xl border px-3 py-2 resize-none" style={inputStyle} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide font-semibold mb-1 block" style={{ color: 'var(--text-3)' }}>Direct quote (optional)</label>
                <input value={entry.quote || ''} onChange={e => updateEntry(entry.id, 'quote', e.target.value)}
                  placeholder='"Exact words they used…"'
                  className="w-full text-sm rounded-xl border px-3 py-2 italic" style={inputStyle} />
              </div>
            </div>
          )
        })}

        <button onClick={addEntry}
          className="w-full py-3 rounded-xl text-sm font-semibold border-2 border-dashed"
          style={{ borderColor: `${phaseColor}30`, color: phaseColor, background: `${phaseColor}04` }}>
          + Add VOC Entry
        </button>
      </div>
    )
  }

  function renderConfirmStats() {
    const cs = charter.confirmStats || { hypothesis: '', testUsed: '', testResult: '', pValue: '', conclusion: '', nextSteps: '' }
    function setCs(field, val) {
      updateCharter('confirmStats', { ...cs, [field]: val })
    }

    const CONCLUSION_COLORS = {
      'Confirmed — root cause validated': '#4ade80',
      'Partially confirmed — further investigation needed': '#fbbf24',
      'Rejected — revisit root cause analysis': '#f87171',
    }

    return (
      <div className="space-y-5">
        <div className="text-xs p-3 rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
          Use data to confirm your root cause hypothesis before committing to solutions.
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Hypothesis — "We believe the root cause is…"</label>
          <textarea value={cs.hypothesis || ''} onChange={e => setCs('hypothesis', e.target.value)}
            rows={3} placeholder="We believe the root cause is…"
            className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none" style={inputStyle} />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Statistical test used</label>
          <select value={cs.testUsed || ''} onChange={e => setCs('testUsed', e.target.value)}
            className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle}>
            <option value="">Select test…</option>
            {['Correlation Analysis', 'Hypothesis Test (t-test)', 'Regression Analysis', 'Chi-Square', 'Control Chart Analysis', 'Other'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Test result — what the test showed</label>
          <textarea value={cs.testResult || ''} onChange={e => setCs('testResult', e.target.value)}
            rows={3} placeholder="Describe what the statistical test revealed..."
            className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none" style={inputStyle} />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>p-value or confidence level (optional)</label>
          <input value={cs.pValue || ''} onChange={e => setCs('pValue', e.target.value)}
            placeholder="e.g. p < 0.05, 95% confidence"
            className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle} />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Conclusion</label>
          <select value={cs.conclusion || ''} onChange={e => setCs('conclusion', e.target.value)}
            className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle}>
            <option value="">Select conclusion…</option>
            {Object.keys(CONCLUSION_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {cs.conclusion && (
            <div className="mt-2 px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ background: `${CONCLUSION_COLORS[cs.conclusion]}15`, color: CONCLUSION_COLORS[cs.conclusion] }}>
              {cs.conclusion}
            </div>
          )}
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Next steps</label>
          <textarea value={cs.nextSteps || ''} onChange={e => setCs('nextSteps', e.target.value)}
            rows={3} placeholder="What happens next based on this conclusion?"
            className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none" style={inputStyle} />
        </div>
      </div>
    )
  }

  function renderConfirm() {
    const cf = charter.confirm || { findingsSummary: '', confirmedRootCause: '', confidenceLevel: '', supportingEvidence: '' }
    function setCf(field, val) {
      updateCharter('confirm', { ...cf, [field]: val })
    }

    const CONFIDENCE_COLORS = { High: '#4ade80', Medium: '#fbbf24', Low: '#f87171' }

    return (
      <div className="space-y-5">
        <div className="text-xs p-3 rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
          Review your findings and confirm the root cause before making a recommendation.
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Summary of findings</label>
          <textarea value={cf.findingsSummary || ''} onChange={e => setCf('findingsSummary', e.target.value)}
            rows={4} placeholder="Summarise everything you found during the investigation…"
            className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none" style={inputStyle} />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Confirmed root cause</label>
          <textarea value={cf.confirmedRootCause || ''} onChange={e => setCf('confirmedRootCause', e.target.value)}
            rows={3} placeholder="The root cause of this issue is…"
            className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none" style={inputStyle} />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Confidence level</label>
          <div className="flex gap-2">
            {['High', 'Medium', 'Low'].map(level => {
              const lc = CONFIDENCE_COLORS[level]
              return (
                <button key={level} onClick={() => setCf('confidenceLevel', level)}
                  className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: cf.confidenceLevel === level ? lc : 'var(--bg-input)',
                    color: cf.confidenceLevel === level ? 'white' : 'var(--text-3)',
                    border: `1px solid ${cf.confidenceLevel === level ? lc : 'var(--border)'}`,
                  }}>{level}</button>
              )
            })}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Supporting evidence</label>
          <textarea value={cf.supportingEvidence || ''} onChange={e => setCf('supportingEvidence', e.target.value)}
            rows={3} placeholder="What data, observations or facts support this conclusion?"
            className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none" style={inputStyle} />
        </div>
      </div>
    )
  }

  function renderVerify() {
    const vf = charter.verify || { beforeVal: '', afterVal: '', improvement: null, targetMet: null, evidence: '', method: '', verifiedBy: '', verifiedDate: '' }
    function setVf(field, val) {
      const updated = { ...vf, [field]: val }
      const before = parseFloat(field === 'beforeVal' ? val : updated.beforeVal)
      const after  = parseFloat(field === 'afterVal'  ? val : updated.afterVal)
      const target = parseFloat(project.target_value)
      if (!isNaN(before) && !isNaN(after) && before !== 0) {
        const imp = ((after - before) / before) * 100
        updated.improvement = imp.toFixed(1)
        if (!isNaN(target)) {
          const metaDir = { uph: true, accuracy: true, dpmo: false, dts: true }[project.metric_id] ?? true
          updated.targetMet = metaDir ? after >= target : after <= target
        }
      }
      updateCharter('verify', updated)
    }

    const impNum = parseFloat(vf.improvement)
    const impColor = !isNaN(impNum) ? (impNum >= 0 ? '#4ade80' : '#f87171') : null

    return (
      <div className="space-y-5">
        <div className="text-xs p-3 rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
          Confirm the solution has delivered the expected improvement before moving to Control.
        </div>

        <div className="flex items-end gap-6 flex-wrap">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-3)' }}>Before value</label>
            <input type="number" step="any"
              value={vf.beforeVal !== undefined ? vf.beforeVal : (project.baseline ?? '')}
              onChange={e => setVf('beforeVal', e.target.value)}
              placeholder={project.baseline ?? 'Baseline'}
              className="text-3xl font-bold w-28 rounded-xl border px-3 py-2 outline-none"
              style={{ ...inputStyle, color: 'var(--text-2)' }} />
          </div>
          <div className="text-xl mb-3" style={{ color: 'var(--border)' }}>→</div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-3)' }}>After value</label>
            <input type="number" step="any"
              value={vf.afterVal || ''}
              onChange={e => setVf('afterVal', e.target.value)}
              placeholder="Result"
              className="text-3xl font-bold w-28 rounded-xl border px-3 py-2 outline-none"
              style={{ ...inputStyle, color: impColor || 'var(--text-1)' }} />
          </div>
          {vf.improvement !== null && !isNaN(impNum) && (
            <div className="ml-auto text-right pb-1">
              <div className="text-3xl font-bold" style={{ color: impColor }}>
                {impNum >= 0 ? '+' : ''}{vf.improvement}%
              </div>
              <div className="text-xs" style={{ color: 'var(--text-3)' }}>improvement</div>
            </div>
          )}
        </div>

        {project.target_value != null && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }}>
            <span style={{ color: 'var(--text-3)' }}>Target: <strong style={{ color: phaseColor }}>{project.target_value}</strong></span>
            {vf.targetMet !== null && (
              <span className="ml-auto font-bold" style={{ color: vf.targetMet ? '#4ade80' : '#f87171' }}>
                {vf.targetMet ? '✓ Target met' : '✗ Target not met — review solutions'}
              </span>
            )}
          </div>
        )}

        <div>
          <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Evidence — what confirms this improvement?</label>
          <textarea value={vf.evidence || ''} onChange={e => setVf('evidence', e.target.value)}
            rows={3} placeholder="Describe the evidence that confirms the improvement..."
            className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none" style={inputStyle} />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Verification method</label>
          <select value={vf.method || ''} onChange={e => setVf('method', e.target.value)}
            className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle}>
            <option value="">Select method…</option>
            {['Control chart', 'Direct observation', 'KPI comparison', 'Associate feedback', 'Management sign-off'].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Verified by</label>
            <input value={vf.verifiedBy || ''} onChange={e => setVf('verifiedBy', e.target.value)}
              placeholder="Name / role"
              className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Verification date</label>
            <input type="date" value={vf.verifiedDate || ''} onChange={e => setVf('verifiedDate', e.target.value)}
              className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle} />
          </div>
        </div>

        {/* Project metric verification (Green Belt / Black Belt only) */}
        {isAdvancedType && (() => {
          const projectMetricData = charter.projectMetricData || {}
          const trackedEntries = Object.entries(projectMetricData).filter(([, m]) => !m._hidden && Array.isArray(m.entries) && m.entries.length >= 2)
          const someEntries = Object.entries(projectMetricData).filter(([, m]) => !m._hidden && Array.isArray(m.entries) && m.entries.length === 1)
          return (
            <div className="pt-3 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Project metric verification</div>
              {trackedEntries.length === 0 && someEntries.length === 0 && (
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                  Define metrics in your Data Collection Plan to track project-specific measurements here.
                </p>
              )}
              {someEntries.length > 0 && (
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                  Log at least 2 measurements to see verification for: {someEntries.map(([, m]) => m.label).join(', ')}.
                </p>
              )}
              {trackedEntries.length > 0 && (
                <div className="space-y-2">
                  {trackedEntries.map(([rowId, metric]) => {
                    const entries = metric.entries
                    const firstVal = entries[0].value
                    const lastVal = entries[entries.length - 1].value
                    const pct = firstVal !== 0 ? ((lastVal - firstVal) / Math.abs(firstVal)) * 100 : null
                    const hasTarget = metric.target != null && !isNaN(metric.target)
                    const improving = metric.higherIsBetter ? lastVal >= firstVal : lastVal <= firstVal
                    const targetMet = hasTarget
                      ? (metric.higherIsBetter ? lastVal >= metric.target : lastVal <= metric.target)
                      : null
                    const arrow = metric.higherIsBetter ? (lastVal >= firstVal ? '↑' : '↓') : (lastVal <= firstVal ? '↓' : '↑')
                    const pctColor = improving ? '#4ade80' : '#f87171'
                    return (
                      <div key={rowId} className="flex items-center gap-3 px-4 py-3 rounded-xl border"
                        style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }}>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-1)' }}>{metric.label}</div>
                          <div className="flex items-center gap-2 mt-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
                            <span>{firstVal}{metric.unit ? ` ${metric.unit}` : ''}</span>
                            <span>→</span>
                            <span className="font-bold" style={{ color: 'var(--text-2)' }}>{lastVal}{metric.unit ? ` ${metric.unit}` : ''}</span>
                          </div>
                        </div>
                        {pct !== null && (
                          <div className="flex items-center gap-1 font-bold text-xs flex-shrink-0" style={{ color: pctColor }}>
                            <span>{arrow}</span>
                            <span>{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%</span>
                          </div>
                        )}
                        {targetMet !== null && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: targetMet ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)', color: targetMet ? '#4ade80' : '#f87171' }}>
                            {targetMet ? '✓ Target met' : '✗ Not met'}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}
      </div>
    )
  }

  function renderRecommendation() {
    const rec = charter.recommendation || { decision: '', escalateTitle: '', closeReason: '', closeNotes: '' }
    function setRec(field, val) {
      updateCharter('recommendation', { ...rec, [field]: val })
    }

    async function escalateToProject(type) {
      setEscalating(true)
      try {
        const newCharter = {
          ...project.charter,
          escalatedFrom: project.id,
          escalatedFromTitle: project.title,
        }
        const newProject = {
          title: rec.escalateTitle || project.title + ' — Improvement',
          project_type: type,
          portfolio_id: project.portfolio_id,
          metric_id: project.metric_id,
          baseline: project.baseline,
          target_value: project.target_value,
          problem_statement: project.problem_statement,
          stage: 'Define',
          charter: JSON.stringify(newCharter),
          stage_checklist: JSON.stringify({ currentTool: 'charter', charter: true }),
        }
        const created = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newProject)
        }).then(r => r.json())

        if (created?.id) {
          await fetch(`/api/projects/${project.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stage: 'Closed', notes: `Escalated to ${type} project: ${created.title}` })
          })
          setEscalateSuccess(type)
          setTimeout(() => {
            onNavigate?.('projects', created)
          }, 1500)
        }
      } finally {
        setEscalating(false)
      }
    }

    async function closeInvestigation() {
      await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'Closed' })
      })
      await update({ stage: 'Closed' })
    }

    const typeLabels = { yellow_belt: 'Yellow Belt', green_belt: 'Green Belt', black_belt: 'Black Belt' }
    return (
      <div className="space-y-6">
        <div className="text-xs p-3 rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
          Based on your investigation, what should happen next?
        </div>

        {/* Section 1 — Findings Summary */}
        <div className="space-y-4">
          <div className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Findings Summary</div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Key findings from this investigation</label>
            <textarea
              value={charter.confirm?.findingsSummary || ''}
              readOnly
              rows={3}
              placeholder="Complete the Confirm Root Cause tool first…"
              className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none opacity-70"
              style={inputStyle} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Confirmed root cause</label>
            <textarea
              value={charter.confirm?.confirmedRootCause || ''}
              readOnly
              rows={2}
              placeholder="Complete the Confirm Root Cause tool first…"
              className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none opacity-70"
              style={inputStyle} />
          </div>
          {charter.confirm?.confidenceLevel && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>Confidence level:</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: charter.confirm.confidenceLevel === 'High' ? 'rgba(74,222,128,0.15)' : charter.confirm.confidenceLevel === 'Medium' ? 'rgba(251,191,36,0.15)' : 'rgba(248,113,113,0.15)',
                  color: charter.confirm.confidenceLevel === 'High' ? '#4ade80' : charter.confirm.confidenceLevel === 'Medium' ? '#fbbf24' : '#f87171',
                }}>
                {charter.confirm.confidenceLevel}
              </span>
            </div>
          )}
        </div>

        {/* Section 2 — Decision */}
        <div className="space-y-4">
          <div className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Recommendation</div>
          <div className="grid grid-cols-2 gap-3">
            {[{ val: 'close', label: 'CLOSE THIS INVESTIGATION', color: '#6b7280' }, { val: 'escalate', label: 'ESCALATE TO IMPROVEMENT PROJECT', color: '#e11d48' }].map(opt => (
              <button key={opt.val} onClick={() => setRec('decision', opt.val)}
                className="py-3 px-4 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: rec.decision === opt.val ? opt.color : 'var(--bg-input)',
                  color: rec.decision === opt.val ? 'white' : 'var(--text-3)',
                  border: `2px solid ${rec.decision === opt.val ? opt.color : 'var(--border)'}`,
                }}>{opt.label}</button>
            ))}
          </div>

          {rec.decision === 'close' && (
            <div className="space-y-4 p-4 rounded-xl border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }}>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Reason for closing</label>
                <select value={rec.closeReason || ''} onChange={e => setRec('closeReason', e.target.value)}
                  className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle}>
                  <option value="">Select reason…</option>
                  {['Problem resolved naturally', 'Outside our control', 'Not significant enough', 'Requires capital investment — escalate to senior team', 'Seasonal — monitor and review'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Closing notes</label>
                <textarea value={rec.closeNotes || ''} onChange={e => setRec('closeNotes', e.target.value)}
                  rows={3} placeholder="Any additional notes before closing this investigation..."
                  className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none" style={inputStyle} />
              </div>
              <button onClick={closeInvestigation}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: '#6b7280' }}>
                Close Investigation
              </button>
            </div>
          )}

          {rec.decision === 'escalate' && (
            <div className="space-y-4 p-4 rounded-xl border" style={{ background: 'rgba(225,29,72,0.06)', borderColor: 'rgba(225,29,72,0.2)' }}>
              <div className="text-xs p-2 rounded-lg" style={{ background: 'rgba(225,29,72,0.08)', color: '#f87171' }}>
                All investigation data will carry forward to the new project
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>New project title</label>
                <input value={rec.escalateTitle || ''} onChange={e => setRec('escalateTitle', e.target.value)}
                  placeholder={project.title + ' — Improvement'}
                  className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-3)' }}>Escalate to</label>
                <div className="flex gap-2">
                  {Object.entries(typeLabels).map(([type, label]) => (
                    <button key={type} onClick={() => !escalating && !escalateSuccess && escalateToProject(type)}
                      disabled={escalating || !!escalateSuccess}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                      style={{ background: PROJECT_TYPES[type]?.color, color: 'white' }}>
                      {escalateSuccess === type ? `✓ Escalated to ${label}` : escalating ? '…' : `${label} →`}
                    </button>
                  ))}
                </div>
                {escalateSuccess && (
                  <div className="mt-2 text-xs text-center" style={{ color: '#4ade80' }}>
                    ✓ Escalated to {typeLabels[escalateSuccess]} project. Opening now…
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderTimeline() {
    const dates = checklist.dates || {}

    function setDate(toolId, val) {
      update({ stage_checklist: { ...checklist, dates: { ...dates, [toolId]: val } } })
    }

    const grouped = PHASES.map(phase => ({
      phase,
      tools: activeTools.filter(t => t.phase === phase),
    })).filter(g => g.tools.length > 0)

    return (
      <div className="absolute inset-0 overflow-y-auto z-10" style={{ background: 'var(--bg-page)' }}>
        <div className="max-w-[720px] mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Project Timeline</h3>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>{completedCount}/{activeTools.length} tools complete · {progressPct}%</p>
            </div>
            <button onClick={() => setShowTimeline(false)}
              className="text-xs px-3 py-1.5 rounded-xl font-semibold"
              style={{ background: 'var(--bg-input)', color: 'var(--text-2)' }}>✕ Close</button>
          </div>

          {grouped.map(({ phase, tools: phaseTools }) => {
            const color = PHASE_COLORS[phase] || '#6B7280'
            return (
              <div key={phase} className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-px flex-1" style={{ background: `${color}30` }} />
                  <span className="text-xs font-bold uppercase tracking-widest px-2" style={{ color }}>{phase}</span>
                  <div className="h-px flex-1" style={{ background: `${color}30` }} />
                </div>
                <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                  {phaseTools.map((t, i) => {
                    const idx = activeTools.findIndex(x => x.id === t.id)
                    const isDone = !!checklist[t.id]
                    const isCurrent = t.id === tool.id
                    const dateVal = dates[t.id] || ''
                    return (
                      <div key={t.id}
                        className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:opacity-80 transition-opacity"
                        style={{
                          background: isCurrent ? `${color}10` : i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-input)',
                          borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                        }}
                        onClick={() => { goToTool(idx); setShowTimeline(false) }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: isDone ? 'rgba(74,222,128,0.15)' : isCurrent ? `${color}20` : 'var(--bg-input)' }}>
                          <span className="text-[11px]" style={{ color: isDone ? '#4ade80' : isCurrent ? color : 'var(--text-3)' }}>
                            {isDone ? '✓' : isCurrent ? '→' : '○'}
                          </span>
                        </div>
                        <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-1)' }}>{t.title}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: isDone ? 'rgba(74,222,128,0.1)' : isCurrent ? `${color}15` : 'var(--bg-input)', color: isDone ? '#4ade80' : isCurrent ? color : 'var(--text-3)' }}>
                          {isDone ? 'Done' : isCurrent ? 'In Progress' : 'Not Started'}
                        </span>
                        <input
                          type="date"
                          value={dateVal}
                          onClick={e => e.stopPropagation()}
                          onChange={e => { e.stopPropagation(); setDate(t.id, e.target.value) }}
                          className="text-xs rounded-lg border px-2 py-1"
                          style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: dateVal ? 'var(--text-2)' : 'var(--text-3)', width: 130 }}
                          placeholder="Target date" />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── A3 Overlay ───

  function renderA3() {
    const rootCauseText = charter.rootCauseSummary || project.notes?.match(/ROOT CAUSE: (.+)/s)?.[1]?.trim() || null
    const problemText   = charter.problemStatement || project.problem_statement || null
    const doneCount     = (project.actions || []).filter(a => a.done).length
    const totalCount    = (project.actions || []).length

    const panels = [
      { n: '1', title: 'Problem Statement', color: PHASE_COLORS.Define,
        content: problemText, empty: 'Not yet defined' },
      { n: '2', title: 'Goal / Business Case', color: PHASE_COLORS.Measure,
        content: charter.businessCase ? `${charter.goalStatement || ''}\n\n${charter.businessCase}` : charter.goalStatement, empty: 'Goal not set' },
      { n: '3', title: 'Root Cause Analysis', color: PHASE_COLORS.Analyze,
        content: rootCauseText, empty: 'Analysis in progress' },
      { n: '4', title: 'Countermeasures', color: PHASE_COLORS.Improve,
        content: (project.actions || []).length > 0 ? (project.actions || []).map(a => `${a.done ? '✓' : '○'} ${a.text}`).join('\n') + `\n\n${doneCount}/${totalCount} implemented` : null,
        empty: 'No countermeasures yet' },
    ]

    return (
      <div className="fixed inset-0 z-[70] flex flex-col" style={{ background: '#0A0F1E' }}>
        <div className="flex-shrink-0 flex items-center justify-between px-8 py-4 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-5">
            <span className="text-sm font-bold tracking-widest uppercase" style={{ color: phaseColor }}>◈ A3</span>
            <h2 className="text-xl font-bold text-white">{project.title}</h2>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: `${phaseColor}20`, color: phaseColor }}>{project.stage}</span>
          </div>
          <div className="flex items-center gap-5">
            {project.baseline != null && (
              <div className="flex items-center gap-3 text-sm">
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>{project.metric_id?.toUpperCase()}</span>
                <span className="font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>{project.baseline}</span>
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>→</span>
                <span className="font-bold" style={{ color: latestKpi != null ? (pctChange >= 0 ? '#4ade80' : '#f87171') : 'rgba(255,255,255,0.4)' }}>{latestKpi ?? '—'}</span>
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>→</span>
                <span className="font-bold" style={{ color: phaseColor }}>{project.target_value ?? '?'}</span>
                {pctChange != null && (
                  <span className="font-bold px-2 py-0.5 rounded-full text-sm"
                    style={{ background: pctChange >= 0 ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)', color: pctChange >= 0 ? '#4ade80' : '#f87171' }}>
                    {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}%
                  </span>
                )}
              </div>
            )}
            <button onClick={() => setShowPresent(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>✕</button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 min-h-0" style={{ background: 'rgba(255,255,255,0.05)', gap: '1px' }}>
          {panels.map(s => (
            <div key={s.n} className="flex flex-col overflow-hidden" style={{ background: '#0A0F1E' }}>
              <div className="h-[3px]" style={{ background: s.color }} />
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>{s.n}</span>
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: s.color }}>{s.title}</span>
                </div>
                {s.content
                  ? <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.8)' }}>{s.content}</p>
                  : <p className="text-sm italic" style={{ color: 'rgba(255,255,255,0.2)' }}>{s.empty}</p>}
              </div>
            </div>
          ))}

          <div className="flex flex-col overflow-hidden" style={{ background: '#0A0F1E' }}>
            <div className="h-[3px]" style={{ background: PHASE_COLORS.Control }} />
            <div className="flex-1 p-6 overflow-y-auto flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-6">
                <span className="text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>5</span>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: PHASE_COLORS.Control }}>Results</span>
              </div>
              {pctChange != null ? (
                <div className="space-y-4">
                  <div className="text-6xl font-bold leading-none" style={{ color: pctChange >= 0 ? '#4ade80' : '#f87171' }}>
                    {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}%
                  </div>
                  <div className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>from baseline of {project.baseline}</div>
                  {kpiData.length > 1 && <ControlChart metricId={project.metric_id} data={kpiData} height={90} />}
                </div>
              ) : <p className="text-sm italic" style={{ color: 'rgba(255,255,255,0.2)' }}>Log KPI data to track progress</p>}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden" style={{ background: '#0A0F1E' }}>
            <div className="h-[3px]" style={{ background: PHASE_COLORS.Control }} />
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>6</span>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: PHASE_COLORS.Control }}>Executive Summary</span>
              </div>
              {charter.summary
                ? <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.8)' }}>{charter.summary}</p>
                : <p className="text-sm italic" style={{ color: 'rgba(255,255,255,0.2)' }}>Generate summary in Project Summary tool</p>}
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center justify-between px-8 py-2 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.15)' }}>◈ Continuum · CI Management</span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>Ryan · Amazon FC · {new Date().toLocaleDateString()}</span>
        </div>
      </div>
    )
  }

  // ─── Main Render ───

  // ─── Project Type Selector (shown when no type set yet) ───
  if (!project.project_type) {
    return (
      <div className={inline ? 'flex flex-col h-full' : 'fixed inset-0 z-50 flex flex-col overflow-y-auto'}
        style={{ background: 'var(--bg-page)' }}>
        <div className="max-w-[760px] mx-auto px-6 py-8 w-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {!inline && (
                  <button onClick={onClose} className="text-sm font-semibold" style={{ color: 'var(--text-3)' }}>✕</button>
                )}
                <h2 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>{project.title}</h2>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>Select a project type to determine your tool set and workflow</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {Object.entries(PROJECT_TYPES).map(([key, t]) => (
              <button key={key} onClick={() => selectType(key)}
                className="card p-5 text-left hover:opacity-90 transition-all group"
                style={{ border: `1px solid ${t.color}25` }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: t.color }}>
                    {key === 'quick_win' ? '⚡' : key === 'yellow_belt' ? 'Y' : key === 'green_belt' ? 'G' : key === 'black_belt' ? 'B' : '🔍'}
                  </div>
                  <div>
                    <div className="font-bold text-sm" style={{ color: t.color }}>{t.label}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>{t.tools.length} tools</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {PHASES.filter(p => TOOLS.some(tool => t.tools.includes(tool.id) && tool.phase === p)).map(phase => {
                    const count = TOOLS.filter(tool => t.tools.includes(tool.id) && tool.phase === phase).length
                    return (
                      <span key={phase} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `${PHASE_COLORS[phase]}15`, color: PHASE_COLORS[phase] }}>
                        {phase} · {count}
                      </span>
                    )
                  })}
                </div>
                <div className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
                  {t.tools.length} tools · click to select →
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!tool) return null

  return (
    <div className={inline ? 'flex flex-col h-full relative' : 'fixed inset-0 z-50 flex flex-col relative'}
      style={inline ? {} : { background: 'var(--bg-page)' }}>

      {/* ─── Header ─── */}
      <div className="flex-shrink-0 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-nav)' }}>
        <div className="flex items-center gap-3 px-6 pt-4 pb-2">
          {!inline && (
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
              style={{ background: 'var(--bg-input)', color: 'var(--text-2)' }}>✕</button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              {project.portfolio_id && project.portfolio_name && (
                <>
                  <button onClick={() => onOpenPortfolio?.(project.portfolio_id)}
                    className="text-xs font-semibold hover:underline"
                    style={{ color: '#E8820C' }}>
                    ◈ {project.portfolio_name}
                  </button>
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>›</span>
                </>
              )}
              <h2 className="font-bold text-base truncate" style={{ color: 'var(--text-1)' }}>{project.title}</h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {typeConfig && (
                <button onClick={() => update({ project_type: null, stage_checklist: {} }).then(() => setToolIdx(0))}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${typeConfig.color}18`, color: typeConfig.color }}
                  title="Click to change project type">
                  {typeConfig.label}
                </button>
              )}
              <span className="text-xs font-semibold" style={{ color: phaseColor }}>{tool.phase}</span>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>›</span>
              <span className="text-xs" style={{ color: 'var(--text-2)' }}>{tool.title}</span>
              {checklist[tool.id] && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>✓ Done</span>
              )}
              {daysSinceUpdate !== null && daysSinceUpdate > 7 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: daysSinceUpdate > 14 ? 'rgba(220,38,38,0.12)' : 'rgba(232,130,12,0.12)',
                    color: daysSinceUpdate > 14 ? '#f87171' : '#fb923c',
                  }}>
                  {daysSinceUpdate > 14 ? '● Inactive' : '◑ Stalled'} — {daysSinceUpdate}d
                </span>
              )}
              {charter.escalatedFrom && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(225,29,72,0.10)', color: '#f43f5e' }}>
                  🔗 Escalated from Investigation: {charter.escalatedFromTitle || charter.escalatedFrom}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0" style={{ position: 'relative' }}>
            <PresentationHotspot id="project-dmaic" demoMode={demoMode} />
            <button onClick={() => setShowTimeline(t => !t)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={showTimeline
                ? { background: phaseColor, color: 'white' }
                : { background: 'var(--bg-input)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              ▤ Timeline
            </button>
            <div style={{ position: 'relative' }}>
              <PresentationHotspot id="project-a3" demoMode={demoMode} />
              <button onClick={() => setShowPresent(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                style={{ background: `${phaseColor}18`, color: phaseColor, border: `1px solid ${phaseColor}30` }}>
                ◈ A3
              </button>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mx-6 mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{completedCount}/{activeTools.length} tools complete</span>
            <span className="text-[10px] font-bold" style={{ color: progressPct === 100 ? '#4ade80' : 'var(--text-3)' }}>{progressPct}%</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-input)' }}>
            <div className="h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, background: progressPct === 100 ? '#4ade80' : phaseColor }} />
          </div>
        </div>

        {/* Phase tabs */}
        <div className="flex px-6">
          {PHASES.filter(phase => activeTools.some(t => t.phase === phase)).map(phase => {
            const phaseTools = activeTools.filter(t => t.phase === phase)
            const isDone     = phaseTools.every(t => checklist[t.id])
            const isCurrent  = tool.phase === phase
            const hasStarted = phaseTools.some(t => checklist[t.id])
            const firstIdx   = activeTools.findIndex(t => t.phase === phase)
            return (
              <button key={phase} onClick={() => goToTool(firstIdx)}
                className="flex-1 flex flex-col items-center gap-0.5 pb-2.5 pt-1 relative transition-all"
                style={{ borderBottom: `2px solid ${isCurrent ? phaseColor : 'transparent'}` }}>
                <span className="text-xs font-semibold" style={{
                  color: isCurrent ? phaseColor : isDone ? '#4ade80' : hasStarted ? 'var(--text-2)' : 'var(--text-3)',
                }}>
                  {isDone && !isCurrent ? '✓ ' : ''}{phase}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── Goal Statement Banner ─── */}
      {(charter.goalStatement || (project.baseline != null && project.target_value != null)) && (
        <div className="flex-shrink-0 px-6 py-2 border-b text-sm" style={{ borderColor: 'var(--border)', background: `${phaseColor}08` }}>
          <span className="font-semibold" style={{ color: phaseColor }}>Goal Statement: </span>
          <span style={{ color: 'var(--text-2)' }}>
            {charter.goalStatement || `${project.metric_id?.toUpperCase() || 'KPI'} from ${project.baseline} to ${project.target_value}`}
          </span>
        </div>
      )}

      {/* ─── Tool Content ─── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-[720px] mx-auto px-6 py-6">

          {/* Tool header */}
          <div className="mb-5">
            <h3 className="text-xl font-bold mb-1.5" style={{ color: 'var(--text-1)' }}>{tool.title}</h3>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>{tool.desc}</p>
          </div>

          {/* Phase tool pills */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {activeTools.filter(t => t.phase === tool.phase).map(t => {
              const idx      = activeTools.findIndex(x => x.id === t.id)
              const isCurrent = t.id === tool.id
              const isDone    = !!checklist[t.id]
              return (
                <button key={t.id} onClick={() => goToTool(idx)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: isCurrent ? phaseColor : isDone ? 'rgba(74,222,128,0.12)' : 'var(--bg-input)',
                    color: isCurrent ? 'white' : isDone ? '#4ade80' : 'var(--text-2)',
                    border: `1px solid ${isCurrent ? phaseColor : isDone ? 'rgba(74,222,128,0.3)' : 'var(--border)'}`,
                  }}>
                  {isDone && !isCurrent && '✓ '}{t.title}
                </button>
              )
            })}
          </div>

          {/* Tool-specific content */}
          {tool.id === 'charter'              && renderCharter()}
          {tool.id === 'sipoc'                && renderSipoc()}
          {tool.id === 'baseline'             && renderBaseline()}
          {tool.id === 'process'              && renderProcess()}
          {tool.id === 'clues'                && renderClues()}
          {tool.id === 'rootcause'            && renderRootCause()}
          {tool.id === 'solutions'            && renderSolutions()}
          {tool.id === 'tobemap'              && renderTobemap()}
          {tool.id === 'actions'              && renderActions()}
          {tool.id === 'results'              && renderResults()}
          {tool.id === 'handoff'              && renderHandoff()}
          {tool.id === 'monitor'              && renderMonitor()}
          {tool.id === 'transfer'             && renderTransfer()}
          {tool.id === 'summary'              && renderSummary()}
          {tool.id === 'before_photo'         && renderBeforePhoto()}
          {tool.id === 'after_photo'          && renderAfterPhoto()}
          {tool.id === 'fishbone'             && renderFishbone()}
          {tool.id === 'data_collection_plan' && renderDataCollectionPlan()}
          {tool.id === 'screener'             && renderScreener()}
          {tool.id === 'voc'                  && renderVOC()}
          {tool.id === 'confirm_stats'        && renderConfirmStats()}
          {tool.id === 'confirm'              && renderConfirm()}
          {tool.id === 'verify'               && renderVerify()}
          {tool.id === 'recommendation'       && renderRecommendation()}

          <div className="h-6" />
        </div>
      </div>

      {/* ─── Bottom Navigation ─── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-nav)' }}>
        <button onClick={prevTool} disabled={toolIdx === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-30 transition-all"
          style={{ background: 'var(--bg-input)', color: 'var(--text-2)' }}>
          ← PREVIOUS
        </button>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {activeTools.map((t, i) => (
            <button key={t.id} onClick={() => goToTool(i)}
              className="rounded-full transition-all duration-200"
              style={{
                width:  i === toolIdx ? 20 : 6,
                height: 6,
                background: i === toolIdx ? phaseColor : checklist[t.id] ? '#4ade80' : 'var(--border)',
              }} />
          ))}
        </div>

        <button onClick={completeTool}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
          style={{
            background: checklist[tool.id] ? 'rgba(74,222,128,0.12)' : phaseColor,
            color: checklist[tool.id] ? '#4ade80' : 'white',
          }}>
          {checklist[tool.id]
            ? '✓ Completed'
            : toolIdx === activeTools.length - 1 ? 'COMPLETE PROJECT →' : 'COMPLETE →'}
        </button>
      </div>

      {showTimeline && renderTimeline()}
      {showPresent && renderA3()}
    </div>
  )
}
