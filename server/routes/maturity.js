import { Router } from 'express'
import pool from '../db.js'

const router = Router()

async function autoScore() {
  const { rows: projects }  = await pool.query(`SELECT * FROM projects`)
  const { rows: obs }       = await pool.query(`SELECT * FROM observations ORDER BY created_at DESC LIMIT 200`)
  const { rows: kpi }       = await pool.query(`SELECT * FROM kpi_data ORDER BY date DESC LIMIT 100`)

  const recentObs = obs.filter(o => {
    const d = new Date(o.created_at)
    return (Date.now() - d.getTime()) < 30 * 24 * 60 * 60 * 1000
  })

  const closedProjects  = projects.filter(p => p.stage === 'Closed' || p.stage === 'Control')
  const sopCount        = projects.filter(p => { try { return JSON.parse(p.charter || '{}').sop } catch { return false } }).length
  const trainedCount    = projects.filter(p => { try { return JSON.parse(p.charter || '{}').trainingNote } catch { return false } }).length
  const charterCount    = projects.filter(p => { try { const c = JSON.parse(p.charter || '{}'); return c.businessCase && c.scopeIn } catch { return false } }).length

  const five_s          = Math.min(5, 1 + Math.floor(recentObs.length / 3))
  const dmaic           = Math.min(5, 1 + charterCount + Math.floor(closedProjects.length / 2))
  const standard_work   = Math.min(5, 1 + sopCount + trainedCount)
  const visual_mgmt     = Math.min(5, 1 + Math.floor(kpi.length / 10) + (recentObs.length > 5 ? 1 : 0))
  const problem_solving = Math.min(5, 1 + Math.floor(projects.length / 2) + closedProjects.length)

  return { five_s, dmaic, standard_work, visual_mgmt, problem_solving }
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM maturity_scores ORDER BY month DESC LIMIT 12`)
    const auto = await autoScore()
    res.json({ history: rows, auto })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { month, five_s, dmaic, standard_work, visual_mgmt, problem_solving, notes } = req.body
    const m = month || new Date().toISOString().slice(0, 7)
    await pool.query(
      `INSERT INTO maturity_scores (month, five_s, dmaic, standard_work, visual_mgmt, problem_solving, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT(month) DO UPDATE SET
         five_s=EXCLUDED.five_s, dmaic=EXCLUDED.dmaic,
         standard_work=EXCLUDED.standard_work, visual_mgmt=EXCLUDED.visual_mgmt,
         problem_solving=EXCLUDED.problem_solving, notes=EXCLUDED.notes`,
      [m, five_s, dmaic, standard_work, visual_mgmt, problem_solving, notes || '']
    )
    const { rows } = await pool.query(`SELECT * FROM maturity_scores WHERE month = $1`, [m])
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
