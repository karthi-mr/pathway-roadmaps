import type { Comment, Issue, LogEntry, Member, ProgressEntry, Project, Roadmap, Status } from './types'
import { firebaseConfigured, createFirebaseStore } from './firebaseStore'
import { createLocalStore } from './localStore'

export type Unsub = () => void
export type OnError = (err: { code?: string; message?: string }) => void

export interface Store {
  mode: 'firebase' | 'local'
  onAuth(cb: (user: Member | null) => void): Unsub
  /** `name` is only used in local demo mode. */
  signIn(name?: string): Promise<void>
  signOut(): Promise<void>
  /** Roadmaps this person owns or that were shared with them. */
  watchRoadmaps(uid: string, cb: (r: Roadmap[]) => void, onError: OnError): Unsub
  watchLogs(cb: (l: LogEntry[]) => void, onError: OnError): Unsub
  watchMembers(cb: (m: Member[]) => void, onError: OnError): Unsub
  createRoadmap(r: Roadmap): Promise<void>
  updateRoadmap(id: string, patch: Partial<Roadmap>): Promise<void>
  deleteRoadmap(id: string): Promise<void>
  setProgress(roadmapId: string, uid: string, topicId: string, status: Status): Promise<void>
  /** Write a full progress entry (used to record a revision). */
  setEntry(roadmapId: string, uid: string, topicId: string, entry: ProgressEntry): Promise<void>
  addLog(l: LogEntry): Promise<void>
  deleteLog(id: string): Promise<void>
  /** Comments live under their roadmap, so they are exactly as private as it is. */
  watchComments(roadmapId: string, cb: (c: Comment[]) => void, onError: OnError): Unsub
  addComment(c: Comment): Promise<void>
  deleteComment(c: Comment): Promise<void>
  /** Projects this person owns or that were shared with them. */
  watchProjects(uid: string, cb: (p: Project[]) => void, onError: OnError): Unsub
  createProject(p: Project): Promise<void>
  updateProject(id: string, patch: Partial<Project>): Promise<void>
  deleteProject(id: string): Promise<void>
  /** Create or replace one issue without touching the others. */
  saveIssue(projectId: string, issue: Issue): Promise<void>
  deleteIssue(projectId: string, issueId: string): Promise<void>
  /** Save profile settings such as weekly goals. */
  updateMember(uid: string, patch: Partial<Member>): Promise<void>
}

/**
 * With Firebase keys in .env.local the app uses Google sign-in + Firestore.
 * Without them it runs in demo mode, keeping everything in this browser.
 */
export const store: Store = firebaseConfigured ? createFirebaseStore() : createLocalStore()
