import { Router } from 'express'
import pool from '../db.js'

const router = Router()

const DEFAULT_STEPS = [
  { id: 1, label: 'Morning brief read', done: false },
  { id: 2, label: 'KPIs logged', done: false },
  { id: 3, label: 'Floor walk done', done: false },
  { id: 4, label: 'Meeting prepped', done: false },
  { id: 5, label: 'Project progressed', done: false },
  { id: 6, label: 'Day wrapped up', done: false },
]

router.get('/:date', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM flow_progress WHERE date = $1`, [req.params.date])
    if (!rows[0]) {
      return res.json({ date: req.params.date, steps: DEFAULT_STEPS })
    }
    res.json({ date: rows[0].date, steps: JSON.parse(rows[0].steps) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:date', async (req, res) => {
  try {
    const { steps } = req.body
    await pool.query(
      `INSERT INTO flow_progress (date, steps) VALUES ($1, $2)
       ON CONFLICT(date) DO UPDATE SET steps = EXCLUDED.steps`,
      [req.params.date, JSON.stringify(steps)]
    )
    res.json({ date: req.params.date, steps })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
