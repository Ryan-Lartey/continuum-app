import express from 'express'
import pool from '../db.js'

const router = express.Router()

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_ENTRIES = [
  // W18 2026 (Apr 27 – current week)
  { id:2001, entry_date:'2026-04-27', shift:'day',   week_number:18, year:2026, parcel_units:1200, parcel_hours:11,   vendor_units:810,  vendor_hours:3,   transfer_units:295, transfer_hours:2.5, stow_units:1800, stow_hours:11.5, backlog_rcv_total:220, notes:'' },
  // W17 2026 (Apr 20–26)
  { id:2002, entry_date:'2026-04-21', shift:'day',   week_number:17, year:2026, parcel_units:1150, parcel_hours:10.5, vendor_units:780,  vendor_hours:3,   transfer_units:280, transfer_hours:2.5, stow_units:1750, stow_hours:11,   backlog_rcv_total:380, notes:'' },
  { id:2003, entry_date:'2026-04-21', shift:'night', week_number:17, year:2026, parcel_units:820,  parcel_hours:8,    vendor_units:380,  vendor_hours:1.5, transfer_units:180, transfer_hours:1.5, stow_units:1100, stow_hours:8,    backlog_rcv_total:290, notes:'' },
  { id:2004, entry_date:'2026-04-22', shift:'day',   week_number:17, year:2026, parcel_units:1220, parcel_hours:11,   vendor_units:820,  vendor_hours:3,   transfer_units:310, transfer_hours:2.5, stow_units:1820, stow_hours:11.5, backlog_rcv_total:340, notes:'' },
  { id:2005, entry_date:'2026-04-22', shift:'night', week_number:17, year:2026, parcel_units:790,  parcel_hours:7.5,  vendor_units:420,  vendor_hours:1.5, transfer_units:210, transfer_hours:2,   stow_units:1150, stow_hours:8.5,  backlog_rcv_total:260, notes:'' },
  { id:2006, entry_date:'2026-04-23', shift:'day',   week_number:17, year:2026, parcel_units:1180, parcel_hours:10.5, vendor_units:850,  vendor_hours:3,   transfer_units:295, transfer_hours:2.5, stow_units:1780, stow_hours:11.5, backlog_rcv_total:310, notes:'' },
  { id:2007, entry_date:'2026-04-23', shift:'night', week_number:17, year:2026, parcel_units:850,  parcel_hours:8,    vendor_units:390,  vendor_hours:1.5, transfer_units:195, transfer_hours:1.5, stow_units:1200, stow_hours:8.5,  backlog_rcv_total:240, notes:'' },
  { id:2008, entry_date:'2026-04-24', shift:'day',   week_number:17, year:2026, parcel_units:1250, parcel_hours:11,   vendor_units:800,  vendor_hours:3,   transfer_units:320, transfer_hours:3,   stow_units:1850, stow_hours:12,   backlog_rcv_total:280, notes:'' },
  { id:2009, entry_date:'2026-04-24', shift:'night', week_number:17, year:2026, parcel_units:810,  parcel_hours:7.5,  vendor_units:410,  vendor_hours:1.5, transfer_units:200, transfer_hours:2,   stow_units:1180, stow_hours:8,    backlog_rcv_total:210, notes:'' },
  { id:2010, entry_date:'2026-04-25', shift:'day',   week_number:17, year:2026, parcel_units:1100, parcel_hours:10,   vendor_units:760,  vendor_hours:3,   transfer_units:270, transfer_hours:2.5, stow_units:1680, stow_hours:11,   backlog_rcv_total:250, notes:'Friday — lighter volume' },
  // W16 2026 (Apr 13–19)
  { id:2011, entry_date:'2026-04-14', shift:'day',   week_number:16, year:2026, parcel_units:1080, parcel_hours:10.5, vendor_units:740,  vendor_hours:3,   transfer_units:260, transfer_hours:2.5, stow_units:1620, stow_hours:11,   backlog_rcv_total:520, notes:'' },
  { id:2012, entry_date:'2026-04-14', shift:'night', week_number:16, year:2026, parcel_units:760,  parcel_hours:7.5,  vendor_units:350,  vendor_hours:1.5, transfer_units:160, transfer_hours:1.5, stow_units:1020, stow_hours:8,    backlog_rcv_total:430, notes:'' },
  { id:2013, entry_date:'2026-04-15', shift:'day',   week_number:16, year:2026, parcel_units:1120, parcel_hours:10.5, vendor_units:780,  vendor_hours:3,   transfer_units:275, transfer_hours:2.5, stow_units:1680, stow_hours:11,   backlog_rcv_total:470, notes:'' },
  { id:2014, entry_date:'2026-04-15', shift:'night', week_number:16, year:2026, parcel_units:800,  parcel_hours:8,    vendor_units:370,  vendor_hours:1.5, transfer_units:170, transfer_hours:1.5, stow_units:1080, stow_hours:8.5,  backlog_rcv_total:390, notes:'' },
  { id:2015, entry_date:'2026-04-16', shift:'day',   week_number:16, year:2026, parcel_units:1140, parcel_hours:10.5, vendor_units:790,  vendor_hours:3,   transfer_units:285, transfer_hours:2.5, stow_units:1700, stow_hours:11,   backlog_rcv_total:430, notes:'' },
  { id:2016, entry_date:'2026-04-16', shift:'night', week_number:16, year:2026, parcel_units:810,  parcel_hours:8,    vendor_units:380,  vendor_hours:1.5, transfer_units:175, transfer_hours:1.5, stow_units:1100, stow_hours:8.5,  backlog_rcv_total:360, notes:'' },
  { id:2017, entry_date:'2026-04-17', shift:'day',   week_number:16, year:2026, parcel_units:1160, parcel_hours:10.5, vendor_units:800,  vendor_hours:3,   transfer_units:290, transfer_hours:2.5, stow_units:1730, stow_hours:11.5, backlog_rcv_total:400, notes:'' },
  { id:2018, entry_date:'2026-04-17', shift:'night', week_number:16, year:2026, parcel_units:820,  parcel_hours:8,    vendor_units:390,  vendor_hours:1.5, transfer_units:185, transfer_hours:1.5, stow_units:1120, stow_hours:8.5,  backlog_rcv_total:330, notes:'' },
  { id:2019, entry_date:'2026-04-18', shift:'day',   week_number:16, year:2026, parcel_units:1090, parcel_hours:10,   vendor_units:760,  vendor_hours:3,   transfer_units:268, transfer_hours:2.5, stow_units:1640, stow_hours:11,   backlog_rcv_total:380, notes:'Friday' },
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
