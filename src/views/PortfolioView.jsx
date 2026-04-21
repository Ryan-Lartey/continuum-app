import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import ProjectDetail from './ProjectDetail.jsx'
import PresentationHotspot from '../components/PresentationHotspot.jsx'

const AREAS = ['Inbound', 'Stow', 'Pick', 'Pack', 'Dispatch', 'Yard', 'Admin']
const WASTE_TYPES = ['Transport', 'Inventory', 'Motion', 'Waiting', 'Overproduction', 'Overprocessing', 'Defects', 'Skills']
const METRIC_LABELS = { uph: 'UPH', accuracy: 'Pick Accuracy', dpmo: 'DPMO', dts: 'DTS', custom: 'Custom' }
const AREA_COLOR = { Pick: '#E8820C', Pack: '#3B7FDE', Inbound: '#7C3AED', Stow: '#16A34A', Dispatch: '#DC2626', Yard: '#0891B2', Admin: '#6B7280', All: '#E8820C' }
const SOURCE_ICONS = { floor_walk: '◎', tier2: '◆', gemba: '⬡', manual: '✎', pattern: '⚠' }
const SOURCE_LABELS = { floor_walk: 'Floor Walk', tier2: 'Tier 2', gemba: 'Gemba', manual: 'Manual', pattern: 'Pattern Alert' }
const DIFFICULTY_LABELS = { quick_win: 'Quick Win', standard: 'Standard', complex: 'Complex' }
const DIFFICULTY_COLORS = { quick_win: '#16A34A', standard: '#E8820C', complex: '#DC2626' }
const IMPACT_COLORS = { high: '#16A34A', medium: '#E8820C', low: '#6B7280' }

const STAGES = [
  { id: 'idea',       label: 'Raw Idea Evaluation', short: 'Ideas',      desc: 'Raw improvement ideas from floor walks, Tier 2 meetings, and observations.' },
  { id: 'definition', label: 'Project Definition',  short: 'Definition', desc: 'Rate each idea by Impact and Difficulty. High Impact + Quick Win = Priority.' },
  { id: 'validation', label: 'Project Validation',  short: 'Validation', desc: 'Set the KPI baseline, target, and timeline before committing to a full DMAIC project.' },
  { id: 'assigned',   label: 'Assigned Projects',   short: 'Active',     desc: 'Active DMAIC projects currently in progress.' },
  { id: 'finished',   label: 'Finished Projects',   short: 'Finished',   desc: 'Completed projects with before/after KPI results.' },
]

export default function PortfolioView({ portfolio: initialPortfolio, onBack, onNavigate, demoMode }) {
  const [portfolio, setPortfolio]   = useState(initialPortfolio)
  const [ideas, setIdeas]           = useState([])
  const [projects, setProjects]     = useState([])
  const [summary, setSummary]       = useState(null)
  const [activeStage, setActiveStage] = useState(null)
  const [evalTab, setEvalTab]       = useState('pending')
  const [openProject, setOpenProject] = useState(null)
  const [showNewIdea, setShowNewIdea] = useState(false)
  const [showValidate, setShowValidate] = useState(null)
  const [newIdea, setNewIdea]       = useState({ title: '', description: '', area: 'Pick', waste_type: '', source: 'manual' })
  const [validateForm, setValidateForm] = useState({ metric_id: '', baseline: '', target_value: '', estimated_weeks: '4', project_type: '' })
  const [creating, setCreating]     = useState(false)
  const [suggestingType, setSuggestingType] = useState(false)
  const [typeReason, setTypeReason]     = useState('')

  useEffect(() => { loadAll() }, [portfolio.id])

  async function loadAll() {
    const [allIdeas, allProjects, s] = await Promise.all([
      api.getIdeas({ portfolio_id: portfolio.id }).catch(() => []),
      api.getProjects().catch(() => []),
      api.getPortfolioSummary(portfolio.id).catch(() => null),
    ])
    setIdeas(allIdeas)
    const linkedIds = allIdeas.filter(i => i.project_id).map(i => i.project_id)
    setProjects(allProjects.filter(p => p.portfolio_id === portfolio.id || linkedIds.includes(p.id)))
    setSummary(s)
  }

  const pColor = AREA_COLOR[portfolio.area_focus] || '#E8820C'
  const inputStyle = { background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }

  const ideaStageIdeas       = ideas.filter(i => i.pipeline_stage === 'idea')
  const definitionIdeas      = ideas.filter(i => i.pipeline_stage === 'definition')
  const validationIdeas      = ideas.filter(i => i.pipeline_stage === 'validation')
  const assignedProjects     = projects.filter(p => p.stage !== 'Closed')
  const finishedProjects     = projects.filter(p => p.stage === 'Closed')

  const totalIdeas    = ideas.length
  const completedPct  = totalIdeas > 0 ? Math.round((finishedProjects.length / totalIdeas) * 100) : 0

  // ─── Health score calculation (client-side, no extra API calls) ───
  function calcHealthScore() {
    let score = 0

    // Pipeline velocity: ideas are moving (not stuck) — 30 pts
    // "Moving" = more ideas in validation/assigned than stuck in idea/definition
    const stuckCount = [...ideaStageIdeas, ...definitionIdeas].filter(i => {
      const d = i.created_at ? Math.floor((Date.now() - new Date(i.created_at).getTime()) / 86400000) : 0
      return d > 14
    }).length
    const totalPipelineIdeas = ideaStageIdeas.length + definitionIdeas.length + validationIdeas.length
    if (totalPipelineIdeas === 0 || stuckCount === 0) score += 30
    else if (stuckCount / totalPipelineIdeas < 0.5) score += 15

    // Active project count > 0 — 20 pts
    if (assignedProjects.length > 0) score += 20

    // No ideas older than 14 days in definition/validation — 20 pts
    const staleInDefVal = [...definitionIdeas, ...validationIdeas].some(i => {
      const d = i.created_at ? Math.floor((Date.now() - new Date(i.created_at).getTime()) / 86400000) : 0
      return d > 14
    })
    if (!staleInDefVal) score += 20

    // At least one finished project — 15 pts
    if (finishedProjects.length > 0) score += 15

    // KPI trending in right direction (any finished project with positive improvement) — 15 pts
    const hasPositiveKpi = finishedProjects.some(p => {
      const ch = p.charter || {}
      if (p.baseline != null && ch.kpiAchieved != null) {
        const improvement = ((ch.kpiAchieved - p.baseline) / p.baseline) * 100
        return Math.abs(improvement) >= 5
      }
      return false
    })
    if (hasPositiveKpi) score += 15

    return Math.min(100, score)
  }
  const healthScore = calcHealthScore()
  const healthLabel = healthScore >= 80 ? 'Healthy' : healthScore >= 50 ? 'Review' : 'At Risk'
  const healthColor = healthScore >= 80 ? '#4ade80' : healthScore >= 50 ? '#fb923c' : '#f87171'
  const healthDot   = healthScore >= 80 ? '●' : '◑'

  const impactAchieved = finishedProjects.reduce((sum, p) => {
    const ch = p.charter || {}
    if (p.baseline != null && ch.kpiAchieved != null) {
      return sum + Math.abs(ch.kpiAchieved - p.baseline)
    }
    return sum
  }, 0)

  async function updateIdea(id, changes) {
    const updated = await api.updateIdea(id, changes)
    setIdeas(prev => prev.map(i => i.id === id ? updated : i))
    loadAll()
  }

  async function deleteIdea(id) {
    await api.deleteIdea(id)
    setIdeas(prev => prev.filter(i => i.id !== id))
    loadAll()
  }

  async function addIdea(e) {
    e.preventDefault()
    if (!newIdea.title.trim()) return
    setCreating(true)
    try {
      const created = await api.createIdea({ ...newIdea, portfolio_id: portfolio.id })
      setIdeas(prev => [created, ...prev])
      setShowNewIdea(false)
      setNewIdea({ title: '', description: '', area: 'Pick', waste_type: '', source: 'manual' })
      loadAll()
    } finally { setCreating(false) }
  }

  async function createProject(idea) {
    setCreating(true)
    try {
      const { project } = await api.createProjectFromIdea(idea.id)
      await loadAll()
      setActiveStage('assigned')
      setOpenProject(project)
    } finally { setCreating(false) }
  }

  async function openValidation(idea) {
    setValidateForm({
      metric_id: idea.metric_id || '',
      baseline: idea.baseline ?? '',
      target_value: idea.target_value ?? '',
      estimated_weeks: idea.estimated_weeks || 4,
      project_type: idea.project_type || '',
    })
    setTypeReason('')
    setShowValidate(idea)
  }

  async function suggestType() {
    if (!showValidate) return
    setSuggestingType(true)
    setTypeReason('')
    try {
      const merged = { ...showValidate, ...validateForm }
      const result = await api.suggestProjectType(merged)
      if (result.project_type) {
        setValidateForm(f => ({ ...f, project_type: result.project_type }))
        setTypeReason(result.reason || '')
      }
    } catch { /* silent — user can pick manually */ }
    finally { setSuggestingType(false) }
  }

  async function saveValidation(e) {
    e.preventDefault()
    if (!showValidate) return
    await updateIdea(showValidate.id, {
      metric_id: validateForm.metric_id,
      baseline: validateForm.baseline !== '' ? parseFloat(validateForm.baseline) : null,
      target_value: validateForm.target_value !== '' ? parseFloat(validateForm.target_value) : null,
      estimated_weeks: parseInt(validateForm.estimated_weeks) || 4,
      project_type: validateForm.project_type || null,
      pipeline_stage: 'validation',
      eval_status: 'accepted',
    })
    setShowValidate(null)
  }

  // ─── If a project is open, show the DMAIC tool ───
  if (openProject) {
    return (
      <ProjectDetail
        project={openProject}
        onClose={() => { setOpenProject(null); loadAll() }}
        onProjectUpdated={p => setOpenProject(p)}
        inline={false}
        demoMode={demoMode}
      />
    )
  }

  // ─── Stage detail views ───
  if (activeStage) {
    return (
      <div className="max-w-[900px]">
        {/* Stage header */}
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => setActiveStage(null)}
            className="flex items-center gap-1.5 text-sm font-semibold"
            style={{ color: 'var(--text-3)' }}>
            ← {portfolio.name}
          </button>
          <span style={{ color: 'var(--text-3)' }}>›</span>
          <span className="text-sm font-semibold" style={{ color: pColor }}>
            {STAGES.find(s => s.id === activeStage)?.label}
          </span>
        </div>

        {/* Stage tabs */}
        <div className="flex gap-0 mb-6 border-b" style={{ borderColor: 'var(--border)' }}>
          {STAGES.map(s => {
            const counts = {
              idea: ideaStageIdeas.length, definition: definitionIdeas.length,
              validation: validationIdeas.length, assigned: assignedProjects.length, finished: finishedProjects.length
            }
            return (
              <button key={s.id} onClick={() => setActiveStage(s.id)}
                className="px-4 py-2.5 text-sm font-semibold relative"
                style={{
                  color: activeStage === s.id ? pColor : 'var(--text-3)',
                  borderBottom: activeStage === s.id ? `2px solid ${pColor}` : '2px solid transparent',
                  marginBottom: -1,
                }}>
                {s.short}
                {counts[s.id] > 0 && (
                  <span className="ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: activeStage === s.id ? `${pColor}18` : 'var(--bg-input)', color: activeStage === s.id ? pColor : 'var(--text-3)' }}>
                    {counts[s.id]}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Raw Idea Evaluation ── */}
        {activeStage === 'idea' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-0 border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                {[['pending','Pending Review'], ['not_accepted','Declined']].map(([id, label]) => {
                  const count = ideaStageIdeas.filter(i => i.eval_status === id).length
                  return (
                    <button key={id} onClick={() => setEvalTab(id)}
                      className="px-3 py-1.5 text-xs font-semibold"
                      style={{ background: evalTab === id ? pColor : 'transparent', color: evalTab === id ? 'white' : 'var(--text-3)' }}>
                      {label} {count > 0 && <span className="ml-1 opacity-70">{count}</span>}
                    </button>
                  )
                })}
              </div>
              <button onClick={() => setShowNewIdea(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: 'var(--bg-input)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                + From Meeting
              </button>
            </div>

            <div className="space-y-2">
              {ideaStageIdeas.filter(i => i.eval_status === evalTab).length === 0 ? (
                <div className="card p-10 text-center">
                  <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                    {evalTab === 'pending'
                      ? 'No ideas pending review — send observations as ideas from the Floor Walk'
                      : 'No declined ideas'}
                  </p>
                </div>
              ) : ideaStageIdeas.filter(i => i.eval_status === evalTab).map(idea => (
                <IdeaCard key={idea.id} idea={idea} pColor={pColor}
                  onAccept={() => updateIdea(idea.id, { eval_status: 'accepted', pipeline_stage: 'definition' })}
                  onReject={() => updateIdea(idea.id, { eval_status: 'not_accepted' })}
                  onDelete={() => deleteIdea(idea.id)}
                  showActions={evalTab === 'pending'} />
              ))}
            </div>
          </div>
        )}

        {/* ── Project Definition ── */}
        {activeStage === 'definition' && (
          <div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-3)' }}>
              Rate each idea by Impact and Difficulty, then move it to Validation when ready.
            </p>

            {/* Matrix legend */}
            <div className="card p-4 mb-4">
              <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Priority Guide</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  ['High Impact + Quick Win', 'Priority ⚡', '#16A34A'],
                  ['High Impact + Standard', 'Schedule', '#E8820C'],
                  ['High Impact + Complex', 'Plan Carefully', '#7C3AED'],
                  ['Medium Impact + Quick Win', 'Do It', '#16A34A'],
                  ['Medium Impact + Standard', 'Consider', '#E8820C'],
                  ['Low Impact + Complex', 'Park It', '#DC2626'],
                ].map(([label, rec, color]) => (
                  <div key={label} className="px-2 py-1.5 rounded-lg text-xs" style={{ background: `${color}10` }}>
                    <div className="font-bold mb-0.5" style={{ color }}>{rec}</div>
                    <div style={{ color: 'var(--text-3)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {definitionIdeas.map(idea => (
                <DefinitionCard key={idea.id} idea={idea} pColor={pColor}
                  onUpdate={(changes) => updateIdea(idea.id, changes)}
                  onMoveToValidation={() => updateIdea(idea.id, { pipeline_stage: 'validation', eval_status: 'accepted' })}
                  onSendBack={() => updateIdea(idea.id, { pipeline_stage: 'idea', eval_status: 'pending' })} />
              ))}
              {definitionIdeas.length === 0 && (
                <div className="card p-10 text-center">
                  <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                    No ideas to score yet — accept ideas in the Ideas stage first.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Project Validation ── */}
        {activeStage === 'validation' && (
          <div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-3)' }}>
              Set the KPI baseline, target, and estimated timeline before creating the DMAIC project.
            </p>
            {validationIdeas.length === 0 ? (
              <div className="card p-10 text-center">
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                  No ideas ready for validation. Accept ideas in Project Definition first.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {validationIdeas.map(idea => (
                  <ValidationCard key={idea.id} idea={idea} pColor={pColor}
                    onValidate={() => openValidation(idea)}
                    onCreate={() => createProject(idea)}
                    onSendBack={() => updateIdea(idea.id, { pipeline_stage: 'definition' })}
                    creating={creating} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Assigned Projects ── */}
        {activeStage === 'assigned' && (
          <div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-3)' }}>
              Active DMAIC projects. Click to open and continue working through the improvement tools.
            </p>
            {assignedProjects.length === 0 ? (
              <div className="card p-10 text-center">
                <p className="text-sm mb-3" style={{ color: 'var(--text-3)' }}>No active projects yet. Validate an idea to create one.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignedProjects.map(p => (
                  <AssignedCard key={p.id} project={p} pColor={pColor} onClick={() => setOpenProject(p)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Finished Projects ── */}
        {activeStage === 'finished' && (
          <div>
            {finishedProjects.length === 0 ? (
              <div className="card p-10 text-center">
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>No completed projects yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {finishedProjects.map(p => (
                  <FinishedCard key={p.id} project={p} pColor={pColor} onClick={() => setOpenProject(p)} />
                ))}
                <div className="card p-4 flex items-center justify-between"
                  style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)' }}>
                  <span className="text-sm font-bold" style={{ color: '#4ade80' }}>Total Impact Achieved</span>
                  <span className="text-lg font-bold" style={{ color: '#4ade80' }}>
                    {finishedProjects.length} project{finishedProjects.length !== 1 ? 's' : ''} completed
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── New Idea Modal ── */}
        {showNewIdea && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowNewIdea(false)}>
            <div className="w-full max-w-md rounded-3xl p-6 shadow-2xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-lg" style={{ color: 'var(--text-1)' }}>Add Idea from Meeting</h3>
                <button onClick={() => setShowNewIdea(false)} className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--bg-input)', color: 'var(--text-2)' }}>✕</button>
              </div>
              <form onSubmit={addIdea} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-3)' }}>Idea Title</label>
                  <input value={newIdea.title} onChange={e => setNewIdea(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Reduce pick path distance in Zone B" required
                    className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle} />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-3)' }}>Description</label>
                  <textarea value={newIdea.description} onChange={e => setNewIdea(f => ({ ...f, description: e.target.value }))}
                    placeholder="What did you observe? What's the problem?"
                    rows={2} className="w-full text-sm rounded-xl border px-3 py-2.5 resize-none" style={inputStyle} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-3)' }}>Area</label>
                    <select value={newIdea.area} onChange={e => setNewIdea(f => ({ ...f, area: e.target.value }))}
                      className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle}>
                      {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-3)' }}>Waste Type</label>
                    <select value={newIdea.waste_type} onChange={e => setNewIdea(f => ({ ...f, waste_type: e.target.value }))}
                      className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle}>
                      <option value="">— Select —</option>
                      {WASTE_TYPES.map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-3)' }}>Source</label>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                      <button key={key} type="button" onClick={() => setNewIdea(f => ({ ...f, source: key }))}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{
                          background: newIdea.source === key ? pColor : 'var(--bg-input)',
                          color: newIdea.source === key ? 'white' : 'var(--text-3)',
                        }}>
                        {SOURCE_ICONS[key]} {label}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={!newIdea.title.trim() || creating}
                  className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-40"
                  style={{ background: pColor }}>
                  {creating ? 'Adding…' : 'ADD IDEA →'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Validate Modal ── */}
        {showValidate && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowValidate(null)}>
            <div className="w-full max-w-md rounded-3xl p-6 shadow-2xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-lg" style={{ color: 'var(--text-1)' }}>Validate Project</h3>
                <button onClick={() => setShowValidate(null)} className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--bg-input)', color: 'var(--text-2)' }}>✕</button>
              </div>
              <p className="text-sm mb-5 line-clamp-1" style={{ color: 'var(--text-3)' }}>{showValidate.title}</p>
              <form onSubmit={saveValidation} className="space-y-4">

                {/* Project Type */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Project Type</label>
                    <button type="button" onClick={suggestType} disabled={suggestingType}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all disabled:opacity-50"
                      style={{ background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.2)' }}>
                      {suggestingType ? <span className="animate-spin inline-block">◈</span> : '✦'} AI Suggest
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'quick_win',   label: 'Quick Win',   color: '#16A34A', icon: '⚡', sub: '1–2 wks' },
                      { key: 'yellow_belt', label: 'Yellow Belt', color: '#E8820C', icon: 'Y',  sub: '2–6 wks' },
                      { key: 'green_belt',  label: 'Green Belt',  color: '#3B7FDE', icon: 'G',  sub: '4–12 wks' },
                      { key: 'black_belt',  label: 'Black Belt',  color: '#7C3AED', icon: 'B',  sub: '3–6 mo' },
                    ].map(({ key, label, color, icon, sub }) => {
                      const selected = validateForm.project_type === key
                      return (
                        <button key={key} type="button"
                          onClick={() => { setValidateForm(f => ({ ...f, project_type: key })); setTypeReason('') }}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all"
                          style={{
                            background: selected ? `${color}18` : 'var(--bg-input)',
                            border: `1.5px solid ${selected ? color : 'var(--border)'}`,
                          }}>
                          <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ background: selected ? color : 'var(--border)' }}>{icon}</span>
                          <div>
                            <div className="text-xs font-bold leading-tight" style={{ color: selected ? color : 'var(--text-2)' }}>{label}</div>
                            <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>{sub}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  {/* Investigation — separate track */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                    <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: 'var(--text-3)' }}>— or investigate first —</span>
                    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                  </div>
                  {(() => {
                    const key = 'investigation'
                    const color = '#e11d48'
                    const selected = validateForm.project_type === key
                    return (
                      <button type="button"
                        onClick={() => { setValidateForm(f => ({ ...f, project_type: key })); setTypeReason('') }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all"
                        style={{
                          background: selected ? `${color}18` : 'var(--bg-input)',
                          border: `1.5px solid ${selected ? color : 'var(--border)'}`,
                        }}>
                        <span className="w-6 h-6 rounded-md flex items-center justify-center text-sm flex-shrink-0"
                          style={{ background: selected ? color : 'var(--border)' }}>🔍</span>
                        <div className="flex-1">
                          <div className="text-xs font-bold leading-tight" style={{ color: selected ? color : 'var(--text-2)' }}>Investigation</div>
                          <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>Understand why before you commit to how. Ends with a recommendation to close or escalate.</div>
                        </div>
                      </button>
                    )
                  })()}
                  {typeReason && (
                    <div className="mt-2 px-3 py-2 rounded-lg text-xs leading-relaxed"
                      style={{ background: 'rgba(139,92,246,0.08)', color: 'var(--text-2)', border: '1px solid rgba(139,92,246,0.15)' }}>
                      ✦ {typeReason}
                    </div>
                  )}
                </div>

                {/* KPI guidance + selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                      KPI
                      {validateForm.project_type === 'quick_win' && <span className="font-normal normal-case opacity-60 ml-1">(optional)</span>}
                      {validateForm.project_type === 'yellow_belt' && <span className="font-normal normal-case opacity-60 ml-1">(reference only)</span>}
                    </label>
                  </div>
                  {validateForm.project_type && (
                    <div className="mb-2 text-[11px] leading-relaxed px-3 py-2 rounded-lg"
                      style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
                      {validateForm.project_type === 'quick_win' &&
                        'Skip if the win is obvious. Or pick a KPI to show a rough before/after number at closure.'}
                      {validateForm.project_type === 'yellow_belt' &&
                        'Pick the metric that best represents the problem (e.g. UPH if the issue slows throughput). You\'ll record a before and after value — no ongoing data logging needed.'}
                      {validateForm.project_type === 'green_belt' &&
                        'Pick the primary process metric. You\'ll log actual data points over time and the app will plot a verification chart to prove the improvement held.'}
                      {validateForm.project_type === 'black_belt' &&
                        'Pick the critical-to-quality metric. Multi-week data collection will feed statistical analysis (control charts, before/after means) to validate and sustain the improvement.'}
                      {validateForm.project_type === 'investigation' &&
                        'KPI is optional — focus is on understanding the problem, not measuring a target improvement. Select one if you want to benchmark current state.'}
                    </div>
                  )}
                  <select value={validateForm.metric_id} onChange={e => setValidateForm(f => ({ ...f, metric_id: e.target.value }))}
                    className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle}>
                    <option value="">— Select KPI —</option>
                    <option value="uph">UPH — Units Per Hour (throughput)</option>
                    <option value="accuracy">Pick Accuracy — % correct picks</option>
                    <option value="dpmo">DPMO — Defects Per Million Opportunities</option>
                    <option value="dts">DTS — Dock to Stock time (mins)</option>
                    <option value="custom">Custom metric…</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-3)' }}>
                      {validateForm.project_type === 'quick_win' || validateForm.project_type === 'yellow_belt' ? 'Current value (approx.)' : 'Baseline'}
                    </label>
                    <input value={validateForm.baseline} onChange={e => setValidateForm(f => ({ ...f, baseline: e.target.value }))}
                      type="number" step="any" placeholder="e.g. 84"
                      className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle} />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-3)' }}>
                      {validateForm.project_type === 'quick_win' || validateForm.project_type === 'yellow_belt' ? 'Goal value' : 'Target'}
                    </label>
                    <input value={validateForm.target_value} onChange={e => setValidateForm(f => ({ ...f, target_value: e.target.value }))}
                      type="number" step="any" placeholder="e.g. 97"
                      className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-3)' }}>Estimated Weeks</label>
                  <input value={validateForm.estimated_weeks} onChange={e => setValidateForm(f => ({ ...f, estimated_weeks: e.target.value }))}
                    type="number" min="1" max="52" placeholder="4"
                    className="w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle} />
                </div>
                <button type="submit"
                  className="w-full py-3 rounded-xl text-white font-bold text-sm"
                  style={{ background: pColor }}>
                  SAVE VALIDATION →
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Portfolio Dashboard ───
  return (
    <div className="max-w-[900px] flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold mb-4"
        style={{ color: 'var(--text-3)' }}>
        ← All Portfolios
      </button>

      {/* Portfolio header */}
      <div className="card p-4 mb-4" style={{ position: 'relative' }}>
        <PresentationHotspot id="portfolio-health" demoMode={demoMode} />
        <div className="flex items-center gap-4">
          {/* Compass */}
          <div className="flex-shrink-0 relative w-14 h-14">
            <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
              <circle cx="28" cy="28" r="22" fill="none" strokeWidth="4" stroke="var(--bg-input)" />
              <circle cx="28" cy="28" r="22" fill="none" strokeWidth="4"
                stroke={pColor}
                strokeDasharray={`${completedPct * 1.382} 138.2`}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-bold leading-none" style={{ color: pColor }}>{completedPct}%</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-lg font-bold truncate" style={{ color: 'var(--text-1)' }}>{portfolio.name}</h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: `${pColor}18`, color: pColor }}>{portfolio.area_focus}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>
                  {METRIC_LABELS[portfolio.primary_kpi]}
                </span>
              </div>
            </div>
            {portfolio.strategic_objective && (
              <p className="text-xs mb-2 line-clamp-1" style={{ color: 'var(--text-3)' }}>{portfolio.strategic_objective}</p>
            )}
            {/* Impact stats inline */}
            <div className="flex items-center gap-4">
              {[
                ['Goal', portfolio.impact_goal ? `${portfolio.impact_goal} ${portfolio.impact_unit}` : '—', pColor],
                ['Pipeline', summary ? `${summary.ideaCount + summary.definitionCount + summary.validationCount}` : '—', '#7C3AED'],
                ['Active', summary ? `${summary.assignedCount}` : '—', '#16A34A'],
                ['Done', summary ? `${summary.finishedCount}` : '—', '#059669'],
              ].map(([label, val, color]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="text-xs font-bold" style={{ color }}>{val}</span>
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline stage cards */}
      <div className="grid grid-cols-5 gap-2" style={{ position: 'relative' }}>
        <PresentationHotspot id="portfolio-pipeline" demoMode={demoMode} />
        {STAGES.map((stage, i) => {
          const counts = [ideaStageIdeas, definitionIdeas, validationIdeas, assignedProjects, finishedProjects]
          const count = counts[i].length
          const pending = i < 2
            ? counts[i].filter(x => x.eval_status === 'pending').length
            : 0
          const stageColors = ['#E8820C','#7C3AED','#3B7FDE','#16A34A','#059669']
          const c = stageColors[i]

          return (
            <div key={stage.id} className="card p-3 flex flex-col gap-2 cursor-pointer hover:opacity-80 transition-all"
              onClick={() => { setActiveStage(stage.id); setEvalTab('pending') }}>
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: c }}>{stage.short}</div>
                {pending > 0 && (
                  <span className="font-bold w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px]"
                    style={{ background: '#DC2626' }}>{pending}</span>
                )}
              </div>
              <div className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>{count}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>{stage.desc.split('.')[0]}.</div>
              <button className="w-full flex items-center justify-center py-1.5 rounded-lg text-[10px] font-bold text-white transition-all mt-auto"
                style={{ background: c }}>
                GO →
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Below the fold: pending ideas + active projects ── */}
      <div className="grid grid-cols-2 gap-4 mt-4 flex-1 min-h-0">

        {/* Pending Ideas */}
        <div className="card p-4 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)', letterSpacing: '0.08em' }}>
              Pending Review
            </div>
            {ideaStageIdeas.filter(i => i.eval_status === 'pending').length > 0 && (
              <button onClick={() => { setActiveStage('idea'); setEvalTab('pending') }}
                className="text-[10px] font-bold" style={{ color: pColor }}>
                Review all →
              </button>
            )}
          </div>
          {ideaStageIdeas.filter(i => i.eval_status === 'pending').length === 0 ? (
            <div className="py-6 text-center">
              <div className="text-xs" style={{ color: 'var(--text-3)' }}>No ideas awaiting review</div>
              <div className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>Log observations to surface new ideas</div>
            </div>
          ) : (
            <div className="space-y-2">
              {ideaStageIdeas.filter(i => i.eval_status === 'pending').slice(0, 4).map(idea => (
                <button key={idea.id}
                  onClick={() => { setActiveStage('idea'); setEvalTab('pending') }}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:opacity-80 transition-opacity"
                  style={{ background: 'var(--bg-input)' }}>
                  <div className="flex items-start gap-2">
                    <span className="text-sm flex-shrink-0 mt-0.5">{SOURCE_ICONS[idea.source] || '✎'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate" style={{ color: 'var(--text-1)' }}>{idea.title}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                        {idea.area}{idea.waste_type ? ` · ${idea.waste_type}` : ''}
                      </div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--accent)' }}>Review</span>
                  </div>
                </button>
              ))}
              {ideaStageIdeas.filter(i => i.eval_status === 'pending').length > 4 && (
                <div className="text-[10px] text-center pt-1" style={{ color: 'var(--text-3)' }}>
                  +{ideaStageIdeas.filter(i => i.eval_status === 'pending').length - 4} more
                </div>
              )}
            </div>
          )}
        </div>

        {/* Active Projects */}
        <div className="card p-4 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)', letterSpacing: '0.08em' }}>
              Active Projects
            </div>
            {assignedProjects.length > 0 && (
              <button onClick={() => setActiveStage('assigned')}
                className="text-[10px] font-bold" style={{ color: pColor }}>
                View all →
              </button>
            )}
          </div>
          {assignedProjects.length === 0 ? (
            <div className="py-6 text-center">
              <div className="text-xs" style={{ color: 'var(--text-3)' }}>No active projects yet</div>
              <div className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>Validate an idea to create one</div>
            </div>
          ) : (
            <div className="space-y-2">
              {assignedProjects.slice(0, 4).map(p => {
                const PHASE_COLORS = { Define: '#3B7FDE', Measure: '#7C3AED', Analyse: '#DC2626', Improve: '#16A34A', Control: '#059669' }
                const stageColor = PHASE_COLORS[p.stage] || '#6B7280'
                const checklist = p.stage_checklist || {}
                const done = ['charter','baseline','process','clues','rootcause','solutions','actions','results','summary'].filter(t => checklist[t]).length
                const pct = Math.round((done / 9) * 100)
                return (
                  <button key={p.id}
                    onClick={() => setOpenProject(p)}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:opacity-80 transition-opacity"
                    style={{ background: 'var(--bg-input)' }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-semibold truncate flex-1" style={{ color: 'var(--text-1)' }}>{p.title}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background: `${stageColor}18`, color: stageColor }}>{p.stage}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full" style={{ background: 'var(--bg-card)' }}>
                        <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: stageColor }} />
                      </div>
                      <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-3)' }}>{pct}%</span>
                    </div>
                  </button>
                )
              })}
              {assignedProjects.length > 4 && (
                <div className="text-[10px] text-center pt-1" style={{ color: 'var(--text-3)' }}>
                  +{assignedProjects.length - 4} more
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───

function IdeaAgeBadge({ idea }) {
  const days = idea.created_at
    ? Math.floor((Date.now() - new Date(idea.created_at).getTime()) / 86400000)
    : 0
  if (days <= 7) return null
  return (
    <span className="text-[10px] font-semibold flex-shrink-0"
      style={{ color: days > 14 ? '#f87171' : '#fb923c' }}>
      {days > 14 ? '●' : '◑'} {days}d{days > 14 ? ' — needs attention' : ''}
    </span>
  )
}

function IdeaCard({ idea, pColor, onAccept, onReject, onDelete, showActions }) {
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0 mt-0.5">{SOURCE_ICONS[idea.source] || '✎'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{idea.title}</p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <IdeaAgeBadge idea={idea} />
              {idea.area && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>{idea.area}</span>}
              {idea.waste_type && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>{idea.waste_type}</span>}
            </div>
          </div>
          {idea.description && <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{idea.description}</p>}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{SOURCE_LABELS[idea.source] || idea.source}</span>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{idea.created_at?.split('T')[0]}</span>
          </div>
        </div>
        {showActions && (
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={onAccept}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
              style={{ background: '#16A34A' }}>Accept</button>
            <button onClick={onReject}
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: 'var(--bg-input)', color: 'var(--text-3)' }}>Decline</button>
          </div>
        )}
        {!showActions && (
          <button onClick={onDelete} className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>✕</button>
        )}
      </div>
    </div>
  )
}

function DefinitionCard({ idea, pColor, onUpdate, onMoveToValidation, onSendBack }) {
  const isPriority = idea.impact === 'high' && idea.difficulty === 'quick_win'
  const canProgress = idea.impact && idea.difficulty
  return (
    <div className="card p-4">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2.5 flex-wrap">
            <p className="text-sm font-semibold flex-1 min-w-0" style={{ color: 'var(--text-1)' }}>{idea.title}</p>
            {isPriority && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: 'rgba(22,163,74,0.15)', color: '#16A34A' }}>⚡ PRIORITY</span>
            )}
            <IdeaAgeBadge idea={idea} />
          </div>
          <div className="flex items-center gap-5">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>Impact</div>
              <div className="flex gap-1">
                {['high','medium','low'].map(v => (
                  <button key={v} onClick={() => onUpdate({ impact: v })}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all"
                    style={{
                      background: idea.impact === v ? IMPACT_COLORS[v] : 'var(--bg-input)',
                      color: idea.impact === v ? 'white' : 'var(--text-3)',
                    }}>{v}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>Difficulty</div>
              <div className="flex gap-1">
                {['quick_win','standard','complex'].map(v => (
                  <button key={v} onClick={() => onUpdate({ difficulty: v })}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: idea.difficulty === v ? DIFFICULTY_COLORS[v] : 'var(--bg-input)',
                      color: idea.difficulty === v ? 'white' : 'var(--text-3)',
                    }}>{DIFFICULTY_LABELS[v]}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <button onClick={onMoveToValidation} disabled={!canProgress}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-30 transition-all"
            style={{ background: canProgress ? pColor : '#6B7280' }}>
            To Validation →
          </button>
          <button onClick={onSendBack}
            className="text-[10px] font-semibold"
            style={{ color: 'var(--text-3)' }}>
            ← Back to Ideas
          </button>
        </div>
      </div>
    </div>
  )
}

function ValidationCard({ idea, pColor, onValidate, onCreate, onSendBack, creating }) {
  const isReady = idea.metric_id && idea.baseline != null && idea.target_value != null
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <p className="text-sm font-semibold flex-1 min-w-0" style={{ color: 'var(--text-1)' }}>{idea.title}</p>
            <IdeaAgeBadge idea={idea} />
          </div>
          {isReady ? (
            <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-3)' }}>
              <span className="font-semibold" style={{ color: pColor }}>{idea.metric_id?.toUpperCase()}</span>
              <span>{idea.baseline} → {idea.target_value}</span>
              <span>{idea.estimated_weeks}w estimated</span>
              <span className="font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>✓ Ready</span>
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Set KPI, baseline, and target to validate</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="flex gap-2">
            <button onClick={onValidate}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'var(--bg-input)', color: 'var(--text-2)' }}>
              {isReady ? 'Edit' : 'Set KPI →'}
            </button>
            {isReady && (
              <button onClick={onCreate} disabled={creating}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
                style={{ background: pColor }}>
                {creating ? '…' : 'Create Project →'}
              </button>
            )}
          </div>
          <button onClick={onSendBack}
            className="text-[10px] font-semibold"
            style={{ color: 'var(--text-3)' }}>
            ← Back to Definition
          </button>
        </div>
      </div>
    </div>
  )
}

function AssignedCard({ project, pColor, onClick }) {
  const PHASE_COLORS = { Define: '#3B7FDE', Measure: '#7C3AED', Analyse: '#DC2626', Improve: '#16A34A', Control: '#059669' }
  const checklist = project.stage_checklist || {}
  const done = [
    'charter','baseline','process','clues','rootcause','solutions','actions','results','summary'
  ].filter(t => checklist[t]).length
  const pct = Math.round((done / 9) * 100)
  const stageColor = PHASE_COLORS[project.stage] || '#6B7280'

  const lastUpdated = project.updated_at ? new Date(project.updated_at) : null
  const daysSince = lastUpdated ? Math.floor((Date.now() - lastUpdated.getTime()) / 86400000) : 999
  const status = daysSince < 7 ? 'Active' : daysSince < 14 ? 'Stalled' : 'Inactive'
  const statusColors = { Active: '#16A34A', Stalled: '#E8820C', Inactive: '#DC2626' }

  return (
    <div className="card p-4 cursor-pointer hover:opacity-80 transition-all" onClick={onClick}>
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>{project.title}</p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: `${stageColor}18`, color: stageColor }}>{project.stage}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: `${statusColors[status]}12`, color: statusColors[status] }}>{status}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--bg-input)' }}>
              <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: stageColor }} />
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>{pct}% tools</span>
          </div>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-xl flex-shrink-0"
          style={{ background: `${pColor}15`, color: pColor }}>Open →</span>
      </div>
    </div>
  )
}

function FinishedCard({ project, pColor, onClick }) {
  const charter = project.charter || {}
  const latestKpiKey = `kpiAchieved`
  const improvement = project.baseline != null && charter[latestKpiKey] != null
    ? ((charter[latestKpiKey] - project.baseline) / project.baseline * 100).toFixed(1)
    : null
  const isTier2Ready = improvement != null && Math.abs(parseFloat(improvement)) >= 10

  return (
    <div className="card p-4 cursor-pointer hover:opacity-80 transition-all" onClick={onClick}>
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>{project.title}</p>
            {isTier2Ready && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: 'rgba(59,127,222,0.15)', color: '#60a5fa' }}>◆ Tier 2 Ready</span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-3)' }}>
            {project.metric_id && <span>{project.metric_id.toUpperCase()}</span>}
            {project.baseline != null && <span>{project.baseline} → {charter[latestKpiKey] ?? '—'}</span>}
            {improvement != null && (
              <span className="font-bold" style={{ color: parseFloat(improvement) >= 0 ? '#4ade80' : '#f87171' }}>
                {parseFloat(improvement) >= 0 ? '+' : ''}{improvement}%
              </span>
            )}
          </div>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-xl flex-shrink-0"
          style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>✓ Done</span>
      </div>
    </div>
  )
}
