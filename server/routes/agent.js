import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import pool from '../db.js'

const router = Router()

const AGENT_CONFIGS = {
  'chief-of-staff': {
    name: 'Chief of Staff',
    systemPrompt: `You are the Chief of Staff CI agent for {userName} at {siteName}, an Amazon Fulfilment Centre managed by ID Logistics.
Your role: Morning brief generation, daily priorities, accountability coaching, and helping the CI Specialist stay on top of their day.
Rules: Be brutally concise. Max 200 words for a morning brief. No fluff, no preamble, no sign-off. No pipe/markdown tables — use bullet points only. No emoji except sparingly for section headers.
Morning brief format:
## Yesterday's KPIs
- [metric]: [value] vs [target] — [one-word verdict]
## Priority Today
- [single most important thing to do]
## Watch Points
- [1-2 risks or signals that need attention]
## Open Projects
- [project name] — [one action needed]`,
  },
  'gemba-agent': {
    name: 'Gemba Agent',
    systemPrompt: `You are the Gemba Agent for {userName} at {siteName}. Your role is to help structure floor observations, identify waste patterns using TIMWOOD (Transport, Inventory, Motion, Waiting, Overproduction, Overprocessing, Defects, Skills), and recommend CI actions.
When given an observation, classify it clearly: waste type, severity, root cause hypothesis, and recommended next step.`,
  },
  'project-agent': {
    name: 'Project Agent',
    systemPrompt: `You are the DMAIC Project Agent for {userName} at {siteName}. You guide CI projects through Identify → Define → Measure → Analyse → Improve → Control.
Current project context: {projectContext}
When generating structured content, use XML tags so the UI can parse and save them:
- Problem statement: <PS>Your problem statement here</PS>
- Actions list: <ACTIONS>Action 1|owner||Action 2|owner||Action 3|owner</ACTIONS>
- Root cause: <RC>Root cause description here</RC>
- SOP: <SOP>Standard operating procedure text here</SOP>
- Charter fields: <CHARTER>businessCase|||scopeIn|||scopeOut|||benefits</CHARTER>
Always be specific and reference the actual project data provided.`,
  },
  'situation-room': {
    name: 'Situation Room',
    systemPrompt: `You are the Situation Room agent for {userName} at {siteName}. You help prepare for Tier 2 meetings, handle escalations, and craft crisis responses.
For meeting prep: provide a structured brief with KPI status, project updates, risks, and talking points. Be concise — Tier 2 is 15 minutes.`,
  },
  'gm-report': {
    name: 'GM Report Writer',
    systemPrompt: `You are the GM Report Writer for {userName} at {siteName}. You generate professional reports for the General Manager and area managers.
Use this structure with markdown headers:
# Weekly CI Report — [Date]
## Executive Summary
[2-3 sentences: headline performance, biggest win, biggest risk]
## KPI Performance
| Metric | Actual | Target | Status |
|--------|--------|--------|--------|
## CI Projects Update
[one bullet per active project: name, stage, next action]
## Issues & Risks
[bullet list, honest about gaps]
## Next Week Priorities
[numbered list, max 3]
Be factual, direct, professional. Use the actual data provided. Max 400 words.`,
  },
}

async function buildContext(agentId, extra = {}) {
  const { rows: siteRows } = await pool.query(`SELECT * FROM site_profile LIMIT 1`)
  const site = siteRows[0] || {}
  const { rows: projects }   = await pool.query(`SELECT id, title, stage, metric_id, problem_statement FROM projects WHERE stage != 'Closed' LIMIT 5`)
  const { rows: recentKpis } = await pool.query(`SELECT * FROM kpi_data ORDER BY date DESC, created_at DESC LIMIT 20`)
  const { rows: recentObs }  = await pool.query(`SELECT * FROM observations ORDER BY created_at DESC LIMIT 10`)

  const kpiSummary     = recentKpis.map(k => `${k.metric_label}: ${k.value} (target: ${k.target || 'N/A'}) on ${k.date}${k.signal ? ' ⚠️SIGNAL' : ''}`).join('\n')
  const projectSummary = projects.map(p => `- ${p.title} [${p.stage}]: ${p.problem_statement?.substring(0, 80) || 'No problem statement'}`).join('\n')
  const obsSummary     = recentObs.map(o => `- ${o.area} | ${o.waste_type} | Sev ${o.severity}: ${o.text.substring(0, 60)}`).join('\n')

  const config = AGENT_CONFIGS[agentId] || AGENT_CONFIGS['chief-of-staff']
  let systemPrompt = config.systemPrompt
    .replace('{userName}', site.user_name || 'Ryan')
    .replace('{siteName}', site.site_name || 'Amazon FC')
    .replace('{projectContext}', extra.projectContext || 'No project selected')

  const siteNotes = site.site_notes ? `\n\nSite Knowledge Base:\n${site.site_notes}` : ''
  systemPrompt += `\n\n=== LIVE CONTEXT ===\nDate: ${new Date().toLocaleDateString('en-GB')}\nSite: ${site.site_name || 'Amazon FC'}${siteNotes}\n\nRecent KPI Data:\n${kpiSummary || 'No data yet'}\n\nActive Projects:\n${projectSummary || 'No active projects'}\n\nRecent Observations:\n${obsSummary || 'No observations yet'}`

  return systemPrompt
}

router.post('/stream', async (req, res) => {
  const { agentId, messages, projectContext } = req.body

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_api_key_here') {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.write(`data: ${JSON.stringify({ text: '⚠️ No API key configured. Add your ANTHROPIC_API_KEY to the .env file and restart the server.' })}\n\n`)
    res.write('data: [DONE]\n\n')
    return res.end()
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    const systemPrompt = await buildContext(agentId, { projectContext })

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: systemPrompt,
      messages: messages || [{ role: 'user', content: 'Hello' }],
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('Agent stream error:', err)
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
  }
})

router.post('/generate-map', async (req, res) => {
  const { processDescription, projectTitle } = req.body
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_api_key_here') {
    return res.json({ nodes: [], edges: [] })
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Generate a process map JSON for: "${processDescription}" (Project: ${projectTitle}).
Return ONLY valid JSON with this structure:
{
  "nodes": [
    {"id": "1", "type": "process", "label": "Step name", "lane": "Operator|TeamLeader|System", "waste": null|"Transport|Inventory|Motion|Waiting|Overproduction|Overprocessing|Defects|Skills"},
    {"id": "d1", "type": "decision", "label": "Decision?", "lane": "Operator"}
  ],
  "edges": [
    {"id": "e1", "source": "1", "target": "2", "label": ""}
  ]
}
Include 5-12 process steps. Mark waste types on steps where applicable.`
      }]
    })
    const text = response.content[0].text
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      res.json(JSON.parse(jsonMatch[0]))
    } else {
      res.json({ nodes: [], edges: [] })
    }
  } catch (err) {
    console.error('Map generation error:', err)
    res.status(500).json({ error: err.message })
  }
})

router.post('/convert-observation', async (req, res) => {
  const { observation } = req.body
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_api_key_here') {
    return res.json({ error: 'no_api_key' })
  }

  const { rows: siteRows }   = await pool.query(`SELECT * FROM site_profile LIMIT 1`)
  const site = siteRows[0] || {}
  const { rows: portfolios } = await pool.query(`SELECT * FROM portfolios WHERE status = 'active'`)

  const portfolioList = portfolios.length > 0
    ? portfolios.map(p =>
        `  - ID ${p.id}: "${p.name}" | Area: ${p.area_focus} | KPI: ${p.primary_kpi?.toUpperCase() || 'N/A'}${p.strategic_objective ? ` | Objective: ${p.strategic_objective.slice(0, 80)}` : ''}`
      ).join('\n')
    : '  (none — no portfolios exist yet)'

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      messages: [{
        role: 'user',
        content: `You are a CI specialist at ${site.site_name || 'an Amazon Fulfilment Centre'}.

A floor walk observation has been flagged as a potential improvement idea. Do two things:

1. Convert the observation into a properly-formed CI idea (specific title, actionable description).
2. Evaluate whether any existing portfolio is the right home for it. If a portfolio is a good match, say so. If none fit — or if none exist — propose a new portfolio.

Observation:
  Area: ${observation.area}
  Waste type: ${observation.waste_type}
  Text: "${observation.text}"

Active portfolios:
${portfolioList}

Rules:
- The idea title must be specific and actionable (max 10 words). Not "Reduce Waiting waste" — more like "Eliminate picker queue at Zone B sort chute".
- The description must explain: what was observed, the operational impact, and what improvement looks like (2–3 sentences).
- For the portfolio recommendation: only suggest an existing portfolio if the area AND strategic direction genuinely align. A weak overlap is NOT a good match — propose a new portfolio instead.
- If proposing a new portfolio, give it a name, area focus, and a one-sentence strategic objective that would encompass this idea and similar ones.

Return ONLY valid JSON:
{
  "idea": {
    "title": "...",
    "description": "...",
    "area": "Pick|Pack|Inbound|Stow|Dispatch|Yard|Admin",
    "waste_type": "Transport|Inventory|Motion|Waiting|Overproduction|Overprocessing|Defects|Skills"
  },
  "recommendation": {
    "action": "use_existing",
    "portfolio_id": 2,
    "portfolio_name": "...",
    "reason": "One sentence on why this portfolio is the right home"
  }
}
OR if no good match:
{
  "idea": { ... },
  "recommendation": {
    "action": "create_new",
    "new_name": "...",
    "new_area": "Pick|Pack|Inbound|Stow|Dispatch|Yard|Admin",
    "new_objective": "...",
    "reason": "One sentence on why none of the existing portfolios fit"
  }
}`,
      }],
    })
    const text = response.content[0].text
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      res.json(JSON.parse(match[0]))
    } else {
      res.status(500).json({ error: 'parse_failed' })
    }
  } catch (err) {
    console.error('Convert observation error:', err)
    res.status(500).json({ error: err.message })
  }
})

router.post('/suggest-ideas', async (req, res) => {
  const { portfolio_id } = req.body
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_api_key_here') {
    return res.json({ ideas: [] })
  }

  const { rows: siteRows }     = await pool.query(`SELECT * FROM site_profile LIMIT 1`)
  const site = siteRows[0] || {}
  const { rows: observations } = await pool.query(`SELECT * FROM observations ORDER BY created_at DESC LIMIT 50`)
  const portfolio = portfolio_id
    ? (await pool.query(`SELECT * FROM portfolios WHERE id = $1`, [portfolio_id])).rows[0]
    : null
  const { rows: existing } = portfolio_id
    ? await pool.query(`SELECT title FROM ideas WHERE portfolio_id = $1`, [portfolio_id])
    : { rows: [] }

  if (observations.length === 0) return res.json({ ideas: [], reason: 'no_observations' })

  const obsSummary = observations.map(o =>
    `[${o.date || o.created_at?.toISOString().split('T')[0]}] ${o.area} | ${o.waste_type} | Sev ${o.severity}: ${o.text}`
  ).join('\n')

  const existingBlock = existing.length
    ? `\nAlready in pipeline (do NOT duplicate):\n${existing.map(i => `- ${i.title}`).join('\n')}\n`
    : ''

  const portfolioBlock = portfolio
    ? `Target portfolio: "${portfolio.name}" — ${portfolio.area_focus} area, primary KPI: ${portfolio.primary_kpi?.toUpperCase() || 'N/A'}${portfolio.strategic_objective ? `\nStrategic objective: ${portfolio.strategic_objective}` : ''}`
    : 'No specific portfolio — suggest ideas across all areas'

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1800,
      messages: [{
        role: 'user',
        content: `You are a CI specialist analysing floor walk observations from ${site.site_name || 'an Amazon Fulfilment Centre'}.

${portfolioBlock}
${existingBlock}
Analyse the observations below and suggest 3–5 specific, actionable improvement ideas.

Observations:
${obsSummary}

Return ONLY valid JSON:
{
  "ideas": [
    {
      "title": "Short specific improvement title (max 10 words)",
      "description": "2–3 sentences: what was observed, why it matters, what good looks like",
      "area": "Pick|Pack|Inbound|Stow|Dispatch|Yard|Admin",
      "waste_type": "Transport|Inventory|Motion|Waiting|Overproduction|Overprocessing|Defects|Skills"
    }
  ]
}`,
      }],
    })
    const text = response.content[0].text
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      res.json(JSON.parse(match[0]))
    } else {
      res.json({ ideas: [] })
    }
  } catch (err) {
    console.error('Suggest ideas error:', err)
    res.status(500).json({ error: err.message })
  }
})

router.post('/suggest-project-type', async (req, res) => {
  const { idea } = req.body
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_api_key_here') {
    return res.status(400).json({ error: 'no_api_key' })
  }
  if (!idea) return res.status(400).json({ error: 'idea required' })

  const { rows: siteRows } = await pool.query(`SELECT * FROM site_profile LIMIT 1`)
  const site = siteRows[0] || {}
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `You are a CI specialist at ${site.site_name || 'an Amazon Fulfilment Centre'} recommending the appropriate project complexity level.

Idea Title: ${idea.title}
Description: ${idea.description || ''}
Area: ${idea.area || 'Unknown'}
Waste Type: ${idea.waste_type || 'Unknown'}
Impact Rating: ${idea.impact || 'medium'}
Difficulty Rating: ${idea.difficulty || 'standard'}
Estimated Weeks: ${idea.estimated_weeks || 4}

Project Type Options:
- quick_win: Clear problem, obvious solution. 1–2 weeks. No baseline data needed. Single area, small scope.
- yellow_belt: Standard DMAIC, well-defined problem. 2–6 weeks. Before/after measurement. One root cause.
- green_belt: Full DMAIC with data collection, multiple root causes. 4–12 weeks. Cross-shift or cross-area.
- black_belt: Complex, cross-functional, systemic. 3–6 months. Multiple areas, statistical analysis, management sponsorship.
- investigation: Root cause is unknown or disputed; problem needs structured diagnosis before committing to a solution.

Return ONLY valid JSON:
{
  "project_type": "quick_win|yellow_belt|green_belt|black_belt|investigation",
  "reason": "1–2 sentence explanation of why this complexity level fits"
}`,
      }],
    })
    const text = response.content[0].text
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      res.json(JSON.parse(match[0]))
    } else {
      res.status(500).json({ error: 'parse_error' })
    }
  } catch (err) {
    console.error('Suggest project type error:', err)
    res.status(500).json({ error: err.message })
  }
})

router.get('/configs', (req, res) => {
  const configs = Object.entries(AGENT_CONFIGS).map(([id, cfg]) => ({ id, name: cfg.name }))
  res.json(configs)
})

export default router
