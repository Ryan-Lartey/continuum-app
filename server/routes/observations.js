import { Router } from 'express'
import pool from '../db.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM observations ORDER BY created_at DESC LIMIT 200`)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/patterns', async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { rows } = await pool.query(
      `SELECT waste_type, area, COUNT(*) as count
       FROM observations
       WHERE created_at >= $1
       GROUP BY waste_type, area
       HAVING COUNT(*) >= 3
       ORDER BY count DESC`,
      [cutoff]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { area, waste_type, severity, text, date } = req.body
    if (!area || !waste_type || !text || !date) {
      return res.status(400).json({ error: 'area, waste_type, text, date required' })
    }

    const timestamp = new Date().toISOString()
    const { rows: [inserted] } = await pool.query(
      `INSERT INTO observations (area, waste_type, severity, text, date, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [area, waste_type, parseInt(severity) || 1, text, date, timestamp]
    )

    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { rows: [pattern] } = await pool.query(
      `SELECT COUNT(*) as count FROM observations
       WHERE waste_type = $1 AND area = $2 AND created_at >= $3`,
      [waste_type, area, cutoff]
    )

    res.json({ ...inserted, patternCount: parseInt(pattern.count) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id FROM observations WHERE id = $1`, [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    await pool.query(`DELETE FROM observations WHERE id = $1`, [req.params.id])
    res.json({ deleted: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
