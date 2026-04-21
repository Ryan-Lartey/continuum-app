import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import pool from '../db.js'

const router = Router()

const AGENT_PROMPTS = {
  'chief-of-staff': `You are the Chief of Staff CI agent for {userName} at {siteName}. Be brutally concise. No fluff, no preamble. Bullet points only. No emoji except sparingly for section headers.`,
  'gemba-agent': `You are the Gemba Agent for {userName} at {siteName}. Identify waste patterns using TIMWOOD (Transport, Inventory, Motion, Waiting, Overproduction, Overprocessing, Defects, Skills). Be concise and actionable.`,
  'kpi-analyst': `You are the KPI Analyst for {userName} at {siteName}. Interpret SPC signals, state current vs target, trend direction, and operational impact.`,
  'situation-room': `You are the Situation Room agent for {userName} at {siteName}. Help prepare Tier 2 meetings and handle escalations. Be concise — Tier 2 is 15 minutes.`,
  'project-agent': `You are the DMAIC Project Agent for {userName} at {siteName}. Guide CI projects through Define → Measure → Analyse → Improve → Control.`,
  'gm-report': `You are the GM Report Writer for {userName} at {siteName}. Generate professional, concise reports. Be factual and direct.`,
}

const AGENT_NAMES = {
  'chief-of-staff': 'Chief of Staff',
  'gemba-agent': 'Gemba Agent',
  'kpi-analyst': 'KPI Analyst',
  'situation-room': 'Situation Room',
  'project-agent': 'Project Agent',
  'gm-report': 'GM Report Writer',
}

const WORKFLOWS = {
  'morning-situation-room': {
    name: 'Morning Situation Room',
    description: 'KPI Analyst + Gemba Agent gather intelligence in parallel, then Chief of Staff synthesises a unified morning brief.',
    icon: '◎',
    phases: [
      {
        type: 'parallel',
        label: 'Gathering intelligence',
        agents: [
          { id: 'kpi-analyst', instruction: "Analyse yesterday's KPIs. Identify signals, trends, and the single most important thing to watch today. Max 120 words." },
          { id: 'gemba-agent', instruction: "Review recent floor observations. Summarise the top waste patterns and any recurring issues. Max 120 words." },
        ],
      },
      {
        type: 'stream',
        label: 'Synthesising morning brief',
        agent: 'chief-of-staff',
        instruction: (r) => `Based on intelligence from your specialist agents:\n\nKPI Analysis:\n${r['kpi-analyst']}\n\nFloor Intelligence:\n${r['gemba-agent']}\n\nGenerate a concise morning brief for today.`,
      },
    ],
  },
  'kpi-deep-dive': {
    name: 'KPI Deep Dive',
    description: 'KPI Analyst identifies signals, Gemba cross-references floor evidence, Project Agent recommends DMAIC action.',
    icon: '▲',
    phases: [
      {
        type: 'parallel',
        label: 'Analysing KPI signals',
        agents: [
          { id: 'kpi-analyst', instruction: "Deep-dive all KPIs. Identify the most critical signal. State the value, target, trend, and top two root cause hypotheses. Max 180 words." },
        ],
      },
      {
        type: 'parallel',
        label: 'Cross-referencing floor evidence',
        agents: [
          { id: 'gemba-agent', instruction: (r) => `KPI signals found:\n${r['kpi-analyst']}\n\nCross-reference with recent floor observations. Which observations could explain the KPI signal? What immediate floor actions are needed? Max 150 words.` },
        ],
      },
      {
        type: 'stream',
        label: 'Recommending DMAIC action',
        agent: 'project-agent',
        instruction: (r) => `KPI Signal:\n${r['kpi-analyst']}\n\nFloor Evidence:\n${r['gemba-agent']}\n\nShould this become a DMAIC project? If yes, draft a problem statement and Define phase outline. If no, explain why and suggest a quick countermeasure instead.`,
      },
    ],
  },
  'tier2-prep': {
    name: 'Tier 2 Full Prep',
    description: 'KPI Analyst + Situation Room prepare intelligence in parallel, then GM Report Writer builds the complete meeting pack.',
    icon: '⊡',
    phases: [
      {
        type: 'parallel',
        label: 'Preparing meeting intelligence',
        agents: [
          { id: 'kpi-analyst', instruction: "Prepare a Tier 2 data narrative. For each KPI give: status (G/A/R), trend, and a one-line explanation. Max 130 words." },
          { id: 'situation-room', instruction: "What are today's Tier 2 risks, escalations, and key talking points? Structure as: Risks | Escalations | What to prepare. Max 130 words." },
        ],
      },
      {
        type: 'stream',
        label: 'Building meeting pack',
        agent: 'gm-report',
        instruction: (r) => `Synthesise into a polished Tier 2 meeting brief:\n\nKPI Narrative:\n${r['kpi-analyst']}\n\nMeeting Structure:\n${r['situation-room']}\n\nProvide a clean, professional brief ready to present. Use ## headers for sections.`,
      },
    ],
  },
}

async function buildContextData() {
  const { rows: siteRows }   = await pool.query(`SELECT * FROM site_profile LIMIT 1`)
  const site = siteRows[0] || {}
  const { rows: projects }   = await pool.query(`SELECT id, title, stage, problem_statement FROM projects WHERE stage != 'Closed' LIMIT 5`)
  const { rows: recentKpis } = await pool.query(`SELECT * FROM kpi_data ORDER BY date DESC, created_at DESC LIMIT 20`)
  const { rows: recentObs }  = await pool.query(`SELECT * FROM observations ORDER BY created_at DESC LIMIT 10`)
  return {
    site,
    kpiSummary: recentKpis.map(k => `${k.metric_label}: ${k.value} (target: ${k.target || 'N/A'}) on ${k.date}${k.signal ? ' SIGNAL' : ''}`).join('\n') || 'No KPI data yet',
    projectSummary: projects.map(p => `- ${p.title} [${p.stage}]: ${p.problem_statement?.substring(0, 80) || 'No problem statement'}`).join('\n') || 'No active projects',
    obsSummary: recentObs.map(o => `- ${o.area} | ${o.waste_type} | Sev ${o.severity}: ${o.text.substring(0, 60)}`).join('\n') || 'No observations yet',
  }
}

function buildSystemPrompt(agentId, ctx) {
  const base = AGENT_PROMPTS[agentId] || AGENT_PROMPTS['chief-of-staff']
  return base
    .replace('{userName}', ctx.site.user_name || 'Ryan')
    .replace('{siteName}', ctx.site.site_name || 'Amazon FC')
    + `\n\n=== LIVE CONTEXT ===\nDate: ${new Date().toLocaleDateString('en-GB')}\nKPIs:\n${ctx.kpiSummary}\nProjects:\n${ctx.projectSummary}\nObservations:\n${ctx.obsSummary}`
}

async function runNonStreaming(client, agentId, instruction, ctx) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system: buildSystemPrompt(agentId, ctx),
    messages: [{ role: 'user', content: instruction }],
  })
  return response.content[0].text
}

router.get('/workflows', (req, res) => {
  const list = Object.entries(WORKFLOWS).map(([id, w]) => ({
    id, name: w.name, description: w.description, icon: w.icon,
    agents: [...new Set(
      w.phases.flatMap(p => p.agents ? p.agents.map(a => a.id) : [p.agent]).filter(Boolean)
    )].map(id => ({ id, name: AGENT_NAMES[id] || id })),
  }))
  res.json(list)
})

router.post('/run', async (req, res) => {
  const { workflowId } = req.body
  const workflow = WORKFLOWS[workflowId]
  if (!workflow) return res.status(400).json({ error: 'Unknown workflow' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`)

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_api_key_here') {
    send({ type: 'error', text: 'No API key configured. Add ANTHROPIC_API_KEY to .env and restart.' })
    res.write('data: [DONE]\n\n')
    return res.end()
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const ctx = await buildContextData()
  const results = {}

  try {
    for (let i = 0; i < workflow.phases.length; i++) {
      const phase = workflow.phases[i]
      send({ type: 'phase', index: i + 1, total: workflow.phases.length, label: phase.label })

      if (phase.type === 'parallel') {
        const tasks = phase.agents.map(async (agentDef) => {
          const instruction = typeof agentDef.instruction === 'function'
            ? agentDef.instruction(results)
            : agentDef.instruction
          send({ type: 'agent-start', agent: agentDef.id, name: AGENT_NAMES[agentDef.id] })
          const text = await runNonStreaming(client, agentDef.id, instruction, ctx)
          results[agentDef.id] = text
          send({ type: 'agent-done', agent: agentDef.id, name: AGENT_NAMES[agentDef.id], text })
        })
        await Promise.all(tasks)
      } else if (phase.type === 'stream') {
        const instruction = typeof phase.instruction === 'function'
          ? phase.instruction(results)
          : phase.instruction

        send({ type: 'agent-start', agent: phase.agent, name: AGENT_NAMES[phase.agent] })

        const stream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1200,
          system: buildSystemPrompt(phase.agent, ctx),
          messages: [{ role: 'user', content: instruction }],
        })

        let full = ''
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            full += event.delta.text
            send({ type: 'stream', text: event.delta.text, agent: phase.agent })
          }
        }
        results[phase.agent] = full
        send({ type: 'agent-done', agent: phase.agent, name: AGENT_NAMES[phase.agent] })
      }
    }
    send({ type: 'complete' })
  } catch (err) {
    console.error('Swarm error:', err)
    send({ type: 'error', text: err.message })
  }

  res.write('data: [DONE]\n\n')
  res.end()
})

export default router
