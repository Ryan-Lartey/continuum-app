import { useCallback, useEffect, useMemo, useState } from 'react'
import dagre from '@dagrejs/dagre'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  Handle, Position,
  BaseEdge, EdgeLabelRenderer,
  getSmoothStepPath, getBezierPath, getStraightPath,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

const WASTE_COLORS = {
  Transport: '#60A5FA', Inventory: '#A78BFA', Motion: '#34D399',
  Waiting: '#FBBF24', Overproduction: '#F87171', Overprocessing: '#22D3EE',
  Defects: '#FB7185', Skills: '#4ADE80',
}
const WASTE_INIT = {
  Transport: 'T', Inventory: 'I', Motion: 'M', Waiting: 'W',
  Overproduction: 'OP', Overprocessing: 'OC', Defects: 'D', Skills: 'S',
}
const LANE = {
  Operator:   { bg: 'rgba(96,165,250,0.07)',  border: 'rgba(96,165,250,0.22)',  accent: '#60A5FA', label: 'OPERATOR' },
  TeamLeader: { bg: 'rgba(52,211,153,0.07)',  border: 'rgba(52,211,153,0.22)',  accent: '#34D399', label: 'TEAM LEADER' },
  System:     { bg: 'rgba(167,139,250,0.07)', border: 'rgba(167,139,250,0.22)', accent: '#A78BFA', label: 'SYSTEM' },
}

const NODE_W   = 175
const NODE_H   = 66
const DEC_H    = NODE_H + 16
const DEC_SZ   = 78
const COL_W    = 305        // horizontal space per column (wide = room for edge labels)
const LANE_H   = 165        // height of each swim lane band
const LABEL_W  = 58         // width of left lane-name gutter
const GAP      = 40         // gap between swim lane bands
const MAP_BG   = '#080F1C'

// Vertical centre of each lane
const LANE_Y = {
  Operator:   LABEL_W + 0  * (LANE_H + GAP),
  TeamLeader: LABEL_W + 1  * (LANE_H + GAP),
  System:     LABEL_W + 2  * (LANE_H + GAP),
}
// Actually define lane Y as absolute Y positions (not using LABEL_W for Y)
const LY = {
  Operator:   30,
  TeamLeader: 30 + LANE_H + GAP,          // 275
  System:     30 + 2 * (LANE_H + GAP),    // 520
}

const HS = { width: 9, height: 9, border: '2px solid rgba(255,255,255,0.1)', boxShadow: '0 0 0 1.5px rgba(0,0,0,0.5)' }

// ─── SwimLane node ─────────────────────────────────────────────────────────
function SwimLaneNode({ data }) {
  const cfg = LANE[data.lane] || LANE.Operator
  return (
    <div style={{ width: data.width, height: data.height, background: cfg.bg, borderTop: `1.5px solid ${cfg.border}`, borderBottom: `1.5px solid ${cfg.border}`, display: 'flex', pointerEvents: 'none' }}>
      <div style={{ width: LABEL_W, height: '100%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: `1.5px solid ${cfg.border}` }}>
        <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 10, fontWeight: 800, color: cfg.accent, letterSpacing: '0.14em', opacity: 0.85 }}>
          {cfg.label}
        </span>
      </div>
    </div>
  )
}

// ─── Process node ──────────────────────────────────────────────────────────
function ProcessNode({ data }) {
  const cfg    = LANE[data.lane] || LANE.Operator
  const accent = (data.waste ? WASTE_COLORS[data.waste] : null) || cfg.accent
  return (
    <div style={{ width: NODE_W, minHeight: NODE_H, position: 'relative' }}>
      <Handle type="target" position={Position.Left}   style={{ ...HS, background: accent, left: -5 }} />
      <Handle type="target" id="t"   position={Position.Top}    style={{ ...HS, background: accent, top: -5 }} />
      <div style={{ background: '#0C1525', border: `1px solid ${accent}25`, borderLeft: `3.5px solid ${accent}`, borderRadius: 10, boxShadow: `0 2px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)`, padding: '8px 12px', minHeight: NODE_H, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#DDE4F0', lineHeight: 1.4, textAlign: 'center' }}>{data.label}</span>
        {data.waste && (
          <span style={{ position: 'absolute', top: -8, right: -8, width: 20, height: 20, borderRadius: '50%', background: WASTE_COLORS[data.waste], color: '#080F1C', fontSize: 8, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #080F1C', boxShadow: `0 0 8px ${WASTE_COLORS[data.waste]}80`, letterSpacing: '-0.5px' }}>
            {WASTE_INIT[data.waste] || data.waste[0]}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right}  style={{ ...HS, background: accent, right: -5 }} />
      <Handle type="source" id="b"   position={Position.Bottom} style={{ ...HS, background: accent, bottom: -5 }} />
    </div>
  )
}

// ─── Decision node ─────────────────────────────────────────────────────────
function DecisionNode({ data }) {
  return (
    <div style={{ width: NODE_W, height: DEC_H, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Handle type="target" position={Position.Left}  style={{ ...HS, background: '#FBBF24', left: -5 }} />
      <Handle type="target" id="t"   position={Position.Top}   style={{ ...HS, background: '#FBBF24', top: -5 }} />
      <div style={{ width: DEC_SZ, height: DEC_SZ, transform: 'rotate(45deg)', background: '#1C1600', border: '2px solid #FBBF24', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(251,191,36,0.2)' }}>
        <span style={{ transform: 'rotate(-45deg)', fontSize: 9, fontWeight: 700, color: '#FDE68A', textAlign: 'center', maxWidth: 54, display: 'block', lineHeight: 1.3 }}>{data.label}</span>
      </div>
      <Handle type="source" position={Position.Right}  style={{ ...HS, background: '#FBBF24', right: -5 }} />
      <Handle type="source" id="b"   position={Position.Bottom} style={{ ...HS, background: '#FBBF24', bottom: -5 }} />
    </div>
  )
}

const nodeTypes = { process: ProcessNode, decision: DecisionNode, swimlane: SwimLaneNode }

// ─── Custom edge with label pinned near source ──────────────────────────────
function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, label, data }) {
  const isStep    = data?.edgeType === 'step'
  const isBezier  = data?.edgeType === 'bezier'

  const [edgePath] = isBezier
    ? getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
    : isStep
      ? getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 12 })
      : getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 8 })

  // Pin label 50px past the source handle — never reaches the target node
  const lx = sourceX + 50
  const ly = sourceY - 16

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {label && (
        <EdgeLabelRenderer>
          <div style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${lx}px,${ly}px)`,
            fontSize: 9.5,
            fontWeight: 700,
            color: '#94A3B8',
            background: '#080F1C',
            padding: '2px 7px',
            borderRadius: 4,
            pointerEvents: 'none',
            zIndex: 20,
            border: '1px solid rgba(255,255,255,0.1)',
            whiteSpace: 'nowrap',
          }}>
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

const edgeTypes = { flow: FlowEdge }

// ─── Layout engine ─────────────────────────────────────────────────────────
// Strategy:
//  1. Use Dagre to compute a topological ordering (Dagre's X = column order).
//  2. Re-assign columns using our own rule: each node goes in the leftmost
//     column that satisfies both (a) it's after all its predecessors AND
//     (b) no other node in the same swim-lane already occupies that column.
//  This guarantees zero overlaps regardless of graph structure.
function buildLayout(mapData) {
  const nodes = mapData?.nodes || []
  const edges = mapData?.edges || []
  if (!nodes.length) return { rfNodes: [], rfEdges: [] }

  // ── Step 1: Dagre ordering ──────────────────────────────────────────────
  const g = new dagre.graphlib.Graph({ multigraph: true })
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', ranksep: 80, nodesep: 40, acyclicer: 'greedy', ranker: 'tight-tree' })
  nodes.forEach(n => g.setNode(String(n.id), { width: NODE_W, height: n.type === 'decision' ? DEC_H : NODE_H }))
  edges.forEach((e, i) => g.setEdge(String(e.source), String(e.target), {}, e.id || `e${i}`))
  dagre.layout(g)

  // Sort nodes by Dagre X → topological order respecting crossing-minimisation
  const dagreX = Object.fromEntries(nodes.map(n => [n.id, g.node(String(n.id))?.x ?? 0]))
  const topoOrder = [...nodes].sort((a, b) => dagreX[a.id] - dagreX[b.id])

  // ── Step 2: Guaranteed no-overlap column assignment ─────────────────────
  // col[id]       = final column index for this node
  // laneNext[lane] = next available column index in this swim lane
  const col       = {}
  const laneNext  = {}   // per-lane "next free column"
  const predMaxCol = {}  // max column of predecessors (for left-to-right constraint)

  for (const n of topoOrder) {
    const lane = n.lane || 'Operator'

    // Min col = 1 + max col of any predecessor
    const incomingCols = edges
      .filter(e => String(e.target) === String(n.id) && col[e.source] !== undefined)
      .map(e => col[e.source])
    const minFromPreds = incomingCols.length ? Math.max(...incomingCols) + 1 : 0

    // Must also be >= next free column in this lane (no same-lane overlap)
    const c = Math.max(minFromPreds, laneNext[lane] ?? 0)
    col[n.id]    = c
    laneNext[lane] = c + 1
  }

  const maxCol  = Math.max(...Object.values(col), 0)
  const canvasW = Math.max(900, (maxCol + 2) * COL_W + LABEL_W + 80)

  // ── Step 3: Build ReactFlow nodes ───────────────────────────────────────
  const rfNodes = nodes.map(n => {
    const c     = col[n.id] ?? 0
    const lane  = n.lane || 'Operator'
    const ly    = LY[lane] ?? LY.Operator
    const h     = n.type === 'decision' ? DEC_H : NODE_H
    return {
      id:       String(n.id),
      type:     n.type === 'decision' ? 'decision' : 'process',
      position: { x: LABEL_W + 24 + c * COL_W, y: ly + Math.floor((LANE_H - h) / 2) },
      data:     { label: n.label, waste: n.waste, lane },
      zIndex:   5,
    }
  })

  // ── Step 4: Swim lane background nodes ──────────────────────────────────
  const usedLanes = [...new Set(nodes.map(n => n.lane || 'Operator'))].filter(l => LANE[l])
  const laneNodes = usedLanes.map(lane => ({
    id: `__lane_${lane}`,
    type: 'swimlane',
    position: { x: 0, y: (LY[lane] ?? 30) - 6 },
    data: { lane, width: canvasW, height: LANE_H + 12 },
    draggable: false, selectable: false, connectable: false, focusable: false,
    zIndex: -1,
  }))

  // ── Step 5: Edges ────────────────────────────────────────────────────────
  const laneOf = Object.fromEntries(nodes.map(n => [String(n.id), n.lane || 'Operator']))
  const colOf  = (id) => col[id] ?? 0

  const rfEdges = edges.map((e, i) => {
    const srcLane  = laneOf[e.source] || 'Operator'
    const tgtLane  = laneOf[e.target] || 'Operator'
    const cross    = srcLane !== tgtLane
    const backward = colOf(e.source) >= colOf(e.target)

    const color = backward
      ? 'rgba(251,191,36,0.5)'
      : cross
        ? 'rgba(148,163,184,0.5)'
        : (LANE[srcLane]?.accent || '#60A5FA')

    const edgeType = backward ? 'bezier' : cross ? 'step' : 'smoothstep'
    return {
      id:           e.id || `e${i}`,
      source:       String(e.source),
      target:       String(e.target),
      sourceHandle: e.sourceHandle || null,
      label:        e.label || '',
      type:         'flow',
      data:         { edgeType },
      style: { stroke: color, strokeWidth: backward ? 1.5 : 2, strokeDasharray: backward ? '6 4' : undefined, opacity: backward ? 0.6 : 0.9 },
      zIndex:       backward ? 12 : 10,
      markerEnd:    { type: 'arrowclosed', color, width: 12, height: 12 },
    }
  })

  return { rfNodes: [...laneNodes, ...rfNodes], rfEdges }
}

// ─── Process narrative ──────────────────────────────────────────────────────
function ProcessNarrative({ mapData }) {
  const [open, setOpen] = useState(true)
  const nodes = mapData?.nodes || []
  const edges = mapData?.edges || []
  if (!nodes.length) return null

  // BFS order for display
  const out = {}, ind = {}
  nodes.forEach(n => { out[n.id] = []; ind[n.id] = 0 })
  edges.forEach(e => { out[e.source]?.push(e.target); if (ind[e.target] !== undefined) ind[e.target]++ })
  const lvl = {}, q = []
  nodes.forEach(n => { if (ind[n.id] === 0) { lvl[n.id] = 0; q.push(n.id) } })
  nodes.forEach(n => { if (lvl[n.id] === undefined) { lvl[n.id] = 0; q.push(n.id) } })
  let qi = 0
  while (qi < q.length) { const c = q[qi++]; for (const nx of (out[c]||[])) { const nl=(lvl[c]||0)+1; if(lvl[nx]===undefined||lvl[nx]<nl){lvl[nx]=nl;if(!q.includes(nx))q.push(nx)} } }
  const sorted = [...nodes].sort((a,b) => (lvl[a.id]||0)-(lvl[b.id]||0))

  let step = 0
  return (
    <div style={{ marginTop: 10, background: '#06090F', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Process Narrative</span>
          <span style={{ fontSize: 10, color: '#1E293B' }}>{sorted.filter(n => n.type !== 'decision').length} steps · {sorted.filter(n => n.waste).length} waste points</span>
        </div>
        <span style={{ fontSize: 11, color: '#1E293B' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '8px 14px 12px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, padding: '6px 0 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', marginBottom: 8 }}>
            {[...new Set(sorted.map(n => n.lane||'Operator'))].map(lane => (
              <div key={lane} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: LANE[lane]?.accent||'#60A5FA' }} />
                <span style={{ fontSize: 9.5, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{LANE[lane]?.label||lane}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {sorted.map((n, i) => {
              const cfg = LANE[n.lane||'Operator'] || LANE.Operator
              const isD = n.type === 'decision'
              if (!isD) step++
              return (
                <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 7px', borderRadius: 6, background: i%2===0?'rgba(255,255,255,0.018)':'transparent' }}>
                  {isD ? (
                    <div style={{ width: 22, height: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 13, height: 13, transform: 'rotate(45deg)', border: '2px solid #FBBF24', borderRadius: 2, background: '#1A1500' }} />
                    </div>
                  ) : (
                    <div style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0, background: `${cfg.accent}15`, border: `1px solid ${cfg.accent}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: cfg.accent }}>{step}</span>
                    </div>
                  )}
                  <span style={{ fontSize: 12, color: isD ? '#FDE68A' : '#C4CDE0', fontWeight: isD ? 600 : 500, flex: 1, lineHeight: 1.35 }}>
                    {isD ? `◆ ${n.label}` : n.label}
                  </span>
                  <span style={{ fontSize: 9, color: cfg.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7, flexShrink: 0 }}>
                    {n.lane || 'Operator'}
                  </span>
                  {n.waste && (
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#080F1C', background: WASTE_COLORS[n.waste], borderRadius: 4, padding: '1px 5px', flexShrink: 0, boxShadow: `0 0 5px ${WASTE_COLORS[n.waste]}50` }}>
                      {n.waste.toUpperCase()}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Export ────────────────────────────────────────────────────────────────
export default function ProcessMap({ mapData, showNarrative = true }) {
  const { rfNodes: init, rfEdges: initE } = useMemo(() => buildLayout(mapData), [mapData])
  const [nodes, setNodes, onNodesChange] = useNodesState(init)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initE)
  useEffect(() => { setNodes(init) }, [init])
  useEffect(() => { setEdges(initE) }, [initE])
  const onConnect = useCallback(p => setEdges(es => addEdge(p, es)), [])

  if (!mapData?.nodes?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2" style={{ color: 'var(--text-3)' }}>
        <span className="text-3xl">⬡</span>
        <span className="text-sm">No process map — generate one from the Maps tab</span>
      </div>
    )
  }

  const WASTE_LEGEND = [...new Set((mapData.nodes||[]).filter(n=>n.waste).map(n=>n.waste))]

  return (
    <div>
      <div style={{ height: 720, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', background: MAP_BG }}>
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultViewport={{ x: 70, y: 50, zoom: 0.62 }}
          minZoom={0.06} maxZoom={3}
          style={{ background: MAP_BG }}
          proOptions={{ hideAttribution: true }}
          nodesFocusable={false}
          elevateEdgesOnSelect
        >
          <Background color="rgba(255,255,255,0.028)" gap={32} size={1} variant="dots" style={{ background: MAP_BG }} />
          <Controls position="bottom-left" showInteractive={false} showFitView
            style={{ display: 'flex', flexDirection: 'column', gap: 3, background: '#0D1A2E', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: 4 }} />
          <MiniMap
            nodeColor={n => n.type==='swimlane'?'transparent':n.data?.waste?WASTE_COLORS[n.data.waste]:LANE[n.data?.lane]?.accent||'#60A5FA'}
            maskColor="rgba(6,9,15,0.78)"
            style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: '#0D1A2E' }}
          />
          {WASTE_LEGEND.length > 0 && (
            <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 30, background: 'rgba(8,15,28,0.97)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.09)', padding: '10px 14px', pointerEvents: 'none', minWidth: 116 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>WASTE</div>
              {WASTE_LEGEND.map(w => (
                <div key={w} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: WASTE_COLORS[w], boxShadow: `0 0 5px ${WASTE_COLORS[w]}80` }} />
                  <span style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 500 }}>{w}</span>
                </div>
              ))}
            </div>
          )}
        </ReactFlow>
      </div>
      {showNarrative && <ProcessNarrative mapData={mapData} />}
    </div>
  )
}
