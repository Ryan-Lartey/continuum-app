import { Router } from 'express'
import pool from '../db.js'

const router = Router()

const METRIC_LABELS = {
  uph: 'UPH',
  accuracy: 'Pick Accuracy',
  dpmo: 'DPMO',
  dts: 'DTS'
}

const METRIC_TARGETS = {
  uph: 100,
  accuracy: 99.5,
  dpmo: 500,
  dts: 98
}

function detectSignals(values) {
  if (values.length < 4) return values.map(() => false)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const movingRanges = values.slice(1).map((v, i) => Math.abs(v - values[i]))
  const rBar = movingRanges.reduce((a, b) => a + b, 0) / movingRanges.length
  const sigma = rBar / 1.128
  const ucl = mean + 3 * sigma
  const lcl = mean - 3 * sigma
  const signals = values.map(v => v > ucl || v < lcl)
  for (let i = 7; i < values.length; i++) {
    const window = values.slice(i - 7, i + 1)
    const allAbove = window.every(v => v > mean)
    const allBelow = window.every(v => v < mean)
    if (allAbove || allBelow) {
      for (let j = i - 7; j <= i; j++) signals[j] = true
    }
  }
  return signals
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM kpi_data ORDER BY date DESC, created_at DESC`)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/latest', async (req, res) => {
  try {
    const metrics = ['uph', 'accuracy', 'dpmo', 'dts']
    const result = {}
    for (const m of metrics) {
      const { rows } = await pool.query(
        `SELECT * FROM kpi_data WHERE metric_id = $1 ORDER BY date DESC, created_at DESC LIMIT 1`,
        [m]
      )
      result[m] = rows[0] || null
    }
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/metric/:metricId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM kpi_data WHERE metric_id = $1 ORDER BY date ASC`,
      [req.params.metricId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const entries = Array.isArray(req.body) ? req.body : [req.body]
    const results = []

    for (const entry of entries) {
      const { metric_id, value, date, shift, annotation } = entry
      if (!metric_id || value === undefined || !date) {
        return res.status(400).json({ error: 'metric_id, value, date required' })
      }

      const label = METRIC_LABELS[metric_id] || metric_id
      const target = METRIC_TARGETS[metric_id] || null

      const { rows: existing } = await pool.query(
        `SELECT value FROM kpi_data WHERE metric_id = $1 ORDER BY date ASC`,
        [metric_id]
      )
      const allVals = [...existing.map(r => r.value), parseFloat(value)]
      const signals = detectSignals(allVals)
      const signal = signals[signals.length - 1] ? 1 : 0

      const { rows: [inserted] } = await pool.query(
        `INSERT INTO kpi_data (metric_id, metric_label, value, target, date, shift, signal, annotation)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [metric_id, label, parseFloat(value), target, date, shift || null, signal, annotation || null]
      )
      results.push(inserted)
    }

    res.json(results.length === 1 ? results[0] : results)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
