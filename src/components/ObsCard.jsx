const WASTE_COLORS = {
  Transport:       '#3B7FDE',
  Inventory:       '#7C3AED',
  Motion:          '#16A34A',
  Waiting:         '#E8820C',
  Overproduction:  '#DC2626',
  Overprocessing:  '#0891B2',
  Defects:         '#B91C1C',
  Skills:          '#059669',
}

const SEV_LABELS = { 1: 'Low', 2: 'Med', 3: 'High' }
const SEV_COLORS = { 1: '#4ade80', 2: '#fb923c', 3: '#f87171' }

export default function ObsCard({ obs, onDelete, onSendAsIdea, sentAsIdea }) {
  const wasteColor = WASTE_COLORS[obs.waste_type] || '#6B7280'
  const sevColor   = SEV_COLORS[obs.severity] || '#9ca3af'

  const time = obs.timestamp
    ? new Date(obs.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : obs.date

  return (
    <div className="card p-3 group relative">
      <div className="flex items-start gap-2 mb-2">
        <span className="status-pill text-xs" style={{ background: `${wasteColor}18`, color: wasteColor }}>
          {obs.waste_type}
        </span>
        <span className="status-pill text-xs" style={{ background: `${sevColor}18`, color: sevColor }}>
          {SEV_LABELS[obs.severity] || 'Med'}
        </span>
        <span className="status-pill status-grey text-xs ml-auto">{obs.area}</span>
        {onDelete && (
          <button
            onClick={() => onDelete(obs.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-red-500/20"
            style={{ color: '#f87171' }}
            title="Delete observation">
            ✕
          </button>
        )}
      </div>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-1)' }}>{obs.text}</p>
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-xs" style={{ color: 'var(--text-3)' }}>{time}</p>
        {sentAsIdea ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>
            → Idea ✓
          </span>
        ) : onSendAsIdea ? (
          <button
            onClick={() => onSendAsIdea(obs)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(232,130,12,0.1)', color: '#E8820C' }}
            title="Send to portfolio as idea">
            → Idea
          </button>
        ) : null}
      </div>
    </div>
  )
}
