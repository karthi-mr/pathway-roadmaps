import type { IssueStatus, IssueType, Priority, ProjectStatus } from './types'

export const ISSUE_TYPES: Record<IssueType, { label: string; icon: string }> = {
  task: { label: 'Task', icon: '✅' },
  bug: { label: 'Bug', icon: '🐞' },
  feature: { label: 'Feature', icon: '✨' },
}

export const PRIORITIES: Record<Priority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const ISSUE_STATUSES: Record<IssueStatus, string> = {
  open: 'Open',
  doing: 'In progress',
  resolved: 'Resolved',
}

export const PROJECT_STATUSES: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  paused: 'On hold',
  done: 'Completed',
}
