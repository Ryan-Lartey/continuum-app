import ExcelJS from 'exceljs'

// ── Palette ───────────────────────────────────────────────────────────────────
// White-background professional style — readable by GMs, prints cleanly
const C = {
  // Header blocks
  hNav:    '0F172A',
  hSub:    '1E293B',
  hAccent: 'F97316',
  hText:   'FFFFFF',
  hMute:   'E2E8F0',
  // Data rows
  row0:    'FFFFFF',
  row1:    'F8FAFC',
  // Borders
  bdr:     'E2E8F0',
  bdrH:    '94A3B8',
  // Typography
  bodyTx:  '111827',
  muteTx:  '6B7280',
  // RAG — pastel backgrounds with deep text (great for printing)
  gnBg: 'DCFCE7', gnTx: '166534',
  amBg: 'FEF9C3', amTx: '854D0E',
  rdBg: 'FEE2E2', rdTx: '991B1B',
  gyBg: 'F1F5F9', gyTx: '475569',
  // Stage colors
  sDef: '1E40AF', sMsr: '6D28D9', sAna: 'B45309',
  sImp: '166534', sCnt: '0E7490', sCls: '374151',
  // Belt colors
  bQk:  '059669',
  bYel: 'D97706',
  bGrn: '1D4ED8',
  bBlk: '4C1D95',
  bInv: 'BE123C',
  // Activity type tints
  tKpi:  'EFF6FF', tKpiTx: '1D4ED8',
  tProj: 'F0FDF4', tProjTx: '166534',
  tObs:  'FAF5FF', tObsTx:  '6D28D9',
  tIdea: 'FFF7ED', tIdeaTx: 'C2410C',
}

// ── Primitive helpers ─────────────────────────────────────────────────────────
const fill = hex => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } })
const font = (hex, size = 10, bold = false, italic = false) =>
  ({ color: { argb: 'FF' + hex }, size, bold, italic, name: 'Calibri' })
const al = (h = 'left', v = 'middle', wrap = false) =>
  ({ horizontal: h, vertical: v, wrapText: wrap })
const thinBdr = (c = 'E2E8F0') => ({ style: 'thin', color: { argb: 'FF' + c } })
const box = (c = 'E2E8F0') => ({ top: thinBdr(c), left: thinBdr(c), bottom: thinBdr(c), right: thinBdr(c) })
const medBox = (c = '94A3B8') => ({ top: { style: 'medium', color: { argb: 'FF' + c } }, left: { style: 'medium', color: { argb: 'FF' + c } }, bottom: { style: 'medium', color: { argb: 'FF' + c } }, right: { style: 'medium', color: { argb: 'FF' + c } } })

// ── Domain helpers ────────────────────────────────────────────────────────────
function ragBg(v, t, hi)    { if (v==null||t==null) return C.gyBg; const r=hi?v/t:t/v; return r>=1?C.gnBg:r>=0.95?C.amBg:C.rdBg }
function ragTx(v, t, hi)    { if (v==null||t==null) return C.gyTx; const r=hi?v/t:t/v; return r>=1?C.gnTx:r>=0.95?C.amTx:C.rdTx }
function ragStatus(v, t, hi){ if (v==null||t==null) return '— No Data'; const r=hi?v/t:t/v; return r>=1?'● On Target':r>=0.95?'◐ Near Target':'○ Off Target' }
function ragPct(v, t, hi)   { if (v==null||t==null) return '—'; return (hi?v/t*100:t/v*100).toFixed(1)+'%' }

function beltLabel(type) {
  return {quick_win:'Quick Win',yellow_belt:'Yellow Belt',green_belt:'Green Belt',black_belt:'Black Belt',investigation:'Investigation'}[type]||type
}
function beltColor(type) {
  return {quick_win:C.bQk,yellow_belt:C.bYel,green_belt:C.bGrn,black_belt:C.bBlk,investigation:C.bInv}[type]||C.muteTx
}
function stageColor(s) {
  return {Define:C.sDef,Measure:C.sMsr,Analyse:C.sAna,Analyze:C.sAna,Improve:C.sImp,Control:C.sCnt,Closed:C.sCls}[s]||C.muteTx
}
function dmiacBar(stage) {
  const ord = ['Define','Measure','Analyse','Improve','Control']
  if (stage === 'Closed') return '■■■■■  Complete'
  const i = ord.indexOf(stage)
  if (i < 0) return '□□□□□'
  return '■'.repeat(i+1) + '□'.repeat(4-i) + '  ' + stage
}
function trendLabel(vals, hi) {
  if (!vals||vals.length<4) return '→  Insufficient data'
  const r = vals.slice(-3).reduce((s,v)=>s+v,0)/3
  const f = vals.slice(0,3).reduce((s,v)=>s+v,0)/3
  const d = r - f
  if (Math.abs(d/(f||1))<0.005) return '→  Stable'
  return (hi?d>0:d<0) ? '↑  Improving' : '↓  Declining'
}
function trendColor(vals, hi) {
  if (!vals||vals.length<4) return C.muteTx
  const r = vals.slice(-3).reduce((s,v)=>s+v,0)/3
  const f = vals.slice(0,3).reduce((s,v)=>s+v,0)/3
  const d = r - f
  if (Math.abs(d/(f||1))<0.005) return C.muteTx
  return (hi?d>0:d<0) ? C.gnTx : C.rdTx
}
function momDelta(vals) {
  if (!vals||vals.length<2) return null
  const a=vals[vals.length-1], b=vals[vals.length-2]
  if (!b) return null
  return ((a-b)/b*100).toFixed(1)
}
function scoreBar(n, max=5) {
  n = Math.min(max, Math.max(1, Math.round(n)))
  return '■'.repeat(n) + '□'.repeat(max-n)
}
function scoreColor(n) {
  const map = {1:C.rdTx,2:C.amTx,3:'B45309',4:C.gnTx,5:'065F46'}
  return map[Math.round(n)] || C.muteTx
}
function scoreBgColor(n) {
  const map = {1:C.rdBg,2:C.amBg,3:'FEF9C3',4:C.gnBg,5:'DCFCE7'}
  return map[Math.round(n)] || C.gyBg
}

// ── Page setup ────────────────────────────────────────────────────────────────
function setupPage(ws, title, siteName) {
  ws.pageSetup = {
    paperSize: 9, orientation: 'landscape',
    fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 }
  }
  ws.headerFooter = {
    oddHeader: `&L&"Calibri,Bold"&10 ${siteName} — CI Programme&C&"Calibri,Regular"&9 ${title}&R&"Calibri,Regular"&9 Continuum CI`,
    oddFooter:  `&L&"Calibri,Regular"&9 Generated &D &T&C&"Calibri,Regular"&9 CONFIDENTIAL — Internal Use Only&R&"Calibri,Regular"&9 Page &P of &N`
  }
}

// ── Title block helper ────────────────────────────────────────────────────────
function titleBlock(ws, mergeMain, mergeAccent, mergeSub, mainText, subText, accentColor = C.hAccent) {
  ws.mergeCells(mergeMain)
  const t = ws.getCell(mergeMain.split(':')[0])
  t.value = mainText
  t.font  = { color: { argb: 'FF' + C.hText }, size: 15, bold: true, name: 'Calibri' }
  t.fill  = fill(C.hNav)
  t.alignment = al('left', 'middle')
  ws.getRow(parseInt(mergeMain.match(/\d+/)[0])).height = 32

  ws.mergeCells(mergeAccent)
  ws.getCell(mergeAccent.split(':')[0]).fill = fill(accentColor)
  ws.getRow(parseInt(mergeAccent.match(/\d+/)[0])).height = 4

  if (mergeSub && subText) {
    ws.mergeCells(mergeSub)
    const s = ws.getCell(mergeSub.split(':')[0])
    s.value = subText
    s.font  = font(C.muteTx, 9, false, true)
    s.fill  = fill(C.row1)
    s.alignment = al('left', 'middle')
    ws.getRow(parseInt(mergeSub.match(/\d+/)[0])).height = 15
  }
}

// ── Section label ─────────────────────────────────────────────────────────────
function sectionLabel(ws, mergeRange, text) {
  ws.mergeCells(mergeRange)
  const c = ws.getCell(mergeRange.split(':')[0])
  c.value = text
  c.font  = font(C.hText, 8, true)
  c.fill  = fill(C.hSub)
  c.alignment = al('left', 'middle')
  ws.getRow(parseInt(mergeRange.match(/\d+/)[0])).height = 17
}

// ── Header row ────────────────────────────────────────────────────────────────
function headerRow(ws, rowNum, labels, height = 20) {
  ws.getRow(rowNum).height = height
  labels.forEach((h, i) => {
    const cell = ws.getRow(rowNum).getCell(i + 1)
    cell.value = h
    cell.font  = font(C.hText, 9, true)
    cell.fill  = fill(C.hNav)
    cell.border = box(C.bdrH)
    cell.alignment = al('center', 'middle')
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHEET 1 — OVERVIEW DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function buildOverview(ws, data) {
  const siteName = data.siteName || 'BHX4 — Amazon FC'
  const userName = data.userName || 'Ryan'
  const dateStr  = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })

  ws.columns = [
    {width:2},{width:20},{width:11},{width:11},{width:11},{width:11},{width:11},{width:3},
    {width:20},{width:11},{width:11},{width:11},{width:11},{width:2}
  ]
  setupPage(ws, 'Overview Dashboard', siteName)
  ws.views = [{ showGridLines: false }]

  // ─ Title ─
  ws.mergeCells('B1:G1')
  const t1 = ws.getCell('B1')
  t1.value = `◈  CI PROGRAMME — ${siteName.toUpperCase()}`
  t1.font  = { color: { argb: 'FF' + C.hText }, size: 16, bold: true, name: 'Calibri' }
  t1.fill  = fill(C.hNav)
  t1.alignment = al('left', 'middle')
  ws.getRow(1).height = 35

  ws.mergeCells('I1:N1')
  const t2 = ws.getCell('I1')
  t2.value = `${userName}  ·  ${dateStr}`
  t2.font  = font(C.hMute, 9)
  t2.fill  = fill(C.hNav)
  t2.alignment = al('right', 'middle')

  ws.mergeCells('B2:N2')
  ws.getCell('B2').fill = fill(C.hAccent)
  ws.getRow(2).height = 4

  // ─ KPI TILES (4 tiles side by side, 2 per half) ─
  sectionLabel(ws, 'B3:N3', '  KEY PERFORMANCE INDICATORS  ·  Current shift performance vs target')

  const metrics = [
    { key:'uph',      label:'UPH',          unit:'',  hi:true,  tKey:'UPH' },
    { key:'accuracy', label:'Pick Accuracy', unit:'%', hi:true,  tKey:'Accuracy' },
    { key:'dpmo',     label:'DPMO',          unit:'',  hi:false, tKey:'DPMO' },
    { key:'dts',      label:'DTS',           unit:'%', hi:true,  tKey:'DTS' },
  ]

  // Column groupings — B:F, G:H skipped (H=gap), I:M, N:N (second pair use I-N)
  // Actually: left half = B-G cols 2-7, right half = I-N cols 9-14, H is gap
  // Tile 1: B-C, Tile 2: E-F (D is center gap within left), Tile 3: I-J, Tile 4: L-M (K/L center gap)
  // Simplify: just use 4 columns each 3 wide
  // B,C,D = tile1; E,F,G = tile2; (H=gap); I,J,K = tile3; L,M,N = tile4
  const tileCols = [
    { s:'B', m:'C', e:'D' },
    { s:'E', m:'F', e:'G' },
    { s:'I', m:'J', e:'K' },
    { s:'L', m:'M', e:'N' },
  ]

  metrics.forEach((m, idx) => {
    const tc = tileCols[idx]
    const latest = data.latestKpis?.[m.key]
    const val    = latest?.value
    const target = data.kpiTargets?.[m.tKey]
    const bg     = ragBg(val, target, m.hi)
    const tx     = ragTx(val, target, m.hi)
    const status = ragStatus(val, target, m.hi)
    const pct    = ragPct(val, target, m.hi)
    const mData  = (data.kpiData||[]).filter(d=>d.metric_id===m.key).sort((a,b)=>a.date.localeCompare(b.date))
    const vals   = mData.map(d=>d.value)
    const trend  = trendLabel(vals, m.hi)
    const tCol   = trendColor(vals, m.hi)
    const mom    = momDelta(vals)
    const momStr = mom!=null ? `MoM: ${parseFloat(mom)>0?'+':''}${mom}%` : ''

    // Row 4 — metric label
    ws.mergeCells(`${tc.s}4:${tc.e}4`)
    const r4 = ws.getCell(`${tc.s}4`)
    r4.value = m.label.toUpperCase()
    r4.font  = { color: { argb: 'FF' + C.muteTx }, size: 8, bold: true, name: 'Calibri' }
    r4.fill  = fill(C.row0)
    r4.border = { top: thinBdr(C.bdr), left: thinBdr(C.bdr), right: thinBdr(C.bdr) }
    r4.alignment = al('center', 'middle')
    ws.getRow(4).height = 13

    // Row 5 — BIG value
    ws.mergeCells(`${tc.s}5:${tc.e}5`)
    const r5 = ws.getCell(`${tc.s}5`)
    r5.value = val != null ? val : '—'
    r5.font  = { color: { argb: 'FF' + tx }, size: 32, bold: true, name: 'Calibri' }
    r5.fill  = fill(bg)
    r5.alignment = al('center', 'middle')
    ws.getRow(5).height = 42

    // Row 6 — target
    ws.mergeCells(`${tc.s}6:${tc.e}6`)
    const r6 = ws.getCell(`${tc.s}6`)
    r6.value = `Target: ${target!=null?target:'—'}${m.unit}   ·   ${pct} of target`
    r6.font  = { color: { argb: 'FF' + tx }, size: 8, name: 'Calibri' }
    r6.fill  = fill(bg)
    r6.alignment = al('center', 'middle')
    ws.getRow(6).height = 14

    // Row 7 — RAG status badge
    ws.mergeCells(`${tc.s}7:${tc.e}7`)
    const r7 = ws.getCell(`${tc.s}7`)
    r7.value = status
    r7.font  = { color: { argb: 'FF' + tx }, size: 9, bold: true, name: 'Calibri' }
    r7.fill  = fill(bg)
    r7.border = { bottom: thinBdr(C.bdr), left: thinBdr(C.bdr), right: thinBdr(C.bdr) }
    r7.alignment = al('center', 'middle')
    ws.getRow(7).height = 14

    // Row 8 — trend + MoM
    ws.mergeCells(`${tc.s}8:${tc.e}8`)
    const r8 = ws.getCell(`${tc.s}8`)
    r8.value = trend + (momStr ? `   ·   ${momStr}` : '')
    r8.font  = { color: { argb: 'FF' + tCol }, size: 8, name: 'Calibri' }
    r8.fill  = fill(C.row1)
    r8.border = { bottom: thinBdr(C.bdr), left: thinBdr(C.bdr), right: thinBdr(C.bdr) }
    r8.alignment = al('center', 'middle')
    ws.getRow(8).height = 13
  })

  // Gap col H rows 4-8
  for (let r = 4; r <= 8; r++) ws.getRow(r).getCell(8).fill = fill(C.row1)

  ws.getRow(9).height = 8

  // ─ PROGRAMME STATS ─
  sectionLabel(ws, 'B10:G10', '  IMPROVEMENT PROGRAMME')
  sectionLabel(ws, 'I10:N10', '  PIPELINE OVERVIEW')

  const progStats = [
    { label:'Active Projects',    value: data.activeProjects||0,              color: C.bGrn },
    { label:'Completed Projects', value: data.closedProjects||0,              color: C.bQk  },
    { label:'Total Ideas',        value: data.totalIdeas||0,                  color: 'D97706' },
    { label:'Portfolios Managed', value: (data.portfolios||[]).length,         color: C.bBlk },
    { label:'Actions Complete',   value: data.actionsComplete||0,             color: C.sImp },
    { label:'SOPs Written',       value: data.sopCount||0,                    color: C.sCnt },
  ]
  const progColPairs = [['B','D'],['E','G'],['B','D'],['E','G'],['B','D'],['E','G']]
  const progRows     = [11,11,13,13,15,15]

  progStats.forEach((s, i) => {
    const [c1,c2] = progColPairs[i]
    const r = progRows[i]
    ws.getRow(r).height   = 28
    ws.getRow(r+1).height = 14

    ws.mergeCells(`${c1}${r}:${c2}${r}`)
    const numCell = ws.getCell(`${c1}${r}`)
    numCell.value = s.value
    numCell.font  = { color: { argb: 'FF' + s.color }, size: 20, bold: true, name: 'Calibri' }
    numCell.fill  = fill(C.row0)
    numCell.border = { top: thinBdr(C.bdr), left: thinBdr(C.bdr), right: thinBdr(C.bdr) }
    numCell.alignment = al('center', 'middle')

    ws.mergeCells(`${c1}${r+1}:${c2}${r+1}`)
    const lblCell = ws.getCell(`${c1}${r+1}`)
    lblCell.value = s.label
    lblCell.font  = font(C.muteTx, 8)
    lblCell.fill  = fill(C.row0)
    lblCell.border = { bottom: thinBdr(C.bdr), left: thinBdr(C.bdr), right: thinBdr(C.bdr) }
    lblCell.alignment = al('center', 'middle')
  })

  // Pipeline mini-table (right side)
  const pipeHdrs = ['','PORTFOLIO','IDEAS','ACTIVE','DONE','']
  headerRow(ws, 11, pipeHdrs, 18)
  // Adjust header cells I-N
  ;['I','J','K','L','M','N'].forEach((c,i) => {
    const cell = ws.getRow(11).getCell(['I','J','K','L','M','N'].indexOf(c)+9)
    cell.value = pipeHdrs[i]
  })

  const pipeCols = [9,10,11,12,13,14] // col numbers for I-N
  ;['I','J','K','L','M','N'].forEach((col, ci) => {
    const cell = ws.getRow(11).getCell(col === 'I' ? 9 : col === 'J' ? 10 : col === 'K' ? 11 : col === 'L' ? 12 : col === 'M' ? 13 : 14)
    cell.value = ['','PORTFOLIO','IDEAS','ACTIVE','DONE',''][ci]
    cell.font  = font(C.hText, 9, true)
    cell.fill  = fill(C.hNav)
    cell.border = box(C.bdrH)
    cell.alignment = al('center', 'middle')
  })
  ws.getRow(11).height = 18

  const portfs = data.portfolios || []
  portfs.slice(0, 6).forEach((p, i) => {
    const r  = 12 + i
    const s  = data.summaries?.[p.id] || {}
    const bg = i%2===0 ? C.row0 : C.row1
    ws.getRow(r).height = 16
    const colMap = { I:9, J:10, K:11, L:12, M:13, N:14 }
    const vals = ['', p.name, s.ideaCount||0, s.assignedCount||0, s.finishedCount||0, '']
    ;['I','J','K','L','M','N'].forEach((col, ci) => {
      const cell = ws.getRow(r).getCell(colMap[col])
      cell.value = vals[ci]
      cell.fill  = fill(bg)
      cell.border = box(C.bdr)
      cell.alignment = al(ci===1?'left':'center','middle')
      if (ci===1) cell.font = font(C.bodyTx, 9, true)
      else if (ci===4 && vals[ci]>0) { cell.font = { color: { argb: 'FF'+C.gnTx }, size: 9, bold: true, name: 'Calibri' }; cell.fill = fill(C.gnBg) }
      else cell.font = font(C.muteTx, 9)
    })
  })

  ws.getRow(18).height = 8

  // ─ ACTIVE PROJECTS QUICK TABLE ─
  sectionLabel(ws, 'B19:N19', '  ACTIVE PROJECT STATUS  ·  Sorted by DMAIC stage  ·  ⚠ = stalled >14 days without update')

  headerRow(ws, 20, ['','#','PROJECT NAME','BELT TYPE','PORTFOLIO','STAGE','DMAIC PROGRESS','METRIC','BASELINE → TARGET','DAYS ACTIVE','STALLED?','LAST UPDATED','',''], 20)

  const active = (data.projects||[]).filter(p=>p.stage!=='Closed')
  const stagOrd = ['Define','Measure','Analyse','Analyze','Improve','Control']
  const sortedActive = [...active].sort((a,b)=>stagOrd.indexOf(a.stage)-stagOrd.indexOf(b.stage))

  sortedActive.slice(0,12).forEach((p, i) => {
    const r  = 21 + i
    const bg = i%2===0 ? C.row0 : C.row1
    const pf = (data.portfolios||[]).find(pf=>pf.id===p.portfolio_id)
    const ds = p.updated_at ? Math.floor((Date.now()-new Date(p.updated_at))/86400000) : null
    const stalled = ds && ds>14
    const daysActive = p.created_at ? Math.floor((Date.now()-new Date(p.created_at))/86400000) : '—'
    const baseTarget = p.baseline!=null&&p.target_value!=null?`${p.baseline} → ${p.target_value}`:'—'
    ws.getRow(r).height = 18

    const rowVals = [
      '', i+1, p.title, beltLabel(p.project_type), pf?.name||'—',
      p.stage||'—', dmiacBar(p.stage), p.metric_id?.toUpperCase()||'—',
      baseTarget, daysActive, stalled?'⚠ STALLED':'● Active',
      p.updated_at?new Date(p.updated_at).toLocaleDateString('en-GB'):'—', '', ''
    ]

    rowVals.forEach((v, ci) => {
      const cell = ws.getRow(r).getCell(ci+1)
      cell.value = v
      cell.border = box(C.bdr)
      cell.alignment = al(ci===9||ci===1?'center':'left','middle')

      if (ci===2) {
        cell.font = { color:{argb:'FF'+(stalled?C.amTx:C.bodyTx)}, size:10, bold:true, name:'Calibri' }
        cell.fill = fill(stalled?C.amBg:bg)
      } else if (ci===3) {
        cell.font = { color:{argb:'FF'+beltColor(p.project_type)}, size:9, bold:true, name:'Calibri' }
        cell.fill = fill(bg)
      } else if (ci===5) {
        cell.font = { color:{argb:'FF'+stageColor(p.stage)}, size:9, bold:true, name:'Calibri' }
        cell.fill = fill(bg)
      } else if (ci===6) {
        cell.font = { color:{argb:'FF'+stageColor(p.stage)}, size:9, name:'Courier New' }
        cell.fill = fill(bg)
      } else if (ci===10) {
        if (stalled) { cell.font={color:{argb:'FF'+C.rdTx},size:9,bold:true,name:'Calibri'}; cell.fill=fill(C.rdBg) }
        else { cell.font={color:{argb:'FF'+C.gnTx},size:9,name:'Calibri'}; cell.fill=fill(bg) }
      } else {
        cell.font = font(ci===1?C.muteTx:C.muteTx, 9)
        cell.fill = fill(bg)
      }
    })
  })

  // ─ WAREHOUSE HEALTH ─
  const whStart = 22 + Math.min(12, sortedActive.length)
  ws.getRow(whStart).height = 8

  const whLabel = whStart + 1
  sectionLabel(ws, `B${whLabel}:N${whLabel}`, '  WAREHOUSE HEALTH SCORES  ·  Most recent shift per section')

  // Header
  const whHdr = whLabel + 1
  ws.getRow(whHdr).height = 18
  ;['','SECTION','HEALTH SCORE','SCORE BAR (0–100%)','','STATUS','LAST SHIFT','SHIFT','','','','','',''].forEach((v, ci) => {
    const cell = ws.getRow(whHdr).getCell(ci + 1)
    cell.value = v
    cell.font  = font(C.hText, 9, true)
    cell.fill  = fill(C.hNav)
    cell.border = box(C.bdrH)
    cell.alignment = al(ci === 2 || ci === 5 ? 'center' : 'left', 'middle')
  })

  const WH_SECTIONS = [
    { id: 'inbound',  label: 'Inbound'  },
    { id: 'icqa',     label: 'ICQA'     },
    { id: 'pick',     label: 'Pick'     },
    { id: 'pack',     label: 'Pack'     },
    { id: 'outbound', label: 'Outbound' },
  ]
  const whScoreMap = Object.fromEntries((data.warehouseHealth || []).map(r => [r.section_id, r]))

  function whBg(score)    { if (score == null) return C.gyBg; return score >= 85 ? C.gnBg : score >= 70 ? C.amBg : C.rdBg }
  function whTx(score)    { if (score == null) return C.gyTx; return score >= 85 ? C.gnTx : score >= 70 ? C.amTx : C.rdTx }
  function whLabel2(score){ if (score == null) return 'No Data'; return score >= 85 ? '● Good' : score >= 70 ? '◐ At Risk' : '○ Critical' }
  function whBar(score)   { if (score == null) return '—'; const f = Math.round((score / 100) * 10); return '█'.repeat(f) + '░'.repeat(10 - f) + `  ${score.toFixed(1)}%` }

  WH_SECTIONS.forEach((sec, i) => {
    const r   = whHdr + 1 + i
    const d   = whScoreMap[sec.id]
    const scr = d?.score ?? null
    const bg  = i % 2 === 0 ? C.row0 : C.row1
    ws.getRow(r).height = 20

    const vals = ['', sec.label, scr != null ? scr.toFixed(1) : '—', whBar(scr), '', whLabel2(scr), d?.date || '—', d?.shift_type || '—', '', '', '', '', '', '']
    vals.forEach((v, ci) => {
      const cell = ws.getRow(r).getCell(ci + 1)
      cell.value  = v
      cell.border = box(C.bdr)
      if (ci === 2 || ci === 5) {
        cell.fill  = fill(whBg(scr))
        cell.font  = { color: { argb: 'FF' + whTx(scr) }, size: ci === 2 ? 11 : 9, bold: true, name: 'Calibri' }
        cell.alignment = al('center', 'middle')
      } else if (ci === 3) {
        cell.fill  = fill(bg)
        cell.font  = { color: { argb: 'FF' + whTx(scr) }, size: 8, name: 'Courier New' }
        cell.alignment = al('left', 'middle')
      } else if (ci === 1) {
        cell.fill  = fill(bg)
        cell.font  = font(C.bodyTx, 10, true)
        cell.alignment = al('left', 'middle')
      } else {
        cell.fill  = fill(bg)
        cell.font  = font(C.muteTx, 9)
        cell.alignment = al('center', 'middle')
      }
    })
  })

  // Footer
  const footR = whHdr + 1 + WH_SECTIONS.length
  ws.getRow(footR).height = 12
  ws.mergeCells(`B${footR+1}:N${footR+1}`)
  const foot = ws.getCell(`B${footR+1}`)
  foot.value = `Auto-synced from Continuum CI Management System  ·  ${new Date().toLocaleString('en-GB')}  ·  Confidential — For internal use only`
  foot.font  = font(C.muteTx, 8, false, true)
  foot.fill  = fill(C.row1)
  foot.border = { top: thinBdr(C.bdr) }
  foot.alignment = al('center', 'middle')
  ws.getRow(footR+1).height = 16
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHEET 2 — KPI PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════════
function buildKPIs(ws, kpiData, targets, latestKpis) {
  ws.columns = [
    {width:2},{width:16},{width:11},{width:11},{width:11},{width:13},
    {width:13},{width:11},{width:11},{width:11},{width:11},{width:11},{width:2}
  ]
  setupPage(ws, 'KPI Performance', 'Continuum CI')
  ws.views = [{ state:'frozen', xSplit:0, ySplit:9, showGridLines:false }]

  titleBlock(ws,'B1:L1','B2:L2','B3:L3',
    'KPI PERFORMANCE DASHBOARD',
    'Live performance · RAG status · Trend analysis · Month-on-month · SPC signal flags · 90-day history'
  )
  ws.getRow(4).height = 8

  // ─ Summary KPI table ─
  sectionLabel(ws, 'B5:L5', '  CURRENT PERFORMANCE AT A GLANCE')
  headerRow(ws, 6, ['','METRIC','CURRENT','TARGET','VS TARGET','STATUS','30-DAY TREND','MoM CHANGE','SPC SIGNALS','DATA PTS','LAST LOGGED','',''], 22)

  const metricDefs = [
    {key:'uph',      label:'UPH',          unit:'',  hi:true,  tKey:'UPH'},
    {key:'accuracy', label:'Pick Accuracy', unit:'%', hi:true,  tKey:'Accuracy'},
    {key:'dpmo',     label:'DPMO',          unit:'',  hi:false, tKey:'DPMO'},
    {key:'dts',      label:'DTS',           unit:'%', hi:true,  tKey:'DTS'},
  ]

  metricDefs.forEach((m, i) => {
    const r      = 7 + i
    const latest = latestKpis?.[m.key]
    const val    = latest?.value
    const target = targets?.[m.tKey]
    const mData  = kpiData.filter(d=>d.metric_id===m.key).sort((a,b)=>a.date.localeCompare(b.date))
    const vals   = mData.map(d=>d.value)
    const bg     = i%2===0 ? C.row0 : C.row1
    const rBg    = ragBg(val, target, m.hi)
    const rTx    = ragTx(val, target, m.hi)
    const mom    = momDelta(vals)
    const sigs   = kpiData.filter(d=>d.metric_id===m.key&&d.signal).length

    ws.getRow(r).height = 24
    const rowVals = [
      '', m.label, val!=null?val:'—',
      target!=null?target:'—',
      ragPct(val,target,m.hi),
      ragStatus(val,target,m.hi),
      trendLabel(vals,m.hi),
      mom!=null?`${parseFloat(mom)>0?'+':''}${mom}%`:'—',
      sigs>0?`⚠ ${sigs} signal${sigs>1?'s':''}`:'✓ None',
      vals.length, latest?.date||'—','',''
    ]

    rowVals.forEach((v, ci) => {
      const cell = ws.getRow(r).getCell(ci+1)
      cell.value = v
      cell.border = box(C.bdr)
      cell.alignment = al(ci===1?'left':'center','middle')

      if (ci===1) { cell.font=font(C.bodyTx,11,true); cell.fill=fill(bg) }
      else if (ci===2) { cell.font={color:{argb:'FF'+rTx},size:14,bold:true,name:'Calibri'}; cell.fill=fill(rBg) }
      else if (ci===5) { cell.font={color:{argb:'FF'+rTx},size:9,bold:true,name:'Calibri'}; cell.fill=fill(rBg) }
      else if (ci===6) {
        cell.font={color:{argb:'FF'+trendColor(vals,m.hi)},size:9,name:'Calibri'}; cell.fill=fill(bg)
      } else if (ci===7) {
        const mn=parseFloat(mom)
        const mc=isNaN(mn)?C.muteTx:(m.hi?(mn>0?C.gnTx:C.rdTx):(mn<0?C.gnTx:C.rdTx))
        cell.font={color:{argb:'FF'+mc},size:9,bold:!isNaN(mn),name:'Calibri'}; cell.fill=fill(bg)
      } else if (ci===8) {
        if (sigs>0){cell.font={color:{argb:'FF'+C.rdTx},size:9,bold:true,name:'Calibri'};cell.fill=fill(C.rdBg)}
        else{cell.font={color:{argb:'FF'+C.gnTx},size:9,name:'Calibri'};cell.fill=fill(C.gnBg)}
      } else { cell.font=font(C.muteTx,9); cell.fill=fill(bg) }
    })
  })

  ws.getRow(11).height = 10

  // ─ Week-by-week comparison ─
  sectionLabel(ws, 'B12:L12', '  WEEK-BY-WEEK COMPARISON — LAST 4 WEEKS  ·  Trend direction at a glance')
  headerRow(ws, 13,
    ['','WEEK','AVG UPH','UPH RAG','AVG ACCURACY','ACC RAG','AVG DPMO','DPMO RAG','AVG DTS','DTS RAG','SIGNALS','',''],
    20
  )

  // Build weekly buckets (Mon–Sun, last 4 complete weeks)
  const allDates = [...new Set(kpiData.map(d=>d.date))].sort()
  const weekBuckets = []
  for (let w = 0; w < 4; w++) {
    const endDate   = new Date(); endDate.setDate(endDate.getDate() - w * 7)
    const startDate = new Date(endDate); startDate.setDate(startDate.getDate() - 6)
    const s = startDate.toISOString().split('T')[0]
    const e = endDate.toISOString().split('T')[0]
    const wDates = allDates.filter(d=>d>=s&&d<=e)
    const avg = (id) => {
      const vs = kpiData.filter(d=>d.metric_id===id&&wDates.includes(d.date)).map(d=>d.value)
      return vs.length ? Math.round(vs.reduce((a,b)=>a+b,0)/vs.length * 10) / 10 : null
    }
    const sigs = kpiData.filter(d=>wDates.includes(d.date)&&d.signal).length
    weekBuckets.push({ label:`${s} to ${e}`, uph:avg('uph'), acc:avg('accuracy'), dpmo:avg('dpmo'), dts:avg('dts'), sigs })
  }

  const tgt = {
    uph:      targets?.UPH      ?? null,
    accuracy: targets?.Accuracy  ?? null,
    dpmo:     targets?.DPMO     ?? null,
    dts:      targets?.DTS      ?? null,
  }

  weekBuckets.forEach((wk, i) => {
    const r  = 14 + i
    const bg = i%2===0 ? C.row0 : C.row1
    ws.getRow(r).height = 18
    const rowVals = ['', wk.label, wk.uph??'—', ragStatus(wk.uph,tgt.uph,true), wk.acc??'—', ragStatus(wk.acc,tgt.accuracy,true), wk.dpmo??'—', ragStatus(wk.dpmo,tgt.dpmo,false), wk.dts??'—', ragStatus(wk.dts,tgt.dts,true), wk.sigs>0?`⚠ ${wk.sigs} signals`:'✓ Clean', '', '']
    rowVals.forEach((v, ci) => {
      const cell = ws.getRow(r).getCell(ci+1)
      cell.value = v; cell.border = box(C.bdr); cell.alignment = al(ci===1?'left':'center','middle')
      const ragCols = {3:{v:wk.uph,t:tgt.uph,hi:true},5:{v:wk.acc,t:tgt.accuracy,hi:true},7:{v:wk.dpmo,t:tgt.dpmo,hi:false},9:{v:wk.dts,t:tgt.dts,hi:true}}
      if (ragCols[ci]) {
        const {v:rv,t:rt,hi} = ragCols[ci]
        cell.font={color:{argb:'FF'+ragTx(rv,rt,hi)},size:8,bold:true,name:'Calibri'}; cell.fill=fill(ragBg(rv,rt,hi))
      } else if (ci===10) {
        if (wk.sigs>0){cell.font={color:{argb:'FF'+C.rdTx},size:8,bold:true,name:'Calibri'};cell.fill=fill(C.rdBg)}
        else{cell.font={color:{argb:'FF'+C.gnTx},size:8,name:'Calibri'};cell.fill=fill(C.gnBg)}
      } else if ([2,4,6,8].includes(ci)) {
        cell.font=font(C.bodyTx,10,true); cell.fill=fill(bg)
      } else { cell.font=font(C.muteTx,9); cell.fill=fill(bg) }
    })
  })

  ws.getRow(18).height = 10

  // ─ 90-day trend table ─
  sectionLabel(ws, 'B19:L19', '  90-DAY KPI TREND DATA  ·  Filter by date or metric  ·  Status columns show RAG vs target')
  headerRow(ws, 20,
    ['','DATE','UPH','UPH %','UPH Status','Accuracy','Acc %','Acc Status','DPMO','DPMO %','DPMO Status','DTS','DTS %','DTS Status',''],
    20
  )
  ws.autoFilter = { from:{row:20,column:2}, to:{row:20,column:14} }

  const dates = allDates.slice(-90)

  dates.forEach((date, i) => {
    const r  = 21 + i
    const bg = i%2===0 ? C.row0 : C.row1
    ws.getRow(r).height = 15
    const g = (id) => kpiData.find(d=>d.date===date&&d.metric_id===id)?.value ?? null
    const uph=g('uph'), acc=g('accuracy'), dpmo=g('dpmo'), dts=g('dts')

    const rowVals = [
      '', date,
      uph,  uph&&tgt.uph    ? (uph/tgt.uph*100).toFixed(1)+'%'    : '—', ragStatus(uph,tgt.uph,true),
      acc,  acc&&tgt.accuracy? (acc/tgt.accuracy*100).toFixed(1)+'%': '—', ragStatus(acc,tgt.accuracy,true),
      dpmo, dpmo&&tgt.dpmo  ? (tgt.dpmo/dpmo*100).toFixed(1)+'%'   : '—', ragStatus(dpmo,tgt.dpmo,false),
      dts,  dts&&tgt.dts    ? (dts/tgt.dts*100).toFixed(1)+'%'     : '—', ragStatus(dts,tgt.dts,true),
      ''
    ]

    const statusCols = new Set([4,7,10,13])
    const valCols    = new Set([2,5,8,11])
    const pctCols    = new Set([3,6,9,12])
    const statData   = [
      {v:uph,t:tgt.uph,hi:true},{v:acc,t:tgt.accuracy,hi:true},
      {v:dpmo,t:tgt.dpmo,hi:false},{v:dts,t:tgt.dts,hi:true}
    ]

    rowVals.forEach((v, ci) => {
      const cell = ws.getRow(r).getCell(ci+1)
      cell.value = v
      cell.border = box(C.bdr)
      cell.alignment = al(ci===1?'left':'center','middle')

      if (ci===1) { cell.font=font(C.bodyTx,9); cell.fill=fill(bg) }
      else if (statusCols.has(ci)) {
        const sd = statData[[4,7,10,13].indexOf(ci)]
        cell.font={color:{argb:'FF'+ragTx(sd.v,sd.t,sd.hi)},size:8,bold:true,name:'Calibri'}
        cell.fill=fill(ragBg(sd.v,sd.t,sd.hi))
      } else if (valCols.has(ci)) {
        cell.font=font(C.bodyTx,10,true); cell.fill=fill(bg)
      } else if (pctCols.has(ci)) {
        cell.font=font(C.muteTx,9); cell.fill=fill(bg)
      } else {
        cell.font=font(C.muteTx,9); cell.fill=fill(bg)
      }
    })
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHEET 2 — CI IMPACT & RESULTS
// ═══════════════════════════════════════════════════════════════════════════════
function buildImpact(ws, data) {
  const projects   = data.projects   || []
  const portfolios = data.portfolios || []
  const appUrl     = data.appUrl     || 'http://localhost:3000'

  ws.columns = [
    {width:2},{width:28},{width:13},{width:18},{width:12},{width:12},{width:14},{width:32},{width:14},{width:2}
  ]
  setupPage(ws, 'CI Impact & Results', 'Continuum CI')
  ws.views = [{ state:'frozen', xSplit:0, ySplit:10, showGridLines:false }]

  titleBlock(ws,'B1:I1','B2:I2','B3:I3',
    '🏆  CI IMPACT & RESULTS REGISTER',
    'Evidence of CI contribution — for use in performance reviews and GM briefings  ·  Auto-generated from Continuum',
    'F97316'
  )
  ws.getRow(4).height = 8

  // ─ Headline impact summary boxes ─
  const closed   = projects.filter(p=>p.stage==='Closed')
  const active   = projects.filter(p=>p.stage!=='Closed'&&p.project_type!=='investigation')
  const stalled  = active.filter(p=>{ const d=p.updated_at?Math.floor((Date.now()-new Date(p.updated_at))/86400000):null; return d&&d>14 })
  const sopCount = projects.filter(p=>{ try{return JSON.parse(p.charter||'{}').sop}catch{return false} }).length
  const actDone  = projects.reduce((s,p)=>{ try{return s+JSON.parse(p.actions||'[]').filter(a=>a.done).length}catch{return s} },0)
  const actTotal = projects.reduce((s,p)=>{ try{return s+JSON.parse(p.actions||'[]').length}catch{return s} },0)

  sectionLabel(ws,'B5:I5','  PROGRAMME HEADLINE NUMBERS  ·  Snapshot of CI output and evidence of practice')

  const boxes = [
    { label:'Projects Completed', value:closed.length,      color:C.gnTx, bg:C.gnBg },
    { label:'Projects Active',    value:active.length,      color:C.sDef, bg:'EFF6FF' },
    { label:'Actions Closed',     value:`${actDone}/${actTotal}`, color:C.sImp, bg:C.gnBg },
    { label:'SOPs Written',       value:sopCount,           color:C.sCnt, bg:'ECFEFF' },
    { label:'Stalled Projects',   value:stalled.length,     color:stalled.length>0?C.rdTx:C.gnTx, bg:stalled.length>0?C.rdBg:C.gnBg },
  ]

  // 5 equal boxes across B-I
  const bxCols = [['B','C'],['C','D'],['E','F'],['G','H'],['H','I']]
  // Simpler: each box gets 2 of 8 cols
  const colGroups = [['B','B'],['C','C'],['D','D'],['F','F'],['H','H']]
  // Just do 5 boxes across cols 2-9 (B-I), each spanning 1 column
  boxes.forEach((b, i) => {
    const colN = 2 + i // cols B through F (2-6) — then skip G (gap), H-I for last 2
    const actualCol = i < 3 ? 2+i : 3+i  // B,C,D then F,G (skip E as gap)
    ws.getRow(6).height = 12
    ws.getRow(7).height = 36
    ws.getRow(8).height = 14

    const numCell = ws.getRow(7).getCell(actualCol)
    numCell.value = b.value
    numCell.font  = { color:{argb:'FF'+b.color}, size:28, bold:true, name:'Calibri' }
    numCell.fill  = fill(b.bg)
    numCell.border = { top:thinBdr(C.bdr), left:thinBdr(C.bdr), right:thinBdr(C.bdr) }
    numCell.alignment = al('center','middle')

    const lblCell = ws.getRow(8).getCell(actualCol)
    lblCell.value = b.label
    lblCell.font  = font(C.muteTx, 8)
    lblCell.fill  = fill(b.bg)
    lblCell.border = { bottom:thinBdr(C.bdr), left:thinBdr(C.bdr), right:thinBdr(C.bdr) }
    lblCell.alignment = al('center','middle')
  })

  ws.getRow(9).height = 10

  // ─ COMPLETED PROJECTS — Before / After Results ─
  sectionLabel(ws,'B10:I10','  COMPLETED PROJECTS — BEFORE vs AFTER RESULTS  ·  Evidence of sustained improvement')

  headerRow(ws, 11,
    ['','PROJECT','BELT TYPE','PORTFOLIO','METRIC','BASELINE','ACHIEVED','IMPROVEMENT','EST. BENEFIT',''],
    22
  )

  if (closed.length === 0) {
    ws.getRow(12).height = 30
    ws.mergeCells('B12:I12')
    const empty = ws.getCell('B12')
    empty.value = 'No completed projects yet — projects will appear here once closed in Continuum'
    empty.font  = font(C.muteTx, 10, false, true)
    empty.fill  = fill(C.row1)
    empty.alignment = al('center','middle')
  }

  closed.forEach((p, i) => {
    const r  = 12 + i
    const bg = i%2===0 ? C.row0 : C.row1
    const pf = portfolios.find(pf=>pf.id===p.portfolio_id)
    ws.getRow(r).height = 22

    let charter = {}
    try { charter = JSON.parse(p.charter||'{}') } catch {}

    const baseline  = p.baseline!=null ? p.baseline : '—'
    const achieved  = p.target_value!=null ? p.target_value : '—'
    const hi        = p.metric_id !== 'dpmo'
    const impPct    = (p.baseline&&p.target_value)
      ? (hi
          ? `+${((p.target_value-p.baseline)/p.baseline*100).toFixed(1)}%`
          : `-${((p.baseline-p.target_value)/p.baseline*100).toFixed(1)}%`)
      : '—'
    const benefit   = charter.benefits || '—'

    const rowVals = [
      '', p.title, beltLabel(p.project_type), pf?.name||'—',
      p.metric_id?.toUpperCase()||'—',
      baseline, achieved, impPct, benefit, ''
    ]

    rowVals.forEach((v, ci) => {
      const cell = ws.getRow(r).getCell(ci+1)
      cell.value = v
      cell.border = box(C.bdr)
      cell.alignment = al(ci===5||ci===6||ci===7?'center':'left','middle')

      if (ci===2) { cell.font=font(C.bodyTx,10,true); cell.fill=fill(bg) }
      else if (ci===3) { cell.font={color:{argb:'FF'+beltColor(p.project_type)},size:9,bold:true,name:'Calibri'}; cell.fill=fill(bg) }
      else if (ci===5) { cell.font=font(C.muteTx,10); cell.fill=fill(bg) }
      else if (ci===6) { cell.font={color:{argb:'FF'+C.gnTx},size:10,bold:true,name:'Calibri'}; cell.fill=fill(C.gnBg) }
      else if (ci===7) {
        const isPos = typeof v==='string'&&v.startsWith('+')
        const isNeg = typeof v==='string'&&v.startsWith('-')&&p.metric_id!=='dpmo'
        cell.font = { color:{argb:'FF'+(isPos?C.gnTx:isNeg?C.rdTx:C.bodyTx)}, size:11, bold:true, name:'Calibri' }
        cell.fill = fill(isPos?C.gnBg:C.row0)
      } else if (ci===8) {
        cell.font = font(C.muteTx, 9, false, true)
        cell.fill = fill(bg)
        cell.alignment = al('left','middle',true)
      } else { cell.font=font(C.muteTx,9); cell.fill=fill(bg) }
    })
  })

  const sep1R = 12 + closed.length + 1
  ws.getRow(sep1R).height = 10
  sectionLabel(ws,`B${sep1R+1}:I${sep1R+1}`,'  ACTIVE PROJECTS — IN-FLIGHT IMPROVEMENTS  ·  Progress and expected benefit')

  headerRow(ws, sep1R+2,
    ['','PROJECT','BELT TYPE','PORTFOLIO','STAGE','DMAIC PROGRESS','EXPECTED BENEFIT','DAYS ACTIVE','LAST UPDATED',''],
    22
  )

  active.forEach((p, i) => {
    const r  = sep1R + 3 + i
    const bg = i%2===0 ? C.row0 : C.row1
    const pf = portfolios.find(pf=>pf.id===p.portfolio_id)
    const daysActive = p.created_at ? Math.floor((Date.now()-new Date(p.created_at))/86400000) : '—'
    const updDate    = p.updated_at ? p.updated_at.slice(0,10) : '—'
    const dsSinceUpd = p.updated_at ? Math.floor((Date.now()-new Date(p.updated_at))/86400000) : null
    const isStalled  = dsSinceUpd && dsSinceUpd > 14
    let charter = {}
    try { charter = JSON.parse(p.charter||'{}') } catch {}
    const benefit = charter.benefits || charter.businessCase || '—'
    ws.getRow(r).height = 20

    const rowVals = [
      '', p.title, beltLabel(p.project_type), pf?.name||'—',
      p.stage||'—', dmiacBar(p.stage), benefit, daysActive, updDate, ''
    ]

    rowVals.forEach((v, ci) => {
      const cell = ws.getRow(r).getCell(ci+1)
      cell.border = box(C.bdr)
      cell.alignment = al(ci===7||ci===8?'center':'left','middle')

      if (ci===8) {
        // Last updated date — amber if stalled
        cell.value = v
        cell.font  = font(isStalled ? C.amTx : C.muteTx, 9, isStalled)
        cell.fill  = fill(isStalled ? C.amBg : bg)
      } else if (ci===2) {
        cell.value = v; cell.font=font(C.bodyTx,10,true); cell.fill=fill(bg)
      } else if (ci===3) {
        cell.value = v; cell.font={color:{argb:'FF'+beltColor(p.project_type)},size:9,bold:true,name:'Calibri'}; cell.fill=fill(bg)
      } else if (ci===4) {
        cell.value = v; cell.font={color:{argb:'FF'+stageColor(p.stage)},size:9,bold:true,name:'Calibri'}; cell.fill=fill(bg)
      } else if (ci===5) {
        cell.value = v; cell.font={color:{argb:'FF'+stageColor(p.stage)},size:9,name:'Courier New'}; cell.fill=fill(bg)
      } else if (ci===6) {
        cell.value = v; cell.font=font(C.muteTx,9,false,true); cell.fill=fill(bg); cell.alignment=al('left','middle',true)
      } else {
        cell.value = v; cell.font=font(C.muteTx,9); cell.fill=fill(bg)
      }
    })
  })

  // About / how to use footer
  const footR = sep1R + 4 + active.length
  ws.getRow(footR).height = 10
  sectionLabel(ws,`B${footR+1}:I${footR+1}`,'  ABOUT THIS REPORT  ·  Generated automatically from Continuum CI Management System')
  const aboutLines = [
    `This report is auto-generated from Continuum — your personal CI management platform. It reflects live data from your app.`,
    `To update this file: open Reports in Continuum → click "Sync Now". The file refreshes automatically every day at 07:00.`,
    `To open the app:  ${appUrl}   ·   All project data, KPIs, floor observations and ideas are managed inside Continuum.`,
    `For performance review evidence: use the "Before vs After Results" table above and the Activity Log sheet to demonstrate daily CI practice.`,
  ]
  aboutLines.forEach((line, i) => {
    const r = footR + 2 + i
    ws.getRow(r).height = 16
    ws.mergeCells(`B${r}:I${r}`)
    const c = ws.getCell(`B${r}`)
    c.value = line
    c.font  = font(i===2?C.sDef:C.muteTx, 9, false, i>0)
    c.fill  = fill(C.row1)
    c.border = box(C.bdr)
    c.alignment = al('left','middle')
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHEET 4 — PROJECT REGISTER
// ═══════════════════════════════════════════════════════════════════════════════
function buildProjects(ws, projects, portfolios) {
  ws.columns = [
    {width:2},{width:4},{width:28},{width:13},{width:18},
    {width:12},{width:20},{width:10},{width:18},{width:11},{width:12},{width:24},{width:14},{width:2}
  ]
  setupPage(ws, 'Project Register', 'Continuum CI')
  ws.views = [{ state:'frozen', xSplit:0, ySplit:8, showGridLines:false }]

  const active  = projects.filter(p=>p.stage!=='Closed').length
  const closed  = projects.filter(p=>p.stage==='Closed').length
  const stalled = projects.filter(p=>{
    const ds=p.updated_at?Math.floor((Date.now()-new Date(p.updated_at))/86400000):null
    return ds&&ds>14&&p.stage!=='Closed'
  }).length

  titleBlock(ws,'B1:M1','B2:M2','B3:M3',
    'CI PROJECT REGISTER',
    `${projects.length} total  ·  ${active} active  ·  ${closed} completed  ·  ${stalled} stalled  ·  Click "Open in Continuum" links to navigate directly to each project`
  )
  ws.getRow(4).height = 6

  ws.mergeCells('B5:M5')
  const leg = ws.getCell('B5')
  leg.value = '  STAGE KEY:  Define = Navy   Measure = Purple   Analyse = Amber   Improve = Green   Control = Teal   Closed = Grey  ·  Belt: Quick Win = Green  Yellow Belt = Gold  Green Belt = Blue  Black Belt = Indigo  Investigation = Red'
  leg.font  = font(C.muteTx, 8, false, true)
  leg.fill  = fill(C.row1)
  leg.border = { bottom: thinBdr(C.bdr) }
  leg.alignment = al('left', 'middle')
  ws.getRow(5).height = 14

  ws.getRow(6).height = 4
  sectionLabel(ws, 'B7:M7', '  ALL PROJECTS — sorted active first by stage, then completed  ·  Filter by any column')

  headerRow(ws, 8,
    ['','#','PROJECT NAME','BELT','PORTFOLIO','STAGE','DMAIC PROGRESS','METRIC','BASELINE → TARGET','DAYS ACTIVE','HEALTH','PROBLEM STATEMENT','LAST UPDATED',''],
    22
  )
  ws.autoFilter = { from:{row:8,column:2}, to:{row:8,column:13} }

  const stageOrd = ['Define','Measure','Analyse','Analyze','Improve','Control']
  const sorted   = [...projects].sort((a,b) => {
    if (a.stage==='Closed'&&b.stage!=='Closed') return 1
    if (b.stage==='Closed'&&a.stage!=='Closed') return -1
    return stageOrd.indexOf(a.stage) - stageOrd.indexOf(b.stage)
  })

  let sepInserted = false, extraRows = 0

  sorted.forEach((p, i) => {
    if (!sepInserted && p.stage==='Closed') {
      sepInserted = true
      extraRows = 1
      sectionLabel(ws, `B${9+i}:M${9+i}`, '  COMPLETED PROJECTS')
    }

    const r   = 9 + i + extraRows
    const bg  = i%2===0 ? C.row0 : C.row1
    const pf  = portfolios.find(pf=>pf.id===p.portfolio_id)
    const ds  = p.updated_at ? Math.floor((Date.now()-new Date(p.updated_at))/86400000) : null
    const isStalled  = ds&&ds>14&&p.stage!=='Closed'
    const daysActive = p.created_at ? Math.floor((Date.now()-new Date(p.created_at))/86400000) : '—'
    const baseTarget = p.baseline!=null&&p.target_value!=null?`${p.baseline} → ${p.target_value}`:'—'
    const health     = isStalled?'⚠ STALLED':p.stage==='Closed'?'✓ Complete':'● Active'
    const probStmt   = p.problem_statement ? p.problem_statement.slice(0,120)+(p.problem_statement.length>120?'…':'') : '—'

    ws.getRow(r).height = 22

    // Col by col (14 columns total: spacer, #, name, belt, portfolio, stage, dmaic, metric, base→tgt, days, health, problem, link, spacer)
    const setCell = (colIdx, value, opts={}) => {
      const cell = ws.getRow(r).getCell(colIdx)
      cell.border = box(C.bdr)
      cell.fill   = fill(opts.bg || bg)
      cell.font   = opts.font || font(C.muteTx, 9)
      cell.alignment = opts.align || al('left','middle')
      cell.value  = value
    }

    setCell(1, '')
    setCell(2, i+1, { font:font(C.muteTx,9), align:al('center','middle') })
    // Project name — bold, stall colour
    ws.getRow(r).getCell(3).value = p.title
    ws.getRow(r).getCell(3).font  = { color:{argb:'FF'+(isStalled?C.amTx:C.bodyTx)}, size:10, bold:true, name:'Calibri' }
    ws.getRow(r).getCell(3).fill  = fill(isStalled?C.amBg:bg)
    ws.getRow(r).getCell(3).border = box(C.bdr)
    ws.getRow(r).getCell(3).alignment = al('left','middle')
    // Belt
    ws.getRow(r).getCell(4).value = beltLabel(p.project_type)
    ws.getRow(r).getCell(4).font  = { color:{argb:'FF'+beltColor(p.project_type)}, size:9, bold:true, name:'Calibri' }
    ws.getRow(r).getCell(4).fill  = fill(bg); ws.getRow(r).getCell(4).border=box(C.bdr); ws.getRow(r).getCell(4).alignment=al('left','middle')
    // Portfolio
    setCell(5, pf?.name||'—', { font:font(C.muteTx,9) })
    // Stage
    ws.getRow(r).getCell(6).value = p.stage||'—'
    ws.getRow(r).getCell(6).font  = { color:{argb:'FF'+stageColor(p.stage)}, size:9, bold:true, name:'Calibri' }
    ws.getRow(r).getCell(6).fill  = fill(bg); ws.getRow(r).getCell(6).border=box(C.bdr); ws.getRow(r).getCell(6).alignment=al('left','middle')
    // DMAIC bar
    ws.getRow(r).getCell(7).value = dmiacBar(p.stage)
    ws.getRow(r).getCell(7).font  = { color:{argb:'FF'+stageColor(p.stage)}, size:9, name:'Courier New' }
    ws.getRow(r).getCell(7).fill  = fill(bg); ws.getRow(r).getCell(7).border=box(C.bdr); ws.getRow(r).getCell(7).alignment=al('left','middle')
    // Metric
    setCell(8, p.metric_id?.toUpperCase()||'—', { font:font(C.bodyTx,9,true), align:al('center','middle') })
    // Baseline → Target
    setCell(9, baseTarget, { font:font(C.bodyTx,10,true) })
    // Days active
    setCell(10, daysActive, { font:font(isStalled?C.amTx:C.muteTx,9), align:al('center','middle') })
    // Health
    const hCell = ws.getRow(r).getCell(11)
    hCell.value = health; hCell.border=box(C.bdr); hCell.alignment=al('center','middle')
    if (isStalled) { hCell.font={color:{argb:'FF'+C.rdTx},size:9,bold:true,name:'Calibri'}; hCell.fill=fill(C.rdBg) }
    else if (p.stage==='Closed') { hCell.font={color:{argb:'FF'+C.gnTx},size:9,name:'Calibri'}; hCell.fill=fill(C.gnBg) }
    else { hCell.font={color:{argb:'FF'+C.bodyTx},size:9,name:'Calibri'}; hCell.fill=fill(bg) }
    // Problem statement
    setCell(12, probStmt, { font:font(C.muteTx,8,false,true), align:al('left','middle',true) })
    // Last updated date
    const updCell = ws.getRow(r).getCell(13)
    const updDate = p.updated_at ? p.updated_at.slice(0,10) : '—'
    updCell.value = updDate
    updCell.font  = font(isStalled ? C.amTx : C.muteTx, 9, isStalled)
    updCell.fill  = fill(isStalled ? C.amBg : (i%2===0 ? C.row0 : C.row1))
    updCell.border = box(C.bdr)
    updCell.alignment = al('center','middle')
    setCell(14, '')
  })

  // Totals row
  const totR = 9 + sorted.length + extraRows
  ws.getRow(totR).height = 22
  for (let c=2; c<=13; c++) {
    const cell = ws.getRow(totR).getCell(c)
    cell.fill  = fill(C.hNav)
    cell.border = box(C.bdrH)
    cell.font  = font(C.hText, 9, true)
    cell.alignment = al('left','middle')
  }
  ws.getRow(totR).getCell(3).value = `${sorted.length} projects  ·  ${active} active  ·  ${closed} completed`
  ws.getRow(totR).getCell(11).value = stalled>0?`⚠ ${stalled} stalled`:'✓ None stalled'
  ws.getRow(totR).getCell(11).font = { color:{argb:'FF'+(stalled>0?C.rdBg:C.hText)}, size:9, bold:true, name:'Calibri' }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHEET 4 — CI PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════
function buildPipeline(ws, portfolios, summaries) {
  ws.columns = [
    {width:2},{width:26},{width:14},{width:14},{width:14},{width:14},{width:14},{width:14},{width:2}
  ]
  setupPage(ws, 'CI Pipeline', 'Continuum CI')
  ws.views = [{ state:'frozen', xSplit:0, ySplit:12, showGridLines:false }]

  titleBlock(ws,'B1:H1','B2:H2','B3:H3',
    'CI PIPELINE — IDEA TO IMPROVEMENT',
    'Funnel view showing ideas flowing: Observation → Idea → Definition → Validation → Active Project → Completed'
  )
  ws.getRow(4).height = 8

  sectionLabel(ws, 'B5:H5', '  STAGE DEFINITIONS')
  const stageDefs = [
    {stage:'IDEAS',       color:C.sDef, desc:'Raw observations raised as improvement opportunities (scored and categorised in Continuum)'},
    {stage:'DEFINITION',  color:C.sMsr, desc:'Problem scoped, problem statement written, scope and KPI metric identified'},
    {stage:'VALIDATION',  color:C.sAna, desc:'Business case reviewed by portfolio manager, approved to proceed to full project'},
    {stage:'ACTIVE',      color:C.sImp, desc:'Full DMAIC or Quick Win project underway — stage gates being progressed'},
    {stage:'COMPLETE',    color:C.gnTx, desc:'Project closed, benefits measured, SOP written, team trained, handover complete'},
  ]
  stageDefs.forEach((s, i) => {
    const r = 6 + i
    ws.getRow(r).height = 16
    ws.mergeCells(`C${r}:C${r}`)
    const sc = ws.getRow(r).getCell(3)
    sc.value = s.stage
    sc.font  = font(C.hText, 8, true)
    sc.fill  = fill(s.color)
    sc.border = box(C.bdrH)
    sc.alignment = al('center','middle')

    ws.mergeCells(`D${r}:H${r}`)
    const dc = ws.getRow(r).getCell(4)
    dc.value = s.desc
    dc.font  = font(C.muteTx, 8)
    dc.fill  = fill(C.row1)
    dc.border = box(C.bdr)
    dc.alignment = al('left','middle')
  })

  ws.getRow(11).height = 8

  headerRow(ws, 12, ['','PORTFOLIO','IDEAS','DEFINITION','VALIDATION','ACTIVE','COMPLETE','TOTAL',''], 22)
  ws.autoFilter = { from:{row:12,column:2}, to:{row:12,column:8} }

  portfolios.forEach((p, i) => {
    const r  = 13 + i
    const s  = summaries?.[p.id] || {}
    const bg = i%2===0 ? C.row0 : C.row1
    const total = (s.ideaCount||0)+(s.definitionCount||0)+(s.validationCount||0)+(s.assignedCount||0)+(s.finishedCount||0)
    ws.getRow(r).height = 22

    const vals = ['', p.name, s.ideaCount||0, s.definitionCount||0, s.validationCount||0, s.assignedCount||0, s.finishedCount||0, total, '']
    vals.forEach((v, ci) => {
      const cell = ws.getRow(r).getCell(ci+1)
      cell.value = v
      cell.border = box(C.bdr)
      cell.alignment = al(ci===1?'left':'center','middle')
      if (ci===1) { cell.font=font(C.bodyTx,10,true); cell.fill=fill(bg) }
      else if (ci===6&&v>0) { cell.font={color:{argb:'FF'+C.gnTx},size:11,bold:true,name:'Calibri'}; cell.fill=fill(C.gnBg) }
      else if (ci===5&&v>0) { cell.font={color:{argb:'FF'+C.sDef},size:11,bold:true,name:'Calibri'}; cell.fill=fill('EFF6FF') }
      else if (ci===7)      { cell.font=font(C.bodyTx,10,true); cell.fill=fill(C.row1) }
      else                  { cell.font=font(v>0?C.bodyTx:C.muteTx,10,v>0); cell.fill=fill(bg) }
    })
  })

  const totR = 13 + portfolios.length
  ws.getRow(totR).height = 22
  const tots = ['','TOTAL',
    portfolios.reduce((s,p)=>s+(summaries[p.id]?.ideaCount||0),0),
    portfolios.reduce((s,p)=>s+(summaries[p.id]?.definitionCount||0),0),
    portfolios.reduce((s,p)=>s+(summaries[p.id]?.validationCount||0),0),
    portfolios.reduce((s,p)=>s+(summaries[p.id]?.assignedCount||0),0),
    portfolios.reduce((s,p)=>s+(summaries[p.id]?.finishedCount||0),0),
    0,''
  ]
  tots[7] = tots.slice(2,7).reduce((s,v)=>s+(typeof v==='number'?v:0),0)
  tots.forEach((v,ci)=>{
    const cell = ws.getRow(totR).getCell(ci+1)
    cell.value = v
    cell.font  = font(C.hText,10,true)
    cell.fill  = fill(C.hNav)
    cell.border = box(C.bdrH)
    cell.alignment = al(ci===1?'left':'center','middle')
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHEET 5 — ACTIVITY LOG
// ═══════════════════════════════════════════════════════════════════════════════
function buildActivity(ws, activityLog) {
  ws.columns = [
    {width:2},{width:13},{width:16},{width:38},{width:26},{width:2}
  ]
  setupPage(ws, 'CI Activity Log', 'Continuum CI')
  ws.views = [{ state:'frozen', xSplit:0, ySplit:6, showGridLines:false }]

  titleBlock(ws,'B1:E1','B2:E2','B3:E3',
    'CI ACTIVITY LOG',
    `${activityLog.length} entries  ·  Complete audit trail of all CI activity  ·  Filter by type or date  ·  Evidence of daily CI practice`
  )
  ws.getRow(4).height = 8

  headerRow(ws, 5, ['','DATE','ACTIVITY TYPE','DESCRIPTION / DETAIL','ADDITIONAL INFO',''], 20)
  ws.autoFilter = { from:{row:5,column:2}, to:{row:5,column:5} }

  const typeBg = {
    'KPI Logged':      C.tKpi,  'KPI Logged Tx':      C.tKpiTx,
    'Project Updated': C.tProj, 'Project Updated Tx':  C.tProjTx,
    'Observation':     C.tObs,  'Observation Tx':      C.tObsTx,
    'Idea Raised':     C.tIdea, 'Idea Raised Tx':      C.tIdeaTx,
    'Project Created': C.tProj, 'Project Created Tx':  C.tProjTx,
  }

  activityLog.slice(0,500).forEach((entry, i) => {
    const r   = 6 + i
    const bg  = i%2===0 ? C.row0 : C.row1
    const tbg = typeBg[entry.type] || bg
    const ttx = typeBg[entry.type+' Tx'] || C.muteTx
    ws.getRow(r).height = 16

    const vals = ['', entry.date, entry.type, entry.description, entry.detail||'', '']
    vals.forEach((v, ci) => {
      const cell = ws.getRow(r).getCell(ci+1)
      cell.value = v
      cell.border = box(C.bdr)
      cell.alignment = al('left','middle')
      if (ci===2) { cell.font={color:{argb:'FF'+ttx},size:9,bold:true,name:'Calibri'}; cell.fill=fill(tbg) }
      else if (ci===3) { cell.font=font(C.bodyTx,9); cell.fill=fill(bg) }
      else { cell.font=font(C.muteTx,9); cell.fill=fill(bg) }
    })
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHEET 6 — CI MATURITY
// ═══════════════════════════════════════════════════════════════════════════════
function buildMaturity(ws, data) {
  ws.columns = [
    {width:2},{width:22},{width:36},{width:12},{width:12},{width:18},{width:34},{width:2}
  ]
  setupPage(ws, 'CI Maturity Score', 'Continuum CI')
  ws.views = [{ showGridLines: false }]

  titleBlock(ws,'B1:G1','B2:G2','B3:G3',
    'CI MATURITY SCORE — SITE ASSESSMENT',
    'Scored 1–5 across 5 dimensions of CI practice  ·  Auto-calculated from Continuum data  ·  Manual override available in app',
    C.hAccent
  )
  ws.getRow(4).height = 8

  sectionLabel(ws, 'B5:G5', '  MATURITY DIMENSIONS')
  headerRow(ws, 6, ['','DIMENSION','DESCRIPTION & EVIDENCE CRITERIA','SCORE','LEVEL','VISUAL INDICATOR','TO REACH NEXT LEVEL',''], 22)

  const nextSteps = {
    '5S Practice': [
      'Run a formal 5S audit and document score against each pillar (Sort, Set, Shine, Standardise, Sustain)',
      'Implement a weekly audit schedule with a named owner and publish results on the area board',
      'Introduce 5S red-tag events and link near-misses / defects directly to 5S observations in Continuum',
      'Embed 5S in team leader daily walk — score visible at board, deviations actioned same-shift',
      '(Optimising — sustain and share best practice across other areas)',
    ],
    'DMAIC Discipline': [
      'Start a structured project with a written charter, clear problem statement and defined metric',
      'Complete stage gate tools at each DMAIC phase (SIPOC, Fishbone, MSA, FMEA) with evidence logged',
      'Use statistical tools: run charts, control charts, hypothesis testing — log outputs in Continuum charter',
      'Pilot improvements with data validation before full roll-out; control phase includes SPC chart',
      '(Optimising — sustain and coach others in DMAIC)',
    ],
    'Standard Work': [
      'Write at least one SOP for an improved process and brief the team — log it in Continuum charter',
      'Create SOPs for all closed projects; issue to team leaders and confirm training completed',
      'Link SOPs to control charts — deviation from standard triggers automatic review process',
      'Standard work is owned by the team, reviewed quarterly, updated when improvement occurs',
      '(Optimising — standard work is self-sustaining and drives further CI)',
    ],
    'Visual Management': [
      'Log KPIs in Continuum daily; record at least 2 floor observations per week',
      'Post KPI charts on area board — current vs target — reviewed at daily shift brief',
      'Introduce daily management board reviewed at stand-up: safety, quality, delivery, cost, people',
      'All KPI trends, project status and actions visible at board; TLs own daily update cadence',
      '(Optimising — visual management drives autonomous improvement at team level)',
    ],
    'Problem Solving Depth': [
      'Use 5-Why on every repeat defect — record findings in Continuum project/observation',
      'Combine 5-Why with Fishbone/Ishikawa to ensure root cause addresses people, process, equipment, method',
      'Validate root cause with data before implementing counter-measures; confirm with run charts post-fix',
      'Use SPC and process capability to hold gains; escalate statistically significant shifts immediately',
      '(Optimising — root cause analysis is embedded in daily operations culture)',
    ],
  }

  const dims = [
    {
      key:   '5S Practice',
      desc:  'Regular 5S audits conducted, area maintained to standard, defects/waste visible and addressed. Evidence: audit scores, observation logs.',
      score: data.maturity?.five_s || 2,
    },
    {
      key:   'DMAIC Discipline',
      desc:  'Projects follow structured DMAIC methodology, stage gates are completed with evidence, tools applied correctly. Evidence: project stage progression, tool completion.',
      score: data.maturity?.dmaic || 2,
    },
    {
      key:   'Standard Work',
      desc:  'SOPs written for improved processes, teams briefed and trained, sustainment mechanisms in place. Evidence: SOP count, training records, handover notes.',
      score: data.maturity?.standard_work || 2,
    },
    {
      key:   'Visual Management',
      desc:  'KPI boards updated daily, floor observations logged regularly, shift handovers completed. Evidence: KPI logging frequency, observation count, report generation.',
      score: data.maturity?.visual_mgmt || 2,
    },
    {
      key:   'Problem Solving Depth',
      desc:  'Root cause analysis rigorous (5-Why/Fishbone), counter-measures address root cause not symptoms, SPC used for control. Evidence: project charter quality, control tools.',
      score: data.maturity?.problem_solving || 2,
    },
  ]

  const levelDesc = {
    1:'Initial — reactive, ad hoc',
    2:'Developing — basic structure forming',
    3:'Defined — consistent methodology',
    4:'Managed — data-driven, sustained results',
    5:'Optimising — CI embedded in culture',
  }

  dims.forEach((d, i) => {
    const r  = 7 + i
    const bg = i%2===0 ? C.row0 : C.row1
    const sc = Math.min(5, Math.max(1, Math.round(d.score)))
    const ns = sc < 5 ? (nextSteps[d.key]?.[sc-1] || '—') : '✓ At maximum level — maintain and share'
    ws.getRow(r).height = 48 // tall enough for wrapped next-steps text

    const rowVals = ['', d.key, d.desc, `${sc} / 5`, levelDesc[sc], scoreBar(sc), ns, '']
    rowVals.forEach((v, ci) => {
      const cell = ws.getRow(r).getCell(ci+1)
      cell.value = v
      cell.border = box(C.bdr)
      cell.alignment = al(ci===3||ci===5?'center':'left', 'middle', ci===2||ci===6)

      if (ci===1) { cell.font=font(C.bodyTx,10,true); cell.fill=fill(bg) }
      else if (ci===2) { cell.font=font(C.muteTx,9); cell.fill=fill(bg) }
      else if (ci===3) {
        cell.font={color:{argb:'FF'+scoreColor(sc)},size:14,bold:true,name:'Calibri'}
        cell.fill=fill(scoreBgColor(sc))
      } else if (ci===4) {
        cell.font={color:{argb:'FF'+scoreColor(sc)},size:8,name:'Calibri'}
        cell.fill=fill(scoreBgColor(sc))
      } else if (ci===5) {
        cell.font={color:{argb:'FF'+scoreColor(sc)},size:11,name:'Courier New'}
        cell.fill=fill(bg)
      } else if (ci===6) {
        cell.font={color:{argb:'FF'+(sc<5?C.sDef:C.gnTx)},size:9,bold:sc<5,name:'Calibri'}
        cell.fill=fill(sc<5?'EFF6FF':C.gnBg)
      } else {
        cell.fill=fill(bg)
      }
    })
  })

  // Average row
  const avg   = dims.reduce((s,d)=>s+d.score,0) / dims.length
  const avgSc = Math.round(avg)
  const totR  = 7 + dims.length
  ws.getRow(totR).height = 28
  const avgVals = ['','OVERALL MATURITY',`Average of all 5 dimensions — ${levelDesc[avgSc]}`,`${avg.toFixed(1)} / 5`,levelDesc[avgSc],scoreBar(Math.round(avg)),'Improve all dimensions to 5/5 to achieve Optimising maturity — see "To Reach Next Level" column above','']
  avgVals.forEach((v, ci) => {
    const cell = ws.getRow(totR).getCell(ci+1)
    cell.value = v
    cell.font  = ci===3
      ? {color:{argb:'FF'+scoreColor(avgSc)},size:16,bold:true,name:'Calibri'}
      : font(C.hText, 10, true)
    cell.fill  = ci===3 ? fill(scoreBgColor(avgSc)) : fill(C.hNav)
    cell.border = box(C.bdrH)
    cell.alignment = al(ci===3||ci===5?'center':'left','middle', ci===6)
  })

  ws.getRow(totR+1).height = 10
  sectionLabel(ws, `B${totR+2}:G${totR+2}`, '  MATURITY SCALE — HOW TO INTERPRET YOUR SCORE')

  const scaleDefs = [
    {n:1, label:'Initial',    desc:'CI activity is reactive. Problems solved when they become crises. No repeatable approach.'},
    {n:2, label:'Developing', desc:'Basic CI tools beginning to be used. Projects started but methodology inconsistent. Some wins.'},
    {n:3, label:'Defined',    desc:'Structured DMAIC in use. Projects deliver results. SOPs being created. Becoming repeatable.'},
    {n:4, label:'Managed',    desc:'Data-driven. SPC in use. KPI trends visible. CI results sustained. Leadership aware of programme.'},
    {n:5, label:'Optimising', desc:'CI is cultural. Every team member engaged. Improvements proactive. Results visible at board level.'},
  ]

  headerRow(ws, totR+3, ['','SCORE','LEVEL','WHAT THIS MEANS — BEHAVIOURS AND EVIDENCE','','','',''], 18)

  scaleDefs.forEach((s, i) => {
    const r  = totR+4+i
    const bg = i%2===0 ? C.row0 : C.row1
    ws.getRow(r).height = 24
    ;['','','','','','','',''].forEach((_, ci) => {
      const cell = ws.getRow(r).getCell(ci+1)
      cell.border = box(C.bdr)
      cell.fill   = fill(ci===1?scoreBgColor(s.n):bg)
      if (ci===1) {
        cell.value = `${s.n} — ${s.label}`
        cell.font  = {color:{argb:'FF'+scoreColor(s.n)},size:9,bold:true,name:'Calibri'}
        cell.alignment = al('center','middle')
      } else if (ci===2) {
        cell.value = s.label
        cell.font  = {color:{argb:'FF'+scoreColor(s.n)},size:9,bold:false,name:'Calibri'}
        cell.fill  = fill(scoreBgColor(s.n))
        cell.alignment = al('center','middle')
      } else if (ci===3) {
        ws.mergeCells(`D${r}:G${r}`)
        cell.value = s.desc
        cell.font  = font(C.bodyTx, 9)
        cell.alignment = al('left','middle',true)
      }
    })
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// WAREHOUSE HEALTH
// ═══════════════════════════════════════════════════════════════════════════════
function buildWarehouseHealth(ws, data) {
  const SECTIONS = [
    { id: 'inbound',  label: 'Inbound'  },
    { id: 'icqa',     label: 'ICQA'     },
    { id: 'pick',     label: 'Pick'     },
    { id: 'pack',     label: 'Pack'     },
    { id: 'outbound', label: 'Outbound' },
  ]
  const scoreMap = Object.fromEntries((data.warehouseHealth || []).map(r => [r.section_id, r]))

  function healthBg(score) {
    if (score == null) return C.gyBg
    return score >= 85 ? C.gnBg : score >= 70 ? C.amBg : C.rdBg
  }
  function healthTx(score) {
    if (score == null) return C.gyTx
    return score >= 85 ? C.gnTx : score >= 70 ? C.amTx : C.rdTx
  }
  function healthLabel(score) {
    if (score == null) return 'No Data'
    return score >= 85 ? 'Good' : score >= 70 ? 'At Risk' : 'Critical'
  }
  function scoreBar(score) {
    if (score == null) return '—'
    const filled = Math.round((score / 100) * 10)
    return '█'.repeat(filled) + '░'.repeat(10 - filled) + `  ${score.toFixed(1)}%`
  }

  // Col widths
  ws.columns = [
    { width: 2 }, { width: 16 }, { width: 14 }, { width: 30 },
    { width: 14 }, { width: 12 }, { width: 12 }, { width: 14 },
  ]

  // Banner
  ws.getRow(1).height = 40
  ws.mergeCells('B1:H1')
  const banner = ws.getRow(1).getCell(2)
  banner.value = `${data.siteName || 'Amazon FC'}  ·  WAREHOUSE HEALTH SCORES`
  banner.font  = { color: { argb: 'FFFFFFFF' }, size: 16, bold: true, name: 'Calibri' }
  banner.fill  = fill(C.hNav)
  banner.alignment = al('left', 'middle')

  ws.getRow(2).height = 6
  ws.getRow(3).height = 18
  ws.mergeCells('B3:H3')
  const sub = ws.getRow(3).getCell(2)
  sub.value = `Weighted health scores per warehouse section  ·  Data as of ${new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}`
  sub.font  = font(C.muteTx, 9, false, true)
  sub.fill  = fill('F8FAFC')
  sub.alignment = al('left', 'middle')

  ws.getRow(4).height = 8

  // Section header
  headerRow(ws, 5, ['', 'SECTION', 'HEALTH SCORE', 'SCORE BAR', 'STATUS', 'LAST SHIFT DATE', 'SHIFT', ''], 20)

  let r = 6
  SECTIONS.forEach((sec, i) => {
    const d    = scoreMap[sec.id]
    const score = d?.score ?? null
    const bg   = i % 2 === 0 ? C.row0 : C.row1
    ws.getRow(r).height = 26

    const vals = ['', sec.label, score != null ? score.toFixed(1) : '—', scoreBar(score), healthLabel(score), d?.date || '—', d?.shift_type || '—', '']
    vals.forEach((v, ci) => {
      const cell = ws.getRow(r).getCell(ci + 1)
      cell.value  = v
      cell.border = box(C.bdr)
      cell.fill   = ci === 2 || ci === 4 ? fill(healthBg(score)) : fill(bg)
      cell.font   = ci === 1
        ? font(C.bodyTx, 10, true)
        : ci === 2 || ci === 4
          ? { color: { argb: 'FF' + healthTx(score) }, size: 10, bold: true, name: 'Calibri' }
          : ci === 3
            ? { color: { argb: 'FF' + healthTx(score) }, size: 8, name: 'Courier New' }
            : font(C.muteTx, 9)
      cell.alignment = al(ci === 2 || ci === 4 ? 'center' : 'left', 'middle')
    })
    r++
  })

  ws.getRow(r).height = 8
  r++

  // Legend
  sectionLabel(ws, `B${r}:G${r}`, '  HOW SCORES ARE CALCULATED')
  r++
  const legend = [
    ['Good (≥85%)', C.gnBg, C.gnTx, 'All key metrics tracking at or near target. Section performing well.'],
    ['At Risk (70–84%)', C.amBg, C.amTx, 'One or more metrics off target. Corrective action recommended.'],
    ['Critical (<70%)', C.rdBg, C.rdTx, 'Multiple metrics significantly off target. Immediate intervention required.'],
  ]
  legend.forEach(([label, bg, tx, desc]) => {
    ws.getRow(r).height = 20
    const lCell = ws.getRow(r).getCell(2)
    lCell.value = label
    lCell.font  = { color: { argb: 'FF' + tx }, size: 9, bold: true, name: 'Calibri' }
    lCell.fill  = fill(bg)
    lCell.border = box(C.bdr)
    lCell.alignment = al('center', 'middle')

    ws.mergeCells(`D${r}:G${r}`)
    const dCell = ws.getRow(r).getCell(4)
    dCell.value = desc
    dCell.font  = font(C.bodyTx, 9)
    dCell.fill  = fill(C.row0)
    dCell.border = box(C.bdr)
    dCell.alignment = al('left', 'middle', true)
    r++
  })

  ws.getRow(r).height = 8
  r++
  sectionLabel(ws, `B${r}:G${r}`, '  SCORING FORMULA')
  r++
  ws.getRow(r).height = 20
  const fCell = ws.getRow(r).getCell(2)
  ws.mergeCells(`B${r}:G${r}`)
  fCell.value = 'Health Score = Σ(metric_score × severity_weight) ÷ Σ(severity_weight)   where metric_score = min(actual/target × 100, 100) for higher-is-better metrics; min(target/actual × 100, 100) for lower-is-better metrics'
  fCell.font  = font(C.muteTx, 9, false, true)
  fCell.fill  = fill(C.row1)
  fCell.border = box(C.bdr)
  fCell.alignment = al('left', 'middle', true)
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export async function generateExcelWorkbook(data) {
  const wb = new ExcelJS.Workbook()
  wb.creator  = 'Continuum CI'
  wb.company  = data.siteName || 'Amazon FC'
  wb.created  = new Date()
  wb.modified = new Date()

  const sheets = [
    { name:'📊 Overview',  color:'FFF97316', fn: buildOverview },
    { name:'🏆 CI Impact', color:'FFD97706', fn: buildImpact },
    { name:'📈 KPIs',      color:'FF1D4ED8', fn: buildKPIs,
      args: [data.kpiData||[], data.kpiTargets||{}, data.latestKpis||{}] },
    { name:'🏗 Projects',  color:'FF059669', fn: buildProjects,
      args: [data.projects||[], data.portfolios||[]] },
    { name:'🔄 Pipeline',  color:'FF6D28D9', fn: buildPipeline,
      args: [data.portfolios||[], data.summaries||{}] },
    { name:'📋 Activity',  color:'FF374151', fn: buildActivity,
      args: [data.activityLog||[]] },
    { name:'📐 Maturity',  color:'FFB45309', fn: buildMaturity },
    { name:'🏭 Wh. Health', color:'FF0F766E', fn: buildWarehouseHealth },
  ]

  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name, { properties: { tabColor: { argb: s.color } } })
    if (s.args) s.fn(ws, ...s.args)
    else s.fn(ws, data)
  }

  return wb
}
