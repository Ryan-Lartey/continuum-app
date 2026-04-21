import { Router } from 'express'
import pool from '../db.js'

const router = Router()

function parseMap(m) {
  return { ...m, data: JSON.parse(m.data || '[]') }
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM standalone_maps ORDER BY updated_at DESC`)
    res.json(rows.map(parseMap))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { title, area, map_type, description, data } = req.body
    if (!title) return res.status(400).json({ error: 'title required' })
    const { rows: [inserted] } = await pool.query(
      `INSERT INTO standalone_maps (title, area, map_type, description, data) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [title, area || '', map_type || 'current', description || '', JSON.stringify(data || [])]
    )
    res.json(parseMap(inserted))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { title, area, map_type, description, data } = req.body
    await pool.query(
      `UPDATE standalone_maps SET title=$1, area=$2, map_type=$3, description=$4, data=$5, updated_at=NOW() WHERE id=$6`,
      [title, area || '', map_type || 'current', description || '', JSON.stringify(data || []), req.params.id]
    )
    const { rows } = await pool.query(`SELECT * FROM standalone_maps WHERE id=$1`, [req.params.id])
    res.json(parseMap(rows[0]))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM standalone_maps WHERE id=$1`, [req.params.id])
    res.json({ deleted: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
