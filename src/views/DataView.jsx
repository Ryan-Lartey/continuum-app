import { useState, useEffect, useRef } from 'react'
import { api, streamAgent } from '../lib/api.js'
import PresentationHotspot from '../components/PresentationHotspot.jsx'
import { calcSPC, interpretSignal } from '../lib/spc.js'
import {
  ComposedChart, Line, Area, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer
} from 'recharts'

const DEFAULT_TARGETS = { UPH: 100, Accuracy: 99.5, DPMO: 500, DTS: 98 }

function buildMetrics(targets) {
  const t = targets || DEFAULT_TARGETS
  return [
    { id: 'uph',      label: 'UPH',          unit: '',   target: t.UPH ?? 100,      higher: true,  color: '#3B7FDE' },
    { id: 'accuracy', label: 'Pick Accuracy', unit: '%',  target: t.Accuracy ?? 99.5, higher: true,  color: '#7C3AED' },
    { id: 'dpmo',     label: 'DPMO',          unit: '',   target: t.DPMO ?? 500,     higher: false, color: '#DC2626' },
    { id: 'dts',      label: 'DTS',           unit: '%',  target: t.DTS ?? 98,       higher: true,  color: '#16A34A' },
  ]
}

const TICK  = { fontSize: 11, fill: '#4E5268' }
const GRID  = 'rgba(255,255,255,0.05)'
const TT    = { fontSize: 11, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: '#1C2035', color: '#E4E6F0', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }

function SignalDot({ cx, cy, payload }) {
  if (!payload?.signal) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={14} fill="rgba(220,38,38,0.08)" />
      <circle cx={cx} cy={cy} r={9}  fill="rgba(220,38,38,0.15)" />
      <circle cx={cx} cy={cy} r={5}  fill="#DC2626" />
    </g>
  )
}

function NormalDot({ cx, cy, payload, fill }) {
  if (payload?.signal) return null
  return <circle cx={cx} cy={cy} r={3.5} fill={fill || '#3B7FDE'} stroke="#161A26" strokeWidth={2} />
}

function AnnotationDot({ cx, cy, payload }) {
  if (!payload?.annotation) return null
  return (
    <g>
      <title>{payload.annotation}</title>
      <text x={cx} y={cy - 10} textAnchor="middle" fontSize={10} fill="#fbbf24">◆</text>
    </g>
  )
}

// ── Benchmark helpers ────────────────────────────────────────────────────────
function avgOf(arr) {
  if (!arr.length) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function calcBenchmarks(metricData, metric) {
  if (!metricData.length || !metric) return null
  const sorted = [...metricData].sort((a, b) => a.date.localeCompare(b.date))
  const vals = sorted.map(d => d.value)

  const last7   = vals.slice(-7)
  const prev7   = vals.slice(-14, -7)
  const last30  = vals.slice(-30)
  const prev30  = vals.slice(-60, -30)

  const avg7    = avgOf(last7)
  const avgP7   = avgOf(prev7)
  const avg30   = avgOf(last30)
  const avgP30  = avgOf(prev30)

  const best  = Math.max(...vals)
  const worst = Math.min(...vals)

  const onTarget = metric.higher
    ? vals.filter(v => v >= metric.target).length
    : vals.filter(v => v <= metric.target).length
  const pctOnTarget = vals.length ? (onTarget / vals.length) * 100 : 0

  return { avg7, avgP7, avg30, avgP30, best, worst, pctOnTarget, total: vals.length }
}

function pctChange(current, previous) {
  if (previous == null || previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

// ── Early warning: heading for signal ───────────────────────────────────────
function calcEarlyWarning(metricData, spc, metric) {
  if (!spc || !metric || metricData.length < 3) return null

  const last3vals = metricData.slice(-3).map(d => d.value)
  const [a, b, c] = last3vals

  const allDecreasing = a > b && b > c
  const allIncreasing = a < b && b < c

  if (!allDecreasing && !allIncreasing) return null

  const latest = c
  const direction = allDecreasing ? 'decreasing' : 'increasing'

  // For higher-is-better: bad = decreasing toward LCL; for lower-is-better: bad = increasing toward UCL
  const badDirectionForHigher = allDecreasing
  const badDirectionForLower  = allIncreasing
  const badDirection = metric.higher ? badDirectionForHigher : badDirectionForLower

  if (!badDirection) return null

  // Check if latest value is between 85%–95% of the control limit distance
  if (metric.higher) {
    // heading toward LCL
    const lclEffective = Math.max(spc.lcl, 0)
    const totalRange = spc.xBar - lclEffective
    if (totalRange <= 0) return null
    const distFromCentre = spc.xBar - latest
    const ratio = distFromCentre / totalRange
    if (ratio >= 0.85 && ratio <= 0.95) {
      return { direction: 'decreasing', limit: 'LCL' }
    }
  } else {
    // heading toward UCL
    const totalRange = spc.ucl - spc.xBar
    if (totalRange <= 0) return null
    const distFromCentre = latest - spc.xBar
    const ratio = distFromCentre / totalRange
    if (ratio >= 0.85 && ratio <= 0.95) {
      return { direction: 'increasing', limit: 'UCL' }
    }
  }

  return null
}

// ── Chart summary generator ──────────────────────────────────────────────────
function generateChartSummary(data, metric) {
  if (!data.length) return ''
  const latest = data[data.length - 1].value
  const first = data[0].value
  if (first === 0) return ''
  const change = ((latest - first) / first * 100).toFixed(1)
  const direction = metric.higher ? (latest >= metric.target ? 'above' : 'below') : (latest <= metric.target ? 'at or below' : 'above')
  const signals = data.filter(d => d.signal).length
  const trend = Math.abs(change) < 0.5 ? 'stable' : change > 0 ? 'up' : 'down'
  const trendWord = metric.higher
    ? (trend === 'up' ? 'improving' : trend === 'down' ? 'declining' : 'stable')
    : (trend === 'down' ? 'improving' : trend === 'up' ? 'worsening' : 'stable')
  return `${metric.label} is currently ${latest}${metric.unit} — ${direction} target — ${trendWord} ${Math.abs(change)}% over this period${signals > 0 ? `, with ${signals} signal${signals > 1 ? 's' : ''} detected` : ''}.`
}

// ── Trend colour ─────────────────────────────────────────────────────────────
function calcTrendColor(data, metric) {
  if (!data || data.length < 6) return '#60a5fa'
  const last7 = data.slice(-7)
  if (last7.length < 6) return '#60a5fa'
  const first3 = last7.slice(0, 3).map(d => d.value)
  const last3  = last7.slice(-3).map(d => d.value)
  const avgFirst = first3.reduce((a, b) => a + b, 0) / first3.length
  const avgLast  = last3.reduce((a, b) => a + b, 0) / last3.length
  if (avgFirst === 0) return '#60a5fa'
  const pctChange = ((avgLast - avgFirst) / Math.abs(avgFirst)) * 100
  if (Math.abs(pctChange) < 0.5) return '#60a5fa'
  const improving = metric.higher ? pctChange > 0 : pctChange < 0
  return improving ? '#4ade80' : '#f87171'
}

// ── Custom Tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, metric }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: 'var(--text-3)', marginBottom: 4 }}>{d?.date}</div>
      <div style={{ color: 'var(--text-1)', fontWeight: 600 }}>{d?.value} {metric?.unit}</div>
      {d?.signal ? <div style={{ color: '#f87171', marginTop: 4 }}>⚠ Signal detected</div> : null}
      {d?.annotation ? <div style={{ color: '#fb923c', marginTop: 4 }}>◆ {d.annotation}</div> : null}
    </div>
  )
}

// ── Signal dot for Layer 1 ───────────────────────────────────────────────────
function Layer1SignalDot({ cx, cy, payload }) {
  if (!payload?.signal) return null
  return (
    <g style={{ filter: 'drop-shadow(0 0 4px #f87171)' }}>
      <circle cx={cx} cy={cy} r={10} fill="rgba(248,113,113,0.15)" />
      <circle cx={cx} cy={cy} r={6}  fill="rgba(248,113,113,0.35)" />
      <circle cx={cx} cy={cy} r={4}  fill="#f87171" />
    </g>
  )
}

// ── Annotation dot for Layer 1 ───────────────────────────────────────────────
function Layer1AnnotationDot({ cx, cy, payload }) {
  if (!payload?.annotation) return null
  return (
    <g>
      <title>{payload.annotation}</title>
      <text x={cx} y={cy - 12} textAnchor="middle" fontSize={12} fill="#fb923c">◆</text>
    </g>
  )
}

const SECTION_COLORS = {
  inbound:  '#3B7FDE',
  icqa:     '#7C3AED',
  outbound: '#0891B2',
  pick:     '#E8820C',
  pack:     '#16A34A',
  slam:     '#DC2626',
  sort:     '#059669',
  loading:  '#D97706',
}

const OUTBOUND_SUBS = [
  { id: 'pick',    label: 'Pick'    },
  { id: 'pack',    label: 'Pack'    },
  { id: 'slam',    label: 'Slam'    },
  { id: 'sort',    label: 'Sort'    },
  { id: 'loading', label: 'Loading' },
]

function normalizeSections(raw) {
  const byId = {}
  for (const s of raw) byId[s.id] = s
  return [
    byId.inbound  || { id: 'inbound',  label: 'Inbound',  order: 1, score: null, score_status: 'no_data', last_shift: null },
    byId.icqa     || { id: 'icqa',     label: 'ICQA',     order: 2, score: null, score_status: 'no_data', last_shift: null },
    {
      ...(byId.outbound || { id: 'outbound', label: 'Outbound', order: 3, score: null, score_status: 'no_data', last_shift: null }),
      subsections: OUTBOUND_SUBS.map(sub => byId[sub.id] || { ...sub, score: null, score_status: 'no_data', last_shift: null }),
    },
  ]
}

function SectionCard({ s, selected, onSelect }) {
  const [hovered, setHovered] = useState(false)
  const score    = s.score
  const color    = SECTION_COLORS[s.id] || '#6b7280'
  const isActive = selected === s.id
  const rag      = score === null ? 'grey' : score >= 80 ? 'green' : score >= 60 ? 'amber' : 'red'
  const ragColor = { green: '#22C55E', amber: '#F59E0B', red: '#EF4444', grey: '#94A3B8' }[rag]
  const ragLabel = { green: 'Healthy', amber: 'Monitor', red: 'At Risk', grey: 'No data' }[rag]
  const ragGlow  = { green: 'rgba(34,197,94,0.22)', amber: 'rgba(245,158,11,0.22)', red: 'rgba(239,68,68,0.22)', grey: 'rgba(148,163,184,0.08)' }[rag]
  return (
    <button onClick={() => onSelect(isActive ? null : s.id)}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: isActive ? `${color}0d` : 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${isActive ? color + '55' : hovered ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.07)'}`,
        borderTop: `3px solid ${isActive ? color : hovered ? color + '70' : 'transparent'}`,
        borderRadius: 14, padding: 20, textAlign: 'left', cursor: 'pointer',
        transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)',
        transform: hovered && !isActive ? 'translateY(-2px)' : 'none',
        boxShadow: isActive ? `0 8px 32px ${ragGlow}` : hovered ? '0 8px 28px rgba(0,0,0,0.35)' : '0 2px 12px rgba(0,0,0,0.2)',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: isActive ? color : '#64748B' }}>
          {s.label}
          {s.id === 'outbound' && <span style={{ marginLeft: 6, fontSize: 9, opacity: 0.6 }}>▸ Pick · Pack · Slam · Sort · Loading</span>}
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: `${ragColor}18`, color: ragColor, border: `1px solid ${ragColor}28` }}>{ragLabel}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, marginBottom: 14 }}>
        <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em', color: ragColor }}>
          {score !== null ? Math.round(score) : '—'}
        </span>
        {score !== null && <span style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 5 }}>/100</span>}
      </div>
      <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ height: '100%', borderRadius: 999, width: `${score ?? 0}%`, background: `linear-gradient(90deg, ${ragColor}80, ${ragColor})`, transition: 'width 700ms cubic-bezier(0.34,1.56,0.64,1)' }} />
      </div>
      <div style={{ fontSize: 10, color: '#475569' }}>
        {s.last_shift ? `${s.last_shift.shift_type === 'day' ? '☀' : '🌙'} ${s.last_shift.shift_type} · ${s.last_shift.date}` : 'No shift data yet'}
      </div>
    </button>
  )
}

function SectionCards({ sections, selected, onSelect, selectedSub, onSelectSub }) {
  const hour = new Date().getHours()
  const currentShift = (hour >= 6 && hour < 16) ? 'day' : (hour >= 20 || hour < 6) ? 'night' : null
  const outbound = sections.find(s => s.id === 'outbound')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>Select a section to view its metrics and performance</p>
        {currentShift && (
          <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: currentShift === 'day' ? 'rgba(232,130,12,0.12)' : 'rgba(59,127,222,0.12)', color: currentShift === 'day' ? '#E8820C' : '#60a5fa', border: `1px solid ${currentShift === 'day' ? 'rgba(232,130,12,0.25)' : 'rgba(59,127,222,0.25)'}` }}>
            {currentShift === 'day' ? '☀ Day shift active' : '🌙 Night shift active'}
          </span>
        )}
      </div>

      {/* 3 top-level section cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {sections.map(s => <SectionCard key={s.id} s={s} selected={selected} onSelect={onSelect} />)}
      </div>

      {/* Outbound subsections — revealed when Outbound is selected */}
      {selected === 'outbound' && (
        <div style={{ padding: '4px 0 2px 2px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#0891B2', marginBottom: 10 }}>
            Outbound Areas — select one to view its KPIs
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {OUTBOUND_SUBS.map(sub => {
              const subData  = outbound?.subsections?.find(ss => ss.id === sub.id)
              const score    = subData?.score ?? null
              const isActive = selectedSub === sub.id
              const color    = SECTION_COLORS[sub.id] || '#6b7280'
              const rag      = score === null ? 'grey' : score >= 80 ? 'green' : score >= 60 ? 'amber' : 'red'
              const ragColor = { green: '#22C55E', amber: '#F59E0B', red: '#EF4444', grey: '#94A3B8' }[rag]
              const ragLabel = { green: 'Healthy', amber: 'Monitor', red: 'At Risk', grey: 'No data' }[rag]
              return (
                <button key={sub.id} onClick={() => onSelectSub(isActive ? null : sub.id)}
                  style={{
                    background: isActive ? `${color}12` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isActive ? color + '50' : 'rgba(255,255,255,0.07)'}`,
                    borderTop: `2px solid ${isActive ? color : color + '35'}`,
                    borderRadius: 12, padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                    transition: 'all 180ms cubic-bezier(0.34,1.56,0.64,1)',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: isActive ? color : '#64748B' }}>{sub.label}</span>
                    <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: `${ragColor}18`, color: ragColor }}>{ragLabel}</span>
                  </div>
                  <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 10, background: `linear-gradient(135deg, #fff 0%, ${ragColor} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                    {score !== null ? Math.round(score) : '—'}
                  </div>
                  <div style={{ height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 999, width: `${score ?? 0}%`, background: `linear-gradient(90deg, ${ragColor}80, ${ragColor})`, transition: 'width 700ms' }} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const FALLBACK_SECTIONS = [
  { id: 'inbound',  label: 'Inbound',  order: 1, score: null, score_status: 'no_data', last_shift: null },
  { id: 'icqa',     label: 'ICQA',     order: 2, score: null, score_status: 'no_data', last_shift: null },
  {
    id: 'outbound', label: 'Outbound', order: 3, score: null, score_status: 'no_data', last_shift: null,
    subsections: OUTBOUND_SUBS.map(s => ({ ...s, score: null, score_status: 'no_data', last_shift: null })),
  },
]

export default function DataView({ onOpenAgent, onNavigate, demoMode }) {
  const [sections, setSections]         = useState(FALLBACK_SECTIONS)
  const [selected, setSelected]         = useState('uph')
  const [latestKpis, setLatestKpis]     = useState({})
  const [metricData, setMetricData]     = useState([])
  const [allKpis, setAllKpis]           = useState([])
  const [projects, setProjects]         = useState([])
  const [logVal, setLogVal]             = useState('')
  const [logDate, setLogDate]           = useState(new Date().toISOString().split('T')[0])
  const [logAnnotation, setLogAnnotation] = useState('')
  const [logging, setLogging]           = useState(false)
  const [showGlossary, setShowGlossary] = useState(false)
  const [kpiTargets, setKpiTargets]     = useState(DEFAULT_TARGETS)
  const [timeWindow, setTimeWindow]     = useState(30)
  const [spcExpanded, setSpcExpanded]   = useState(false)
  const [selectedSection, setSelectedSection]       = useState(null)
  const [selectedSubsection, setSelectedSubsection] = useState(null)

  // Shift-level entry
  const [logMode, setLogMode]   = useState('daily')  // 'daily' | 'shift'
  const [shiftVals, setShiftVals] = useState({ am: '', pm: '', night: '' })

  // AI commentary
  const [commentary, setCommentary]               = useState('')
  const [commentaryVisible, setCommentaryVisible] = useState(false)
  const commentaryTimer = useRef(null)

  // Right panel tab
  const [rightTab, setRightTab] = useState('limits') // 'limits' | 'data' | 'benchmark'

  useEffect(() => {
    api.getSections().then(data => { if (data?.length) setSections(normalizeSections(data)) }).catch(() => {})
    api.getLatestKpis().then(setLatestKpis).catch(() => {})
    api.getKpis().then(setAllKpis).catch(() => {})
    api.getProjects().then(ps => setProjects(ps.filter(p => p.stage !== 'Closed'))).catch(() => {})
    api.getSite().then(s => { if (s.kpi_targets) setKpiTargets(s.kpi_targets) }).catch(() => {})
  }, [])

  useEffect(() => {
    api.getMetricData(selected).then(setMetricData).catch(() => [])
  }, [selected])

  function triggerCommentary(metricLabel, value, target) {
    setCommentary('')
    setCommentaryVisible(true)
    if (commentaryTimer.current) clearTimeout(commentaryTimer.current)

    let built = ''
    streamAgent(
      'kpi-commentary',
      [{ role: 'user', content: `In one sentence, what does this ${metricLabel} reading of ${value} vs target ${target} mean for the operation? Be specific and direct.` }],
      null,
      (chunk) => { built += chunk; setCommentary(built) },
      () => {
        commentaryTimer.current = setTimeout(() => setCommentaryVisible(false), 8000)
      },
      () => {
        commentaryTimer.current = setTimeout(() => setCommentaryVisible(false), 8000)
      }
    )
  }

  async function handleLogKpi(e) {
    e.preventDefault()
    const metric = METRICS.find(m => m.id === selected)
    setLogging(true)

    try {
      if (logMode === 'daily') {
        if (!logVal) return
        const val = parseFloat(logVal)
        await api.addKpi({ metric_id: selected, value: val, date: logDate, annotation: logAnnotation || undefined })
        setLogVal('')
        setLogAnnotation('')
        triggerCommentary(metric?.label, val, metric?.target)
      } else {
        const { am, pm, night } = shiftVals
        const filled = [am, pm, night].filter(v => v !== '')
        if (!filled.length) return
        const avg = filled.reduce((s, v) => s + parseFloat(v), 0) / filled.length
        const notes = [am && `AM:${am}`, pm && `PM:${pm}`, night && `Night:${night}`].filter(Boolean).join(', ')
        await api.addKpi({ metric_id: selected, value: parseFloat(avg.toFixed(4)), date: logDate, notes, annotation: logAnnotation || undefined })
        setShiftVals({ am: '', pm: '', night: '' })
        setLogAnnotation('')
        triggerCommentary(metric?.label, parseFloat(avg.toFixed(2)), metric?.target)
      }

      const [latest, data] = await Promise.all([
        api.getLatestKpis(),
        api.getMetricData(selected),
      ])
      setLatestKpis(latest)
      setMetricData(data)
    } finally { setLogging(false) }
  }

  const METRICS = buildMetrics(kpiTargets)
  const metric = METRICS.find(m => m.id === selected)
  const spc    = calcSPC(metricData.map(d => d.value))
  const interpretation = interpretSignal(spc, metric?.label)
  const earlyWarning   = calcEarlyWarning(metricData, spc, metric)
  const benchmarks     = calcBenchmarks(metricData, metric)

  const chartData = metricData.map((d, i) => ({
    date:       d.date?.slice(5),
    value:      d.value,
    signal:     spc?.signals[i] || false,
    annotation: d.annotation || null,
  }))

  // Time-window filtered data for Layer 1
  const filteredChartData = chartData.slice(-timeWindow)
  const trendColor = calcTrendColor(filteredChartData, metric)

  // Y-axis domain for Layer 1
  const layer1Domain = (() => {
    if (!filteredChartData.length) return ['auto', 'auto']
    const vals = filteredChartData.map(d => d.value)
    if (metric?.target !== undefined) vals.push(metric.target)
    const dataMin = Math.min(...vals)
    const dataMax = Math.max(...vals)
    let range = dataMax - dataMin
    if (range < (dataMax * 0.02)) range = dataMax * 0.02  // minimum 2% spread
    return [dataMin - range * 0.1, dataMax + range * 0.1]
  })()

  const signalCountInWindow = filteredChartData.filter(d => d.signal).length
  const chartSummary = metric ? generateChartSummary(filteredChartData, metric) : ''

  const mrData = spc ? metricData.slice(1).map((d, i) => ({
    date:   d.date?.slice(5),
    mr:     spc.movingRanges[i],
    signal: spc.mrSignals[i],
  })) : []

  const kpiByMetric = {}
  for (const m of METRICS) {  // METRICS is built above from kpiTargets
    kpiByMetric[m.id] = allKpis.filter(k => k.metric_id === m.id).sort((a, b) => a.date.localeCompare(b.date))
  }

  const outboundSection = sections.find(s => s.id === 'outbound')
  const activeSection   = selectedSubsection
    ? (outboundSection?.subsections?.find(ss => ss.id === selectedSubsection) || null)
    : sections.find(s => s.id === selectedSection)
  const sectionColor    = selectedSubsection
    ? (SECTION_COLORS[selectedSubsection] || '#6b7280')
    : selectedSection ? (SECTION_COLORS[selectedSection] || '#6b7280') : '#E8820C'
  const activeLabelFull = selectedSubsection
    ? `Outbound › ${OUTBOUND_SUBS.find(s => s.id === selectedSubsection)?.label} — metrics and performance`
    : activeSection ? `${activeSection.label} — metrics and performance` : 'Most recent shift health score per section'

  return (
    <div className="max-w-[1400px] space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
            Warehouse Health
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>{activeLabelFull}</p>
        </div>
        {selectedSection && (
          <button onClick={() => setShowGlossary(g => !g)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: showGlossary ? 'rgba(232,130,12,0.18)' : 'rgba(255,255,255,0.06)', color: showGlossary ? '#E8820C' : 'var(--text-2)', border: `1px solid ${showGlossary ? 'rgba(232,130,12,0.35)' : 'var(--border)'}` }}>
            ? How to read this chart
          </button>
        )}
      </div>

      {/* Section selector cards */}
      <SectionCards
        sections={sections}
        selected={selectedSection}
        onSelect={id => { setSelectedSection(id); setSelectedSubsection(null) }}
        selectedSub={selectedSubsection}
        onSelectSub={setSelectedSubsection}
      />

      {/* Outbound no-sub prompt */}
      {selectedSection === 'outbound' && !selectedSubsection && (
        <div className="card p-8 flex flex-col items-center justify-center text-center gap-3" style={{ borderStyle: 'dashed', borderColor: 'rgba(8,145,178,0.25)' }}>
          <div style={{ fontSize: 28, opacity: 0.4, color: '#0891B2' }}>▸</div>
          <div className="font-semibold text-sm" style={{ color: 'var(--text-2)' }}>Select an Outbound area above</div>
          <div className="text-xs max-w-sm leading-relaxed" style={{ color: 'var(--text-3)' }}>
            Pick, Pack, Slam, Sort, or Loading — each has its own KPIs and health score.
          </div>
        </div>
      )}

      {/* ── Section detail ── */}
      {(selectedSection === 'outbound' ? !!selectedSubsection : !!selectedSection) && <>

      {/* Section health summary */}
      {activeSection && (() => {
        const score    = activeSection.score
        const rag      = score === null ? 'grey' : score >= 80 ? 'green' : score >= 60 ? 'amber' : 'red'
        const ragColor = { green: '#4ade80', amber: '#fb923c', red: '#f87171', grey: '#6b7280' }[rag]
        const ragLabel = { green: 'Healthy', amber: 'Monitor', red: 'At Risk', grey: 'No data' }[rag]
        return (
          <div className="card p-5 flex items-center gap-6" style={{ borderLeft: `4px solid ${sectionColor}` }}>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>
                {selectedSubsection ? `Outbound › ${activeSection.label}` : activeSection.label} — Health Score
              </div>
              <div className="flex items-baseline gap-2">
                <span style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-3px', color: score !== null ? ragColor : 'var(--text-3)', lineHeight: 1 }}>
                  {score !== null ? Math.round(score) : '—'}
                </span>
                {score !== null && <span className="text-lg font-semibold" style={{ color: 'var(--text-3)' }}>/100</span>}
              </div>
            </div>
            <div className="flex-1">
              <div className="rounded-full overflow-hidden mb-2" style={{ height: 8, background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full" style={{ width: `${score ?? 0}%`, background: ragColor }} />
              </div>
              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-3)' }}>
                <span className="px-2 py-0.5 rounded-full font-semibold text-[10px]" style={{ background: `${ragColor}18`, color: ragColor }}>{ragLabel}</span>
                {activeSection.last_shift
                  ? <span>{activeSection.last_shift.shift_type === 'day' ? '☀ Day' : '🌙 Night'} shift · {activeSection.last_shift.date}</span>
                  : <span>No shift data yet</span>}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Metrics placeholder — will show metric tiles + SPC charts once configured */}
      <div className="card p-8 flex flex-col items-center justify-center text-center gap-3" style={{ borderStyle: 'dashed', borderColor: sectionColor + '40' }}>
        <div style={{ fontSize: 32, opacity: 0.3 }}>◈</div>
        <div className="font-semibold text-sm" style={{ color: 'var(--text-2)' }}>No metrics configured for {activeSection?.label} yet</div>
        <div className="text-xs max-w-sm leading-relaxed" style={{ color: 'var(--text-3)' }}>
          Metrics for this section will appear here once configured. Each metric will show its actual value, score vs target, severity weight, and SPC trend chart.
        </div>
      </div>

      {false && <>
      {/* KPI tiles — shown per-section once metrics are assigned */}
      <div className="grid grid-cols-4 gap-4">
        {METRICS.map(m => {
          const d         = latestKpis[m.id]
          const val       = d?.value
          const data      = kpiByMetric[m.id] || []
          const mspc      = calcSPC(data.map(x => x.value))
          const isSelected = selected === m.id
          const ratio     = val !== undefined ? (m.higher ? val / m.target : m.target / val) : null
          const rag       = ratio === null ? 'grey' : ratio >= 0.98 ? 'green' : ratio >= 0.93 ? 'amber' : 'red'
          const ragColor  = { green: '#4ade80', amber: '#fb923c', red: '#f87171', grey: '#6b7280' }[rag]
          const diff      = val !== undefined ? ((val - m.target) / m.target * 100) : null

          return (
            <button key={m.id} onClick={() => setSelected(m.id)}
              className="card p-4 text-left transition-all"
              style={{ borderColor: isSelected ? m.color : undefined, borderWidth: isSelected ? 2 : 1 }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{m.label}</span>
                <div className="flex items-center gap-1.5">
                  {mspc?.hasSignal && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
                  <span className="status-pill text-[10px]" style={{ background: `${ragColor}18`, color: ragColor }}>
                    {rag === 'grey' ? 'No data' : rag === 'green' ? 'On target' : rag === 'amber' ? 'Watch' : 'Off target'}
                  </span>
                </div>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1.5px', color: ragColor, lineHeight: 1 }}>
                  {val !== undefined ? val.toLocaleString() : '—'}
                </span>
                <span className="text-base" style={{ color: 'var(--text-3)' }}>{m.unit}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span style={{ color: 'var(--text-3)' }}>Target {m.target}{m.unit}</span>
                {diff !== null && <span className="font-semibold" style={{ color: ragColor }}>{diff > 0 ? '+' : ''}{diff.toFixed(1)}%</span>}
              </div>
              {data.length > 0 && (
                <div className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>
                  {data.length} pts{mspc ? ` · σ=${mspc.sigma.toFixed(2)}` : ''}
                </div>
              )}
              {projects.filter(p => p.metric_id === m.id).map(p => (
                <button key={p.id} onClick={e => { e.stopPropagation(); onNavigate?.('projects', p) }}
                  className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(232,130,12,0.1)', color: '#E8820C' }}>
                  ◆ {p.title.length > 22 ? p.title.slice(0, 22) + '…' : p.title}
                </button>
              ))}
            </button>
          )
        })}
      </div>

      {/* Glossary panel */}
      {showGlossary && (
        <div className="rounded-2xl p-5 border" style={{ background: 'var(--bg-card)', borderColor: 'rgba(232,130,12,0.3)' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="font-bold text-sm" style={{ color: '#E8820C' }}>How to read this chart ?</span>
            <button onClick={() => setShowGlossary(false)}
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-3)' }}>✕</button>
          </div>
          <div className="grid grid-cols-2 gap-5 text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
            <div>
              <div className="font-bold mb-2 uppercase tracking-wide text-[10px]" style={{ color: 'var(--text-3)' }}>Trend Chart — the main chart</div>
              <div className="space-y-1.5">
                <div>• The <strong style={{ color: 'var(--text-1)' }}>connected line</strong> = your metric over time. Each point is one logged value.</div>
                <div>• <strong style={{ color: '#4ade80' }}>Green line</strong> = trending toward target (improving)</div>
                <div>• <strong style={{ color: '#f87171' }}>Red line</strong> = trending away from target (worsening)</div>
                <div>• <strong style={{ color: '#60a5fa' }}>Blue line</strong> = stable, no clear direction</div>
                <div>• <strong style={{ color: '#f87171' }}>● Pulsing red dot</strong> = a signal — statistically significant change detected at that point</div>
                <div>• <strong style={{ color: '#fb923c' }}>◆ Amber diamond</strong> = annotated point — hover to read the note you added when logging</div>
                <div>• <strong style={{ color: 'var(--text-3)' }}>╌╌ Dashed line</strong> = your target value</div>
                <div>• Use the <strong style={{ color: 'var(--text-1)' }}>7d / 30d / 90d</strong> toggle to change the time window shown</div>
              </div>
            </div>
            <div>
              <div className="font-bold mb-2 uppercase tracking-wide text-[10px]" style={{ color: 'var(--text-3)' }}>SPC Detail — expanded view</div>
              <div className="space-y-1.5">
                <div>Click <strong style={{ color: 'var(--text-1)' }}>"View SPC Detail"</strong> below the chart to expand the full statistical view.</div>
                <div>• <strong style={{ color: '#60a5fa' }}>X̄ (Centre Line)</strong> = the average of all measurements — where the process normally sits</div>
                <div>• <strong style={{ color: '#f87171' }}>UCL</strong> = Upper Control Limit — highest value expected from normal variation (X̄ + 3σ)</div>
                <div>• <strong style={{ color: '#f87171' }}>LCL</strong> = Lower Control Limit — lowest value expected (X̄ − 3σ)</div>
                <div>• Points outside UCL/LCL are signals — statistically unusual, not just noise</div>
              </div>
            </div>
            <div>
              <div className="font-bold mb-2 uppercase tracking-wide text-[10px]" style={{ color: 'var(--text-3)' }}>Moving Range Chart</div>
              <div className="space-y-1.5">
                <div>Shows <strong style={{ color: 'var(--text-1)' }}>day-to-day variation</strong> — how much the metric jumps between consecutive readings.</div>
                <div>• Each bar = |today's value − yesterday's value|</div>
                <div>• A spike = an unusually large jump between two days — worth investigating what changed</div>
                <div>• <strong style={{ color: '#a78bfa' }}>R̄</strong> = average daily swing across all your data</div>
              </div>
            </div>
            <div>
              <div className="font-bold mb-2 uppercase tracking-wide text-[10px]" style={{ color: 'var(--text-3)' }}>What does a Signal mean?</div>
              <div className="space-y-1.5">
                <div>A signal does <strong style={{ color: 'var(--text-1)' }}>NOT</strong> automatically mean something went wrong. It means something <strong style={{ color: '#E8820C' }}>CHANGED</strong> — the process behaved differently in a way that can't be explained by normal day-to-day variation.</div>
                <div className="mt-1.5">Investigate: Did headcount or staffing change? New process, equipment, or SOP? Different shift pattern? External factor? Find the root cause — then either <strong style={{ color: '#4ade80' }}>fix it</strong> (if bad) or <strong style={{ color: '#4ade80' }}>replicate it everywhere</strong> (if good).</div>
              </div>
              <div className="font-bold mt-3 mb-1.5 uppercase tracking-wide text-[10px]" style={{ color: 'var(--text-3)' }}>Process Sigma (σ)</div>
              <div>How much the process naturally varies. Lower σ = more consistent. Calculated from average moving range ÷ 1.128.</div>
            </div>
          </div>
        </div>
      )}

      {/* Main chart + right panel */}
      <div className="grid grid-cols-3 gap-5 items-start">
        {/* Charts */}
        <div className="col-span-2 space-y-4">

          {/* Early warning banner */}
          {earlyWarning && (
            <div className="rounded-xl px-4 py-3 text-sm font-medium"
              style={{ background: 'rgba(232,130,12,0.1)', color: '#fb923c', border: '1px solid rgba(232,130,12,0.25)' }}>
              ⚠ Trending toward signal — last 3 readings are {earlyWarning.direction}. No action needed yet, but monitor closely.
            </div>
          )}

          {/* Log KPI inline */}
          <div className="card p-4 space-y-3" style={{ position: 'relative' }}>
            <PresentationHotspot id="data-log" demoMode={demoMode} />
            {/* Mode toggle */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>Log {metric?.label}</span>
              <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border2)' }}>
                {['daily', 'shift'].map(mode => (
                  <button key={mode} type="button" onClick={() => setLogMode(mode)}
                    className="px-3 py-1.5 text-xs font-semibold capitalize transition-all"
                    style={{
                      background: logMode === mode ? '#E8820C' : 'var(--bg-input)',
                      color: logMode === mode ? '#fff' : 'var(--text-3)',
                    }}>
                    {mode === 'daily' ? 'Daily' : 'By Shift'}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleLogKpi} className="space-y-3">
              {logMode === 'daily' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <input value={logVal} onChange={e => setLogVal(e.target.value)} type="number" step="any"
                      placeholder={`Value (target ${metric?.target}${metric?.unit})`}
                      className="flex-1 text-sm rounded-xl px-3 py-2 border"
                      style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
                    <input value={logDate} onChange={e => setLogDate(e.target.value)} type="date"
                      className="text-sm rounded-xl px-3 py-2 border"
                      style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
                    <button type="submit" disabled={!logVal || logging}
                      className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                      style={{ background: '#E8820C' }}>
                      {logging ? 'Saving…' : 'Log'}
                    </button>
                  </div>
                  <input value={logAnnotation} onChange={e => setLogAnnotation(e.target.value)}
                    placeholder="Note (optional) — shown as ◆ marker on chart"
                    className="w-full text-sm rounded-xl px-3 py-2 border"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'am', label: 'AM Shift' },
                      { key: 'pm', label: 'PM Shift' },
                      { key: 'night', label: 'Night Shift' },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{label}</label>
                        <input
                          value={shiftVals[key]}
                          onChange={e => setShiftVals(v => ({ ...v, [key]: e.target.value }))}
                          type="number" step="any"
                          placeholder={`${metric?.target}${metric?.unit}`}
                          className="w-full text-sm rounded-xl px-3 py-2 border"
                          style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <input value={logDate} onChange={e => setLogDate(e.target.value)} type="date"
                      className="text-sm rounded-xl px-3 py-2 border"
                      style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
                    {(shiftVals.am || shiftVals.pm || shiftVals.night) && (
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                        Avg: <strong style={{ color: 'var(--text-1)' }}>
                          {(
                            [shiftVals.am, shiftVals.pm, shiftVals.night]
                              .filter(v => v !== '')
                              .reduce((s, v) => s + parseFloat(v), 0) /
                            [shiftVals.am, shiftVals.pm, shiftVals.night].filter(v => v !== '').length
                          ).toFixed(2)}
                          {metric?.unit}
                        </strong> will be logged
                      </span>
                    )}
                    <button type="submit"
                      disabled={!shiftVals.am && !shiftVals.pm && !shiftVals.night || logging}
                      className="ml-auto px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                      style={{ background: '#E8820C' }}>
                      {logging ? 'Saving…' : 'Log Avg'}
                    </button>
                  </div>
                </div>
              )}
            </form>

            {/* AI commentary banner */}
            {commentaryVisible && (
              <div className="rounded-xl px-4 py-2.5 text-xs leading-relaxed transition-all"
                style={{ background: 'rgba(59,127,222,0.08)', color: '#93c5fd', border: '1px solid rgba(59,127,222,0.2)' }}>
                {commentary || <span style={{ color: 'rgba(147,197,253,0.5)' }}>Generating insight…</span>}
              </div>
            )}
          </div>

          {/* ── Layer 1: Trend Chart (always visible) ─────────────────────── */}
          <div className="card p-5" style={{ position: 'relative' }}>
            <PresentationHotspot id="data-chart" demoMode={demoMode} />

            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--text-1)' }}>{metric?.label} — Trend</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {filteredChartData.length} points shown · Target: {metric?.target}{metric?.unit}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Signal badge */}
                {signalCountInWindow > 0
                  ? <span className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>⚠ {signalCountInWindow} signal{signalCountInWindow > 1 ? 's' : ''} in this period</span>
                  : filteredChartData.length > 0 && <span className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>✓ No signals</span>
                }
                {/* Time window toggle */}
                <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                  {[7, 30, 90].map(w => (
                    <button key={w} onClick={() => setTimeWindow(w)}
                      className="px-3 py-1.5 text-xs font-semibold transition-all"
                      style={{
                        background: timeWindow === w ? 'rgba(255,255,255,0.1)' : 'transparent',
                        color: timeWindow === w ? 'var(--text-1)' : 'var(--text-3)',
                      }}>
                      {w}d
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart area */}
            {filteredChartData.length < 2 ? (
              <div className="flex flex-col items-center justify-center h-48" style={{ color: 'var(--text-3)' }}>
                <span className="text-5xl mb-3">▲</span>
                <span className="text-sm">Log {Math.max(0, 2 - metricData.length)} more point{metricData.length === 1 ? '' : 's'} to see chart</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={filteredChartData} margin={{ top: 12, right: 56, left: 0, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
                  <XAxis dataKey="date" tick={{ ...TICK, fontSize: 10 }} axisLine={false} tickLine={false}
                    interval={filteredChartData.length > 14 ? Math.floor(filteredChartData.length / 7) : 0}
                    angle={filteredChartData.length > 20 ? -45 : 0}
                    textAnchor={filteredChartData.length > 20 ? 'end' : 'middle'}
                    height={filteredChartData.length > 20 ? 36 : 20} />
                  <YAxis tick={TICK} axisLine={false} tickLine={false} width={48} domain={layer1Domain} />
                  <Tooltip content={<ChartTooltip metric={metric} />} />
                  {/* Target reference line */}
                  <ReferenceLine y={metric?.target} stroke="#6b7280" strokeDasharray="8 4" strokeWidth={1.5}
                    label={{ value: `Target: ${metric?.target}`, position: 'right', fontSize: 10, fill: '#9ca3af' }} />
                  {/* Main value line */}
                  <Line type="monotone" dataKey="value" stroke={trendColor} strokeWidth={2.5}
                    dot={<Layer1SignalDot />}
                    activeDot={{ r: 5, fill: trendColor, stroke: '#161A26', strokeWidth: 2 }}
                    connectNulls />
                  {/* Annotation layer (rendered as a second line with custom dots only) */}
                  <Line type="monotone" dataKey="value" stroke="transparent" strokeWidth={0}
                    dot={<Layer1AnnotationDot />} activeDot={false} legendType="none" />
                </ComposedChart>
              </ResponsiveContainer>
            )}

            {/* Legend row */}
            <div className="flex items-center justify-center gap-5 mt-2 flex-wrap"
              style={{ fontSize: 11, color: 'var(--text-3)' }}>
              <span className="flex items-center gap-1.5">
                <span style={{ display: 'inline-block', width: 20, height: 2, background: trendColor, borderRadius: 1 }} />
                Value
              </span>
              <span className="flex items-center gap-1.5">
                <span style={{ display: 'inline-block', width: 20, height: 0, borderTop: '2px dashed #6b7280' }} />
                Target
              </span>
              <span className="flex items-center gap-1.5">
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f87171' }} />
                <span>Signal point — statistically significant change detected</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span style={{ color: '#fb923c', fontSize: 12 }}>◆</span>
                <span>Annotated — hover to read note</span>
              </span>
            </div>

            {/* AI summary */}
            {chartSummary && (
              <p className="text-center mt-2" style={{ fontSize: 11, color: 'var(--text-2)', fontStyle: 'italic' }}>
                {chartSummary}
              </p>
            )}

            {/* SPC toggle */}
            <div className="flex justify-center mt-3">
              <button onClick={() => setSpcExpanded(e => !e)}
                style={{ fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
                {spcExpanded ? '▾ Hide SPC Detail' : '▸ View SPC Detail'}
              </button>
            </div>
          </div>

          {/* ── Layer 2: SPC Detail (collapsible) ────────────────────────── */}
          {spcExpanded && (
            <div className="card p-5 space-y-4">
              {/* SPC explanation header */}
              <div style={{ fontSize: 12, color: 'var(--text-2)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                <div className="font-semibold mb-1" style={{ color: 'var(--text-1)' }}>Statistical Process Control — I-MR Chart</div>
                Points outside the red control limits (UCL/LCL) indicate a statistically significant change. These are called signals and require investigation.
              </div>

              {/* Individuals chart header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{metric?.label} — Individuals (I) Chart</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                    {spc ? `X̄ = ${spc.xBar.toFixed(2)} · UCL = ${spc.ucl.toFixed(2)} · LCL = ${Math.max(spc.lcl, 0).toFixed(2)} · σ = ${spc.sigma.toFixed(3)}` : 'Need 2+ data points'}
                  </p>
                </div>
                {spc?.hasSignal && <span className="status-pill status-red">⚠ Special cause signal</span>}
              </div>

              {metricData.length < 2 ? (
                <div className="flex items-center justify-center h-32" style={{ color: 'var(--text-3)', fontSize: 13 }}>
                  Log {Math.max(0, 2 - metricData.length)} more point{metricData.length === 1 ? '' : 's'} to see chart
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={chartData} margin={{ top: 8, right: 56, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
                    <XAxis dataKey="date" tick={TICK} axisLine={false} tickLine={false} />
                    <YAxis tick={TICK} axisLine={false} tickLine={false} width={48}
                      domain={(() => {
                        if (!chartData.length) return ['auto', 'auto']
                        const vals = chartData.map(d => d.value)
                        const mn = Math.min(...vals); const mx = Math.max(...vals)
                        let r = mx - mn; if (r < mx * 0.02) r = mx * 0.02
                        return [mn - r * 0.1, mx + r * 0.1]
                      })()} />
                    <Tooltip content={<ChartTooltip metric={metric} />} />
                    <ReferenceLine y={spc?.ucl} stroke="#DC2626" strokeDasharray="5 3" strokeWidth={1.5}
                      label={{ value: `UCL ${spc?.ucl.toFixed(1)}`, position: 'right', fontSize: 10, fill: '#f87171' }} />
                    <ReferenceLine y={spc?.xBar} stroke={metric?.color} strokeWidth={1.5}
                      label={{ value: `X̄ ${spc?.xBar.toFixed(1)}`, position: 'right', fontSize: 10, fill: metric?.color }} />
                    <ReferenceLine y={Math.max(spc?.lcl || 0, 0)} stroke="#DC2626" strokeDasharray="5 3" strokeWidth={1.5}
                      label={{ value: `LCL ${Math.max(spc?.lcl || 0, 0).toFixed(1)}`, position: 'right', fontSize: 10, fill: '#f87171' }} />
                    <ReferenceLine y={metric?.target} stroke="#4ade80" strokeDasharray="8 4" strokeWidth={1.5}
                      label={{ value: `Target ${metric?.target}`, position: 'right', fontSize: 10, fill: '#4ade80' }} />
                    <Area type="monotone" dataKey="value" stroke={metric?.color} strokeWidth={2.5}
                      fill={metric?.color} fillOpacity={0.06}
                      dot={<NormalDot fill={metric?.color} />} activeDot={false} />
                    <Scatter dataKey="value" shape={<SignalDot />} />
                    <Scatter dataKey="value" shape={<AnnotationDot />} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}

              {/* MR chart */}
              {mrData.length > 0 && (
                <>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', paddingTop: 4 }}>
                    <span className="font-semibold" style={{ color: 'var(--text-1)' }}>Moving Range</span> — measures day-to-day variation. Spikes indicate unusual shifts between consecutive readings.
                    <span className="ml-3 text-xs" style={{ color: 'var(--text-3)' }}>R̄ = {spc?.rBar.toFixed(2)} · UCL<sub>MR</sub> = {spc?.uclMR.toFixed(2)}</span>
                  </div>
                  <ResponsiveContainer width="100%" height={150}>
                    <ComposedChart data={mrData} margin={{ top: 8, right: 56, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
                      <XAxis dataKey="date" tick={TICK} axisLine={false} tickLine={false} />
                      <YAxis tick={TICK} axisLine={false} tickLine={false} width={48} />
                      <Tooltip contentStyle={TT} />
                      <ReferenceLine y={spc?.uclMR} stroke="#DC2626" strokeDasharray="5 3" strokeWidth={1.5}
                        label={{ value: `UCL ${spc?.uclMR.toFixed(1)}`, position: 'right', fontSize: 10, fill: '#f87171' }} />
                      <ReferenceLine y={spc?.rBar} stroke="#7C3AED" strokeWidth={1.5}
                        label={{ value: `R̄ ${spc?.rBar.toFixed(1)}`, position: 'right', fontSize: 10, fill: '#a78bfa' }} />
                      <Area type="monotone" dataKey="mr" stroke="#7C3AED" strokeWidth={2}
                        fill="#7C3AED" fillOpacity={0.07}
                        dot={{ r: 3, fill: '#7C3AED', stroke: '#161A26', strokeWidth: 2 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {interpretation && (
            <div className="card p-4 border"
              style={{
                borderColor: interpretation.type === 'signal' ? 'rgba(220,38,38,0.25)' : 'rgba(59,127,222,0.25)',
                background:  interpretation.type === 'signal' ? 'rgba(220,38,38,0.06)' : 'rgba(59,127,222,0.06)',
              }}>
              <div className="font-semibold text-sm mb-2"
                style={{ color: interpretation.type === 'signal' ? '#f87171' : '#60a5fa' }}>
                {interpretation.title}
              </div>
              <div className="text-xs leading-relaxed"
                style={{ color: interpretation.type === 'signal' ? '#fca5a5' : '#93c5fd' }}>
                {interpretation.text}
              </div>
              {interpretation.type === 'signal' && (
                <button onClick={() => setShowGlossary(true)}
                  className="mt-3 w-full py-2 rounded-lg text-xs font-semibold border"
                  style={{ color: '#fb923c', borderColor: 'rgba(232,130,12,0.3)' }}>
                  ? What to do about a signal
                </button>
              )}
            </div>
          )}

          {/* Tab bar */}
          {metricData.length > 0 && (
            <div className="card overflow-hidden">
              <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
                {[
                  { key: 'limits', label: 'Control Limits' },
                  { key: 'data',   label: 'Data' },
                  { key: 'benchmark', label: 'Benchmark' },
                ].map(tab => (
                  <button key={tab.key} onClick={() => setRightTab(tab.key)}
                    className="flex-1 py-2.5 text-xs font-semibold transition-all"
                    style={{
                      color: rightTab === tab.key ? 'var(--text-1)' : 'var(--text-3)',
                      borderBottom: rightTab === tab.key ? '2px solid #E8820C' : '2px solid transparent',
                      background: 'transparent',
                    }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Control Limits tab */}
              {rightTab === 'limits' && spc && (
                <div className="p-4 space-y-2">
                  {[
                    { label: 'Centre Line (X̄)', value: spc.xBar.toFixed(3),                    color: metric?.color },
                    { label: 'Upper Control Limit', value: spc.ucl.toFixed(3),                  color: '#f87171' },
                    { label: 'Lower Control Limit', value: Math.max(spc.lcl, 0).toFixed(3),     color: '#f87171' },
                    { label: 'Avg Moving Range',    value: spc.rBar.toFixed(3),                  color: '#a78bfa' },
                    { label: 'Process Sigma (σ)',   value: spc.sigma.toFixed(4),                 color: 'var(--text-3)' },
                    { label: 'Signal points',       value: spc.signals.filter(Boolean).length,   color: spc.hasSignal ? '#f87171' : '#4ade80' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>{row.label}</span>
                      <span className="text-xs font-bold" style={{ color: row.color }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Data tab */}
              {rightTab === 'data' && (
                <>
                  <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>{metric?.label} · {metricData.length} pts</span>
                  </div>
                  <div className="overflow-y-auto max-h-72">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0" style={{ background: 'var(--bg-input)' }}>
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-3)' }}>Date</th>
                          <th className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--text-3)' }}>Value</th>
                          <th className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--text-3)' }}>vs Target</th>
                          <th className="px-3 py-2 text-center font-semibold" style={{ color: 'var(--text-3)' }}>Sig</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...metricData].reverse().map((d, i) => {
                          const diff = ((d.value - metric.target) / metric.target * 100)
                          return (
                            <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                              <td className="px-3 py-2" style={{ color: 'var(--text-3)' }}>{d.date}</td>
                              <td className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--text-1)' }}>{d.value}{metric?.unit}</td>
                              <td className="px-3 py-2 text-right font-semibold" style={{ color: diff >= 0 ? '#4ade80' : '#f87171' }}>
                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                              </td>
                              <td className="px-3 py-2 text-center">
                                {d.signal ? <span style={{ color: '#f87171' }}>●</span> : <span style={{ color: '#4ade80' }}>✓</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Benchmark tab */}
              {rightTab === 'benchmark' && benchmarks && (
                <div className="p-4 space-y-4">
                  {/* Week-on-week */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Week on Week</div>
                    <div className="space-y-2">
                      {(() => {
                        const chg = pctChange(benchmarks.avg7, benchmarks.avgP7)
                        const good = metric?.higher ? (chg !== null && chg >= 0) : (chg !== null && chg <= 0)
                        const chgColor = chg === null ? 'var(--text-3)' : good ? '#4ade80' : '#f87171'
                        return (
                          <div className="flex items-center justify-between">
                            <span className="text-xs" style={{ color: 'var(--text-3)' }}>Last 7 days avg</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold" style={{ color: 'var(--text-1)' }}>
                                {benchmarks.avg7 != null ? benchmarks.avg7.toFixed(2) : '—'}{metric?.unit}
                              </span>
                              {chg !== null && (
                                <span className="text-[10px] font-semibold" style={{ color: chgColor }}>
                                  {chg >= 0 ? '▲' : '▼'} {Math.abs(chg).toFixed(1)}%
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                      <div className="flex items-center justify-between">
                        <span className="text-xs" style={{ color: 'var(--text-3)' }}>Prior 7 days avg</span>
                        <span className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                          {benchmarks.avgP7 != null ? benchmarks.avgP7.toFixed(2) : '—'}{metric?.unit}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t" style={{ borderColor: 'var(--border)' }} />

                  {/* Month-on-month */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Month on Month</div>
                    <div className="space-y-2">
                      {(() => {
                        const chg = pctChange(benchmarks.avg30, benchmarks.avgP30)
                        const good = metric?.higher ? (chg !== null && chg >= 0) : (chg !== null && chg <= 0)
                        const chgColor = chg === null ? 'var(--text-3)' : good ? '#4ade80' : '#f87171'
                        return (
                          <div className="flex items-center justify-between">
                            <span className="text-xs" style={{ color: 'var(--text-3)' }}>Last 30 days avg</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold" style={{ color: 'var(--text-1)' }}>
                                {benchmarks.avg30 != null ? benchmarks.avg30.toFixed(2) : '—'}{metric?.unit}
                              </span>
                              {chg !== null && (
                                <span className="text-[10px] font-semibold" style={{ color: chgColor }}>
                                  {chg >= 0 ? '▲' : '▼'} {Math.abs(chg).toFixed(1)}%
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                      <div className="flex items-center justify-between">
                        <span className="text-xs" style={{ color: 'var(--text-3)' }}>Prior 30 days avg</span>
                        <span className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                          {benchmarks.avgP30 != null ? benchmarks.avgP30.toFixed(2) : '—'}{metric?.unit}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t" style={{ borderColor: 'var(--border)' }} />

                  {/* All-time records */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>All-Time</div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs" style={{ color: 'var(--text-3)' }}>Best reading</span>
                        <span className="text-xs font-bold" style={{ color: '#4ade80' }}>
                          {benchmarks.best.toLocaleString()}{metric?.unit}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs" style={{ color: 'var(--text-3)' }}>Worst reading</span>
                        <span className="text-xs font-bold" style={{ color: '#f87171' }}>
                          {benchmarks.worst.toLocaleString()}{metric?.unit}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs" style={{ color: 'var(--text-3)' }}>On/at target</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold" style={{ color: benchmarks.pctOnTarget >= 80 ? '#4ade80' : benchmarks.pctOnTarget >= 50 ? '#fb923c' : '#f87171' }}>
                            {benchmarks.pctOnTarget.toFixed(0)}%
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>of {benchmarks.total} pts</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Control limits standalone (when no data yet for tab panel) */}
          {metricData.length === 0 && spc && (
            <div className="card p-4">
              <h4 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-1)' }}>Control Limits</h4>
              <div className="space-y-2">
                {[
                  { label: 'Centre Line (X̄)', value: spc.xBar.toFixed(3),            color: metric?.color },
                  { label: 'Upper Control Limit', value: spc.ucl.toFixed(3),          color: '#f87171' },
                  { label: 'Lower Control Limit', value: Math.max(spc.lcl, 0).toFixed(3), color: '#f87171' },
                  { label: 'Avg Moving Range',   value: spc.rBar.toFixed(3),           color: '#a78bfa' },
                  { label: 'Process Sigma (σ)',  value: spc.sigma.toFixed(4),          color: 'var(--text-3)' },
                  { label: 'Signal points',      value: spc.signals.filter(Boolean).length, color: spc.hasSignal ? '#f87171' : '#4ade80' },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>{row.label}</span>
                    <span className="text-xs font-bold" style={{ color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      </>}

      </>}
    </div>
  )
}
