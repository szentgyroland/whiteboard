import { useRef, useState, useCallback, useEffect } from 'react'
import useStore from '../../store/useStore'
import IdeaNode, { NODE_W, NODE_H } from './IdeaNode'
import IdeaModal from '../modals/IdeaModal'
import { getThemeColor, getThemeBounds } from '../../utils/colors'

const MIN_ZOOM = 0.15
const MAX_ZOOM = 3

// Quadratic bezier path between two center points
function makePath(x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  // Slight perpendicular offset for curves
  const off = Math.min(60, len * 0.25)
  const px = (-dy / len) * off
  const py = (dx / len) * off
  return `M ${x1} ${y1} Q ${mx + px} ${my + py} ${x2} ${y2}`
}

// Compute where on the node edge the connection line should start/end
function edgePoint(fromX, fromY, toX, toY, hw = NODE_W / 2, hh = NODE_H / 2) {
  const dx = toX - fromX
  const dy = toY - fromY
  if (dx === 0 && dy === 0) return { x: fromX, y: fromY }
  const sx = hw / Math.abs(dx)
  const sy = hh / Math.abs(dy)
  const s = Math.min(sx, sy)
  return { x: fromX + dx * s, y: fromY + dy * s }
}

export default function Canvas({ projectId }) {
  const { ideas: allIdeas, connections: allConnections, addIdea, updateIdea, deleteIdea, addConnection, deleteConnection } = useStore()
  const ideas       = allIdeas[projectId] ?? []
  const connections = allConnections[projectId] ?? []

  // ── Transform state ────────────────────────────────────────────────────
  const [pan,  setPan]  = useState({ x: 80, y: 60 })
  const [zoom, setZoom] = useState(1)

  // ── Interaction state ──────────────────────────────────────────────────
  const [selectedId,     setSelectedId]     = useState(null)
  const [editingId,      setEditingId]      = useState(null) // idea modal
  const [creatingAt,     setCreatingAt]     = useState(null) // {x,y} for new idea modal
  const [connectingFrom, setConnectingFrom] = useState(null) // idea id
  const [tempLine,       setTempLine]       = useState(null) // {x1,y1,x2,y2}
  const [hoverTarget,    setHoverTarget]    = useState(null) // idea id (while connecting)
  const hoverTargetRef = useRef(null)

  // Raw drag state kept in refs to avoid re-render on every mousemove
  const dragRef = useRef(null)
  const containerRef = useRef(null)

  // ── Coordinate helpers ─────────────────────────────────────────────────
  const toCanvas = useCallback((clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top  - pan.y) / zoom,
    }
  }, [pan, zoom])

  const findIdeaIdAtPointer = useCallback((clientX, clientY, excludeId = null) => {
    const target = document.elementFromPoint(clientX, clientY)
    const nodeEl = target?.closest?.('.idea-node[data-idea-id]')
    const ideaId = nodeEl?.dataset?.ideaId ?? null
    if (!ideaId || ideaId === excludeId) return null
    return ideaId
  }, [])

  // ── Zoom ───────────────────────────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const rect = containerRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    setZoom(z => {
      const newZ = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * factor))
      setPan(p => ({
        x: mx - (mx - p.x) * (newZ / z),
        y: my - (my - p.y) * (newZ / z),
      }))
      return newZ
    })
  }, [])

  useEffect(() => {
    const el = containerRef.current
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // ── Pointer down on canvas (pan or create) ─────────────────────────────
  const handleCanvasPointerDown = useCallback((e) => {
    if (e.button !== 0) return
    setSelectedId(null)

    dragRef.current = {
      type: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
      moved: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [pan])

  // ── Pointer down on node (drag) ────────────────────────────────────────
  const handleNodePointerDown = useCallback((e, ideaId) => {
    if (e.button !== 0) return
    setSelectedId(ideaId)
    const idea = ideas.find(i => i.id === ideaId)
    if (!idea) return

    dragRef.current = {
      type: 'drag-node',
      ideaId,
      startX: e.clientX,
      startY: e.clientY,
      startIdeaX: idea.x,
      startIdeaY: idea.y,
      moved: false,
    }
    // Capture on the canvas container so we get move events everywhere
    containerRef.current.setPointerCapture(e.pointerId)
  }, [ideas])

  // ── Pointer down on port (connect) ────────────────────────────────────
  const handlePortPointerDown = useCallback((e, ideaId, _portSide) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const idea = ideas.find(i => i.id === ideaId)
    if (!idea) return

    setConnectingFrom(ideaId)
    setTempLine({ x1: idea.x, y1: idea.y, x2: idea.x, y2: idea.y })
    dragRef.current = { type: 'connect', fromId: ideaId }
    containerRef.current.setPointerCapture(e.pointerId)
  }, [ideas])

  // ── Pointer move ───────────────────────────────────────────────────────
  const handlePointerMove = useCallback((e) => {
    const d = dragRef.current
    if (!d) return

    if (d.type === 'pan') {
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      if (!d.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) d.moved = true
      if (d.moved) {
        setPan({ x: d.startPanX + dx, y: d.startPanY + dy })
      }
    } else if (d.type === 'drag-node') {
      const dx = (e.clientX - d.startX) / zoom
      const dy = (e.clientY - d.startY) / zoom
      if (!d.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) d.moved = true
      if (d.moved) {
        updateIdea(projectId, d.ideaId, {
          x: d.startIdeaX + dx,
          y: d.startIdeaY + dy,
        })
      }
    } else if (d.type === 'connect') {
      const pos = toCanvas(e.clientX, e.clientY)
      const src = ideas.find(i => i.id === d.fromId)
      if (src) {
        setTempLine({ x1: src.x, y1: src.y, x2: pos.x, y2: pos.y })
      }

      const targetId = findIdeaIdAtPointer(e.clientX, e.clientY, d.fromId)
      if (hoverTargetRef.current !== targetId) {
        hoverTargetRef.current = targetId
        setHoverTarget(targetId)
      }
    }
  }, [zoom, projectId, ideas, toCanvas, updateIdea, findIdeaIdAtPointer])

  // ── Pointer up ─────────────────────────────────────────────────────────
  const handlePointerUp = useCallback((e) => {
    const d = dragRef.current
    if (!d) return

    if (d.type === 'connect') {
      const targetId = hoverTargetRef.current
        ?? findIdeaIdAtPointer(e.clientX, e.clientY, d.fromId)
      if (targetId && targetId !== d.fromId) {
        addConnection(projectId, d.fromId, targetId)
      }
      setConnectingFrom(null)
      setTempLine(null)
      hoverTargetRef.current = null
      setHoverTarget(null)
    }

    // If panning and barely moved → just a click (deselect handled by onPointerDown)
    dragRef.current = null
  }, [projectId, addConnection, findIdeaIdAtPointer])

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [handlePointerMove, handlePointerUp])

  // ── Double click on canvas → create idea ──────────────────────────────
  const handleDoubleClick = useCallback((e) => {
    if (e.target !== containerRef.current && !e.target.classList.contains('canvas-world-bg')) return
    const pos = toCanvas(e.clientX, e.clientY)
    setCreatingAt(pos)
  }, [toCanvas])

  // ── Connection click to delete ─────────────────────────────────────────
  const handleConnectionClick = useCallback((e, connId) => {
    e.stopPropagation()
    if (confirm('Delete this connection?')) {
      deleteConnection(projectId, connId)
    }
  }, [projectId, deleteConnection])

  // ── Compute unique themes for group backgrounds ────────────────────────
  const themes = [...new Set(ideas.map(i => i.theme).filter(Boolean))]

  // ── Zoom controls ──────────────────────────────────────────────────────
  const zoomIn  = () => setZoom(z => Math.min(MAX_ZOOM, z * 1.2))
  const zoomOut = () => setZoom(z => Math.max(MIN_ZOOM, z / 1.2))
  const resetView = () => { setZoom(1); setPan({ x: 80, y: 60 }) }

  const containerCls = [
    'canvas-container',
    connectingFrom ? 'connecting' : '',
    dragRef.current?.type === 'pan' && dragRef.current?.moved ? 'panning' : '',
  ].filter(Boolean).join(' ')

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* ── Canvas ────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className={containerCls}
        onPointerDown={handleCanvasPointerDown}
        onDoubleClick={handleDoubleClick}
      >
        <div
          className="canvas-world"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          {/* SVG layer: theme groups + connections */}
          <svg
            style={{
              position: 'absolute',
              top: 0, left: 0,
              overflow: 'visible',
              pointerEvents: 'none',
              width: 0, height: 0,
            }}
          >
            {/* Theme group backgrounds */}
            {themes.map(theme => {
              const bounds = getThemeBounds(ideas, theme)
              if (!bounds) return null
              const tc = getThemeColor(theme)
              return (
                <g key={theme}>
                  <rect
                    x={bounds.x} y={bounds.y}
                    width={bounds.width} height={bounds.height}
                    rx={18} ry={18}
                    fill={tc.group}
                    stroke={tc.border}
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                  />
                  <text
                    x={bounds.x + 12}
                    y={bounds.y - 6}
                    fontSize={11}
                    fontWeight={600}
                    fill={tc.text}
                    fontFamily="Inter, sans-serif"
                  >
                    {theme}
                  </text>
                </g>
              )
            })}

            {/* Connection lines */}
            {connections.map(conn => {
              const from = ideas.find(i => i.id === conn.fromId)
              const to   = ideas.find(i => i.id === conn.toId)
              if (!from || !to) return null
              const p1 = edgePoint(from.x, from.y, to.x, to.y)
              const p2 = edgePoint(to.x, to.y, from.x, from.y)
              const d  = makePath(p1.x, p1.y, p2.x, p2.y)
              return (
                <g key={conn.id} style={{ pointerEvents: 'stroke' }}>
                  {/* Wide invisible hit area */}
                  <path
                    d={d}
                    stroke="transparent"
                    strokeWidth={12}
                    fill="none"
                    style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                    onClick={e => handleConnectionClick(e, conn.id)}
                  />
                  <path
                    d={d}
                    stroke="#94A3B8"
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    markerEnd="url(#arrow)"
                  />
                </g>
              )
            })}

            {/* Temp connection line while drawing */}
            {tempLine && (
              <line
                x1={tempLine.x1} y1={tempLine.y1}
                x2={tempLine.x2} y2={tempLine.y2}
                stroke="#6366F1"
                strokeWidth={2}
                strokeDasharray="6 3"
                strokeLinecap="round"
              />
            )}

            {/* Arrow marker */}
            <defs>
              <marker
                id="arrow"
                markerWidth={8} markerHeight={8}
                refX={6} refY={3}
                orient="auto"
              >
                <path d="M0,0 L0,6 L8,3 z" fill="#94A3B8"/>
              </marker>
            </defs>
          </svg>

          {/* Idea nodes */}
          {ideas.map(idea => (
            <IdeaNode
              key={idea.id}
              idea={idea}
              selected={selectedId === idea.id}
              connecting={!!connectingFrom}
              onPointerDownNode={handleNodePointerDown}
              onPointerDownPort={handlePortPointerDown}
              onPointerEnter={id => {
                if (connectingFrom) {
                  hoverTargetRef.current = id
                  setHoverTarget(id)
                }
              }}
              onPointerLeave={id => {
                if (connectingFrom && hoverTargetRef.current === id) {
                  hoverTargetRef.current = null
                  setHoverTarget(null)
                }
              }}
              onClick={id => setSelectedId(id)}
              onDoubleClick={id => setEditingId(id)}
            />
          ))}
        </div>
      </div>

      {/* ── Toolbar overlay ──────────────────────────────────────── */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
        {/* Add idea */}
        <button
          onClick={() => setCreatingAt({ x: (800 - pan.x) / zoom, y: (400 - pan.y) / zoom })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
          title="Add idea (or double-click canvas)"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
          </svg>
          Add Idea
        </button>

        <div className="w-px h-6 bg-slate-200 dark:bg-slate-600" />

        {/* Zoom controls */}
        <button
          onClick={zoomOut}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title="Zoom out"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/>
          </svg>
        </button>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono w-10 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={zoomIn}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title="Zoom in"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
          </svg>
        </button>
        <button
          onClick={resetView}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title="Reset view"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4.93 4.93a10 10 0 0114.14 14.14A10 10 0 014.93 4.93zm1.41 1.41a8 8 0 1011.31 11.31A8 8 0 006.34 6.34zM10 6a4 4 0 110 8 4 4 0 010-8z"/>
          </svg>
        </button>

        {/* Help text */}
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-600" />
        <span className="text-[11px] text-slate-400">
          Double-click to add · Drag ports to connect
        </span>
      </div>

      {/* ── Selected idea actions ─────────────────────────────────── */}
      {selectedId && (() => {
        const idea = ideas.find(i => i.id === selectedId)
        if (!idea) return null
        return (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
            <button
              onClick={() => setEditingId(selectedId)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
              </svg>
              Edit
            </button>
            <button
              onClick={() => {
                if (confirm('Delete this idea?')) {
                  deleteIdea(projectId, selectedId)
                  setSelectedId(null)
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-xl transition-colors font-medium"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"/>
              </svg>
              Delete
            </button>
            <button
              onClick={() => setSelectedId(null)}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
        )
      })()}

      {/* ── Idea modal ────────────────────────────────────────────── */}
      {(editingId || creatingAt) && (
        <IdeaModal
          projectId={projectId}
          idea={editingId ? ideas.find(i => i.id === editingId) : null}
          initialPosition={creatingAt}
          existingThemes={[...new Set(ideas.map(i => i.theme).filter(Boolean))]}
          onClose={() => { setEditingId(null); setCreatingAt(null) }}
        />
      )}
    </div>
  )
}
