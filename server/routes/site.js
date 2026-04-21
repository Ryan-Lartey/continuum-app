import { Router } from 'express'
import pool from '../db.js'

const router = Router()

function parseRow(row) {
  return {
    ...row,
    zones: JSON.parse(row.zones || '[]'),
    primary_kpis: JSON.parse(row.primary_kpis || '[]'),
    kpi_targets: JSON.parse(row.kpi_targets || '{"UPH":100,"Accuracy":99.5,"DPMO":500,"DTS":98}'),
  }
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM site_profile LIMIT 1`)
    if (!rows[0]) return res.json({})
    res.json(parseRow(rows[0]))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/', async (req, res) => {
  try {
    const { site_name, shift_pattern, kpi_targets } = req.body
    const { rows: existing } = await pool.query(`SELECT id FROM site_profile LIMIT 1`)
    if (!existing[0]) return res.status(404).json({ error: 'no site profile' })
    await pool.query(
      `UPDATE site_profile SET
        site_name = COALESCE($1, site_name),
        shift_pattern = COALESCE($2, shift_pattern),
        kpi_targets = COALESCE($3, kpi_targets)
       WHERE id = $4`,
      [site_name || null, shift_pattern || null, kpi_targets ? JSON.stringify(kpi_targets) : null, existing[0].id]
    )
    const { rows } = await pool.query(`SELECT * FROM site_profile LIMIT 1`)
    res.json(parseRow(rows[0]))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/', async (req, res) => {
  try {
    const { site_name, gm_name, zones, primary_kpis, user_name, site_notes } = req.body
    const { rows: existing } = await pool.query(`SELECT id FROM site_profile LIMIT 1`)

    if (existing[0]) {
      await pool.query(
        `UPDATE site_profile SET
          site_name = COALESCE($1, site_name),
          gm_name = COALESCE($2, gm_name),
          zones = COALESCE($3, zones),
          primary_kpis = COALESCE($4, primary_kpis),
          user_name = COALESCE($5, user_name),
          site_notes = COALESCE($6, site_notes)
         WHERE id = $7`,
        [
          site_name || null, gm_name || null,
          zones ? JSON.stringify(zones) : null,
          primary_kpis ? JSON.stringify(primary_kpis) : null,
          user_name || null,
          site_notes !== undefined ? site_notes : null,
          existing[0].id
        ]
      )
    } else {
      await pool.query(
        `INSERT INTO site_profile (site_name, gm_name, zones, primary_kpis, user_name, site_notes) VALUES ($1,$2,$3,$4,$5,$6)`,
        [site_name || 'Amazon FC', gm_name || '', JSON.stringify(zones || []), JSON.stringify(primary_kpis || []), user_name || 'Ryan', site_notes || '']
      )
    }

    const { rows } = await pool.query(`SELECT * FROM site_profile LIMIT 1`)
    res.json(parseRow(rows[0]))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/notes', async (req, res) => {
  try {
    const { note } = req.body
    if (!note) return res.status(400).json({ error: 'note required' })
    const { rows: existing } = await pool.query(`SELECT id, site_notes FROM site_profile LIMIT 1`)
    if (!existing[0]) return res.status(404).json({ error: 'no site profile' })
    const timestamp = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const newNotes = existing[0].site_notes
      ? `${existing[0].site_notes}\n\n[${timestamp}] ${note}`
      : `[${timestamp}] ${note}`
    await pool.query(`UPDATE site_profile SET site_notes = $1 WHERE id = $2`, [newNotes, existing[0].id])
    const { rows } = await pool.query(`SELECT * FROM site_profile LIMIT 1`)
    res.json(parseRow(rows[0]))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
