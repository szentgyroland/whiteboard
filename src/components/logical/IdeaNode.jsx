import { useRef, useState } from 'react'
import { getThemeColor, PRIORITY_CONFIG } from '../../utils/colors'

const NODE_W = 180
const NODE_H = 80

/**
 * PORT_POSITIONS: {side: {top%, left%, transform}}
 * These are in percentage relative to the node.
 */
const PORTS = [
  { id: 'top',    style: { top: '-6px',  left: '50%',  transform: 'translateX(-50%)' } },
  { id: 'right',  style: { top: '50%',   right: '-6px', transform: 'translateY(-50%)' } },
  { id: 'bottom', style: { bottom: '-6px', left: '50%', transform: 'translateX(-50%)' } },
  { id: 'left',   style: { top: '50%',   left: '-6px', transform: 'translateY(-50%)' } },
]

export { NODE_W, NODE_H }

export default function IdeaNode({
  idea,
  selected,
  connecting,        // true when we're in connection-drawing mode globally
  onPointerDownNode, // (e, ideaId) — start drag
  onPointerDownPort, // (e, ideaId, portSide) — start connection
  onPointerEnter,    // (ideaId) — notify canvas we're hovering this node
  onPointerLeave,    // (ideaId)
  onClick,           // (ideaId)
  onDoubleClick,     // (ideaId) — open edit modal
}) {
  const themeColor = getThemeColor(idea.theme)
  const priorityConf = PRIORITY_CONFIG[idea.priority ?? 'medium']

  const deadline = idea.deadline ? new Date(idea.deadline) : null
  const now = new Date()
  const isOverdue = deadline && deadline < now && idea.status !== 'done'
  const isNearDeadline = deadline && !isOverdue && (deadline - now) < 3 * 24 * 60 * 60 * 1000

  return (
    <div
      className={`idea-node ${selected ? 'selected' : ''}`}
      style={{
        left: idea.x,
        top: idea.y,
        transform: 'translate(-50%, -50%)',
        background: themeColor.bg,
        borderColor: selected ? '#6366F1' : themeColor.border,
        minHeight: NODE_H,
      }}
      onClick={e => { e.stopPropagation(); onClick(idea.id) }}
      onDoubleClick={e => { e.stopPropagation(); onDoubleClick(idea.id) }}
      onPointerDown={e => { e.stopPropagation(); onPointerDownNode(e, idea.id) }}
      onPointerEnter={() => onPointerEnter(idea.id)}
      onPointerLeave={() => onPointerLeave(idea.id)}
    >
      {/* Connection ports */}
      {PORTS.map(port => (
        <div
          key={port.id}
          className="port"
          style={port.style}
          onPointerDown={e => {
            e.stopPropagation()
            e.preventDefault()
            onPointerDownPort(e, idea.id, port.id)
          }}
        />
      ))}

      {/* Card body */}
      <div className="px-3 pt-3 pb-2.5">
        {/* Theme badge */}
        {idea.theme && (
          <div className="flex items-center gap-1 mb-1.5">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: themeColor.border + '22', color: themeColor.text }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: themeColor.dot }}
              />
              {idea.theme}
            </span>
          </div>
        )}

        {/* Title */}
        <p
          className="text-sm font-semibold leading-tight"
          style={{ color: themeColor.text }}
        >
          {idea.title || 'Untitled'}
        </p>

        {/* Description (truncated) */}
        {idea.description && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug line-clamp-2">
            {idea.description}
          </p>
        )}

        {/* Footer: priority + deadline */}
        <div className="flex items-center justify-between mt-2">
          <span
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: priorityConf.bg, color: priorityConf.text }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: priorityConf.dot }}
            />
            {priorityConf.label}
          </span>

          {deadline && (
            <span
              className="text-[10px] font-medium"
              style={{ color: isOverdue ? '#EF4444' : isNearDeadline ? '#F59E0B' : '#94A3B8' }}
            >
              {isOverdue ? '⚠ ' : ''}
              {deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
