import { useState, useEffect, useRef } from 'react'
import { api, streamAgent } from '../lib/api.js'
import ProcessMap from '../components/ProcessMap.jsx'
import PresentationHotspot from '../components/PresentationHotspot.jsx'

// ─── Shared markdown renderer (light-mode document style) ───────────────────
function renderBoldDoc(str) {
  const parts = str.split(/\*\*(.*?)\*\*/g)
  return parts.map((p, i) => i % 2 === 1 ? <strong key={i} style={{ fontWeight: 700 }}>{p}</strong> : p)
}

function DocTable({ rows }) {
  if (!rows.length) return null
  const isHeader = (row) => row.every(c => /^[-:]+$/.test(c.trim()))
  const dataRows = rows.filter(r => !isHeader(r))
  if (dataRows.length < 2) return null
  const headers = dataRows[0]
  const body    = dataRows.slice(1)
  return (
    <div style={{ overflowX: 'auto', margin: '8px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
            {headers.map((h, i) => (
              <th key={i} style={{ textAlign: 'left', padding: '6px 12px', fontWeight: 700, color: '#1E293B', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h.trim()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid #F1F5F9', background: ri % 2 === 0 ? 'white' : '#FAFBFC' }}>
              {row.map((cell, ci) => {
                const v = cell.trim()
                const color = /✓|on.track|green/i.test(v) ? '#16A34A' : /✗|behind|red/i.test(v) ? '#DC2626' : /amber|signal/i.test(v) ? '#E8820C' : '#1E293B'
                return <td key={ci} style={{ padding: '7px 12px', color, fontWeight: /✓|✗/.test(v) ? 600 : 400 }}>{renderBoldDoc(v)}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MarkdownRenderer({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^\|/.test(line)) {
      const tableLines = []
      while (i < lines.length && /^\|/.test(lines[i])) {
        tableLines.push(lines[i].split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1))
        i++
      }
      elements.push(<DocTable key={`t${i}`} rows={tableLines} />)
      continue
    }
    if (line.startsWith('# ')) {
      elements.push(<div key={i} style={{ borderBottom: '2px solid #E2E8F0', paddingBottom: 10, marginBottom: 12, marginTop: i > 0 ? 20 : 0 }}><h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>{renderBoldDoc(line.slice(2))}</h1></div>)
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', margin: '16px 0 6px', paddingBottom: 4, borderBottom: '1px solid #F1F5F9' }}>{renderBoldDoc(line.slice(3))}</h2>)
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} style={{ fontSize: 13, fontWeight: 600, color: '#334155', margin: '10px 0 4px' }}>{renderBoldDoc(line.slice(4))}</h3>)
    } else if (/^[-*] /.test(line)) {
      elements.push(<div key={i} style={{ display: 'flex', gap: 8, padding: '2px 0 2px 8px' }}><span style={{ color: '#E8820C', flexShrink: 0, marginTop: 3, fontSize: 10 }}>●</span><span style={{ fontSize: 13, lineHeight: 1.65, color: '#334155' }}>{renderBoldDoc(line.slice(2))}</span></div>)
    } else if (/^\d+\. /.test(line)) {
      const m = line.match(/^(\d+)\. (.*)/)
      elements.push(<div key={i} style={{ display: 'flex', gap: 10, padding: '2px 0 2px 8px' }}><span style={{ color: '#E8820C', flexShrink: 0, fontWeight: 700, fontSize: 13, minWidth: 18 }}>{m[1]}.</span><span style={{ fontSize: 13, lineHeight: 1.65, color: '#334155' }}>{renderBoldDoc(m[2])}</span></div>)
    } else if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '10px 0' }} />)
    } else if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: 4 }} />)
    } else {
      elements.push(<p key={i} style={{ fontSize: 13, lineHeight: 1.65, color: '#475569', margin: '2px 0' }}>{renderBoldDoc(line)}</p>)
    }
    i++
  }
  return <div>{elements}</div>
}

// ─── Slide Presentation ──────────────────────────────────────────────────────
const WASTE_COLORS_SLIDES = { Transport:'#3B7FDE', Inventory:'#7C3AED', Motion:'#16A34A', Waiting:'#E8820C', Overproduction:'#DC2626', Overprocessing:'#0891B2', Defects:'#B91C1C', Skills:'#059669' }
const STAGE_COLORS_SLIDES = { Identify:'#E8820C', Define:'#3B7FDE', Measure:'#7C3AED', Analyse:'#DC2626', Improve:'#16A34A', Control:'#059669', Closed:'#6B7280' }
const DMAIC_SLIDES = ['Identify','Define','Measure','Analyse','Improve','Control']
const METRICS_SLIDES = [
  { id: 'uph', label: 'UPH', unit: '', target: 100, higher: true },
  { id: 'accuracy', label: 'Pick Accuracy', unit: '%', target: 99.5, higher: true },
  { id: 'dpmo', label: 'DPMO', unit: '', target: 500, higher: false },
  { id: 'dts', label: 'DTS', unit: '%', target: 98, higher: true },
]

function buildPortfolioSlides(projects, kpiHistory, latestKpis) {
  const active     = projects.filter(p => p.stage !== 'Closed')
  const closed     = projects.filter(p => p.stage === 'Closed' || p.stage === 'Control')
  const doneActions = projects.reduce((s,p) => s+(p.actions?.filter(a=>a.done).length||0), 0)
  const sopCount   = projects.filter(p => p.charter?.sop).length
  const wasteTypes = [...new Set(projects.flatMap(p => (p.maps||[]).flatMap(m => (m.data?.nodes||[]).map(n=>n.waste).filter(Boolean))))]

  // CI Impact Score
  let score = 0
  if (active.length > 0)          score += 25
  if (closed.length > 0)          score += 20
  if (doneActions > 0)            score += 15
  if (sopCount > 0)               score += 20
  if (wasteTypes.length > 0)      score += 10
  if ((kpiHistory?.length||0)>=5) score += 10
  const scoreLight = score>=75 ? '#4ade80' : score>=50 ? '#fb923c' : '#f87171'
  const scoreLabel = score>=75 ? 'High performer' : score>=50 ? 'Good progress' : 'Building momentum'
  const r=46, circ=2*Math.PI*r, filled=(score/100)*circ
  const month = new Date().toLocaleDateString('en-GB', { month:'long', year:'numeric' })

  // Waste frequency
  const wasteFreq = {}
  projects.forEach(p => (p.maps||[]).forEach(m => (m.data?.nodes||[]).forEach(n => { if(n.waste) wasteFreq[n.waste] = (wasteFreq[n.waste]||0)+1 })))

  // Overdue actions for priorities
  const TODAY = new Date().toISOString().split('T')[0]
  const overdue = projects.flatMap(p => (p.actions||[]).filter(a => !a.done && a.due && a.due < TODAY).map(a => ({ ...a, project: p.title })))

  const SLIDE_BG = '#0B1120'
  const CARD_BG  = '#131929'
  const BDR      = 'rgba(255,255,255,0.08)'
  const T1       = '#E4E6F0'
  const T2       = '#7E849E'
  const T3       = '#4A4E66'

  const slides = [
    // Slide 1 — Cover
    {
      title: 'Cover',
      content: (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', textAlign:'center', padding:48 }}>
          <div style={{ position:'absolute', top:32, left:40, fontSize:16, fontWeight:800, color:T1 }}>◈ Continuum</div>
          <div style={{ fontSize:11, fontWeight:700, color:T3, textTransform:'uppercase', letterSpacing:'0.16em', marginBottom:16 }}>CI Portfolio Review</div>
          <h1 style={{ fontSize:52, fontWeight:900, color:T1, letterSpacing:'-1.5px', margin:0, lineHeight:1 }}>CI Portfolio</h1>
          <p style={{ fontSize:18, color:T2, marginTop:12, marginBottom:40 }}>Amazon Fulfilment Centre · ID Logistics</p>
          <div style={{ position:'relative', width:120, height:120, marginBottom:24 }}>
            <svg width={120} height={120} style={{ transform:'rotate(-90deg)', position:'absolute', top:0, left:0 }}>
              <circle cx={60} cy={60} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={9}/>
              <circle cx={60} cy={60} r={r} fill="none" stroke={scoreLight} strokeWidth={9} strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"/>
            </svg>
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
              <div style={{ fontSize:32, fontWeight:900, color:scoreLight, lineHeight:1 }}>{score}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', fontWeight:700 }}>/ 100</div>
            </div>
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:T2 }}>CI Impact Score · {scoreLabel}</div>
          <div style={{ position:'absolute', bottom:32, left:40, right:40, display:'flex', justifyContent:'space-between', fontSize:11, color:T3 }}>
            <span>Ryan · CI Specialist</span>
            <span>{month} · Amazon FC</span>
          </div>
        </div>
      )
    },

    // Slide 2 — KPI Performance
    {
      title: 'KPI Performance',
      content: (
        <div style={{ padding:'40px 48px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:T3, textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:8 }}>KPI Performance</div>
          <h2 style={{ fontSize:32, fontWeight:900, color:T1, margin:'0 0 32px' }}>How are our KPIs performing?</h2>
          {Object.keys(latestKpis||{}).length === 0 && kpiHistory.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:T3 }}>No KPI data logged yet — log your first shift KPIs in the Data page.</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              {METRICS_SLIDES.map(m => {
                const d = (latestKpis||{})[m.id]
                const val = d?.value
                const hist = kpiHistory.filter(k => k.metric_id === m.id)
                const ratio = val !== undefined ? (m.higher ? val/m.target : m.target/val) : null
                const rag = ratio===null ? 'grey' : ratio>=0.98 ? 'green' : ratio>=0.93 ? 'amber' : 'red'
                const ragColor = { green:'#4ade80', amber:'#fb923c', red:'#f87171', grey:'#6b7280' }[rag]
                const diff = val !== undefined ? ((val-m.target)/m.target*100) : null
                return (
                  <div key={m.id} style={{ background:CARD_BG, border:`1px solid ${BDR}`, borderRadius:14, padding:'20px 24px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                      <span style={{ fontSize:11, fontWeight:700, color:T3, textTransform:'uppercase', letterSpacing:'0.1em' }}>{m.label}</span>
                      <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:`${ragColor}18`, color:ragColor }}>
                        {rag==='grey' ? 'No data' : rag==='green' ? 'On target' : rag==='amber' ? 'Watch' : 'Off target'}
                      </span>
                    </div>
                    <div style={{ fontSize:40, fontWeight:900, color:ragColor, lineHeight:1, letterSpacing:'-1.5px' }}>
                      {val !== undefined ? val.toLocaleString() : '—'}<span style={{ fontSize:18, fontWeight:600 }}>{m.unit}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontSize:11, color:T3 }}>
                      <span>Target: {m.target}{m.unit}</span>
                      <span style={{ color: diff === null ? T3 : diff >= 0 ? '#4ade80' : '#f87171', fontWeight:600 }}>
                        {diff !== null ? `${diff>0?'+':''}${diff.toFixed(1)}%` : '—'}
                      </span>
                    </div>
                    {hist.length > 0 && <div style={{ fontSize:10, color:T3, marginTop:4 }}>{hist.length} data points logged</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )
    },

    // Slide 3 — Active Projects
    {
      title: 'Active CI Projects',
      content: (
        <div style={{ padding:'40px 48px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:T3, textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:8 }}>Active CI Projects</div>
          <h2 style={{ fontSize:32, fontWeight:900, color:T1, margin:'0 0 28px' }}>Projects in flight</h2>
          {active.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:T3 }}>No active projects yet.</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {active.map(p => {
                const c = STAGE_COLORS_SLIDES[p.stage]||'#6B7280'
                const done = p.actions?.filter(a=>a.done).length||0
                const tot  = p.actions?.length||0
                const idx  = DMAIC_SLIDES.indexOf(p.stage)
                return (
                  <div key={p.id} style={{ background:CARD_BG, border:`1px solid ${BDR}`, borderLeft:`4px solid ${c}`, borderRadius:12, padding:'16px 18px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <span style={{ fontWeight:700, fontSize:14, color:T1, flex:1, paddingRight:8 }}>{p.title}</span>
                      <span style={{ fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20, background:`${c}18`, color:c }}>{p.stage}</span>
                    </div>
                    {p.problem_statement && <p style={{ fontSize:11, color:T2, lineHeight:1.5, marginBottom:10 }}>{p.problem_statement.slice(0,80)}{p.problem_statement.length>80?'…':''}</p>}
                    <div style={{ display:'flex', gap:3, marginBottom:8 }}>
                      {DMAIC_SLIDES.map((s,i) => (
                        <div key={s} style={{ flex:1 }}>
                          <div style={{ height:3, borderRadius:2, background:i<idx?'#16A34A':i===idx?c:'rgba(255,255,255,0.07)', marginBottom:2 }}/>
                          <div style={{ fontSize:7, color:i<=idx?T2:T3, textAlign:'center', fontWeight:i===idx?700:400 }}>{s.slice(0,3).toUpperCase()}</div>
                        </div>
                      ))}
                    </div>
                    {tot > 0 && <div style={{ fontSize:11, color:T3 }}>{done}/{tot} actions done</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )
    },

    // Slide 4 — CI Outcomes
    {
      title: 'CI Outcomes',
      content: (
        <div style={{ padding:'40px 48px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:T3, textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:8 }}>CI Outcomes</div>
          <h2 style={{ fontSize:32, fontWeight:900, color:T1, margin:'0 0 32px' }}>What have we delivered?</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
            {[
              { label:'Active Projects',    value:active.length,    icon:'◆', color:'#3B7FDE' },
              { label:'Completed Projects', value:closed.length,    icon:'✓', color:'#16A34A' },
              { label:'Actions Closed',     value:doneActions,      icon:'◉', color:'#E8820C' },
              { label:'SOPs Written',       value:sopCount,         icon:'▣', color:'#7C3AED' },
              { label:'Observations Logged',value:kpiHistory.filter(k=>k.date).length||0, icon:'◎', color:'#059669' },
              { label:'Waste Types Tackled',value:wasteTypes.length,icon:'⚠', color:'#DC2626' },
            ].map(s => (
              <div key={s.label} style={{ background:CARD_BG, border:`1px solid ${BDR}`, borderRadius:14, padding:'24px 20px', display:'flex', gap:14, alignItems:'center' }}>
                <span style={{ fontSize:24, color:s.color, flexShrink:0 }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize:36, fontWeight:900, color:T1, lineHeight:1 }}>{s.value}</div>
                  <div style={{ fontSize:11, color:T3, fontWeight:600, marginTop:4 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },

    // Slide 5 — Waste Themes
    {
      title: 'Waste Themes',
      content: (
        <div style={{ padding:'40px 48px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:T3, textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:8 }}>Waste Themes from Floor Walk</div>
          <h2 style={{ fontSize:32, fontWeight:900, color:T1, margin:'0 0 32px' }}>What waste are we tackling?</h2>
          {wasteTypes.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:T3 }}>Start logging floor observations to build your waste profile.</div>
          ) : (
            <div style={{ display:'flex', flexWrap:'wrap', gap:14 }}>
              {wasteTypes.map(w => {
                const c = WASTE_COLORS_SLIDES[w]||'#6B7280'
                const count = wasteFreq[w] || 0
                return (
                  <div key={w} style={{ padding:'14px 22px', borderRadius:16, background:`${c}15`, border:`1px solid ${c}30`, display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:16, fontWeight:800, color:c }}>{w}</span>
                    {count > 0 && <span style={{ fontSize:11, color:T3, fontWeight:600 }}>{count}×</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )
    },

    // Slide 6 — Next Priorities
    {
      title: 'Next Priorities',
      content: (
        <div style={{ padding:'40px 48px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:T3, textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:8 }}>Next Period Priorities</div>
          <h2 style={{ fontSize:32, fontWeight:900, color:T1, margin:'0 0 12px' }}>Our focus for the next 30 days</h2>
          <p style={{ fontSize:13, color:T2, marginBottom:32 }}>{month} · Amazon Fulfilment Centre</p>
          <div style={{ maxWidth:700 }}>
            {(overdue.length > 0 ? overdue.slice(0,3) : active.slice(0,3)).map((item, i) => {
              const isAction = 'project' in item
              return (
                <div key={i} style={{ display:'flex', gap:20, alignItems:'flex-start', padding:'20px 0', borderBottom:i<2?`1px solid ${BDR}`:'none' }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(232,130,12,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ fontSize:16, fontWeight:900, color:'#E8820C' }}>{i+1}</span>
                  </div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:16, color:T1 }}>
                      {isAction ? item.text : item.title}
                    </div>
                    <div style={{ fontSize:12, color:T2, marginTop:4 }}>
                      {isAction ? `Overdue action · ${item.project}` : `${item.stage} stage · ${(item.actions||[]).filter(a=>!a.done).length} actions remaining`}
                    </div>
                  </div>
                </div>
              )
            })}
            {active.length === 0 && overdue.length === 0 && (
              <div style={{ color:T3, padding:40, textAlign:'center' }}>No projects or actions yet. Start your first CI project to build this list.</div>
            )}
          </div>
        </div>
      )
    },
  ]

  return slides
}

function SlidePresentation({ slides, title, onClose }) {
  const [idx, setIdx] = useState(0)
  const total = slides.length

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setIdx(i => Math.min(i+1, total-1))
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   setIdx(i => Math.max(i-1, 0))
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [total, onClose])

  const slide = slides[idx]
  return (
    <div style={{ position:'fixed', inset:0, zIndex:100, background:'#0B1120', display:'flex', flexDirection:'column' }}>
      {/* Header bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0, background:'#080F1C' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:16, fontWeight:800, color:'#E4E6F0' }}>◈ Continuum</span>
          <span style={{ color:'rgba(255,255,255,0.2)', fontSize:14 }}>|</span>
          <span style={{ fontSize:13, color:'#7E849E' }}>{title}</span>
          <span style={{ color:'rgba(255,255,255,0.2)', fontSize:14 }}>|</span>
          <span style={{ fontSize:13, fontWeight:700, color:'#E4E6F0' }}>{slide.title}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:13, color:'#4A4E66', fontWeight:600 }}>{idx+1} / {total}</span>
          <button onClick={onClose} style={{ padding:'5px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', cursor:'pointer', fontSize:13, color:'#94A3B8' }}>
            ✕ Exit
          </button>
        </div>
      </div>

      {/* Slide content */}
      <div style={{ flex:1, position:'relative', overflow:'auto', color:'#E4E6F0', fontFamily:"'Inter',sans-serif" }}>
        {slide.content}
      </div>

      {/* Navigation arrows */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:16, padding:'14px 24px', borderTop:'1px solid rgba(255,255,255,0.07)', background:'#080F1C', flexShrink:0 }}>
        <button onClick={() => setIdx(i => Math.max(i-1, 0))} disabled={idx===0}
          style={{ width:40, height:40, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.1)', background:idx===0?'rgba(255,255,255,0.02)':'rgba(255,255,255,0.07)', cursor:idx===0?'default':'pointer', fontSize:18, color:idx===0?'rgba(255,255,255,0.2)':'#E4E6F0', display:'flex', alignItems:'center', justifyContent:'center' }}>
          ‹
        </button>
        <div style={{ display:'flex', gap:6 }}>
          {slides.map((_,i) => (
            <button key={i} onClick={() => setIdx(i)}
              style={{ width:i===idx?24:8, height:8, borderRadius:4, background:i===idx?'#E8820C':'rgba(255,255,255,0.15)', border:'none', cursor:'pointer', transition:'all 0.2s' }} />
          ))}
        </div>
        <button onClick={() => setIdx(i => Math.min(i+1, total-1))} disabled={idx===total-1}
          style={{ width:40, height:40, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.1)', background:idx===total-1?'rgba(255,255,255,0.02)':'rgba(255,255,255,0.07)', cursor:idx===total-1?'default':'pointer', fontSize:18, color:idx===total-1?'rgba(255,255,255,0.2)':'#E4E6F0', display:'flex', alignItems:'center', justifyContent:'center' }}>
          ›
        </button>
      </div>
    </div>
  )
}

// ─── Presentation overlay ────────────────────────────────────────────────────
function PresentationOverlay({ children, onClose, title }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#0F172A', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid #1E293B', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#F1F5F9' }}>◈ Continuum</span>
          {title && <span style={{ fontSize: 14, color: '#94A3B8', borderLeft: '1px solid #1E293B', paddingLeft: 12 }}>{title}</span>}
        </div>
        <button onClick={onClose} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #334155', background: '#1E293B', cursor: 'pointer', fontSize: 13, color: '#94A3B8' }}>
          ✕ Exit Presentation
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>
        {children}
      </div>
    </div>
  )
}

// ─── Portfolio tab ───────────────────────────────────────────────────────────
const WASTE_COLORS_LIGHT = { Transport:'#3B7FDE', Inventory:'#7C3AED', Motion:'#16A34A', Waiting:'#E8820C', Overproduction:'#DC2626', Overprocessing:'#0891B2', Defects:'#B91C1C', Skills:'#059669' }
const STAGE_COLORS = { Identify:'#E8820C', Define:'#3B7FDE', Measure:'#7C3AED', Analyse:'#DC2626', Improve:'#16A34A', Control:'#059669', Closed:'#6B7280' }
const DMAIC = ['Identify','Define','Measure','Analyse','Improve','Control']

function PortfolioTab({ projects, kpiHistory, onPresent, presentMode = false }) {
  const closed      = projects.filter(p => p.stage === 'Closed' || p.stage === 'Control')
  const active      = projects.filter(p => p.stage !== 'Closed')
  const sopCount    = projects.filter(p => p.charter?.sop).length
  const trainCount  = projects.filter(p => p.charter?.trainingNote).length
  const wasteTypes  = [...new Set(projects.flatMap(p => (p.maps||[]).flatMap(m => (m.data?.nodes||[]).map(n=>n.waste).filter(Boolean))))]
  const doneActions = projects.reduce((s,p) => s+(p.actions?.filter(a=>a.done).length||0), 0)

  // CI Impact Score — 0-100 built from real data signals
  let score = 0
  if (active.length > 0)          score += 25
  if (closed.length > 0)          score += 20
  if (doneActions > 0)            score += 15
  if (sopCount > 0)               score += 20
  if (wasteTypes.length > 0)      score += 10
  if ((kpiHistory?.length||0)>=5) score += 10

  const scoreColor = score>=75 ? '#16A34A' : score>=50 ? '#E8820C' : '#DC2626'
  const scoreLight = score>=75 ? '#4ade80' : score>=50 ? '#fb923c' : '#f87171'
  const scoreLabel = score>=75 ? 'High performer' : score>=50 ? 'Good progress' : 'Building momentum'
  const month = new Date().toLocaleDateString('en-GB', { month:'long', year:'numeric' })

  // SVG ring
  const r=46, circ=2*Math.PI*r, filled=(score/100)*circ

  function renderContent(dark) {
    const T1   = dark ? '#E4E6F0' : '#0F172A'
    const T2   = dark ? '#7E849E' : '#64748B'
    const T3   = dark ? '#4A4E66' : '#94A3B8'
    const BG   = dark ? '#1A1E2E' : '#F8FAFC'
    const BDR  = dark ? 'rgba(255,255,255,0.07)' : '#E2E8F0'
    const CARD = dark ? '#161A26' : 'white'
    const DIV  = dark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'

    return (
      <div style={{ maxWidth:960, margin:'0 auto', fontFamily:"'Inter',sans-serif" }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, paddingBottom:18, borderBottom:`2px solid ${DIV}` }}>
          <div>
            <div style={{ fontSize:10, fontWeight:800, color:T3, textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:4 }}>Continuum CI Management</div>
            <h1 style={{ fontSize:30, fontWeight:900, color:T1, margin:0, letterSpacing:'-0.5px' }}>CI Portfolio</h1>
            <p style={{ fontSize:13, color:T2, marginTop:4 }}>{month} · Amazon Fulfilment Centre</p>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:10, color:T3, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:2 }}>CI Specialist</div>
            <div style={{ fontSize:20, fontWeight:900, color:T1 }}>Ryan</div>
            <div style={{ fontSize:11, color:T3, marginTop:2 }}>ID Logistics · Amazon FC</div>
          </div>
        </div>

        {/* Hero — Score ring + stat cards */}
        <div style={{ display:'grid', gridTemplateColumns:'180px 1fr', gap:14, marginBottom:24 }}>
          <div style={{ background:'linear-gradient(145deg,#080F1C 0%,#0F172A 100%)', borderRadius:16, padding:20, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', border:`1px solid rgba(255,255,255,0.06)` }}>
            <div style={{ position:'relative', width:108, height:108 }}>
              <svg width={108} height={108} style={{ transform:'rotate(-90deg)', position:'absolute', top:0, left:0 }}>
                <circle cx={54} cy={54} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={9}/>
                <circle cx={54} cy={54} r={r} fill="none" stroke={scoreLight} strokeWidth={9} strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"/>
              </svg>
              <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                <div style={{ fontSize:28, fontWeight:900, color:scoreLight, lineHeight:1 }}>{score}</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>/ 100</div>
              </div>
            </div>
            <div style={{ marginTop:10, fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.8)', textAlign:'center' }}>CI Impact Score</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', textAlign:'center', marginTop:3 }}>{scoreLabel}</div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {[
              { label:'Active Projects', value:active.length,    icon:'◆', color:'#3B7FDE' },
              { label:'Completed',       value:closed.length,    icon:'✓', color:'#16A34A' },
              { label:'Actions Closed',  value:doneActions,      icon:'◉', color:'#E8820C' },
              { label:'SOPs Written',    value:sopCount,         icon:'▣', color:'#7C3AED' },
              { label:'Teams Trained',   value:trainCount,       icon:'◎', color:'#059669' },
              { label:'Waste Tackled',   value:wasteTypes.length,icon:'⚠', color:'#DC2626' },
            ].map(s => (
              <div key={s.label} style={{ background:BG, border:`1px solid ${BDR}`, borderRadius:12, padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:18, color:s.color, flexShrink:0 }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize:22, fontWeight:900, color:T1, lineHeight:1 }}>{s.value}</div>
                  <div style={{ fontSize:9.5, color:T3, fontWeight:600, marginTop:2 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Projects */}
        {projects.length > 0 && (
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:10, fontWeight:800, color:T3, textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:12 }}>Projects</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[...active,...closed].map(p => {
                const c   = STAGE_COLORS[p.stage]||'#6B7280'
                const done= p.actions?.filter(a=>a.done).length||0
                const tot = p.actions?.length||0
                const idx = DMAIC.indexOf(p.stage)
                return (
                  <div key={p.id} style={{ background:CARD, border:`1px solid ${BDR}`, borderLeft:`4px solid ${c}`, borderRadius:10, padding:'14px 16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:7 }}>
                      <div style={{ fontWeight:700, fontSize:13, color:T1, lineHeight:1.3, flex:1, paddingRight:8 }}>{p.title}</div>
                      <span style={{ fontSize:9.5, fontWeight:700, padding:'2px 8px', borderRadius:20, background:`${c}18`, color:c, flexShrink:0 }}>{p.stage}</span>
                    </div>
                    {p.problem_statement && <p style={{ fontSize:11, color:T2, lineHeight:1.5, marginBottom:8 }}>{p.problem_statement.slice(0,90)}{p.problem_statement.length>90?'…':''}</p>}
                    <div style={{ display:'flex', gap:3, marginBottom:8 }}>
                      {DMAIC.map((s,i) => (
                        <div key={s} style={{ flex:1 }}>
                          <div style={{ height:3, borderRadius:2, background:i<idx?'#16A34A':i===idx?c:DIV, marginBottom:2 }}/>
                          <div style={{ fontSize:6.5, color:i<=idx?T2:T3, textAlign:'center', fontWeight:i===idx?700:400 }}>{s.slice(0,3).toUpperCase()}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:'flex', gap:10, fontSize:11, color:T3 }}>
                      {tot>0 && <span style={{ color:done===tot&&tot>0?'#4ade80':T2 }}>{done}/{tot} actions</span>}
                      {p.metric_id&&p.baseline && <span>{p.metric_id.toUpperCase()}: {p.baseline} → {p.target_value||'?'}</span>}
                      {p.charter?.sop && <span style={{ color:'#4ade80', fontWeight:600 }}>SOP ✓</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Waste tackled */}
        {wasteTypes.length > 0 && (
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:10, fontWeight:800, color:T3, textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:10 }}>Waste Types Tackled</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {wasteTypes.map(w => {
                const c = WASTE_COLORS_LIGHT[w]||'#6B7280'
                return <span key={w} style={{ padding:'5px 14px', borderRadius:20, background:`${c}15`, border:`1px solid ${c}30`, fontSize:12, color:c, fontWeight:600 }}>{w}</span>
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop:`1px solid ${DIV}`, paddingTop:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:13, fontWeight:800, color:T1 }}>◈ Continuum</span>
            <span style={{ fontSize:11, color:T3 }}>CI Management Platform</span>
          </div>
          <span style={{ fontSize:11, color:T3 }}>{new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span>
        </div>
      </div>
    )
  }

  if (presentMode) {
    return (
      <div style={{ background:'#1E293B', borderRadius:16, padding:32 }}>
        {renderContent(true)}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-bold text-lg" style={{ color:'var(--text-1)' }}>CI Portfolio</h2>
          <p className="text-xs mt-0.5" style={{ color:'var(--text-3)' }}>Your complete CI record — auto-generated from live data</p>
        </div>
        <button onClick={onPresent} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={{ background:'#E8820C', color:'white' }}>
          ▶ Present
        </button>
      </div>
      <div className="card p-7">
        {renderContent(true)}
      </div>
    </div>
  )
}

// ─── Shift Handover tab ──────────────────────────────────────────────────────
function ShiftHandoverTab({ onOpenAgent }) {
  const [text, setText]         = useState('')
  const [generating, setGen]    = useState(false)
  const [copied, setCopied]     = useState(false)

  async function generate() {
    setGen(true); setText('')
    const today = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })
    const time  = new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
    let acc = ''
    streamAgent('gm-report', [{ role:'user', content:`Generate a professional shift handover report for ${today} at ${time}. Include: shift summary, KPI performance today, floor observations logged today, CI actions progressed, any open issues or escalations needed, and key priorities for the next shift. Keep it concise and factual — this will be handed to the incoming shift manager and TL.` }], null,
      chunk => { acc += chunk; setText(acc) },
      () => setGen(false),
      err => { setGen(false); setText(`Error: ${err}`) }
    )
  }

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="grid grid-cols-3 gap-5 items-start">
      <div className="col-span-2 card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold" style={{ color:'var(--text-1)' }}>Shift Handover Report</h2>
            <p className="text-xs mt-0.5" style={{ color:'var(--text-3)' }}>{new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})} · End of shift</p>
          </div>
          <div className="flex gap-2">
            {text && (
              <button onClick={copy} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ background:'var(--bg-input)', color:'var(--text-2)', border:'1px solid var(--border)' }}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            )}
            <button onClick={generate} disabled={generating} className="px-5 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ background:'#E8820C' }}>
              {generating ? '⬡ Writing…' : '⬡ Generate'}
            </button>
          </div>
        </div>
        {generating && !text && (
          <div className="flex items-center gap-3 py-12 justify-center" style={{ color:'var(--text-3)' }}>
            <span className="animate-pulse text-2xl">⬡</span>
            <span className="text-sm">Building handover from today's data…</span>
          </div>
        )}
        {text ? (
          <div className="rounded-2xl p-6" style={{ background:'#1E293B', border:'1px solid #334155', boxShadow:'0 2px 12px rgba(0,0,0,0.3)' }}>
            <MarkdownRenderer text={text} />
            {generating && <span className="inline-block w-1 h-3 animate-pulse ml-1 align-middle" style={{ background:'#94A3B8' }} />}
          </div>
        ) : !generating && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4" style={{ color:'var(--text-3)' }}>⬡</div>
            <p className="text-sm font-medium" style={{ color:'var(--text-2)' }}>Ready to generate</p>
            <p className="text-xs mt-1" style={{ color:'var(--text-3)' }}>Hit Generate at end of shift — takes 10 seconds</p>
          </div>
        )}
      </div>
      <div className="space-y-3">
        <div className="card p-4">
          <h3 className="font-semibold text-sm mb-3" style={{ color:'var(--text-1)' }}>Handover includes</h3>
          {['Shift summary','KPI performance today','Floor observations logged','CI actions progressed','Open issues & escalations','Priorities for next shift'].map(s => (
            <div key={s} className="flex items-center gap-2 py-1.5 text-sm" style={{ color:'var(--text-2)' }}>
              <span className="text-xs" style={{ color:'#4ade80' }}>✓</span> {s}
            </div>
          ))}
        </div>
        <div className="card p-4 rounded-xl" style={{ background:'rgba(232,130,12,0.06)', border:'1px solid rgba(232,130,12,0.15)' }}>
          <p className="text-xs" style={{ color:'#fb923c' }}>Generate this every shift. Hand it to your TL or manager. Over time it becomes a log of your contribution — visible, documented, undeniable.</p>
        </div>
      </div>
    </div>
  )
}

// ─── Maturity tab ────────────────────────────────────────────────────────────
function MaturityTab({ onPresent }) {
  const [data, setData]       = useState(null)
  const [editing, setEditing] = useState(false)
  const [scores, setScores]   = useState({ five_s: 1, dmaic: 1, standard_work: 1, visual_mgmt: 1, problem_solving: 1 })
  const [notes, setNotes]     = useState('')
  const [saving, setSaving]   = useState(false)

  const DIMS = [
    { key: 'five_s',         label: '5S', desc: 'Sort, Set, Shine, Standardise, Sustain' },
    { key: 'dmaic',          label: 'DMAIC', desc: 'Project discipline and stage completion' },
    { key: 'standard_work',  label: 'Standard Work', desc: 'SOPs written and teams trained' },
    { key: 'visual_mgmt',    label: 'Visual Management', desc: 'KPI boards, obs logging, floor presence' },
    { key: 'problem_solving',label: 'Problem Solving', desc: 'Root cause depth and sustainment' },
  ]

  useEffect(() => {
    api.getMaturity().then(d => {
      setData(d)
      if (d?.auto) setScores(d.auto)
    }).catch(() => {})
  }, [])

  async function save() {
    setSaving(true)
    const month = new Date().toISOString().slice(0, 7)
    await api.saveMaturity({ month, ...scores, notes }).catch(() => {})
    const d = await api.getMaturity().catch(() => null)
    if (d) setData(d)
    setSaving(false); setEditing(false)
  }

  const avg = data?.auto ? (Object.values(data.auto).reduce((s, v) => s + v, 0) / 5).toFixed(1) : null
  const history = data?.history || []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg" style={{ color: 'var(--text-1)' }}>Site Maturity Score</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Auto-scored from your real data — overridable per dimension</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(e => !e)}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--bg-input)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
            {editing ? 'Cancel' : 'Override'}
          </button>
          <button onClick={onPresent}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: '#E8820C', color: 'white' }}>
            ▶ Present
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 card p-5">
          {avg && (
            <div className="flex items-center gap-4 mb-6 pb-5 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center border-4" style={{ borderColor: parseFloat(avg) >= 4 ? '#16A34A' : parseFloat(avg) >= 3 ? '#E8820C' : '#DC2626' }}>
                <span className="text-2xl font-black" style={{ color: parseFloat(avg) >= 4 ? '#4ade80' : parseFloat(avg) >= 3 ? '#fb923c' : '#f87171' }}>{avg}</span>
              </div>
              <div>
                <div className="font-bold text-lg" style={{ color: 'var(--text-1)' }}>Overall Maturity</div>
                <div className="text-sm" style={{ color: 'var(--text-3)' }}>
                  {parseFloat(avg) >= 4 ? 'High — site running at CI standard' : parseFloat(avg) >= 3 ? 'Developing — good foundation in place' : 'Emerging — key building blocks needed'}
                </div>
              </div>
            </div>
          )}
          <div className="space-y-4">
            {DIMS.map(d => {
              const val = editing ? scores[d.key] : (data?.auto?.[d.key] || 1)
              const pct = (val / 5) * 100
              const color = val >= 4 ? '#4ade80' : val >= 3 ? '#fb923c' : '#f87171'
              return (
                <div key={d.key}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{d.label}</span>
                      <span className="text-xs ml-2" style={{ color: 'var(--text-3)' }}>{d.desc}</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color }}>{val}/5</span>
                  </div>
                  {editing ? (
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(n => (
                        <button key={n} onClick={() => setScores(s => ({ ...s, [d.key]: n }))}
                          className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                          style={{ background: scores[d.key] >= n ? color : 'var(--bg-input)', color: scores[d.key] >= n ? 'white' : 'var(--text-3)' }}>
                          {n}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="h-2 rounded-full" style={{ background: 'var(--bg-input)' }}>
                      <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {editing && (
            <div className="mt-4 space-y-2">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes for this month's assessment…" rows={2}
                className="w-full text-xs rounded-xl border px-3 py-2 resize-none"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
              <button onClick={save} disabled={saving}
                className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                style={{ background: '#E8820C' }}>
                {saving ? 'Saving…' : 'Save This Month'}
              </button>
            </div>
          )}
        </div>

        <div className="card p-4">
          <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-1)' }}>History</h3>
          {history.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>No saved months yet. Save this month to start tracking.</p>
          ) : history.map(h => {
            const hAvg = ((h.five_s + h.dmaic + h.standard_work + h.visual_mgmt + h.problem_solving) / 5).toFixed(1)
            const color = parseFloat(hAvg) >= 4 ? '#4ade80' : parseFloat(hAvg) >= 3 ? '#fb923c' : '#f87171'
            return (
              <div key={h.month} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                <span className="text-xs" style={{ color: 'var(--text-2)' }}>{h.month}</span>
                <span className="text-sm font-bold" style={{ color }}>{hAvg}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function ReportsView({ onOpenAgent, onNavigate, demoMode }) {
  const [activeTab, setActiveTab]           = useState('gm')
  const [projects, setProjects]             = useState([])
  const [allProjects, setAllProjects]       = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [generating, setGenerating]         = useState(false)
  const [reportText, setReportText]         = useState('')
  const [monthlyText, setMonthlyText]       = useState('')
  const [monthlyGenerating, setMonthlyGenerating] = useState(false)
  const [copied, setCopied]                 = useState(false)
  const [presenting, setPresenting]         = useState(null) // 'portfolio'|'maturity'|'map'
  const [presentMapData, setPresentMapData] = useState(null)
  const [kpiHistory, setKpiHistory]         = useState([])
  const [latestKpis, setLatestKpis]         = useState({})
  const [standaloneMaps, setStandaloneMaps] = useState([])
  const [showNewMapForm, setShowNewMapForm] = useState(false)
  const [newMapTitle, setNewMapTitle]       = useState('')
  const [newMapArea, setNewMapArea]         = useState('General')
  const [newMapType, setNewMapType]         = useState('current')
  const [newMapDesc, setNewMapDesc]         = useState('')
  const [editingMap, setEditingMap]         = useState(null) // { id, title, data }
  const [mapEditorSteps, setMapEditorSteps] = useState([])
  const [mapEditorDesc, setMapEditorDesc]   = useState('')
  const [mapShowPreview, setMapShowPreview] = useState(false)
  const [mapNewStep, setMapNewStep]         = useState({ text: '', lane: 'Operator', waste: '' })
  const [mapGenerating, setMapGenerating]   = useState(false)
  const [autoReport, setAutoReport]         = useState(() => localStorage.getItem('continuum_auto_report') === 'true')
  const [lastAutoReport, setLastAutoReport] = useState(() => localStorage.getItem('continuum_last_auto_report') || '')
  const [mapLinks, setMapLinks]             = useState(() => { try { return JSON.parse(localStorage.getItem('continuum_map_links') || '{}') } catch { return {} } })
  const [syncStatus, setSyncStatus]         = useState(null)
  const [syncing, setSyncing]               = useState(false)
  const [showSyncConfig, setShowSyncConfig] = useState(false)
  const [syncConfig, setSyncConfig]         = useState({ tenantId: '', clientId: '', clientSecret: '', oneDrivePath: 'Continuum' })

  // Refresh map links from localStorage when maps tab is active
  useEffect(() => {
    if (activeTab !== 'maps') return
    try { setMapLinks(JSON.parse(localStorage.getItem('continuum_map_links') || '{}')) } catch {}
  }, [activeTab])

  useEffect(() => {
    api.getWeeklyBrief().then(b => { if (b?.content && !b.content.includes('No API key configured')) setReportText(b.content) }).catch(() => {})
    api.getProjects().then(ps => {
      setAllProjects(ps)
      const active = ps.filter(p => p.stage !== 'Closed')
      setProjects(active)
      if (active.length) setSelectedProject(active[0])
    }).catch(() => {})
    api.getKpis().catch(() => []).then(setKpiHistory)
    api.getLatestKpis().then(setLatestKpis).catch(() => {})
    api.getMaps().then(setStandaloneMaps).catch(() => {})
    fetch('/api/sync/status').then(r => r.json()).then(setSyncStatus).catch(() => {})
  }, [])

  // Auto-report on Monday
  useEffect(() => {
    if (!autoReport) return
    const today = new Date()
    if (today.getDay() !== 1) return // not Monday
    const todayStr = today.toISOString().split('T')[0]
    if (lastAutoReport === todayStr) return // already ran today
    // Trigger after a short delay to let data settle
    const t = setTimeout(() => {
      generateGMReport()
      const nowStr = new Date().toISOString().split('T')[0]
      localStorage.setItem('continuum_last_auto_report', nowStr)
      setLastAutoReport(nowStr)
    }, 1200)
    return () => clearTimeout(t)
  }, [autoReport]) // eslint-disable-line react-hooks/exhaustive-deps

  async function generateGMReport() {
    setGenerating(true); setReportText('')
    let acc = ''
    streamAgent('gm-report', [{ role: 'user', content: 'Generate the weekly GM report using all available site data, KPIs, projects and observations.' }], null,
      chunk => { acc += chunk; setReportText(acc) },
      async () => {
        setGenerating(false)
        const today = new Date().toISOString().split('T')[0]
        await api.saveBrief({ date: today, content: acc, type: 'weekly' }).catch(() => {})
      },
      err => { setGenerating(false); setReportText(`Error: ${err}`) }
    )
  }

  async function generateMonthly() {
    setMonthlyGenerating(true); setMonthlyText('')
    let acc = ''
    const month = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    streamAgent('gm-report', [{ role: 'user', content: `Generate a monthly CI programme review for ${month}. Include: programme summary, KPI trends month-on-month, project pipeline status, waste themes from floor observations, top 3 wins, top 3 risks, next month's priorities. Format professionally for GM and area managers.` }], null,
      chunk => { acc += chunk; setMonthlyText(acc) },
      () => { setMonthlyGenerating(false) },
      err => { setMonthlyGenerating(false); setMonthlyText(`Error: ${err}`) }
    )
  }

  async function copyReport() {
    await navigator.clipboard.writeText(reportText)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  async function exportToWord(text) {
    try {
      const { Document, Paragraph, TextRun, Packer, HeadingLevel } = await import('docx')
      const lines    = text.split('\n')
      const children = lines.map(line => {
        if (line.startsWith('# '))  return new Paragraph({ text: line.slice(2),  heading: HeadingLevel.HEADING_1 })
        if (line.startsWith('## ')) return new Paragraph({ text: line.slice(3),  heading: HeadingLevel.HEADING_2 })
        if (line.startsWith('- ') || line.startsWith('• ')) return new Paragraph({ text: line.slice(2), bullet: { level: 0 } })
        return new Paragraph({ children: [new TextRun({ text: line, size: 24 })] })
      })
      const doc  = new Document({ sections: [{ properties: {}, children }] })
      const blob = await Packer.toBlob(doc)
      const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `Report-${new Date().toISOString().split('T')[0]}.docx` })
      a.click(); URL.revokeObjectURL(a.href)
    } catch (err) { alert('Export error: ' + err.message) }
  }

  async function exportA3() {
    if (!selectedProject) return
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16)
    doc.text(`A3: ${selectedProject.title}`, 14, 20)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    doc.text(doc.splitTextToSize(buildA3(selectedProject), 390), 14, 32)
    doc.save(`A3-${selectedProject.title}-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  function buildA3(p) {
    if (!p) return ''
    const c    = p.charter || {}
    const acts = p.actions || []
    return `A3 REPORT — ${p.title}\n${'═'.repeat(50)}\n\nBACKGROUND / PROBLEM STATEMENT\n${p.problem_statement || 'Not defined'}\n\nCURRENT CONDITION\nMetric: ${p.metric_id?.toUpperCase() || 'N/A'} · Baseline: ${p.baseline || '—'} · Target: ${p.target_value || '—'}\nStage: ${p.stage}\n\nGOAL\n${c.benefits || 'Not defined'}\n\nROOT CAUSE ANALYSIS\n${p.notes || 'In progress'}\n\nCOUNTERMEASURES\n${acts.map((a, i) => `${i + 1}. [${a.done ? '✓' : ' '}] ${a.text}${a.owner ? ' — ' + a.owner : ''}`).join('\n') || 'None yet'}\n\nRESULTS\n${acts.filter(a => a.done).length}/${acts.length} actions complete\n\nSTANDARDISATION / SOP\n${c.sop || 'Not written'}\n\nIn Scope: ${c.scopeIn || '—'}\nOut of Scope: ${c.scopeOut || '—'}\nBusiness Case: ${c.businessCase || '—'}\n\nPrepared by: Ryan  |  Date: ${new Date().toLocaleDateString('en-GB')}`
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/sync/excel', { method: 'POST' }).then(r => r.json())
      setSyncStatus(s => ({ ...s, lastSync: res.syncedAt }))
      if (res.webUrl) window.open(res.webUrl, '_blank')
    } catch {}
    setSyncing(false)
  }

  async function saveSyncConfig() {
    try {
      await fetch('/api/sync/config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(syncConfig) })
      setSyncStatus(s => ({ ...s, configured: !!(syncConfig.tenantId && syncConfig.clientId && syncConfig.clientSecret) }))
      setShowSyncConfig(false)
    } catch {}
  }

  const TABS = [
    { id: 'portfolio', label: '◈ Portfolio'      },
    { id: 'handover',  label: '⬡ Shift Handover' },
    { id: 'gm',        label: '◉ GM Report'      },
    { id: 'monthly',   label: '▣ Monthly Review' },
    { id: 'maturity',  label: '▲ Maturity'       },
    { id: 'a3',        label: '□ A3 Builder'     },
    { id: 'maps',      label: '⬡ Map Library'    },
  ]

  const btnBase = 'px-4 py-2 rounded-xl text-sm font-semibold transition-all'

  return (
    <div className="max-w-[1400px] space-y-5">
      {/* Presentation overlays */}
      {presenting === 'portfolio' && (
        <SlidePresentation
          title="CI Portfolio Review"
          slides={buildPortfolioSlides(allProjects, kpiHistory, latestKpis)}
          onClose={() => setPresenting(null)}
        />
      )}
      {presenting === 'maturity' && (
        <PresentationOverlay title="Site Maturity Score" onClose={() => setPresenting(null)}>
          <MaturityTab onPresent={() => {}} />
        </PresentationOverlay>
      )}
      {presenting === 'map' && presentMapData && (
        <PresentationOverlay title="Process Map" onClose={() => { setPresenting(null); setPresentMapData(null) }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <ProcessMap mapData={presentMapData} />
          </div>
        </PresentationOverlay>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>Reports</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>Portfolio, GM reports, maturity scoring, A3 documents, and process maps</p>
        </div>

        {/* Excel Sync Panel */}
        <div className="card p-4" style={{ minWidth: 280, maxWidth: 360, flexShrink: 0 }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 16 }}>⊞</span>
              <span className="font-semibold text-sm" style={{ color: '#217346' }}>Excel Sync</span>
            </div>
            <button onClick={() => setShowSyncConfig(v => !v)} style={{ fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 6, background: 'var(--bg-input)' }}>
              {showSyncConfig ? 'Close' : 'Configure'}
            </button>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: syncStatus?.configured ? '#16A34A' : '#D97706', flexShrink: 0, display: 'inline-block' }} />
            <span className="text-xs" style={{ color: syncStatus?.configured ? '#16A34A' : '#D97706' }}>
              {syncStatus?.configured ? 'Connected to OneDrive' : 'Credentials not configured'}
            </span>
          </div>

          <div className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>
            Last synced: {syncStatus?.lastSync ? new Date(syncStatus.lastSync).toLocaleString('en-GB') : 'Never'}
            <span style={{ marginLeft: 8, opacity: 0.6 }}>· Auto-syncs daily at 7:00 AM</span>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleSync} disabled={syncing} style={{
              flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: syncing ? 'not-allowed' : 'pointer',
              background: syncing ? 'var(--bg-input)' : '#217346', color: syncing ? 'var(--text-3)' : 'white',
              fontSize: 12, fontWeight: 700, transition: 'all 0.15s'
            }}>
              {syncing ? 'Syncing...' : 'Sync Now →'}
            </button>
            <button
              onClick={() => { window.location.href = '/api/sync/download' }}
              title="Download Excel report"
              style={{
                padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'rgba(33,115,70,0.12)', color: '#217346',
                fontSize: 14, fontWeight: 700, transition: 'all 0.15s'
              }}>
              ⬇
            </button>
          </div>

          {showSyncConfig && (
            <div className="mt-3 space-y-2">
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Azure App Credentials
              </div>
              {[
                { key: 'tenantId', label: 'Tenant ID' },
                { key: 'clientId', label: 'Client ID' },
                { key: 'clientSecret', label: 'Client Secret' },
                { key: 'oneDrivePath', label: 'OneDrive Folder' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label style={{ fontSize: 10, color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>{label}</label>
                  <input
                    type={key === 'clientSecret' ? 'password' : 'text'}
                    value={syncConfig[key]}
                    onChange={e => setSyncConfig(s => ({ ...s, [key]: e.target.value }))}
                    placeholder={key === 'oneDrivePath' ? 'Continuum' : `Enter ${label}`}
                    style={{
                      width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: 11,
                      background: 'var(--bg-input)', border: '1px solid var(--border)',
                      color: 'var(--text-1)', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              ))}
              <button onClick={saveSyncConfig} style={{
                width: '100%', marginTop: 4, padding: '6px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: 'var(--accent, #E8820C)', color: 'white', fontSize: 11, fontWeight: 700
              }}>
                Save Credentials
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={btnBase}
            style={activeTab === t.id
              ? { background: '#E8820C', color: 'white' }
              : { background: 'var(--bg-input)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Portfolio */}
      {activeTab === 'portfolio' && (
        <PortfolioTab projects={allProjects} kpiHistory={kpiHistory} onPresent={() => setPresenting('portfolio')} />
      )}

      {/* Shift Handover */}
      {activeTab === 'handover' && <ShiftHandoverTab onOpenAgent={onOpenAgent} />}

      {/* GM Report */}
      {activeTab === 'gm' && (
        <div className="grid grid-cols-3 gap-5 items-start">
          <div className="col-span-2 card p-5" style={{ position: 'relative' }}>
            <PresentationHotspot id="reports-gm" demoMode={demoMode} />
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold" style={{ color: 'var(--text-1)' }}>Weekly GM Report</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>AI-generated from live KPI data, projects, and observations</p>
                {/* Auto-report toggle */}
                <div className="flex items-center gap-3 mt-2.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span style={{
                      display: 'inline-block', width: 36, height: 20, borderRadius: 10, flexShrink: 0,
                      background: autoReport ? 'var(--accent, #E8820C)' : 'var(--bg-input)',
                      border: `1px solid ${autoReport ? 'var(--accent, #E8820C)' : 'var(--border)'}`,
                      position: 'relative', transition: 'background 0.2s',
                    }}>
                      <span style={{
                        position: 'absolute', top: 2, left: autoReport ? 17 : 2, width: 14, height: 14,
                        borderRadius: '50%', background: autoReport ? 'white' : 'var(--text-3)',
                        transition: 'left 0.2s',
                      }} />
                      <input type="checkbox" checked={autoReport} onChange={e => {
                        const v = e.target.checked
                        setAutoReport(v)
                        localStorage.setItem('continuum_auto_report', String(v))
                      }} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
                    </span>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Auto-generate every Monday</span>
                  </label>
                  {lastAutoReport && (
                    <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                      Last: {new Date(lastAutoReport).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {reportText && (
                  <>
                    <button onClick={copyReport} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ background: 'var(--bg-input)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                    <button onClick={() => exportToWord(reportText)} className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: '#3B7FDE' }}>
                      Export Word
                    </button>
                  </>
                )}
                <button onClick={generateGMReport} disabled={generating} className="px-5 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ background: '#E8820C' }}>
                  {generating ? '◉ Writing…' : '◉ Generate'}
                </button>
              </div>
            </div>
            {generating && !reportText && (
              <div className="flex items-center gap-3 py-12 justify-center" style={{ color: 'var(--text-3)' }}>
                <span className="animate-pulse text-2xl">◉</span>
                <span className="text-sm">Writing report from your live data…</span>
              </div>
            )}
            {reportText ? (
              <div className="rounded-2xl p-6" style={{ background: '#1E293B', border: '1px solid #334155', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
                <MarkdownRenderer text={reportText} />
                {generating && <span className="inline-block w-1 h-3 animate-pulse ml-1 align-middle" style={{ background: '#94A3B8' }} />}
              </div>
            ) : !generating && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-5xl mb-4" style={{ color: 'var(--text-3)' }}>◉</div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>No report yet</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Click Generate to build your weekly report from live data</p>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="card p-4">
              <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-1)' }}>Report includes</h3>
              {['Executive Summary', 'KPI Performance vs Target', 'CI Projects Update', 'Issues & Risks', 'Next Week Priorities'].map(s => (
                <div key={s} className="flex items-center gap-2 py-1.5 text-sm" style={{ color: 'var(--text-2)' }}>
                  <span className="text-xs" style={{ color: '#4ade80' }}>✓</span> {s}
                </div>
              ))}
            </div>
            <button onClick={() => onOpenAgent('gm-report', null)} className="w-full card p-4 text-left flex items-center gap-3 hover:opacity-80 transition-all">
              <span className="text-xl" style={{ color: 'var(--text-3)' }}>◉</span>
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>GM Report Agent</div>
                <div className="text-xs" style={{ color: 'var(--text-3)' }}>Ask questions about the report</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Monthly Review */}
      {activeTab === 'monthly' && (
        <div className="grid grid-cols-3 gap-5 items-start">
          <div className="col-span-2 card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold" style={{ color: 'var(--text-1)' }}>Monthly CI Review</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} · For GM and area managers</p>
              </div>
              <div className="flex gap-2">
                {monthlyText && (
                  <button onClick={() => exportToWord(monthlyText)} className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: '#3B7FDE' }}>Export Word</button>
                )}
                <button onClick={generateMonthly} disabled={monthlyGenerating} className="px-5 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ background: '#E8820C' }}>
                  {monthlyGenerating ? '▣ Writing…' : '▣ Generate'}
                </button>
              </div>
            </div>
            {monthlyGenerating && !monthlyText && (
              <div className="flex items-center gap-3 py-12 justify-center" style={{ color: 'var(--text-3)' }}>
                <span className="animate-pulse text-2xl">▣</span>
                <span className="text-sm">Building monthly programme review…</span>
              </div>
            )}
            {monthlyText ? (
              <div className="rounded-2xl p-6" style={{ background: '#1E293B', border: '1px solid #334155', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
                <MarkdownRenderer text={monthlyText} />
                {monthlyGenerating && <span className="inline-block w-1 h-3 animate-pulse ml-1 align-middle" style={{ background: '#94A3B8' }} />}
              </div>
            ) : !monthlyGenerating && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-5xl mb-4" style={{ color: 'var(--text-3)' }}>▣</div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>No monthly review yet</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Generate at end of month for your stakeholder pack</p>
              </div>
            )}
          </div>
          <div className="card p-4">
            <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-1)' }}>Monthly review includes</h3>
            {['Programme summary', 'KPI trends month-on-month', 'Project pipeline status', 'Waste themes from observations', 'Top 3 wins', 'Top 3 risks', "Next month's priorities"].map(s => (
              <div key={s} className="flex items-center gap-2 py-1.5 text-sm" style={{ color: 'var(--text-2)' }}>
                <span className="text-xs" style={{ color: '#4ade80' }}>✓</span> {s}
              </div>
            ))}
            <div className="mt-4 p-3 rounded-xl" style={{ background: 'rgba(232,130,12,0.08)', border: '1px solid rgba(232,130,12,0.15)' }}>
              <p className="text-xs" style={{ color: '#fb923c' }}>Share this with your GM and area managers at end-of-month. This is the document that builds your reputation.</p>
            </div>
          </div>
        </div>
      )}

      {/* Maturity */}
      {activeTab === 'maturity' && <MaturityTab onPresent={() => setPresenting('maturity')} />}

      {/* A3 Builder */}
      {activeTab === 'a3' && (
        <div className="grid grid-cols-3 gap-5 items-start">
          <div className="col-span-2 card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold" style={{ color: 'var(--text-1)' }}>A3 Report</h2>
              <button onClick={exportA3} disabled={!selectedProject} className="px-5 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40" style={{ background: '#E8820C' }}>
                Export A3 PDF
              </button>
            </div>
            {selectedProject ? (
              <div className="rounded-2xl p-5" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono" style={{ color: 'var(--text-2)' }}>{buildA3(selectedProject)}</pre>
              </div>
            ) : (
              <div className="py-16 text-center text-sm" style={{ color: 'var(--text-3)' }}>Select a project from the right</div>
            )}
          </div>
          <div className="card p-4 space-y-2">
            <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-1)' }}>Select Project</h3>
            {allProjects.length === 0 ? <p className="text-xs" style={{ color: 'var(--text-3)' }}>No projects</p> : allProjects.map(p => {
              const color = { Identify: '#E8820C', Define: '#3B7FDE', Measure: '#7C3AED', Analyse: '#DC2626', Improve: '#16A34A', Control: '#059669', Closed: '#6B7280' }[p.stage] || '#6B7280'
              const sel   = selectedProject?.id === p.id
              return (
                <div key={p.id} className="flex items-center gap-1">
                  <button onClick={() => setSelectedProject(p)}
                    className="flex-1 text-left rounded-xl px-3 py-2.5 transition-all border-2"
                    style={{ borderColor: sel ? color : 'transparent', background: sel ? `${color}10` : 'var(--bg-input)' }}>
                    <div className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{p.title}</div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>{p.stage}</span>
                  </button>
                  <button onClick={() => onNavigate?.('projects', p)}
                    className="flex-shrink-0 text-xs font-semibold px-2 py-1.5 rounded-lg"
                    style={{ background: 'var(--bg-input)', color: 'var(--text-3)', border: '1px solid var(--border)' }}
                    title="Open project">
                    View →
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Map Library */}
      {activeTab === 'maps' && (
        <div className="space-y-8" style={{ position: 'relative' }}>
          <PresentationHotspot id="reports-map" demoMode={demoMode} />
          {/* If editing a standalone map full-screen */}
          {editingMap && (() => {
            const WASTE_TYPES_MAP = ['', 'Waiting', 'Motion', 'Transport', 'Defects', 'Inventory', 'Overprocessing', 'Skills']
            const WASTE_COLORS_MAP = { Waiting: '#FBBF24', Motion: '#3b82f6', Transport: '#06b6d4', Defects: '#ef4444', Inventory: '#f97316', Overprocessing: '#8b5cf6', Skills: '#4ADE80' }
            const LANES = ['Operator', 'TeamLeader', 'System']

            function stepsToMapData(steps) {
              const nodes = steps.map((s, i) => ({ id: i + 1, label: s.text, lane: s.lane || 'Operator', waste: s.waste || null, type: 'process' }))
              const edges = nodes.slice(0, -1).map((n, i) => ({ id: `e${i}`, source: n.id, target: nodes[i + 1].id }))
              return { nodes, edges }
            }

            async function saveSteps(steps) {
              const mapData = stepsToMapData(steps)
              const updated = { ...editingMap, data: mapData }
              setEditingMap(updated)
              await api.updateMap(editingMap.id, updated).catch(() => {})
            }

            async function generateSteps() {
              if (!mapEditorDesc.trim()) return
              setMapGenerating(true)
              let acc = ''
              streamAgent('chief-of-staff', [{ role: 'user', content: `You are a Lean Six Sigma expert. Map this process into 5–9 structured steps for an Amazon FC process map.
Process: "${mapEditorDesc}"
For each step include who does it (lane: Operator, TeamLeader, or System) and any TIMWOOD waste type if applicable.
Output ONLY JSON array: [{"text":"step description","lane":"Operator","waste":"WasteType or empty string"}]` }], null,
                chunk => { acc += chunk },
                async () => {
                  try {
                    const parsed = JSON.parse(acc.replace(/```json|```/g, '').trim())
                    if (Array.isArray(parsed)) {
                      const steps = parsed.map((s, i) => ({ ...s, id: Date.now() + i }))
                      setMapEditorSteps(steps)
                      await saveSteps(steps)
                    }
                  } catch { /* ignore */ }
                  setMapGenerating(false)
                },
                () => setMapGenerating(false)
              )
            }

            function addStep(e) {
              e.preventDefault()
              if (!mapNewStep.text.trim()) return
              const steps = [...mapEditorSteps, { ...mapNewStep, id: Date.now() }]
              setMapEditorSteps(steps)
              setMapNewStep({ text: '', lane: 'Operator', waste: '' })
              saveSteps(steps)
            }

            function removeStep(id) {
              const steps = mapEditorSteps.filter(s => s.id !== id)
              setMapEditorSteps(steps)
              saveSteps(steps)
            }

            function moveStep(id, dir) {
              const idx = mapEditorSteps.findIndex(s => s.id === id)
              if (idx < 0) return
              const newIdx = idx + dir
              if (newIdx < 0 || newIdx >= mapEditorSteps.length) return
              const steps = [...mapEditorSteps]
              ;[steps[idx], steps[newIdx]] = [steps[newIdx], steps[idx]]
              setMapEditorSteps(steps)
              saveSteps(steps)
            }

            function updateStep(id, field, val) {
              const steps = mapEditorSteps.map(s => s.id === id ? { ...s, [field]: val } : s)
              setMapEditorSteps(steps)
              saveSteps(steps)
            }

            const mapPreviewData = stepsToMapData(mapEditorSteps)

            return (
              <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg-page)', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>{editingMap.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
                      {mapEditorSteps.length} steps
                    </span>
                    {mapEditorSteps.some(s => s.waste) && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.1)', color: '#fb923c' }}>
                        {mapEditorSteps.filter(s => s.waste).length} waste points
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setMapShowPreview(p => !p)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold border"
                      style={{ background: mapShowPreview ? 'rgba(59,127,222,0.1)' : 'var(--bg-input)', color: mapShowPreview ? '#60a5fa' : 'var(--text-2)', borderColor: mapShowPreview ? 'rgba(59,127,222,0.3)' : 'var(--border)' }}>
                      {mapShowPreview ? '✏ Edit Steps' : '⬡ Preview Map'}
                    </button>
                    <button onClick={async () => {
                      setEditingMap(null)
                      const maps = await api.getMaps().catch(() => [])
                      setStandaloneMaps(maps)
                    }} className="px-4 py-1.5 rounded-xl text-sm font-semibold"
                      style={{ background: '#E8820C', color: 'white' }}>
                      Done
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px', maxWidth: 860 }}>
                  {!mapShowPreview ? (
                    <div className="space-y-5">
                      {/* Step 1: Describe */}
                      <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'rgba(232,130,12,0.05)', borderColor: 'rgba(232,130,12,0.2)' }}>
                        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#E8820C' }}>1 · Describe the Process</span>
                        <textarea
                          value={mapEditorDesc}
                          onChange={e => setMapEditorDesc(e.target.value)}
                          placeholder="Describe what happens in this process from start to finish, in plain English. Who does what, how long, where problems occur…"
                          rows={3}
                          className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none"
                          style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
                        <button
                          onClick={generateSteps}
                          disabled={mapGenerating || !mapEditorDesc.trim()}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                          style={{ background: '#E8820C' }}>
                          {mapGenerating ? '⏳ Mapping process…' : '⚡ AI Generate Map'}
                        </button>
                      </div>

                      {/* Step 2: Step list */}
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-3)' }}>
                          {mapEditorSteps.length > 0 ? '2 · Edit Steps' : '2 · Add Steps Manually'}
                        </div>
                        <div className="space-y-2">
                          {mapEditorSteps.map((s, i) => {
                            const wc = WASTE_COLORS_MAP[s.waste]
                            return (
                              <div key={s.id || i} className="flex items-start gap-2 group">
                                <div className="flex flex-col gap-0.5 flex-shrink-0 mt-1.5">
                                  <button type="button" onClick={() => moveStep(s.id, -1)} disabled={i === 0}
                                    className="text-[10px] w-5 h-4 flex items-center justify-center rounded disabled:opacity-20 hover:opacity-80"
                                    style={{ color: 'var(--text-3)', background: 'var(--bg-input)' }}>▲</button>
                                  <button type="button" onClick={() => moveStep(s.id, 1)} disabled={i === mapEditorSteps.length - 1}
                                    className="text-[10px] w-5 h-4 flex items-center justify-center rounded disabled:opacity-20 hover:opacity-80"
                                    style={{ color: 'var(--text-3)', background: 'var(--bg-input)' }}>▼</button>
                                </div>
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-2"
                                  style={{ background: 'rgba(232,130,12,0.15)', color: '#E8820C' }}>{i + 1}</div>
                                <div className="flex-1 rounded-xl border px-3 py-2.5"
                                  style={{
                                    background: 'var(--bg-input)',
                                    borderColor: wc ? `${wc}50` : 'var(--border2)',
                                    borderLeftWidth: 3,
                                    borderLeftColor: s.lane === 'Operator' ? '#3B7FDE' : s.lane === 'Team Leader' ? '#E8820C' : '#7C3AED',
                                  }}>
                                  <input value={s.text} onChange={e => updateStep(s.id, 'text', e.target.value)}
                                    className="w-full bg-transparent text-sm outline-none mb-2 font-medium" style={{ color: 'var(--text-1)' }} />
                                  <div className="flex items-center gap-3">
                                    <select value={s.lane || 'Operator'} onChange={e => updateStep(s.id, 'lane', e.target.value)}
                                      className="text-xs rounded px-2 py-0.5 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-2)' }}>
                                      {LANES.map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                    <select value={s.waste || ''} onChange={e => updateStep(s.id, 'waste', e.target.value)}
                                      className="text-xs rounded px-2 py-0.5 border flex-1" style={{ background: wc ? `${wc}10` : 'var(--bg-card)', borderColor: 'var(--border)', color: wc || 'var(--text-3)' }}>
                                      {WASTE_TYPES_MAP.map(w => <option key={w} value={w}>{w || '— No waste —'}</option>)}
                                    </select>
                                  </div>
                                </div>
                                <button onClick={() => removeStep(s.id)}
                                  className="opacity-0 group-hover:opacity-100 mt-2.5 text-xs" style={{ color: 'var(--text-3)' }}>✕</button>
                              </div>
                            )
                          })}
                        </div>

                        {/* Add step */}
                        <form onSubmit={addStep} className="flex gap-2 items-center mt-3">
                          <input value={mapNewStep.text} onChange={e => setMapNewStep(s => ({ ...s, text: e.target.value }))}
                            placeholder="+ Add a process step…"
                            className="flex-1 text-sm rounded-xl border px-3 py-2"
                            style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
                          <select value={mapNewStep.lane} onChange={e => setMapNewStep(s => ({ ...s, lane: e.target.value }))}
                            className="text-sm rounded-xl border px-3 py-2"
                            style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }}>
                            {LANES.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                          <select value={mapNewStep.waste} onChange={e => setMapNewStep(s => ({ ...s, waste: e.target.value }))}
                            className="text-sm rounded-xl border px-3 py-2"
                            style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }}>
                            {WASTE_TYPES_MAP.map(w => <option key={w} value={w}>{w || 'No waste'}</option>)}
                          </select>
                          <button type="submit" disabled={!mapNewStep.text.trim()}
                            className="px-3 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                            style={{ background: '#E8820C' }}>Add</button>
                        </form>
                      </div>

                      {mapEditorSteps.length === 0 && (
                        <div className="text-xs text-center py-6" style={{ color: 'var(--text-3)' }}>
                          Describe the process above and click AI Generate, or add steps manually below
                        </div>
                      )}
                    </div>
                  ) : (
                    mapPreviewData.nodes.length > 0
                      ? <ProcessMap mapData={mapPreviewData} />
                      : <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: 'var(--text-3)' }}>
                          <span className="text-4xl">⬡</span>
                          <span className="text-sm">Add steps first to preview the map</span>
                        </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Site Process Maps — standalone */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-lg" style={{ color: 'var(--text-1)' }}>Site Process Maps</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Map your site processes here before you start projects. Understanding how things work now is the foundation of every improvement.</p>
              </div>
              <button onClick={() => setShowNewMapForm(f => !f)}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: '#E8820C', color: 'white' }}>
                + New Map
              </button>
            </div>

            {showNewMapForm && (
              <div className="card p-5 mb-5">
                <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--text-1)' }}>Create Site Process Map</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--text-3)' }}>Title</label>
                    <input value={newMapTitle} onChange={e => setNewMapTitle(e.target.value)} placeholder="e.g. Inbound receiving process"
                      className="w-full text-sm rounded-xl border px-3 py-2"
                      style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--text-3)' }}>Area</label>
                    <select value={newMapArea} onChange={e => setNewMapArea(e.target.value)}
                      className="w-full text-sm rounded-xl border px-3 py-2"
                      style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }}>
                      {['Inbound','Stow','Pick','Pack','Dispatch','Yard','Admin','General'].map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--text-3)' }}>Map Type</label>
                    <select value={newMapType} onChange={e => setNewMapType(e.target.value)}
                      className="w-full text-sm rounded-xl border px-3 py-2"
                      style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }}>
                      <option value="current">Current State</option>
                      <option value="future">Future State</option>
                      <option value="general">General</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--text-3)' }}>Description</label>
                    <input value={newMapDesc} onChange={e => setNewMapDesc(e.target.value)} placeholder="Brief description (optional)"
                      className="w-full text-sm rounded-xl border px-3 py-2"
                      style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={async () => {
                    if (!newMapTitle.trim()) return
                    const created = await api.createMap({ title: newMapTitle, area: newMapArea, map_type: newMapType, description: newMapDesc, data: { nodes: [], edges: [] } }).catch(() => null)
                    if (created) {
                      setStandaloneMaps(prev => [created, ...prev])
                      setEditingMap(created)
                      setMapEditorSteps([])
                      setMapEditorDesc('')
                      setMapShowPreview(false)
                    }
                    setShowNewMapForm(false)
                    setNewMapTitle(''); setNewMapDesc('')
                  }} disabled={!newMapTitle.trim()}
                    className="px-5 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                    style={{ background: '#E8820C' }}>
                    Create & Open Editor
                  </button>
                  <button onClick={() => setShowNewMapForm(false)}
                    className="px-4 py-2 rounded-xl text-sm"
                    style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {standaloneMaps.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="text-5xl mb-4" style={{ color: 'var(--text-3)' }}>⬡</div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>No site maps yet</p>
                <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: 'var(--text-3)' }}>Map your site processes here before you start projects. Understanding how things work now is the foundation of every improvement.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {standaloneMaps.map(m => {
                  const typeLabels = { current: 'Current State', future: 'Future State', general: 'General' }
                  const typeColors = { current: '#3B7FDE', future: '#16A34A', general: '#7C3AED' }
                  const tc = typeColors[m.map_type] || '#6B7280'
                  const isLinked = mapLinks[m.id]?.length > 0
                  return (
                    <div key={m.id} className="card p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{m.title}</div>
                          <div className="flex gap-2 mt-1.5 flex-wrap">
                            {m.area && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)', color: 'var(--text-3)' }}>{m.area}</span>}
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${tc}15`, color: tc }}>{typeLabels[m.map_type] || m.map_type}</span>
                            {isLinked && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,127,222,0.1)', color: '#60a5fa' }}>
                                🔗 linked
                              </span>
                            )}
                          </div>
                          {m.description && <p className="text-xs mt-1.5" style={{ color: 'var(--text-3)' }}>{m.description}</p>}
                          <div className="text-[10px] mt-1.5" style={{ color: 'var(--text-3)' }}>Created {new Date(m.created_at).toLocaleDateString('en-GB')}</div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => {
                          setEditingMap(m)
                          const existingSteps = (m.data?.nodes || []).map(n => ({ id: n.id, text: n.label, lane: n.lane || 'Operator', waste: n.waste || '' }))
                          setMapEditorSteps(existingSteps)
                          setMapEditorDesc(m.description || '')
                          setMapShowPreview(false)
                        }}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white"
                          style={{ background: '#E8820C' }}>
                          ✏ Edit Map
                        </button>
                        <button onClick={() => { setPresentMapData(m.data); setPresenting('map') }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: 'var(--bg-input)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                          ▶ Present
                        </button>
                        <button onClick={async () => {
                          await api.deleteMap(m.id).catch(() => {})
                          setStandaloneMaps(prev => prev.filter(x => x.id !== m.id))
                        }} className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: 'rgba(220,38,38,0.08)', color: '#f87171', border: '1px solid rgba(220,38,38,0.2)' }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Project Maps */}
          <div>
            <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--text-1)' }}>Project Maps</h2>
            {allProjects.filter(p => p.maps?.length > 0).length === 0 ? (
              <div className="card p-10 text-center">
                <div className="text-4xl mb-3" style={{ color: 'var(--text-3)' }}>⬡</div>
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>Generate maps inside your projects from the Maps tab</p>
              </div>
            ) : (
              <div className="space-y-4">
                {allProjects.filter(p => p.maps?.length > 0).map(p =>
                  p.maps.map((m, i) => (
                    <div key={`${p.id}-${i}`} className="card p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="font-semibold" style={{ color: 'var(--text-1)' }}>{p.title}</div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                            {m.type === 'current' ? 'Current State Map' : 'Future State Map'} · {new Date(m.createdAt).toLocaleDateString('en-GB')}
                            <span className="ml-3">{m.data?.nodes?.length || 0} steps</span>
                          </div>
                        </div>
                        <button onClick={() => { setPresentMapData(m.data); setPresenting('map') }}
                          className="px-4 py-2 rounded-xl text-sm font-semibold"
                          style={{ background: '#E8820C', color: 'white' }}>
                          ▶ Present
                        </button>
                      </div>
                      <ProcessMap mapData={m.data} />
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
