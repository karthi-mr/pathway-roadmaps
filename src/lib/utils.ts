import type { Issue, LogEntry, Member, Milestone, Priority, ProgressEntry, Project, Roadmap, Status, Topic } from './types'

export const newId = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export const now = () => Date.now()

export const dayKey = (d: Date | number = new Date()) => {
  const x = new Date(d)
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${x.getFullYear()}-${m}-${day}`
}

export const prettyDay = (key: string) => {
  const today = dayKey()
  const y = new Date()
  y.setDate(y.getDate() - 1)
  if (key === today) return 'Today'
  if (key === dayKey(y)) return 'Yesterday'
  const [yy, mm, dd] = key.split('-').map(Number)
  return new Date(yy, mm - 1, dd).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export const formatMinutes = (min: number) => {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export const allTopics = (r: Roadmap): Topic[] =>
  r.milestones.flatMap((m) => m.topics)

export const statusOf = (r: Roadmap, uid: string, topicId: string): Status =>
  r.progress?.[uid]?.[topicId]?.s ?? 'todo'

export interface Progress {
  done: number
  doing: number
  total: number
  pct: number
}

export const progressOf = (r: Roadmap, uid: string): Progress => {
  const topics = allTopics(r)
  let done = 0
  let doing = 0
  for (const t of topics) {
    const s = statusOf(r, uid, t.id)
    if (s === 'done') done++
    else if (s === 'doing') doing++
  }
  const total = topics.length
  return { done, doing, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

export const milestoneDone = (r: Roadmap, uid: string, m: Milestone) =>
  m.topics.filter((t) => statusOf(r, uid, t.id) === 'done').length

/** The topic to work on next: the first one in progress, otherwise the first not started. */
export const nextTopic = (r: Roadmap, uid: string) => {
  let firstTodo: { milestone: Milestone; topic: Topic } | null = null
  for (const milestone of r.milestones) {
    for (const topic of milestone.topics) {
      const s = statusOf(r, uid, topic.id)
      if (s === 'doing') return { milestone, topic }
      if (s === 'todo' && !firstTodo) firstTodo = { milestone, topic }
    }
  }
  return firstTodo
}

/** Activity per day for one person: journal entries + topics completed. */
export const activityByDay = (roadmaps: Roadmap[], logs: LogEntry[], uid: string) => {
  const map = new Map<string, number>()
  const bump = (k: string) => map.set(k, (map.get(k) ?? 0) + 1)
  for (const l of logs) if (l.userId === uid) bump(l.date)
  for (const r of roadmaps) {
    const mine = r.progress?.[uid] ?? {}
    const live = new Set(allTopics(r).map((t) => t.id))
    for (const [tid, p] of Object.entries(mine)) {
      if (p.s === 'done' && live.has(tid)) bump(dayKey(p.t))
    }
  }
  return map
}

export const streakOf = (activity: Map<string, number>) => {
  const d = new Date()
  if (!activity.has(dayKey(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (activity.has(dayKey(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

export const greeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export const COLORS = ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e']

export const EMOJIS = [
  '🚀', '💻', '🧠', '📚', '🎨', '⚙️', '🌐', '📱',
  '🤖', '📊', '🔐', '☁️', '🎯', '🧪', '🎸', '🗣️',
]

/** Monday 00:00 of the current week. */
export const weekStart = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

/** Whole days from today to a YYYY-MM-DD date (negative = in the past). */
export const daysUntil = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86400000)
}

export const shortDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export const ago = (ts: number) => {
  const min = Math.floor((Date.now() - ts) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  if (min < 60 * 24) return `${Math.floor(min / 60)}h ago`
  if (min < 60 * 24 * 7) return `${Math.floor(min / 1440)}d ago`
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export interface DueInfo {
  label: string
  tone: 'done' | 'over' | 'soon' | 'ok'
}

export const dueInfo = (due: string, complete: boolean): DueInfo => {
  if (complete) return { label: 'done', tone: 'done' }
  const d = daysUntil(due)
  if (d < 0) return { label: `${-d}d overdue`, tone: 'over' }
  if (d === 0) return { label: 'due today', tone: 'soon' }
  return { label: `in ${d}d`, tone: d <= 3 ? 'soon' : 'ok' }
}

/** Milestones with a target date that this person has not finished yet, soonest first. */
export const deadlinesOf = (roadmaps: Roadmap[], uid: string) =>
  roadmaps
    .flatMap((roadmap) =>
      roadmap.milestones
        .filter((m) => m.due)
        .map((milestone) => ({
          roadmap,
          milestone,
          done: milestoneDone(roadmap, uid, milestone),
          total: milestone.topics.length,
        })),
    )
    .filter((x) => x.total === 0 || x.done < x.total)
    .sort((a, b) => a.milestone.due!.localeCompare(b.milestone.due!))

/** A finished topic comes back for revision 1, 7 and 30 days later. */
export const REVIEW_STEPS = [1, 7, 30]

export const reviewDue = (p: ProgressEntry) => {
  if (p.s !== 'done') return false
  const step = p.r ?? 0
  if (step >= REVIEW_STEPS.length) return false
  const d = new Date(p.rt ?? p.t)
  d.setDate(d.getDate() + REVIEW_STEPS[step])
  return dayKey(d) <= dayKey()
}

export const dueReviews = (roadmaps: Roadmap[], uid: string) => {
  const out: { roadmap: Roadmap; topic: Topic; entry: ProgressEntry }[] = []
  for (const roadmap of roadmaps) {
    const mine = roadmap.progress?.[uid] ?? {}
    for (const topic of allTopics(roadmap)) {
      const entry = mine[topic.id]
      if (entry && reviewDue(entry)) out.push({ roadmap, topic, entry })
    }
  }
  return out.sort((a, b) => (a.entry.rt ?? a.entry.t) - (b.entry.rt ?? b.entry.t))
}

/** Study time and topics finished since Monday. */
export const weekStats = (roadmaps: Roadmap[], logs: LogEntry[], uid: string) => {
  const start = weekStart()
  const startKey = dayKey(start)
  const minutes = logs
    .filter((l) => l.userId === uid && l.date >= startKey)
    .reduce((n, l) => n + (l.minutes || 0), 0)
  let topics = 0
  for (const r of roadmaps) {
    const mine = r.progress?.[uid] ?? {}
    for (const t of allTopics(r)) {
      const p = mine[t.id]
      if (p?.s === 'done' && p.t >= start.getTime()) topics++
    }
  }
  return { minutes, topics }
}

/* ---------- sharing ---------- */

/** Owner first, then the people it is shared with (only those we know). */
export const peopleOn = (item: { ownerId: string; sharedWith?: string[] }, members: Member[]) => {
  const ids = [item.ownerId, ...(item.sharedWith ?? [])]
  return ids.map((id) => members.find((m) => m.uid === id)).filter((m): m is Member => !!m)
}

/** Roadmaps this person is learning from: their own, plus shared ones they have started. */
export const learningRoadmaps = (roadmaps: Roadmap[], uid: string) =>
  roadmaps.filter((r) => r.ownerId === uid || Object.keys(r.progress?.[uid] ?? {}).length > 0)

/* ---------- projects ---------- */

export const parseKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const addDays = (key: string, n: number) => {
  const d = parseKey(key)
  d.setDate(d.getDate() + n)
  return dayKey(d)
}

/** Whole days from a to b (b - a). */
export const daysBetween = (a: string, b: string) =>
  Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86400000)

export const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

export const issuesOf = (p: Project): Issue[] =>
  Object.values(p.issues ?? {}).sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt - b.createdAt,
  )

export const issueOverdue = (i: Issue) => i.status !== 'resolved' && !!i.due && daysUntil(i.due) < 0

export interface ProjectHealth {
  label: string
  tone: 'done' | 'over' | 'soon' | 'ok' | 'none'
  /** share of the schedule that has passed, 0–100 */
  timePct: number
  /** share of issues resolved, 0–100 */
  workPct: number
  total: number
  resolved: number
  open: number
  doing: number
  overdue: number
}

/** Compares how much of the schedule is gone with how much of the work is resolved. */
export const projectHealth = (p: Project): ProjectHealth => {
  const list = issuesOf(p)
  const total = list.length
  const resolved = list.filter((i) => i.status === 'resolved').length
  const doing = list.filter((i) => i.status === 'doing').length
  const overdue = list.filter(issueOverdue).length
  const span = Math.max(1, daysBetween(p.start, p.end) + 1)
  const gone = daysBetween(p.start, dayKey()) + 1
  const timePct = Math.round(Math.min(100, Math.max(0, (gone / span) * 100)))
  const workPct = total ? Math.round((resolved / total) * 100) : 0
  const base = { timePct, workPct, total, resolved, doing, open: total - resolved - doing, overdue }

  if (p.status === 'done') return { ...base, label: 'Completed', tone: 'done' }
  if (p.status === 'paused') return { ...base, label: 'On hold', tone: 'none' }
  if (daysUntil(p.end) < 0 && resolved < total) return { ...base, label: 'Past end date', tone: 'over' }
  if (daysUntil(p.start) > 0) return { ...base, label: `Starts in ${daysUntil(p.start)}d`, tone: 'none' }
  if (total === 0) return { ...base, label: 'No issues yet', tone: 'none' }
  if (overdue > 0 || workPct + 20 < timePct) return { ...base, label: 'At risk', tone: 'soon' }
  return { ...base, label: 'On track', tone: 'ok' }
}
