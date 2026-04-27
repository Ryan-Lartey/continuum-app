import dotenv from 'dotenv'
dotenv.config({ override: true })
import express from 'express'
import cors from 'cors'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import pool, { setDemoMode } from './db.js'
import kpiRoutes from './routes/kpi.js'
import obsRoutes from './routes/observations.js'
import projectRoutes from './routes/projects.js'
import flowRoutes from './routes/flow.js'
import briefRoutes from './routes/brief.js'
import siteRoutes from './routes/site.js'
import agentRoutes from './routes/agent.js'
import tier2Routes from './routes/tier2.js'
import maturityRoutes from './routes/maturity.js'
import portfolioRoutes from './routes/portfolio.js'
import ideasRoutes from './routes/ideas.js'
import swarmRoutes from './routes/swarm.js'
import mapsRouter from './routes/maps.js'
import demoRoutes from './routes/demo.js'
import processMapsRouter from './routes/process-maps.js'
import sectionsRouter from './routes/sections.js'
import inboundRouter from './routes/inbound.js'
import { startAutomation } from './automation.js'
import { runSync } from './services/sync.js'
import authRoutes from './routes/auth.js'
import { authMiddleware, requireAdmin } from './middleware/auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = process.env.SERVER_PORT || 3001

app.use(cors())
app.use(express.json())

// Set demo mode per-request from client header — survives server restarts
app.use((req, res, next) => {
  setDemoMode(req.headers['x-demo-mode'] === 'true')
  next()
})

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

// Auth — no token required
app.use('/api/auth', authRoutes)

// All other /api routes require a valid JWT
app.use('/api', authMiddleware)

app.use('/api/kpi', kpiRoutes)
app.use('/api/observations', obsRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/flow', flowRoutes)
app.use('/api/brief', briefRoutes)
app.use('/api/site', siteRoutes)
app.use('/api/agent', agentRoutes)
app.use('/api/tier2', tier2Routes)
app.use('/api/maturity', maturityRoutes)
app.use('/api/portfolios', portfolioRoutes)
app.use('/api/ideas', ideasRoutes)
app.use('/api/swarm', swarmRoutes)
app.use('/api/maps', mapsRouter)
app.use('/api/demo', demoRoutes)
app.use('/api/process-maps', processMapsRouter)
app.use('/api/sections', sectionsRouter)
app.use('/api/inbound', inboundRouter)

// Block write operations for viewer role on mutating routes
app.use('/api/kpi', (req, res, next) => {
  if (req.method !== 'GET' && req.user?.role !== 'admin') return res.status(403).json({ error: 'Read-only access' })
  next()
})
app.use('/api/observations', (req, res, next) => {
  if (req.method !== 'GET' && req.user?.role !== 'admin') return res.status(403).json({ error: 'Read-only access' })
  next()
})
app.use('/api/projects', (req, res, next) => {
  if (req.method !== 'GET' && req.user?.role !== 'admin') return res.status(403).json({ error: 'Read-only access' })
  next()
})
app.use('/api/portfolios', (req, res, next) => {
  if (req.method !== 'GET' && req.user?.role !== 'admin') return res.status(403).json({ error: 'Read-only access' })
  next()
})
app.use('/api/brief', (req, res, next) => {
  if (req.method !== 'GET' && req.user?.role !== 'admin') return res.status(403).json({ error: 'Read-only access' })
  next()
})
app.use('/api/inbound', (req, res, next) => {
  if (req.method !== 'GET' && req.user?.role !== 'admin') return res.status(403).json({ error: 'Read-only access' })
  next()
})

// ─── Excel sync routes ────────────────────────────────────────────────────────

app.post('/api/sync/excel', async (req, res) => {
  try {
    const result = await runSync()
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/sync/download', async (req, res) => {
  try {
    const { generateExcelWorkbook } = await import('./services/excel.js')
    const { buildSyncData } = await import('./services/sync.js')
    const data = await buildSyncData()
    const wb   = await generateExcelWorkbook(data)
    const buf  = await wb.xlsx.writeBuffer()
    const filename = `Continuum-CI-Report-${new Date().toISOString().slice(0,10)}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(Buffer.from(buf))
  } catch (err) {
    console.error('[Download] Excel generation error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/sync/status', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT excel_config, last_excel_sync FROM site_profile WHERE id = 1`)
    const site = rows[0]
    let config = null
    try { config = site?.excel_config ? JSON.parse(site.excel_config) : null } catch {}
    res.json({
      configured: !!(config?.tenantId && config?.clientId && config?.clientSecret),
      lastSync: site?.last_excel_sync || null,
      oneDrivePath: config?.oneDrivePath || 'Continuum',
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/sync/config', async (req, res) => {
  try {
    const { tenantId, clientId, clientSecret, oneDrivePath } = req.body
    const config = JSON.stringify({ tenantId, clientId, clientSecret, oneDrivePath: oneDrivePath || 'Continuum' })
    await pool.query(`UPDATE site_profile SET excel_config = $1 WHERE id = 1`, [config])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Serve built frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')))
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist/index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`[Server] Continuum backend running on port ${PORT}`)
  startAutomation()
})
