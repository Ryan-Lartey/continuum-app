import { useState, useRef } from 'react'
import { api } from '../lib/api.js'

const AREAS = ['Inbound', 'Stow', 'Pick', 'Pack', 'Dispatch', 'Yard', 'Admin']
const WASTE_TYPES = ['Transport', 'Inventory', 'Motion', 'Waiting', 'Overproduction', 'Overprocessing', 'Defects', 'Skills']
const METRICS = { uph: 'UPH', accuracy: 'Pick Accuracy', dpmo: 'DPMO', dts: 'DTS' }

function parseKpiInput(text) {
  const entries = []
  const today = new Date().toISOString().split('T')[0]

  const patterns = [
    { id: 'uph', regex: /uph[\s:]+(\d+(?:\.\d+)?)/i },
    { id: 'accuracy', regex: /(?:acc(?:uracy)?|pick acc(?:uracy)?)[\s:]+(\d+(?:\.\d+)?)/i },
    { id: 'dpmo', regex: /dpmo[\s:]+(\d+(?:\.\d+)?)/i },
    { id: 'dts', regex: /dts[\s:]+(\d+(?:\.\d+)?)/i },
  ]

  for (const p of patterns) {
    const m = text.match(p.regex)
    if (m) entries.push({ metric_id: p.id, value: parseFloat(m[1]), date: today })
  }

  return entries
}

function routeInput(text) {
  const lower = text.toLowerCase()
  if (/uph|acc(?:uracy)?|dpmo|dts/i.test(text) && /\d/.test(text)) return 'kpi'
  if (AREAS.some(a => lower.includes(a.toLowerCase())) || WASTE_TYPES.some(w => lower.includes(w.toLowerCase()))) return 'observation'
  if (/tier\s*[23]|meeting|brief|prep/i.test(lower)) return 'situation-room'
  if (/report|gm\s*report|weekly/i.test(lower)) return 'gm-report'
  if (/project|dmaic|root cause|5.?why|countermeasure/i.test(lower)) return 'project-agent'
  return 'chief-of-staff'
}

export default function SmartInput({ onOpenAgent, onKpiLogged, onObsLogged, coachTip, setCoachTip }) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  async function handleSubmit(e) {
    e.preventDefault()
    const text = value.trim()
    if (!text) return

    const route = routeInput(text)
    setValue('')

    if (route === 'kpi') {
      const entries = parseKpiInput(text)
      if (entries.length === 0) {
        onOpenAgent('chief-of-staff', text)
        return
      }
      setLoading(true)
      try {
        const results = await Promise.all(entries.map(e => api.addKpi(e)))
        const hasSignal = results.some(r => r.signal)
        const metricLabel = METRICS[entries[0]?.metric_id] || entries[0]?.metric_id
        if (hasSignal) {
          setCoachTip(`⚠️ Signal detected on ${metricLabel} — this data justifies a CI project`)
        } else {
          setCoachTip(`✓ KPI logged. Log daily to build your control chart baseline.`)
        }
        onKpiLogged?.(results)
      } catch (err) {
        setCoachTip(`Failed to log KPI: ${err.message}`)
      } finally {
        setLoading(false)
      }
      return
    }

    if (route === 'observation') {
      // Detect area and waste from input
      const area = AREAS.find(a => text.toLowerCase().includes(a.toLowerCase())) || 'Pick'
      const waste = WASTE_TYPES.find(w => text.toLowerCase().includes(w.toLowerCase())) || 'Waiting'
      const today = new Date().toISOString().split('T')[0]
      setLoading(true)
      try {
        const result = await api.addObservation({
          area, waste_type: waste, severity: 2, text, date: today
        })
        if (result.patternCount >= 3) {
          setCoachTip(`⚠️ ${waste} has appeared ${result.patternCount}x in 48h — consider raising a CI project`)
        } else {
          setCoachTip(`✓ Observation logged in ${area}. ${result.patternCount >= 2 ? `${result.patternCount}x ${waste} in 48h — watch this pattern.` : 'Keep walking the floor.'}`)
        }
        onObsLogged?.(result)
      } catch (err) {
        setCoachTip(`Failed to log observation: ${err.message}`)
      } finally {
        setLoading(false)
      }
      return
    }

    // Open agent
    onOpenAgent(route, text)
    setCoachTip(`Opening ${route.replace(/-/g, ' ')} agent...`)
  }

  return (
    <div className="fixed bottom-16 left-0 right-0 z-30 px-3 pb-1">
      {coachTip && (
        <div className="mb-1.5 bg-[#FFF7ED] border border-[#FED7AA] rounded-xl px-3 py-2 flex items-start gap-2">
          <span className="text-[11px] text-[#92400E] leading-relaxed flex-1">{coachTip}</span>
          <button onClick={() => setCoachTip('')} className="text-[#92400E] opacity-50 hover:opacity-100 text-xs flex-shrink-0 mt-0.5">✕</button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="flex-1 flex items-center bg-white rounded-2xl border border-gray-200 shadow-sm px-3 py-2.5 gap-2">
          <span className="text-[#E8820C] text-sm">◈</span>
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Log KPIs, observations, or ask anything…"
            className="flex-1 text-sm bg-transparent placeholder-gray-400 font-medium"
            disabled={loading}
          />
          {loading && <span className="text-xs text-gray-400 animate-pulse">...</span>}
        </div>
        <button
          type="submit"
          disabled={!value.trim() || loading}
          className="w-10 h-10 rounded-2xl bg-[#E8820C] flex items-center justify-center text-white shadow-sm disabled:opacity-40"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>
    </div>
  )
}
