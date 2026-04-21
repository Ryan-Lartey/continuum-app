import db from '../db.js'
import { generateExcelWorkbook } from './excel.js'
import { uploadFileToOneDrive } from './graph.js'

function getExcelConfig() {
  const site = db.prepare('SELECT * FROM site_profile WHERE id = 1').get()
  try {
    return site?.excel_config ? JSON.parse(site.excel_config) : null
  } catch { return null }
}

function buildActivityLog() {
  const log = []

  // KPI logs
  const kpis = db.prepare('SELECT * FROM kpi_data ORDER BY date DESC, created_at DESC LIMIT 100').all()
  kpis.forEach(k => {
    log.push({
      date: k.date,
      type: 'KPI Logged',
      description: `${k.metric_label || k.metric_id.toUpperCase()} logged: ${k.value}`,
      detail: k.annotation || ''
    })
  })

  // Projects
  const projects = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC LIMIT 50').all()
  projects.forEach(p => {
    log.push({
      date: p.updated_at?.slice(0, 10) || p.created_at?.slice(0, 10) || '',
      type: 'Project Updated',
      description: p.title,
      detail: `Stage: ${p.stage}`
    })
  })

  // Observations
  const obs = db.prepare('SELECT * FROM observations ORDER BY date DESC LIMIT 50').all()
  obs.forEach(o => {
    log.push({
      date: o.date,
      type: 'Observation',
      description: `${o.waste_type} — ${o.area}`,
      detail: o.text?.slice(0, 80) || ''
    })
  })

  // Ideas
  try {
    const ideas = db.prepare('SELECT * FROM ideas ORDER BY created_at DESC LIMIT 30').all()
    ideas.forEach(i => {
      log.push({
        date: i.created_at?.slice(0, 10) || '',
        type: 'Idea Raised',
        description: i.title,
        detail: `Stage: ${i.pipeline_stage}`
      })
    })
  } catch {}

  return log.sort((a, b) => b.date.localeCompare(a.date))
}

export async function buildSyncData() {
  const site       = db.prepare('SELECT * FROM site_profile WHERE id = 1').get()
  const projects   = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all()
  const portfolios = db.prepare('SELECT * FROM portfolios WHERE status = ?').all('active')
  const kpiData    = db.prepare('SELECT * FROM kpi_data ORDER BY date ASC').all()

  let ideas = []
  try { ideas = db.prepare('SELECT * FROM ideas').all() } catch {}

  // Maturity scores
  let maturity = null
  try { maturity = db.prepare('SELECT * FROM maturity_scores ORDER BY month DESC LIMIT 1').get() } catch {}

  // Action/SOP counts from project charters
  let actionsComplete = 0, sopCount = 0
  projects.forEach(p => {
    try {
      const c = p.charter ? JSON.parse(p.charter) : {}
      const acts = p.actions ? JSON.parse(p.actions) : []
      actionsComplete += acts.filter(a => a.done).length
      if (c.sop) sopCount++
    } catch {}
  })

  // Latest KPIs
  const latestKpis = {}
  for (const m of ['uph', 'accuracy', 'dpmo', 'dts']) {
    const row = db.prepare('SELECT * FROM kpi_data WHERE LOWER(metric_id) = ? ORDER BY date DESC, created_at DESC LIMIT 1').get(m)
    latestKpis[m] = row || null
  }

  // KPI targets
  let kpiTargets = { UPH: 100, Accuracy: 99.5, DPMO: 500, DTS: 98 }
  try {
    if (site?.kpi_targets) kpiTargets = JSON.parse(site.kpi_targets)
  } catch {}

  // Portfolio summaries
  const summaries = {}
  for (const p of portfolios) {
    const pIdeas    = ideas.filter(i => i.portfolio_id === p.id)
    const pProjects = projects.filter(pr => pr.portfolio_id === p.id)
    summaries[p.id] = {
      ideaCount:       pIdeas.filter(i => i.pipeline_stage === 'idea').length,
      definitionCount: pIdeas.filter(i => i.pipeline_stage === 'definition').length,
      validationCount: pIdeas.filter(i => i.pipeline_stage === 'validation').length,
      assignedCount:   pProjects.filter(p => p.stage !== 'Closed').length,
      finishedCount:   pProjects.filter(p => p.stage === 'Closed').length,
    }
  }

  return {
    siteName:       site?.site_name || 'Amazon FC',
    userName:       site?.user_name || 'Ryan',
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
    activityLog:    buildActivityLog(),
    kpiSummary:     latestKpis,
  }
}

export async function runSync() {
  const config = getExcelConfig()
  const data   = await buildSyncData()
  const wb     = await generateExcelWorkbook(data)

  // Always save locally
  const localPath = new URL('../../continuum-report.xlsx', import.meta.url).pathname
  await wb.xlsx.writeFile(localPath)

  let webUrl = null
  let error  = null

  // Upload to OneDrive if configured
  if (config?.tenantId && config?.clientId && config?.clientSecret) {
    try {
      const buffer = await wb.xlsx.writeBuffer()
      webUrl = await uploadFileToOneDrive(config, buffer, 'Continuum-CI-Report.xlsx')
    } catch (err) {
      error = err.message
      console.error('[Sync] OneDrive upload failed:', err.message)
    }
  }

  // Update last sync timestamp in site_profile
  const now = new Date().toISOString()
  try {
    db.prepare('UPDATE site_profile SET last_excel_sync = ? WHERE id = 1').run(now)
  } catch {}

  return { success: true, webUrl, error, syncedAt: now, localPath }
}
