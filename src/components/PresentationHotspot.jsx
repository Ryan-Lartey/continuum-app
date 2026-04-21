/**
 * PresentationHotspot — shows a ? badge anchored to its parent (position: relative required on parent).
 * Clicking opens a tooltip card explaining the feature. Dismissed hotspots are stored in sessionStorage.
 *
 * Usage:
 *   <div style={{ position: 'relative' }}>
 *     <PresentationHotspot id="kpi-chart" label="Control Chart" description="..." demoMode={demoMode} />
 *     ... your content ...
 *   </div>
 */

import { useState, useEffect } from 'react'
import { HOTSPOTS } from './hotspots.js'

const DISMISSED_KEY = 'demo_dismissed_hotspots'

// Module-level variable to track which hotspot tooltip is open — ensures only one at a time.
let _openHotspotSetter = null

function getDismissed() {
  try { return new Set(JSON.parse(sessionStorage.getItem(DISMISSED_KEY) || '[]')) }
  catch { return new Set() }
}

function addDismissed(id) {
  try {
    const set = getDismissed()
    set.add(id)
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]))
  } catch {}
}

export default function PresentationHotspot({ id, demoMode }) {
  const hotspot = HOTSPOTS[id]
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(() => getDismissed().has(id))

  // Register this setter so clicking another hotspot closes this one
  useEffect(() => {
    if (!open) return
    const prev = _openHotspotSetter
    _openHotspotSetter = setOpen
    return () => {
      if (_openHotspotSetter === setOpen) _openHotspotSetter = prev
    }
  }, [open])

  if (!demoMode || !hotspot || dismissed) return null

  function handleOpen() {
    // Close any currently open hotspot tooltip
    if (_openHotspotSetter && _openHotspotSetter !== setOpen) {
      _openHotspotSetter(false)
    }
    setOpen(prev => !prev)
  }

  function handleDismiss() {
    addDismissed(id)
    setDismissed(true)
    setOpen(false)
  }

  return (
    <>
      {/* ? badge — positioned top-right of parent */}
      <button
        onClick={handleOpen}
        title={hotspot.label}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: open ? '#e07020' : '#fb923c',
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          flexShrink: 0,
          lineHeight: 1,
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}
      >
        ?
      </button>

      {/* Tooltip card */}
      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            zIndex: 500,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 300,
            background: 'var(--bg-card)',
            border: '1px solid rgba(251,146,60,0.35)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            padding: '16px 18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>🎭</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{hotspot.label}</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 2, flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
          <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-2)', margin: 0 }}>
            {hotspot.description}
          </p>
          <button
            onClick={handleDismiss}
            style={{ marginTop: 12, fontSize: 11, color: 'var(--text-3)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
          >
            Got it — hide this
          </button>
        </div>
      )}
    </>
  )
}
