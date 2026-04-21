// seed-demo.js — Creates demo.db with rich realistic data for BHX4 Amazon FC demo
// Uses ESM (project type: module)
import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = join(__dirname, 'demo.db')

// Remove existing demo.db so we start fresh
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ─── Schema ─────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS kpi_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_id TEXT NOT NULL,
    metric_label TEXT NOT NULL,
    value REAL NOT NULL,
    target REAL,
    date TEXT NOT NULL,
    shift TEXT,
    signal INTEGER DEFAULT 0,
    annotation TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    area TEXT NOT NULL,
    waste_type TEXT NOT NULL,
    severity INTEGER DEFAULT 1,
    text TEXT NOT NULL,
    date TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    stage TEXT DEFAULT 'Identify',
    metric_id TEXT,
    baseline REAL,
    target_value REAL,
    problem_statement TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    charter TEXT DEFAULT '{}',
    actions TEXT DEFAULT '[]',
    maps TEXT DEFAULT '[]',
    stage_checklist TEXT DEFAULT '{}',
    portfolio_id INTEGER,
    idea_id INTEGER,
    project_type TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS flow_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    steps TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS site_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_name TEXT DEFAULT 'Amazon FC',
    gm_name TEXT DEFAULT '',
    zones TEXT DEFAULT '["Inbound","Stow","Pick","Pack","Dispatch","Yard","Admin"]',
    primary_kpis TEXT DEFAULT '["uph","accuracy","dpmo","dts"]',
    user_name TEXT DEFAULT 'Ryan',
    unit_value REAL DEFAULT 0,
    shift_pattern TEXT DEFAULT 'Day',
    kpi_targets TEXT DEFAULT '{"UPH":100,"Accuracy":99.5,"DPMO":500,"DTS":98}'
  );

  CREATE TABLE IF NOT EXISTS tier2_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    notes TEXT DEFAULT '',
    actions TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS maturity_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL UNIQUE,
    five_s INTEGER DEFAULT 1,
    dmaic INTEGER DEFAULT 1,
    standard_work INTEGER DEFAULT 1,
    visual_mgmt INTEGER DEFAULT 1,
    problem_solving INTEGER DEFAULT 1,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS briefs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'morning',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS portfolios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    strategic_objective TEXT DEFAULT '',
    primary_kpi TEXT DEFAULT 'uph',
    impact_goal REAL DEFAULT 0,
    impact_unit TEXT DEFAULT 'UPH improvement',
    area_focus TEXT DEFAULT 'All',
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    portfolio_id INTEGER REFERENCES portfolios(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    area TEXT DEFAULT '',
    waste_type TEXT DEFAULT '',
    source TEXT DEFAULT 'manual',
    pipeline_stage TEXT DEFAULT 'idea',
    eval_status TEXT DEFAULT 'pending',
    impact TEXT DEFAULT 'medium',
    difficulty TEXT DEFAULT 'standard',
    metric_id TEXT DEFAULT '',
    baseline REAL,
    target_value REAL,
    estimated_weeks INTEGER DEFAULT 4,
    project_id INTEGER REFERENCES projects(id),
    kpi_achieved REAL,
    date_finished TEXT,
    notes TEXT DEFAULT '',
    project_type TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS standalone_maps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    area TEXT DEFAULT '',
    map_type TEXT DEFAULT 'current',
    description TEXT DEFAULT '',
    data TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`)

// ─── Helpers ─────────────────────────────────────────────────────────────────

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()
const rand = (min, max) => Math.random() * (max - min) + min
const randInt = (min, max) => Math.floor(rand(min, max + 1))
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const round2 = (v) => Math.round(v * 100) / 100

// Base timestamp for processStep IDs
const BASE_TS = 1700000000000

// ─── site_profile ─────────────────────────────────────────────────────────────

db.prepare(`
  INSERT INTO site_profile (site_name, gm_name, zones, primary_kpis, user_name, shift_pattern, kpi_targets)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(
  'BHX4 — Amazon FC',
  'Sarah Mitchell',
  JSON.stringify(['Inbound', 'Pick', 'Pack', 'Outbound', 'Sortation', 'Returns']),
  JSON.stringify(['UPH', 'Accuracy', 'DPMO', 'DTS']),
  'Ryan',
  '24-7',
  JSON.stringify({ UPH: 100, Accuracy: 99.5, DPMO: 500, DTS: 98 })
)

// ─── portfolios ───────────────────────────────────────────────────────────────

db.prepare(`
  INSERT INTO portfolios (id, name, strategic_objective, primary_kpi, impact_goal, impact_unit, area_focus, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(1, 'Inbound Efficiency', 'Driving UPH improvements across receive and stow operations', 'UPH', 8, 'UPH improvement', 'Inbound', 'active', daysAgo(90), daysAgo(2))

db.prepare(`
  INSERT INTO portfolios (id, name, strategic_objective, primary_kpi, impact_goal, impact_unit, area_focus, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(2, 'Quality & Accuracy', 'Reducing DPMO and defect rates across all process paths', 'DPMO', 300, 'DPMO reduction', 'All', 'active', daysAgo(75), daysAgo(1))

db.prepare(`
  INSERT INTO portfolios (id, name, strategic_objective, primary_kpi, impact_goal, impact_unit, area_focus, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(3, 'Dock-to-Stock', 'Improving DTS cycle time from trailer arrival to bin location', 'DTS', 3, '% DTS improvement', 'Inbound', 'active', daysAgo(60), daysAgo(3))

// ─── projects ─────────────────────────────────────────────────────────────────

const projectInsert = db.prepare(`
  INSERT INTO projects (id, title, stage, metric_id, baseline, target_value, problem_statement, notes, charter, actions, stage_checklist, portfolio_id, project_type, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

// ── Project 1: Stow Rate Optimisation ────────────────────────────────────────

const p1Charter = {
  teamMembers: 'Ryan (CI Lead), Sarah (Inbound Ops Manager), James (AM Stow)',
  problemStatement: 'Stow UPH averaging 88 against target of 100. Associates spending excessive time navigating to bin locations due to suboptimal zone mapping and legacy WMS configuration.',
  goalStatement: 'Increase stow UPH from 88 to 100 by June 2026 through WMS zone optimisation and associate routing improvements.',
  businessCase: '12% gap in stow UPH equates to 2 additional FTEs required per shift to maintain throughput. Closing this gap delivers approx. £8,400 per shift in labour cost avoidance per quarter.',
  scopeIn: 'All stow associates, receive bay rows 1–6.',
  scopeOut: 'Sortation and outbound operations.',
  beforePhoto: null,
  beforePhotoNote: 'Receive bay showing disorganised tote placement, no clear demarcation lines, associates searching for correct positions',
  beforePhotoDate: '2026-01-15',
  afterPhoto: null,
  afterPhotoNote: 'Receive bay after zone optimisation — shadow boards installed, floor marking complete, tote positions clearly labelled',
  afterPhotoDate: '2026-03-01',
  dataCollectionPlan: [
    { id: 1700000001, what: 'Stow UPH by zone', how: 'WMS report — daily extract', frequency: 'Daily', owner: 'Ryan (CI)', target: '>95 UPH' },
    { id: 1700000002, what: 'Travel distance per stow cycle', how: 'Time and motion study', frequency: 'Weekly sample', owner: 'Sarah (Ops)', target: '<15 metres' },
    { id: 1700000003, what: 'Scan confirmation rate', how: 'WMS scan compliance report', frequency: 'Daily', owner: 'Ryan (CI)', target: '>99%' }
  ],
  verify: {
    beforeVal: 88,
    afterVal: 96,
    improvement: 9.1,
    targetMet: true,
    evidence: '4-week monitoring period post-implementation. UPH consistently 94-98 across all shifts. WMS zone efficiency report confirms 40% reduction in travel distance per cycle.',
    method: 'Control chart',
    verifiedBy: 'Sarah (Ops Manager)',
    verifiedDate: '2026-03-20'
  },
  sipoc: {
    suppliers: ['Inbound receive dock', 'WMS system'],
    inputs: ['Sorted totes', 'Scan guns', 'Bin maps'],
    process: ['Receive tote', 'Locate bin', 'Stow item', 'Confirm scan'],
    outputs: ['Stowed inventory', 'Scan confirmation'],
    customers: ['Pick associates', 'Inventory system']
  },
  processDescription: 'Associate collects sorted tote from conveyor, navigates to bin location using handheld scanner, stows item and confirms scan, then returns to conveyor for the next tote. Current WMS uses legacy random-bin assignment causing excessive travel distances.',
  processSteps: [
    { id: BASE_TS + 0, text: 'Receive sorted tote from conveyor', time: '30s', waste: 'Waiting' },
    { id: BASE_TS + 1, text: 'Navigate to bin location using handheld', time: '2min', waste: 'Motion' },
    { id: BASE_TS + 2, text: 'Stow item and scan confirmation', time: '45s', waste: 'none' },
    { id: BASE_TS + 3, text: 'Return to conveyor for next tote', time: '90s', waste: 'Motion' }
  ],
  tobeDescription: 'Zone-optimised routing reduces associate travel from 40+ metres to under 15 metres per stow cycle. WMS zone module activated, totes pre-batched by zone, scan firmware updated for instant confirmation.',
  tobeSteps: [
    { id: BASE_TS + 10, text: 'Receive tote with pre-highlighted bin location', time: '30s', note: 'Zone mapping reduces navigation time' },
    { id: BASE_TS + 11, text: 'Navigate to nearest bin — zone-optimised route', time: '45s', note: '45s saved per cycle vs current state' },
    { id: BASE_TS + 12, text: 'Stow item and auto-confirm scan', time: '40s', note: 'New scan firmware eliminates lag' },
    { id: BASE_TS + 13, text: 'Zone-based return path', time: '30s', note: 'Removes 60s dead travel' }
  ],
  clues: [
    { id: BASE_TS + 20, title: 'High motion waste observed in rows 3–6', description: 'Associates covering 40+ metres per tote cycle, measured over 3-day observation study.', type: 'Frequency' },
    { id: BASE_TS + 21, title: 'Bin map not updated since Q3', description: 'Associates reporting wrong bin locations on 15% of stows due to stale map data.', type: 'Measurement' },
    { id: BASE_TS + 22, title: 'No zone batching in current WMS config', description: 'WMS assigns bins randomly across all 6 rows, ignoring zone proximity logic.', type: 'Process' }
  ],
  fishbone: {
    Man: ['Associates not trained on zone mapping', 'High turnover causing knowledge gaps'],
    Machine: ['WMS zone optimisation module inactive', 'Handheld devices showing outdated bin maps'],
    Method: ['No standard route defined for stow associates', 'Legacy random bin assignment algorithm'],
    Material: ['Bin labels degraded in rows 3-6', 'Tote routing inconsistent from sorter'],
    Measurement: ['UPH tracked daily but not by zone', 'No cycle time measurement per stow'],
    Environment: ['Row 3-6 lighting below standard', 'Aisle width inconsistent causing navigation delay']
  },
  fiveWhys: [
    'Stow UPH is below target at 88 vs 100.',
    'Associates travel excessive distances per stow cycle — averaging 40+ metres.',
    'Bin assignments are not zone-optimised — WMS assigns bins randomly across all rows.',
    'WMS is configured with legacy random-bin algorithm from site go-live.',
    'Zone optimisation module was never activated at site go-live — defaulted to legacy config.'
  ],
  rootCauseSummary: 'Root cause: WMS zone optimisation module inactive since site go-live, causing random bin assignment that forces associates to travel 40+ metres per tow cycle instead of under 15 metres.',
  solutions: [
    { id: BASE_TS + 30, text: 'Activate WMS zone optimisation module for rows 1–6', selected: true },
    { id: BASE_TS + 31, text: 'Implement zone-based tote batching — 3 totes per zone per trip', selected: true },
    { id: BASE_TS + 32, text: 'Update bin maps and retrain stow associates on new routing', selected: true }
  ],
  solutionsImplementedDate: '2026-03-10',
  beforeAfter: {
    beforeVal: 88,
    afterVal: 96,
    beforeDesc: 'Associates averaging 2.5 minutes per stow cycle with excessive travel distances due to random bin assignment.',
    afterDesc: 'Stow cycle time reduced to 1.4 minutes with zone optimisation active. UPH climbing to 96 — target 100 on full roll-out.',
    evidence: '2-week pilot in rows 1–3 complete. UPH data validated by AM. Rolling out to rows 4–6.'
  },
  monitoringPlan: [
    { id: BASE_TS + 40, metric: 'UPH', frequency: 'Daily', trigger: 'Below 90 for 2 consecutive days', responder: 'AM', action: 'Escalate to CI lead and check WMS zone config' }
  ],
  handoff: {
    results: '',
    dosDonts: '',
    customerImpact: '',
    hardSavings: '',
    softSavings: '',
    lessonsLearned: '',
    nextTarget: '',
    ownerMonitoring: '',
    ownerDocs: '',
    teamTrained: false,
    sopUpdated: false
  },
  sop: '',
  trainingNote: '',
  summary: ''
}

const p1Actions = [
  { text: 'Activate WMS zone optimisation module', owner: 'Ryan', start_date: '2026-01-15', due: '2026-01-22', status: 'Complete', done: true },
  { text: 'Brief all stow associates on new routing', owner: 'Sarah', start_date: '2026-01-23', due: '2026-02-01', status: 'Complete', done: true },
  { text: 'Run 2-week pilot in rows 1–3', owner: 'Ryan', start_date: '2026-02-03', due: '2026-02-17', status: 'Complete', done: true },
  { text: 'Validate UPH improvement and extend to rows 4–6', owner: 'Ryan', start_date: '2026-02-18', due: '2026-03-10', status: 'In Progress', done: false },
  { text: 'Update stow SOP and training materials', owner: 'Sarah', start_date: '2026-03-01', due: '2026-03-20', status: 'Not Started', done: false }
]

const p1Checklist = {
  currentTool: 'after_photo',
  charter: true,
  sipoc: true,
  process: true,
  before_photo: true,
  data_collection_plan: true,
  baseline: true,
  clues: true,
  fishbone: true,
  rootcause: true,
  verify: true,
  solutions: true,
  tobemap: true,
  after_photo: false,
  monitor: false,
  handoff: false,
  summary: false
}

projectInsert.run(
  1, 'Stow Rate Optimisation', 'Improve', 'uph', 88, 100,
  'Stow UPH averaging 88 against a target of 100. Associates spending excessive time navigating to bin locations due to suboptimal zone mapping and inactive WMS zone optimisation module.',
  'WMS zone optimisation activated. Pilot in rows 1–3 showing UPH at 96. Scaling to rows 4–6.',
  JSON.stringify(p1Charter),
  JSON.stringify(p1Actions),
  JSON.stringify(p1Checklist),
  1, 'green_belt', daysAgo(80), daysAgo(2)
)

// ── Project 2: Inbound Scan Miss Reduction ─────────────────────────────────

const p2Charter = {
  teamMembers: 'Ryan (CI Lead), Marcus Webb (L5 Ops), IT Systems Team',
  problemStatement: 'Scan miss rate on inbound receive causing downstream inventory inaccuracies. Associates skipping mandatory double-scan step during peak periods.',
  goalStatement: 'Improve inbound scan accuracy from 99.1% to 99.5% by enforcing double-scan step in WMS and adding real-time compliance monitoring.',
  businessCase: 'Each scan miss creates a downstream inventory discrepancy that averages 22 minutes to resolve. At ~40 misses per day, this equates to 14+ hours of rework weekly.',
  scopeIn: 'All inbound receive scan processes across dock doors 1–12.',
  scopeOut: 'Outbound sort scanning and returns processing.',
  beforePhoto: null,
  beforePhotoNote: 'Inbound dock showing manual paper scan log at dock door 4 — no system enforcement visible, associates bypassing second scan during peak',
  beforePhotoDate: '2026-01-12',
  afterPhoto: null,
  afterPhotoNote: 'Dock door screen showing WMS double-scan enforcement live — green confirmation before item advances, supervisor dashboard active on wall screen',
  afterPhotoDate: '2026-02-15',
  sipoc: {
    suppliers: ['Carrier trailers', 'Transport planning system'],
    inputs: ['Inbound parcels', 'Scan guns', 'WMS receive screen'],
    process: ['Unload parcel', 'First scan', 'Double-scan confirm', 'Place on conveyor'],
    outputs: ['Confirmed scanned inventory', 'WMS receive record'],
    customers: ['Stow associates', 'Inventory management team']
  },
  processDescription: 'Receive associates unload parcels from trailers and scan each item twice to confirm receipt. During peak periods associates were bypassing the second scan to maintain throughput pace.',
  processSteps: [
    { id: BASE_TS + 100, text: 'Unload parcel from trailer', time: '15s', waste: 'none' },
    { id: BASE_TS + 101, text: 'First scan on handheld — item received', time: '5s', waste: 'none' },
    { id: BASE_TS + 102, text: 'Double-scan confirm (previously skipped)', time: '5s', waste: 'none' },
    { id: BASE_TS + 103, text: 'Place confirmed item on receive conveyor', time: '10s', waste: 'none' }
  ],
  tobeDescription: 'WMS now enforces double-scan with a mandatory confirmation step — associates cannot progress to next item without completing both scans. Handheld alert sounds on scan miss. Supervisor dashboard shows real-time scan compliance by associate.',
  tobeSteps: [
    { id: BASE_TS + 110, text: 'Unload parcel from trailer', time: '15s', note: 'Unchanged' },
    { id: BASE_TS + 111, text: 'First scan — WMS prompts second scan automatically', time: '5s', note: 'WMS enforced — cannot skip' },
    { id: BASE_TS + 112, text: 'Second scan confirmed — item accepted', time: '5s', note: 'Handheld confirms with green flash' },
    { id: BASE_TS + 113, text: 'Place on conveyor — WMS advances to next item', time: '10s', note: 'No change' }
  ],
  clues: [
    { id: BASE_TS + 120, title: 'Scan miss spike during peak periods', description: 'Scan miss rate rises from 0.2% to 1.4% during 09:00–11:00 and 14:00–16:00 peak windows.', type: 'Frequency' },
    { id: BASE_TS + 121, title: 'No system enforcement of double-scan', description: 'WMS allows associates to proceed to next item after single scan — no mandatory confirmation prompt.', type: 'Process' },
    { id: BASE_TS + 122, title: 'Supervisor awareness gap', description: 'Team leaders have no real-time visibility of scan compliance — issues only detected at daily audit.', type: 'Measurement' }
  ],
  fiveWhys: [
    'Inbound scan miss rate is above target at 0.9% vs 0.5% target.',
    'Associates are skipping the mandatory double-scan step during peak periods.',
    'There is no system enforcement of the double-scan — WMS allows progression after single scan.',
    'WMS receive config was not updated when double-scan policy was introduced 8 months ago.',
    'IT change request for WMS receive config was deprioritised and never completed.'
  ],
  rootCauseSummary: 'Root cause: WMS receive process does not enforce the mandatory double-scan step, allowing associates to bypass it under peak pressure. No real-time supervisor visibility means issues compound before detection.',
  solutions: [
    { id: BASE_TS + 130, text: 'Configure WMS to enforce mandatory double-scan — block progression without second scan', selected: true },
    { id: BASE_TS + 131, text: 'Add scan miss alert to associate handheld — audio and visual cue on missed scan', selected: true },
    { id: BASE_TS + 132, text: 'Deploy supervisor dashboard showing real-time scan compliance by associate and hour', selected: true }
  ],
  solutionsImplementedDate: '2026-02-14',
  beforeAfter: {
    beforeVal: 99.1,
    afterVal: 99.48,
    beforeDesc: 'Scan miss rate at 0.9% during peak periods. Downstream inventory discrepancies averaging 40 per day.',
    afterDesc: 'Scan miss rate reduced to 0.3% overall. WMS enforcement and dashboard monitoring now live.',
    evidence: '30-day control period complete. Accuracy holding above 99.4%. Handoff to ops team complete.'
  },
  monitoringPlan: [
    { id: BASE_TS + 140, metric: 'Scan Accuracy', frequency: 'Daily', trigger: 'Below 99.3% on any shift', responder: 'Marcus Webb', action: 'Review WMS compliance report and brief receive team leads' }
  ],
  handoff: {
    results: 'Scan accuracy improved from 99.1% to 99.48%. WMS enforcement live and embedded. Dashboard in daily use by receive supervisors.',
    dosDonts: 'DO: Review daily compliance dashboard. DO: Escalate immediately if accuracy drops below 99.3%. DON\'T: Disable double-scan enforcement under any circumstances.',
    customerImpact: 'Pick associates and inventory management team now receive accurate stock counts. Downstream discrepancies reduced by ~78%.',
    hardSavings: '£6,200 per month reduction in rework hours.',
    softSavings: 'Improved associate confidence in inventory accuracy. Reduced inventory audit frequency.',
    lessonsLearned: 'System enforcement is more reliable than SOP-only compliance. Real-time dashboards enable faster intervention.',
    nextTarget: 'Extend double-scan enforcement to returns receive process.',
    ownerMonitoring: 'Marcus Webb',
    ownerDocs: 'Ryan',
    teamTrained: true,
    sopUpdated: true
  },
  sop: 'Inbound Receive Scan SOP v2.1 — mandatory double-scan enforced via WMS. All receives must show green confirmation before advancing. Supervisor dashboard reviewed at every Tier 2.',
  trainingNote: 'All 18 receive associates trained on new WMS flow. Team leads trained on dashboard. Training sign-off complete.',
  summary: 'The Inbound Scan Miss Reduction project successfully reduced scan miss rate from 0.9% to 0.3% by enforcing mandatory double-scan in WMS and adding real-time compliance monitoring. Hard savings of £6,200/month identified. Project handed over to ops in February 2026.'
}

const p2Actions = [
  { text: 'Submit WMS double-scan enforcement change request', owner: 'Ryan', start_date: '2026-01-10', due: '2026-01-17', status: 'Complete', done: true },
  { text: 'Configure and test WMS enforcement in UAT environment', owner: 'IT Systems', start_date: '2026-01-18', due: '2026-02-07', status: 'Complete', done: true },
  { text: 'Deploy supervisor compliance dashboard', owner: 'IT Systems', start_date: '2026-02-01', due: '2026-02-14', status: 'Complete', done: true },
  { text: 'Train all receive associates and team leads', owner: 'Marcus Webb', start_date: '2026-02-10', due: '2026-02-14', status: 'Complete', done: true },
  { text: 'Run 30-day control monitoring period', owner: 'Ryan', start_date: '2026-02-15', due: '2026-03-17', status: 'Complete', done: true },
  { text: 'Close project and formal handoff to ops', owner: 'Ryan', start_date: '2026-03-18', due: '2026-03-25', status: 'Complete', done: true }
]

const p2Checklist = {
  currentTool: 'summary',
  charter: true,
  process: true,
  before_photo: true,
  baseline: true,
  rootcause: true,
  solutions: true,
  tobemap: true,
  after_photo: true,
  handoff: true,
  summary: true
}

projectInsert.run(
  2, 'Inbound Scan Miss Reduction', 'Control', 'accuracy', 99.1, 99.5,
  'Scan miss rate on inbound receive causing downstream inventory inaccuracies. Associates skipping mandatory double-scan step during peak periods due to no system enforcement.',
  'WMS enforcement live. 30-day control period complete. Accuracy at 99.48%. Handoff to Marcus Webb.',
  JSON.stringify(p2Charter),
  JSON.stringify(p2Actions),
  JSON.stringify(p2Checklist),
  1, 'yellow_belt', daysAgo(70), daysAgo(1)
)

// ── Project 3: 5S Receive Bay Standardisation ─────────────────────────────

const p3Charter = {
  teamMembers: 'Ryan (CI Lead), Receive Bay Team Leads',
  problemStatement: 'Receive bay disorganisation causing motion waste, lost equipment, and inconsistent associate performance. 5S audit scores averaging 2.1 out of 5.',
  goalStatement: 'Achieve average 5S audit score of 4.0+ across all 6 receive bays within 4 weeks through sort, set in order, shine, standardise, and sustain activities.',
  businessCase: 'Disorganised bays cause ~15 minutes of wasted time per associate per shift searching for equipment and clearing obstructions. 12 associates across 3 shifts = 3 hours of waste daily.',
  scopeIn: 'All 6 receive bays in Inbound.',
  scopeOut: 'Stow floor, conveyor system, and dock yard.',
  beforePhoto: null,
  beforePhotoNote: 'Receive bay showing disorganised tote placement, no clear demarcation lines, associates searching for correct positions',
  beforePhotoDate: '2026-01-08',
  afterPhoto: null,
  afterPhotoNote: 'Receive bay after 5S — shadow boards installed, floor marking complete, tote positions clearly labelled',
  afterPhotoDate: '2026-01-23',
  sipoc: {
    suppliers: ['Facilities team', 'Maintenance'],
    inputs: ['Receive equipment', 'Totes', 'Scan guns', 'PPE'],
    process: ['Sort equipment', 'Set in order', 'Clean and shine', 'Standardise with shadow boards', 'Sustain via audits'],
    outputs: ['Organised bay', '5S audit scores', 'Visual standards'],
    customers: ['Receive associates', 'Area managers', 'HSE team']
  },
  processDescription: '5S audit completed across all 6 bays. Shadow boards designed and installed. Floor marking completed. Daily audit routine embedded with team leads.',
  processSteps: [
    { id: BASE_TS + 200, text: 'Search for scan gun at shift start', time: '6min', waste: 'Motion' },
    { id: BASE_TS + 201, text: 'Clear obstructions from bay walkway', time: '4min', waste: 'Motion' },
    { id: BASE_TS + 202, text: 'Locate void fill and pack materials', time: '3min', waste: 'Motion' },
    { id: BASE_TS + 203, text: 'Begin receive operations', time: 'ongoing', waste: 'none' }
  ],
  tobeSteps: [
    { id: BASE_TS + 210, text: 'Collect scan gun from shadow board — marked position', time: '30s', note: 'Shadow board eliminates search time' },
    { id: BASE_TS + 211, text: 'Bay walkway clear — maintained by end-of-shift standard', time: '0min', waste: 'none', note: 'Floor marking enforces clear zones' },
    { id: BASE_TS + 212, text: 'Void fill at point of use — shadow board in bay', time: '15s', note: 'No search required' },
    { id: BASE_TS + 213, text: 'Begin receive operations immediately', time: 'ongoing', note: 'Saves ~13min per associate per shift' }
  ],
  clues: [
    { id: BASE_TS + 220, title: 'Equipment not returning to home position', description: 'Scan guns, tape guns, and tote trolleys left in random locations at shift end. Next shift cannot find equipment.', type: 'Frequency' },
    { id: BASE_TS + 221, title: 'No visual standards in bays', description: 'No shadow boards, floor markings, or designated equipment positions. Associates use different areas each day.', type: 'Process' }
  ],
  fiveWhys: [
    'Receive bay is consistently disorganised causing motion waste.',
    'Equipment is not returned to a defined home position after use.',
    'There are no defined home positions — no shadow boards or floor markings.',
    '5S has not been implemented in the receive area.',
    '5S activity has been deprioritised — no CI resource assigned to this area until now.'
  ],
  rootCauseSummary: 'Root cause: No 5S standards have been established in the receive bay. Without defined equipment positions and visual controls, disorganisation reoccurs daily.',
  solutions: [
    { id: BASE_TS + 230, text: '5S sort and set in order across all 6 bays — remove all non-essential items', selected: true },
    { id: BASE_TS + 231, text: 'Install shadow boards for all scan guns, tape guns, and PPE', selected: true },
    { id: BASE_TS + 232, text: 'Apply floor marking for equipment zones, walkways, and tote staging', selected: true },
    { id: BASE_TS + 233, text: 'Implement daily 5S audit with team leads — scored against standard', selected: true }
  ],
  solutionsImplementedDate: '2026-01-20',
  beforeAfter: {
    beforeVal: 91,
    afterVal: 95,
    beforeDesc: '5S audit scores averaging 2.1. Associates losing 13 minutes per shift on average to disorganisation waste.',
    afterDesc: '5S audit scores at 4.3. UPH improved from 91 to 95 in receive area. Shadow boards in daily use. No regression in 2-week sustain period.',
    evidence: '2-week sustain period complete. Daily audit scores tracked and maintained above 4.0. No regression events recorded.'
  },
  monitoringPlan: [
    { id: BASE_TS + 240, metric: '5S Audit Score', frequency: 'Daily', trigger: 'Score below 3.5 on any bay', responder: 'Bay Team Lead', action: 'Identify root cause and correct within shift. Escalate if below 3 for 2 consecutive days.' }
  ],
  handoff: {
    results: 'UPH improved from 91 to 95. 5S audit scores improved from 2.1 to 4.3. All 6 bays standardised with shadow boards and floor marking.',
    dosDonts: 'DO: Complete daily 5S audit before end of shift. DO: Return all equipment to shadow board position. DON\'T: Store non-bay items in receive area.',
    customerImpact: 'Receive associates start each shift with organised equipment. Pick associates downstream receive faster, more accurate tote deliveries.',
    hardSavings: '~3 hours of wasted time eliminated per day across 3 shifts. Equivalent to 0.4 FTE per shift.',
    softSavings: 'Improved associate satisfaction. HSE audit score improved. Area now used as a CI showcase.',
    lessonsLearned: 'Quick wins can deliver significant results. Shadow board design should involve associates — they know what goes where.',
    nextTarget: 'Extend 5S programme to stow floor aisles.',
    ownerMonitoring: 'Bay Team Leads',
    ownerDocs: 'Ryan',
    teamTrained: true,
    sopUpdated: true
  },
  sop: '5S Receive Bay Standard v1.0 — daily audit required before shift end. Shadow boards must be full at all times. Floor zones must be clear. Team lead signs off audit sheet.',
  trainingNote: 'All team leads and receive associates completed 5S awareness training. Audit process embedded in shift handover.',
  summary: 'The 5S Receive Bay Standardisation quick win project delivered UPH improvement from 91 to 95 and audit scores from 2.1 to 4.3 within 4 weeks. Shadow boards, floor marking, and daily audit routine all embedded and sustaining.'
}

const p3Actions = [
  { text: 'Complete 5S sort and set in order across all 6 bays', owner: 'Ryan', start_date: '2026-01-08', due: '2026-01-12', status: 'Complete', done: true },
  { text: 'Install shadow boards and floor marking', owner: 'Ryan', start_date: '2026-01-13', due: '2026-01-19', status: 'Complete', done: true },
  { text: 'Train team leads on 5S audit process', owner: 'Ryan', start_date: '2026-01-20', due: '2026-01-22', status: 'Complete', done: true },
  { text: 'Run 2-week sustain phase and confirm audit scores', owner: 'Bay Team Leads', start_date: '2026-01-23', due: '2026-02-05', status: 'Complete', done: true }
]

const p3Checklist = {
  currentTool: 'summary',
  charter: true,
  process: true,
  before_photo: true,
  rootcause: true,
  solutions: true,
  after_photo: true,
  summary: true
}

projectInsert.run(
  3, '5S Receive Bay Standardisation', 'Closed', 'uph', 91, 95,
  'Receive bay disorganisation causing motion waste and inconsistent associate performance. Average 5S audit score 2.1 out of 5.',
  'Complete. 5S audit scores 2.1 → 4.3. Shadow boards installed, floor marking done. 2-week sustain period passed.',
  JSON.stringify(p3Charter),
  JSON.stringify(p3Actions),
  JSON.stringify(p3Checklist),
  1, 'quick_win', daysAgo(75), daysAgo(38)
)

// ── Project 4: DPMO Root Cause Investigation ───────────────────────────────

const p4Charter = {
  teamMembers: 'Ryan (CI Lead, Black Belt), Laura Hughes (L5 Ops), Quality Team, Engineering',
  problemStatement: 'Site DPMO exceeds target at 720 vs target of 500. Pareto analysis shows pick errors (38%) and mislabelled items (27%) are the top two contributors. Detailed root cause analysis in progress.',
  goalStatement: 'Reduce site DPMO from 720 to 500 or below by identifying and eliminating root causes across pick, pack, and label processes.',
  businessCase: 'DPMO at 720 vs 500 target represents ~440 additional defects per million opportunities per day. At current volumes this generates approximately £11,000 per month in cost of poor quality.',
  scopeIn: 'Pick, pack, and label processes site-wide.',
  scopeOut: 'Returns processing and DTS metrics.',
  escalatedFrom: 11,
  escalatedFromTitle: 'DPMO Source Investigation',
  beforePhoto: null,
  beforePhotoNote: 'Pack station audit showing inconsistent void fill application and no visual standard — multiple defect types contributing to DPMO at 720',
  beforePhotoDate: '2026-02-10',
  screener: {
    customerImpact: 4,
    operationalImpact: 5,
    strategicAlignment: 4,
    urgency: 3,
    dataAvailable: true,
    notes: 'Strong operational impact — DPMO directly affects customer satisfaction and carrier credits. Data readily available from WMS and quality team.',
    score: 16
  },
  voc: [
    { id: 1700000010, stakeholder: 'GM — Sarah Mitchell', need: 'DPMO needs to hit sub-500 to meet Q2 network quality commitment', quote: 'We can\'t keep explaining away the shortfall — we need a permanent fix', priority: 'High' },
    { id: 1700000011, stakeholder: 'Ops Manager — Laura Hughes', need: 'Associates need clearer pack standards — too much variation between shifts', quote: 'Three shifts, three different approaches to void fill — that gap shouldn\'t exist', priority: 'High' },
    { id: 1700000012, stakeholder: 'Quality Manager — James Okafor', need: 'Need consistent DPMO regardless of shift or associate experience level', quote: 'New starters have 3x the error rate of experienced packs — training isn\'t landing', priority: 'Medium' }
  ],
  dataCollectionPlan: [
    { id: 1700000020, what: 'DPMO by defect category', how: 'WMS quality report — daily extract', frequency: 'Daily', owner: 'Ryan (CI)', target: '<500 DPMO' },
    { id: 1700000021, what: 'Pick error rate by zone', how: 'WMS pick accuracy report', frequency: 'Daily', owner: 'Laura (Ops)', target: '<0.3% per zone' },
    { id: 1700000022, what: 'Label placement compliance', how: 'Pack station audit — random sample', frequency: 'Weekly 50 units', owner: 'Ryan (CI)', target: '>99% compliant' }
  ],
  sipoc: {
    suppliers: ['WMS pick assignment', 'Pack material stores', 'Label printer system'],
    inputs: ['Pick assignments', 'Product in bin', 'Packaging materials', 'Labels'],
    process: ['Receive pick assignment', 'Pick item from bin', 'Pack item', 'Apply label', 'Sort to dispatch'],
    outputs: ['Packed parcels', 'Labelled items', 'Dispatched orders'],
    customers: ['Customers', 'Carrier partners', 'Returns team']
  },
  processDescription: 'Associates receive pick assignments via WMS, pick items from bin locations, pack items at pack stations, apply shipping labels, and place on sort conveyor. Multiple error types are being investigated.',
  processSteps: [
    { id: BASE_TS + 300, text: 'Receive pick assignment on handheld', time: '5s', waste: 'none' },
    { id: BASE_TS + 301, text: 'Navigate to bin location', time: '45s', waste: 'Motion' },
    { id: BASE_TS + 302, text: 'Scan bin and pick item', time: '10s', waste: 'none' },
    { id: BASE_TS + 303, text: 'Transport to pack station', time: '30s', waste: 'Transportation' },
    { id: BASE_TS + 304, text: 'Pack item and apply label', time: '40s', waste: 'Defects' },
    { id: BASE_TS + 305, text: 'Place on sort conveyor', time: '10s', waste: 'none' }
  ],
  tobeSteps: [],
  clues: [
    { id: BASE_TS + 320, title: 'Pick error rate spike in zone 4C', description: 'Pick error rate 3.2x higher in zone 4C than site average. Bin labels on rows 4C-112 to 4C-120 are faded and hard to distinguish from adjacent bins.', type: 'Frequency' },
    { id: BASE_TS + 321, title: 'Label placement inconsistency on non-standard items', description: 'Associates applying labels to different faces on non-standard shaped items. Carrier scanner fails to read 22% of non-standard placements.', type: 'Measurement' },
    { id: BASE_TS + 322, title: 'Pack station error spike during last 90 minutes of shift', description: 'Pack error rate increases from 1.2% to 4.8% in the final 90 minutes of each shift. Correlated with fatigue and reduced QC checking behaviour.', type: 'Frequency' }
  ],
  fishbone: {
    Man: ['No standardised void fill SOP across shifts', 'High associate turnover causing training gaps'],
    Machine: ['Label printers occasionally misaligning output', 'Handheld scanner lag causing confirmation errors'],
    Method: ['Three different void fill techniques in use across shifts', 'No mandatory QC check before conveyor placement'],
    Material: ['Bin labels degraded in zone 4C rows', 'Oversized boxes selected for small items causing damage'],
    Measurement: ['DPMO tracked site-wide not by defect category', 'No per-associate error rate visibility'],
    Environment: ['Pack station height causing fatigue-related errors in hour 4+', 'Poor lighting in zone 4C affecting bin label readability']
  },
  confirmStats: {
    hypothesis: 'We believe the primary root cause is the absence of a standardised void fill SOP enforced at pack stations, causing three different techniques across shifts and driving 45% of DPMO events.',
    testUsed: 'Correlation Analysis + Pareto',
    testResult: 'Pareto of 28-day defect data confirms void fill (45%), label placement (32%), and pack station fatigue (23%) as top contributors. Strong correlation (r=0.79) between shift-end hours and error rate.',
    pValue: 'p < 0.01',
    conclusion: 'Confirmed — void fill SOP absence is primary root cause. Label placement and fatigue are secondary.',
    nextSteps: 'Deploy standardised void fill SOP to all 48 stations. Add label placement guide. Investigate ergonomics for fatigue reduction.'
  },
  fiveWhys: [
    'Site DPMO is at 720, significantly above the 500 target.',
    'Pick errors and mislabelled items account for 65% of all defects.',
    'Associates are picking incorrect items from bins and applying labels to the wrong face.',
    '', // not yet determined
    ''  // not yet determined
  ],
  rootCauseSummary: '',
  solutions: [],
  solutionsImplementedDate: '',
  beforeAfter: {
    beforeVal: 720,
    afterVal: 0,
    beforeDesc: '',
    afterDesc: '',
    evidence: ''
  },
  monitoringPlan: [],
  handoff: {
    results: '',
    dosDonts: '',
    customerImpact: '',
    hardSavings: '',
    softSavings: '',
    lessonsLearned: '',
    nextTarget: '',
    ownerMonitoring: '',
    ownerDocs: '',
    teamTrained: false,
    sopUpdated: false
  },
  sop: '',
  trainingNote: '',
  summary: ''
}

const p4Actions = [
  { text: 'Complete Pareto analysis of all defect categories', owner: 'Ryan', start_date: '2026-02-10', due: '2026-02-20', status: 'Complete', done: true },
  { text: 'Run fishbone workshop with process owners', owner: 'Ryan', start_date: '2026-02-21', due: '2026-03-01', status: 'Complete', done: true },
  { text: 'Validate root causes with process observation data', owner: 'Ryan', start_date: '2026-03-02', due: '2026-03-15', status: 'In Progress', done: false },
  { text: 'Develop solution shortlist for Improve phase', owner: 'Ryan', start_date: '2026-03-16', due: '2026-03-30', status: 'Not Started', done: false }
]

const p4Checklist = {
  currentTool: 'rootcause',
  charter: true,
  screener: true,
  sipoc: true,
  voc: true,
  process: true,
  before_photo: true,
  data_collection_plan: true,
  baseline: true,
  clues: true,
  fishbone: true,
  rootcause: false,
  confirm_stats: false,
  verify: false,
  solutions: false,
  tobemap: false,
  after_photo: false,
  monitor: false,
  transfer: false,
  handoff: false,
  summary: false
}

projectInsert.run(
  4, 'DPMO Root Cause Investigation', 'Analyse', 'dpmo', 720, 500,
  'Site DPMO exceeds target at 720. Pareto shows pick errors (38%) and mislabelled items (27%) are top contributors. Root cause analysis in progress.',
  'Fishbone complete. 3 clues validated. Root cause validation observations ongoing. 5 Whys partially complete.',
  JSON.stringify(p4Charter),
  JSON.stringify(p4Actions),
  JSON.stringify(p4Checklist),
  2, 'black_belt', daysAgo(50), daysAgo(3)
)

// ── Project 5: Pick Path Efficiency ───────────────────────────────────────

const p5Charter = {
  teamMembers: 'Ryan (CI Lead), Pick Ops Team, WMS Systems Team',
  problemStatement: 'Pick UPH averaging 94 vs target of 102. Associates covering excessive travel distance per pick cycle. Spaghetti diagram shows significant cross-zone travel waste.',
  goalStatement: 'Increase pick UPH from 94 to 102 by optimising pick path routing and reducing associate travel distance from 1.4km/hr to under 0.9km/hr.',
  businessCase: 'Each UPH point gained in pick equates to ~£5,800 per quarter at current volumes. Closing the 8-point gap would deliver over £46,000 annually.',
  scopeIn: 'All pick zones across Pick floor levels 1 and 2.',
  scopeOut: 'Pack station operations and outbound sort.',
  beforePhoto: null,
  beforePhotoNote: 'Pick floor spaghetti diagram showing cross-zone travel patterns — associates walking 1.4km/hr with extensive cross-aisle movement visible',
  beforePhotoDate: '2026-03-05',
  sipoc: {
    suppliers: ['WMS pick assignment system', 'Replenishment team'],
    inputs: ['Pick assignments', 'Stocked bins', 'Pick carts', 'Scan guns'],
    process: ['Receive batch assignment', 'Navigate to first pick', 'Scan and pick item', 'Progress to next pick', 'Deposit completed batch'],
    outputs: ['Picked items in cart', 'Completed batch', 'WMS pick confirmation'],
    customers: ['Pack station associates', 'Sort conveyor']
  },
  processDescription: 'Associates receive pick batch assignments via WMS handheld, navigate to each bin location in the assigned sequence, scan and pick each item, then deposit completed batch at sort conveyor. Current WMS uses non-optimised routing.',
  processSteps: [
    { id: BASE_TS + 400, text: 'Receive pick batch assignment on handheld', time: '10s', waste: 'none' },
    { id: BASE_TS + 401, text: 'Navigate to first pick location', time: '60s', waste: 'Motion' },
    { id: BASE_TS + 402, text: 'Scan bin and pick item', time: '15s', waste: 'none' },
    { id: BASE_TS + 403, text: 'Travel to next pick — cross-zone routing', time: '75s', waste: 'Motion' },
    { id: BASE_TS + 404, text: 'Deposit batch and receive next assignment', time: '30s', waste: 'Waiting' }
  ],
  tobeSteps: [],
  clues: [],
  fiveWhys: ['', '', '', '', ''],
  rootCauseSummary: '',
  solutions: [],
  solutionsImplementedDate: '',
  beforeAfter: {
    beforeVal: 94,
    afterVal: 0,
    beforeDesc: '',
    afterDesc: '',
    evidence: ''
  },
  monitoringPlan: [],
  handoff: {
    results: '',
    dosDonts: '',
    customerImpact: '',
    hardSavings: '',
    softSavings: '',
    lessonsLearned: '',
    nextTarget: '',
    ownerMonitoring: '',
    ownerDocs: '',
    teamTrained: false,
    sopUpdated: false
  },
  sop: '',
  trainingNote: '',
  summary: ''
}

const p5Actions = [
  { text: 'Conduct baseline spaghetti mapping for all pick zones', owner: 'Ryan', start_date: '2026-03-01', due: '2026-03-10', status: 'Complete', done: true },
  { text: 'Collect 3 weeks of pick UPH data by zone and shift', owner: 'Ryan', start_date: '2026-03-01', due: '2026-03-21', status: 'Complete', done: true },
  { text: 'Complete MSA on pick UPH measurement system', owner: 'Ryan', start_date: '2026-03-22', due: '2026-04-05', status: 'Not Started', done: false },
  { text: 'Analyse data and identify top loss contributors', owner: 'Ryan', start_date: '2026-04-06', due: '2026-04-20', status: 'Not Started', done: false }
]

const p5Checklist = {
  currentTool: 'baseline',
  charter: true,
  process: true,
  before_photo: true,
  baseline: false,
  rootcause: false,
  solutions: false,
  tobemap: false,
  after_photo: false,
  handoff: false,
  summary: false
}

projectInsert.run(
  5, 'Pick Path Efficiency', 'Measure', 'uph', 94, 102,
  'Pick UPH averaging 94 vs target of 102. Associates covering excessive travel distance per pick — spaghetti mapping shows 1.4km/hr vs benchmark 0.9km.',
  'Baseline spaghetti mapping complete. 3-week UPH data collected. MSA and analysis next.',
  JSON.stringify(p5Charter),
  JSON.stringify(p5Actions),
  JSON.stringify(p5Checklist),
  2, 'yellow_belt', daysAgo(30), daysAgo(4)
)

// ── Project 6: Damage Rate Reduction ─────────────────────────────────────

const p6Charter = {
  teamMembers: 'Ryan (CI Lead), Pack Team Leads',
  problemStatement: 'Outbound damage rate above target. DPMO for outbound damage at 650 vs target of 450. Incorrect void fill technique identified as primary contributor.',
  goalStatement: 'Reduce outbound damage DPMO from 650 to 450 through void fill SOP deployment and associate training.',
  businessCase: 'Each damaged item costs an average of £14 to replace plus £8 in carrier credit. At current volumes this equates to ~£9,200 per month in avoidable cost.',
  scopeIn: 'Pack stations and outbound sort conveyor.',
  scopeOut: 'Inbound receive and returns.',
  beforePhoto: null,
  beforePhotoNote: 'Pack station without void fill visual standard — no laminated guide, associates using inconsistent void fill technique, fragile items unpadded',
  beforePhotoDate: '2025-12-08',
  afterPhoto: null,
  afterPhotoNote: 'Pack station after improvement — laminated void fill SOP visible at station, correct fragile item padding demonstrated, associate briefed',
  afterPhotoDate: '2025-12-16',
  sipoc: {
    suppliers: ['Pick associates', 'Pack material stores'],
    inputs: ['Picked items', 'Boxes', 'Void fill', 'Tape'],
    process: ['Select box size', 'Place item', 'Add void fill', 'Seal box', 'Label and sort'],
    outputs: ['Packed parcels ready for dispatch'],
    customers: ['Customers', 'Carrier network']
  },
  processDescription: 'Associates select box size, place picked item, add void fill to protect item, seal and label box, then place on sort conveyor. Void fill technique was inconsistent with no visual standard at station.',
  processSteps: [
    { id: BASE_TS + 500, text: 'Select box size (often oversized)', time: '10s', waste: 'Overprocessing' },
    { id: BASE_TS + 501, text: 'Place item in box', time: '5s', waste: 'none' },
    { id: BASE_TS + 502, text: 'Add void fill — technique inconsistent', time: '15s', waste: 'Defects' },
    { id: BASE_TS + 503, text: 'Seal and label box', time: '20s', waste: 'none' },
    { id: BASE_TS + 504, text: 'Place on sort conveyor', time: '5s', waste: 'none' }
  ],
  tobeSteps: [
    { id: BASE_TS + 510, text: 'Select correct box size using visual guide at station', time: '8s', note: 'Visual guide reduces oversizing by 60%' },
    { id: BASE_TS + 511, text: 'Place item in centre of box', time: '5s', note: 'Positioning guide on station surface' },
    { id: BASE_TS + 512, text: 'Add void fill using standard technique — item must not move', time: '15s', note: 'SOP laminated at station. Shake test before sealing.' },
    { id: BASE_TS + 513, text: 'Seal and label box — check for visual standard compliance', time: '20s', note: 'No change' },
    { id: BASE_TS + 514, text: 'Place on sort conveyor', time: '5s', note: 'No change' }
  ],
  clues: [
    { id: BASE_TS + 520, title: 'Void fill not used correctly on fragile items', description: '6 damage events recorded on single audit. Associates not applying void fill to all faces of fragile items.', type: 'Frequency' },
    { id: BASE_TS + 521, title: 'No visual standard at pack stations', description: 'No laminated guide, no example, no reminder. Associates defaulting to fastest method regardless of correctness.', type: 'Process' }
  ],
  fiveWhys: [
    'Outbound damage DPMO is at 650, above the 450 target.',
    'Items are being damaged due to incorrect void fill technique — insufficient padding.',
    'Associates are not using the correct void fill method for fragile items.',
    'There is no visual standard at pack stations showing the correct technique.',
    'The void fill SOP exists in the training system but was never converted to a point-of-use visual.'
  ],
  rootCauseSummary: 'Root cause: Correct void fill technique exists in training documentation but has never been made available at point of use. Associates default to fastest method with no visual reminder.',
  solutions: [
    { id: BASE_TS + 530, text: 'Create laminated void fill visual standard for all pack stations showing correct technique for fragile and standard items', selected: true },
    { id: BASE_TS + 531, text: 'Deliver 10-minute toolbox talk to all pack associates covering void fill technique and damage costs', selected: true }
  ],
  solutionsImplementedDate: '2025-12-15',
  beforeAfter: {
    beforeVal: 650,
    afterVal: 420,
    beforeDesc: 'Outbound damage DPMO at 650. Associates using inconsistent void fill technique with no visual standard.',
    afterDesc: 'Damage DPMO reduced to 420 — below the 450 target. Visual standards at all stations. Toolbox talks complete across all shifts.',
    evidence: '2-week monitoring period post-change. DPMO has sustained below 450. No regression events.'
  },
  monitoringPlan: [
    { id: BASE_TS + 540, metric: 'Damage DPMO', frequency: 'Weekly', trigger: 'Above 450 for any week', responder: 'Pack Team Lead', action: 'Re-audit void fill technique across all stations. Re-brief associates.' }
  ],
  handoff: {
    results: 'Outbound damage DPMO reduced from 650 to 420. All pack stations have laminated void fill guides. All associates trained.',
    dosDonts: 'DO: Maintain visual standard at all stations — replace if damaged. DO: Include void fill check in any new associate onboarding. DON\'T: Remove visual guides without replacing.',
    customerImpact: 'Fewer damaged items reaching customers. Carrier credit notes reduced by ~70%.',
    hardSavings: '£9,200 per month reduction in replacement and carrier credit costs.',
    softSavings: 'Improved customer satisfaction. Reduced associate time on damage processing.',
    lessonsLearned: 'Point-of-use visual standards are more effective than training-only interventions.',
    nextTarget: 'Box size selection waste — visual guide for correct box selection is next opportunity.',
    ownerMonitoring: 'Pack Team Leads',
    ownerDocs: 'Ryan',
    teamTrained: true,
    sopUpdated: true
  },
  sop: 'Void Fill Standard v1.2 — laminated guide at all 48 stations. Fragile items: fill all 4 faces and top. Standard items: fill gaps to prevent movement. Shake test before sealing.',
  trainingNote: 'All pack associates received 10-minute toolbox talk on void fill technique. All 3 shifts covered. Sign-off sheets complete.',
  summary: 'The Damage Rate Reduction quick win project reduced outbound damage DPMO from 650 to 420 in under 3 weeks. Laminated visual standards at all 48 pack stations and toolbox talks across all shifts delivered sustained results.'
}

const p6Actions = [
  { text: 'Design and print void fill visual standard for all stations', owner: 'Ryan', start_date: '2025-12-08', due: '2025-12-12', status: 'Complete', done: true },
  { text: 'Deliver toolbox talk to all pack associates across 3 shifts', owner: 'Ryan', start_date: '2025-12-13', due: '2025-12-15', status: 'Complete', done: true },
  { text: 'Monitor damage DPMO for 2 weeks post-change', owner: 'Pack Team Leads', start_date: '2025-12-16', due: '2025-12-31', status: 'Complete', done: true }
]

const p6Checklist = {
  currentTool: 'summary',
  charter: true,
  process: true,
  before_photo: true,
  rootcause: true,
  solutions: true,
  after_photo: true,
  summary: true
}

projectInsert.run(
  6, 'Damage Rate Reduction', 'Closed', 'dpmo', 650, 450,
  'Outbound damage rate 30% above target. Root cause: incorrect void fill technique with no visual standard at pack stations.',
  'Complete. DPMO reduced from 650 to 420. Void fill SOP and visual standards deployed to all 48 stations.',
  JSON.stringify(p6Charter),
  JSON.stringify(p6Actions),
  JSON.stringify(p6Checklist),
  2, 'quick_win', daysAgo(65), daysAgo(28)
)

// ── Project 7: DTS Bottleneck Elimination ─────────────────────────────────

const p7Charter = {
  teamMembers: 'Ryan (CI Lead, Green Belt), Yard Manager, Inbound Ops Team, WMS Systems',
  problemStatement: 'DTS time averaging 4.2 hours against a 3.5-hour target. VSM identified three major bottlenecks: trailer check-in delay (45 min average), labelling queue congestion, and stow bin assignment lag.',
  goalStatement: 'Improve DTS from 95.2% to 98.5% on-time performance by eliminating the three identified bottlenecks in the trailer-to-stock process.',
  businessCase: 'DTS performance below target means stock arriving in trailers takes longer to become available for picking, directly impacting pick UPH and order fulfilment speed.',
  scopeIn: 'Full DTS process from trailer arrival at gate to confirmed bin location in WMS.',
  scopeOut: 'Returns processing and dispatch operations.',
  beforePhoto: null,
  beforePhotoNote: 'Dock gate showing paper trailer check-in queue and manual assignment board — 3 trailers waiting with no dock door assigned, yard officer managing both inbound and outbound',
  beforePhotoDate: '2026-02-10',
  afterPhoto: null,
  afterPhotoNote: 'Dock gate after improvement — tablet check-in live, digital door assignment screen active, labelling zone redesigned with dedicated printer, no queue visible',
  afterPhotoDate: '2026-03-10',
  dataCollectionPlan: [
    { id: 1700000030, what: 'End-to-end DTS cycle time', how: 'WMS trailer arrival to bin confirm timestamps', frequency: 'Per trailer', owner: 'Ryan (CI)', target: '<3.5 hours' },
    { id: 1700000031, what: 'Trailer check-in time', how: 'Timed observation — yard officer', frequency: 'Daily sample', owner: 'Yard Manager', target: '<5 minutes' },
    { id: 1700000032, what: 'Labelling queue depth at peak', how: 'Manual count at 09:30 and 14:30', frequency: 'Daily', owner: 'Ryan (CI)', target: '0 trailers queuing' }
  ],
  verify: {
    beforeVal: 95.2,
    afterVal: 97.4,
    improvement: 2.3,
    targetMet: false,
    evidence: '3-week monitoring period post-implementation. DTS trending up from 95.2% to 97.4%. Check-in time reduced from 45min to 8min avg. Labelling queue eliminated. Continuing to monitor toward 98.5% target.',
    method: 'Run chart — daily DTS %',
    verifiedBy: 'Inbound AM',
    verifiedDate: '2026-04-01'
  },
  sipoc: {
    suppliers: ['Carrier partners', 'Transport planning system', 'WMS team'],
    inputs: ['Arriving trailers', 'Inbound manifests', 'Dock door availability', 'Stow bin capacity'],
    process: ['Gate check-in', 'Dock door assignment', 'Trailer unload', 'Label and sort', 'Stow to bin', 'WMS confirmation'],
    outputs: ['Stock confirmed in WMS', 'DTS time recorded', 'Trailer released'],
    customers: ['Pick associates', 'WMS inventory', 'Carrier for trailer turnaround']
  },
  processDescription: 'Trailer arrives at gate, dock officer checks in and assigns dock door. Trailer is unloaded, items labelled and sorted, then stowed to bin locations with WMS confirmation. Three major bottlenecks identified and addressed.',
  processSteps: [
    { id: BASE_TS + 600, text: 'Trailer arrives at gate — check-in with dock officer', time: '10min', waste: 'Waiting' },
    { id: BASE_TS + 601, text: 'Dock door assignment — manual decision process', time: '35min', waste: 'Waiting' },
    { id: BASE_TS + 602, text: 'Trailer unload and receive scan', time: '45min', waste: 'none' },
    { id: BASE_TS + 603, text: 'Label application and sort — queue at labelling station', time: '28min', waste: 'Waiting' },
    { id: BASE_TS + 604, text: 'Stow to bin — WMS random bin assignment', time: '42min', waste: 'Motion' },
    { id: BASE_TS + 605, text: 'WMS bin confirmation', time: '5min', waste: 'none' }
  ],
  tobeSteps: [
    { id: BASE_TS + 610, text: 'Trailer arrives at gate — digital check-in on tablet', time: '3min', note: 'Digital form eliminates paper transcription — saves 7 min' },
    { id: BASE_TS + 611, text: 'Dock door auto-assigned based on trailer schedule', time: '2min', note: 'Pre-assignment eliminates 33-minute decision queue' },
    { id: BASE_TS + 612, text: 'Trailer unload and receive scan', time: '45min', note: 'Unchanged' },
    { id: BASE_TS + 613, text: 'Label application — dedicated labelling zone, no queue', time: '15min', note: 'Queue redesign saves 13 min' },
    { id: BASE_TS + 614, text: 'Stow to bin — zone-optimised assignment', time: '25min', note: 'WMS zone module saves 17 min' },
    { id: BASE_TS + 615, text: 'WMS bin confirmation', time: '5min', note: 'Unchanged' }
  ],
  clues: [
    { id: BASE_TS + 620, title: 'Trailer check-in delay at peak', description: 'Dock officer handling both inbound and outbound admin simultaneously during peak. Average check-in takes 45 minutes when it should take 10.', type: 'Frequency' },
    { id: BASE_TS + 621, title: 'Labelling station queue forming', description: 'Labelling station has only 2 printers for entire site. Queue of 3–6 trailers forming daily at 09:00–10:30 peak.', type: 'Capacity' },
    { id: BASE_TS + 622, title: 'WMS bin assignment causing stow delays', description: 'WMS assigns bins randomly across all rows — same root cause as Stow Rate project. Associates averaging 42 minutes stow time vs 25-minute target.', type: 'Process' }
  ],
  fishbone: {
    Man: ['Dock officer managing both inbound and outbound admin', 'No dedicated labelling resource during peak'],
    Machine: ['Only 2 labelling printers for full site volume', 'WMS zone optimisation module inactive'],
    Method: ['Paper-based trailer check-in with manual transcription', 'No pre-assignment of dock doors before trailer arrival'],
    Material: ['Insufficient label stock staged at labelling zone', 'Trailer manifests arriving in paper format'],
    Measurement: ['DTS tracked as daily % — no stage-level visibility', 'No alarm when check-in queue exceeds 2 trailers'],
    Environment: ['Labelling zone undersized — queue forms into walkway', 'Dock office layout forces officer to handle both desks']
  },
  fiveWhys: [
    'DTS performance is at 95.2% — below the 98.5% target.',
    'The end-to-end DTS process is taking 4.2 hours on average against a 3.5-hour target.',
    'Three bottlenecks add ~75 minutes of delay: check-in, labelling queue, and WMS bin assignment.',
    'The check-in process is manual and paper-based, labelling is under-resourced, and WMS zone module is inactive.',
    'These three issues have existed since site go-live and were not prioritised for improvement until this project.'
  ],
  rootCauseSummary: 'Root cause: Three compounding bottlenecks — manual paper check-in (adds 35 min), under-resourced labelling station (adds 13 min), and inactive WMS zone module (adds 17 min) — are responsible for 65 of the 42-minute DTS gap.',
  solutions: [
    { id: BASE_TS + 630, text: 'Deploy digital tablet-based trailer check-in form to eliminate paper transcription delay', selected: true },
    { id: BASE_TS + 631, text: 'Add dedicated labelling printer and redesign labelling zone layout to eliminate queue', selected: true },
    { id: BASE_TS + 632, text: 'Activate WMS zone optimisation module for stow bin assignment (linked to Stow Rate project)', selected: true }
  ],
  solutionsImplementedDate: '2026-03-05',
  beforeAfter: {
    beforeVal: 95.2,
    afterVal: 97.4,
    beforeDesc: 'DTS averaging 4.2 hours against 3.5-hour target. Three bottlenecks adding 65 minutes of non-value-added time.',
    afterDesc: 'DTS now averaging 3.7 hours. Performance at 97.4% — approaching 98.5% target. All three bottleneck countermeasures implemented.',
    evidence: 'Check-in SOP live for 3 weeks. Labelling redesign deployed. WMS zone module active. DTS trending up. Results validation ongoing.'
  },
  monitoringPlan: [
    { id: BASE_TS + 640, metric: 'DTS %', frequency: 'Daily', trigger: 'Below 96% on any day', responder: 'Inbound AM', action: 'Identify which stage caused delay. Escalate to CI if below 96% for 2 consecutive days.' }
  ],
  handoff: {
    results: '',
    dosDonts: '',
    customerImpact: '',
    hardSavings: '',
    softSavings: '',
    lessonsLearned: '',
    nextTarget: '',
    ownerMonitoring: '',
    ownerDocs: '',
    teamTrained: false,
    sopUpdated: false
  },
  sop: '',
  trainingNote: '',
  summary: ''
}

const p7Actions = [
  { text: 'Update trailer check-in SOP and deploy digital tablet form', owner: 'Ryan', start_date: '2026-02-10', due: '2026-02-24', status: 'Complete', done: true },
  { text: 'Redesign labelling queue layout and add printer', owner: 'Ryan', start_date: '2026-02-17', due: '2026-03-03', status: 'Complete', done: true },
  { text: 'Submit WMS zone optimisation change request', owner: 'Ryan', start_date: '2026-02-24', due: '2026-03-05', status: 'Complete', done: true },
  { text: 'Validate DTS improvement against 98.5% target', owner: 'Ryan', start_date: '2026-03-10', due: '2026-04-10', status: 'In Progress', done: false },
  { text: 'Document and standardise all three improvements', owner: 'Ryan', start_date: '2026-04-01', due: '2026-04-20', status: 'Not Started', done: false }
]

const p7Checklist = {
  currentTool: 'verify',
  charter: true,
  sipoc: true,
  process: true,
  before_photo: true,
  data_collection_plan: true,
  baseline: true,
  clues: true,
  fishbone: true,
  rootcause: true,
  verify: false,
  solutions: true,
  tobemap: true,
  after_photo: false,
  monitor: false,
  handoff: false,
  summary: false
}

projectInsert.run(
  7, 'DTS Bottleneck Elimination', 'Improve', 'dts', 95.2, 98.5,
  'DTS time averaging 4.2 hours against a 3.5-hour target. VSM identified three bottlenecks: trailer check-in delay, labelling queue, and WMS bin assignment lag.',
  'All three countermeasures implemented. DTS at 3.7 hours, tracking to 98.5% target. Results validation in progress.',
  JSON.stringify(p7Charter),
  JSON.stringify(p7Actions),
  JSON.stringify(p7Checklist),
  3, 'green_belt', daysAgo(60), daysAgo(1)
)

// ── Project 8: Trailer Turnaround SOP ─────────────────────────────────────

const p8Charter = {
  teamMembers: 'Ryan (CI Lead), Yard Manager, Transport Planning',
  problemStatement: 'No standardised SOP exists for trailer turnaround process. Significant variation between yard associates and shifts resulting in inconsistent DTS performance and extended trailer dwell times.',
  goalStatement: 'Develop and embed a standardised trailer turnaround SOP to reduce variation and improve DTS from 96.0% to 98.5%.',
  businessCase: 'Inconsistent turnaround process adds unpredictable delay to DTS. Standardising the process is expected to reduce average turnaround time by 18 minutes and improve DTS reliability.',
  scopeIn: 'Trailer turnaround process from gate check-in to dock door assignment.',
  scopeOut: 'Unloading operations and inbound sort.',
  beforePhoto: null,
  beforePhotoNote: 'Yard gate showing manual check-in process — paper manifest, no dock pre-assignment, yard associate making ad-hoc decisions on door allocation',
  beforePhotoDate: '2026-04-10',
  sipoc: {
    suppliers: ['Carrier partners', 'Transport planning system'],
    inputs: ['Arriving trailers', 'Trailer manifests', 'Dock availability data'],
    process: ['Gate check-in', 'Trailer inspection', 'Dock door assignment', 'Trailer positioning', 'Handoff to inbound team'],
    outputs: ['Trailer at dock door', 'Handoff confirmation to inbound team'],
    customers: ['Inbound operations team', 'DTS tracking system']
  },
  processDescription: 'Trailer arrives at site gate, yard associate performs check-in and inspection, assigns dock door, positions trailer, then hands off to inbound operations. Currently no SOP — significant variation between associates and shifts.',
  processSteps: [],
  tobeSteps: [],
  clues: [],
  fiveWhys: ['', '', '', '', ''],
  rootCauseSummary: '',
  solutions: [],
  solutionsImplementedDate: '',
  beforeAfter: {
    beforeVal: 96.0,
    afterVal: 0,
    beforeDesc: '',
    afterDesc: '',
    evidence: ''
  },
  monitoringPlan: [],
  handoff: {
    results: '',
    dosDonts: '',
    customerImpact: '',
    hardSavings: '',
    softSavings: '',
    lessonsLearned: '',
    nextTarget: '',
    ownerMonitoring: '',
    ownerDocs: '',
    teamTrained: false,
    sopUpdated: false
  },
  sop: '',
  trainingNote: '',
  summary: ''
}

const p8Actions = [
  { text: 'Complete SIPOC and project charter with yard team', owner: 'Ryan', start_date: '2026-04-08', due: '2026-04-12', status: 'Complete', done: true },
  { text: 'Run stakeholder alignment workshop with yard and transport', owner: 'Ryan', start_date: '2026-04-14', due: '2026-04-18', status: 'Not Started', done: false },
  { text: 'Conduct 5-day current state observation study', owner: 'Ryan', start_date: '2026-04-21', due: '2026-04-25', status: 'Not Started', done: false }
]

const p8Checklist = {
  currentTool: 'process',
  charter: true,
  process: false,
  before_photo: false,
  baseline: false,
  rootcause: false,
  solutions: false,
  tobemap: false,
  after_photo: false,
  handoff: false,
  summary: false
}

projectInsert.run(
  8, 'Trailer Turnaround SOP', 'Define', 'dts', 96.0, 98.5,
  'No standardised SOP for trailer turnaround process. Significant variation between yard associates causing inconsistent DTS performance.',
  'Charter and SIPOC complete. Stakeholder alignment workshop with yard and transport teams next.',
  JSON.stringify(p8Charter),
  JSON.stringify(p8Actions),
  JSON.stringify(p8Checklist),
  3, 'yellow_belt', daysAgo(10), daysAgo(20)
)

// ── Project 9: Stow Location Accuracy ─────────────────────────────────────

const p9Charter = {
  teamMembers: 'Ryan (CI Lead), Stow Team Leads, IT',
  problemStatement: 'Stow location errors creating pick failures and customer impact. Associates occasionally stowing to incorrect bin due to degraded bin labels — current accuracy at 99.0% vs 99.5% target.',
  goalStatement: 'Improve stow location accuracy from 99.0% to 99.5% by reprinting degraded bin labels and adding QR code scan validation.',
  businessCase: 'Each stow error creates a pick failure that averages 18 minutes to resolve. At current error rates this equates to ~6 hours of wasted pick recovery time per day.',
  scopeIn: 'Stow process across all bin zones in Inbound.',
  scopeOut: 'Pick operations and WMS system changes.',
  beforePhoto: null,
  beforePhotoNote: 'Stow aisle showing degraded bin labels — multiple labels faded or partially missing, QR codes not visible, associate using scanner to manually verify bin ID',
  beforePhotoDate: '2026-02-15',
  afterPhoto: null,
  afterPhotoNote: 'Stow aisle after label refresh — all 340 labels replaced with clear QR codes, aisle 7 shown with new high-durability labels, associate scanning cleanly',
  afterPhotoDate: '2026-03-05',
  sipoc: {
    suppliers: ['Inbound receive process', 'WMS'],
    inputs: ['Sorted totes', 'Bin label system', 'Scan guns'],
    process: ['Receive tote', 'Navigate to bin', 'Read bin label', 'Scan and stow', 'Confirm scan'],
    outputs: ['Correctly stowed inventory', 'WMS location update'],
    customers: ['Pick associates', 'Inventory system']
  },
  processDescription: 'Associates navigate to bin location, read the bin label, scan to confirm, and stow item. Degraded labels causing associates to misread bin IDs and stow to adjacent incorrect bins.',
  processSteps: [
    { id: BASE_TS + 800, text: 'Navigate to bin location using handheld', time: '90s', waste: 'Motion' },
    { id: BASE_TS + 801, text: 'Read bin label — label faded on ~15% of bins', time: '5s', waste: 'Defects' },
    { id: BASE_TS + 802, text: 'Scan bin and stow item', time: '20s', waste: 'none' },
    { id: BASE_TS + 803, text: 'Confirm stow on scanner', time: '5s', waste: 'none' }
  ],
  tobeSteps: [
    { id: BASE_TS + 810, text: 'Navigate to bin location using handheld', time: '90s', note: 'Unchanged' },
    { id: BASE_TS + 811, text: 'Scan QR code on bin label — instant validation', time: '3s', note: 'QR scan eliminates label misread risk' },
    { id: BASE_TS + 812, text: 'Stow item with WMS confirmation', time: '20s', note: 'Scanner rejects wrong bin automatically' },
    { id: BASE_TS + 813, text: 'Confirm stow — bin label is clear and durable', time: '5s', note: 'New labels — 2-year durability rating' }
  ],
  clues: [
    { id: BASE_TS + 820, title: 'Bin labels degraded across multiple aisles', description: 'Bin location labels faded or missing on approximately 15% of bins across stow aisles. Associates guessing or manually verifying on scanner.', type: 'Measurement' },
    { id: BASE_TS + 821, title: 'Stow error pattern concentrated in older aisles', description: '78% of stow location errors occurred in aisles installed in Phase 1 (older labels). Phase 2 aisles have near-zero errors.', type: 'Frequency' }
  ],
  fiveWhys: [
    'Stow location accuracy is at 99.0%, below the 99.5% target.',
    'Associates are stowing to incorrect bins — primarily in aisles with degraded labels.',
    'Bin labels are too faded to read reliably, causing misidentification of bin IDs.',
    'Bin labels were installed at site go-live 3 years ago and have not been replaced.',
    'No label maintenance programme exists — there is no process or ownership for label condition monitoring.'
  ],
  rootCauseSummary: 'Root cause: Bin location labels installed at site go-live have degraded significantly over 3 years. No maintenance programme exists. Associates are guessing bin IDs when labels are unreadable, causing stow errors.',
  solutions: [
    { id: BASE_TS + 830, text: 'Reprint all degraded bin labels across stow aisles 1–18 — 340 labels total', selected: true },
    { id: BASE_TS + 831, text: 'Add QR code to all new bin labels for scan validation — eliminates visual misread risk', selected: true }
  ],
  solutionsImplementedDate: '2026-03-01',
  beforeAfter: {
    beforeVal: 99.0,
    afterVal: 99.4,
    beforeDesc: 'Stow accuracy at 99.0% with degraded labels causing associates to misread bin IDs. 6 hours of pick recovery waste per day.',
    afterDesc: 'Stow accuracy improved to 99.4% after label reprint and QR validation. Pick failures reduced significantly.',
    evidence: '3-week monitoring period post-change. Accuracy holding at 99.4%. QR scan validation rejecting wrong-bin attempts in real time.'
  },
  monitoringPlan: [
    { id: BASE_TS + 840, metric: 'Stow Accuracy %', frequency: 'Weekly via bin audit', trigger: 'Below 99.2% for any week', responder: 'Stow Team Lead', action: 'Identify error pattern and check label condition in affected aisles. Reprint if needed.' }
  ],
  handoff: {
    results: 'Stow accuracy improved from 99.0% to 99.4%. All 340 degraded labels reprinted with QR codes. Errors in Phase 1 aisles eliminated.',
    dosDonts: 'DO: Monitor label condition quarterly — replace any that become faded. DO: Use QR scan feature on all new stow assignments. DON\'T: Stow without completing QR scan validation.',
    customerImpact: 'Pick associates now finding stock correctly on first attempt. Customer order accuracy improving downstream.',
    hardSavings: '~£3,400 per month in pick recovery time eliminated.',
    softSavings: 'Reduced associate frustration with failed stow scans. Improved pick associate confidence.',
    lessonsLearned: 'Physical infrastructure (labels, visual standards) degrades over time and needs a maintenance programme. Quick wins can deliver significant accuracy improvements.',
    nextTarget: 'Extend QR scan validation to include bin capacity checks.',
    ownerMonitoring: 'Stow Team Leads',
    ownerDocs: 'Ryan',
    teamTrained: true,
    sopUpdated: true
  },
  sop: 'Stow Location Accuracy SOP v1.1 — all stow operations must complete QR scan validation before confirming stow. Label condition check included in monthly aisle audit.',
  trainingNote: 'All stow associates briefed on QR scan validation process. Team leads shown label condition audit checklist.',
  summary: ''
}

const p9Actions = [
  { text: 'Audit all stow aisle labels and identify degraded labels', owner: 'Ryan', start_date: '2026-02-15', due: '2026-02-19', status: 'Complete', done: true },
  { text: 'Reprint 340 degraded bin labels with QR codes', owner: 'Ryan', start_date: '2026-02-20', due: '2026-03-01', status: 'Complete', done: true },
  { text: 'Configure WMS QR scan validation for stow process', owner: 'IT', start_date: '2026-02-22', due: '2026-03-01', status: 'Complete', done: true },
  { text: 'Run 30-day control monitoring with weekly accuracy checks', owner: 'Stow Team Leads', start_date: '2026-03-02', due: '2026-04-02', status: 'In Progress', done: false }
]

const p9Checklist = {
  currentTool: 'summary',
  charter: true,
  process: true,
  before_photo: true,
  rootcause: true,
  solutions: true,
  after_photo: true,
  summary: false
}

projectInsert.run(
  9, 'Stow Location Accuracy', 'Control', 'accuracy', 99.0, 99.5,
  'Stow location errors creating pick failures. Associates misreading degraded bin labels — accuracy at 99.0% vs 99.5% target.',
  '340 bin labels reprinted with QR scan validation. Accuracy at 99.4% and holding. Handoff complete — summary outstanding.',
  JSON.stringify(p9Charter),
  JSON.stringify(p9Actions),
  JSON.stringify(p9Checklist),
  1, 'quick_win', daysAgo(42), daysAgo(2)
)

// ── Project 10: Pack Station Ergonomics ───────────────────────────────────

const p10Charter = {
  teamMembers: 'Ryan (CI Lead), HSE Advisor, Pack Ops Team, Facilities',
  problemStatement: 'Pack station layout causing repetitive strain and fatigue. 68% of associates report discomfort by end of shift. UPH drops ~8% in hour 4+ — suspected ergonomics correlation.',
  goalStatement: 'Reduce pack station REBA scores from average 9 to below 5 and improve UPH from 93 to 99 by redesigning station layout for ergonomic working height and reach.',
  businessCase: 'UPH declining 8% in hour 4 across all pack shifts represents significant productivity loss. Additionally, ergonomics-related absence is costing ~£4,200 per month in agency cover.',
  scopeIn: 'All 48 pack stations across Pack floor.',
  scopeOut: 'Sort conveyor and dispatch operations.',
  beforePhoto: null,
  beforePhotoNote: 'Pack station showing fixed-height workstation with overhead reach required for conveyor — REBA assessment in progress, associate demonstrating awkward trunk flexion posture',
  beforePhotoDate: '2026-03-20',
  sipoc: {
    suppliers: ['Pick associates', 'Pack material stores', 'Facilities'],
    inputs: ['Picked items', 'Packaging materials', 'Workstation setup'],
    process: ['Collect item', 'Select packaging', 'Pack item', 'Label', 'Place on conveyor'],
    outputs: ['Packed labelled parcels'],
    customers: ['Sort conveyor', 'Dispatch team', 'Customers']
  },
  processDescription: 'Associates pack items at fixed-height stations. REBA assessments show awkward postures when reaching for materials and placing items on conveyor. Fatigue builds over shift causing both UPH decline and injury risk.',
  processSteps: [
    { id: BASE_TS + 900, text: 'Collect item from pick cart — awkward bend required', time: '8s', waste: 'Overprocessing' },
    { id: BASE_TS + 901, text: 'Select box size from shelf at low reach zone', time: '10s', waste: 'Motion' },
    { id: BASE_TS + 902, text: 'Pack item — station height not optimised for associate height', time: '25s', waste: 'none' },
    { id: BASE_TS + 903, text: 'Apply label — printer at awkward reach angle', time: '12s', waste: 'Motion' },
    { id: BASE_TS + 904, text: 'Place on conveyor — elevated reach for shorter associates', time: '8s', waste: 'Motion' }
  ],
  tobeSteps: [],
  clues: [
    { id: BASE_TS + 920, title: 'REBA scores average 9 — high risk', description: 'Ergonomic assessment across 12 pilot stations shows average REBA score of 9 (high risk). Main issues: awkward bending to pick cart, overhead reach to conveyor, sustained awkward trunk posture.', type: 'Measurement' },
    { id: BASE_TS + 921, title: 'UPH-fatigue correlation confirmed', description: 'Time-motion study confirms UPH declines 8% between hours 3 and 4+ of shift. Correlation coefficient r=0.81 between shift duration and UPH decline.', type: 'Frequency' },
    { id: BASE_TS + 922, title: 'Associate absence rate higher in pack than site average', description: 'Pack associate MSK-related absence is 2.4x higher than site average. 68% of associates report end-of-shift discomfort in survey.', type: 'Measurement' }
  ],
  fishbone: {
    Man: ['No ergonomics awareness training for pack associates', 'Associates not adjusting posture due to pace pressure'],
    Machine: ['Fixed-height stations not adjustable for associate height', 'Conveyor height set for average height — problematic for shorter associates'],
    Method: ['No stretching or micro-break protocol', 'Pack rate targets not adjusted for ergonomic compliance'],
    Material: ['Pick cart height requires associates to bend repeatedly', 'Box storage at low-level forcing sustained flexion'],
    Measurement: ['No real-time fatigue or posture monitoring', 'REBA assessments done annually — issues building between audits'],
    Environment: ['Pack floor noise prevents communication of discomfort', 'Station spacing too tight to allow proper repositioning']
  },
  fiveWhys: [
    'Pack UPH declines 8% in hours 4+ and MSK-related absence is 2.4x site average.',
    'Associates are experiencing fatigue and physical discomfort during pack operations.',
    'Pack station design requires awkward postures — bending, overhead reach, sustained trunk flexion.',
    '',
    ''
  ],
  rootCauseSummary: '',
  solutions: [],
  solutionsImplementedDate: '',
  beforeAfter: {
    beforeVal: 93,
    afterVal: 0,
    beforeDesc: '',
    afterDesc: '',
    evidence: ''
  },
  monitoringPlan: [],
  handoff: {
    results: '',
    dosDonts: '',
    customerImpact: '',
    hardSavings: '',
    softSavings: '',
    lessonsLearned: '',
    nextTarget: '',
    ownerMonitoring: '',
    ownerDocs: '',
    teamTrained: false,
    sopUpdated: false
  },
  sop: '',
  trainingNote: '',
  summary: ''
}

const p10Actions = [
  { text: 'Conduct REBA assessments on all 48 pack stations', owner: 'Ryan', start_date: '2026-03-18', due: '2026-03-25', status: 'Complete', done: true },
  { text: 'Run time-motion study and UPH-fatigue correlation analysis', owner: 'Ryan', start_date: '2026-03-18', due: '2026-03-28', status: 'Complete', done: true },
  { text: 'Run solutions design workshop with HSE and Pack team', owner: 'Ryan', start_date: '2026-04-02', due: '2026-04-10', status: 'Not Started', done: false },
  { text: 'Trial adjustable workstation heights on 6 pilot stations', owner: 'Facilities', start_date: '2026-04-14', due: '2026-04-28', status: 'Not Started', done: false }
]

const p10Checklist = {
  currentTool: 'rootcause',
  charter: true,
  process: true,
  before_photo: true,
  baseline: true,
  rootcause: false,
  solutions: false,
  tobemap: false,
  after_photo: false,
  handoff: false,
  summary: false
}

projectInsert.run(
  10, 'Pack Station Ergonomics', 'Analyse', 'uph', 93, 99,
  'Pack station layout causing repetitive strain and fatigue. 68% of associates report discomfort by end of shift. UPH drops ~8% in hours 4+.',
  'REBA assessments complete — avg score 9 (high risk). UPH-fatigue correlation confirmed (r=0.81). Solutions workshop overdue.',
  JSON.stringify(p10Charter),
  JSON.stringify(p10Actions),
  JSON.stringify(p10Checklist),
  2, 'yellow_belt', daysAgo(25), daysAgo(17)
)

// ── Project 11: DPMO Source Investigation ─────────────────────────────────

const p11Charter = {
  teamMembers: 'Ryan (CI Lead), Quality Team, Pack Team Leads',
  problemStatement: 'DPMO has exceeded 500 target for 11 consecutive weeks. Root causes unknown — multiple potential contributors identified but not confirmed. Investigation launched before committing to a full improvement project.',
  goalStatement: 'Identify and confirm the primary root causes of elevated DPMO through structured investigation, data collection, and analysis. Recommend next steps.',
  businessCase: 'Committing to a full GB/BB project without confirmed root causes risks wasted resource. Investigation will de-risk the improvement project and ensure we tackle the right causes.',
  scopeIn: 'Pack, label, and outbound sort processes contributing to DPMO events.',
  scopeOut: 'Inbound receive and returns.',
  screener: {
    customerImpact: 4,
    operationalImpact: 5,
    strategicAlignment: 4,
    urgency: 3,
    dataAvailable: true,
    notes: 'Strong operational impact — stow UPH directly drives downstream pick availability. Data readily available from WMS.',
    score: 16
  },
  sipoc: {
    suppliers: ['Pick associates', 'WMS pack assignment', 'Pack material stores'],
    inputs: ['Picked items', 'Packaging materials', 'Void fill', 'Labels'],
    process: ['Receive picked item', 'Select box', 'Pack with void fill', 'Apply label', 'Place on sort conveyor'],
    outputs: ['Packed and labelled parcels', 'WMS confirmation', 'Dispatch scan'],
    customers: ['Customers', 'Carrier partners', 'Returns team']
  },
  processDescription: 'Associates receive picked items, select appropriate box size, pack with void fill, apply shipping label, and place on sort conveyor. Multiple error types are being investigated across this flow.',
  processSteps: [
    { id: BASE_TS + 1000, text: 'Receive picked item at pack station', time: '5s', waste: 'none' },
    { id: BASE_TS + 1001, text: 'Select box size — often oversized', time: '10s', waste: 'Overprocessing' },
    { id: BASE_TS + 1002, text: 'Pack item with void fill — technique varies', time: '20s', waste: 'Defects' },
    { id: BASE_TS + 1003, text: 'Apply shipping label — placement inconsistent', time: '12s', waste: 'Defects' }
  ],
  dataCollectionPlan: [
    { id: 1700000040, what: 'DPMO by defect type', how: 'WMS quality report — daily extract', frequency: 'Daily', owner: 'Ryan (CI)', target: 'Identify top 3 categories' },
    { id: 1700000041, what: 'Void fill technique compliance', how: 'Pack station audit — 30 unit sample', frequency: '3x per week', owner: 'Pack Team Lead', target: 'Establish baseline compliance %' },
    { id: 1700000042, what: 'Label placement compliance', how: 'Outbound audit — 50 units per shift', frequency: 'Daily', owner: 'Ryan (CI)', target: 'Identify placement error rate by item type' }
  ],
  clues: [
    { id: BASE_TS + 1010, title: 'Void fill technique inconsistency across shifts', description: 'Three different void fill approaches observed across Day, Late, and Night shifts. No standardised SOP visible at stations. 6 damage events recorded in single audit.', type: 'Process' },
    { id: BASE_TS + 1011, title: 'Label placement errors on non-standard items', description: 'Associates applying labels to different faces on irregular-shaped items. Carrier scanner fails to read 22% of non-standard placements — correlates with label DPMO.', type: 'Measurement' },
    { id: BASE_TS + 1012, title: 'Pack error spike in shift hour 4+', description: 'Error rate rises from 1.2% to 4.8% in the final 90 minutes of each shift. Correlation with fatigue and reduced QC checking behaviour (r=0.81).', type: 'Frequency' }
  ],
  fishbone: {
    Man: ['No standardised void fill SOP — associates self-training', 'Fatigue in hour 4+ reducing QC vigilance'],
    Machine: ['Label printer alignment drift — not on preventive maintenance schedule', 'Pack station height fixed — causing associate fatigue'],
    Method: ['Three different void fill techniques across shifts', 'No mandatory shake test before sealing boxes'],
    Material: ['Oversized boxes selected causing item movement in transit', 'Void fill dispenser positioned behind associate — causes awkward reach'],
    Measurement: ['DPMO tracked at site level only — no defect category breakdown', 'No per-associate or per-shift error rate visibility'],
    Environment: ['Pack floor noise — associates cannot easily communicate errors', 'Poor lighting at label application point on stations 24-36']
  },
  rootCauseSummary: 'Primary root cause: no standardised void fill SOP enforced at pack stations, with associates using 3 different techniques across shifts. Secondary: label placement errors on non-standard items and pack station fatigue in hour 4+.',
  confirm: {
    findingsSummary: 'Investigation found three contributing factors to elevated DPMO: incorrect void fill technique on outbound sort (45% of defects), label placement errors on mislabelled SKUs (32%), and pack station height causing associate fatigue and errors on long shifts (23%).',
    confirmedRootCause: 'Primary root cause: no standardised void fill SOP enforced at pack stations, with associates using 3 different techniques across shifts.',
    confidenceLevel: 'High',
    supportingEvidence: '28-day data collection, 3 shift observations, associate interviews across all 3 shifts. Pareto analysis confirms void fill accounts for >45% of DPMO events.'
  },
  recommendation: {
    decision: 'escalate',
    escalateTitle: 'DPMO Reduction — Void Fill & Pack Station Standards',
    escalateType: 'green_belt',
    closingReason: null,
    closingNotes: null
  },
  solutions: [],
  fiveWhys: [],
  tobeSteps: [],
  solutionsImplementedDate: '',
  beforeAfter: { beforeVal: 720, afterVal: 0, beforeDesc: '', afterDesc: '', evidence: '' },
  monitoringPlan: [],
  handoff: { results: '', dosDonts: '', customerImpact: '', hardSavings: '', softSavings: '', lessonsLearned: '', nextTarget: '', ownerMonitoring: '', ownerDocs: '', teamTrained: false, sopUpdated: false },
  sop: '',
  trainingNote: '',
  summary: ''
}

const p11Actions = [
  { text: 'Complete data collection plan and begin 28-day data capture', owner: 'Ryan', start_date: '2026-02-20', due: '2026-03-20', status: 'Complete', done: true },
  { text: 'Run shift observations across Day, Late, and Night shifts', owner: 'Ryan', start_date: '2026-03-01', due: '2026-03-15', status: 'Complete', done: true },
  { text: 'Complete fishbone and confirm root causes', owner: 'Ryan', start_date: '2026-03-16', due: '2026-03-25', status: 'Complete', done: true },
  { text: 'Present findings and recommend escalation to Green Belt', owner: 'Ryan', start_date: '2026-03-26', due: '2026-03-30', status: 'Complete', done: true }
]

const p11Checklist = {
  currentTool: 'recommendation',
  screener: true,
  charter: true,
  sipoc: true,
  process: true,
  data_collection_plan: true,
  clues: true,
  fishbone: true,
  rootcause: true,
  confirm: true,
  recommendation: true
}

projectInsert.run(
  11, 'DPMO Source Investigation', 'Closed', 'dpmo', 720, 500,
  'DPMO has exceeded 500 target for 11 consecutive weeks. Root causes unknown — multiple potential contributors identified but not confirmed. Investigation launched before committing to a full improvement project.',
  'Investigation complete. Primary root cause confirmed: void fill SOP absence. Escalated to Green Belt project.',
  JSON.stringify(p11Charter),
  JSON.stringify(p11Actions),
  JSON.stringify(p11Checklist),
  2, 'investigation', daysAgo(45), daysAgo(5)
)

// ─── kpi_data — 90 days × 4 metrics ─────────────────────────────────────────

const kpiInsert = db.prepare(`
  INSERT INTO kpi_data (metric_id, metric_label, value, target, date, shift, signal, annotation)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)

const annotations = {
  UPH: {
    85: 'New stow zone mapping trialled in row 3A',
    60: 'Staff shortage — bank holiday weekend',
    55: 'Reduced performance during staff shortage',
    40: 'Process change: pick path algorithm update',
    20: 'Stow Rate project improvement phase launched',
    10: 'Zone remapping rolled out to all rows'
  },
  DPMO: {
    75: 'Damage rate investigation started',
    50: 'Void fill SOP deployed to pack stations',
    45: 'Toolbox talks complete across all shifts',
    25: 'New label placement standard launched',
    8: 'DPMO trending below target — sustaining phase'
  },
  Accuracy: {
    65: 'Scan miss reduction project — measure phase',
    35: 'New scan SOP launched on inbound dock',
    15: 'Stow location colour-coding installed'
  },
  DTS: {
    58: 'DTS VSM complete — bottlenecks identified',
    42: 'Trailer check-in SOP updated',
    30: 'Labelling queue redesign deployed',
    12: 'WMS bin assignment change live'
  }
}

const shifts = ['Days', 'Nights', 'Days', 'Nights', 'Days']

for (let day = 89; day >= 0; day--) {
  const dayIndex = 89 - day  // 0 = oldest, 89 = most recent
  const dateStr = new Date(Date.now() - day * 86400000).toISOString().split('T')[0]

  // UPH: baseline ~92-95, dips at day 30-40 (daysAgo index ~49-59), trends to 98-102
  let uphBase
  if (dayIndex < 20) uphBase = 92 + dayIndex * 0.1
  else if (dayIndex < 30) uphBase = 94 + (dayIndex - 20) * 0.15
  else if (dayIndex < 45) uphBase = 94 - (dayIndex - 30) * 0.3  // dip
  else if (dayIndex < 55) uphBase = 89.5 + (dayIndex - 45) * 0.5  // recovery
  else uphBase = 94.5 + (dayIndex - 55) * 0.21
  const uphValue = round2(clamp(uphBase + rand(-2.5, 2.5), 82, 110))
  const uphAnnotation = annotations.UPH[day] || null
  const uphSignal = uphValue < 90 ? 1 : 0

  // Accuracy: starts 99.1-99.3, improves to 99.5-99.7
  const accBase = 99.1 + dayIndex * 0.007
  const accValue = round2(clamp(accBase + rand(-0.12, 0.12), 98.8, 99.9))
  const accAnnotation = annotations.Accuracy[day] || null
  const accSignal = accValue < 99.3 ? 1 : 0

  // DPMO: starts 680-720, reduces to 380-420
  const dpmoBase = 710 - dayIndex * 3.6
  const dpmoValue = round2(clamp(dpmoBase + rand(-30, 30), 340, 780))
  const dpmoAnnotation = annotations.DPMO[day] || null
  const dpmoSignal = dpmoValue > 600 ? 1 : 0

  // DTS: starts 95-96%, improves to 98-99%
  const dtsBase = 95.0 + dayIndex * 0.044
  const dtsValue = round2(clamp(dtsBase + rand(-0.8, 0.8), 93.5, 99.5))
  const dtsAnnotation = annotations.DTS[day] || null
  const dtsSignal = dtsValue < 96.5 ? 1 : 0

  const shift = shifts[dayIndex % shifts.length]

  kpiInsert.run('uph', 'UPH', uphValue, 100, dateStr, shift, uphSignal, uphAnnotation)
  kpiInsert.run('accuracy', 'Pick Accuracy', accValue, 99.5, dateStr, shift, accSignal, accAnnotation)
  kpiInsert.run('dpmo', 'DPMO', dpmoValue, 500, dateStr, shift, dpmoSignal, dpmoAnnotation)
  kpiInsert.run('dts', 'DTS', dtsValue, 98, dateStr, shift, dtsSignal, dtsAnnotation)
}

// ─── observations — 28 floor walk entries ────────────────────────────────────

const obsInsert = db.prepare(`
  INSERT INTO observations (area, waste_type, severity, text, date, timestamp)
  VALUES (?, ?, ?, ?, ?, ?)
`)

const observationData = [
  { area: 'Inbound', waste_type: 'Waiting', severity: 2, text: 'Associates waiting at scan stations during sort peak — 3–5 min idle time observed at dock doors 4–7', daysBack: 88 },
  { area: 'Inbound', waste_type: 'Motion', severity: 2, text: 'Forklift cages stored on wrong side of receive bay — associates walking 40m+ to retrieve empty totes', daysBack: 85 },
  { area: 'Stow', waste_type: 'Motion', severity: 3, text: 'Excess travel distance between pick locations in zone 3B — associates averaging 1.6km/hr vs benchmark 0.9km', daysBack: 82 },
  { area: 'Pack', waste_type: 'Defects', severity: 3, text: 'Void fill not used correctly on fragile items — 6 damage events recorded on audit. Visual standard not visible from workstation', daysBack: 79 },
  { area: 'Outbound', waste_type: 'Overprocessing', severity: 1, text: 'Associates double-scanning parcels before loading — one scan sufficient, second scan creating unnecessary delay', daysBack: 76 },
  { area: 'Inbound', waste_type: 'Transportation', severity: 2, text: 'Tote replenishment trolleys not staged at point of use — being wheeled from central staging area 3x per shift', daysBack: 73 },
  { area: 'Pick', waste_type: 'Waiting', severity: 2, text: 'Pick cart battery swap causing 8–12 min downtime — no dedicated battery swap station, associates walking to warehouse end', daysBack: 70 },
  { area: 'Pack', waste_type: 'Motion', severity: 1, text: 'Tape guns stored underneath pack bench — associates bending repeatedly. Simple hook bracket would eliminate motion', daysBack: 67 },
  { area: 'Sortation', waste_type: 'Defects', severity: 2, text: 'Mislabelled parcels reaching sort conveyor — approx. 12 per shift. Label placement on non-standard item sizes inconsistent', daysBack: 64 },
  { area: 'Inbound', waste_type: 'Inventory', severity: 2, text: 'Overflow stock from trailer blocking receive bay walkway — no staging area designated for overflow. Safety concern.', daysBack: 61 },
  { area: 'Stow', waste_type: 'Waiting', severity: 1, text: 'Scanner assigned to associate at start of shift taking 4–6 min — no dedicated scanner issue point in stow area', daysBack: 58 },
  { area: 'Pick', waste_type: 'Motion', severity: 2, text: 'Associates returning to zone start to collect next batch — batch release process could be improved to reduce dead travel', daysBack: 55 },
  { area: 'Pack', waste_type: 'Overprocessing', severity: 1, text: 'Associates applying fragile stickers to all outbound items regardless of product type — over 60% do not require sticker', daysBack: 52 },
  { area: 'Outbound', waste_type: 'Waiting', severity: 3, text: 'Sort conveyor stoppage at peak causing 15-min backup — E-stop triggered by cardboard jam. No clear jam-clearance SOP visible', daysBack: 49 },
  { area: 'Inbound', waste_type: 'Defects', severity: 2, text: 'Damaged stock being stowed without damage label applied — found during bin audit. Needs catch point before stow', daysBack: 46 },
  { area: 'Returns', waste_type: 'Overprocessing', severity: 2, text: 'Returns grading process has 3 duplicate check steps — associates re-checking condition already verified at unbox', daysBack: 43 },
  { area: 'Stow', waste_type: 'Motion', severity: 2, text: 'Empty bin totes left in aisle after stow complete — trip hazard and causes congestion for next associate wave', daysBack: 40 },
  { area: 'Pick', waste_type: 'Defects', severity: 3, text: 'Pick error rate spike observed in zone 4C — bin label faded on row 4C-112 to 4C-120. Associates mis-scanning adjacent bins', daysBack: 37 },
  { area: 'Pack', waste_type: 'Waiting', severity: 1, text: 'Label printer offline for 22 minutes during early shift changeover — no clear escalation path for associates', daysBack: 34 },
  { area: 'Sortation', waste_type: 'Transportation', severity: 2, text: 'Sorted totes being manually moved to dispatch staging — conveyor divert gate faulty on lane 3. Temporary workaround in place', daysBack: 31 },
  { area: 'Inbound', waste_type: 'Motion', severity: 1, text: 'Pallet wrap station not at point of use — associates walking to far end of receive bay to access wrap machine', daysBack: 28 },
  { area: 'Returns', waste_type: 'Inventory', severity: 2, text: 'Returns buffer area overfull — stock not being processed to disposition within 24-hour SLA. Backlog estimated at 2 days', daysBack: 25 },
  { area: 'Pick', waste_type: 'Waiting', severity: 2, text: 'WMS pick path not optimised for current bin layout — associates walking past empty pick faces due to system routing', daysBack: 22 },
  { area: 'Outbound', waste_type: 'Defects', severity: 2, text: 'Two parcels dispatched without final scan — detected via carrier exception report. Audit identified root cause as conveyor blind spot', daysBack: 19 },
  { area: 'Stow', waste_type: 'Motion', severity: 1, text: 'Bin location cards missing in 3 aisles — associates having to manually verify location on scanner before stow', daysBack: 16 },
  { area: 'Pack', waste_type: 'Defects', severity: 2, text: 'Box size selection errors noted on pack audit — associates selecting oversized boxes for small items. No visual guide at station', daysBack: 13 },
  { area: 'Inbound', waste_type: 'Waiting', severity: 2, text: 'Trailer check-in process delay — dock officer handling both inbound and outbound admin simultaneously during peak. Queue forming', daysBack: 7 },
  { area: 'Pick', waste_type: 'Motion', severity: 1, text: 'Pick carts not returned to home position at shift end — next shift associates spending 5–10 min locating carts across floor', daysBack: 3 }
]

for (const obs of observationData) {
  const dateStr = new Date(Date.now() - obs.daysBack * 86400000).toISOString().split('T')[0]
  const ts = new Date(Date.now() - obs.daysBack * 86400000 + randInt(6, 14) * 3600000).toISOString()
  obsInsert.run(obs.area, obs.waste_type, obs.severity, obs.text, dateStr, ts)
}

// ─── ideas — portfolio pipeline ───────────────────────────────────────────────

const ideaInsert = db.prepare(`
  INSERT INTO ideas (portfolio_id, title, description, area, waste_type, source, pipeline_stage, eval_status, impact, difficulty, metric_id, baseline, target_value, estimated_weeks, notes, project_type, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const ideas = [
  {
    portfolio_id: 1,
    title: 'Automated Stow Confirmation Audio Feedback',
    description: 'Implement audio confirmation tone on scanner for successful stow events — reduces reliance on visual check and speeds up stow cycle time.',
    area: 'Stow', waste_type: 'Defects', source: 'floor_walk',
    pipeline_stage: 'idea', eval_status: 'pending', impact: 'medium', difficulty: 'standard',
    metric_id: 'uph', baseline: 88, target_value: 92, estimated_weeks: 3,
    notes: 'Raised by James during Tier 2 review. IT to confirm feasibility.',
    project_type: 'quick_win', created_at: daysAgo(12), updated_at: daysAgo(12)
  },
  {
    portfolio_id: 1,
    title: 'Cross-Training: Receive & Stow Flexibility',
    description: 'Cross-train receive associates in stow operations to enable flexible deployment during peak hours and reduce bottleneck at stow entry.',
    area: 'Inbound', waste_type: 'Waiting', source: 'manual',
    pipeline_stage: 'definition', eval_status: 'approved', impact: 'high', difficulty: 'standard',
    metric_id: 'uph', baseline: 88, target_value: 96, estimated_weeks: 6,
    notes: 'L5 Ops signed off. Training plan being developed with L&D team.',
    project_type: 'yellow_belt', created_at: daysAgo(22), updated_at: daysAgo(5)
  },
  {
    portfolio_id: 2,
    title: 'Pack Station Visual Box Size Guide',
    description: 'Laminated visual guide at each pack station showing correct box size for common product dimensions. Reduces overboxing and damage.',
    area: 'Pack', waste_type: 'Defects', source: 'observation',
    pipeline_stage: 'validation', eval_status: 'approved', impact: 'medium', difficulty: 'easy',
    metric_id: 'dpmo', baseline: 720, target_value: 580, estimated_weeks: 2,
    notes: 'Draft guide created. Piloting on 6 stations this week.',
    project_type: 'quick_win', created_at: daysAgo(18), updated_at: daysAgo(2)
  },
  {
    portfolio_id: 2,
    title: 'Pick Error Real-Time Alert System',
    description: 'Configure WMS to send real-time alert to area manager when pick error rate in any zone exceeds 0.5% over a 30-min window.',
    area: 'Pick', waste_type: 'Defects', source: 'tier2',
    pipeline_stage: 'assigned', eval_status: 'approved', impact: 'high', difficulty: 'hard',
    metric_id: 'accuracy', baseline: 99.2, target_value: 99.6, estimated_weeks: 8,
    notes: 'WMS change request raised. IT delivery estimate: 5 weeks.',
    project_type: 'yellow_belt', created_at: daysAgo(35), updated_at: daysAgo(6)
  },
  {
    portfolio_id: 3,
    title: 'Dock Door Pre-Assignment System',
    description: 'Pre-assign dock doors to trailers based on trailer arrival schedule — eliminates yard team decision bottleneck and reduces DTS by up to 25 minutes.',
    area: 'Inbound', waste_type: 'Waiting', source: 'manual',
    pipeline_stage: 'idea', eval_status: 'pending', impact: 'high', difficulty: 'standard',
    metric_id: 'dts', baseline: 95.2, target_value: 98.0, estimated_weeks: 6,
    notes: 'Conceptual stage. Transport planning team to review feasibility.',
    project_type: 'green_belt', created_at: daysAgo(8), updated_at: daysAgo(8)
  },
  {
    portfolio_id: 3,
    title: 'Digital Trailer Check-In Form',
    description: 'Replace paper-based trailer check-in form with tablet-based digital capture. Eliminates transcription delay and enables real-time DTS tracking.',
    area: 'Inbound', waste_type: 'Overprocessing', source: 'floor_walk',
    pipeline_stage: 'assigned', eval_status: 'approved', impact: 'high', difficulty: 'standard',
    metric_id: 'dts', baseline: 95.2, target_value: 97.5, estimated_weeks: 5,
    notes: 'iPad solution identified. Procurement underway. IT config to follow.',
    project_type: 'yellow_belt', created_at: daysAgo(28), updated_at: daysAgo(3)
  },
  {
    portfolio_id: 1,
    title: 'Bin Label Refresh Programme',
    description: 'Systematic replacement of all faded and damaged bin location labels across stow floor. Estimated 340 labels to replace across aisles 1–18.',
    area: 'Stow', waste_type: 'Defects', source: 'observation',
    pipeline_stage: 'Closed', eval_status: 'approved', impact: 'medium', difficulty: 'easy',
    metric_id: 'accuracy', baseline: 99.0, target_value: 99.4, estimated_weeks: 2,
    notes: 'Complete. All 340 labels replaced with QR codes. Error rate in stow down 0.4% since completion.',
    project_type: 'quick_win', created_at: daysAgo(55), updated_at: daysAgo(32)
  },
  {
    portfolio_id: 2,
    title: 'Returns Grading Standard Operating Procedure',
    description: 'Develop and deploy standardised returns grading SOP eliminating duplicate check steps and reducing handling time per unit by ~40 seconds.',
    area: 'Returns', waste_type: 'Overprocessing', source: 'floor_walk',
    pipeline_stage: 'definition', eval_status: 'pending', impact: 'medium', difficulty: 'standard',
    metric_id: 'uph', baseline: 76, target_value: 82, estimated_weeks: 4,
    notes: 'Observation data complete. Draft SOP being written.',
    project_type: 'yellow_belt', created_at: daysAgo(14), updated_at: daysAgo(4)
  }
]

for (const idea of ideas) {
  ideaInsert.run(
    idea.portfolio_id, idea.title, idea.description, idea.area, idea.waste_type,
    idea.source, idea.pipeline_stage, idea.eval_status, idea.impact, idea.difficulty,
    idea.metric_id, idea.baseline, idea.target_value, idea.estimated_weeks,
    idea.notes, idea.project_type, idea.created_at, idea.updated_at
  )
}

// ─── standalone_maps ─────────────────────────────────────────────────────────

const mapInsert = db.prepare(`
  INSERT INTO standalone_maps (title, area, map_type, description, data, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)

const maps = [
  {
    title: 'Inbound Receive Flow',
    area: 'Inbound',
    map_type: 'current',
    description: 'Current state process map for inbound receive operations from trailer arrival to tote handoff.',
    data: JSON.stringify({
      nodes: [
        { id: '1', label: 'Trailer Arrives at Gate', x: 50, y: 100, type: 'start' },
        { id: '2', label: 'Dock Officer Check-In', x: 220, y: 100, type: 'process' },
        { id: '3', label: 'Assign Dock Door', x: 390, y: 100, type: 'decision' },
        { id: '4', label: 'Unload & Scan Units', x: 560, y: 100, type: 'process' },
        { id: '5', label: 'Sort to Totes', x: 730, y: 100, type: 'process' },
        { id: '6', label: 'Handoff to Stow', x: 900, y: 100, type: 'end' }
      ],
      edges: [
        { id: 'e1', source: '1', target: '2', label: '~10 min avg' },
        { id: 'e2', source: '2', target: '3', label: '~5 min' },
        { id: 'e3', source: '3', target: '4', label: 'door available' },
        { id: 'e4', source: '4', target: '5', label: '~45 min' },
        { id: 'e5', source: '5', target: '6', label: '~20 min' }
      ]
    }),
    created_at: daysAgo(58),
    updated_at: daysAgo(30)
  },
  {
    title: 'Stow Process (Current State)',
    area: 'Stow',
    map_type: 'current',
    description: 'Current state stow process map highlighting motion waste and scanner lag pain points.',
    data: JSON.stringify({
      nodes: [
        { id: '1', label: 'Collect Tote from Conveyor', x: 50, y: 100, type: 'start' },
        { id: '2', label: 'Walk to Zone', x: 220, y: 100, type: 'process' },
        { id: '3', label: 'Scan Bin Location', x: 390, y: 100, type: 'process' },
        { id: '4', label: 'Stow Unit', x: 560, y: 100, type: 'process' },
        { id: '5', label: 'Confirm Stow on Scanner', x: 730, y: 100, type: 'process' },
        { id: '6', label: 'Return for Next Tote', x: 900, y: 100, type: 'end' }
      ],
      edges: [
        { id: 'e1', source: '1', target: '2', label: '' },
        { id: 'e2', source: '2', target: '3', label: 'avg 180m travel' },
        { id: 'e3', source: '3', target: '4', label: '2-4s scanner lag' },
        { id: 'e4', source: '4', target: '5', label: '' },
        { id: 'e5', source: '5', target: '6', label: 'avg 180m return' }
      ]
    }),
    created_at: daysAgo(72),
    updated_at: daysAgo(45)
  },
  {
    title: 'Optimised Pick Path (To-Be)',
    area: 'Pick',
    map_type: 'future',
    description: 'To-be state for pick path optimisation — batch release and zone-constrained routing to reduce travel distance by ~35%.',
    data: JSON.stringify({
      nodes: [
        { id: '1', label: 'Receive Optimised Batch on Scanner', x: 50, y: 100, type: 'start' },
        { id: '2', label: 'Zone-Constrained Pick Route', x: 250, y: 100, type: 'process' },
        { id: '3', label: 'Scan & Pick Each Unit', x: 450, y: 100, type: 'process' },
        { id: '4', label: 'Complete Batch at Zone End', x: 650, y: 100, type: 'process' },
        { id: '5', label: 'Deposit to Sort Conveyor', x: 850, y: 100, type: 'end' }
      ],
      edges: [
        { id: 'e1', source: '1', target: '2', label: 'WMS optimised route' },
        { id: 'e2', source: '2', target: '3', label: '<0.9km/hr target' },
        { id: 'e3', source: '3', target: '4', label: '' },
        { id: 'e4', source: '4', target: '5', label: 'no dead travel' }
      ]
    }),
    created_at: daysAgo(20),
    updated_at: daysAgo(5)
  },
  {
    title: 'DTS Value Stream Map',
    area: 'Inbound',
    map_type: 'vsm',
    description: 'Value stream map for Dock-to-Stock process — identifying waste and cycle time from trailer arrival to confirmed bin location.',
    data: JSON.stringify({
      nodes: [
        { id: '1', label: 'Trailer Arrival', x: 50, y: 120, type: 'supplier', ct: '0', va: false },
        { id: '2', label: 'Gate Check-In', x: 200, y: 120, type: 'process', ct: '10 min', va: false },
        { id: '3', label: 'Dock Door Assignment', x: 370, y: 120, type: 'process', ct: '8 min', va: false },
        { id: '4', label: 'Unload & Receive Scan', x: 540, y: 120, type: 'process', ct: '45 min', va: true },
        { id: '5', label: 'Label & Sort', x: 710, y: 120, type: 'process', ct: '22 min', va: true },
        { id: '6', label: 'Stow to Bin Location', x: 880, y: 120, type: 'process', ct: '38 min', va: true },
        { id: '7', label: 'Bin Confirmed in WMS', x: 1050, y: 120, type: 'end', ct: '0', va: false }
      ],
      edges: [
        { id: 'e1', source: '1', target: '2' },
        { id: 'e2', source: '2', target: '3' },
        { id: 'e3', source: '3', target: '4' },
        { id: 'e4', source: '4', target: '5' },
        { id: 'e5', source: '5', target: '6' },
        { id: 'e6', source: '6', target: '7' }
      ],
      summary: { totalCT: '123 min', valueAddedTime: '105 min', nvaTime: '18 min', efficiency: '85%' }
    }),
    created_at: daysAgo(55),
    updated_at: daysAgo(18)
  }
]

for (const m of maps) {
  mapInsert.run(m.title, m.area, m.map_type, m.description, m.data, m.created_at, m.updated_at)
}

// ─── briefs ───────────────────────────────────────────────────────────────────

const briefInsert = db.prepare(`
  INSERT INTO briefs (date, content, type, created_at)
  VALUES (?, ?, ?, ?)
`)

briefInsert.run(
  new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
  `# BHX4 Daily CI Brief — ${new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0]}

## Performance Snapshot
- **UPH**: 101.4 (target: 100) — stow zone remapping delivering sustained gains
- **Accuracy**: 99.63% (target: 99.5%) — scan miss reduction project in control phase
- **DPMO**: 412 (target: 500) — below target for 8th consecutive day
- **DTS**: 98.2% (target: 98%) — bottleneck elimination project results holding

## Active Project Headlines
**Stow Rate Optimisation (Green Belt)** — Zone remapping rolled out to all rows. UPH pilot area: 103. Full site roll-out tracking to plan. On target for control phase entry in 9 days.

**DTS Bottleneck Elimination (Green Belt)** — DTS now averaging 3.7 hours (target: 3.5h). WMS bin assignment change in progress with IT team. Expecting go-live in 5 days.

**DPMO Root Cause Investigation (Black Belt)** — Fishbone analysis complete. Top 3 root causes validated. Solutions workshop scheduled for Thursday.

## Nudges
- Trailer Turnaround SOP project has had no update in 20 days — recommend scheduling a check-in with the yard team.
- Pack Station Ergonomics project stalled at Analyse phase — REBA assessments done but solutions workshop not yet booked.

## Today's Focus
Priority: confirm WMS change request timeline with IT, complete stow roll-out day 2 monitoring, and book ergonomics solutions workshop.`,
  'daily',
  daysAgo(1)
)

briefInsert.run(
  new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
  `# BHX4 GM Brief — Week Ending ${new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]}

## Weekly KPI Summary
| Metric | Week Avg | Target | Status |
|--------|----------|--------|--------|
| UPH | 99.8 | 100 | Near target |
| Accuracy | 99.58% | 99.5% | On target |
| DPMO | 428 | 500 | Below target |
| DTS | 97.9% | 98% | Near target |

## CI Portfolio Progress
**3 portfolios active** — 10 projects in flight across Inbound Efficiency, Quality & Accuracy, and Dock-to-Stock.

**2 projects completed this quarter:**
- 5S Receive Bay Standardisation — audit scores 2.1 to 4.3
- Damage Rate Reduction — DPMO reduced from 650 to 390

**Key wins this week:**
- Stow zone remapping delivering 12% UPH improvement in pilot area — scaling site-wide
- Inbound scan miss rate reduced from 0.9% to 0.3% — control phase monitoring active
- DTS averaging 3.7 hours — 12% improvement from 4.2-hour baseline

## Risks & Escalations
- Pack Station Ergonomics: HSE high-risk flag (avg REBA score 9). Solutions workshop needed this week.
- WMS pick path optimisation change request delayed — IT capacity constraint. Escalation recommended.

## Next 30 Days
Stow Rate Optimisation expected to reach control phase. DPMO investigation entering Improve phase with solutions shortlist. Trailer Turnaround SOP to be relaunched with stakeholder buy-in.`,
  'gm',
  daysAgo(7)
)

briefInsert.run(
  new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
  `# BHX4 GM Brief — Month in Review ${new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]}

## Month Summary
Strong improvement trajectory across all four primary KPIs. Site DPMO has broken below 500 target for first time this year. DTS improvement project delivering measurable results.

## KPI Trend (30-day)
- UPH: 94.2 to 99.1 (+5.2%) — stow and pick improvements contributing
- Accuracy: 99.38% to 99.58% (+0.2pp) — scan SOP changes embedded
- DPMO: 562 to 431 (-23%) — biggest improvement metric this month
- DTS: 96.1% to 97.9% (+1.8pp) — bottleneck elimination project on track

## Portfolio Health
All 3 CI portfolios active and on track. 8 ideas in pipeline — 2 progressed to assigned projects this month.

## Maturity Assessment
CI capability improving steadily. DMAIC usage up across L4/L5 management tier. Next maturity assessment due in 2 weeks.`,
  'gm',
  daysAgo(30)
)

// ─── maturity_scores — 3 monthly snapshots ───────────────────────────────────

const maturityInsert = db.prepare(`
  INSERT INTO maturity_scores (month, five_s, dmaic, standard_work, visual_mgmt, problem_solving, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)

const now = new Date()
const monthStr = (offset) => {
  const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

maturityInsert.run(monthStr(2), 2, 2, 2, 2, 2, 'Initial baseline assessment. 5S and standard work in early stages. CI awareness building across L4 team.')
maturityInsert.run(monthStr(1), 3, 3, 2, 3, 3, '5S audits now running weekly in Inbound and Pack. DMAIC being used on 4 active projects. Visual boards updated.')
maturityInsert.run(monthStr(0), 3, 4, 3, 3, 4, 'DMAIC capability strong — 4 green/black belt projects active. Standard work improving with new SOPs. Problem-solving culture developing well.')

// ─── Done ─────────────────────────────────────────────────────────────────────

db.close()
console.log(`demo.db created at: ${dbPath}`)
console.log(`   site_profile:    1 row`)
console.log(`   portfolios:      3 rows`)
console.log(`   projects:        ${11} rows`)
console.log(`   kpi_data:        ${90 * 4} rows (90 days x 4 metrics)`)
console.log(`   observations:    ${observationData.length} rows`)
console.log(`   ideas:           ${ideas.length} rows`)
console.log(`   standalone_maps: ${maps.length} rows`)
console.log(`   briefs:          3 rows`)
console.log(`   maturity_scores: 3 rows`)
