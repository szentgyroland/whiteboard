import { useState } from 'react'
import useStore from './store/useStore'
import Sidebar from './components/Sidebar'
import Canvas from './components/logical/Canvas'
import BoardView from './components/board/BoardView'

export default function App() {
  const { projects, currentProjectId } = useStore()
  const [view, setView] = useState('canvas') // 'canvas' | 'board'

  const currentProject = projects.find(p => p.id === currentProjectId)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Sidebar ─────────────────────────────── */}
      <Sidebar />

      {/* ── Main area ───────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-3 px-5 h-14 border-b border-slate-200 bg-white shadow-sm flex-shrink-0">
          {currentProject ? (
            <>
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: currentProject.color }}
              />
              <h1 className="font-semibold text-slate-800 truncate">{currentProject.name}</h1>
              {currentProject.description && (
                <span className="text-slate-400 text-sm truncate hidden sm:block">
                  — {currentProject.description}
                </span>
              )}
            </>
          ) : (
            <h1 className="font-semibold text-slate-400">No project selected</h1>
          )}

          {/* View toggle */}
          {currentProject && (
            <div className="ml-auto flex gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setView('canvas')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  view === 'canvas'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm7 0a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1V4zm-7 7a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm7 0a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-3z"/>
                </svg>
                Mind Map
              </button>
              <button
                onClick={() => setView('board')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  view === 'board'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 4a1 1 0 012 0v12a1 1 0 11-2 0V4zm5 3a1 1 0 012 0v9a1 1 0 11-2 0V7zm5-2a1 1 0 012 0v11a1 1 0 11-2 0V5z"/>
                </svg>
                Board
              </button>
            </div>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 min-h-0 overflow-hidden">
          {!currentProject ? (
            <EmptyState />
          ) : view === 'canvas' ? (
            <Canvas projectId={currentProjectId} />
          ) : (
            <BoardView projectId={currentProjectId} />
          )}
        </main>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center">
        <svg className="w-10 h-10 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="14" rx="3"/>
          <circle cx="8" cy="10" r="2"/>
          <circle cx="12" cy="7" r="2"/>
          <circle cx="16" cy="10" r="2"/>
          <line x1="8" y1="10" x2="12" y2="7"/>
          <line x1="12" y1="7" x2="16" y2="10"/>
          <line x1="5" y1="21" x2="19" y2="21"/>
          <line x1="7" y1="24" x2="17" y2="24"/>
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-semibold text-slate-700">No project selected</h2>
        <p className="text-slate-500 mt-1 max-w-xs">Create or select a project from the sidebar to start planning your ideas.</p>
      </div>
    </div>
  )
}
