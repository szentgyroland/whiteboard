import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'

const MIN_GROUP_SIZE = 2

function nextGroupName(groups) {
  const maxNumber = groups.reduce((max, group) => {
    const match = group?.name?.trim().match(/^Group\s+(\d+)$/i)
    if (!match) return max
    const value = Number(match[1])
    return Number.isFinite(value) ? Math.max(max, value) : max
  }, 0)
  return `Group ${maxNumber + 1}`
}

function normalizeImportedProjectData(data, projectId) {
  const payload = data && typeof data === 'object' ? data : {}
  const projectPayload =
    payload.project && typeof payload.project === 'object' ? payload.project : payload

  const now = Date.now()
  const rawIdeas = Array.isArray(payload.ideas) ? payload.ideas : []
  const rawConnections = Array.isArray(payload.connections) ? payload.connections : []
  const rawGroups = Array.isArray(payload.groups) ? payload.groups : []
  const rawGroupConnections = Array.isArray(payload.groupConnections) ? payload.groupConnections : []

  const ideaIdMap = new Map()
  const ideas = rawIdeas.map((idea, index) => {
    const nextId = uuidv4()
    if (typeof idea?.id === 'string' && idea.id.trim()) {
      ideaIdMap.set(idea.id, nextId)
    }
    return {
      id: nextId,
      projectId,
      createdAt: Number.isFinite(idea?.createdAt) ? idea.createdAt : now + index,
      title: typeof idea?.title === 'string' ? idea.title : 'New Idea',
      description: typeof idea?.description === 'string' ? idea.description : '',
      theme: typeof idea?.theme === 'string' ? idea.theme : '',
      priority: typeof idea?.priority === 'string' ? idea.priority : 'medium',
      status: typeof idea?.status === 'string' ? idea.status : 'backlog',
      deadline:
        typeof idea?.deadline === 'string' || idea?.deadline === null
          ? idea.deadline
          : null,
      x: Number.isFinite(idea?.x) ? idea.x : 400,
      y: Number.isFinite(idea?.y) ? idea.y : 300,
    }
  })

  const groupIdMap = new Map()
  rawGroups.forEach(group => {
    if (typeof group?.id === 'string' && group.id.trim()) {
      groupIdMap.set(group.id, uuidv4())
    }
  })

  const groups = rawGroups
    .map((group, index) => {
      const mappedIdeaIds = [...new Set((group?.ideaIds ?? []).map(id => ideaIdMap.get(id)).filter(Boolean))]
      if (mappedIdeaIds.length < MIN_GROUP_SIZE) return null
      return {
        id: groupIdMap.get(group.id) ?? uuidv4(),
        ideaIds: mappedIdeaIds,
        name: typeof group?.name === 'string' && group.name.trim() ? group.name : `Group ${index + 1}`,
        createdAt: Number.isFinite(group?.createdAt) ? group.createdAt : now + index,
      }
    })
    .filter(Boolean)

  const validIdeaIds = new Set(ideas.map(idea => idea.id))
  const validGroupIds = new Set(groups.map(group => group.id))

  const connections = rawConnections
    .map(connection => ({
      id: uuidv4(),
      fromId: ideaIdMap.get(connection?.fromId),
      toId: ideaIdMap.get(connection?.toId),
    }))
    .filter(
      connection =>
        connection.fromId &&
        connection.toId &&
        connection.fromId !== connection.toId &&
        validIdeaIds.has(connection.fromId) &&
        validIdeaIds.has(connection.toId)
    )

  const groupConnections = rawGroupConnections
    .map(connection => ({
      id: uuidv4(),
      fromGroupId: groupIdMap.get(connection?.fromGroupId),
      toGroupId: groupIdMap.get(connection?.toGroupId),
    }))
    .filter(
      connection =>
        connection.fromGroupId &&
        connection.toGroupId &&
        connection.fromGroupId !== connection.toGroupId &&
        validGroupIds.has(connection.fromGroupId) &&
        validGroupIds.has(connection.toGroupId)
    )

  const project = {
    name: typeof projectPayload.name === 'string' ? projectPayload.name.trim() : '',
    description: typeof projectPayload.description === 'string' ? projectPayload.description.trim() : '',
    color: typeof projectPayload.color === 'string' && projectPayload.color.trim()
      ? projectPayload.color
      : '#6366F1',
  }

  return { project, ideas, connections, groups, groupConnections }
}

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

      addProjectFromImport(data) {
        const id = uuidv4()
        const imported = normalizeImportedProjectData(data, id)
        const project = {
          id,
          createdAt: Date.now(),
          color: '#6366F1',
          ...imported.project,
        }
        set(state => ({
          projects: [...state.projects, project],
          currentProjectId: id,
          ideas: { ...state.ideas, [id]: imported.ideas },
          connections: { ...state.connections, [id]: imported.connections },
          groups: { ...state.groups, [id]: imported.groups },
          groupConnections: { ...state.groupConnections, [id]: imported.groupConnections },
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

      exportProject(projectId) {
        const state = get()
        const project = state.projects.find(p => p.id === projectId)
        if (!project) return null
        return {
          version: 1,
          exportedAt: new Date().toISOString(),
          project: {
            name: project.name,
            description: project.description ?? '',
            color: project.color ?? '#6366F1',
          },
          ideas: (state.ideas[projectId] ?? []).map(({ projectId: _, ...idea }) => idea),
          connections: state.connections[projectId] ?? [],
          groups: state.groups[projectId] ?? [],
          groupConnections: state.groupConnections[projectId] ?? [],
        }
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
        set(state => {
          const currentGroups = state.groups[projectId] ?? []
          return {
            groups: {
              ...state.groups,
              [projectId]: [
                ...currentGroups,
                {
                  id,
                  ideaIds: uniqueIdeaIds,
                  name: nextGroupName(currentGroups),
                  createdAt: Date.now(),
                },
              ],
            },
          }
        })
        return id
      },

      updateGroup(projectId, id, data) {
        set(state => ({
          groups: {
            ...state.groups,
            [projectId]: (state.groups[projectId] ?? []).map(g =>
              g.id === id ? { ...g, ...data } : g
            ),
          },
        }))
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
