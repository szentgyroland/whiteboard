import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'

const useStore = create(
  persist(
    (set, get) => ({
      // ─── State ───────────────────────────────────────────────────────────
      projects: [],
      currentProjectId: null,
      ideas: {},       // { [projectId]: Idea[] }
      connections: {}, // { [projectId]: Connection[] }

      // ─── Project actions ─────────────────────────────────────────────────
      addProject(data) {
        const id = uuidv4()
        const project = { id, createdAt: Date.now(), color: '#6366F1', ...data }
        set(state => ({
          projects: [...state.projects, project],
          currentProjectId: id,
          ideas: { ...state.ideas, [id]: [] },
          connections: { ...state.connections, [id]: [] },
        }))
        return id
      },

      updateProject(id, data) {
        set(state => ({
          projects: state.projects.map(p => p.id === id ? { ...p, ...data } : p),
        }))
      },

      deleteProject(id) {
        set(state => {
          const projects = state.projects.filter(p => p.id !== id)
          const ideas = { ...state.ideas }
          const connections = { ...state.connections }
          delete ideas[id]
          delete connections[id]
          return {
            projects,
            ideas,
            connections,
            currentProjectId:
              state.currentProjectId === id
                ? (projects[0]?.id ?? null)
                : state.currentProjectId,
          }
        })
      },

      setCurrentProject(id) {
        set({ currentProjectId: id })
      },

      // ─── Idea actions ─────────────────────────────────────────────────────
      addIdea(projectId, data) {
        const id = uuidv4()
        const idea = {
          id,
          projectId,
          createdAt: Date.now(),
          title: 'New Idea',
          description: '',
          theme: '',
          priority: 'medium',
          status: 'backlog',
          deadline: null,
          x: 400,
          y: 300,
          ...data,
        }
        set(state => ({
          ideas: {
            ...state.ideas,
            [projectId]: [...(state.ideas[projectId] ?? []), idea],
          },
        }))
        return id
      },

      updateIdea(projectId, id, data) {
        set(state => ({
          ideas: {
            ...state.ideas,
            [projectId]: (state.ideas[projectId] ?? []).map(i =>
              i.id === id ? { ...i, ...data } : i
            ),
          },
        }))
      },

      deleteIdea(projectId, id) {
        set(state => ({
          ideas: {
            ...state.ideas,
            [projectId]: (state.ideas[projectId] ?? []).filter(i => i.id !== id),
          },
          connections: {
            ...state.connections,
            [projectId]: (state.connections[projectId] ?? []).filter(
              c => c.fromId !== id && c.toId !== id
            ),
          },
        }))
      },

      // ─── Connection actions ───────────────────────────────────────────────
      addConnection(projectId, fromId, toId) {
        const existing = get().connections[projectId] ?? []
        const duplicate = existing.some(
          c =>
            (c.fromId === fromId && c.toId === toId) ||
            (c.fromId === toId && c.toId === fromId)
        )
        if (duplicate || fromId === toId) return
        set(state => ({
          connections: {
            ...state.connections,
            [projectId]: [
              ...(state.connections[projectId] ?? []),
              { id: uuidv4(), fromId, toId },
            ],
          },
        }))
      },

      deleteConnection(projectId, id) {
        set(state => ({
          connections: {
            ...state.connections,
            [projectId]: (state.connections[projectId] ?? []).filter(c => c.id !== id),
          },
        }))
      },
    }),
    { name: 'whiteboard-v1' }
  )
)

export default useStore
