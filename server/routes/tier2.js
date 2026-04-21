import { Router } from 'express'
import pool from '../db.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM tier2_notes ORDER BY date DESC LIMIT 30`)
    res.json(rows.map(r => ({ ...r, actions: JSON.parse(r.actions || '[]') })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const { rows } = await pool.query(`SELECT * FROM tier2_notes WHERE date = $1`, [today])
    const row = rows[0]
    res.json(row ? { ...row, actions: JSON.parse(row.actions || '[]') } : null)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { date, notes, actions } = req.body
    const d = date || new Date().toISOString().split('T')[0]

    const { rows: existing } = await pool.query(`SELECT id FROM tier2_notes WHERE date = $1`, [d])
    if (existing[0]) {
      await pool.query(
        `UPDATE tier2_notes SET notes = $1, actions = $2 WHERE date = $3`,
        [notes || '', JSON.stringify(actions || []), d]
      )
    } else {
      await pool.query(
        `INSERT INTO tier2_notes (date, notes, actions) VALUES ($1, $2, $3)`,
        [d, notes || '', JSON.stringify(actions || [])]
      )
    }

    const { rows } = await pool.query(`SELECT * FROM tier2_notes WHERE date = $1`, [d])
    const row = rows[0]
    res.json({ ...row, actions: JSON.parse(row.actions || '[]') })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
