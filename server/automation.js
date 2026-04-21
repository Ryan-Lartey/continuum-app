import cron from 'node-cron'
import notifier from 'node-notifier'
import Anthropic from '@anthropic-ai/sdk'
import db from './db.js'

function notify(title, message) {
  notifier.notify({
    title,
    message,
    icon: '',
    sound: true,
  })
  console.log(`[Notification] ${title}: ${message}`)
}

function buildBriefContext() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const kpis = db.prepare(`SELECT * FROM kpi_data WHERE date >= ? ORDER BY date DESC`).all(sevenDaysAgo)
  const obs = db.prepare(`SELECT * FROM observations ORDER BY created_at DESC LIMIT 10`).all()
  const projects = db.prepare(`SELECT * FROM projects WHERE stage != 'Closed'`).all()
  const site = db.prepare(`SELECT * FROM site_profile LIMIT 1`).get() || {}

  return { kpis, obs, projects, site }
}

async function generateMorningBrief() {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_api_key_here') {
    console.log('[Automation] No API key — skipping morning brief generation')
    return
  }

  try {
    const { kpis, obs, projects, site } = buildBriefContext()
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const kpiSummary = kpis.map(k => `${k.metric_label}: ${k.value} (target: ${k.target}) on ${k.date}${k.signal ? ' ⚠️' : ''}`).join('\n')
    const projectSummary = projects.map(p => `- ${p.title} [${p.stage}]`).join('\n')
    const obsSummary = obs.map(o => `- ${o.area}: ${o.waste_type} (${o.text.substring(0, 60)})`).join('\n')

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: `You are Chief of Staff for ${site.user_name || 'Ryan'} at ${site.site_name || 'Amazon FC'}. Generate a concise morning brief.`,
      messages: [{
        role: 'user',
        content: `Generate morning brief.\n\nKPI Data (last 7 days):\n${kpiSummary || 'No data'}\n\nActive Projects:\n${projectSummary || 'None'}\n\nRecent Observations:\n${obsSummary || 'None'}\n\nFormat: Yesterday's KPIs, Open Projects, Today's Priority, Watch Points.`
      }]
    })

    const content = response.content[0].text
    const today = new Date().toISOString().split('T')[0]

    db.prepare(`INSERT INTO briefs (date, content, type) VALUES (?, ?, 'morning')`).run(today, content)
    notify('☀️ Continuum', 'Your morning brief is ready')
    console.log('[Automation] Morning brief generated')
  } catch (err) {
    console.error('[Automation] Morning brief error:', err.message)
  }
}

async function generateWeeklyReport() {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_api_key_here') return

  try {
    const { kpis, obs, projects, site } = buildBriefContext()
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      system: `You are GM Report Writer for ${site.user_name || 'Ryan'} at ${site.site_name || 'Amazon FC'}.`,
      messages: [{
        role: 'user',
        content: `Generate weekly GM report.\n\nKPI Data:\n${kpis.map(k => `${k.metric_label}: ${k.value} on ${k.date}`).join('\n')}\n\nProjects:\n${projects.map(p => `- ${p.title} [${p.stage}]`).join('\n')}\n\nFormat: Executive Summary, KPI Performance, Projects Update, Risks, Next Week.`
      }]
    })

    const content = response.content[0].text
    const today = new Date().toISOString().split('T')[0]

    db.prepare(`INSERT INTO briefs (date, content, type) VALUES (?, ?, 'weekly')`).run(today, content)
    notify('📋 Continuum', 'Weekly GM report is ready in Reports')
    console.log('[Automation] Weekly report generated')
  } catch (err) {
    console.error('[Automation] Weekly report error:', err.message)
  }
}

function checkKpiReminder() {
  const today = new Date().toISOString().split('T')[0]
  const hasKpis = db.prepare(`SELECT COUNT(*) as c FROM kpi_data WHERE date = ?`).get(today)
  if (hasKpis.c === 0) {
    notify('📊 Continuum', "No KPIs logged today — don't forget before EOD")
  }
}

function checkPatterns() {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const patterns = db.prepare(`
    SELECT waste_type, COUNT(*) as count
    FROM observations
    WHERE created_at >= ?
    GROUP BY waste_type
    HAVING COUNT(*) >= 3
  `).all(cutoff)

  for (const p of patterns) {
    notify('⚠️ Continuum', `${p.waste_type} appeared ${p.count}x in 48h — consider raising a project`)
  }
}

export function startAutomation() {
  // Morning brief: weekdays at 6:45am
  cron.schedule('45 6 * * 1-5', generateMorningBrief, { timezone: 'Europe/London' })

  // Pattern detection: every 2 hours
  cron.schedule('0 */2 * * *', checkPatterns)

  // Weekly GM report: Fridays at 4pm
  cron.schedule('0 16 * * 5', generateWeeklyReport, { timezone: 'Europe/London' })

  // KPI reminder: weekdays at 5pm
  cron.schedule('0 17 * * 1-5', checkKpiReminder, { timezone: 'Europe/London' })

  // Daily Excel sync at 7:00 AM
  cron.schedule('0 7 * * *', async () => {
    console.log('[Automation] Running daily Excel sync...')
    try {
      const { runSync } = await import('./services/sync.js')
      const result = await runSync()
      console.log('[Automation] Excel sync complete:', result.syncedAt)
    } catch (err) {
      console.error('[Automation] Excel sync failed:', err.message)
    }
  }, { timezone: 'Europe/London' })

  console.log('[Automation] Cron jobs scheduled')
}
