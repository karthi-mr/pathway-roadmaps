import type { Member, Milestone, Roadmap } from './types'
import { COLORS, newId } from './utils'

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

/** Copy milestones from any source, keeping only known fields and giving everything a new id. */
export const cleanMilestones = (input: unknown): Milestone[] => {
  if (!Array.isArray(input)) return []
  return input.slice(0, 100).map((m) => {
    const topics: unknown[] = Array.isArray(m?.topics) ? m.topics : []
    return {
      id: newId(),
      title: text(m?.title, 120) || 'Untitled',
      due: /^\d{4}-\d{2}-\d{2}$/.test(m?.due) ? (m.due as string) : null,
      topics: topics.slice(0, 300).map((raw) => {
        const t = raw as { title?: unknown; notes?: unknown; resources?: unknown }
        const resources: unknown[] = Array.isArray(t?.resources) ? t.resources : []
        return {
          id: newId(),
          title: text(t?.title, 160) || 'Untitled',
          notes: text(t?.notes, 20000),
          resources: resources
            .map((r) => r as { label?: unknown; url?: unknown })
            .filter((r) => /^https?:\/\//i.test(text(r?.url, 2000)))
            .slice(0, 50)
            .map((r) => ({ id: newId(), label: text(r.label, 200) || text(r.url, 200), url: text(r.url, 2000) })),
        }
      }),
    }
  })
}

const build = (user: Member, fields: Pick<Roadmap, 'title' | 'description' | 'emoji' | 'color' | 'milestones'>): Roadmap => {
  const now = Date.now()
  return { id: newId(), ownerId: user.uid, ownerName: user.name, createdAt: now, updatedAt: now, sharedWith: [], progress: {}, ...fields }
}

/** A fresh copy of a roadmap owned by `user`, without anyone's progress. */
export const duplicateRoadmap = (r: Roadmap, user: Member): Roadmap =>
  build(user, {
    title: `${r.title} (copy)`.slice(0, 60),
    description: r.description,
    emoji: r.emoji,
    color: r.color,
    // target dates belong to the original plan, so the copy starts without them
    milestones: cleanMilestones(r.milestones).map((m) => ({ ...m, due: null })),
  })

/** Download the roadmap structure (no progress) as a JSON file. */
export const exportRoadmap = (r: Roadmap) => {
  const data = {
    app: 'pathway',
    version: 1,
    title: r.title,
    description: r.description,
    emoji: r.emoji,
    color: r.color,
    milestones: r.milestones.map((m) => ({
      title: m.title,
      due: m.due ?? null,
      topics: m.topics.map((t) => ({
        title: t.title,
        notes: t.notes,
        resources: t.resources.map((x) => ({ label: x.label, url: x.url })),
      })),
    })),
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'roadmap'}.pathway.json`
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Turn an exported file back into a roadmap. Throws if the file is not usable. */
export const importRoadmap = (fileText: string, user: Member): Roadmap => {
  let data: Record<string, unknown>
  try {
    data = JSON.parse(fileText)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.milestones) || !text(data.title, 60)) {
    throw new Error('That file is not a Pathway roadmap export.')
  }
  const color = text(data.color, 9)
  return build(user, {
    title: text(data.title, 60),
    description: text(data.description, 140),
    emoji: text(data.emoji, 8) || '🚀',
    color: /^#[0-9a-f]{6}$/i.test(color) ? color : COLORS[0],
    milestones: cleanMilestones(data.milestones),
  })
}
