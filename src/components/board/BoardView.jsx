import { useState } from 'react'
import useStore from '../../store/useStore'
import IdeaModal from '../modals/IdeaModal'
import { getThemeColor, PRIORITY_CONFIG, STATUS_CONFIG } from '../../utils/colors'

const COLUMNS = [
  { id: 'backlog',     label: 'Backlog',       icon: '○' },
  { id: 'todo',        label: 'To Do',         icon: '◉' },
  { id: 'in_progress', label: 'In Progress',   icon: '◑' },
  { id: 'in_review',   label: 'In Review',     icon: '◷' },
  { id: 'done',        label: 'Done',          icon: '●' },
]

export default function BoardView({ projectId }) {
  const { ideas: allIdeas, updateIdea, deleteIdea } = useStore()
  const ideas = allIdeas[projectId] ?? []

  const [editingId,  setEditingId]  = useState(null)
  const [creating,   setCreating]   = useState(false)
  const [filterTheme, setFilterTheme] = useState('')
  const [filterPri,   setFilterPri]   = useState('')
  const [search,      setSearch]      = useState('')

  const themes    = [...new Set(ideas.map(i => i.theme).filter(Boolean))]
  const existingThemes = themes

  const filtered = ideas.filter(idea => {
    if (filterTheme && idea.theme !== filterTheme) return false
    if (filterPri   && idea.priority !== filterPri) return false
    if (search && !idea.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const moveIdea = (id, status) => updateIdea(projectId, id, { status })

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* ── Toolbar ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0 flex-wrap">
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
          </svg>
          New Idea
        </button>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
            <path d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/>
          </svg>
          <input
            type="text"
            placeholder="Search ideas…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg w-44 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400"
          />
        </div>

        {/* Theme filter */}
        {themes.length > 0 && (
          <select
            value={filterTheme}
            onChange={e => setFilterTheme(e.target.value)}
            className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
          >
            <option value="">All themes</option>
            {themes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}

        {/* Priority filter */}
        <select
          value={filterPri}
          onChange={e => setFilterPri(e.target.value)}
          className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
        >
          <option value="">All priorities</option>
          {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <span className="ml-auto text-sm text-slate-400">{filtered.length} idea{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Columns ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 h-full p-4 min-w-max">
          {COLUMNS.map(col => {
            const colIdeas = filtered.filter(i => (i.status ?? 'backlog') === col.id)
            const conf     = STATUS_CONFIG[col.id]
            return (
              <div
                key={col.id}
                className="flex flex-col w-72 min-w-[18rem] bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
              >
                {/* Column header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                  <span style={{ color: conf.color }} className="text-base">{col.icon}</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{col.label}</span>
                  <span
                    className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: conf.bg, color: conf.color }}
                  >
                    {colIdeas.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {colIdeas.length === 0 && (
                    <p className="text-xs text-slate-300 dark:text-slate-600 text-center py-6">No ideas here</p>
                  )}
                  {colIdeas.map(idea => (
                    <BoardCard
                      key={idea.id}
                      idea={idea}
                      onEdit={() => setEditingId(idea.id)}
                      onMove={status => moveIdea(idea.id, status)}
                      onDelete={() => {
                        if (confirm('Delete this idea?')) deleteIdea(projectId, idea.id)
                      }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────── */}
      {(editingId || creating) && (
        <IdeaModal
          projectId={projectId}
          idea={editingId ? ideas.find(i => i.id === editingId) : null}
          existingThemes={existingThemes}
          onClose={() => { setEditingId(null); setCreating(false) }}
        />
      )}
    </div>
  )
}

// ── Board Card ──────────────────────────────────────────────────────────────

function BoardCard({ idea, onEdit, onMove, onDelete }) {
  const [showMenu, setShowMenu] = useState(false)
  const themeColor   = getThemeColor(idea.theme)
  const priorityConf = PRIORITY_CONFIG[idea.priority ?? 'medium']

  const deadline = idea.deadline ? new Date(idea.deadline) : null
  const now = new Date()
  const isOverdue     = deadline && deadline < now && idea.status !== 'done'
  const isNearDeadline= deadline && !isOverdue && (deadline - now) < 3 * 24 * 60 * 60 * 1000

  // Next / prev status cycling
  const colIds  = COLUMNS.map(c => c.id)
  const curIdx  = colIds.indexOf(idea.status ?? 'backlog')
  const nextCol = colIds[curIdx + 1]
  const prevCol = colIds[curIdx - 1]

  return (
    <div
      className="relative bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
      onClick={onEdit}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
        style={{ background: themeColor.border }}
      />

      <div className="pl-2">
        {/* Theme + priority */}
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          {idea.theme && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: themeColor.bg, color: themeColor.text, border: `1px solid ${themeColor.border}` }}
            >
              {idea.theme}
            </span>
          )}
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1"
            style={{ background: priorityConf.bg, color: priorityConf.text }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: priorityConf.dot }} />
            {priorityConf.label}
          </span>
        </div>

        {/* Title */}
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">{idea.title || 'Untitled'}</p>

        {/* Description */}
        {idea.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug line-clamp-2">{idea.description}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-2.5">
          {deadline ? (
            <span
              className="text-[10px] font-medium flex items-center gap-1"
              style={{ color: isOverdue ? '#EF4444' : isNearDeadline ? '#F59E0B' : '#94A3B8' }}
            >
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"/>
              </svg>
              {isOverdue && 'Overdue · '}
              {deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          ) : <span />}

          {/* Quick move arrows */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            {prevCol && (
              <button
                onClick={() => onMove(prevCol)}
                className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600"
                title={`Move to ${STATUS_CONFIG[prevCol].label}`}
              >
                <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/>
                </svg>
              </button>
            )}
            {nextCol && (
              <button
                onClick={() => onMove(nextCol)}
                className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600"
                title={`Move to ${STATUS_CONFIG[nextCol].label}`}
              >
                <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/>
                </svg>
              </button>
            )}
            <button
              onClick={onDelete}
              className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
              title="Delete"
            >
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
