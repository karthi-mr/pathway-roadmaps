import type { Milestone } from './types'
import { newId } from './utils'

export interface Template {
  key: string
  name: string
  emoji: string
  outline: [string, string[]][]
}

export const TEMPLATES: Template[] = [
  { key: 'blank', name: 'Blank', emoji: '✨', outline: [] },
  {
    key: 'frontend',
    name: 'Frontend',
    emoji: '🎨',
    outline: [
      ['Foundations', ['HTML semantics', 'CSS layout: Flexbox & Grid', 'Responsive design', 'Accessibility basics']],
      ['JavaScript', ['Language fundamentals', 'DOM & events', 'Async: promises & fetch', 'Modules & tooling']],
      ['React', ['Components & props', 'State & effects', 'Routing', 'Data fetching', 'Forms & validation']],
      ['Ship it', ['TypeScript basics', 'Testing', 'Performance', 'Deploy a project']],
    ],
  },
  {
    key: 'backend',
    name: 'Backend',
    emoji: '⚙️',
    outline: [
      ['Basics', ['HTTP & REST', 'Pick a language & framework', 'Build a CRUD API']],
      ['Data', ['SQL fundamentals', 'Schema design', 'Indexes & query tuning', 'Caching']],
      ['Reliability', ['Auth & sessions', 'Testing', 'Logging & monitoring', 'Queues & background jobs']],
      ['Deploy', ['Docker', 'CI/CD', 'Cloud hosting']],
    ],
  },
  {
    key: 'dsa',
    name: 'DSA',
    emoji: '🧠',
    outline: [
      ['Core structures', ['Arrays & strings', 'Hash maps', 'Linked lists', 'Stacks & queues']],
      ['Techniques', ['Two pointers', 'Sliding window', 'Binary search', 'Recursion & backtracking']],
      ['Trees & graphs', ['Binary trees', 'Heaps', 'BFS & DFS', 'Shortest paths']],
      ['Advanced', ['Dynamic programming', 'Greedy', 'Tries', 'Union find']],
    ],
  },
]

export const buildMilestones = (t: Template): Milestone[] =>
  t.outline.map(([title, topics]) => ({
    id: newId(),
    title,
    topics: topics.map((x) => ({ id: newId(), title: x, notes: '', resources: [] })),
  }))
