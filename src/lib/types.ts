export type Status = 'todo' | 'doing' | 'done'

export interface Resource {
  id: string
  label: string
  url: string
}

export interface Topic {
  id: string
  title: string
  notes: string
  resources: Resource[]
}

export interface Milestone {
  id: string
  title: string
  topics: Topic[]
  /** target date, YYYY-MM-DD */
  due?: string | null
}

/** s = status, t = time it was set (ms), r = revisions done, rt = time of the last revision */
export interface ProgressEntry {
  s: Status
  t: number
  r?: number
  rt?: number
}

export interface Roadmap {
  id: string
  title: string
  description: string
  emoji: string
  color: string
  ownerId: string
  ownerName: string
  createdAt: number
  updatedAt: number
  milestones: Milestone[]
  /** uids of the people the owner shared this with; everyone else cannot see it */
  sharedWith?: string[]
  /** progress[userId][topicId] — every member tracks their own progress */
  progress: Record<string, Record<string, ProgressEntry>>
}

export interface LogEntry {
  id: string
  userId: string
  userName: string
  userPhoto: string | null
  text: string
  minutes: number
  roadmapId: string | null
  roadmapTitle: string | null
  /** local day, YYYY-MM-DD */
  date: string
  createdAt: number
}

export interface Member {
  uid: string
  name: string
  email: string
  photo: string | null
  /** weekly goals; 0 or missing = not set */
  goalMinutes?: number
  goalTopics?: number
}

export interface Comment {
  id: string
  roadmapId: string
  topicId: string
  userId: string
  userName: string
  userPhoto: string | null
  text: string
  createdAt: number
}

export type ProjectStatus = 'planning' | 'active' | 'paused' | 'done'
export type IssueStatus = 'open' | 'doing' | 'resolved'
export type IssueType = 'task' | 'bug' | 'feature'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'

/** A block of work on the project timeline. */
export interface Phase {
  id: string
  title: string
  start: string
  end: string
  done: boolean
}

export interface IssueNote {
  id: string
  userId: string
  userName: string
  userPhoto: string | null
  text: string
  createdAt: number
}

export interface Issue {
  id: string
  /** short number shown as #12 */
  num: number
  title: string
  description: string
  type: IssueType
  priority: Priority
  status: IssueStatus
  assigneeId: string | null
  due: string | null
  createdBy: string
  createdByName: string
  createdAt: number
  resolvedAt: number | null
  resolvedBy: string | null
  notes: IssueNote[]
}

export interface Project {
  id: string
  name: string
  description: string
  emoji: string
  color: string
  ownerId: string
  ownerName: string
  sharedWith: string[]
  status: ProjectStatus
  /** YYYY-MM-DD */
  start: string
  end: string
  phases: Phase[]
  /** keyed by issue id so two people editing different issues never collide */
  issues: Record<string, Issue>
  createdAt: number
  updatedAt: number
}
