import { Router } from 'express'
import pool from '../db.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { portfolio_id, stage } = req.query
    let query = `SELECT * FROM ideas WHERE 1=1`
    const vals = []
    let idx = 1

    if (portfolio_id) { query += ` AND portfolio_id = $${idx++}`; vals.push(portfolio_id) }
    if (stage)        { query += ` AND pipeline_stage = $${idx++}`; vals.push(stage) }
    query += ` ORDER BY created_at DESC`

    const { rows } = await pool.query(query, vals)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ideas WHERE id = $1`, [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { portfolio_id, title, description, area, waste_type, source, impact, difficulty, notes } = req.body
    if (!title) return res.status(400).json({ error: 'title required' })

    const { rows: [inserted] } = await pool.query(
      `INSERT INTO ideas (portfolio_id, title, description, area, waste_type, source, impact, difficulty, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [portfolio_id || null, title, description || '', area || '', waste_type || '',
       source || 'manual', impact || 'medium', difficulty || 'standard', notes || '']
    )
    res.json(inserted)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { rows: existing } = await pool.query(`SELECT * FROM ideas WHERE id = $1`, [req.params.id])
    if (!existing[0]) return res.status(404).json({ error: 'Not found' })

    const fields = ['title','description','area','waste_type','source','pipeline_stage','eval_status',
                    'impact','difficulty','metric_id','baseline','target_value','estimated_weeks',
                    'project_id','kpi_achieved','date_finished','notes','project_type']
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

    await pool.query(`UPDATE ideas SET ${sets.join(', ')} WHERE id = $${idx}`, vals)
    const { rows } = await pool.query(`SELECT * FROM ideas WHERE id = $1`, [req.params.id])
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/:id/create-project', async (req, res) => {
  try {
    const { rows: ideaRows } = await pool.query(`SELECT * FROM ideas WHERE id = $1`, [req.params.id])
    const idea = ideaRows[0]
    if (!idea) return res.status(404).json({ error: 'Not found' })

    const { rows: [proj] } = await pool.query(`
      INSERT INTO projects (title, problem_statement, metric_id, baseline, target_value, stage, portfolio_id, idea_id, project_type)
      VALUES ($1, $2, $3, $4, $5, 'Define', $6, $7, $8) RETURNING id
    `, [
      idea.title, idea.description || '', idea.metric_id || null,
      idea.baseline || null, idea.target_value || null,
      idea.portfolio_id, idea.id, idea.project_type || null
    ])

    const { rows: projectRows } = await pool.query(`SELECT * FROM projects WHERE id = $1`, [proj.id])
    const project = projectRows[0]
    const parsed = {
      ...project,
      charter: JSON.parse(project.charter || '{}'),
      actions: JSON.parse(project.actions || '[]'),
      maps: JSON.parse(project.maps || '[]'),
      stage_checklist: JSON.parse(project.stage_checklist || '{}'),
    }

    await pool.query(
      `UPDATE ideas SET pipeline_stage = 'assigned', project_id = $1, updated_at = NOW() WHERE id = $2`,
      [proj.id, idea.id]
    )

    const { rows: updatedIdea } = await pool.query(`SELECT * FROM ideas WHERE id = $1`, [idea.id])
    res.json({ project: parsed, idea: updatedIdea[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM ideas WHERE id = $1`, [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
