import { useState } from 'react'
import useStore from '../../store/useStore'
import { PROJECT_COLORS } from '../../utils/colors'

export default function ProjectModal({ project, onClose }) {
  const { addProject, addProjectFromImport, updateProject, exportProject } = useStore()
  const isEdit = !!project

  const [name,  setName]  = useState(project?.name  ?? '')
  const [desc,  setDesc]  = useState(project?.description ?? '')
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0])
  const [error, setError] = useState('')
  const [importError, setImportError] = useState('')
  const [importedData, setImportedData] = useState(null)
  const [importFileName, setImportFileName] = useState('')

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid project file')
      }
      const importedProject = parsed.project && typeof parsed.project === 'object' ? parsed.project : parsed
      const importedName = typeof importedProject.name === 'string' ? importedProject.name.trim() : ''
      const importedDesc = typeof importedProject.description === 'string' ? importedProject.description : ''
      const importedColor = typeof importedProject.color === 'string' ? importedProject.color : PROJECT_COLORS[0]

      setImportedData(parsed)
      setImportFileName(file.name)
      setImportError('')
      setName(importedName)
      setDesc(importedDesc)
      setColor(importedColor)
      setError('')
    } catch (err) {
      console.error('Project import failed', err)
      setImportedData(null)
      setImportFileName('')
      setImportError('Could not parse JSON project file.')
    } finally {
      e.target.value = ''
    }
  }

  const handleExport = () => {
    if (!project) return
    const exported = exportProject(project.id)
    if (!exported) return
    const slug = (project.name || 'project')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60)
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const fileBaseName = slug || 'project'
    link.download = `${fileBaseName}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) { setError('Project name is required'); return }
    if (isEdit) {
      updateProject(project.id, { name: trimmedName, description: desc.trim(), color })
    } else {
      if (importedData) {
        addProjectFromImport({
          ...importedData,
          project: {
            ...(importedData.project ?? {}),
            name: trimmedName,
            description: desc.trim(),
            color,
          },
        })
      } else {
        addProject({ name: trimmedName, description: desc.trim(), color })
      }
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {isEdit ? 'Edit Project' : 'New Project'}
          </h2>
          <div className="flex items-center gap-2">
            {isEdit && (
              <button
                type="button"
                onClick={handleExport}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Export JSON
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Import existing project (JSON)
              </label>
              <input
                type="file"
                accept="application/json,.json"
                onChange={handleImport}
                className="block w-full text-xs text-slate-500 dark:text-slate-300 file:mr-3 file:px-3 file:py-2 file:border-0 file:rounded-lg file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-950 dark:file:text-indigo-300"
              />
              {importFileName && (
                <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                  Loaded {importFileName}
                </p>
              )}
              {importError && <p className="mt-1 text-xs text-red-500">{importError}</p>}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Project Name <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              placeholder="e.g. My Startup, Q3 Planning…"
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
              placeholder="What's this project about?"
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none transition-shadow bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full transition-transform hover:scale-110 focus:outline-none"
                  style={{
                    background: c,
                    boxShadow: color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : 'none',
                  }}
                />
              ))}
            </div>
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
              {isEdit ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
