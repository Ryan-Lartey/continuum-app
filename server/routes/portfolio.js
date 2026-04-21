import { Router } from 'express'
import pool from '../db.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM portfolios ORDER BY updated_at DESC`)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM portfolios WHERE id = $1`, [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id/summary', async (req, res) => {
  try {
    const id = req.params.id
    const { rows: ideas }    = await pool.query(`SELECT * FROM ideas WHERE portfolio_id = $1`, [id])
    const { rows: projects } = await pool.query(`SELECT * FROM projects WHERE portfolio_id = $1`, [id])

    const ideaCount       = ideas.filter(i => i.pipeline_stage === 'idea').length
    const definitionCount = ideas.filter(i => i.pipeline_stage === 'definition').length
    const validationCount = ideas.filter(i => i.pipeline_stage === 'validation').length
    const assignedCount   = projects.filter(p => p.stage !== 'Closed').length
    const finishedCount   = projects.filter(p => p.stage === 'Closed').length
    const pendingIdeas    = ideas.filter(i =>
      ['idea', 'definition', 'validation'].includes(i.pipeline_stage) && i.eval_status === 'pending'
    ).length

    res.json({ ideaCount, definitionCount, validationCount, assignedCount, finishedCount, pendingIdeas, totalIdeas: ideas.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { name, strategic_objective, primary_kpi, impact_goal, impact_unit, area_focus } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    const { rows: [inserted] } = await pool.query(
      `INSERT INTO portfolios (name, strategic_objective, primary_kpi, impact_goal, impact_unit, area_focus)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, strategic_objective || '', primary_kpi || 'uph', impact_goal || 0, impact_unit || 'UPH improvement', area_focus || 'All']
    )
    res.json(inserted)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { rows: existing } = await pool.query(`SELECT * FROM portfolios WHERE id = $1`, [req.params.id])
    if (!existing[0]) return res.status(404).json({ error: 'Not found' })

    const fields = ['name', 'strategic_objective', 'primary_kpi', 'impact_goal', 'impact_unit', 'area_focus', 'status']
    const sets = []
    const vals = []
    let idx = 1

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        sets.push(`${f} = $${idx++}`)
        vals.push(req.body[f])
      }
    }
    if (!sets.length) return res.json(existing[0])

    sets.push(`updated_at = NOW()`)
    vals.push(req.params.id)

    await pool.query(`UPDATE portfolios SET ${sets.join(', ')} WHERE id = $${idx}`, vals)
    const { rows } = await pool.query(`SELECT * FROM portfolios WHERE id = $1`, [req.params.id])
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM portfolios WHERE id = $1`, [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
