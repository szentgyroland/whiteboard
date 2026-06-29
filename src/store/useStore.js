import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'

function cleanupSmallGroups(projectIdeas) {
  const groupSizes = projectIdeas.reduce((acc, idea) => {
    if (!idea.groupId) return acc
    acc[idea.groupId] = (acc[idea.groupId] ?? 0) + 1
    return acc
  }, {})

  return projectIdeas.map(idea =>
    idea.groupId && (groupSizes[idea.groupId] ?? 0) < 2
      ? { ...idea, groupId: null }
      : idea
  )
}

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
          groupId: null,
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
        set(state => {
          const remainingIdeas = (state.ideas[projectId] ?? []).filter(i => i.id !== id)
          return {
            ideas: {
              ...state.ideas,
              [projectId]: cleanupSmallGroups(remainingIdeas),
            },
            connections: {
              ...state.connections,
              [projectId]: (state.connections[projectId] ?? []).filter(
                c => c.fromId !== id && c.toId !== id
              ),
            },
          }
        })
      },

      groupIdeas(projectId, ideaIds) {
        const uniqueIdeaIds = [...new Set(ideaIds)]
        if (uniqueIdeaIds.length < 2) return

        const projectIdeas = get().ideas[projectId] ?? []
        const existingGroupId = projectIdeas.find(
          idea => uniqueIdeaIds.includes(idea.id) && idea.groupId
        )?.groupId
        const nextGroupId = existingGroupId ?? uuidv4()

        set(state => ({
          ideas: {
            ...state.ideas,
            [projectId]: cleanupSmallGroups((state.ideas[projectId] ?? []).map(idea =>
              uniqueIdeaIds.includes(idea.id) ? { ...idea, groupId: nextGroupId } : idea
            )),
          },
        }))
      },

      degroupIdeas(projectId, ideaIds) {
        const uniqueIdeaIds = [...new Set(ideaIds)]
        if (uniqueIdeaIds.length === 0) return

        set(state => ({
          ideas: {
            ...state.ideas,
            [projectId]: cleanupSmallGroups((state.ideas[projectId] ?? []).map(idea =>
              uniqueIdeaIds.includes(idea.id) ? { ...idea, groupId: null } : idea
            )),
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
