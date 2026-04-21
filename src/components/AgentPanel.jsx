import { useState, useEffect, useRef } from 'react'
import { streamAgent } from '../lib/api.js'

const AGENTS = [
  { id: 'chief-of-staff',   name: 'Chief of Staff',    icon: '◈', color: '#E8820C', desc: 'Morning brief, priorities, accountability',
    starters: ['Generate my morning brief', "What should I focus on today?", 'Review my week'] },
  { id: 'gemba-agent',      name: 'Gemba Agent',        icon: '◎', color: '#16A34A', desc: 'Structure observations, identify waste patterns',
    starters: ['Help me classify this waste', 'What patterns am I seeing?', 'What should I walk today?'] },
  { id: 'kpi-analyst',      name: 'KPI Analyst',        icon: '▲', color: '#3B7FDE', desc: 'Interpret signals, data narratives for meetings',
    starters: ['Interpret my latest KPI signals', 'Prepare Tier 2 data narrative', 'Is my process in control?'] },
  { id: 'project-agent',    name: 'Project Agent',      icon: '◆', color: '#7C3AED', desc: 'DMAIC guide, problem statements, 5-why',
    starters: ['Write a problem statement for me', 'Run a 5-why analysis', 'What stage should I advance to?'] },
  { id: 'situation-room',   name: 'Situation Room',     icon: '⬡', color: '#DC2626', desc: 'Meeting prep, crisis response, Tier 2 talking points',
    starters: ['Prep me for Tier 2', 'How do I handle this escalation?', 'Build my Tier 2 talking points'] },
  { id: '5s-audit',         name: '5S Audit',           icon: '✦', color: '#E8820C', desc: 'Zone scoring, audit prep, corrective actions',
    starters: ['Score my zone', 'Prep for next audit', 'Generate corrective actions'] },
  { id: 'gm-report',        name: 'GM Report Writer',   icon: '◉', color: '#6B7280', desc: 'Weekly report generation from live data',
    starters: ['Generate weekly GM report', 'Draft executive summary', "Summarise this week's performance"] },
  { id: 'people-influence', name: 'People & Influence', icon: '□', color: '#3B7FDE', desc: 'Change management, TL buy-in, difficult conversations',
    starters: ['Help me get TL buy-in', 'How do I handle resistance?', 'Write talking points for this change'] },
]

function parseXmlSaves(text) {
  const saves = []
  const ps = text.match(/<PS>([\s\S]*?)<\/PS>/)
  if (ps) saves.push({ type: 'ps', label: 'Save as problem statement', value: ps[1].trim() })

  const rc = text.match(/<RC>([\s\S]*?)<\/RC>/)
  if (rc) saves.push({ type: 'rc', label: 'Save as root cause', value: rc[1].trim() })

  const sop = text.match(/<SOP>([\s\S]*?)<\/SOP>/)
  if (sop) saves.push({ type: 'sop', label: 'Save as SOP', value: sop[1].trim() })

  const actions = text.match(/<ACTIONS>([\s\S]*?)<\/ACTIONS>/)
  if (actions) {
    const items = actions[1].trim().split('||').map(a => {
      const [text, owner] = a.split('|')
      return { text: text?.trim(), owner: owner?.trim() || '', done: false }
    }).filter(a => a.text)
    saves.push({ type: 'actions', label: `Add ${items.length} action${items.length !== 1 ? 's' : ''} to project`, value: items })
  }

  const charter = text.match(/<CHARTER>([\s\S]*?)<\/CHARTER>/)
  if (charter) {
    const [businessCase, scopeIn, scopeOut, benefits] = charter[1].split('|||')
    saves.push({ type: 'charter', label: 'Save charter fields', value: { businessCase: businessCase?.trim(), scopeIn: scopeIn?.trim(), scopeOut: scopeOut?.trim(), benefits: benefits?.trim() } })
  }

  return saves
}

function cleanText(text) {
  return text
    .replace(/<PS>[\s\S]*?<\/PS>/g, '')
    .replace(/<RC>[\s\S]*?<\/RC>/g, '')
    .replace(/<SOP>[\s\S]*?<\/SOP>/g, '')
    .replace(/<ACTIONS>[\s\S]*?<\/ACTIONS>/g, '')
    .replace(/<CHARTER>[\s\S]*?<\/CHARTER>/g, '')
    .trim()
}

function renderBold(line) {
  const parts = line.split(/\*\*(.+?)\*\*/g)
  return parts.map((p, i) => i % 2 === 1 ? <strong key={i} style={{ color: 'var(--text-1)', fontWeight: 700 }}>{p}</strong> : p)
}

function MarkdownMessage({ text }) {
  const lines = text.split('\n')
  const elements = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^### /.test(line)) {
      elements.push(<div key={i} style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-1)', marginTop: 8, marginBottom: 2 }}>{renderBold(line.slice(4))}</div>)
    } else if (/^## /.test(line)) {
      elements.push(<div key={i} style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)', marginTop: 10, marginBottom: 3 }}>{renderBold(line.slice(3))}</div>)
    } else if (/^# /.test(line)) {
      elements.push(<div key={i} style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-1)', marginTop: 12, marginBottom: 4 }}>{renderBold(line.slice(2))}</div>)
    } else if (/^[-*] /.test(line)) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
          <span style={{ color: 'var(--text-3)', flexShrink: 0, marginTop: 1 }}>•</span>
          <span>{renderBold(line.slice(2))}</span>
        </div>
      )
    } else if (/^\d+\. /.test(line)) {
      const match = line.match(/^(\d+)\. (.*)/)
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
          <span style={{ color: 'var(--text-3)', flexShrink: 0, minWidth: 16 }}>{match[1]}.</span>
          <span>{renderBold(match[2])}</span>
        </div>
      )
    } else if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />)
    } else if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: 6 }} />)
    } else {
      elements.push(<div key={i} style={{ marginBottom: 1 }}>{renderBold(line)}</div>)
    }
    i++
  }
  return <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-2)' }}>{elements}</div>
}

export default function AgentPanel({ agentId, initialMessage, onClose, onSave, projectContext, embedded = false }) {
  const agent     = AGENTS.find(a => a.id === agentId) || AGENTS[0]
  const storageKey = `agent-msgs-${agentId}${projectContext ? '-embedded' : ''}`

  const [messages, setMessages] = useState(() => {
    if (embedded) return []
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [input, setInput]       = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [savedKeys, setSavedKeys]   = useState({})
  const scrollRef   = useRef(null)
  const initFired   = useRef(false)

  useEffect(() => {
    if (!embedded) {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-40)))
    }
  }, [messages, storageKey, embedded])

  // Send without showing the user bubble — used for initial embedded prompts
  function sendSilent(text) {
    if (!text.trim() || streaming) return
    setStreaming(true)
    setStreamText('')
    const apiMessages = [{ role: 'user', content: text }]
    let accumulated = ''
    streamAgent(agentId, apiMessages, projectContext,
      (chunk) => { accumulated += chunk; setStreamText(accumulated) },
      () => {
        setMessages(prev => [...prev, { role: 'assistant', content: accumulated }])
        setStreamText(''); setStreaming(false)
      },
      (err) => {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err}` }])
        setStreamText(''); setStreaming(false)
      }
    )
  }

  useEffect(() => {
    if (initFired.current) return
    initFired.current = true
    if (embedded) {
      const prompt = initialMessage || `I'm looking at this project. Give me a sharp, stage-specific briefing on exactly what to do next. No preamble.`
      sendSilent(prompt)
    } else if (initialMessage) {
      sendMessage(initialMessage)
    }
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamText])

  function sendMessage(text) {
    if (!text.trim() || streaming) return
    const userMsg = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreaming(true)
    setStreamText('')

    const apiMessages = [...messages.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: text }]

    let accumulated = ''
    streamAgent(
      agentId,
      apiMessages,
      projectContext,
      (chunk) => { accumulated += chunk; setStreamText(accumulated) },
      () => {
        setMessages(prev => [...prev, { role: 'assistant', content: accumulated }])
        setStreamText('')
        setStreaming(false)
      },
      (err) => {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err}` }])
        setStreamText('')
        setStreaming(false)
      }
    )
  }

  const containerClass = embedded
    ? 'flex flex-col h-full'
    : 'fixed inset-y-0 right-0 w-[360px] shadow-2xl z-50 flex flex-col slide-right'

  const containerStyle = embedded
    ? {}
    : { background: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }

  return (
    <div className={containerClass} style={containerStyle}>
      {/* Header */}
      {!embedded && (
        <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <span className="text-xl" style={{ color: agent.color }}>{agent.icon}</span>
          <div className="flex-1">
            <div className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{agent.name}</div>
            <div className="text-xs" style={{ color: 'var(--text-3)' }}>{agent.desc}</div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button onClick={() => { setMessages([]); localStorage.removeItem(storageKey) }}
                className="text-xs px-2 py-1 rounded-lg"
                style={{ color: 'var(--text-3)', background: 'var(--bg-input)' }}
                title="Clear conversation">✕ Clear</button>
            )}
            <button onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
              style={{ background: 'var(--bg-input)', color: 'var(--text-2)' }}>✕</button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && !streaming && (
          <div className="space-y-2">
            <p className="text-xs text-center pt-4" style={{ color: 'var(--text-3)' }}>Try a starter prompt</p>
            {agent.starters.map((s, i) => (
              <button key={i} onClick={() => sendMessage(s)}
                className="w-full text-left text-xs rounded-xl px-3 py-2 border"
                style={{ color: 'var(--text-2)', background: 'var(--bg-input)', borderColor: 'var(--border)' }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => {
          const saves       = m.role === 'assistant' ? parseXmlSaves(m.content) : []
          const displayText = m.role === 'assistant' ? cleanText(m.content) : m.content
          return (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[92%]">
                <div className={`px-3 py-2 text-xs leading-relaxed ${m.role === 'user' ? 'chat-user' : 'chat-agent'}`}>
                  {m.role === 'assistant'
                    ? <MarkdownMessage text={displayText} />
                    : <pre className="whitespace-pre-wrap font-sans">{displayText}</pre>}
                </div>
                {saves.length > 0 && onSave && (
                  <div className="mt-1 space-y-1">
                    {saves.map((s, si) => {
                      const key = `${i}-${si}`
                      const saved = savedKeys[key]
                      return (
                        <button key={si} onClick={async () => {
                          await onSave(s)
                          setSavedKeys(prev => ({ ...prev, [key]: true }))
                          setTimeout(() => setSavedKeys(prev => ({ ...prev, [key]: false })), 2500)
                        }}
                          className="w-full text-left text-xs rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 border transition-all"
                          style={saved
                            ? { background: 'rgba(74,222,128,0.15)', color: '#4ade80', borderColor: 'rgba(74,222,128,0.35)' }
                            : { background: 'rgba(74,222,128,0.08)', color: '#4ade80', borderColor: 'rgba(74,222,128,0.2)' }}>
                          <span>{saved ? '✓' : '↓'}</span> {saved ? 'Saved' : s.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {streaming && streamText && (
          <div className="flex justify-start">
            <div className="chat-agent px-3 py-2 max-w-[92%]">
              <MarkdownMessage text={cleanText(streamText)} />
              <span className="inline-block w-1 h-3 animate-pulse ml-0.5" style={{ background: 'var(--text-2)' }} />
            </div>
          </div>
        )}

        {streaming && !streamText && (
          <div className="flex justify-start">
            <div className="chat-agent px-3 py-3" style={{ minWidth: 160 }}>
              <div className="space-y-2">
                <div className="h-2 rounded-full animate-pulse" style={{ background: 'var(--bg-hover)', width: '85%' }} />
                <div className="h-2 rounded-full animate-pulse" style={{ background: 'var(--bg-hover)', width: '65%', animationDelay: '0.15s' }} />
                <div className="h-2 rounded-full animate-pulse" style={{ background: 'var(--bg-hover)', width: '75%', animationDelay: '0.3s' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-3 flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        <form onSubmit={e => { e.preventDefault(); sendMessage(input) }} className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask anything…"
            disabled={streaming}
            className="flex-1 text-xs rounded-xl px-3 py-2 border"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border2)', color: 'var(--text-1)' }}
          />
          <button type="submit" disabled={!input.trim() || streaming}
            className="w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-40"
            style={{ background: agent.color, color: 'white' }}>
            ↑
          </button>
        </form>
      </div>
    </div>
  )
}

export { AGENTS }
