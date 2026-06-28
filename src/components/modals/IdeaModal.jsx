import { useState, useRef, useEffect } from 'react'
import useStore from '../../store/useStore'
import { PRIORITY_CONFIG, STATUS_CONFIG, getThemeColor } from '../../utils/colors'

const PRIORITIES = Object.entries(PRIORITY_CONFIG)
const STATUSES   = Object.entries(STATUS_CONFIG)

export default function IdeaModal({ projectId, idea, initialPosition, existingThemes, onClose }) {
  const { addIdea, updateIdea } = useStore()
  const isEdit = !!idea

  const [title,    setTitle]    = useState(idea?.title       ?? '')
  const [desc,     setDesc]     = useState(idea?.description ?? '')
  const [theme,    setTheme]    = useState(idea?.theme       ?? '')
  const [priority, setPriority] = useState(idea?.priority   ?? 'medium')
  const [status,   setStatus]   = useState(idea?.status     ?? 'backlog')
  const [deadline, setDeadline] = useState(idea?.deadline   ?? '')
  const [error,    setError]    = useState('')
  const [showThemeSuggestions, setShowThemeSuggestions] = useState(false)

  const titleRef = useRef(null)
  useEffect(() => { titleRef.current?.focus() }, [])

  const themeColor = getThemeColor(theme || undefined)

  const filteredThemes = existingThemes.filter(
    t => t.toLowerCase().includes(theme.toLowerCase()) && t !== theme
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }

    const data = {
      title:       title.trim(),
      description: desc.trim(),
      theme:       theme.trim(),
      priority,
      status,
      deadline:    deadline || null,
    }

    if (isEdit) {
      updateIdea(projectId, idea.id, data)
    } else {
      addIdea(projectId, {
        ...data,
        x: initialPosition?.x ?? 400,
        y: initialPosition?.y ?? 300,
      })
    }
    onClose()
  }

  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with theme colour accent */}
        <div
          className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between"
          style={{ borderLeft: `4px solid ${themeColor.border}` }}
        >
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {isEdit ? 'Edit Idea' : 'New Idea'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={e => { setTitle(e.target.value); setError('') }}
              placeholder="What's the idea?"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-shadow bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 ${
                error ? 'border-red-300' : 'border-slate-200 dark:border-slate-600'
              }`}
            />
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Description</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="More context, notes, links…"
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none transition-shadow bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400"
            />
          </div>

          {/* Theme */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Theme
              <span className="ml-1.5 text-xs text-slate-400 font-normal">
                (groups related ideas with the same color)
              </span>
            </label>
            <input
              type="text"
              value={theme}
              onChange={e => { setTheme(e.target.value); setShowThemeSuggestions(true) }}
              onFocus={() => setShowThemeSuggestions(true)}
              onBlur={() => setTimeout(() => setShowThemeSuggestions(false), 150)}
              placeholder="e.g. Frontend, Marketing…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-shadow bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400"
              style={{ borderColor: theme ? themeColor.border : undefined }}
            />
            {/* Suggestions dropdown */}
            {showThemeSuggestions && filteredThemes.length > 0 && (
              <ul className="absolute z-10 top-full mt-1 w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-lg overflow-hidden">
                {filteredThemes.map(t => {
                  const tc = getThemeColor(t)
                  return (
                    <li
                      key={t}
                      onClick={() => { setTheme(t); setShowThemeSuggestions(false) }}
                      className="flex items-center gap-2 px-3.5 py-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100"
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: tc.dot }} />
                      {t}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Priority + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Priority</label>
              <div className="flex flex-col gap-1.5">
                {PRIORITIES.map(([key, conf]) => (
                  <label
                    key={key}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all ${
                      priority === key
                        ? 'border-transparent shadow-sm'
                        : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                    }`}
                    style={priority === key ? { background: conf.bg, borderColor: conf.dot } : {}}
                  >
                    <input
                      type="radio"
                      name="priority"
                      value={key}
                      checked={priority === key}
                      onChange={() => setPriority(key)}
                      className="sr-only"
                    />
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: conf.dot }} />
                    <span
                      className={`text-sm font-medium ${priority === key ? '' : 'text-slate-500 dark:text-slate-400'}`}
                      style={{ color: priority === key ? conf.text : undefined }}
                    >
                      {conf.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Status</label>
              <div className="flex flex-col gap-1.5">
                {STATUSES.map(([key, conf]) => (
                  <label
                    key={key}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all ${
                      status === key
                        ? 'border-transparent shadow-sm'
                        : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                    }`}
                    style={status === key ? { background: conf.bg, borderColor: conf.color } : {}}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={key}
                      checked={status === key}
                      onChange={() => setStatus(key)}
                      className="sr-only"
                    />
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: conf.color }} />
                    <span
                      className={`text-sm font-medium ${status === key ? '' : 'text-slate-500 dark:text-slate-400'}`}
                      style={{ color: status === key ? conf.color : undefined }}
                    >
                      {conf.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Deadline</label>
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-shadow bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors font-medium"
            >
              {isEdit ? 'Save Changes' : 'Add Idea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
