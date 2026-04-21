import { Router } from 'express'
import pool from '../db.js'

const router = Router()

function parseMap(m) {
  return {
    ...m,
    swimlanes: JSON.parse(m.swimlanes || '[]'),
    nodes: JSON.parse(m.nodes || '[]'),
    edges: JSON.parse(m.edges || '[]'),
  }
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM process_maps ORDER BY updated_at DESC`)
    res.json(rows.map(parseMap))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { title, description, project_id, portfolio_id, swimlanes, nodes, edges } = req.body
    if (!title) return res.status(400).json({ error: 'title required' })
    const { rows: [inserted] } = await pool.query(
      `INSERT INTO process_maps (title, description, project_id, portfolio_id, swimlanes, nodes, edges)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [title, description || '', project_id || null, portfolio_id || null,
       JSON.stringify(swimlanes || []), JSON.stringify(nodes || []), JSON.stringify(edges || [])]
    )
    res.json(parseMap(inserted))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM process_maps WHERE id=$1`, [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'not found' })
    res.json(parseMap(rows[0]))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { title, description, project_id, portfolio_id, swimlanes, nodes, edges } = req.body
    await pool.query(
      `UPDATE process_maps SET title=$1, description=$2, project_id=$3, portfolio_id=$4,
       swimlanes=$5, nodes=$6, edges=$7, updated_at=NOW() WHERE id=$8`,
      [title || '', description || '', project_id || null, portfolio_id || null,
       JSON.stringify(swimlanes || []), JSON.stringify(nodes || []), JSON.stringify(edges || []),
       req.params.id]
    )
    const { rows } = await pool.query(`SELECT * FROM process_maps WHERE id=$1`, [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'not found' })
    res.json(parseMap(rows[0]))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM process_maps WHERE id=$1`, [req.params.id])
    res.json({ deleted: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
