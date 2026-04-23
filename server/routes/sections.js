import express from 'express'
import pool from '../db.js'

const router = express.Router()

const SECTIONS = [
  { id: 'inbound',  label: 'Inbound',  order: 1 },
  { id: 'icqa',     label: 'ICQA',     order: 2 },
  { id: 'pick',     label: 'Pick',     order: 3 },
  { id: 'pack',     label: 'Pack',     order: 4 },
  { id: 'outbound', label: 'Outbound', order: 5 },
]

// GET /api/sections — all 5 sections with their most recent health score
router.get('/', async (req, res) => {

  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (shs.section_id)
        shs.section_id,
        shs.score,
        shs.status,
        s.date,
        s.shift_type
      FROM section_health_scores shs
      JOIN shifts s ON s.id = shs.shift_id
      ORDER BY shs.section_id, s.date DESC, s.shift_type DESC
    `)

    const scoreMap = Object.fromEntries(rows.map(r => [r.section_id, r]))

    const result = SECTIONS.map(s => ({
      ...s,
      score: scoreMap[s.id]?.score ?? null,
      score_status: scoreMap[s.id]?.status ?? 'no_data',
      last_shift: scoreMap[s.id]
        ? { date: scoreMap[s.id].date, shift_type: scoreMap[s.id].shift_type }
        : null,
    }))

    res.json(result)
  } catch (err) {
    console.error('sections GET error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/sections/:sectionId/metrics — metrics configured for a section
router.get('/:sectionId/metrics', async (req, res) => {

  try {
    const { rows } = await pool.query(
      `SELECT * FROM section_metrics WHERE section_id = $1 AND active = true ORDER BY id`,
      [req.params.sectionId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/sections/metrics — add a metric to a section
router.post('/metrics', async (req, res) => {

  const { section_id, name, metric_key, target, direction, severity_weight, unit } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO section_metrics (section_id, name, metric_key, target, direction, severity_weight, unit)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [section_id, name, metric_key, target, direction, severity_weight ?? 5, unit ?? '']
    )
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/sections/metrics/:id — update a metric
router.put('/metrics/:id', async (req, res) => {

  const { name, target, direction, severity_weight, unit, active } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE section_metrics SET name=$1, target=$2, direction=$3, severity_weight=$4, unit=$5, active=$6
       WHERE id=$7 RETURNING *`,
      [name, target, direction, severity_weight, unit, active ?? true, req.params.id]
    )
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/sections/shifts — create or get today's shift
router.post('/shifts', async (req, res) => {

  const { date, shift_type } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO shifts (date, shift_type) VALUES ($1, $2)
       ON CONFLICT (date, shift_type) DO UPDATE SET date = EXCLUDED.date
       RETURNING *`,
      [date, shift_type]
    )
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/sections/shifts/:shiftId/scores — calculate + store health scores for a shift
router.post('/shifts/:shiftId/scores', async (req, res) => {

  const shiftId = parseInt(req.params.shiftId)
  // entries: [{ metric_id, actual_value }]
  const { entries } = req.body

  try {
    // Load metrics for the entries
    const metricIds = entries.map(e => e.metric_id)
    const { rows: metrics } = await pool.query(
      `SELECT * FROM section_metrics WHERE id = ANY($1)`,
      [metricIds]
    )
    const metricMap = Object.fromEntries(metrics.map(m => [m.id, m]))

    // Calculate metric scores and upsert entries
    for (const entry of entries) {
      const m = metricMap[entry.metric_id]
      if (!m) continue
      let score
      if (m.direction === 'higher') {
        score = Math.min((entry.actual_value / m.target) * 100, 100)
      } else {
        score = entry.actual_value === 0 ? 100 : Math.min((m.target / entry.actual_value) * 100, 100)
      }
      score = Math.max(score, 0)

      await pool.query(
        `INSERT INTO metric_entries (shift_id, metric_id, actual_value, metric_score)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (shift_id, metric_id) DO UPDATE SET actual_value=$3, metric_score=$4`,
        [shiftId, m.id, entry.actual_value, parseFloat(score.toFixed(2))]
      )
    }

    // Group by section and calculate weighted health scores
    const sectionIds = [...new Set(metrics.map(m => m.section_id))]
    const scores = []

    for (const sectionId of sectionIds) {
      const sectionMetrics = metrics.filter(m => m.section_id === sectionId)
      const sectionEntries = entries.filter(e => sectionMetrics.some(m => m.id === e.metric_id))

      if (!sectionEntries.length) continue

      let weightedSum = 0
      let totalWeight = 0
      let allPresent = true

      for (const sm of sectionMetrics) {
        const entry = sectionEntries.find(e => e.metric_id === sm.id)
        if (!entry) { allPresent = false; continue }

        let score
        if (sm.direction === 'higher') {
          score = Math.min((entry.actual_value / sm.target) * 100, 100)
        } else {
          score = entry.actual_value === 0 ? 100 : Math.min((sm.target / entry.actual_value) * 100, 100)
        }
        score = Math.max(score, 0)
        weightedSum += score * sm.severity_weight
        totalWeight += sm.severity_weight
      }

      const sectionScore = totalWeight > 0
        ? parseFloat((weightedSum / totalWeight).toFixed(1))
        : null

      const status = allPresent ? 'complete' : 'incomplete'

      await pool.query(
        `INSERT INTO section_health_scores (shift_id, section_id, score, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (shift_id, section_id) DO UPDATE SET score=$3, status=$4`,
        [shiftId, sectionId, sectionScore, status]
      )

      scores.push({ section_id: sectionId, score: sectionScore, status })
    }

    res.json({ shift_id: shiftId, scores })
  } catch (err) {
    console.error('score calculation error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
