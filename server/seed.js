import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const db = new Database(join(__dirname, '..', 'data', 'continuum.db'))
db.pragma('foreign_keys = ON')

// ── Wipe existing seed data ──────────────────────────────────────
db.exec(`DELETE FROM ideas; DELETE FROM portfolios;`)
// Also remove projects seeded previously (those with portfolio_id set)
db.prepare(`DELETE FROM projects WHERE portfolio_id IS NOT NULL`).run()

// ── 1. Portfolio ─────────────────────────────────────────────────
const portfolio = db.prepare(`
  INSERT INTO portfolios (name, strategic_objective, primary_kpi, impact_goal, impact_unit, area_focus, status)
  VALUES (?, ?, ?, ?, ?, ?, 'active')
`).run(
  'Pick Efficiency FY2026',
  'Increase UPH across all Pick zones from a site average of 82 to 100 by end of FY2026 — closing the 18-point gap through structured CI projects across path, tooling, and process.',
  'uph', 18, 'UPH improvement', 'Pick'
)
const pid = portfolio.lastInsertRowid

// ── Helper ───────────────────────────────────────────────────────
function insertIdea(fields) {
  return db.prepare(`
    INSERT INTO ideas (portfolio_id, title, description, area, waste_type, source,
      pipeline_stage, eval_status, impact, difficulty, metric_id, baseline,
      target_value, estimated_weeks, project_id, notes)
    VALUES (@portfolio_id, @title, @description, @area, @waste_type, @source,
      @pipeline_stage, @eval_status, @impact, @difficulty, @metric_id, @baseline,
      @target_value, @estimated_weeks, @project_id, @notes)
  `).run({ portfolio_id: pid, area: 'Pick', waste_type: '', source: 'manual',
    pipeline_stage: 'idea', eval_status: 'pending', impact: 'medium',
    difficulty: 'standard', metric_id: 'uph', baseline: null, target_value: null,
    estimated_weeks: 4, project_id: null, notes: '', ...fields })
}

function insertProject(fields) {
  return db.prepare(`
    INSERT INTO projects (title, problem_statement, metric_id, baseline, target_value,
      stage, portfolio_id, idea_id, charter, actions, stage_checklist)
    VALUES (@title, @problem_statement, @metric_id, @baseline, @target_value,
      @stage, @portfolio_id, @idea_id, @charter, @actions, @stage_checklist)
  `).run({ metric_id: 'uph', baseline: null, target_value: null,
    actions: '[]', charter: '{}', stage_checklist: '{}', ...fields })
}

// ── 2. Raw Ideas (pending review) ────────────────────────────────
insertIdea({
  title: 'Zone A pick path is a U-shape — operators doubling back',
  description: 'Observed on floor walk: pickers in Zone A walk back to origin after every 3rd pick due to aisle layout. Estimated 90s wasted per hour per operator.',
  area: 'Pick', waste_type: 'Motion', source: 'floor_walk',
  pipeline_stage: 'idea', eval_status: 'pending', impact: 'high', difficulty: 'standard',
})

insertIdea({
  title: 'Wave release timing creating 8–12 min waiting gaps',
  description: 'Raised in Tier 2: operators regularly standing idle waiting for first wave release. Happens daily between 07:00–07:15 and 13:00–13:20.',
  area: 'Pick', waste_type: 'Waiting', source: 'tier2',
  pipeline_stage: 'idea', eval_status: 'pending', impact: 'high', difficulty: 'quick_win',
})

insertIdea({
  title: 'Scanner reboot loops causing pick interruptions in Zone C',
  description: 'Multiple operators reporting scanners freezing mid-pick. IT have been aware for 3 weeks but no fix deployed. Estimated 5–7 mins lost per shift per scanner.',
  area: 'Pick', waste_type: 'Waiting', source: 'gemba',
  pipeline_stage: 'idea', eval_status: 'pending', impact: 'medium', difficulty: 'quick_win',
})

// ── 3. Definition stage ───────────────────────────────────────────
insertIdea({
  title: 'Pick label print delay adding 4s per pick cycle',
  description: 'Label printers in Zone B lagging 3–4s behind scan events. Root cause unknown — could be network or printer firmware.',
  area: 'Pick', waste_type: 'Waiting', source: 'floor_walk',
  pipeline_stage: 'definition', eval_status: 'pending', impact: 'high', difficulty: 'quick_win',
})

insertIdea({
  title: 'Multi-zone batching not used — single-zone pick only',
  description: 'System configured for single-zone pick. Multi-zone batching would reduce travel time by est. 30%. Requires WMS config change + operator training.',
  area: 'Pick', waste_type: 'Motion', source: 'manual',
  pipeline_stage: 'definition', eval_status: 'pending', impact: 'high', difficulty: 'complex',
})

insertIdea({
  title: 'Tote positioning at pick stations causing reach waste',
  description: 'Totes placed on floor beside stations. Operators bending down for every tote exchange. Simple racking fix at ~£200 cost.',
  area: 'Pick', waste_type: 'Motion', source: 'gemba',
  pipeline_stage: 'definition', eval_status: 'accepted', impact: 'medium', difficulty: 'quick_win',
})

insertIdea({
  title: 'No standard pick cadence — operators self-pacing',
  description: 'No visual standard for pick rate expectations on the floor. Operators without coaching are running 15–20% below optimal.',
  area: 'Pick', waste_type: 'Skills', source: 'tier2',
  pipeline_stage: 'definition', eval_status: 'not_accepted', impact: 'low', difficulty: 'standard',
  notes: 'Declined — L&D programme already underway via ops team, duplication risk.',
})

// ── 4. Validation stage ───────────────────────────────────────────
insertIdea({
  title: 'Pick aisle sequencing not optimised for ASIN velocity',
  description: 'High-velocity ASINs located at far end of aisles. Slotting rework could reduce travel distance by ~25%. 3-week reflow project.',
  area: 'Pick', waste_type: 'Motion', source: 'pattern',
  pipeline_stage: 'validation', eval_status: 'accepted',
  impact: 'high', difficulty: 'standard',
  metric_id: 'uph', baseline: 81, target_value: 92, estimated_weeks: 5,
})

insertIdea({
  title: 'Pick station lighting below lux standard in Zones D–F',
  description: 'Lux readings at 180–200 lux vs 300 lux standard. Operators making more mis-picks in these zones. Maintenance quote received for LED retrofit.',
  area: 'Pick', waste_type: 'Defects', source: 'gemba',
  pipeline_stage: 'validation', eval_status: 'accepted',
  impact: 'medium', difficulty: 'quick_win',
  metric_id: 'dpmo', baseline: 1200, target_value: 600, estimated_weeks: 3,
})

// ── 5. Assigned — mid-DMAIC projects ─────────────────────────────

// Project A: Define stage (early)
const ideaA = insertIdea({
  title: 'Zone 1 UPH Gap — Pick Process Deep Dive',
  description: 'Zone 1 running consistently 6–8 UPH below site average. Full DMAIC initiated to find and fix root causes.',
  area: 'Pick', waste_type: 'Motion', source: 'tier2',
  pipeline_stage: 'assigned', eval_status: 'accepted',
  impact: 'high', difficulty: 'standard',
  metric_id: 'uph', baseline: 82, target_value: 95, estimated_weeks: 8,
})
const projA = insertProject({
  title: 'Zone 1 UPH Gap — Pick Process Deep Dive',
  problem_statement: 'Zone 1 has averaged 82 UPH over the last 6 weeks against a site target of 100 UPH. The 18-point gap is the largest of any single zone and is suppressing site-wide performance.',
  metric_id: 'uph', baseline: 82, target_value: 95,
  stage: 'Define', portfolio_id: pid, idea_id: ideaA.lastInsertRowid,
  charter: JSON.stringify({
    teamMembers: 'Ryan (Lead), Sarah (ME), Tom (L4 Ops)',
    problemStatement: 'Zone 1 has averaged 82 UPH over the last 6 weeks against a site target of 100 UPH.',
    goalStatement: 'Increase Zone 1 UPH from 82 to 95 within 8 weeks.',
    businessCase: 'Every 1 UPH gain across Zone 1 (12 operators) = approx. 12 productive hours per shift. Closing 13 UPH = 156 productive hours recovered weekly.',
    scopeIn: 'Zone 1 pick aisles A–H, all shifts, standard UPH metric only',
    scopeOut: 'Zone 2 & 3, DPMO, stow operations',
    fiveWhys: [],
    solutions: [],
    clues: [],
  }),
  stage_checklist: JSON.stringify({ charter: true, baseline: false, process: false, clues: false, rootcause: false, solutions: false, actions: false, results: false, summary: false, currentTool: 'baseline' }),
})
db.prepare(`UPDATE ideas SET project_id = ? WHERE id = ?`).run(projA.lastInsertRowid, ideaA.lastInsertRowid)

// Project B: Analyse stage (midway)
const ideaB = insertIdea({
  title: 'Pick Station Ergonomics & Reach Waste',
  description: 'Excessive reach waste at pick stations identified as a UPH suppressor. Analyse phase underway.',
  area: 'Pick', waste_type: 'Motion', source: 'floor_walk',
  pipeline_stage: 'assigned', eval_status: 'accepted',
  impact: 'medium', difficulty: 'quick_win',
  metric_id: 'uph', baseline: 84, target_value: 91, estimated_weeks: 6,
})
const projB = insertProject({
  title: 'Pick Station Ergonomics & Reach Waste',
  problem_statement: 'Operators at pick stations are making an average of 4 unnecessary reach movements per minute due to poor tote and label placement, estimated to cost 3–4 UPH.',
  metric_id: 'uph', baseline: 84, target_value: 91,
  stage: 'Analyse', portfolio_id: pid, idea_id: ideaB.lastInsertRowid,
  charter: JSON.stringify({
    teamMembers: 'Ryan (Lead), Jess (Industrial Design), Pick AM team',
    problemStatement: 'Operators at pick stations making 4+ unnecessary reach movements per minute due to poor tote and label placement.',
    goalStatement: 'Reduce per-pick reach waste to 1 movement max, recovering 3–4 UPH.',
    businessCase: '3 UPH recovered across 8 pick stations = 24 productive hours per shift.',
    scopeIn: 'Zones B, C, D pick stations only',
    processMap: 'Scan barcode → reach to tote → place item → reach to scanner → repeat',
    fiveWhys: [
      'Why is UPH below target? Operators spending excess time on non-value reaches.',
      'Why are they reaching? Totes are on the floor, not at waist height.',
      'Why are totes on the floor? No standard rack or holder installed at stations.',
      'Why is there no rack? Not included in original station spec.',
      'Why not in spec? Ergonomic review was skipped during station design.',
    ],
    rootCauseSummary: 'Station design omitted ergonomic review — tote placement forces low reach waste on every pick cycle.',
    solutions: [
      { text: 'Install adjustable tote brackets at waist height on all pick stations', selected: true },
      { text: 'Relocate label printers to eye-level mounts', selected: true },
      { text: 'Trial standing anti-fatigue mats to reduce micro-pauses', selected: false },
    ],
    clues: [
      { text: 'Zone B average reach height: 0.3m vs ergonomic ideal 0.9–1.1m', source: 'measurement' },
      { text: 'Operators in Zone D (taller average height) showing 2 UPH higher — posture factor', source: 'data' },
      { text: 'Maintenance time for tote re-fill: 45s vs 15s at benched stations in Pack', source: 'observation' },
    ],
  }),
  actions: JSON.stringify([
    { text: 'Source and order adjustable tote brackets (x16)', owner: 'Ryan', due: '2026-04-25', done: true },
    { text: 'Book maintenance slot for installation — Zones B & C first', owner: 'Tom', due: '2026-04-28', done: false },
    { text: 'Measure baseline reach time pre-install (video + stopwatch)', owner: 'Jess', due: '2026-04-20', done: true },
  ]),
  stage_checklist: JSON.stringify({ charter: true, baseline: true, process: true, clues: true, rootcause: true, solutions: false, actions: false, results: false, summary: false, currentTool: 'solutions' }),
})
db.prepare(`UPDATE ideas SET project_id = ? WHERE id = ?`).run(projB.lastInsertRowid, ideaB.lastInsertRowid)

// ── 6. Finished projects ──────────────────────────────────────────

// Finished A: Great result — Tier 2 Ready
const ideaC = insertIdea({
  title: 'Wave Release Process — Pre-Stage Buffer Fix',
  description: 'Fixed wave release process to eliminate 8–12 min idle gaps at shift start.',
  area: 'Pick', waste_type: 'Waiting', source: 'tier2',
  pipeline_stage: 'finished', eval_status: 'accepted',
  impact: 'high', difficulty: 'quick_win',
  metric_id: 'uph', baseline: 78, target_value: 90,
  estimated_weeks: 3, kpi_achieved: 94,
  date_finished: '2026-03-15',
})
const projC = insertProject({
  title: 'Wave Release Process — Pre-Stage Buffer Fix',
  problem_statement: 'Operators standing idle for 8–12 minutes at every shift start and after lunch due to wave release delays from the control room.',
  metric_id: 'uph', baseline: 78, target_value: 90,
  stage: 'Closed', portfolio_id: pid, idea_id: ideaC.lastInsertRowid,
  charter: JSON.stringify({
    teamMembers: 'Ryan (Lead), Control Room Lead, Ops Manager',
    problemStatement: 'Operators standing idle 8–12 minutes at shift start and lunch due to wave release delays.',
    goalStatement: 'Eliminate idle waiting — release first wave within 2 minutes of shift start.',
    businessCase: '10 min idle × 20 operators × 2 shifts = 400 lost productive minutes daily.',
    kpiAchieved: 94,
    summary: 'Pre-staging buffer introduced: control room now pre-builds first wave 15 minutes before shift start. Wave releases within 90 seconds of shift start consistently. UPH improved from 78 to 94 — 20.5% improvement, exceeding the 90 UPH target. Presented at Tier 2 and adopted as standard operating procedure site-wide.',
    solutions: [
      { text: 'Control room to pre-build wave 15 mins before shift start', selected: true },
      { text: 'Automated alert if wave build is not complete 10 mins before shift', selected: true },
    ],
  }),
  actions: JSON.stringify([
    { text: 'Update SOP for wave release pre-staging', owner: 'Ryan', due: '2026-03-10', done: true },
    { text: 'Train control room team on new process', owner: 'Ops Manager', due: '2026-03-12', done: true },
    { text: 'Monitor UPH for 2 weeks post-implementation', owner: 'Ryan', due: '2026-03-28', done: true },
  ]),
  stage_checklist: JSON.stringify({ charter: true, baseline: true, process: true, clues: true, rootcause: true, solutions: true, actions: true, results: true, summary: true, currentTool: 'summary' }),
})
db.prepare(`UPDATE ideas SET project_id = ?, kpi_achieved = 94, date_finished = '2026-03-15' WHERE id = ?`)
  .run(projC.lastInsertRowid, ideaC.lastInsertRowid)
db.prepare(`UPDATE projects SET updated_at = '2026-03-15 16:00:00' WHERE id = ?`).run(projC.lastInsertRowid)

// Finished B: Solid but modest result
const ideaD = insertIdea({
  title: 'Zone C Scanner Firmware Rollout',
  description: 'IT firmware update to resolve scanner freeze loops — co-ordinated rollout across 14 devices.',
  area: 'Pick', waste_type: 'Waiting', source: 'gemba',
  pipeline_stage: 'finished', eval_status: 'accepted',
  impact: 'medium', difficulty: 'quick_win',
  metric_id: 'uph', baseline: 83, target_value: 88,
  estimated_weeks: 2, kpi_achieved: 87,
  date_finished: '2026-04-02',
})
const projD = insertProject({
  title: 'Zone C Scanner Firmware Rollout',
  problem_statement: 'Scanners in Zone C freezing mid-pick, requiring forced reboot. Losing 5–7 minutes per scanner per shift across 14 devices.',
  metric_id: 'uph', baseline: 83, target_value: 88,
  stage: 'Closed', portfolio_id: pid, idea_id: ideaD.lastInsertRowid,
  charter: JSON.stringify({
    teamMembers: 'Ryan (Lead), IT Site Lead, Zone C AM',
    problemStatement: 'Scanners freezing mid-pick in Zone C — 5–7 min lost per device per shift.',
    goalStatement: 'Eliminate scanner freeze incidents in Zone C within 2 weeks.',
    kpiAchieved: 87,
    summary: 'Coordinated firmware rollout across all 14 Zone C scanners during overnight shift. Zero freeze incidents in the 4 weeks since rollout. UPH moved from 83 to 87, just below the 88 target — residual gap attributed to a separate operator coaching issue now in pipeline.',
    solutions: [
      { text: 'Stage firmware update across all Zone C scanners in single overnight window', selected: true },
    ],
  }),
  actions: JSON.stringify([
    { text: 'Co-ordinate overnight maintenance window with IT', owner: 'Ryan', due: '2026-03-29', done: true },
    { text: 'Post-update scanner test protocol', owner: 'IT Lead', due: '2026-03-30', done: true },
  ]),
  stage_checklist: JSON.stringify({ charter: true, baseline: true, process: true, clues: true, rootcause: true, solutions: true, actions: true, results: true, summary: true, currentTool: 'summary' }),
})
db.prepare(`UPDATE ideas SET project_id = ?, kpi_achieved = 87, date_finished = '2026-04-02' WHERE id = ?`)
  .run(projD.lastInsertRowid, ideaD.lastInsertRowid)
db.prepare(`UPDATE projects SET updated_at = '2026-04-02 15:30:00' WHERE id = ?`).run(projD.lastInsertRowid)

console.log(`✓ Seed complete — portfolio ID ${pid}`)
console.log(`  2 raw ideas pending review`)
console.log(`  4 ideas in definition`)
console.log(`  2 ideas in validation`)
console.log(`  2 active DMAIC projects (Define + Analyse)`)
console.log(`  2 finished projects (94 UPH, 87 UPH achieved)`)
