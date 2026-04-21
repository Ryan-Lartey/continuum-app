import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  getBezierPath,
  getSmoothStepPath,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { api } from '../lib/api.js'
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  GitFork,
  Download,
  Pencil,
  Check,
  X,
  Layers,
} from 'lucide-react'

// ─── Colour tokens ────────────────────────────────────────────────────────────
const NAVY    = '#0F172A'
const NAVY2   = '#1E293B'
const ORANGE  = '#F97316'
const BG      = '#F8FAFC'
const BORDER  = '#E2E8F0'
const TEXT1   = '#111827'
const TEXT3   = '#64748B'

// ─── Default swimlanes ────────────────────────────────────────────────────────
const DEFAULT_SWIMLANES = [
  { id: 'sl-inbound', label: 'INBOUND', color: 'rgba(59,130,246,0.07)'  },
  { id: 'sl-icqa',    label: 'ICQA',    color: 'rgba(168,85,247,0.07)'  },
  { id: 'sl-pick',    label: 'PICK',    color: 'rgba(34,197,94,0.07)'   },
  { id: 'sl-pack',    label: 'PACK',    color: 'rgba(249,115,22,0.07)'  },
  { id: 'sl-ship',    label: 'SHIP',    color: 'rgba(239,68,68,0.07)'   },
]

const LANE_HEIGHT   = 160
const LANE_LABEL_W  = 80
const CANVAS_WIDTH  = 1600

// ─── Shared handle style ──────────────────────────────────────────────────────
// Each side gets two overlapping handles (source + target) rendered as one dot.
// This lets users connect FROM or TO any side freely.
const HS = (color) => ({
  width: 10, height: 10,
  background: color,
  border: '2px solid #fff',
  borderRadius: '50%',
  zIndex: 10,
})

function AllHandles({ color = NAVY2, sourceIds = {} }) {
  // sourceIds: optional named ids for semantic sources (e.g. decision YES/NO)
  const sides = [
    { pos: Position.Top,    id: 'top'   },
    { pos: Position.Right,  id: 'right' },
    { pos: Position.Bottom, id: 'bottom'},
    { pos: Position.Left,   id: 'left'  },
  ]
  return <>
    {sides.map(({ pos, id }) => (
      <span key={id}>
        <Handle
          type="target"
          id={`${sourceIds[id] || id}-t`}
          position={pos}
          style={HS(color)}
        />
        <Handle
          type="source"
          id={sourceIds[id] || id}
          position={pos}
          style={HS(color)}
        />
      </span>
    ))}
  </>
}

// ─── Custom Node: Start ───────────────────────────────────────────────────────
function StartNode({ data }) {
  return (
    <div style={{
      width: 64, height: 64, borderRadius: '50%',
      background: '#16A34A', border: '2px solid #15803D',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: 10, fontWeight: 700, textAlign: 'center',
      boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
      position: 'relative',
    }}>
      {data.label || 'Start'}
      <AllHandles color="#15803D" />
    </div>
  )
}

// ─── Custom Node: End ─────────────────────────────────────────────────────────
function EndNode({ data }) {
  return (
    <div style={{
      width: 64, height: 64, borderRadius: '50%',
      background: NAVY, border: '2px solid #334155',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: 10, fontWeight: 700, textAlign: 'center',
      boxShadow: '0 2px 8px rgba(15,23,42,0.3)',
      position: 'relative',
    }}>
      {data.label || 'End'}
      <AllHandles color="#475569" />
    </div>
  )
}

// ─── Custom Node: Process ─────────────────────────────────────────────────────
function ProcessNode({ data, selected }) {
  return (
    <div style={{
      minWidth: 130, minHeight: 52, maxWidth: 190,
      background: '#fff',
      border: `2px solid ${selected ? ORANGE : NAVY2}`,
      borderRadius: 6,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '10px 16px',
      fontSize: 12, fontWeight: 500,
      color: TEXT1, textAlign: 'center',
      boxShadow: selected ? `0 0 0 3px rgba(249,115,22,0.25)` : '0 2px 6px rgba(0,0,0,0.10)',
      lineHeight: 1.35,
      position: 'relative',
    }}>
      <AllHandles color={selected ? ORANGE : NAVY2} />
      <span>{data.label || 'Process'}</span>
    </div>
  )
}

// ─── Custom Node: Decision ────────────────────────────────────────────────────
function DecisionNode({ data, selected }) {
  const size = 110
  // Decision nodes keep semantic YES/NO IDs on Bottom/Right
  // but also accept connections from all four sides
  const sides = [
    { pos: Position.Top,    srcId: 'top',    tgtId: 'top-t',    color: '#D97706' },
    { pos: Position.Right,  srcId: 'no',     tgtId: 'right-t',  color: '#DC2626' },
    { pos: Position.Bottom, srcId: 'yes',    tgtId: 'bottom-t', color: '#16A34A' },
    { pos: Position.Left,   srcId: 'left',   tgtId: 'left-t',   color: '#D97706' },
  ]
  return (
    <div style={{
      width: size, height: size,
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Diamond shape */}
      <div style={{
        position: 'absolute',
        width: size * 0.70, height: size * 0.70,
        background: '#FFFBEB',
        border: `2px solid ${selected ? ORANGE : '#D97706'}`,
        borderRadius: 4,
        transform: 'rotate(45deg)',
        boxShadow: selected ? `0 0 0 3px rgba(249,115,22,0.25)` : '0 2px 6px rgba(0,0,0,0.12)',
      }} />
      <span style={{
        position: 'relative', zIndex: 1,
        fontSize: 10, fontWeight: 700,
        color: '#92400E', textAlign: 'center',
        maxWidth: 64, lineHeight: 1.3,
        wordBreak: 'break-word',
      }}>
        {data.label || 'Decision?'}
      </span>

      {sides.map(({ pos, srcId, tgtId, color }) => (
        <span key={srcId}>
          <Handle type="target" id={tgtId}  position={pos} style={HS(color)} />
          <Handle type="source" id={srcId}  position={pos} style={{ ...HS(color), opacity: 0, pointerEvents: 'all' }} />
        </span>
      ))}
    </div>
  )
}

const nodeTypes = {
  startNode:    StartNode,
  endNode:      EndNode,
  processNode:  ProcessNode,
  decisionNode: DecisionNode,
}

// ─── Swimlane background ──────────────────────────────────────────────────────
function SwimlaneBackground({ swimlanes }) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 0 }}>
      {swimlanes.map((lane, i) => (
        <div key={lane.id} style={{
          position: 'absolute',
          top: i * LANE_HEIGHT,
          left: 0,
          width: CANVAS_WIDTH,
          height: LANE_HEIGHT,
          background: lane.color,
          borderBottom: `1px solid ${BORDER}`,
          display: 'flex',
          alignItems: 'center',
        }}>
          <div style={{
            width: LANE_LABEL_W,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRight: `2px solid ${BORDER}`,
            background: 'rgba(255,255,255,0.6)',
            flexShrink: 0,
          }}>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: TEXT3,
              letterSpacing: '0.08em',
              transform: 'rotate(-90deg)',
              whiteSpace: 'nowrap',
            }}>
              {lane.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Lane colour picker helper ────────────────────────────────────────────────
const LANE_COLOURS = [
  'rgba(59,130,246,0.07)',
  'rgba(168,85,247,0.07)',
  'rgba(34,197,94,0.07)',
  'rgba(249,115,22,0.07)',
  'rgba(239,68,68,0.07)',
  'rgba(20,184,166,0.07)',
  'rgba(234,179,8,0.07)',
  'rgba(99,102,241,0.07)',
]

// ─── Builder (inner — needs ReactFlow context) ────────────────────────────────
function ProcessMapBuilderInner({ map, onBack, onSaved }) {
  const [title, setTitle]               = useState(map?.title || 'New Process Map')
  const [editingTitle, setEditingTitle] = useState(false)
  const [swimlanes, setSwimlanes]       = useState(
    map?.swimlanes?.length ? map.swimlanes : DEFAULT_SWIMLANES
  )
  const [nodes, setNodes, onNodesChange] = useNodesState(map?.nodes || [])
  const [edges, setEdges, onEdgesChange] = useEdgesState(map?.edges || [])
  const [saving, setSaving]             = useState(false)
  const [saveError, setSaveError]       = useState(null)
  const [saveSuccess, setSaveSuccess]   = useState(false)
  const [showLanePanel, setShowLanePanel] = useState(false)
  const [selectedEdge, setSelectedEdge] = useState(null)
  const [edgeLabelInput, setEdgeLabelInput] = useState('')
  const reactFlow = useReactFlow()
  const wrapperRef = useRef(null)

  const totalHeight = swimlanes.length * LANE_HEIGHT

  const onConnect = useCallback((params) => {
    // Auto-label YES/NO for decision nodes
    let label = ''
    if (params.sourceHandle === 'yes') label = 'YES'
    if (params.sourceHandle === 'no')  label = 'NO'
    setEdges(eds => addEdge({
      ...params,
      type: 'smoothstep',
      label,
      labelStyle: { fontSize: 10, fontWeight: 700, fill: label === 'YES' ? '#16A34A' : label === 'NO' ? '#DC2626' : TEXT3 },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.85 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#94A3B8' },
      style: { stroke: '#94A3B8', strokeWidth: 1.5 },
    }, eds))
  }, [setEdges])

  function addNode(type) {
    const id = `${type}-${Date.now()}`
    const laneIdx = Math.floor(swimlanes.length / 2)
    const newNode = {
      id,
      type,
      position: {
        x: LANE_LABEL_W + 200 + Math.random() * 200,
        y: laneIdx * LANE_HEIGHT + LANE_HEIGHT / 2 - 30,
      },
      data: {
        label: type === 'startNode' ? 'Start'
             : type === 'endNode'   ? 'End'
             : type === 'processNode' ? 'Process Step'
             : 'Decision?'
      },
    }
    setNodes(nds => [...nds, newNode])
  }

  function onNodeDoubleClick(_, node) {
    const label = window.prompt('Edit label:', node.data.label || '')
    if (label === null) return
    setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, label } } : n))
  }

  function onEdgeClick(_, edge) {
    setSelectedEdge(edge)
    setEdgeLabelInput(edge.label || '')
  }

  function applyEdgeLabel() {
    if (!selectedEdge) return
    setEdges(eds => eds.map(e => e.id === selectedEdge.id
      ? { ...e, label: edgeLabelInput, labelStyle: { fontSize: 10, fontWeight: 700, fill: TEXT3 }, labelBgStyle: { fill: '#fff', fillOpacity: 0.85 } }
      : e
    ))
    setSelectedEdge(null)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      // Strip React Flow internal fields — only persist what we need to restore the map
      const cleanNodes = nodes.map(({ id, type, position, data }) => ({ id, type, position, data }))
      const cleanEdges = edges.map(({ id, source, target, sourceHandle, targetHandle, type, label, labelStyle, labelBgStyle, markerEnd, style }) => ({
        id, source, target, sourceHandle, targetHandle, type, label, labelStyle, labelBgStyle, markerEnd, style
      }))
      const payload = {
        title,
        swimlanes,
        nodes: cleanNodes,
        edges: cleanEdges,
        description: map?.description || '',
      }
      let saved
      if (map?.id) {
        saved = await api.updateProcessMap(map.id, payload)
      } else {
        saved = await api.createProcessMap(payload)
      }
      onSaved(saved)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch (err) {
      setSaveError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function autoLayout() {
    if (nodes.length === 0) return

    // 1. Detect which swimlane each node belongs to (by current Y position)
    const getLane = (node) =>
      Math.max(0, Math.min(swimlanes.length - 1, Math.floor(node.position.y / LANE_HEIGHT)))

    // 2. Group nodes by lane
    const laneMap = {}
    swimlanes.forEach((_, i) => { laneMap[i] = [] })
    nodes.forEach(n => laneMap[getLane(n)].push(n))

    // 3. Build outgoing adjacency + incoming count from edges
    const outgoing = {}
    const inCount  = {}
    nodes.forEach(n => { outgoing[n.id] = []; inCount[n.id] = 0 })
    edges.forEach(e => {
      if (outgoing[e.source] !== undefined) outgoing[e.source].push(e.target)
      if (inCount[e.target]  !== undefined) inCount[e.target]++
    })

    // 4. Topological sort (BFS / Kahn's algorithm) to get left→right order
    const order = {}
    const queue = nodes.filter(n => inCount[n.id] === 0).map(n => n.id)
    let idx = 0
    const visited = new Set()
    while (queue.length > 0) {
      const nid = queue.shift()
      if (visited.has(nid)) continue
      visited.add(nid)
      order[nid] = idx++
      outgoing[nid].forEach(tid => { if (!visited.has(tid)) queue.push(tid) })
    }
    // Any nodes not reached (isolated or in cycles) get remaining indices
    nodes.forEach(n => { if (order[n.id] === undefined) order[n.id] = idx++ })

    // 5. Position constants — generous spacing for readability
    const H_GAP       = 240   // px between node centres horizontally
    const START_X     = LANE_LABEL_W + 80
    const LANE_CENTER = LANE_HEIGHT / 2  // vertical centre of each lane

    // 6. Assign new positions — sorted by topo order within each lane
    const newPos = {}
    Object.entries(laneMap).forEach(([laneIdx, laneNodes]) => {
      if (!laneNodes.length) return
      const sorted = [...laneNodes].sort((a, b) => order[a.id] - order[b.id])
      sorted.forEach((node, i) => {
        const nodeH = node.type === 'decisionNode' ? 110 : node.type === 'startNode' || node.type === 'endNode' ? 64 : 52
        newPos[node.id] = {
          x: START_X + i * H_GAP,
          y: parseInt(laneIdx) * LANE_HEIGHT + LANE_CENTER - nodeH / 2,
        }
      })
    })

    // 7. Apply positions + fitView
    setNodes(nds => nds.map(n => ({ ...n, position: newPos[n.id] ?? n.position })))
    setTimeout(() => reactFlow.fitView({ padding: 0.12, duration: 500 }), 60)
  }

  async function handleExportPng() {
    try {
      const html2canvas = (await import('html2canvas')).default
      const el = wrapperRef.current
      if (!el) return
      const canvas = await html2canvas(el, { backgroundColor: BG, scale: 2, useCORS: true, logging: false })
      const dataUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${title.replace(/\s+/g, '-').toLowerCase()}.png`
      a.click()
    } catch (err) {
      alert('Export failed: ' + err.message)
      console.error(err)
    }
  }

  function addSwimlane() {
    const label = window.prompt('Swimlane name:')
    if (!label) return
    setSwimlanes(prev => [...prev, {
      id: `sl-${Date.now()}`,
      label: label.toUpperCase(),
      color: LANE_COLOURS[prev.length % LANE_COLOURS.length],
    }])
  }

  function deleteSwimlane(id) {
    setSwimlanes(prev => prev.filter(l => l.id !== id))
  }

  function renameSwimlane(id, label) {
    setSwimlanes(prev => prev.map(l => l.id === id ? { ...l, label: label.toUpperCase() } : l))
  }

  function recolorSwimlane(id, color) {
    setSwimlanes(prev => prev.map(l => l.id === id ? { ...l, color } : l))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)', background: BG }}>

      {/* ── Top toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px',
        background: '#fff',
        borderBottom: `1px solid ${BORDER}`,
        flexShrink: 0,
        zIndex: 10,
      }}>
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8,
          border: `1px solid ${BORDER}`,
          background: '#fff', color: TEXT1, fontSize: 12, cursor: 'pointer',
        }}>
          <ArrowLeft size={13} /> Back
        </button>

        {/* Title */}
        {editingTitle ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingTitle(false) }}
              onBlur={() => setEditingTitle(false)}
              style={{
                fontSize: 15, fontWeight: 700, color: TEXT1,
                border: `1px solid ${ORANGE}`, borderRadius: 6, padding: '3px 8px',
                outline: 'none', background: '#fff', minWidth: 200,
              }}
            />
            <button onClick={() => setEditingTitle(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16A34A', padding: 2 }}><Check size={14} /></button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: TEXT1 }}>{title}</span>
            <button onClick={() => setEditingTitle(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEXT3, padding: 2 }}><Pencil size={12} /></button>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Toolbox buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: TEXT3, marginRight: 4 }}>Add:</span>
          {[
            { type: 'startNode',    label: 'Start',    bg: '#16A34A', fg: '#fff' },
            { type: 'endNode',      label: 'End',      bg: NAVY,      fg: '#fff' },
            { type: 'processNode',  label: 'Process',  bg: '#fff',    fg: NAVY2,  border: NAVY2 },
            { type: 'decisionNode', label: 'Decision', bg: '#FEF3C7', fg: '#78350F', border: '#D97706' },
          ].map(({ type, label, bg, fg, border }) => (
            <button key={type} onClick={() => addNode(type)} style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: bg, color: fg,
              border: `1px solid ${border || bg}`,
              cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>

        <button onClick={() => setShowLanePanel(p => !p)} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 12px', borderRadius: 8,
          border: `1px solid ${BORDER}`,
          background: showLanePanel ? NAVY2 : '#fff',
          color: showLanePanel ? '#fff' : TEXT1, fontSize: 12, cursor: 'pointer',
        }}>
          <Layers size={13} /> Lanes
        </button>

        <button onClick={autoLayout} title="Auto-arrange nodes cleanly within their swimlanes" style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 12px', borderRadius: 8,
          border: `1px solid ${BORDER}`,
          background: '#fff', color: TEXT1, fontSize: 12, cursor: 'pointer',
        }}>
          ⚡ Auto Layout
        </button>

        <button onClick={handleExportPng} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 12px', borderRadius: 8,
          border: `1px solid ${BORDER}`,
          background: '#fff', color: TEXT1, fontSize: 12, cursor: 'pointer',
        }}>
          <Download size={13} /> PNG
        </button>

        <button onClick={handleSave} disabled={saving} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 14px', borderRadius: 8,
          background: saveSuccess ? '#16A34A' : ORANGE, color: '#fff',
          border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          opacity: saving ? 0.6 : 1, transition: 'background 0.3s',
        }}>
          <Save size={13} /> {saving ? 'Saving…' : saveSuccess ? 'Saved ✓' : 'Save'}
        </button>

        {saveError && (
          <span style={{ fontSize: 11, color: '#991B1B', background: '#FEE2E2', padding: '4px 10px', borderRadius: 6, border: '1px solid #FECACA' }}>
            ⚠ {saveError}
          </span>
        )}
      </div>

      {/* ── Main area: lanes panel + canvas ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Lane panel */}
        {showLanePanel && (
          <div style={{
            width: 220, flexShrink: 0,
            background: '#fff', borderRight: `1px solid ${BORDER}`,
            display: 'flex', flexDirection: 'column',
            overflowY: 'auto',
          }}>
            <div style={{ padding: '12px 14px 8px', borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: TEXT3, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Swimlanes</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
              {swimlanes.map((lane, i) => (
                <div key={lane.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 8px', borderRadius: 6, marginBottom: 4,
                  background: lane.color,
                  border: `1px solid ${BORDER}`,
                }}>
                  <input
                    value={lane.label}
                    onChange={e => renameSwimlane(lane.id, e.target.value)}
                    style={{
                      flex: 1, fontSize: 11, fontWeight: 600, color: TEXT1,
                      border: 'none', background: 'transparent', outline: 'none',
                    }}
                  />
                  {/* Colour swatches */}
                  <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', maxWidth: 48 }}>
                    {LANE_COLOURS.map(c => (
                      <div key={c} onClick={() => recolorSwimlane(lane.id, c)}
                        style={{
                          width: 10, height: 10, borderRadius: 2,
                          background: c.replace('0.07', '0.5'),
                          border: lane.color === c ? `1.5px solid ${ORANGE}` : `1px solid ${BORDER}`,
                          cursor: 'pointer',
                        }} />
                    ))}
                  </div>
                  <button onClick={() => deleteSwimlane(lane.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 2,
                  }}><Trash2 size={11} /></button>
                </div>
              ))}
            </div>
            <div style={{ padding: '8px 10px', borderTop: `1px solid ${BORDER}` }}>
              <button onClick={addSwimlane} style={{
                width: '100%', padding: '7px', borderRadius: 6,
                background: NAVY2, color: '#fff', fontSize: 11, fontWeight: 600,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}>
                <Plus size={11} /> Add Lane
              </button>
            </div>
          </div>
        )}

        {/* React Flow canvas */}
        <div ref={wrapperRef} style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={onNodeDoubleClick}
            onEdgeClick={onEdgeClick}
            nodeTypes={nodeTypes}
            deleteKeyCode={['Backspace', 'Delete']}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.3}
            maxZoom={2}
            style={{ background: BG }}
            defaultEdgeOptions={{
              type: 'smoothstep',
              markerEnd: { type: MarkerType.ArrowClosed, color: '#94A3B8' },
              style: { stroke: '#94A3B8', strokeWidth: 1.5 },
            }}
          >
            {/* Swimlane background overlay */}
            <div className="react-flow__background-lanes" style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              pointerEvents: 'none', zIndex: 0,
            }}>
              <SwimlaneBackground swimlanes={swimlanes} />
            </div>

            <Background color="#E2E8F0" gap={20} size={1} />
            <Controls />
          </ReactFlow>

          {/* Edge label editor */}
          {selectedEdge && (
            <div style={{
              position: 'absolute', top: 16, right: 16, zIndex: 100,
              background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10,
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              padding: '12px 14px', width: 200,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: TEXT3, marginBottom: 8 }}>Edge Label</div>
              <input
                autoFocus
                value={edgeLabelInput}
                onChange={e => setEdgeLabelInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') applyEdgeLabel() }}
                placeholder="YES / NO / label…"
                style={{
                  width: '100%', fontSize: 12, padding: '6px 8px',
                  border: `1px solid ${BORDER}`, borderRadius: 6, outline: 'none',
                  color: TEXT1, background: BG,
                }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button onClick={applyEdgeLabel} style={{
                  flex: 1, padding: '6px', borderRadius: 6,
                  background: ORANGE, color: '#fff', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>Apply</button>
                <button onClick={() => {
                  setEdges(eds => eds.filter(e => e.id !== selectedEdge.id))
                  setSelectedEdge(null)
                }} style={{
                  padding: '6px 10px', borderRadius: 6,
                  background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>Delete</button>
                <button onClick={() => setSelectedEdge(null)} style={{
                  padding: '6px 8px', borderRadius: 6,
                  background: '#fff', color: TEXT3, border: `1px solid ${BORDER}`, fontSize: 11, cursor: 'pointer',
                }}><X size={11} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Wrap with provider
function ProcessMapBuilder(props) {
  return (
    <ReactFlowProvider>
      <ProcessMapBuilderInner {...props} />
    </ReactFlowProvider>
  )
}

// ─── List View ────────────────────────────────────────────────────────────────
function ProcessMapsList({ maps, onNew, onEdit, onDelete }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: TEXT1, margin: 0 }}>Process Maps</h1>
          <p style={{ fontSize: 12, color: TEXT3, margin: '3px 0 0' }}>
            {maps.length} map{maps.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <button onClick={onNew} style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '9px 18px', borderRadius: 10,
          background: ORANGE, color: '#fff',
          border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(249,115,22,0.25)',
        }}>
          <Plus size={14} /> New Map
        </button>
      </div>

      {maps.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px 32px',
          border: `2px dashed ${BORDER}`, borderRadius: 16,
          color: TEXT3,
        }}>
          <GitFork size={32} style={{ opacity: 0.3, marginBottom: 12, marginLeft: 'auto', marginRight: 'auto' }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No process maps yet</div>
          <div style={{ fontSize: 12 }}>Create a swimlane process flow to document your operations</div>
          <button onClick={onNew} style={{
            marginTop: 18, padding: '9px 22px', borderRadius: 10,
            background: ORANGE, color: '#fff',
            border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>Create First Map</button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16,
        }}>
          {maps.map(m => (
            <div key={m.id} style={{
              background: '#fff',
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              padding: '16px 18px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TEXT1 }}>{m.title}</div>
                  {m.description && (
                    <div style={{ fontSize: 11, color: TEXT3, marginTop: 3, lineHeight: 1.4 }}>{m.description}</div>
                  )}
                </div>
                <GitFork size={16} style={{ color: ORANGE, flexShrink: 0, marginTop: 2 }} />
              </div>

              {/* Lane tags */}
              {m.swimlanes?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {m.swimlanes.map(l => (
                    <span key={l.id} style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                      background: l.color, color: TEXT3,
                      border: `1px solid ${BORDER}`,
                      letterSpacing: '0.06em',
                    }}>{l.label}</span>
                  ))}
                </div>
              )}

              <div style={{ fontSize: 10, color: TEXT3 }}>
                {m.nodes?.length || 0} nodes · {m.edges?.length || 0} connections ·{' '}
                {new Date(m.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => onEdit(m)} style={{
                  flex: 1, padding: '7px', borderRadius: 8,
                  background: NAVY2, color: '#fff',
                  border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>Edit</button>
                <button onClick={() => onDelete(m)} style={{
                  padding: '7px 10px', borderRadius: 8,
                  background: '#fff', color: '#DC2626',
                  border: `1px solid #FCA5A5`, fontSize: 11, cursor: 'pointer',
                }}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function ProcessMapsView() {
  const [maps, setMaps]         = useState([])
  const [editing, setEditing]   = useState(null)   // null = list, {} = new, { id, ... } = edit
  const [loading, setLoading]   = useState(true)

  useEffect(() => { loadMaps() }, [])

  async function loadMaps() {
    setLoading(true)
    try {
      const data = await api.getProcessMaps()
      setMaps(data)
    } catch (e) {
      console.error('Failed to load process maps', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(m) {
    if (!window.confirm(`Delete "${m.title}"? This cannot be undone.`)) return
    await api.deleteProcessMap(m.id)
    setMaps(prev => prev.filter(x => x.id !== m.id))
  }

  function handleSaved(saved) {
    setMaps(prev => {
      const exists = prev.find(m => m.id === saved.id)
      return exists
        ? prev.map(m => m.id === saved.id ? saved : m)
        : [saved, ...prev]
    })
    setEditing(saved) // keep in builder, now has an id
  }

  if (editing !== null) {
    return (
      <ProcessMapBuilder
        map={editing}
        onBack={() => { setEditing(null); loadMaps() }}
        onSaved={handleSaved}
      />
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: TEXT3, fontSize: 13 }}>
        Loading maps…
      </div>
    )
  }

  return (
    <ProcessMapsList
      maps={maps}
      onNew={() => setEditing({})}
      onEdit={m => setEditing(m)}
      onDelete={handleDelete}
    />
  )
}
