import type { Comment, LogEntry, Member, Project, Roadmap } from './types'
import type { Store } from './store'
import { TEMPLATES, buildMilestones } from './templates'
import { newId } from './utils'

const KEY = 'pathway:v1'

interface DB {
  user: Member | null
  roadmaps: Roadmap[]
  logs: LogEntry[]
  comments: Comment[]
  projects: Project[]
  /** extra demo teammates, only ever set by hand for testing */
  peers?: Member[]
}

const load = (): DB => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { comments: [], projects: [], ...(JSON.parse(raw) as Partial<DB>) } as DB
  } catch {
    /* storage unavailable or corrupt — start fresh */
  }
  return { user: null, roadmaps: [], logs: [], comments: [], projects: [] }
}

/** Demo mode: same interface as the Firebase store, data lives in localStorage. */
export function createLocalStore(): Store {
  let db = load()
  const listeners = new Set<() => void>()

  const commit = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db))
    } catch {
      /* ignore quota / private-mode errors */
    }
    listeners.forEach((fn) => fn())
  }

  const watch = (fn: () => void) => {
    listeners.add(fn)
    fn()
    return () => {
      listeners.delete(fn)
    }
  }

  return {
    mode: 'local',

    onAuth: (cb) => watch(() => cb(db.user)),

    async signIn(name) {
      const user: Member = {
        uid: 'local-user',
        name: name?.trim() || 'Learner',
        email: 'demo mode',
        photo: null,
      }
      const roadmaps = [...db.roadmaps]
      if (roadmaps.length === 0) {
        const t = TEMPLATES.find((x) => x.key === 'frontend')!
        roadmaps.push({
          id: newId(),
          title: 'Frontend Developer',
          description: 'A sample roadmap to explore — edit it or delete it.',
          emoji: '🎨',
          color: '#8b5cf6',
          ownerId: user.uid,
          ownerName: user.name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          milestones: buildMilestones(t),
          sharedWith: [],
          progress: {},
        })
      }
      db = { ...db, user, roadmaps }
      commit()
    },

    async signOut() {
      db = { ...db, user: null }
      commit()
    },

    watchRoadmaps: (uid, cb) =>
      watch(() => cb(db.roadmaps.filter((r) => r.ownerId === uid || (r.sharedWith ?? []).includes(uid)))),
    watchLogs: (cb) => watch(() => cb(db.logs)),
    watchMembers: (cb) => watch(() => cb(db.user ? [db.user, ...(db.peers ?? [])] : [])),

    async createRoadmap(r) {
      db = { ...db, roadmaps: [r, ...db.roadmaps] }
      commit()
    },

    async updateRoadmap(id, patch) {
      db = { ...db, roadmaps: db.roadmaps.map((r) => (r.id === id ? { ...r, ...patch } : r)) }
      commit()
    },

    async deleteRoadmap(id) {
      db = { ...db, roadmaps: db.roadmaps.filter((r) => r.id !== id) }
      commit()
    },

    async setProgress(roadmapId, uid, topicId, status) {
      db = {
        ...db,
        roadmaps: db.roadmaps.map((r) => {
          if (r.id !== roadmapId) return r
          const mine = { ...(r.progress[uid] ?? {}) }
          if (status === 'todo') delete mine[topicId]
          else mine[topicId] = { s: status, t: Date.now() }
          return { ...r, progress: { ...r.progress, [uid]: mine } }
        }),
      }
      commit()
    },

    async addLog(l) {
      db = { ...db, logs: [l, ...db.logs] }
      commit()
    },

    async deleteLog(id) {
      db = { ...db, logs: db.logs.filter((l) => l.id !== id) }
      commit()
    },

    async setEntry(roadmapId, uid, topicId, entry) {
      db = {
        ...db,
        roadmaps: db.roadmaps.map((r) =>
          r.id === roadmapId
            ? { ...r, progress: { ...r.progress, [uid]: { ...(r.progress[uid] ?? {}), [topicId]: entry } } }
            : r,
        ),
      }
      commit()
    },

    watchComments: (roadmapId, cb) => watch(() => cb(db.comments.filter((c) => c.roadmapId === roadmapId))),

    async addComment(c) {
      db = { ...db, comments: [...db.comments, c] }
      commit()
    },

    async deleteComment(c) {
      db = { ...db, comments: db.comments.filter((x) => x.id !== c.id) }
      commit()
    },

    watchProjects: (uid, cb) =>
      watch(() => cb(db.projects.filter((p) => p.ownerId === uid || p.sharedWith.includes(uid)))),

    async createProject(p) {
      db = { ...db, projects: [p, ...db.projects] }
      commit()
    },

    async updateProject(id, patch) {
      db = { ...db, projects: db.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) }
      commit()
    },

    async deleteProject(id) {
      db = { ...db, projects: db.projects.filter((p) => p.id !== id) }
      commit()
    },

    async saveIssue(projectId, issue) {
      db = {
        ...db,
        projects: db.projects.map((p) =>
          p.id === projectId ? { ...p, issues: { ...p.issues, [issue.id]: issue }, updatedAt: Date.now() } : p,
        ),
      }
      commit()
    },

    async deleteIssue(projectId, issueId) {
      db = {
        ...db,
        projects: db.projects.map((p) => {
          if (p.id !== projectId) return p
          const issues = { ...p.issues }
          delete issues[issueId]
          return { ...p, issues, updatedAt: Date.now() }
        }),
      }
      commit()
    },

    async updateMember(_uid, patch) {
      if (!db.user) return
      db = { ...db, user: { ...db.user, ...patch } }
      commit()
    },
  }
}
