import pool from '../db.js'
import { generateExcelWorkbook } from './excel.js'
import { uploadFileToOneDrive } from './graph.js'

async function getExcelConfig() {
  try {
    const { rows } = await pool.query('SELECT excel_config FROM site_profile WHERE id = 1')
    const site = rows[0]
    return site?.excel_config ? JSON.parse(site.excel_config) : null
  } catch { return null }
}

async function buildActivityLog() {
  const log = []

  const { rows: kpis } = await pool.query(
    'SELECT * FROM kpi_data ORDER BY date DESC, created_at DESC LIMIT 100'
  )
  kpis.forEach(k => {
    log.push({
      date: k.date,
      type: 'KPI Logged',
      description: `${k.metric_label || k.metric_id.toUpperCase()} logged: ${k.value}`,
      detail: k.annotation || ''
    })
  })

  const { rows: projects } = await pool.query(
    'SELECT * FROM projects ORDER BY updated_at DESC LIMIT 50'
  )
  projects.forEach(p => {
    log.push({
      date: p.updated_at?.toISOString?.()?.slice(0, 10) || p.created_at?.toISOString?.()?.slice(0, 10) || '',
      type: 'Project Updated',
      description: p.title,
      detail: `Stage: ${p.stage}`
    })
  })

  const { rows: obs } = await pool.query(
    'SELECT * FROM observations ORDER BY date DESC LIMIT 50'
  )
  obs.forEach(o => {
    log.push({
      date: o.date,
      type: 'Observation',
      description: `${o.waste_type} — ${o.area}`,
      detail: o.text?.slice(0, 80) || ''
    })
  })

  try {
    const { rows: ideas } = await pool.query(
      'SELECT * FROM ideas ORDER BY created_at DESC LIMIT 30'
    )
    ideas.forEach(i => {
      log.push({
        date: i.created_at?.toISOString?.()?.slice(0, 10) || '',
        type: 'Idea Raised',
        description: i.title,
        detail: `Stage: ${i.pipeline_stage}`
      })
    })
  } catch {}

  return log.sort((a, b) => b.date.localeCompare(a.date))
}

export async function buildSyncData() {
  const { rows: siteRows } = await pool.query('SELECT * FROM site_profile WHERE id = 1')
  const site = siteRows[0] || {}

  const { rows: projects } = await pool.query('SELECT * FROM projects ORDER BY updated_at DESC')
  const { rows: portfolios } = await pool.query("SELECT * FROM portfolios WHERE status = 'active'")
  const { rows: kpiData } = await pool.query('SELECT * FROM kpi_data ORDER BY date ASC')

  let ideas = []
  try { const r = await pool.query('SELECT * FROM ideas'); ideas = r.rows } catch {}

  let maturity = null
  try {
    const r = await pool.query('SELECT * FROM maturity_scores ORDER BY month DESC LIMIT 1')
    maturity = r.rows[0] || null
  } catch {}

  let actionsComplete = 0, sopCount = 0
  projects.forEach(p => {
    try {
      const c = p.charter ? JSON.parse(p.charter) : {}
      const acts = p.actions ? JSON.parse(p.actions) : []
      actionsComplete += acts.filter(a => a.done).length
      if (c.sop) sopCount++
    } catch {}
  })

  const latestKpis = {}
  for (const m of ['uph', 'accuracy', 'dpmo', 'dts']) {
    const { rows } = await pool.query(
      'SELECT * FROM kpi_data WHERE LOWER(metric_id) = $1 ORDER BY date DESC, created_at DESC LIMIT 1',
      [m]
    )
    latestKpis[m] = rows[0] || null
  }

  let kpiTargets = { UPH: 100, Accuracy: 99.5, DPMO: 500, DTS: 98 }
  try { if (site.kpi_targets) kpiTargets = JSON.parse(site.kpi_targets) } catch {}

  const summaries = {}
  for (const p of portfolios) {
    const pIdeas    = ideas.filter(i => i.portfolio_id === p.id)
    const pProjects = projects.filter(pr => pr.portfolio_id === p.id)
    summaries[p.id] = {
      ideaCount:       pIdeas.filter(i => i.pipeline_stage === 'idea').length,
      definitionCount: pIdeas.filter(i => i.pipeline_stage === 'definition').length,
      validationCount: pIdeas.filter(i => i.pipeline_stage === 'validation').length,
      assignedCount:   pProjects.filter(pr => pr.stage !== 'Closed').length,
      finishedCount:   pProjects.filter(pr => pr.stage === 'Closed').length,
    }
  }

  // Warehouse Health data
  let warehouseHealth = []
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
    warehouseHealth = rows
  } catch {}

  return {
    siteName:       site.site_name || 'Amazon FC',
    userName:       site.user_name || 'Ryan',
    kpiTargets,
    latestKpis,
    kpiData,
    projects,
    portfolios,
    ideas,
    summaries,
    maturity,
    actionsComplete,
    sopCount,
    activeProjects: projects.filter(p => p.stage !== 'Closed').length,
    closedProjects: projects.filter(p => p.stage === 'Closed').length,
    totalIdeas:     ideas.length,
    activityLog:    await buildActivityLog(),
    kpiSummary:     latestKpis,
    warehouseHealth,
  }
}

export async function runSync() {
  const config = await getExcelConfig()
  const data   = await buildSyncData()
  const wb     = await generateExcelWorkbook(data)

  const localPath = new URL('../../continuum-report.xlsx', import.meta.url).pathname
  await wb.xlsx.writeFile(localPath)

  let webUrl = null
  let error  = null

  if (config?.tenantId && config?.clientId && config?.clientSecret) {
    try {
      const buffer = await wb.xlsx.writeBuffer()
      webUrl = await uploadFileToOneDrive(config, buffer, 'Continuum-CI-Report.xlsx')
    } catch (err) {
      error = err.message
      console.error('[Sync] OneDrive upload failed:', err.message)
    }
  }

  const now = new Date().toISOString()
  try {
    await pool.query('UPDATE site_profile SET last_excel_sync = $1 WHERE id = 1', [now])
  } catch {}

  return { success: true, webUrl, error, syncedAt: now, localPath }
}
