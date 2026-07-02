import { useRef, useState, useCallback, useEffect } from 'react'
import useStore from '../../store/useStore'
import IdeaNode, { NODE_W, NODE_H } from './IdeaNode'
import IdeaModal from '../modals/IdeaModal'
import { getThemeColor } from '../../utils/colors'

const MIN_ZOOM = 0.15
const MAX_ZOOM = 3
const GROUP_PADDING = 36
const GROUP_BORDER_RADIUS = 26

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

function boundsFromIdeas(ideas, ideaIds, nodeW = NODE_W, nodeH = NODE_H, padding = GROUP_PADDING) {
  const items = ideas.filter(i => ideaIds.includes(i.id))
  if (items.length < 2) return null
  const hw = nodeW / 2
  const hh = nodeH / 2
  const minX = Math.min(...items.map(i => i.x - hw)) - padding
  const minY = Math.min(...items.map(i => i.y - hh)) - padding
  const maxX = Math.max(...items.map(i => i.x + hw)) + padding
  const maxY = Math.max(...items.map(i => i.y + hh)) + padding
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  }
}

function rectsIntersect(a, b) {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  )
}

function getGroupLabel(group) {
  const explicitName = group?.name?.trim()
  if (explicitName) return explicitName
  const stableSuffix = group?.id?.split('-')?.[0]
  return stableSuffix ? `Group ${stableSuffix}` : 'Group'
}

export default function Canvas({ projectId }) {
  const {
    ideas: allIdeas,
    connections: allConnections,
    groups: allGroups,
    groupConnections: allGroupConnections,
    updateIdea,
    addConnection,
    deleteConnection,
    addGroup,
    ungroupIdeas,
    deleteIdeas,
    addGroupConnection,
    deleteGroupConnection,
    updateGroup,
  } = useStore()
  const ideas       = allIdeas[projectId] ?? []
  const connections = allConnections[projectId] ?? []
  const groups = allGroups[projectId] ?? []
  const groupConnections = allGroupConnections[projectId] ?? []

  // ── Transform state ────────────────────────────────────────────────────
  const [pan,  setPan]  = useState({ x: 80, y: 60 })
  const [zoom, setZoom] = useState(1)

  // ── Interaction state ──────────────────────────────────────────────────
  const [selectedIds,    setSelectedIds]    = useState([])
  const [editingId,      setEditingId]      = useState(null) // idea modal
  const [creatingAt,     setCreatingAt]     = useState(null) // {x,y} for new idea modal
  const [connectingFrom, setConnectingFrom] = useState(null) // idea id
  const [groupConnectingFrom, setGroupConnectingFrom] = useState(null) // group id
  const [tempLine,       setTempLine]       = useState(null) // {x1,y1,x2,y2}
  const [tempGroupLine,  setTempGroupLine]  = useState(null) // {x1,y1,x2,y2}
  const [hoverTarget,    setHoverTarget]    = useState(null) // idea id (while connecting)
  const [hoverGroupTarget, setHoverGroupTarget] = useState(null) // group id (while connecting)
  const [selectedConnection, setSelectedConnection] = useState(null) // {id, type: 'idea' | 'group'}
  const hoverTargetRef = useRef(null)
  const hoverGroupTargetRef = useRef(null)
  const [marqueeRect, setMarqueeRect] = useState(null) // {x,y,width,height,startX,startY}

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

  const findGroupIdAtPointer = useCallback((clientX, clientY, excludeId = null) => {
    const target = document.elementFromPoint(clientX, clientY)
    const groupEl = target?.closest?.('[data-group-id]')
    const groupId = groupEl?.dataset?.groupId ?? null
    if (!groupId || groupId === excludeId) return null
    return groupId
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

  // ── Pointer down on canvas (marquee or pan) ────────────────────────────
  const handleCanvasPointerDown = useCallback((e) => {
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return
    const isPanGesture = e.button === 0 || e.button === 1 || e.altKey
    if (isPanGesture) {
      dragRef.current = {
        type: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
        moved: false,
      }
    } else {
      const start = toCanvas(e.clientX, e.clientY)
      dragRef.current = {
        type: 'marquee',
        startX: e.clientX,
        startY: e.clientY,
        startCanvasX: start.x,
        startCanvasY: start.y,
        moved: false,
      }
      setSelectedIds([])
      setSelectedConnection(null)
      setMarqueeRect({ x: start.x, y: start.y, width: 0, height: 0, startX: start.x, startY: start.y })
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [pan, toCanvas])

  // ── Pointer down on node (drag) ────────────────────────────────────────
  const handleNodePointerDown = useCallback((e, ideaId) => {
    if (e.button !== 0) return
    const additive = e.metaKey || e.ctrlKey || e.shiftKey
    if (additive) {
      setSelectedIds(prev => (
        prev.includes(ideaId)
          ? prev.filter(id => id !== ideaId)
          : [...prev, ideaId]
      ))
      return
    }

    const movingIds = selectedIds.includes(ideaId) ? selectedIds : [ideaId]
    setSelectedIds(movingIds)
    const idea = ideas.find(i => i.id === ideaId)
    if (!idea) return

    const movingIdSet = new Set(movingIds)
    const movingIdeas = ideas.filter(i => movingIdSet.has(i.id))

    dragRef.current = {
      type: 'drag-node',
      movingIdeas: movingIdeas.map(i => ({ id: i.id, x: i.x, y: i.y })),
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    }
    // Capture on the canvas container so we get move events everywhere
    containerRef.current.setPointerCapture(e.pointerId)
  }, [ideas, selectedIds])

  // ── Pointer down on group body (drag group members) ────────────────────
  const handleGroupPointerDown = useCallback((e, groupId) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const group = groups.find(g => g.id === groupId)
    if (!group) return
    const movingIdeas = ideas.filter(i => (group.ideaIds ?? []).includes(i.id))
    if (movingIdeas.length === 0) return

    setSelectedIds(movingIdeas.map(i => i.id))
    dragRef.current = {
      type: 'drag-group',
      movingIdeas: movingIdeas.map(i => ({ id: i.id, x: i.x, y: i.y })),
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    }
    containerRef.current.setPointerCapture(e.pointerId)
  }, [groups, ideas])

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

  // ── Pointer down on group port (connect groups) ────────────────────────
  const handleGroupPortPointerDown = useCallback((e, groupId) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const group = groups.find(g => g.id === groupId)
    if (!group) return
    const bounds = boundsFromIdeas(ideas, group.ideaIds ?? [])
    if (!bounds) return

    setGroupConnectingFrom(groupId)
    setTempGroupLine({ x1: bounds.cx, y1: bounds.cy, x2: bounds.cx, y2: bounds.cy })
    dragRef.current = { type: 'connect-group', fromGroupId: groupId }
    containerRef.current.setPointerCapture(e.pointerId)
  }, [groups, ideas])

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
    } else if (d.type === 'drag-node' || d.type === 'drag-group') {
      const dx = (e.clientX - d.startX) / zoom
      const dy = (e.clientY - d.startY) / zoom
      if (!d.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) d.moved = true
      if (d.moved) {
        d.movingIdeas.forEach(idea => {
          updateIdea(projectId, idea.id, {
            x: idea.x + dx,
            y: idea.y + dy,
          })
        })
      }
    } else if (d.type === 'marquee') {
      const pos = toCanvas(e.clientX, e.clientY)
      const width = Math.abs(pos.x - d.startCanvasX)
      const height = Math.abs(pos.y - d.startCanvasY)
      if (!d.moved && (width > 2 || height > 2)) d.moved = true
      setMarqueeRect({
        x: Math.min(d.startCanvasX, pos.x),
        y: Math.min(d.startCanvasY, pos.y),
        width,
        height,
        startX: d.startCanvasX,
        startY: d.startCanvasY,
      })
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
    } else if (d.type === 'connect-group') {
      const pos = toCanvas(e.clientX, e.clientY)
      const fromGroup = groups.find(g => g.id === d.fromGroupId)
      if (fromGroup) {
        const bounds = boundsFromIdeas(ideas, fromGroup.ideaIds ?? [])
        if (bounds) {
          setTempGroupLine({ x1: bounds.cx, y1: bounds.cy, x2: pos.x, y2: pos.y })
        }
      }

      const targetId = findGroupIdAtPointer(e.clientX, e.clientY, d.fromGroupId)
      if (hoverGroupTargetRef.current !== targetId) {
        hoverGroupTargetRef.current = targetId
        setHoverGroupTarget(targetId)
      }
    }
  }, [zoom, projectId, ideas, groups, toCanvas, updateIdea, findIdeaIdAtPointer, findGroupIdAtPointer])

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

    if (d.type === 'connect-group') {
      const targetId = hoverGroupTargetRef.current
        ?? findGroupIdAtPointer(e.clientX, e.clientY, d.fromGroupId)
      if (targetId && targetId !== d.fromGroupId) {
        addGroupConnection(projectId, d.fromGroupId, targetId)
      }
      setGroupConnectingFrom(null)
      setTempGroupLine(null)
      hoverGroupTargetRef.current = null
      setHoverGroupTarget(null)
    }

    if (d.type === 'marquee') {
      if (d.moved && marqueeRect && (marqueeRect.width > 4 || marqueeRect.height > 4)) {
        const selected = ideas
          .filter(idea => rectsIntersect(
            marqueeRect,
            {
              x: idea.x - NODE_W / 2,
              y: idea.y - NODE_H / 2,
              width: NODE_W,
              height: NODE_H,
            }
          ))
          .map(idea => idea.id)
        setSelectedIds(selected)
      } else {
        setSelectedIds([])
      }
      setMarqueeRect(null)
    }

    // If panning and barely moved → just a click (deselect handled by onPointerDown)
    dragRef.current = null
  }, [projectId, ideas, marqueeRect, addConnection, addGroupConnection, findIdeaIdAtPointer, findGroupIdAtPointer])

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

  useEffect(() => {
    setSelectedIds(prev => prev.filter(id => ideas.some(i => i.id === id)))
  }, [ideas])

  // ── Double click on canvas → create idea ──────────────────────────────
  const handleDoubleClick = useCallback((e) => {
    if (findIdeaIdAtPointer(e.clientX, e.clientY)) return
    if (findGroupIdAtPointer(e.clientX, e.clientY)) return
    const pos = toCanvas(e.clientX, e.clientY)
    setCreatingAt(pos)
  }, [toCanvas, findIdeaIdAtPointer, findGroupIdAtPointer])

  // ── Connection click to delete ─────────────────────────────────────────
  const handleConnectionClick = useCallback((e, connId) => {
    e.stopPropagation()
    setSelectedIds([])
    setSelectedConnection({ id: connId, type: 'idea' })
  }, [])

  const handleGroupConnectionClick = useCallback((e, connId) => {
    e.stopPropagation()
    setSelectedIds([])
    setSelectedConnection({ id: connId, type: 'group' })
  }, [])

  const deleteSelectedConnection = useCallback(() => {
    if (!selectedConnection) return
    if (selectedConnection.type === 'idea') {
      if (!confirm('Delete this connection?')) return
      deleteConnection(projectId, selectedConnection.id)
    } else {
      if (!confirm('Delete this group connection?')) return
      deleteGroupConnection(projectId, selectedConnection.id)
    }
    setSelectedConnection(null)
  }, [selectedConnection, projectId, deleteConnection, deleteGroupConnection])

  // ── Group helpers & actions ────────────────────────────────────────────
  const groupBoundsById = groups.reduce((acc, group) => {
    const bounds = boundsFromIdeas(ideas, group.ideaIds ?? [])
    if (bounds) acc[group.id] = bounds
    return acc
  }, {})

  const selectedIdSet = new Set(selectedIds)
  const selectedGroups = groups.filter(group => {
    const members = group.ideaIds ?? []
    return members.length > 0 && members.every(id => selectedIdSet.has(id))
  })

  const groupSelectedIdeas = () => {
    if (selectedIds.length < 2) return
    addGroup(projectId, selectedIds)
    setSelectedIds([])
  }

  const ungroupSelectedIdeas = () => {
    if (selectedIds.length === 0) return
    ungroupIdeas(projectId, selectedIds)
    setSelectedIds([])
  }

  const deleteSelectedIdeas = () => {
    if (selectedIds.length === 0) return
    if (!confirm(`Delete ${selectedIds.length} selected idea${selectedIds.length === 1 ? '' : 's'}?`)) return
    deleteIdeas(projectId, selectedIds)
    setSelectedIds([])
  }

  useEffect(() => {
    if (!selectedConnection) return
    const list = selectedConnection.type === 'idea' ? connections : groupConnections
    if (!list.some(conn => conn.id === selectedConnection.id)) {
      setSelectedConnection(null)
    }
  }, [selectedConnection, connections, groupConnections])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedConnection) return
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const target = e.target
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return
      e.preventDefault()
      deleteSelectedConnection()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedConnection, deleteSelectedConnection])

  // ── Zoom controls ──────────────────────────────────────────────────────
  const zoomIn  = () => setZoom(z => Math.min(MAX_ZOOM, z * 1.2))
  const zoomOut = () => setZoom(z => Math.max(MIN_ZOOM, z / 1.2))
  const resetView = () => { setZoom(1); setPan({ x: 80, y: 60 }) }

  const handleGroupNameClick = useCallback((e, group) => {
    e.stopPropagation()
    const currentName = getGroupLabel(group)
    const nextName = prompt('Rename group', currentName)
    if (nextName === null) return
    const trimmed = nextName.trim()
    if (!trimmed || trimmed === currentName) return
    updateGroup(projectId, group.id, { name: trimmed })
  }, [projectId, updateGroup])

  const containerCls = [
    'canvas-container',
    connectingFrom || groupConnectingFrom ? 'connecting' : '',
    dragRef.current?.type === 'pan' && dragRef.current?.moved ? 'panning' : '',
  ].filter(Boolean).join(' ')

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* ── Canvas ────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className={containerCls}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={e => e.preventDefault()}
      >
        <div
          className="canvas-world"
          style={{
            width: '100%',
            height: '100%',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* SVG layer: groups + connections */}
          <svg
            style={{
              position: 'absolute',
              top: 0, left: 0,
              overflow: 'visible',
              pointerEvents: 'none',
              width: '100%',
              height: '100%',
            }}
          >
            {/* Group backgrounds */}
            {groups.map((group) => {
              const bounds = groupBoundsById[group.id]
              if (!bounds) return null
              const sampleIdea = ideas.find(i => (group.ideaIds ?? []).includes(i.id))
              const tc = getThemeColor(sampleIdea?.theme)
              const highlighted = group.id === hoverGroupTarget || group.id === groupConnectingFrom
              return (
                <g key={group.id}>
                  <rect
                    data-group-id={group.id}
                    x={bounds.x} y={bounds.y}
                    width={bounds.width} height={bounds.height}
                    rx={GROUP_BORDER_RADIUS} ry={GROUP_BORDER_RADIUS}
                    fill={tc.group}
                    stroke={tc.border}
                    strokeWidth={highlighted ? 2.5 : 1.5}
                    strokeDasharray="6 4"
                    style={{ pointerEvents: 'all', cursor: 'grab' }}
                    onPointerDown={e => handleGroupPointerDown(e, group.id)}
                  />
                  <text
                    x={bounds.x + 12}
                    y={bounds.y - 6}
                    fontSize={11}
                    fontWeight={600}
                    fill={tc.text}
                    fontFamily="Inter, sans-serif"
                    style={{ pointerEvents: 'all', cursor: 'text' }}
                    onClick={e => handleGroupNameClick(e, group)}
                  >
                    {getGroupLabel(group)}
                  </text>
                  <circle
                    cx={bounds.cx}
                    cy={bounds.y}
                    r={6}
                    fill="#6366F1"
                    stroke="#fff"
                    strokeWidth={2}
                    style={{ pointerEvents: 'all', cursor: 'crosshair' }}
                    data-group-id={group.id}
                    onPointerDown={e => handleGroupPortPointerDown(e, group.id)}
                  />
                  <circle
                    cx={bounds.cx}
                    cy={bounds.y + bounds.height}
                    r={6}
                    fill="#6366F1"
                    stroke="#fff"
                    strokeWidth={2}
                    style={{ pointerEvents: 'all', cursor: 'crosshair' }}
                    data-group-id={group.id}
                    onPointerDown={e => handleGroupPortPointerDown(e, group.id)}
                  />
                </g>
              )
            })}

            {/* Group connection lines */}
            {groupConnections.map(conn => {
              const from = groupBoundsById[conn.fromGroupId]
              const to = groupBoundsById[conn.toGroupId]
              if (!from || !to) return null
              const p1 = edgePoint(from.cx, from.cy, to.cx, to.cy, from.width / 2, from.height / 2)
              const p2 = edgePoint(to.cx, to.cy, from.cx, from.cy, to.width / 2, to.height / 2)
              const d = makePath(p1.x, p1.y, p2.x, p2.y)
              const selected = selectedConnection?.type === 'group' && selectedConnection?.id === conn.id
              return (
                <g key={conn.id} style={{ pointerEvents: 'stroke' }}>
                  <path
                    d={d}
                    stroke="transparent"
                    strokeWidth={14}
                    fill="none"
                    style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => handleGroupConnectionClick(e, conn.id)}
                  />
                  <path
                    d={d}
                    stroke={selected ? '#3730A3' : '#4F46E5'}
                    strokeWidth={selected ? 3.5 : 2.5}
                    fill="none"
                    strokeDasharray="7 4"
                    strokeLinecap="round"
                    markerEnd="url(#group-arrow)"
                  />
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
              const selected = selectedConnection?.type === 'idea' && selectedConnection?.id === conn.id
              return (
                <g key={conn.id} style={{ pointerEvents: 'stroke' }}>
                  {/* Wide invisible hit area */}
                  <path
                    d={d}
                    stroke="transparent"
                    strokeWidth={12}
                    fill="none"
                    style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => handleConnectionClick(e, conn.id)}
                  />
                  <path
                    d={d}
                    stroke={selected ? '#475569' : '#94A3B8'}
                    strokeWidth={selected ? 3 : 2}
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
            {tempGroupLine && (
              <line
                x1={tempGroupLine.x1} y1={tempGroupLine.y1}
                x2={tempGroupLine.x2} y2={tempGroupLine.y2}
                stroke="#4338CA"
                strokeWidth={2.5}
                strokeDasharray="7 4"
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
              <marker
                id="group-arrow"
                markerWidth={8} markerHeight={8}
                refX={6} refY={3}
                orient="auto"
              >
                <path d="M0,0 L0,6 L8,3 z" fill="#4F46E5"/>
              </marker>
            </defs>
          </svg>

          {/* Marquee selection */}
          {marqueeRect && (
            <div
              style={{
                position: 'absolute',
                left: marqueeRect.x,
                top: marqueeRect.y,
                width: marqueeRect.width,
                height: marqueeRect.height,
                border: '1px solid #6366F1',
                background: 'rgba(99, 102, 241, 0.14)',
                borderRadius: 8,
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Idea nodes */}
          {ideas.map(idea => (
            <IdeaNode
              key={idea.id}
              idea={idea}
              selected={selectedIds.includes(idea.id) || hoverTarget === idea.id}
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
              onClick={id => setSelectedIds([id])}
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
          Right-drag to marquee select · Left/middle/Alt-drag to pan · Drag ports to connect · Click arrows then press Delete
        </span>
      </div>

      {/* ── Selected idea actions ─────────────────────────────────── */}
      {selectedIds.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
          {selectedIds.length === 1 && (
            <button
              onClick={() => setEditingId(selectedIds[0])}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
              </svg>
              Edit
            </button>
          )}
          <button
            onClick={groupSelectedIdeas}
            disabled={selectedIds.length < 2}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-xl transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Group
          </button>
          <button
            onClick={ungroupSelectedIdeas}
            disabled={selectedGroups.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Ungroup
          </button>
          <button
            onClick={deleteSelectedIdeas}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-xl transition-colors font-medium"
          >
            {selectedIds.length === 1 ? 'Delete' : 'Delete all'}
          </button>
          <button
            onClick={() => setSelectedIds([])}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
            </svg>
          </button>
        </div>
      )}

      {selectedConnection && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {selectedConnection.type === 'group' ? 'Group connection selected' : 'Connection selected'}
          </span>
          <button
            onClick={deleteSelectedConnection}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-xl transition-colors font-medium"
          >
            Delete
          </button>
          <button
            onClick={() => setSelectedConnection(null)}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
            </svg>
          </button>
        </div>
      )}

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
