import { useState, useEffect, useRef } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

const METRIC_CONFIG = {
  uph:      { label: 'UPH',           unit: '',   higherIsBetter: true,  target: 100 },
  accuracy: { label: 'Pick Accuracy', unit: '%',  higherIsBetter: true,  target: 99.5 },
  dpmo:     { label: 'DPMO',          unit: '',   higherIsBetter: false, target: 500 },
  dts:      { label: 'DTS',           unit: '%',  higherIsBetter: true,  target: 98 },
}

const RAG_CONFIG = {
  green: {
    color: '#22C55E', label: 'On Target',
    glow: 'rgba(34,197,94,0.18)', bg: 'rgba(34,197,94,0.09)', border: 'rgba(34,197,94,0.25)',
    gradient: 'linear-gradient(135deg, #ffffff 0%, #22C55E 100%)',
  },
  amber: {
    color: '#F59E0B', label: 'At Risk',
    glow: 'rgba(245,158,11,0.18)', bg: 'rgba(245,158,11,0.09)', border: 'rgba(245,158,11,0.25)',
    gradient: 'linear-gradient(135deg, #ffffff 0%, #F59E0B 100%)',
  },
  red: {
    color: '#EF4444', label: 'Off Target',
    glow: 'rgba(239,68,68,0.18)', bg: 'rgba(239,68,68,0.09)', border: 'rgba(239,68,68,0.25)',
    gradient: 'linear-gradient(135deg, #ffffff 0%, #EF4444 100%)',
  },
  grey: {
    color: '#94A3B8', label: 'No Data',
    glow: 'rgba(148,163,184,0.1)', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.18)',
    gradient: 'linear-gradient(135deg, #ffffff 0%, #94A3B8 100%)',
  },
}

function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0)
  const frameRef = useRef(null)
  useEffect(() => {
    if (target === undefined || target === null) return
    const start = performance.now()
    function tick(now) {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(target * eased)
      if (p < 1) frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration])
  return val
}

export default function KPICard({ metricId, data = [], latest, onClick }) {
  const cfg = METRIC_CONFIG[metricId] || { label: metricId, unit: '', higherIsBetter: true, target: null }
  const target = cfg.target
  const val = latest?.value
  const [hovered, setHovered] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(t)
  }, [])

  let rag = 'grey'
  if (val !== undefined && target !== null) {
    const pct = cfg.higherIsBetter ? val / target : target / val
    if (pct >= 0.98) rag = 'green'
    else if (pct >= 0.93) rag = 'amber'
    else rag = 'red'
  }

  const ragCfg = RAG_CONFIG[rag]
  const chartData = data.slice(-12).map((d, i) => ({ i, v: d.value }))
  const hasSignal = data.some(d => d.signal)
  const diff = val !== undefined && target ? ((val - target) / target * 100) : null
  const diffText = diff !== null
    ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}% vs target`
    : 'No data'

  const animatedVal = useCountUp(val, 900)
  const displayVal = val !== undefined
    ? (Number.isInteger(val) ? Math.round(animatedVal).toLocaleString() : animatedVal.toFixed(1))
    : '—'

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="text-left w-full"
      style={{
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${hovered ? ragCfg.border : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 16,
        padding: '20px',
        transition: 'all 220ms cubic-bezier(0.34,1.56,0.64,1)',
        transform: mounted ? (hovered ? 'translateY(-3px) scale(1.01)' : 'translateY(0) scale(1)') : 'translateY(6px) scale(0.97)',
        opacity: mounted ? 1 : 0,
        boxShadow: hovered
          ? `0 12px 40px ${ragCfg.glow}, 0 0 0 1px ${ragCfg.border}`
          : '0 4px 20px rgba(0,0,0,0.35)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.1em', color: '#64748B',
        }}>
          {cfg.label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {hasSignal && (
            <span className="signal-dot">
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', display: 'block', position: 'relative', zIndex: 10 }} />
            </span>
          )}
          <span style={{
            fontSize: 10, fontWeight: 700,
            padding: '3px 9px', borderRadius: 999,
            background: ragCfg.bg, color: ragCfg.color,
            border: `1px solid ${ragCfg.border}`,
            letterSpacing: '0.04em',
          }}>
            {ragCfg.label}
          </span>
        </div>
      </div>

      {/* Value row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            fontSize: 44, fontWeight: 800, lineHeight: 1,
            letterSpacing: '-0.03em',
            background: ragCfg.gradient,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {displayVal}
            {cfg.unit && val !== undefined && (
              <span style={{ fontSize: 20, fontWeight: 500, opacity: 0.65 }}>{cfg.unit}</span>
            )}
          </div>
          <div style={{
            fontSize: 11, marginTop: 5, fontWeight: 600,
            color: diff !== null
              ? (diff > 0 === cfg.higherIsBetter ? '#22C55E' : '#EF4444')
              : '#475569',
          }}>
            {diffText}
          </div>
        </div>

        {chartData.length > 1 && (
          <div style={{ width: 72, height: 40, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line
                  type="monotone" dataKey="v"
                  stroke={ragCfg.color} strokeWidth={2}
                  dot={false} isAnimationActive={mounted}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Target footer */}
      {target !== null && (
        <div style={{
          marginTop: 14,
          paddingTop: 10,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          fontSize: 10, color: '#475569', fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>Target: {target}{cfg.unit}</span>
          {rag !== 'grey' && (
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: ragCfg.color,
              boxShadow: `0 0 6px ${ragCfg.color}`,
              display: 'inline-block',
            }} />
          )}
        </div>
      )}
    </button>
  )
}
