import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import { calcSPC } from '../lib/spc.js'
import { LineChart, Line, ResponsiveContainer, ReferenceLine, Tooltip } from 'recharts'

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
const DMAIC = ['Identify', 'Define', 'Measure', 'Analyse', 'Improve', 'Control']
const TODAY = new Date().toISOString().split('T')[0]

function KpiTile({ metric, data, latest }) {
  const val = latest?.value
  const { target, higher, unit } = metric
  let rag = 'grey'
  if (val !== undefined) {
    const r = higher ? val / target : target / val
    rag = r >= 0.98 ? 'green' : r >= 0.93 ? 'amber' : 'red'
  }
  const color = { green: '#4ade80', amber: '#fb923c', red: '#f87171', grey: '#6b7280' }[rag]
  const diff  = val !== undefined ? ((val - target) / target * 100) : null
  const chartData = data.slice(-14).map((d, i) => ({ i, v: d.value }))
  const spc = calcSPC(data.map(d => d.value))

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>{metric.label}</div>
          <div className="flex items-baseline gap-1">
            <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1, color }}>
              {val !== undefined ? val.toLocaleString() : '—'}
            </span>
            <span className="text-sm font-normal" style={{ color: 'var(--text-3)' }}>{unit}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {spc?.hasSignal && (
            <span className="signal-dot"><span className="w-2 h-2 rounded-full bg-red-500 relative z-10 block" /></span>
          )}
          {diff !== null && (
            <span className="text-xs font-bold" style={{ color }}>{diff > 0 ? '+' : ''}{diff.toFixed(1)}%</span>
          )}
        </div>
      </div>
      {chartData.length > 1 && (
        <div className="h-12 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              {spc && <ReferenceLine y={spc.ucl} stroke="rgba(220,38,38,0.3)" strokeDasharray="3 2" strokeWidth={1} />}
              {spc && <ReferenceLine y={Math.max(spc.lcl, 0)} stroke="rgba(220,38,38,0.3)" strokeDasharray="3 2" strokeWidth={1} />}
              <ReferenceLine y={target} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 3" strokeWidth={1} />
              <Tooltip
                contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: '#1C2035', color: '#E4E6F0', padding: '3px 7px' }}
                formatter={v => [`${v}${unit}`, metric.label]} labelFormatter={() => ''} />
              <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2}
                dot={false} activeDot={{ r: 3, fill: color, stroke: '#161A26', strokeWidth: 1.5 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="mt-2 text-[10px]" style={{ color: 'var(--text-3)' }}>
        Target {target}{unit} · {data.length} pts
      </div>
    </div>
  )
}

export default function MidShiftView({ onNavigate, onOpenAgent }) {
  const [latestKpis, setLatestKpis]         = useState({})
  const [allKpis, setAllKpis]               = useState([])
  const [projects, setProjects]             = useState([])
  const [quickKpiMetric, setQuickKpiMetric] = useState('uph')
  const [quickKpiVal, setQuickKpiVal]       = useState('')
  const [quickKpiLogging, setQuickKpiLogging] = useState(false)
  const [quickKpiDone, setQuickKpiDone]     = useState(false)
  const [todayObs, setTodayObs]             = useState(0)

  useEffect(() => {
    Promise.all([
      api.getLatestKpis().catch(() => ({})),
      api.getKpis().catch(() => []),
      api.getProjects().catch(() => []),
      api.getObservations().catch(() => []),
    ]).then(([kpis, allK, ps, obs]) => {
      setLatestKpis(kpis)
      setAllKpis(allK)
      setProjects(ps.filter(p => p.stage !== 'Closed'))
      setTodayObs(obs.filter(o => o.date === TODAY).length)
    })
  }, [])

  async function logQuickKpi() {
    if (!quickKpiVal || quickKpiLogging) return
    setQuickKpiLogging(true)
    const m = METRICS.find(x => x.id === quickKpiMetric)
    await api.addKpi({ metric_id: quickKpiMetric, metric_label: m?.label || quickKpiMetric, value: parseFloat(quickKpiVal), target: m?.target, date: TODAY }).catch(() => {})
    const [kpis, allK] = await Promise.all([api.getLatestKpis().catch(() => ({})), api.getKpis().catch(() => [])])
    setLatestKpis(kpis)
    setAllKpis(allK)
    setQuickKpiVal('')
    setQuickKpiLogging(false)
    setQuickKpiDone(true)
    setTimeout(() => setQuickKpiDone(false), 2000)
  }

  const kpiByMetric = {}
  for (const m of METRICS) {
    kpiByMetric[m.id] = allKpis.filter(k => k.metric_id === m.id).sort((a, b) => a.date.localeCompare(b.date))
  }

  const todayKpiLogged = Object.values(latestKpis).some(k => k?.date === TODAY)
  const openActions    = projects.reduce((sum, p) => sum + (p.actions?.filter(a => !a.done).length || 0), 0)
  const overdueActions = projects.flatMap(p =>
    (p.actions || []).filter(a => !a.done && a.due && a.due < TODAY).map(a => ({ ...a, project: p.title }))
  )
  const doneActions  = projects.reduce((sum, p) => sum + (p.actions?.filter(a => a.done).length || 0), 0)
  const totalActions = projects.reduce((sum, p) => sum + (p.actions?.length || 0), 0)
  const isFriday = new Date().getDay() === 5

  return (
    <div className="space-y-5 max-w-[1400px]">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-1)' }}>Mid-Shift</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {overdueActions.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border"
            style={{ background: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.2)', color: '#f87171' }}>
            ⚠ {overdueActions.length} overdue action{overdueActions.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Quick KPI log */}
      <div className="card px-4 py-3 flex items-center gap-3">
        <span className="text-xs font-semibold flex-shrink-0" style={{ color: 'var(--text-3)' }}>LOG KPI</span>
        <select value={quickKpiMetric} onChange={e => setQuickKpiMetric(e.target.value)}
          className="text-xs rounded-lg px-2 py-1.5 border flex-shrink-0"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }}>
          {METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <input value={quickKpiVal} onChange={e => setQuickKpiVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && logQuickKpi()}
          type="number" placeholder="Value"
          className="flex-1 text-xs rounded-lg px-2 py-1.5 border min-w-0"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
        <button onClick={logQuickKpi} disabled={!quickKpiVal || quickKpiLogging}
          className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40 transition-all"
          style={{ background: quickKpiDone ? 'rgba(74,222,128,0.15)' : 'rgba(59,127,222,0.15)', color: quickKpiDone ? '#4ade80' : '#60a5fa', border: `1px solid ${quickKpiDone ? 'rgba(74,222,128,0.3)' : 'rgba(59,127,222,0.25)'}` }}>
          {quickKpiDone ? '✓ Logged' : quickKpiLogging ? '…' : 'Log'}
        </button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-4">
        {METRICS.map(m => (
          <KpiTile key={m.id} metric={m} data={kpiByMetric[m.id] || []} latest={latestKpis[m.id]} />
        ))}
      </div>

      {/* Shift stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Observations',  value: todayObs,     color: todayObs > 0 ? '#4ade80' : '#f87171',         sub: 'today' },
          { label: 'KPI Status',    value: todayKpiLogged ? 'Logged' : 'Missing', color: todayKpiLogged ? '#4ade80' : '#f87171', sub: 'today' },
          { label: 'Tasks Done',    value: `${doneActions}/${totalActions}`,       color: '#60a5fa',           sub: 'across projects' },
          { label: 'Open Tasks',    value: openActions,  color: openActions > 5 ? '#f87171' : '#fb923c',       sub: 'still open' },
        ].map(s => (
          <div key={s.label} className="card rounded-xl p-4 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>{s.label}</div>
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Active Projects */}
      {projects.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: 'var(--text-1)' }}>Active Projects</h2>
            <button onClick={() => onNavigate('projects')} className="text-xs font-semibold" style={{ color: '#E8820C' }}>See all →</button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {projects.slice(0, 6).map(p => {
              const color      = STAGE_COLORS[p.stage] || '#6B7280'
              const done       = p.actions?.filter(a => a.done).length || 0
              const total      = p.actions?.length || 0
              const stageIdx   = DMAIC.indexOf(p.stage)
              return (
                <button key={p.id} onClick={() => onNavigate('projects', p)}
                  className="text-left rounded-xl px-3 py-3 transition-all border"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-sm font-semibold leading-snug" style={{ color: 'var(--text-1)' }}>{p.title}</span>
                    <span className="status-pill text-[10px] flex-shrink-0" style={{ background: `${color}18`, color }}>{p.stage}</span>
                  </div>
                  <div className="flex gap-0.5 mb-2">
                    {DMAIC.map((s, i) => (
                      <div key={s} className="flex-1 h-1 rounded-full"
                        style={{ background: i < stageIdx ? '#16A34A' : i === stageIdx ? color : 'rgba(255,255,255,0.08)' }} />
                    ))}
                  </div>
                  {total > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className="h-1 rounded-full bg-green-500" style={{ width: `${(done / total) * 100}%` }} />
                      </div>
                      <span className="text-[10px]" style={{ color: done === total ? '#4ade80' : 'var(--text-3)' }}>{done}/{total}</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Overdue details */}
      {overdueActions.length > 0 && (
        <div className="card p-5 border" style={{ borderColor: 'rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.04)' }}>
          <div className="text-xs font-bold mb-3" style={{ color: '#f87171' }}>⚠ {overdueActions.length} overdue action{overdueActions.length > 1 ? 's' : ''}</div>
          <div className="space-y-1.5">
            {overdueActions.slice(0, 5).map((a, i) => (
              <div key={i} className="text-sm flex items-center gap-2 flex-wrap">
                <span style={{ color: 'var(--text-3)' }}>{a.project}:</span>
                <span style={{ color: 'var(--text-2)' }}>{a.text}</span>
                <span style={{ color: '#f87171' }}>Due {a.due}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Before you leave */}
      <div className="card p-5">
        <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--text-1)' }}>Before You Leave</h3>
        <div className="space-y-2.5">
          {[
            !todayKpiLogged && { color: '#f87171', text: "Log today's KPIs before you go" },
            todayObs === 0  && { color: '#fb923c', text: 'No floor walk observations logged today' },
            isFriday        && { color: '#60a5fa', text: 'Friday — generate your weekly GM report' },
            openActions > 0 && { color: '#fb923c', text: `${openActions} open task${openActions !== 1 ? 's' : ''} across projects` },
            (todayKpiLogged && todayObs > 0 && openActions === 0) && { color: '#4ade80', text: 'Good shift — all logged and no open tasks' },
          ].filter(Boolean).map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--text-2)' }}>
              <span className="mt-0.5 flex-shrink-0" style={{ color: item.color }}>○</span>
              {item.text}
            </div>
          ))}
        </div>
        {isFriday && (
          <button onClick={() => onOpenAgent('gm-report', null)}
            className="mt-4 text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(156,163,175,0.1)', color: '#9ca3af' }}>
            ◉ Generate GM report
          </button>
        )}
      </div>

    </div>
  )
}
