import express from 'express'
import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config()
import { setDemoMode, getDemoMode } from '../db.js'

const router = express.Router()

router.get('/status', (req, res) => {
  res.json({ demoMode: getDemoMode() })
})

router.post('/toggle', (req, res) => {
  const next = !getDemoMode()
  setDemoMode(next)
  console.log(`[Demo] Mode ${next ? 'ON' : 'OFF'}`)
  res.json({ demoMode: next })
})

// Debug: check demo schema data and current mode
router.get('/debug', async (req, res) => {
  const ssl = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl })
  const client = await pool.connect()
  try {
    await client.query('SET search_path TO demo')
    const { rows: kpiRows } = await client.query('SELECT COUNT(*) as count FROM kpi_data')
    const { rows: siteRows } = await client.query('SELECT * FROM site_profile LIMIT 1')
    const { rows: sample } = await client.query('SELECT metric_id, value, date FROM kpi_data ORDER BY date DESC LIMIT 5')
    res.json({
      serverDemoMode: getDemoMode(),
      demoKpiCount: kpiRows[0]?.count,
      demoSiteProfile: siteRows[0] || null,
      sampleRows: sample
    })
  } catch (err) {
    res.json({ error: err.message, serverDemoMode: getDemoMode() })
  } finally {
    client.release()
    await pool.end()
  }
})

export default router
