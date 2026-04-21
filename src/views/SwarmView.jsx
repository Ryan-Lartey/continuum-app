import { useState, useEffect, useRef } from 'react'
import { api, streamSwarm } from '../lib/api.js'

const AGENT_COLORS = {
  'chief-of-staff': '#E8820C',
  'gemba-agent':    '#3b82f6',
  'kpi-analyst':    '#8b5cf6',
  'situation-room': '#ec4899',
  'project-agent':  '#10b981',
  'gm-report':      '#f59e0b',
}

function AgentChip({ id, name, status }) {
  const color = AGENT_COLORS[id] || '#6b7280'
  const bgAlpha = status === 'active' ? '0.18' : status === 'done' ? '0.10' : '0.05'
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
      style={{
        background: `rgba(${hexToRgb(color)},${bgAlpha})`,
        border: `1px solid rgba(${hexToRgb(color)},${status === 'idle' ? '0.15' : '0.4'})`,
        color: status === 'idle' ? 'var(--text-3)' : color,
        opacity: status === 'idle' ? 0.5 : 1,
      }}>
      {status === 'active' && (
        <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: color }} />
      )}
      {status === 'done' && (
        <span className="text-[10px] flex-shrink-0">✓</span>
      )}
      {status === 'idle' && (
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--text-3)' }} />
      )}
      {name}
    </div>
  )
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

function WorkflowCard({ workflow, onRun, disabled }) {
  return (
    <button
      onClick={() => onRun(workflow.id)}
      disabled={disabled}
      className="text-left rounded-2xl p-5 border transition-all hover:border-[#E8820C]/40 hover:bg-[#E8820C]/5 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: 'rgba(232,130,12,0.12)', color: '#E8820C' }}>
          {workflow.icon}
        </div>
        <div>
          <div className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{workflow.name}</div>
          <div className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-3)' }}>{workflow.description}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {workflow.agents.map(a => (
          <span key={a.id} className="text-[10px] px-2 py-0.5 rounded-full"
            style={{
              background: `rgba(${hexToRgb(AGENT_COLORS[a.id] || '#6b7280')},0.08)`,
              color: AGENT_COLORS[a.id] || 'var(--text-3)',
              border: `1px solid rgba(${hexToRgb(AGENT_COLORS[a.id] || '#6b7280')},0.2)`,
            }}>
            {a.name}
          </span>
        ))}
      </div>
    </button>
  )
}

export default function SwarmView() {
  const [workflows, setWorkflows] = useState([])
  const [running, setRunning] = useState(false)
  const [activeWorkflow, setActiveWorkflow] = useState(null)
  const [phase, setPhase] = useState(null)
  const [agentStatuses, setAgentStatuses] = useState({})
  const [agentResults, setAgentResults] = useState({})
  const [streamText, setStreamText] = useState('')
  const [streamAgent, setStreamAgent] = useState(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)
  const outputRef = useRef(null)

  useEffect(() => {
    fetch('/api/swarm/workflows').then(r => r.json()).then(setWorkflows).catch(() => {})
  }, [])

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [streamText, agentResults])

  function reset() {
    setRunning(false)
    setActiveWorkflow(null)
    setPhase(null)
    setAgentStatuses({})
    setAgentResults({})
    setStreamText('')
    setStreamAgent(null)
    setDone(false)
    setError(null)
  }

  function runWorkflow(workflowId) {
    const wf = workflows.find(w => w.id === workflowId)
    reset()
    setRunning(true)
    setActiveWorkflow(wf)

    const allAgents = wf.agents.reduce((acc, a) => ({ ...acc, [a.id]: 'idle' }), {})
    setAgentStatuses(allAgents)

    streamSwarm(
      workflowId,
      (event) => {
        if (event.type === 'phase') {
          setPhase({ index: event.index, total: event.total, label: event.label })
        } else if (event.type === 'agent-start') {
          setAgentStatuses(prev => ({ ...prev, [event.agent]: 'active' }))
          if (event.agent !== streamAgent) setStreamAgent(event.agent)
        } else if (event.type === 'agent-done') {
          setAgentStatuses(prev => ({ ...prev, [event.agent]: 'done' }))
          if (event.text) {
            setAgentResults(prev => ({ ...prev, [event.agent]: { name: event.name, text: event.text } }))
          }
        } else if (event.type === 'stream') {
          setStreamText(prev => prev + event.text)
          setStreamAgent(event.agent)
        } else if (event.type === 'complete') {
          setDone(true)
          setRunning(false)
        } else if (event.type === 'error') {
          setError(event.text)
          setRunning(false)
        }
      },
      () => { setRunning(false) },
      (err) => { setError(err?.message || 'Connection error'); setRunning(false) }
    )
  }

  const hasOutput = streamText || Object.keys(agentResults).length > 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Multi-Agent Swarm</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            Coordinated agent workflows — multiple specialists working in parallel, then synthesising
          </p>
        </div>
        {activeWorkflow && (
          <button onClick={reset}
            className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:border-[#E8820C]/40"
            style={{ color: 'var(--text-2)', borderColor: 'var(--border)' }}>
            ← New workflow
          </button>
        )}
      </div>

      {/* Workflow cards — shown when idle */}
      {!activeWorkflow && (
        <div className="grid grid-cols-1 gap-4">
          {workflows.map(wf => (
            <WorkflowCard key={wf.id} workflow={wf} onRun={runWorkflow} disabled={running} />
          ))}
          {workflows.length === 0 && (
            <div className="text-center py-12 text-sm" style={{ color: 'var(--text-3)' }}>
              Loading workflows…
            </div>
          )}
        </div>
      )}

      {/* Execution panel */}
      {activeWorkflow && (
        <div className="space-y-4">
          {/* Workflow title + phase progress */}
          <div className="rounded-2xl p-4 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{activeWorkflow.icon}</span>
                <span className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{activeWorkflow.name}</span>
              </div>
              {phase && (
                <span className="text-[11px] px-2.5 py-1 rounded-full font-medium"
                  style={{ background: 'rgba(232,130,12,0.12)', color: '#E8820C' }}>
                  Phase {phase.index}/{phase.total} · {phase.label}
                </span>
              )}
              {done && (
                <span className="text-[11px] px-2.5 py-1 rounded-full font-medium"
                  style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>
                  ✓ Complete
                </span>
              )}
            </div>

            {/* Agent status chips */}
            <div className="flex flex-wrap gap-2">
              {activeWorkflow.agents.map(a => (
                <AgentChip
                  key={a.id}
                  id={a.id}
                  name={a.name}
                  status={agentStatuses[a.id] || 'idle'}
                />
              ))}
            </div>
          </div>

          {/* Parallel agent outputs */}
          {Object.keys(agentResults).length > 0 && (
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(agentResults).map(([agentId, { name, text }]) => (
                <div key={agentId} className="rounded-xl p-4 border"
                  style={{ background: 'var(--bg-card)', borderColor: `rgba(${hexToRgb(AGENT_COLORS[agentId] || '#6b7280')},0.25)` }}>
                  <div className="text-[11px] font-semibold mb-2 uppercase tracking-wide"
                    style={{ color: AGENT_COLORS[agentId] || 'var(--text-3)' }}>
                    {name}
                  </div>
                  <div className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-2)' }}>
                    {text}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Streaming synthesis output */}
          {(streamText || (running && streamAgent)) && (
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <div className="px-4 py-2.5 border-b flex items-center gap-2"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                {streamAgent && (
                  <>
                    <span className="w-2 h-2 rounded-full animate-pulse"
                      style={{ background: AGENT_COLORS[streamAgent] || '#E8820C' }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: AGENT_COLORS[streamAgent] || '#E8820C' }}>
                      {activeWorkflow.agents.find(a => a.id === streamAgent)?.name || streamAgent}
                    </span>
                  </>
                )}
                {done && <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>Synthesis complete</span>}
              </div>
              <div ref={outputRef}
                className="p-5 max-h-[28rem] overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap font-mono"
                style={{ background: 'var(--bg-page)', color: 'var(--text-1)' }}>
                {streamText}
                {running && !done && (
                  <span className="inline-block w-2 h-4 ml-0.5 animate-pulse rounded-sm"
                    style={{ background: '#E8820C', verticalAlign: 'text-bottom' }} />
                )}
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="rounded-xl p-4 border text-sm"
              style={{ background: 'rgba(248,113,113,0.08)', borderColor: 'rgba(248,113,113,0.3)', color: '#f87171' }}>
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
