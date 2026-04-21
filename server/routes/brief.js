import { Router } from 'express'
import pool from '../db.js'

const router = Router()

router.get('/latest', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM briefs ORDER BY created_at DESC LIMIT 1`)
    res.json(rows[0] || null)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/weekly', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM briefs WHERE type = 'weekly' ORDER BY created_at DESC LIMIT 1`)
    res.json(rows[0] || null)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { date, content, type } = req.body
    if (!content) return res.status(400).json({ error: 'content required' })
    const d = date || new Date().toISOString().split('T')[0]
    const { rows: [inserted] } = await pool.query(
      `INSERT INTO briefs (date, content, type) VALUES ($1, $2, $3) RETURNING *`,
      [d, content, type || 'morning']
    )
    res.json(inserted)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
