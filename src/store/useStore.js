import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'

const MIN_GROUP_SIZE = 2

const useStore = create(
  persist(
    (set, get) => ({
      // ─── State ───────────────────────────────────────────────────────────
      projects: [],
      currentProjectId: null,
      ideas: {},       // { [projectId]: Idea[] }
      connections: {}, // { [projectId]: Connection[] }
      groups: {},      // { [projectId]: Group[] }
      groupConnections: {}, // { [projectId]: GroupConnection[] }

      // ─── Project actions ─────────────────────────────────────────────────
      addProject(data) {
        const id = uuidv4()
        const project = { id, createdAt: Date.now(), color: '#6366F1', ...data }
        set(state => ({
          projects: [...state.projects, project],
          currentProjectId: id,
          ideas: { ...state.ideas, [id]: [] },
          connections: { ...state.connections, [id]: [] },
          groups: { ...state.groups, [id]: [] },
          groupConnections: { ...state.groupConnections, [id]: [] },
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
          const groups = { ...state.groups }
          const groupConnections = { ...state.groupConnections }
          delete ideas[id]
          delete connections[id]
          delete groups[id]
          delete groupConnections[id]
          return {
            projects,
            ideas,
            connections,
            groups,
            groupConnections,
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
        set(state => {
          const currentGroups = state.groups[projectId] ?? []
          const updatedGroups = currentGroups
            .map(g => ({
              ...g,
              ideaIds: (g.ideaIds ?? []).filter(ideaId => ideaId !== id),
            }))
            .filter(g => (g.ideaIds ?? []).length >= MIN_GROUP_SIZE)
          const remainingGroupIds = new Set(updatedGroups.map(g => g.id))
          return {
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
            groups: {
              ...state.groups,
              [projectId]: updatedGroups,
            },
            groupConnections: {
              ...state.groupConnections,
              [projectId]: (state.groupConnections[projectId] ?? []).filter(
                c => remainingGroupIds.has(c.fromGroupId) && remainingGroupIds.has(c.toGroupId)
              ),
            },
          }
        })
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

      // ─── Group actions ────────────────────────────────────────────────────
      addGroup(projectId, ideaIds) {
        const uniqueIdeaIds = [...new Set(ideaIds)].filter(Boolean)
        if (uniqueIdeaIds.length < MIN_GROUP_SIZE) return null
        const id = uuidv4()
        set(state => ({
          groups: {
            ...state.groups,
            [projectId]: [
              ...(state.groups[projectId] ?? []),
              { id, ideaIds: uniqueIdeaIds, createdAt: Date.now() },
            ],
          },
        }))
        return id
      },

      ungroupIdeas(projectId, ideaIds) {
        const target = new Set(ideaIds)
        set(state => {
          const remainingGroups = (state.groups[projectId] ?? []).filter(
            g => !(g.ideaIds ?? []).some(id => target.has(id))
          )
          const remainingIds = new Set(remainingGroups.map(g => g.id))
          return {
            groups: {
              ...state.groups,
              [projectId]: remainingGroups,
            },
            groupConnections: {
              ...state.groupConnections,
              [projectId]: (state.groupConnections[projectId] ?? []).filter(
                c => remainingIds.has(c.fromGroupId) && remainingIds.has(c.toGroupId)
              ),
            },
          }
        })
      },

      deleteIdeas(projectId, ideaIds) {
        const target = new Set(ideaIds)
        if (target.size === 0) return
        set(state => {
          const currentGroups = state.groups[projectId] ?? []
          const updatedGroups = currentGroups
            .map(g => ({
              ...g,
              ideaIds: (g.ideaIds ?? []).filter(id => !target.has(id)),
            }))
            .filter(g => (g.ideaIds ?? []).length >= MIN_GROUP_SIZE)
          const remainingGroupIds = new Set(updatedGroups.map(g => g.id))
          return {
            ideas: {
              ...state.ideas,
              [projectId]: (state.ideas[projectId] ?? []).filter(i => !target.has(i.id)),
            },
            connections: {
              ...state.connections,
              [projectId]: (state.connections[projectId] ?? []).filter(
                c => !target.has(c.fromId) && !target.has(c.toId)
              ),
            },
            groups: {
              ...state.groups,
              [projectId]: updatedGroups,
            },
            groupConnections: {
              ...state.groupConnections,
              [projectId]: (state.groupConnections[projectId] ?? []).filter(
                c => remainingGroupIds.has(c.fromGroupId) && remainingGroupIds.has(c.toGroupId)
              ),
            },
          }
        })
      },

      addGroupConnection(projectId, fromGroupId, toGroupId) {
        if (!fromGroupId || !toGroupId || fromGroupId === toGroupId) return
        const existing = get().groupConnections[projectId] ?? []
        const duplicate = existing.some(
          c =>
            (c.fromGroupId === fromGroupId && c.toGroupId === toGroupId) ||
            (c.fromGroupId === toGroupId && c.toGroupId === fromGroupId)
        )
        if (duplicate) return
        set(state => ({
          groupConnections: {
            ...state.groupConnections,
            [projectId]: [
              ...(state.groupConnections[projectId] ?? []),
              { id: uuidv4(), fromGroupId, toGroupId },
            ],
          },
        }))
      },

      deleteGroupConnection(projectId, id) {
        set(state => ({
          groupConnections: {
            ...state.groupConnections,
            [projectId]: (state.groupConnections[projectId] ?? []).filter(c => c.id !== id),
          },
        }))
      },
    }),
    { name: 'whiteboard-v1' }
  )
)

export default useStore
