import { LineChart, Line, ResponsiveContainer } from 'recharts'

const METRIC_CONFIG = {
  uph:      { label: 'UPH',           unit: '',   higherIsBetter: true,  target: 100 },
  accuracy: { label: 'Pick Accuracy', unit: '%',  higherIsBetter: true,  target: 99.5 },
  dpmo:     { label: 'DPMO',          unit: '',   higherIsBetter: false, target: 500 },
  dts:      { label: 'DTS',           unit: '%',  higherIsBetter: true,  target: 98 },
}

export default function KPICard({ metricId, data = [], latest, onClick }) {
  const cfg = METRIC_CONFIG[metricId] || { label: metricId, unit: '', higherIsBetter: true, target: null }
  const target = cfg.target
  const val = latest?.value

  let rag = 'grey'
  if (val !== undefined && target !== null) {
    const pct = cfg.higherIsBetter ? val / target : target / val
    if (pct >= 0.98) rag = 'green'
    else if (pct >= 0.93) rag = 'amber'
    else rag = 'red'
  }

  const ragColor = { green: '#16A34A', amber: '#E8820C', red: '#DC2626', grey: '#9CA3AF' }[rag]
  const ragLabel = { green: 'On Target', amber: 'Watch', red: 'Off Target', grey: 'No Data' }[rag]

  const chartData = data.slice(-12).map((d, i) => ({ i, v: d.value }))
  const hasSignal = data.some(d => d.signal)

  const diff = val !== undefined && target ? ((val - target) / target * 100) : null
  const diffText = diff !== null
    ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}% vs target`
    : 'No data'

  return (
    <button
      onClick={onClick}
      className="card p-4 text-left w-full hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{cfg.label}</span>
        <div className="flex items-center gap-1.5">
          {hasSignal && (
            <span className="signal-dot">
              <span className="w-2 h-2 rounded-full bg-red-500 relative z-10 block" />
            </span>
          )}
          <span className="status-pill" style={{ background: `${ragColor}18`, color: ragColor }}>
            {ragLabel}
          </span>
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="kpi-number" style={{ color: ragColor }}>
            {val !== undefined ? val.toLocaleString() : '—'}
            <span className="text-lg font-normal ml-0.5 text-gray-400">{cfg.unit}</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">{diffText}</div>
        </div>

        {chartData.length > 1 && (
          <div className="w-20 h-10">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={ragColor}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {target !== null && (
        <div className="text-xs text-gray-400 mt-1">Target: {target}{cfg.unit}</div>
      )}
    </button>
  )
}
