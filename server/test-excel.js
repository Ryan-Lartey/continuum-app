/**
 * Standalone Excel test generator — runs without the server
 * Usage: node server/test-excel.js
 * Opens continuum-report.xlsx in your default spreadsheet app
 */

import { generateExcelWorkbook } from './services/excel.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { execSync } from 'child_process'

const __dir = dirname(fileURLToPath(import.meta.url))

// ── Rich demo dataset ─────────────────────────────────────────────────────────
function makeDate(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

// 90 days of KPI data with realistic variation + trends
function genKpiData() {
  const rows = []
  let uph = 92, acc = 99.1, dpmo = 680, dts = 96.5
  for (let i = 89; i >= 0; i--) {
    const date = makeDate(i)
    uph  = Math.round(Math.max(80, Math.min(105, uph  + (Math.random()-0.42)*2.2)))
    acc  = Math.round(Math.max(98.0, Math.min(99.9, acc  + (Math.random()-0.45)*0.15))*10)/10
    dpmo = Math.round(Math.max(350, Math.min(900,  dpmo + (Math.random()-0.52)*28)))
    dts  = Math.round(Math.max(94.0, Math.min(99.5, dts  + (Math.random()-0.44)*0.4))*10)/10
    rows.push({ metric_id:'uph',      date, value:uph,  signal: uph < 85 || uph > 103 })
    rows.push({ metric_id:'accuracy', date, value:acc,  signal: acc < 98.5 })
    rows.push({ metric_id:'dpmo',     date, value:dpmo, signal: dpmo > 750 })
    rows.push({ metric_id:'dts',      date, value:dts,  signal: dts < 95.0 })
  }
  return rows
}

const kpiData = genKpiData()
const latestDate = makeDate(0)

const portfolios = [
  { id:1, name:'Outbound Operations',    status:'active' },
  { id:2, name:'Inbound & Stow',         status:'active' },
  { id:3, name:'Pick Accuracy Programme',status:'active' },
  { id:4, name:'Safety & Environment',   status:'active' },
]

const projects = [
  {
    id:1, title:'Pick Rate Improvement — Batch Size Optimisation', project_type:'black_belt',
    portfolio_id:1, stage:'Improve', metric_id:'uph', baseline:88, target_value:98,
    created_at: makeDate(65), updated_at: makeDate(2),
    problem_statement:'Pick rate averaging 88 UPH against a target of 98. Root cause identified as suboptimal batch sizes causing excessive travel time.',
    charter:JSON.stringify({ benefits:'Estimated +10 UPH site-wide, ~£85k annualised benefit', sop:'Batch size SOP v2.1 issued' }),
    actions: JSON.stringify([
      {text:'Complete time-motion study on batch sizes', done:true},
      {text:'Pilot new batch parameters on Zone A', done:true},
      {text:'Statistical validation of results (n=200)', done:true},
      {text:'Roll out to Zone B and C', done:false},
      {text:'Write SOP and brief all pickers', done:false},
    ])
  },
  {
    id:2, title:'Inbound Scan Accuracy — Defect Elimination', project_type:'green_belt',
    portfolio_id:2, stage:'Control', metric_id:'accuracy', baseline:98.7, target_value:99.6,
    created_at: makeDate(110), updated_at: makeDate(1),
    problem_statement:'Inbound scan accuracy at 98.7% causing downstream DPMO issues and customer returns.',
    charter:JSON.stringify({ benefits:'DPMO reduction ~200 units, customer returns -18%', sop:'Inbound scan SOP issued to all TLs' }),
    actions: JSON.stringify([
      {text:'Map current state scan process', done:true},
      {text:'Root cause analysis — 5-Why and Fishbone', done:true},
      {text:'Trial dual-scan verification at receive point', done:true},
      {text:'Statistical process control chart implemented', done:true},
      {text:'Handover to operations team', done:false},
    ])
  },
  {
    id:3, title:'DPMO Reduction — Stow Error Investigation', project_type:'investigation',
    portfolio_id:2, stage:'Measure', metric_id:'dpmo', baseline:720, target_value:500,
    created_at: makeDate(18), updated_at: makeDate(8),
    problem_statement:'DPMO spiked to 720 over past 4 weeks. Initial observation suggests stow errors concentrated in Mezzanine zone.',
    charter:JSON.stringify({ benefits:'Potential escalation to full Green Belt project' }),
    actions: JSON.stringify([
      {text:'Pull and analyse DPMO data by zone', done:true},
      {text:'Observe mezzanine stow process — 2 shifts', done:true},
      {text:'Interview TLs and associates', done:false},
    ])
  },
  {
    id:4, title:'Dispatch Dock Utilisation — Quick Win', project_type:'quick_win',
    portfolio_id:1, stage:'Closed', metric_id:'dts', baseline:95.2, target_value:97.5,
    created_at: makeDate(45), updated_at: makeDate(12),
    problem_statement:'Dispatch dock utilisation causing DTS to miss target on Wednesday/Thursday peaks.',
    charter:JSON.stringify({ benefits:'DTS +2.3% on peak days', sop:'Dock allocation schedule issued' }),
    actions: JSON.stringify([
      {text:'Analyse dock utilisation data', done:true},
      {text:'Reschedule carrier slots to balance load', done:true},
      {text:'Confirm DTS improvement sustained 3 weeks', done:true},
    ])
  },
  {
    id:5, title:'Outbound Pack Quality — Yellow Belt', project_type:'yellow_belt',
    portfolio_id:1, stage:'Analyse', metric_id:'dpmo', baseline:610, target_value:450,
    created_at: makeDate(38), updated_at: makeDate(3),
    problem_statement:'Pack quality defects at 610 DPMO driven by incorrect void fill and tape application.',
    charter:JSON.stringify({ benefits:'DPMO -160 units, customer complaints -25%' }),
    actions: JSON.stringify([
      {text:'Process map current pack stations', done:true},
      {text:'Identify top 3 defect types via Pareto', done:true},
      {text:'Root cause — 5-Why for each defect type', done:false},
    ])
  },
  {
    id:6, title:'Returns Processing Time Reduction', project_type:'green_belt',
    portfolio_id:3, stage:'Define', metric_id:'uph', baseline:34, target_value:48,
    created_at: makeDate(9), updated_at: makeDate(9),
    problem_statement:'Returns processing averaging 34 units per hour against a 48 target. Causing customer refund SLA breaches.',
    charter:JSON.stringify({ benefits:'Processing time -30%, SLA compliance +15%' }),
    actions: JSON.stringify([
      {text:'Write project charter and agree scope', done:true},
      {text:'SIPOC completed', done:false},
    ])
  },
  {
    id:7, title:'Night Shift UPH Gap Closure', project_type:'yellow_belt',
    portfolio_id:1, stage:'Improve', metric_id:'uph', baseline:84, target_value:93,
    created_at: makeDate(72), updated_at: makeDate(16), // slightly stalled
    problem_statement:'Night shift UPH consistently 8-12% below day shift. Root cause: reduced TL floor presence and unclear pick path planning.',
    charter:JSON.stringify({ benefits:'UPH +9 on nights, equivalent to ~£40k/year' }),
    actions: JSON.stringify([
      {text:'Time study night vs day shift process', done:true},
      {text:'Root cause confirmed — TL pairing trial', done:true},
      {text:'Implement pick path optimisation tool', done:false},
      {text:'Validate improvement with 4-week data', done:false},
    ])
  },
  {
    id:8, title:'Yard Safety — Near Miss Reduction', project_type:'quick_win',
    portfolio_id:4, stage:'Closed', metric_id:'dts', baseline:91.0, target_value:97.0,
    created_at: makeDate(58), updated_at: makeDate(20),
    problem_statement:'3 near misses in yard in 6 weeks related to pedestrian/vehicle conflicts at bay 12-14.',
    charter:JSON.stringify({ sop:'Yard segregation SOP issued, signage installed' }),
    actions: JSON.stringify([
      {text:'Risk assess bays 12-14', done:true},
      {text:'Install physical pedestrian barriers', done:true},
      {text:'Brief all yard associates and drivers', done:true},
    ])
  },
]

const ideas = [
  { id:1, portfolio_id:1, title:'Chute assignment optimisation for sorters', pipeline_stage:'idea',       eval_status:'pending',  created_at:makeDate(5) },
  { id:2, portfolio_id:1, title:'Tote wash cycle — reduce downtime',          pipeline_stage:'idea',       eval_status:'pending',  created_at:makeDate(8) },
  { id:3, portfolio_id:2, title:'Stow density improvement — slot slotting',   pipeline_stage:'definition', eval_status:'approved', created_at:makeDate(14) },
  { id:4, portfolio_id:2, title:'Problem-solve high DPMO Mezzanine zone',     pipeline_stage:'validation', eval_status:'approved', created_at:makeDate(21) },
  { id:5, portfolio_id:3, title:'Returns barcode scanning — speed check',     pipeline_stage:'idea',       eval_status:'pending',  created_at:makeDate(3)  },
  { id:6, portfolio_id:4, title:'Fire exit audit — monthly cadence',          pipeline_stage:'definition', eval_status:'approved', created_at:makeDate(11) },
  { id:7, portfolio_id:1, title:'Shift handover process — reduce gap time',   pipeline_stage:'idea',       eval_status:'pending',  created_at:makeDate(6)  },
  { id:8, portfolio_id:2, title:'Receive dock replenishment route',           pipeline_stage:'validation', eval_status:'approved', created_at:makeDate(28) },
]

const activityLog = [
  ...kpiData.slice(-30).filter((_,i)=>i%4===0).map(k=>({
    date:k.date, type:'KPI Logged',
    description:`${k.metric_id.toUpperCase()} logged: ${k.value}`,
    detail:`Daily performance log`
  })),
  ...projects.map(p=>({
    date:p.updated_at, type:'Project Updated',
    description:p.title,
    detail:`Stage: ${p.stage}`
  })),
  ...ideas.slice(0,5).map(i=>({
    date:i.created_at, type:'Idea Raised',
    description:i.title,
    detail:`Pipeline: ${i.pipeline_stage}`
  })),
  { date:makeDate(1), type:'Observation', description:'Motion waste — pickers walking to label printer', detail:'Zone C, ~8 units/hr impact estimated' },
  { date:makeDate(2), type:'Observation', description:'Waiting waste — associates idle at bay 7 during shift start', detail:'15-min daily loss, 3 associates' },
  { date:makeDate(4), type:'Observation', description:'Overprocessing — double-checking already scanned totes', detail:'Inbound area, SOP gap identified' },
  { date:makeDate(5), type:'KPI Logged',  description:'UPH logged: 96', detail:'Strong performance — site record' },
  { date:makeDate(7), type:'Project Updated', description:'Pick Rate Improvement — entered Improve stage', detail:'Pilot results: +8 UPH in Zone A' },
].sort((a,b)=>b.date.localeCompare(a.date))

const summaries = {
  1: { ideaCount:3, definitionCount:0, validationCount:0, assignedCount:3, finishedCount:2 },
  2: { ideaCount:1, definitionCount:1, validationCount:2, assignedCount:2, finishedCount:1 },
  3: { ideaCount:1, definitionCount:0, validationCount:0, assignedCount:1, finishedCount:0 },
  4: { ideaCount:0, definitionCount:1, validationCount:0, assignedCount:0, finishedCount:1 },
}

const maturity = {
  five_s: 3, dmaic: 4, standard_work: 3, visual_mgmt: 4, problem_solving: 3
}

const data = {
  siteName:        'BHX4 — Amazon FC',
  userName:        'Ryan',
  kpiTargets:      { UPH:98, Accuracy:99.5, DPMO:500, DTS:97.5 },
  latestKpis: {
    uph:      kpiData.filter(d=>d.metric_id==='uph').slice(-1)[0],
    accuracy: kpiData.filter(d=>d.metric_id==='accuracy').slice(-1)[0],
    dpmo:     kpiData.filter(d=>d.metric_id==='dpmo').slice(-1)[0],
    dts:      kpiData.filter(d=>d.metric_id==='dts').slice(-1)[0],
  },
  kpiData,
  projects,
  portfolios,
  ideas,
  summaries,
  activityLog,
  maturity,
  activeProjects:  projects.filter(p=>p.stage!=='Closed').length,
  closedProjects:  projects.filter(p=>p.stage==='Closed').length,
  totalIdeas:      ideas.length,
  actionsComplete: projects.reduce((s,p)=>{ try{return s+JSON.parse(p.actions).filter(a=>a.done).length}catch{return s} },0),
  sopCount:        projects.filter(p=>{ try{return JSON.parse(p.charter).sop}catch{return false} }).length,
}

// ── Generate and open ─────────────────────────────────────────────────────────
console.log('◈ Generating Continuum Excel report...')
const wb = await generateExcelWorkbook(data)
const outPath = join(__dir, '..', 'continuum-report.xlsx')
await wb.xlsx.writeFile(outPath)
console.log(`✓ Saved to: ${outPath}`)
console.log('◈ Opening...')
try { execSync(`open "${outPath}"`) } catch {}
console.log('Done.')
