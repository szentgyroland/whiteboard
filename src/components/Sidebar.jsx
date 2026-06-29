import { useState } from 'react'
import useStore from '../store/useStore'
import ProjectModal from './modals/ProjectModal'

export default function Sidebar() {
  const { projects, currentProjectId, setCurrentProject, deleteProject } = useStore()
  const [showModal, setShowModal] = useState(false)
  const [editProject, setEditProject] = useState(null)
  const [hovered, setHovered] = useState(null)

  const handleEdit = (e, project) => {
    e.stopPropagation()
    setEditProject(project)
    setShowModal(true)
  }

  const handleDelete = (e, id) => {
    e.stopPropagation()
    if (confirm('Delete this project and all its ideas?')) {
      deleteProject(id)
    }
  }

  return (
    <>
      <aside className="flex flex-col w-60 min-w-[15rem] bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2h5v5H2V2zm7 0h5v5H9V2zM2 9h5v5H2V9zm7 0h5v5H9V9z"/>
            </svg>
          </div>
          <span className="font-bold text-slate-800 dark:text-slate-100 text-sm tracking-wide">Whiteboard</span>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto py-3 px-2">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Projects</span>
            <button
              onClick={() => { setEditProject(null); setShowModal(true) }}
              className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors"
              title="New project"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
              </svg>
            </button>
          </div>

          {projects.length === 0 && (
            <div className="px-2 py-6 text-center">
              <p className="text-xs text-slate-400">No projects yet.</p>
              <button
                onClick={() => { setEditProject(null); setShowModal(true) }}
                className="mt-2 text-xs text-indigo-500 hover:text-indigo-700 font-medium"
              >
                Create your first project →
              </button>
            </div>
          )}

          <ul className="space-y-0.5">
            {projects.map(project => (
              <li
                key={project.id}
                onMouseEnter={() => setHovered(project.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setCurrentProject(project.id)}
                className={`group flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                  currentProjectId === project.id
                    ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: project.color }}
                />
                <span className="flex-1 text-sm font-medium truncate">{project.name}</span>

                {/* Actions — visible on hover */}
                {hovered === project.id && (
                  <span className="flex gap-0.5 flex-shrink-0">
                    <button
                      onClick={e => handleEdit(e, project)}
                      className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
                      title="Edit"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M11.013 2.513a1.75 1.75 0 012.475 2.474L6.226 12.25a2.25 2.25 0 01-.892.596l-2.894.969a.375.375 0 01-.474-.474l.968-2.893a2.25 2.25 0 01.597-.892l7.482-7.483z"/>
                      </svg>
                    </button>
                    <button
                      onClick={e => handleDelete(e, project.id)}
                      className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                      title="Delete"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M5.75 3.5h4.5a.25.25 0 000-.5h-4.5a.25.25 0 000 .5zM2 4.25a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H12.5v7.75A1.75 1.75 0 0110.75 14.5h-5.5A1.75 1.75 0 013.5 12.75V5h-.75A.75.75 0 012 4.25zm2 .75v7.75c0 .138.112.25.25.25h5.5a.25.25 0 00.25-.25V5H4z"/>
                      </svg>
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700">
          <p className="text-xs text-slate-400 text-center">Stored locally in your browser</p>
        </div>
      </aside>

      {showModal && (
        <ProjectModal
          project={editProject}
          onClose={() => { setShowModal(false); setEditProject(null) }}
        />
      )}
    </>
  )
}
