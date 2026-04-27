import { useState, useEffect, useMemo, useRef } from 'react'
import { api } from '../lib/api.js'
import {
  BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer,
} from 'recharts'

// ── ISO week helpers ──────────────────────────────────────────────────────────
function isoWeek(d = new Date()) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  dt.setUTCDate(dt.getUTCDate() + 4 - (dt.getUTCDay() || 7))
  const y1 = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))
  return { week: Math.ceil((((dt - y1) / 86400000) + 1) / 7), year: dt.getUTCFullYear() }
}

// ── Metric helpers ────────────────────────────────────────────────────────────
const DEF_TGT = { parcel_uph: 100, vendor_uph: 250, transfer_uph: 100, rcv_uph: 150, stow_uph: 150 }

function derive(e) {
  const rcvU = (e.parcel_units||0)+(e.vendor_units||0)+(e.transfer_units||0)
  const rcvH = (e.parcel_hours||0)+(e.vendor_hours||0)+(e.transfer_hours||0)
  return {
    ...e,
    parcel_uph:   e.parcel_hours>0   ? e.parcel_units/e.parcel_hours     : null,
    vendor_uph:   e.vendor_hours>0   ? e.vendor_units/e.vendor_hours     : null,
    transfer_uph: e.transfer_hours>0 ? e.transfer_units/e.transfer_hours : null,
    stow_uph:     e.stow_hours>0     ? e.stow_units/e.stow_hours         : null,
    rcv_total_units: rcvU, rcv_hours_total: rcvH,
    rcv_uph: rcvH>0 ? rcvU/rcvH : null,
  }
}

function scoreUph(actual, target) {
  if (actual === null || !target) return null
  return Math.min((actual / target) * 100, 100)
}
function scoreBacklog(backlog, rcvTotal) {
  if (!rcvTotal) return 100
  return Math.max(0, 100 - (backlog / rcvTotal) * 200)
}

function calcHealth(entries, targets) {
  if (!entries.length) return { score: null, components: {} }
  const t = { ...DEF_TGT, ...targets }
  const tot = entries.reduce((a, e) => ({
    pu: a.pu+(e.parcel_units||0),   ph: a.ph+(e.parcel_hours||0),
    vu: a.vu+(e.vendor_units||0),   vh: a.vh+(e.vendor_hours||0),
    tu: a.tu+(e.transfer_units||0), th: a.th+(e.transfer_hours||0),
    su: a.su+(e.stow_units||0),     sh: a.sh+(e.stow_hours||0),
  }), {pu:0,ph:0,vu:0,vh:0,tu:0,th:0,su:0,sh:0})
  const rcvU=tot.pu+tot.vu+tot.tu, rcvH=tot.ph+tot.vh+tot.th
  const latest=[...entries].sort((a,b)=>b.entry_date.localeCompare(a.entry_date))[0]
  const latestRcv=latest?((latest.parcel_units||0)+(latest.vendor_units||0)+(latest.transfer_units||0)):0
  const comp = {
    rcv_uph:      { score: scoreUph(rcvH>0?rcvU/rcvH:null, t.rcv_uph),           weight:30, label:'RCV UPH' },
    stow_uph:     { score: scoreUph(tot.sh>0?tot.su/tot.sh:null, t.stow_uph),     weight:35, label:'Stow UPH' },
    backlog:      { score: latest?scoreBacklog(latest.backlog_rcv_total||0,latestRcv):null, weight:25, label:'Backlog' },
    parcel_uph:   { score: scoreUph(tot.ph>0?tot.pu/tot.ph:null, t.parcel_uph),   weight:5,  label:'Parcel UPH' },
    vendor_uph:   { score: scoreUph(tot.vh>0?tot.vu/tot.vh:null, t.vendor_uph),   weight:3,  label:'Vendor UPH' },
    transfer_uph: { score: scoreUph(tot.th>0?tot.tu/tot.th:null, t.transfer_uph), weight:2,  label:'Transfer UPH' },
  }
  let ws=0, aw=0
  for (const c of Object.values(comp)) { if (c.score!==null) { ws+=c.score*c.weight; aw+=c.weight } }
  return { score: aw>0 ? Math.round(ws/aw) : null, components: comp, totals: tot, rcvU, rcvH }
}

function ragC(s,hi=85,lo=70) { return s===null?'#94A3B8':s>=hi?'#22C55E':s>=lo?'#F59E0B':'#EF4444' }
function ragL(s,hi=85,lo=70) { return s===null?'No data':s>=hi?'On Track':s>=lo?'Monitor':'At Risk' }
function uphRag(u,t)         { if(u===null)return{c:'#94A3B8',l:'No data'}; const p=(u/t)*100; return p>=95?{c:'#22C55E',l:'On Track'}:p>=80?{c:'#F59E0B',l:'Monitor'}:{c:'#EF4444',l:'At Risk'} }

const n0  = v => v==null?'--':Math.round(v).toLocaleString()
const n1  = v => v==null?'--':Number(v).toFixed(1)
const fmtD = d => new Date(d+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})

// ── Shared styles ─────────────────────────────────────────────────────────────
const card  = { background:'rgba(17,17,20,0.6)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, overflow:'hidden' }
const iS    = { width:'100%', padding:'7px 10px', borderRadius:7, background:'rgba(0,0,0,0.35)', border:'1px solid rgba(255,255,255,0.09)', color:'var(--text-1)', fontSize:13, outline:'none', boxSizing:'border-box' }
const TT_S  = { fontSize:11, borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'#1C2035', color:'#E4E6F0' }
const TICK  = { fontSize:10, fill:'#4E5268' }

function RagPill({ score, label }) {
  const c = ragC(score), l = label ?? ragL(score)
  return <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:999, background:`${c}18`, color:c, border:`1px solid ${c}28` }}>{l}</span>
}

// ── Contextual help tooltip ───────────────────────────────────────────────────
function HelpTip({ text }) {
  const [show, setShow]     = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)

  function onEnter() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setCoords({ top: r.top - 8, left: r.left + r.width / 2 })
    }
    setShow(true)
  }

  return (
    <span style={{ display:'inline-flex', verticalAlign:'middle', marginLeft:6, flexShrink:0 }}>
      <button
        ref={btnRef}
        onMouseEnter={onEnter} onMouseLeave={()=>setShow(false)}
        onClick={e=>e.stopPropagation()}
        style={{ width:16, height:16, borderRadius:'50%', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.22)', color:'#94A3B8', fontSize:9, fontWeight:700, cursor:'help', display:'inline-flex', alignItems:'center', justifyContent:'center', padding:0, flexShrink:0 }}
      >?</button>
      {show && (
        <div style={{ position:'fixed', top:coords.top, left:coords.left, transform:'translate(-50%,-100%)', background:'#1C2035', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, padding:'10px 12px', fontSize:11, color:'#CBD5E1', lineHeight:1.55, width:240, zIndex:99999, boxShadow:'0 8px 24px rgba(0,0,0,0.6)', pointerEvents:'none', whiteSpace:'normal' }}>
          {text}
          <div style={{ position:'absolute', bottom:-5, left:'50%', transform:'translateX(-50%) rotate(45deg)', width:8, height:8, background:'#1C2035', borderRight:'1px solid rgba(255,255,255,0.12)', borderBottom:'1px solid rgba(255,255,255,0.12)' }}/>
        </div>
      )}
    </span>
  )
}

// ── Simple UPH per-shift bar chart ────────────────────────────────────────────
function UphShiftChart({ entries, uphKey, target, label }) {
  const data = entries
    .filter(e => e[uphKey] != null)
    .map(e => ({
      name: new Date(e.entry_date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric'}) + (e.shift==='day'?' ☀':' 🌙'),
      uph:  Math.round(e[uphKey] * 10) / 10,
      fill: e[uphKey] >= target ? '#22C55E' : e[uphKey] >= target * 0.85 ? '#F59E0B' : '#EF4444',
    }))

  if (!data.length) return (
    <div style={{ padding:'20px 0', textAlign:'center', fontSize:12, color:'var(--text-3)', fontStyle:'italic' }}>No data to chart yet</div>
  )

  const maxY = Math.ceil(Math.max(...data.map(d=>d.uph), target) * 1.25)

  return (
    <div>
      <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-3)', marginBottom:8 }}>
        {label} per shift — dashed line = target ({target})
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={data} margin={{ top:24, right:16, bottom:0, left:0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)"/>
          <XAxis dataKey="name" tick={TICK} axisLine={false} tickLine={false}/>
          <YAxis tick={TICK} axisLine={false} tickLine={false} width={36} domain={[0, maxY]}/>
          <Tooltip contentStyle={TT_S} formatter={v=>[`${v} UPH`, label]}/>
          <ReferenceLine y={target} stroke="#fbbf24" strokeDasharray="5 4" strokeWidth={1.5}
            label={{ value:`Target: ${target}`, position:'insideTopRight', fill:'#fbbf24', fontSize:10 }}/>
          <Bar dataKey="uph" radius={[4,4,0,0]}
            label={{ position:'top', fontSize:11, fontWeight:700, fill:'#CBD5E1', formatter: v => v != null ? v.toFixed(1) : '' }}>
            {data.map((d,i) => <Cell key={i} fill={d.fill}/>)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display:'flex', gap:16, justifyContent:'center', marginTop:8, fontSize:10, color:'var(--text-3)' }}>
        <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'#22C55E', marginRight:4, verticalAlign:'middle' }}/>On target</span>
        <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'#F59E0B', marginRight:4, verticalAlign:'middle' }}/>Close to target</span>
        <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'#EF4444', marginRight:4, verticalAlign:'middle' }}/>Below target</span>
      </div>
    </div>
  )
}

// ── Backlog bar chart ─────────────────────────────────────────────────────────
function BacklogBarChart({ entries }) {
  const data = [...entries]
    .sort((a,b) => a.entry_date.localeCompare(b.entry_date)||(a.shift==='day'?-1:1))
    .map(e => ({
      name: new Date(e.entry_date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric'}) + (e.shift==='day'?' ☀':' 🌙'),
      backlog: e.backlog_rcv_total || 0,
      fill: (e.backlog_rcv_total||0) === 0 ? '#22C55E' : (e.backlog_rcv_total||0) < 300 ? '#F59E0B' : '#EF4444',
    }))

  if (!data.length) return null

  return (
    <div>
      <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-3)', marginBottom:8 }}>
        Units left in backlog at end of each shift — lower is better, target = 0
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={data} margin={{ top:24, right:16, bottom:0, left:0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)"/>
          <XAxis dataKey="name" tick={TICK} axisLine={false} tickLine={false}/>
          <YAxis tick={TICK} axisLine={false} tickLine={false} width={48}/>
          <Tooltip contentStyle={TT_S} formatter={v=>[`${v.toLocaleString()} units`,'Backlog']}/>
          <ReferenceLine y={0} stroke="#22C55E" strokeDasharray="4 4" strokeWidth={1.5}
            label={{ value:'Target: 0', position:'insideTopLeft', fill:'#22C55E', fontSize:10 }}/>
          <Bar dataKey="backlog" radius={[4,4,0,0]}
            label={{ position:'top', fontSize:11, fontWeight:700, fill:'#CBD5E1', formatter: v => v != null ? v.toLocaleString() : '' }}>
            {data.map((d,i) => <Cell key={i} fill={d.fill}/>)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display:'flex', gap:16, justifyContent:'center', marginTop:8, fontSize:10, color:'var(--text-3)' }}>
        <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'#22C55E', marginRight:4, verticalAlign:'middle' }}/>Zero backlog</span>
        <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'#F59E0B', marginRight:4, verticalAlign:'middle' }}/>&lt;300 units</span>
        <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'#EF4444', marginRight:4, verticalAlign:'middle' }}/>300+ units</span>
      </div>
    </div>
  )
}

// ── Entry Form ────────────────────────────────────────────────────────────────
function EntryForm({ initial, targets, onSave, onClose, existingEntries }) {
  const today = new Date().toISOString().split('T')[0]
  const [f, setF] = useState({ entry_date:today, shift:'day', parcel_units:'', parcel_hours:'', vendor_units:'', vendor_hours:'', transfer_units:'', transfer_hours:'', stow_units:'', stow_hours:'', backlog_rcv_total:'', notes:'', ...(initial||{}) })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  const set = (k,v) => setF(p=>({...p,[k]:v}))

  const uph = (u,h) => { const un=parseFloat(u)||0,hn=parseFloat(h)||0; return (un>0&&hn>0)?( un/hn).toFixed(1):null }
  const rcvU = (parseFloat(f.parcel_units)||0)+(parseFloat(f.vendor_units)||0)+(parseFloat(f.transfer_units)||0)
  const rcvH = (parseFloat(f.parcel_hours)||0)+(parseFloat(f.vendor_hours)||0)+(parseFloat(f.transfer_hours)||0)
  const rcvUph = rcvH>0 ? (rcvU/rcvH).toFixed(1) : null
  const t = {...DEF_TGT,...targets}

  const duplicate = !initial?.id && existingEntries?.some(e=>e.entry_date===f.entry_date&&e.shift===f.shift)

  async function submit(e) {
    e.preventDefault(); setErr(''); setSaving(true)
    try {
      const { week, year } = isoWeek(new Date(f.entry_date+'T12:00:00'))
      const payload = { ...f, week_number:week, year,
        parcel_units:parseInt(f.parcel_units)||0, parcel_hours:parseFloat(f.parcel_hours)||0,
        vendor_units:parseInt(f.vendor_units)||0, vendor_hours:parseFloat(f.vendor_hours)||0,
        transfer_units:parseInt(f.transfer_units)||0, transfer_hours:parseFloat(f.transfer_hours)||0,
        stow_units:parseInt(f.stow_units)||0, stow_hours:parseFloat(f.stow_hours)||0,
        backlog_rcv_total:parseInt(f.backlog_rcv_total)||0 }
      if (initial?.id) await api.updateInboundEntry(initial.id, payload)
      else await api.addInboundEntry(payload)
      onSave()
    } catch(ex) { setErr(ex.message||'Save failed') } finally { setSaving(false) }
  }

  function RRow({ label, uk, hk }) {
    const un=parseInt(f[uk])||0, hn=parseFloat(f[hk])||0, warn=un>0&&hn===0
    return (
      <div style={{marginBottom:12}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-3)',marginBottom:6}}>{label}</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 72px',gap:8,alignItems:'end'}}>
          <div><label style={{fontSize:10,color:'var(--text-3)',display:'block',marginBottom:3}}>Units</label>
            <input type="number" min="0" value={f[uk]} onChange={e=>set(uk,e.target.value)} style={iS}/></div>
          <div><label style={{fontSize:10,color:'var(--text-3)',display:'block',marginBottom:3}}>Hours</label>
            <input type="number" min="0" step="0.5" value={f[hk]} onChange={e=>set(hk,e.target.value)} style={{...iS,borderColor:warn?'#F59E0B':'rgba(255,255,255,0.09)'}}/>
            {warn&&<div style={{fontSize:10,color:'#F59E0B',marginTop:2}}>Hours cannot be 0</div>}</div>
          <div style={{textAlign:'center'}}><div style={{fontSize:10,color:'var(--text-3)',marginBottom:3}}>UPH</div>
            <div style={{fontSize:15,fontWeight:700,color:uph(f[uk],f[hk])?'var(--text-1)':'var(--text-3)'}}>{uph(f[uk],f[hk])??'--'}</div></div>
        </div>
      </div>
    )
  }

  return (
    <div style={{position:'fixed',inset:0,zIndex:9999,display:'flex',alignItems:'flex-start',justifyContent:'center',background:'rgba(0,0,0,0.75)',overflowY:'auto',padding:'32px 16px',boxSizing:'border-box'}}>
      <div style={{...card,width:520,borderRadius:18,boxShadow:'0 32px 80px rgba(0,0,0,0.7)',flexShrink:0,overflow:'visible'}}>
        <div style={{height:2,background:'linear-gradient(90deg,#f97316,rgba(249,115,22,0.1))'}}/>
        <div style={{padding:'18px 24px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontSize:15,fontWeight:700,color:'var(--text-1)'}}>{initial?.id?'Edit Shift Entry':'Log Shift Data'}</div>
          <button onClick={onClose} style={{fontSize:16,background:'none',border:'none',color:'var(--text-3)',cursor:'pointer'}}>✕</button>
        </div>
        <form onSubmit={submit} style={{padding:'20px 24px'}}>
          {/* Date + Shift */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
            <div><label style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-3)',display:'block',marginBottom:6}}>Date</label>
              <input type="date" value={f.entry_date} onChange={e=>set('entry_date',e.target.value)} style={iS}/></div>
            <div><label style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-3)',display:'block',marginBottom:6}}>Shift</label>
              <div style={{display:'flex',gap:8}}>
                {['day','night'].map(s=>(
                  <button key={s} type="button" onClick={()=>set('shift',s)} style={{flex:1,padding:'8px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',
                    background:f.shift===s?'rgba(249,115,22,0.15)':'rgba(0,0,0,0.2)',
                    border:f.shift===s?'1px solid rgba(249,115,22,0.4)':'1px solid rgba(255,255,255,0.09)',
                    color:f.shift===s?'#f97316':'var(--text-2)'}}>
                    {s==='day'?'Day Shift':'Night Shift'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {duplicate && <div style={{padding:'8px 12px',background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:8,fontSize:12,color:'#fbbf24',marginBottom:12}}>An entry for {f.shift==='day'?'Day':'Night'} shift on {f.entry_date} already exists. Saving will overwrite it.</div>}

          {/* Receive */}
          <div style={{background:'rgba(255,255,255,0.025)',borderRadius:10,padding:14,marginBottom:12}}>
            <RRow label="Parcel Receive"   uk="parcel_units"   hk="parcel_hours"/>
            <RRow label="Vendor Receive"   uk="vendor_units"   hk="vendor_hours"/>
            <RRow label="Transfer Receive" uk="transfer_units" hk="transfer_hours"/>
            <div style={{paddingTop:10,marginTop:4,borderTop:'1px solid rgba(255,255,255,0.07)',display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              {[['RCV Total Units',rcvU.toLocaleString()],['RCV Hours Total',rcvH.toFixed(1)],['RCV UPH',rcvUph??'--']].map(([l,v])=>(
                <div key={l}><div style={{fontSize:10,color:'var(--text-3)',marginBottom:2}}>{l}</div>
                  <div style={{fontSize:14,fontWeight:700,color:'var(--text-1)'}}>{v}</div></div>
              ))}
            </div>
          </div>

          {/* Stow */}
          <div style={{background:'rgba(255,255,255,0.025)',borderRadius:10,padding:14,marginBottom:12}}>
            <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-3)',marginBottom:10}}>Stow</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 72px',gap:8,alignItems:'end'}}>
              <div><label style={{fontSize:10,color:'var(--text-3)',display:'block',marginBottom:3}}>Units</label>
                <input type="number" min="0" value={f.stow_units} onChange={e=>set('stow_units',e.target.value)} style={iS}/></div>
              <div><label style={{fontSize:10,color:'var(--text-3)',display:'block',marginBottom:3}}>Hours</label>
                <input type="number" min="0" step="0.5" value={f.stow_hours} onChange={e=>set('stow_hours',e.target.value)} style={iS}/></div>
              <div style={{textAlign:'center'}}><div style={{fontSize:10,color:'var(--text-3)',marginBottom:3}}>UPH</div>
                <div style={{fontSize:15,fontWeight:700,color:uph(f.stow_units,f.stow_hours)?'var(--text-1)':'var(--text-3)'}}>{uph(f.stow_units,f.stow_hours)??'--'}</div></div>
            </div>
          </div>

          {/* Backlog */}
          <div style={{background:'rgba(245,158,11,0.04)',borderRadius:10,padding:14,border:'1px solid rgba(245,158,11,0.15)',marginBottom:16}}>
            <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'#F59E0B',marginBottom:8}}>Backlog Receive Total</div>
            <input type="number" min="0" value={f.backlog_rcv_total} onChange={e=>set('backlog_rcv_total',e.target.value)} style={{...iS,fontSize:16,fontWeight:600}}/>
            <div style={{fontSize:10,color:'var(--text-3)',marginTop:5}}>Units received but not yet stowed at shift handover. Enter the figure from the outgoing shift.</div>
          </div>

          {/* Notes */}
          <div style={{marginBottom:20}}>
            <label style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-3)',display:'block',marginBottom:6}}>Notes (optional)</label>
            <textarea rows={2} value={f.notes} onChange={e=>set('notes',e.target.value)} style={{...iS,resize:'vertical'}}/>
          </div>

          {err&&<div style={{padding:'8px 12px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:8,fontSize:12,color:'#f87171',marginBottom:12}}>{err}</div>}
          <div style={{display:'flex',gap:8}}>
            <button type="button" onClick={onClose} style={{flex:1,padding:'10px',borderRadius:10,fontSize:13,fontWeight:600,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',color:'var(--text-2)',cursor:'pointer'}}>Cancel</button>
            <button type="submit" disabled={saving} style={{flex:2,padding:'10px',borderRadius:10,fontSize:13,fontWeight:700,background:'linear-gradient(135deg,#f97316,#c2410c)',color:'white',border:'none',cursor:'pointer',opacity:saving?0.6:1}}>
              {saving?'Saving...':'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Health Score Card ─────────────────────────────────────────────────────────
function HealthCard({ health, weekNum, shiftCount }) {
  const { score, components } = health
  const c = ragC(score), l = ragL(score)
  return (
    <div style={{...card,padding:24,marginBottom:20}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:24}}>
        {/* Score display */}
        <div style={{textAlign:'center',flexShrink:0}}>
          <div style={{fontSize:72,fontWeight:800,letterSpacing:'-4px',color:c,lineHeight:1}}>{score??'--'}</div>
          <div style={{fontSize:10,color:'var(--text-3)',marginTop:2}}>/100</div>
          <div style={{marginTop:8,padding:'3px 12px',borderRadius:999,background:`${c}18`,color:c,border:`1px solid ${c}28`,fontSize:11,fontWeight:700}}>{l}</div>
        </div>
        {/* Title + breakdown */}
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center'}}>
            <span style={{fontSize:18,fontWeight:700,color:'var(--text-1)'}}>Weekly Health Score</span>
            <HelpTip text="Weighted score based on this week's inbound data. RCV UPH 30% + Stow UPH 35% + Backlog 25% + Parcel UPH 5% + Vendor UPH 3% + Transfer UPH 2%. Each metric scores 0–100 against its target. Green ≥85, Amber ≥70, Red below 70."/>
          </div>
          <div style={{fontSize:12,color:'var(--text-3)',marginBottom:16}}>W{weekNum} · {shiftCount} shift{shiftCount!==1?'s':''} logged this week</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            {Object.values(components).map(({label,score:s,weight})=>{
              const cc = ragC(s)
              return (
                <div key={label} style={{padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.03)',border:`1px solid rgba(255,255,255,0.06)`}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontSize:10,fontWeight:600,color:'var(--text-3)'}}>{label}</span>
                    <span style={{fontSize:9,color:'var(--text-3)'}}>{weight}%</span>
                  </div>
                  <div style={{height:3,borderRadius:999,background:'rgba(255,255,255,0.06)',overflow:'hidden',marginBottom:4}}>
                    <div style={{height:'100%',width:`${s??0}%`,background:cc,borderRadius:999,transition:'width 600ms ease'}}/>
                  </div>
                  <div style={{fontSize:12,fontWeight:700,color:cc}}>{s!==null?`${Math.round(s)}/100`:'--'}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Shift breakdown table ─────────────────────────────────────────────────────
function ShiftTable({ entries, cols }) {
  if (!entries.length) return <div style={{fontSize:12,color:'var(--text-3)',padding:'12px 0',fontStyle:'italic'}}>No shifts logged this week</div>
  return (
    <div style={{overflowX:'auto',marginTop:12}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
        <thead>
          <tr style={{borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
            <th style={{textAlign:'left',padding:'4px 8px',fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',fontSize:9,whiteSpace:'nowrap'}}>Date</th>
            <th style={{textAlign:'left',padding:'4px 8px',fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',fontSize:9}}>Shift</th>
            {cols.map(c=><th key={c.key} style={{textAlign:'right',padding:'4px 8px',fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',fontSize:9,whiteSpace:'nowrap'}}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {entries.map(e=>(
            <tr key={e.id} style={{borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
              <td style={{padding:'5px 8px',color:'var(--text-2)',whiteSpace:'nowrap'}}>{fmtD(e.entry_date)}</td>
              <td style={{padding:'5px 8px'}}><span style={{fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:4,background:e.shift==='day'?'rgba(232,130,12,0.15)':'rgba(96,165,250,0.15)',color:e.shift==='day'?'#E8820C':'#60a5fa'}}>{e.shift==='day'?'Day':'Night'}</span></td>
              {cols.map(c=>{
                const v=c.derive?c.derive(e):e[c.key]
                const color=c.rag?uphRag(v,c.rag).c:undefined
                return <td key={c.key} style={{padding:'5px 8px',textAlign:'right',fontWeight:c.bold?600:400,color:color||'var(--text-2)',fontVariantNumeric:'tabular-nums'}}>{v==null?'--':typeof v==='number'?c.dec?v.toFixed(c.dec):v.toLocaleString():v}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Receive Section ───────────────────────────────────────────────────────────
function ReceiveSection({ entries, targets }) {
  const [open, setOpen] = useState(true)
  const t = {...DEF_TGT,...targets}
  const tot = entries.reduce((a,e)=>({
    pu:a.pu+(e.parcel_units||0), ph:a.ph+(e.parcel_hours||0),
    vu:a.vu+(e.vendor_units||0), vh:a.vh+(e.vendor_hours||0),
    tu:a.tu+(e.transfer_units||0), th:a.th+(e.transfer_hours||0),
  }),{pu:0,ph:0,vu:0,vh:0,tu:0,th:0})
  const rcvU=tot.pu+tot.vu+tot.tu, rcvH=tot.ph+tot.vh+tot.th
  const rcvUph=rcvH>0?rcvU/rcvH:null
  const dr=uphRag(rcvUph,t.rcv_uph)

  const chartData = entries.map(e=>({
    name: fmtD(e.entry_date)+(e.shift==='day'?' D':' N'),
    parcel: e.parcel_units||0, vendor: e.vendor_units||0, transfer: e.transfer_units||0,
    rcv_uph: e.rcv_uph!=null?parseFloat(e.rcv_uph.toFixed(1)):null,
  }))

  const HELP = {
    parcel:   'Parcels received from courier vehicles. Target: 100 UPH. Low UPH often means slow scanning or staffing gaps at the dock.',
    vendor:   'Vendor/supplier deliveries — typically pallet or bulk freight. Target: 250 UPH. Usually faster to process than parcels.',
    transfer: 'Stock transferred in from other sites or fulfilment centres. Target: 100 UPH.',
  }

  const ReceiveSub = ({ label, unitKey, hourKey, uphKey, tgt, helpKey }) => {
    const su=entries.reduce((a,e)=>a+(e[unitKey]||0),0)
    const sh=entries.reduce((a,e)=>a+(e[hourKey]||0),0)
    const uph=sh>0?su/sh:null
    const r=uphRag(uph,tgt)
    return (
      <div style={{marginBottom:16,paddingBottom:16,borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <div style={{display:'flex',alignItems:'center'}}>
            <span style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--text-3)'}}>{label}</span>
            {helpKey && <HelpTip text={HELP[helpKey]}/>}
          </div>
          <RagPill score={uph!=null?(uph/tgt)*100:null} label={uph!=null?r.l:'No data'}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:10}}>
          {[['Units',n0(su)],['Hours',n1(sh)],['UPH',n1(uph)]].map(([l,v])=>(
            <div key={l}><div style={{fontSize:9,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:2}}>{l}</div>
              <div style={{fontSize:16,fontWeight:700,color:l==='UPH'?r.c:'var(--text-1)'}}>{v}</div></div>
          ))}
        </div>
        <ShiftTable entries={entries} cols={[
          {key:unitKey,label:'Units',bold:true},
          {key:hourKey,label:'Hours',dec:1},
          {key:uphKey,label:'UPH',dec:1,rag:tgt,bold:true},
        ]}/>
      </div>
    )
  }

  return (
    <div style={{...card,marginBottom:14}}>
      {/* Header */}
      <div style={{padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}} onClick={()=>setOpen(o=>!o)}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{display:'flex',alignItems:'center'}}>
            <span style={{fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--text-1)'}}>Receive</span>
            <HelpTip text="How many items are received and processed per hour (UPH). RCV UPH combines Parcel, Vendor and Transfer receive. Target: 150 UPH. Click to expand per-type breakdown."/>
          </div>
          <RagPill score={rcvUph!=null?(rcvUph/t.rcv_uph)*100:null} label={rcvUph!=null?dr.l:'No data'}/>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          {[['Total Units',n0(rcvU)],['Total Hours',n1(rcvH)],['RCV UPH',n1(rcvUph)]].map(([l,v])=>(
            <div key={l} style={{textAlign:'right'}}><div style={{fontSize:9,color:'var(--text-3)',textTransform:'uppercase',marginBottom:1}}>{l}</div>
              <div style={{fontSize:13,fontWeight:700,color:l==='RCV UPH'?dr.c:'var(--text-1)'}}>{v}</div></div>
          ))}
          <span style={{fontSize:12,color:'var(--text-3)',transform:open?'rotate(180deg)':'none',transition:'transform 0.2s',display:'inline-block'}}>▾</span>
        </div>
      </div>

      {open && (
        <div style={{padding:'0 20px 20px'}}>
          {/* Sub-sections */}
          <ReceiveSub label="Parcel Receive"   unitKey="parcel_units"   hourKey="parcel_hours"   uphKey="parcel_uph"   tgt={t.parcel_uph}   helpKey="parcel"/>
          <ReceiveSub label="Vendor Receive"   unitKey="vendor_units"   hourKey="vendor_hours"   uphKey="vendor_uph"   tgt={t.vendor_uph}   helpKey="vendor"/>
          <ReceiveSub label="Transfer Receive" unitKey="transfer_units" hourKey="transfer_hours" uphKey="transfer_uph" tgt={t.transfer_uph} helpKey="transfer"/>

          {/* Receive Totals summary */}
          <div style={{background:'rgba(255,255,255,0.025)',borderRadius:10,padding:'10px 14px',marginBottom:16}}>
            <div style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--text-3)',marginBottom:8}}>Receive Totals (calculated)</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
              {[['RCV Total Units',n0(rcvU)],['RCV Hours Total',n1(rcvH)],['RCV UPH',n1(rcvUph)]].map(([l,v])=>(
                <div key={l}><div style={{fontSize:9,color:'var(--text-3)',marginBottom:2}}>{l}</div>
                  <div style={{fontSize:16,fontWeight:700,color:l==='RCV UPH'?dr.c:'var(--text-1)'}}>{v}</div></div>
              ))}
            </div>
          </div>

          {/* RCV UPH chart — one bar per shift, coloured by performance vs target */}
          <UphShiftChart entries={entries} uphKey="rcv_uph" target={t.rcv_uph} label="RCV UPH"/>
        </div>
      )}
    </div>
  )
}

// ── Stow Section ──────────────────────────────────────────────────────────────
function StowSection({ entries, targets }) {
  const t = {...DEF_TGT,...targets}
  const su=entries.reduce((a,e)=>a+(e.stow_units||0),0)
  const sh=entries.reduce((a,e)=>a+(e.stow_hours||0),0)
  const uph=sh>0?su/sh:null
  const r=uphRag(uph,t.stow_uph)

  const chartData=entries.map(e=>({
    name:fmtD(e.entry_date)+(e.shift==='day'?' D':' N'),
    stow_units:e.stow_units||0,
    stow_uph:e.stow_uph!=null?parseFloat(e.stow_uph.toFixed(1)):null,
    rcv_uph:e.rcv_uph!=null?parseFloat(e.rcv_uph.toFixed(1)):null,
  }))

  return (
    <div style={{...card,marginBottom:14,padding:20}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center'}}>
          <span style={{fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--text-1)'}}>Stow</span>
          <HelpTip text="Stow UPH = how many received items are put away into pick locations per hour. Target: 150 UPH. If Stow UPH falls behind RCV UPH, backlog builds up — items pile up waiting to be stowed."/>
        </div>
        <RagPill score={uph!=null?(uph/t.stow_uph)*100:null} label={uph!=null?r.l:'No data'}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:20}}>
        {/* Metrics + table */}
        <div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
            {[['Weekly Units',n0(su),'var(--text-1)'],['Weekly Hours',n1(sh),'var(--text-1)'],['Stow UPH',n1(uph),r.c],['vs Target',`${t.stow_uph} UPH`,'var(--text-3)']].map(([l,v,col])=>(
              <div key={l} style={{padding:'10px 12px',background:'rgba(255,255,255,0.03)',borderRadius:8}}>
                <div style={{fontSize:9,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>{l}</div>
                <div style={{fontSize:18,fontWeight:700,color:col}}>{v}</div>
              </div>
            ))}
          </div>
          <ShiftTable entries={entries} cols={[
            {key:'stow_units',label:'Units',bold:true},
            {key:'stow_hours',label:'Hours',dec:1},
            {key:'stow_uph',label:'UPH',dec:1,rag:t.stow_uph,bold:true},
          ]}/>
        </div>
        {/* Stow UPH per shift chart */}
        <UphShiftChart entries={entries} uphKey="stow_uph" target={t.stow_uph} label="Stow UPH"/>
      </div>
    </div>
  )
}

// ── Backlog Section ───────────────────────────────────────────────────────────
function BacklogSection({ entries }) {
  const sorted=[...entries].sort((a,b)=>a.entry_date.localeCompare(b.entry_date)||(a.shift==='day'?-1:1))
  const latest=sorted[sorted.length-1]
  const backlog=latest?.backlog_rcv_total??null
  const chartData=sorted.map(e=>({name:fmtD(e.entry_date)+(e.shift==='day'?' D':' N'),backlog:e.backlog_rcv_total||0}))
  const trend=()=>{
    if(sorted.length<2)return{label:'Stable',c:'#F59E0B'}
    const first=sorted[0].backlog_rcv_total||0,last=sorted[sorted.length-1].backlog_rcv_total||0
    if(last>first*1.05)return{label:'Trending Up',c:'#EF4444'}
    if(last<first*0.95)return{label:'Trending Down',c:'#22C55E'}
    return{label:'Stable',c:'#F59E0B'}
  }
  const {label:tLabel,c:tColor}=trend()
  return (
    <div style={{...card,marginBottom:14,padding:20,borderColor:'rgba(245,158,11,0.2)'}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:16}}>
        <div>
          <div style={{display:'flex',alignItems:'center'}}>
            <span style={{fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'#F59E0B'}}>Backlog Receive Total</span>
            <HelpTip text="Backlog = units received but not yet stowed at shift handover. Target is always 0. A growing backlog means receive is outpacing stow — items are piling up faster than they're being put away. The outgoing shift must hand this number over accurately."/>
          </div>
          {latest&&<div style={{fontSize:10,color:'var(--text-3)',marginTop:3}}>Latest reading: {fmtD(latest.entry_date)} ({latest.shift==='day'?'Day':'Night'} shift)</div>}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:11,fontWeight:700,color:tColor}}>{tLabel}</span>
          <span style={{fontSize:9,padding:'2px 8px',borderRadius:999,background:'rgba(245,158,11,0.12)',color:'#F59E0B',border:'1px solid rgba(245,158,11,0.2)'}}>Target: 0</span>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'160px 1fr',gap:20,alignItems:'start'}}>
        <div>
          <div style={{fontSize:48,fontWeight:800,letterSpacing:'-2px',color:'#F59E0B',lineHeight:1}}>{backlog!=null?backlog.toLocaleString():'--'}</div>
          <div style={{fontSize:11,color:'var(--text-3)',marginTop:4}}>units in backlog</div>
          <div style={{marginTop:12}}>
            <ShiftTable entries={sorted} cols={[{key:'backlog_rcv_total',label:'Backlog',bold:true}]}/>
          </div>
        </div>
        <BacklogBarChart entries={sorted}/>
      </div>
    </div>
  )
}

// ── Main View ─────────────────────────────────────────────────────────────────
export default function InboundView({ readOnly }) {
  const now         = isoWeek()
  const [week, setWeek]       = useState(now.week)
  const [year, setYear]       = useState(now.year)
  const [shiftFilter, setShift] = useState('all')
  const [entries, setEntries] = useState([])
  const [targets, setTargets] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast]     = useState('')

  async function load() {
    setLoading(true)
    try {
      const [ents, tgts] = await Promise.all([
        api.getInboundEntries({ week, year }).catch(()=>[]),
        api.getInboundTargets().catch(()=>{}),
      ])
      setEntries(Array.isArray(ents) ? ents.map(derive) : [])
      if (tgts && typeof tgts==='object') setTargets(tgts)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [week, year])

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(''),3000) }

  async function handleSave() {
    await load()
    showToast('Shift entry saved')
    setShowForm(false); setEditEntry(null)
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this shift entry?')) return
    await api.deleteInboundEntry(id)
    await load()
    showToast('Entry deleted')
  }

  function prevWeek() {
    if (week===1) { setWeek(52); setYear(y=>y-1) } else setWeek(w=>w-1)
  }
  function nextWeek() {
    if (week===52) { setWeek(1); setYear(y=>y+1) } else setWeek(w=>w+1)
  }

  const filtered = shiftFilter==='all' ? entries : entries.filter(e=>e.shift===shiftFilter)
  const health   = useMemo(()=>calcHealth(filtered,targets),[filtered,targets])

  return (
    <div style={{maxWidth:1100,margin:'0 auto'}}>

      {/* Toast */}
      {toast&&(
        <div style={{position:'fixed',top:16,right:24,zIndex:9999,padding:'10px 18px',borderRadius:10,background:'rgba(34,197,94,0.12)',border:'1px solid rgba(34,197,94,0.25)',color:'#4ade80',fontSize:13,fontWeight:600,boxShadow:'0 4px 16px rgba(0,0,0,0.4)'}}>{toast}</div>
      )}

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:26,fontWeight:800,color:'var(--text-1)',letterSpacing:'-0.03em',margin:0}}>Inbound Operations</h1>
          <p style={{fontSize:13,color:'var(--text-3)',margin:'4px 0 0'}}>Shift KPI tracker — Receive, Stow, and Backlog</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          {/* Week nav */}
          <div style={{display:'flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,padding:'4px 8px'}}>
            <button onClick={prevWeek} style={{background:'none',border:'none',color:'var(--text-3)',cursor:'pointer',fontSize:14,padding:'2px 6px'}}>{'‹'}</button>
            <span style={{fontSize:13,fontWeight:600,color:'var(--text-1)',minWidth:60,textAlign:'center'}}>W{week} {year}</span>
            <button onClick={nextWeek} style={{background:'none',border:'none',color:'var(--text-3)',cursor:'pointer',fontSize:14,padding:'2px 6px'}}>{'›'}</button>
          </div>
          {/* Shift filter */}
          <div style={{display:'flex',gap:4,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,padding:4}}>
            {[['all','All'],['day','Day'],['night','Night']].map(([v,l])=>(
              <button key={v} onClick={()=>setShift(v)} style={{padding:'4px 12px',borderRadius:7,fontSize:11,fontWeight:600,cursor:'pointer',border:'none',
                background:shiftFilter===v?'rgba(249,115,22,0.2)':'transparent',
                color:shiftFilter===v?'#f97316':'var(--text-3)'}}>
                {l}
              </button>
            ))}
          </div>
          {!readOnly&&(
            <button onClick={()=>{setEditEntry(null);setShowForm(true)}} style={{padding:'8px 18px',borderRadius:10,fontSize:13,fontWeight:600,background:'linear-gradient(135deg,#f97316,#c2410c)',color:'white',border:'none',cursor:'pointer',boxShadow:'0 4px 12px rgba(249,115,22,0.3)'}}>
              + Log Shift Data
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:'60px 0',color:'var(--text-3)',fontSize:13}}>Loading...</div>
      ) : (
        <>
          {/* Health score */}
          <HealthCard health={health} weekNum={week} shiftCount={filtered.length}/>

          {/* No data state */}
          {filtered.length===0 ? (
            <div style={{...card,padding:40,textAlign:'center'}}>
              <div style={{fontSize:32,marginBottom:12}}>📦</div>
              <div style={{fontSize:15,fontWeight:600,color:'var(--text-1)',marginBottom:6}}>No data logged for W{week}</div>
              <div style={{fontSize:13,color:'var(--text-3)'}}>{readOnly?'No shift data has been logged for this week yet.':'Use the Log Shift Data button to add entries.'}</div>
            </div>
          ) : (
            <>
              <ReceiveSection entries={filtered} targets={targets}/>
              <StowSection    entries={filtered} targets={targets}/>
              <BacklogSection entries={filtered}/>

              {/* All shifts table */}
              <div style={{...card,padding:20}}>
                <div style={{fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--text-1)',marginBottom:16}}>All Shifts — W{week}</div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                    <thead>
                      <tr style={{borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
                        {['Date','Shift','Parcel UPH','Vendor UPH','Transfer UPH','RCV UPH','Stow UPH','Backlog',...(!readOnly?['']:[])]
                          .map(h=><th key={h} style={{textAlign:'left',padding:'5px 8px',fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',fontSize:9,whiteSpace:'nowrap'}}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {[...filtered].sort((a,b)=>a.entry_date.localeCompare(b.entry_date)||(a.shift==='day'?-1:1)).map(e=>{
                        const t2={...DEF_TGT,...targets}
                        const cols=[
                          {v:e.parcel_uph,   tgt:t2.parcel_uph},
                          {v:e.vendor_uph,   tgt:t2.vendor_uph},
                          {v:e.transfer_uph, tgt:t2.transfer_uph},
                          {v:e.rcv_uph,      tgt:t2.rcv_uph},
                          {v:e.stow_uph,     tgt:t2.stow_uph},
                        ]
                        return (
                          <tr key={e.id} style={{borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                            <td style={{padding:'6px 8px',color:'var(--text-2)',whiteSpace:'nowrap'}}>{fmtD(e.entry_date)}</td>
                            <td style={{padding:'6px 8px'}}><span style={{fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:4,background:e.shift==='day'?'rgba(232,130,12,0.15)':'rgba(96,165,250,0.15)',color:e.shift==='day'?'#E8820C':'#60a5fa'}}>{e.shift==='day'?'Day':'Night'}</span></td>
                            {cols.map((c,i)=>{
                              const r=uphRag(c.v,c.tgt)
                              return <td key={i} style={{padding:'6px 8px',fontWeight:600,color:c.v!=null?r.c:'var(--text-3)',fontVariantNumeric:'tabular-nums'}}>{c.v!=null?c.v.toFixed(1):'--'}</td>
                            })}
                            <td style={{padding:'6px 8px',color:'#F59E0B',fontWeight:600}}>{(e.backlog_rcv_total||0).toLocaleString()}</td>
                            {!readOnly&&(
                              <td style={{padding:'6px 8px'}}>
                                <div style={{display:'flex',gap:6}}>
                                  <button onClick={()=>{setEditEntry(e);setShowForm(true)}} style={{padding:'2px 8px',borderRadius:5,fontSize:10,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.09)',color:'var(--text-2)',cursor:'pointer'}}>Edit</button>
                                  <button onClick={()=>handleDelete(e.id)} style={{padding:'2px 8px',borderRadius:5,fontSize:10,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',color:'#f87171',cursor:'pointer'}}>Delete</button>
                                </div>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Form modal */}
      {showForm&&(
        <EntryForm
          initial={editEntry}
          targets={targets}
          existingEntries={entries}
          onSave={handleSave}
          onClose={()=>{setShowForm(false);setEditEntry(null)}}
        />
      )}
    </div>
  )
}
