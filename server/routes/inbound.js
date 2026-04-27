import express from 'express'
import pool from '../db.js'

const router = express.Router()

// ── Demo data ─────────────────────────────────────────────────────────────────
// Story: team starts W15 struggling (backlog ~870, all UPHs below target),
// steadily improves W16 → W17, and in W18 (current week) all metrics are
// above target and backlog is nearly cleared. Mirrors the Excel shift tracker.
const DEMO_ENTRIES = [
  // ── W18 2026 · Apr 27–29 · Excellent — backlog nearly cleared ─────────────
  { id:2001, entry_date:'2026-04-27', shift:'day',   week_number:18, year:2026, parcel_units:1230, parcel_hours:11,  vendor_units:950,  vendor_hours:3.5, transfer_units:290, transfer_hours:2.5, stow_units:1950, stow_hours:12,  backlog_rcv_total:95,  notes:'' },
  { id:2002, entry_date:'2026-04-27', shift:'night', week_number:18, year:2026, parcel_units:760,  parcel_hours:7,   vendor_units:370,  vendor_hours:1.5, transfer_units:200, transfer_hours:1.5, stow_units:1340, stow_hours:8.5, backlog_rcv_total:75,  notes:'' },
  { id:2003, entry_date:'2026-04-28', shift:'day',   week_number:18, year:2026, parcel_units:1260, parcel_hours:11,  vendor_units:970,  vendor_hours:3.5, transfer_units:300, transfer_hours:2.5, stow_units:2000, stow_hours:12,  backlog_rcv_total:55,  notes:'' },
  { id:2004, entry_date:'2026-04-28', shift:'night', week_number:18, year:2026, parcel_units:780,  parcel_hours:7,   vendor_units:380,  vendor_hours:1.5, transfer_units:205, transfer_hours:1.5, stow_units:1380, stow_hours:8.5, backlog_rcv_total:40,  notes:'' },
  { id:2005, entry_date:'2026-04-29', shift:'day',   week_number:18, year:2026, parcel_units:1290, parcel_hours:11,  vendor_units:990,  vendor_hours:3.5, transfer_units:310, transfer_hours:2.5, stow_units:2050, stow_hours:12,  backlog_rcv_total:20,  notes:'Backlog nearly cleared' },

  // ── W17 2026 · Apr 21–25 · Improving — approaching target ─────────────────
  { id:2006, entry_date:'2026-04-21', shift:'day',   week_number:17, year:2026, parcel_units:1100, parcel_hours:11,  vendor_units:820,  vendor_hours:3.5, transfer_units:250, transfer_hours:2.5, stow_units:1680, stow_hours:12,  backlog_rcv_total:340, notes:'' },
  { id:2007, entry_date:'2026-04-21', shift:'night', week_number:17, year:2026, parcel_units:650,  parcel_hours:7,   vendor_units:290,  vendor_hours:1.5, transfer_units:165, transfer_hours:1.5, stow_units:1150, stow_hours:8.5, backlog_rcv_total:310, notes:'' },
  { id:2008, entry_date:'2026-04-22', shift:'day',   week_number:17, year:2026, parcel_units:1150, parcel_hours:11,  vendor_units:870,  vendor_hours:3.5, transfer_units:265, transfer_hours:2.5, stow_units:1750, stow_hours:12,  backlog_rcv_total:280, notes:'' },
  { id:2009, entry_date:'2026-04-22', shift:'night', week_number:17, year:2026, parcel_units:680,  parcel_hours:7,   vendor_units:310,  vendor_hours:1.5, transfer_units:175, transfer_hours:1.5, stow_units:1200, stow_hours:8.5, backlog_rcv_total:250, notes:'' },
  { id:2010, entry_date:'2026-04-23', shift:'day',   week_number:17, year:2026, parcel_units:1180, parcel_hours:11,  vendor_units:890,  vendor_hours:3.5, transfer_units:275, transfer_hours:2.5, stow_units:1820, stow_hours:12,  backlog_rcv_total:220, notes:'' },
  { id:2011, entry_date:'2026-04-23', shift:'night', week_number:17, year:2026, parcel_units:710,  parcel_hours:7,   vendor_units:330,  vendor_hours:1.5, transfer_units:180, transfer_hours:1.5, stow_units:1250, stow_hours:8.5, backlog_rcv_total:200, notes:'' },
  { id:2012, entry_date:'2026-04-24', shift:'day',   week_number:17, year:2026, parcel_units:1220, parcel_hours:11,  vendor_units:920,  vendor_hours:3.5, transfer_units:285, transfer_hours:2.5, stow_units:1890, stow_hours:12,  backlog_rcv_total:170, notes:'' },
  { id:2013, entry_date:'2026-04-24', shift:'night', week_number:17, year:2026, parcel_units:730,  parcel_hours:7,   vendor_units:350,  vendor_hours:1.5, transfer_units:190, transfer_hours:1.5, stow_units:1290, stow_hours:8.5, backlog_rcv_total:145, notes:'' },
  { id:2014, entry_date:'2026-04-25', shift:'day',   week_number:17, year:2026, parcel_units:1020, parcel_hours:10,  vendor_units:780,  vendor_hours:3,   transfer_units:250, transfer_hours:2,   stow_units:1650, stow_hours:11,  backlog_rcv_total:130, notes:'Friday — good finish to the week' },

  // ── W16 2026 · Apr 14–18 · Struggling — high backlog, below target ─────────
  { id:2015, entry_date:'2026-04-14', shift:'day',   week_number:16, year:2026, parcel_units:920,  parcel_hours:11,  vendor_units:680,  vendor_hours:3.5, transfer_units:195, transfer_hours:2.5, stow_units:1380, stow_hours:12,  backlog_rcv_total:580, notes:'' },
  { id:2016, entry_date:'2026-04-14', shift:'night', week_number:16, year:2026, parcel_units:540,  parcel_hours:7,   vendor_units:220,  vendor_hours:1,   transfer_units:130, transfer_hours:1.5, stow_units:950,  stow_hours:9,   backlog_rcv_total:620, notes:'' },
  { id:2017, entry_date:'2026-04-15', shift:'day',   week_number:16, year:2026, parcel_units:980,  parcel_hours:11,  vendor_units:720,  vendor_hours:3.5, transfer_units:210, transfer_hours:2.5, stow_units:1450, stow_hours:12,  backlog_rcv_total:550, notes:'' },
  { id:2018, entry_date:'2026-04-15', shift:'night', week_number:16, year:2026, parcel_units:560,  parcel_hours:7.5, vendor_units:240,  vendor_hours:1,   transfer_units:140, transfer_hours:1.5, stow_units:980,  stow_hours:9,   backlog_rcv_total:580, notes:'' },
  { id:2019, entry_date:'2026-04-16', shift:'day',   week_number:16, year:2026, parcel_units:1050, parcel_hours:11,  vendor_units:760,  vendor_hours:3.5, transfer_units:220, transfer_hours:2.5, stow_units:1520, stow_hours:12,  backlog_rcv_total:510, notes:'' },
  { id:2020, entry_date:'2026-04-16', shift:'night', week_number:16, year:2026, parcel_units:580,  parcel_hours:7.5, vendor_units:260,  vendor_hours:1,   transfer_units:150, transfer_hours:1.5, stow_units:1020, stow_hours:9,   backlog_rcv_total:530, notes:'' },
  { id:2021, entry_date:'2026-04-17', shift:'day',   week_number:16, year:2026, parcel_units:1080, parcel_hours:11,  vendor_units:790,  vendor_hours:3.5, transfer_units:230, transfer_hours:2.5, stow_units:1580, stow_hours:12,  backlog_rcv_total:460, notes:'' },
  { id:2022, entry_date:'2026-04-17', shift:'night', week_number:16, year:2026, parcel_units:600,  parcel_hours:7.5, vendor_units:280,  vendor_hours:1,   transfer_units:155, transfer_hours:1.5, stow_units:1060, stow_hours:9,   backlog_rcv_total:450, notes:'' },
  { id:2023, entry_date:'2026-04-18', shift:'day',   week_number:16, year:2026, parcel_units:880,  parcel_hours:10,  vendor_units:640,  vendor_hours:3,   transfer_units:185, transfer_hours:2,   stow_units:1350, stow_hours:11,  backlog_rcv_total:420, notes:'Friday — lighter volume' },

  // ── W15 2026 · Apr 7–11 · Poor — team behind, backlog building ─────────────
  { id:2024, entry_date:'2026-04-07', shift:'day',   week_number:15, year:2026, parcel_units:820,  parcel_hours:11,  vendor_units:590,  vendor_hours:3.5, transfer_units:170, transfer_hours:2.5, stow_units:1180, stow_hours:12,  backlog_rcv_total:820, notes:'' },
  { id:2025, entry_date:'2026-04-07', shift:'night', week_number:15, year:2026, parcel_units:490,  parcel_hours:7,   vendor_units:185,  vendor_hours:1,   transfer_units:110, transfer_hours:1.5, stow_units:840,  stow_hours:9,   backlog_rcv_total:870, notes:'' },
  { id:2026, entry_date:'2026-04-08', shift:'day',   week_number:15, year:2026, parcel_units:860,  parcel_hours:11,  vendor_units:620,  vendor_hours:3.5, transfer_units:180, transfer_hours:2.5, stow_units:1240, stow_hours:12,  backlog_rcv_total:790, notes:'' },
  { id:2027, entry_date:'2026-04-08', shift:'night', week_number:15, year:2026, parcel_units:510,  parcel_hours:7,   vendor_units:195,  vendor_hours:1,   transfer_units:120, transfer_hours:1.5, stow_units:870,  stow_hours:9,   backlog_rcv_total:820, notes:'' },
  { id:2028, entry_date:'2026-04-09', shift:'day',   week_number:15, year:2026, parcel_units:890,  parcel_hours:11,  vendor_units:640,  vendor_hours:3.5, transfer_units:185, transfer_hours:2.5, stow_units:1290, stow_hours:12,  backlog_rcv_total:760, notes:'Volume picking up' },
  { id:2029, entry_date:'2026-04-09', shift:'night', week_number:15, year:2026, parcel_units:520,  parcel_hours:7,   vendor_units:205,  vendor_hours:1,   transfer_units:125, transfer_hours:1.5, stow_units:900,  stow_hours:9,   backlog_rcv_total:790, notes:'' },
  { id:2030, entry_date:'2026-04-10', shift:'day',   week_number:15, year:2026, parcel_units:870,  parcel_hours:11,  vendor_units:620,  vendor_hours:3.5, transfer_units:175, transfer_hours:2.5, stow_units:1260, stow_hours:12,  backlog_rcv_total:730, notes:'' },
  { id:2031, entry_date:'2026-04-10', shift:'night', week_number:15, year:2026, parcel_units:500,  parcel_hours:7,   vendor_units:190,  vendor_hours:1,   transfer_units:115, transfer_hours:1.5, stow_units:870,  stow_hours:9,   backlog_rcv_total:760, notes:'' },
  { id:2032, entry_date:'2026-04-11', shift:'day',   week_number:15, year:2026, parcel_units:780,  parcel_hours:10,  vendor_units:560,  vendor_hours:3,   transfer_units:160, transfer_hours:2,   stow_units:1140, stow_hours:11,  backlog_rcv_total:720, notes:'Friday' },
]

const DEMO_TARGETS = { parcel_uph:100, vendor_uph:250, transfer_uph:100, rcv_uph:150, stow_uph:150 }

function isDemo(req) { return req.headers['x-demo-mode'] === 'true' }

function derive(e) {
  const pU = e.parcel_uph   = e.parcel_hours   > 0 ? e.parcel_units   / e.parcel_hours   : null
  const vU = e.vendor_uph   = e.vendor_hours   > 0 ? e.vendor_units   / e.vendor_hours   : null
  const tU = e.transfer_uph = e.transfer_hours > 0 ? e.transfer_units / e.transfer_hours : null
  const rcvU = (e.parcel_units||0) + (e.vendor_units||0) + (e.transfer_units||0)
  const rcvH = (e.parcel_hours||0) + (e.vendor_hours||0) + (e.transfer_hours||0)
  e.rcv_total_units  = rcvU
  e.rcv_hours_total  = rcvH
  e.rcv_uph          = rcvH > 0 ? rcvU / rcvH : null
  e.stow_uph         = e.stow_hours > 0 ? e.stow_units / e.stow_hours : null
  return e
}

const safe = async (res, fn) => {
  try { await fn() }
  catch (err) {
    if (err.code === '42P01') return res.json([])
    console.error('[inbound]', err.message)
    res.status(500).json({ error: err.message })
  }
}

// GET /api/inbound/entries
router.get('/entries', (req, res) => safe(res, async () => {
  if (isDemo(req)) {
    const { week, year, shift } = req.query
    let rows = DEMO_ENTRIES
    if (week)  rows = rows.filter(e => e.week_number === parseInt(week))
    if (year)  rows = rows.filter(e => e.year === parseInt(year))
    if (shift) rows = rows.filter(e => e.shift === shift)
    return res.json(rows.sort((a,b)=>a.entry_date.localeCompare(b.entry_date)||(a.shift==='day'?-1:1)).map(derive))
  }
  const { week, year, shift } = req.query
  const conditions = [], params = []
  if (week)  { params.push(week);  conditions.push(`week_number = $${params.length}`) }
  if (year)  { params.push(year);  conditions.push(`year = $${params.length}`) }
  if (shift) { params.push(shift); conditions.push(`shift = $${params.length}`) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const { rows } = await pool.query(
    `SELECT * FROM inbound_entries ${where} ORDER BY entry_date ASC, shift ASC`, params
  )
  res.json(rows.map(derive))
}))

// POST /api/inbound/entries (upsert)
router.post('/entries', (req, res) => safe(res, async () => {
  const {
    entry_date, shift, week_number, year,
    parcel_units=0, parcel_hours=0, vendor_units=0, vendor_hours=0,
    transfer_units=0, transfer_hours=0, stow_units=0, stow_hours=0,
    backlog_rcv_total=0, notes='',
  } = req.body
  const { rows } = await pool.query(`
    INSERT INTO inbound_entries
      (entry_date,shift,week_number,year,parcel_units,parcel_hours,vendor_units,vendor_hours,
       transfer_units,transfer_hours,stow_units,stow_hours,backlog_rcv_total,notes,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
    ON CONFLICT (entry_date,shift) DO UPDATE SET
      week_number=$3,year=$4,parcel_units=$5,parcel_hours=$6,vendor_units=$7,vendor_hours=$8,
      transfer_units=$9,transfer_hours=$10,stow_units=$11,stow_hours=$12,
      backlog_rcv_total=$13,notes=$14,updated_at=NOW()
    RETURNING *`,
    [entry_date,shift,week_number,year,parcel_units,parcel_hours,vendor_units,vendor_hours,
     transfer_units,transfer_hours,stow_units,stow_hours,backlog_rcv_total,notes]
  )
  res.json(derive(rows[0]))
}))

// PUT /api/inbound/entries/:id
router.put('/entries/:id', (req, res) => safe(res, async () => {
  const {
    parcel_units=0, parcel_hours=0, vendor_units=0, vendor_hours=0,
    transfer_units=0, transfer_hours=0, stow_units=0, stow_hours=0,
    backlog_rcv_total=0, notes='',
  } = req.body
  const { rows } = await pool.query(`
    UPDATE inbound_entries SET
      parcel_units=$1,parcel_hours=$2,vendor_units=$3,vendor_hours=$4,
      transfer_units=$5,transfer_hours=$6,stow_units=$7,stow_hours=$8,
      backlog_rcv_total=$9,notes=$10,updated_at=NOW()
    WHERE id=$11 RETURNING *`,
    [parcel_units,parcel_hours,vendor_units,vendor_hours,
     transfer_units,transfer_hours,stow_units,stow_hours,
     backlog_rcv_total,notes,req.params.id]
  )
  res.json(derive(rows[0]))
}))

// DELETE /api/inbound/entries/:id
router.delete('/entries/:id', (req, res) => safe(res, async () => {
  await pool.query('DELETE FROM inbound_entries WHERE id=$1', [req.params.id])
  res.json({ success: true })
}))

// GET /api/inbound/targets
router.get('/targets', (req, res) => safe(res, async () => {
  if (isDemo(req)) return res.json(DEMO_TARGETS)
  const { rows } = await pool.query('SELECT metric_key, target_value FROM inbound_targets')
  res.json(Object.fromEntries(rows.map(r => [r.metric_key, parseFloat(r.target_value)])))
}))

// POST /api/inbound/targets
router.post('/targets', (req, res) => safe(res, async () => {
  const { metric_key, target_value } = req.body
  const { rows } = await pool.query(`
    INSERT INTO inbound_targets (metric_key,target_value,updated_at) VALUES ($1,$2,NOW())
    ON CONFLICT (metric_key) DO UPDATE SET target_value=$2,updated_at=NOW() RETURNING *`,
    [metric_key, target_value]
  )
  res.json(rows[0])
}))

// GET /api/inbound/weeks
router.get('/weeks', (req, res) => safe(res, async () => {
  if (isDemo(req)) {
    const weeks = [...new Map(DEMO_ENTRIES.map(e=>[`${e.year}-${e.week_number}`,{week_number:e.week_number,year:e.year}])).values()]
    return res.json(weeks.sort((a,b)=>b.year-a.year||b.week_number-a.week_number))
  }
  const { rows } = await pool.query(
    'SELECT DISTINCT week_number, year FROM inbound_entries ORDER BY year DESC, week_number DESC LIMIT 52'
  )
  res.json(rows)
}))

export default router
