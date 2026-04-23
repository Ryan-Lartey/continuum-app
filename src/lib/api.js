const BASE = (typeof __API_URL__ !== 'undefined' && __API_URL__) ? `${__API_URL__}/api` : '/api'

let _demoMode = false
export function setApiDemoMode(val) { _demoMode = !!val }

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Demo-Mode': String(_demoMode) },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`)
  return res.json()
}

export const api = {
  // KPI
  getKpis: () => req('GET', '/kpi'),
  getLatestKpis: () => req('GET', '/kpi/latest'),
  getMetricData: (id) => req('GET', `/kpi/metric/${id}`),
  addKpi: (data) => req('POST', '/kpi', data),

  // Observations
  getObservations: () => req('GET', '/observations'),
  getPatterns: () => req('GET', '/observations/patterns'),
  addObservation: (data) => req('POST', '/observations', data),
  deleteObservation: (id) => req('DELETE', `/observations/${id}`),

  // Projects
  getProjects: () => req('GET', '/projects'),
  getProject: (id) => req('GET', `/projects/${id}`),
  createProject: (data) => req('POST', '/projects', data),
  updateProject: (id, data) => req('PUT', `/projects/${id}`, data),
  deleteProject: (id) => req('DELETE', `/projects/${id}`),
  getExitCriteria: (id) => req('GET', `/projects/${id}/exit-criteria`),

  // Flow
  getFlow: (date) => req('GET', `/flow/${date}`),
  updateFlow: (date, steps) => req('PUT', `/flow/${date}`, { steps }),

  // Brief
  getLatestBrief: () => req('GET', '/brief/latest'),
  getWeeklyBrief: () => req('GET', '/brief/weekly'),
  saveBrief: (data) => req('POST', '/brief', data),

  // Site
  getSite: () => req('GET', '/site'),
  updateSite: (data) => req('PUT', '/site', data),
  patchSite: (data) => req('PATCH', '/site', data),
  addSiteNote: (note) => req('POST', '/site/notes', { note }),

  // Tier 2
  getTier2Today: () => req('GET', '/tier2/today'),
  getTier2History: () => req('GET', '/tier2'),
  saveTier2: (data) => req('POST', '/tier2', data),

  // Maturity
  getMaturity: () => req('GET', '/maturity'),
  saveMaturity: (data) => req('POST', '/maturity', data),

  // Portfolio
  getPortfolios: () => req('GET', '/portfolios'),
  getPortfolio: (id) => req('GET', `/portfolios/${id}`),
  getPortfolioSummary: (id) => req('GET', `/portfolios/${id}/summary`),
  createPortfolio: (data) => req('POST', '/portfolios', data),
  updatePortfolio: (id, data) => req('PUT', `/portfolios/${id}`, data),
  deletePortfolio: (id) => req('DELETE', `/portfolios/${id}`),

  // Ideas
  getIdeas: (params = {}) => req('GET', `/ideas?${new URLSearchParams(params)}`),
  getIdea: (id) => req('GET', `/ideas/${id}`),
  createIdea: (data) => req('POST', '/ideas', data),
  updateIdea: (id, data) => req('PUT', `/ideas/${id}`, data),
  deleteIdea: (id) => req('DELETE', `/ideas/${id}`),
  createProjectFromIdea: (id) => req('POST', `/ideas/${id}/create-project`),

  // AI
  suggestIdeas: (portfolioId) => req('POST', '/agent/suggest-ideas', { portfolio_id: portfolioId }),
  convertObservation: (observation) => req('POST', '/agent/convert-observation', { observation }),
  suggestProjectType: (idea) => req('POST', '/agent/suggest-project-type', { idea }),

  // Standalone Maps
  getMaps: () => req('GET', '/maps'),
  createMap: (data) => req('POST', '/maps', data),
  updateMap: (id, data) => req('PUT', `/maps/${id}`, data),
  deleteMap: (id) => req('DELETE', `/maps/${id}`),

  // Process Maps
  getProcessMaps: () => req('GET', '/process-maps'),
  getProcessMap: (id) => req('GET', `/process-maps/${id}`),
  createProcessMap: (data) => req('POST', '/process-maps', data),
  updateProcessMap: (id, data) => req('PUT', `/process-maps/${id}`, data),
  deleteProcessMap: (id) => req('DELETE', `/process-maps/${id}`),

  // Warehouse Health
  getSections: () => req('GET', '/sections'),
  getSectionMetrics: (sectionId) => req('GET', `/sections/${sectionId}/metrics`),
  addSectionMetric: (data) => req('POST', '/sections/metrics', data),
  updateSectionMetric: (id, data) => req('PUT', `/sections/metrics/${id}`, data),
  createShift: (data) => req('POST', '/sections/shifts', data),
  submitShiftScores: (shiftId, entries) => req('POST', `/sections/shifts/${shiftId}/scores`, { entries }),
}

export function streamSwarm(workflowId, onEvent, onDone, onError) {
  fetch('/api/swarm/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflowId }),
  }).then(async (res) => {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') { onDone?.(); return }
          try { onEvent(JSON.parse(data)) } catch {}
        }
      }
    }
    onDone?.()
  }).catch(onError)
}

export function streamAgent(agentId, messages, projectContext, onChunk, onDone, onError) {
  fetch('/api/agent/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, messages, projectContext }),
  }).then(async (res) => {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            onDone?.()
            return
          }
          try {
            const parsed = JSON.parse(data)
            if (parsed.text) onChunk(parsed.text)
            if (parsed.error) onError?.(parsed.error)
          } catch {}
        }
      }
    }
    onDone?.()
  }).catch(onError)
}
