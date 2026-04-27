import express from 'express'
import pool from '../db.js'

const router = express.Router()

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
  const { rows } = await pool.query(
    'SELECT DISTINCT week_number, year FROM inbound_entries ORDER BY year DESC, week_number DESC LIMIT 52'
  )
  res.json(rows)
}))

export default router
