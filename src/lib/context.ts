import { createContext, useContext } from 'react'
import type { Comment, LogEntry, Member, Project, Roadmap } from './types'

export interface FocusRequest {
  roadmapId: string
  topicId: string
  title: string
  roadmapTitle: string
  minutes: number
}

export interface AppState {
  /** The signed-in person, including saved settings such as weekly goals. */
  user: Member
  roadmaps: Roadmap[]
  projects: Project[]
  logs: LogEntry[]
  members: Member[]
  comments: Comment[]
  /** Show a short message at the bottom of the screen. */
  notify: (msg: string) => void
  /** Wraps a write so a failure is shown instead of silently lost. */
  run: (p: Promise<unknown>) => void
  /** Topic id of the running focus session, if any. */
  focusing: string | null
  startFocus: (f: FocusRequest) => void
  openSearch: () => void
}

export const AppContext = createContext<AppState | null>(null)

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside the app shell')
  return ctx
}

export const go = (path: string) => {
  location.hash = path
}
