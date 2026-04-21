import { useState } from 'react'
import {
  ComposedChart, LineChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Scatter
} from 'recharts'
import { calcSPC, interpretSignal } from '../lib/spc.js'

const METRIC_LABELS = {
  uph: 'UPH', accuracy: 'Pick Accuracy', dpmo: 'DPMO', dts: 'DTS'
}

const TICK  = { fontSize: 10, fill: '#4E5268' }
const GRID  = 'rgba(255,255,255,0.05)'

// ── helpers ──────────────────────────────────────────────────────────────────

function calcTrendColor(data, higherBetter = true) {
  if (data.length < 7) return '#60a5fa'
  const last7 = data.slice(-7)
  const avg = arr => arr.reduce((s, d) => s + d.value, 0) / arr.length
  const first3 = avg(last7.slice(0, 3))
  const last3  = avg(last7.slice(-3))
  const delta  = last3 - first3
  if (Math.abs(delta / (first3 || 1)) < 0.005) return '#60a5fa'
  const improving = higherBetter ? delta > 0 : delta < 0
  return improving ? '#4ade80' : '#f87171'
}

function generateSummary(data, label, target, higherBetter) {
  if (data.length < 2) return ''
  const latest = data[data.length - 1].value
  const first  = data[0].value
  const change = ((latest - first) / (first || 1) * 100).toFixed(1)
  const vsTarget = higherBetter
    ? (latest >= target ? 'above' : 'below')
    : (latest <= target ? 'below' : 'above')
  const trendDir = Math.abs(change) < 0.5 ? 'stable'
    : higherBetter
      ? (change > 0 ? 'improving' : 'declining')
      : (change < 0 ? 'improving' : 'worsening')
  const signals = data.filter(d => d.signal).length
  return `${label} is currently ${latest} — ${vsTarget} target — ${trendDir} ${Math.abs(change)}% over this period${signals > 0 ? `, with ${signals} signal${signals > 1 ? 's' : ''} detected` : ''}.`
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
      <div style={{ color: 'var(--text-3)', marginBottom: 3 }}>{d?.date}</div>
      <div style={{ color: 'var(--text-1)', fontWeight: 600 }}>{d?.value}</div>
      {d?.signal    && <div style={{ color: '#f87171', marginTop: 3 }}>⚠ Signal detected</div>}
      {d?.annotation && <div style={{ color: '#fb923c', marginTop: 3 }}>◆ {d.annotation}</div>}
    </div>
  )
}

function SignalDot(props) {
  const { cx, cy, payload } = props
  if (!payload?.signal) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={10} fill="rgba(220,38,38,0.15)" />
      <circle cx={cx} cy={cy} r={6}  fill="rgba(220,38,38,0.25)" />
      <circle cx={cx} cy={cy} r={4}  fill="#DC2626" />
    </g>
  )
}

function MrSignalDot(props) {
  const { cx, cy, payload } = props
  if (!payload?.signal) return null
  return <circle cx={cx} cy={cy} r={4} fill="#DC2626" />
}

// ── main component ────────────────────────────────────────────────────────────

export default function ControlChart({ metricId, data = [], height = 200, higherBetter }) {
  const [spcOpen, setSpcOpen] = useState(false)

  const label = METRIC_LABELS[metricId] || metricId || 'Metric'

  // infer higherBetter from metric if not passed
  const hb = higherBetter !== undefined ? higherBetter : metricId !== 'dpmo'

  const spc = calcSPC(data.map(d => d.value))

  if (data.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center text-sm gap-1"
        style={{ height: 100, color: 'var(--text-3)' }}>
        <span className="text-2xl">▲</span>
        <span>Log {Math.max(0, 3 - data.length)} more data point{data.length === 2 ? '' : 's'} to see chart</span>
      </div>
    )
  }

  // build chart data
  const allPoints = data.map((d, i) => ({
    date:       d.date?.slice(5) || `${i + 1}`,
    value:      d.value,
    signal:     spc?.signals?.[i] || false,
    annotation: d.annotation || null,
  }))

  const trendColor    = calcTrendColor(allPoints, hb)
  const values        = allPoints.map(d => d.value)
  const dataMin       = Math.min(...values)
  const dataMax       = Math.max(...values)
  const pad           = Math.max((dataMax - dataMin) * 0.15, dataMax * 0.005)
  const targetVal     = data[0]?.target ?? null
  const domainMin     = targetVal !== null ? Math.min(dataMin - pad, targetVal * 0.995) : dataMin - pad
  const domainMax     = targetVal !== null ? Math.max(dataMax + pad, targetVal * 1.005) : dataMax + pad
  const layer1Domain  = [+domainMin.toFixed(2), +domainMax.toFixed(2)]

  const signalCount   = allPoints.filter(d => d.signal).length
  const summary       = generateSummary(allPoints, label, targetVal ?? 0, hb)

  // MR data for SPC detail
  const mrData = spc ? data.slice(1).map((d, i) => ({
    date:   d.date?.slice(5) || `${i + 2}`,
    mr:     spc.movingRanges[i],
    signal: spc.mrSignals?.[i] || false,
  })) : []

  return (
    <div className="space-y-3">

      {/* ── Layer 1 header ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
          {label} — Trend
        </span>
        {signalCount > 0
          ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(220,38,38,0.12)', color: '#f87171' }}>⚠ {signalCount} signal{signalCount > 1 ? 's' : ''}</span>
          : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>✓ No signals</span>
        }
      </div>

      {/* ── Layer 1 chart ── */}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={allPoints} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
          <XAxis dataKey="date" tick={TICK} axisLine={false} tickLine={false}
            interval={Math.max(0, Math.floor(allPoints.length / 6) - 1)} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} width={42} domain={layer1Domain} />
          <Tooltip content={<ChartTooltip />} />
          {targetVal !== null && (
            <ReferenceLine y={targetVal} stroke="rgba(255,255,255,0.25)" strokeDasharray="5 4" strokeWidth={1.5}
              label={{ value: `Target: ${targetVal}`, position: 'right', fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} />
          )}
          <Line type="monotone" dataKey="value" stroke={trendColor} strokeWidth={2}
            dot={<SignalDot />} activeDot={{ r: 4, fill: trendColor }} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-3 text-[10px]" style={{ color: 'var(--text-3)' }}>
        <span className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: 16, height: 2, background: trendColor, borderRadius: 1 }} />
          Value
        </span>
        {targetVal !== null && (
          <span className="flex items-center gap-1">
            <span style={{ display: 'inline-block', width: 16, height: 2, background: 'rgba(255,255,255,0.25)', borderRadius: 1, borderTop: '1px dashed rgba(255,255,255,0.4)' }} />
            Target
          </span>
        )}
        <span className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#DC2626' }} />
          Signal — significant change
        </span>
        {allPoints.some(d => d.annotation) && (
          <span className="flex items-center gap-1">
            <span style={{ color: '#fb923c' }}>◆</span>
            Annotated — hover to read
          </span>
        )}
      </div>

      {/* ── Summary sentence ── */}
      {summary && (
        <p className="text-[11px] italic" style={{ color: 'var(--text-2)' }}>{summary}</p>
      )}

      {/* ── SPC Detail toggle ── */}
      <button onClick={() => setSpcOpen(o => !o)}
        className="text-[11px] hover:opacity-80 transition-opacity"
        style={{ color: 'var(--text-3)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
        {spcOpen ? '▾ Hide SPC Detail' : '▸ View SPC Detail'}
      </button>

      {/* ── Layer 2: full I-MR ── */}
      {spcOpen && spc && (
        <div className="space-y-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
            <strong style={{ color: 'var(--text-2)' }}>Statistical Process Control — I-MR Chart.</strong>{' '}
            Points outside the red control limits (UCL/LCL) are signals — statistically significant changes that can't be explained by normal variation.
          </p>

          {/* Individuals */}
          <div>
            <span className="text-[10px] font-semibold" style={{ color: 'var(--text-2)' }}>Individuals (I) Chart</span>
            <ResponsiveContainer width="100%" height={height}>
              <ComposedChart data={allPoints} margin={{ top: 8, right: 56, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
                <XAxis dataKey="date" tick={TICK} axisLine={false} tickLine={false}
                  interval={Math.max(0, Math.floor(allPoints.length / 6) - 1)} />
                <YAxis tick={TICK} axisLine={false} tickLine={false} width={42} domain={layer1Domain} />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine y={spc.ucl} stroke="#DC2626" strokeDasharray="4 3" strokeWidth={1.5}
                  label={{ value: `UCL ${spc.ucl.toFixed(1)}`, position: 'right', fontSize: 9, fill: '#f87171' }} />
                <ReferenceLine y={spc.xBar} stroke="#3B7FDE" strokeWidth={1.5}
                  label={{ value: `X̄ ${spc.xBar.toFixed(1)}`, position: 'right', fontSize: 9, fill: '#60a5fa' }} />
                <ReferenceLine y={Math.max(spc.lcl ?? 0, 0)} stroke="#DC2626" strokeDasharray="4 3" strokeWidth={1.5}
                  label={{ value: `LCL ${Math.max(spc.lcl ?? 0, 0).toFixed(1)}`, position: 'right', fontSize: 9, fill: '#f87171' }} />
                <Area type="monotone" dataKey="value" stroke="#3B7FDE" strokeWidth={2}
                  fill="#3B7FDE" fillOpacity={0.08} dot={<SignalDot />} activeDot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Moving Range */}
          {mrData.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold" style={{ color: 'var(--text-2)' }}>
                Moving Range (MR) Chart — day-to-day variation. Spikes = unusually large jump between consecutive readings.
              </span>
              <ResponsiveContainer width="100%" height={100}>
                <ComposedChart data={mrData} margin={{ top: 6, right: 56, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
                  <XAxis dataKey="date" tick={TICK} axisLine={false} tickLine={false}
                    interval={Math.max(0, Math.floor(mrData.length / 6) - 1)} />
                  <YAxis tick={TICK} axisLine={false} tickLine={false} width={42} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine y={spc.uclMR} stroke="#DC2626" strokeDasharray="4 3" strokeWidth={1.5}
                    label={{ value: `UCL ${spc.uclMR.toFixed(1)}`, position: 'right', fontSize: 9, fill: '#f87171' }} />
                  <ReferenceLine y={spc.rBar} stroke="#7C3AED" strokeWidth={1.5}
                    label={{ value: `R̄ ${spc.rBar.toFixed(1)}`, position: 'right', fontSize: 9, fill: '#a78bfa' }} />
                  <Area type="monotone" dataKey="mr" stroke="#7C3AED" strokeWidth={2}
                    fill="#7C3AED" fillOpacity={0.08}
                    dot={<MrSignalDot />} activeDot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
