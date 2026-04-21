import { Router } from 'express'
import pool from '../db.js'

const router = Router()

function safeParse(val, fallback) {
  try {
    const parsed = JSON.parse(val || JSON.stringify(fallback))
    if (typeof parsed === 'string') return JSON.parse(parsed)
    return parsed
  } catch { return fallback }
}

function parseProject(p) {
  return {
    ...p,
    charter: safeParse(p.charter, {}),
    actions: safeParse(p.actions, []),
    maps: safeParse(p.maps, []),
    stage_checklist: safeParse(p.stage_checklist, {}),
  }
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, po.name as portfolio_name
      FROM projects p
      LEFT JOIN portfolios po ON p.portfolio_id = po.id
      ORDER BY p.updated_at DESC
    `)
    res.json(rows.map(parseProject))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, po.name as portfolio_name
      FROM projects p
      LEFT JOIN portfolios po ON p.portfolio_id = po.id
      WHERE p.id = $1
    `, [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    res.json(parseProject(rows[0]))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { title, problem_statement, metric_id, baseline, target_value, portfolio_id, charter, project_type } = req.body
    if (!title) return res.status(400).json({ error: 'title required' })

    const initChecklist = JSON.stringify({ currentTool: 'charter' })
    const initCharter = JSON.stringify(charter || {})

    const { rows: [inserted] } = await pool.query(`
      INSERT INTO projects (title, problem_statement, metric_id, baseline, target_value, portfolio_id, stage, charter, stage_checklist, project_type)
      VALUES ($1, $2, $3, $4, $5, $6, 'Define', $7, $8, $9) RETURNING id
    `, [
      title, problem_statement || '', metric_id || null,
      baseline != null ? parseFloat(baseline) : null,
      target_value != null ? parseFloat(target_value) : null,
      portfolio_id || null, initCharter, initChecklist, project_type || null
    ])

    const { rows } = await pool.query(`
      SELECT p.*, po.name as portfolio_name FROM projects p
      LEFT JOIN portfolios po ON p.portfolio_id = po.id WHERE p.id = $1
    `, [inserted.id])
    res.json(parseProject(rows[0]))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { rows: existing } = await pool.query(`SELECT * FROM projects WHERE id = $1`, [req.params.id])
    if (!existing[0]) return res.status(404).json({ error: 'Not found' })

    const updates = req.body
    const fields = ['title', 'stage', 'metric_id', 'baseline', 'target_value', 'problem_statement', 'notes']
    const jsonFields = ['charter', 'actions', 'maps', 'stage_checklist']

    const sets = []
    const vals = []
    let idx = 1

    for (const f of fields) {
      if (updates[f] !== undefined) {
        sets.push(`${f} = $${idx++}`)
        vals.push(updates[f])
      }
    }
    for (const f of jsonFields) {
      if (updates[f] !== undefined) {
        sets.push(`${f} = $${idx++}`)
        vals.push(JSON.stringify(updates[f]))
      }
    }

    sets.push(`updated_at = NOW()`)
    vals.push(req.params.id)

    await pool.query(`UPDATE projects SET ${sets.join(', ')} WHERE id = $${idx}`, vals)

    const { rows } = await pool.query(`SELECT * FROM projects WHERE id = $1`, [req.params.id])
    res.json(parseProject(rows[0]))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id FROM projects WHERE id = $1`, [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    await pool.query(`DELETE FROM projects WHERE id = $1`, [req.params.id])
    res.json({ deleted: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id/exit-criteria', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM projects WHERE id = $1`, [req.params.id])
    const project = rows[0]
    if (!project) return res.status(404).json({ error: 'Not found' })

    const charter = JSON.parse(project.charter || '{}')
    const actions = JSON.parse(project.actions || '[]')

    let baselineDataPoints = 0
    let distinctDates = 0
    if (project.metric_id) {
      const { rows: dateRows } = await pool.query(
        `SELECT DISTINCT date FROM kpi_data WHERE metric_id = $1`, [project.metric_id]
      )
      distinctDates = dateRows.length
      const { rows: [cnt] } = await pool.query(
        `SELECT COUNT(*) as c FROM kpi_data WHERE metric_id = $1`, [project.metric_id]
      )
      baselineDataPoints = parseInt(cnt.c)
    }

    const criteria = {
      Identify: {
        problem_statement: { label: 'Problem statement written (20+ chars)', met: (project.problem_statement || '').length >= 20 },
        baseline_data: { label: 'Baseline metric selected', met: !!project.metric_id },
      },
      Define: {
        charter_complete: { label: 'Business case written', met: !!charter.businessCase },
        scope_defined: { label: 'Scope defined (in & out)', met: !!(charter.scopeIn && charter.scopeOut) },
        problem_statement: { label: 'Problem statement written (20+ chars)', met: (project.problem_statement || '').length >= 20 },
      },
      Measure: {
        baseline_data: { label: 'Baseline data collected (2+ weeks, 14+ data points)', met: distinctDates >= 14 },
        control_limits: { label: 'Enough data for control limits (4+ points)', met: baselineDataPoints >= 4 },
      },
      Analyse: {
        root_cause: { label: 'Root cause identified (notes contain ROOT CAUSE:)', met: (project.notes || '').includes('ROOT CAUSE:') },
        baseline_data: { label: '14+ data points collected', met: distinctDates >= 14 },
      },
      Improve: {
        countermeasures: { label: 'Countermeasures actioned (1+ actions)', met: actions.length > 0 },
        root_cause: { label: 'Root cause documented', met: (project.notes || '').includes('ROOT CAUSE:') },
      },
      Control: {
        sop: { label: 'SOP written', met: !!charter.sop },
        training: { label: 'Team trained', met: !!charter.trainingNote },
        countermeasures: { label: 'Actions completed', met: actions.length > 0 && actions.every(a => a.done) },
      },
    }

    const stageCriteria = criteria[project.stage] || {}
    const allMet = Object.values(stageCriteria).every(c => c.met)

    res.json({ criteria: stageCriteria, allMet, stage: project.stage })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
