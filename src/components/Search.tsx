import { useMemo, useState } from 'react'
import { Search as SearchIcon } from 'lucide-react'
import { go, useApp } from '../lib/context'
import { prettyDay } from '../lib/utils'
import { useEscape } from './ui'

interface Result {
  key: string
  kind: 'Roadmap' | 'Milestone' | 'Topic' | 'Note' | 'Journal' | 'Comment' | 'Project' | 'Issue'
  icon: string
  title: string
  sub: string
  href: string
}

/** A short excerpt around the first match. */
const snippet = (text: string, q: string) => {
  const flat = text.replace(/\s+/g, ' ')
  const i = flat.toLowerCase().indexOf(q)
  const start = Math.max(0, i - 30)
  return (start > 0 ? '…' : '') + flat.slice(start, start + 90) + (flat.length > start + 90 ? '…' : '')
}

export function Search({ onClose }: { onClose: () => void }) {
  const { roadmaps, projects, logs, comments } = useApp()
  const [q, setQ] = useState('')
  const [index, setIndex] = useState(0)
  useEscape(onClose)

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    const has = (v: string | undefined | null) => !!v && v.toLowerCase().includes(s)
    const out: Result[] = []
    const topicNames = new Map<string, string>()

    for (const r of roadmaps) {
      if (has(r.title) || has(r.description)) {
        out.push({ key: `r${r.id}`, kind: 'Roadmap', icon: r.emoji, title: r.title, sub: r.description || 'Roadmap', href: `/r/${r.id}` })
      }
      for (const m of r.milestones) {
        if (has(m.title)) out.push({ key: `m${m.id}`, kind: 'Milestone', icon: r.emoji, title: m.title, sub: r.title, href: `/r/${r.id}` })
        for (const t of m.topics) {
          topicNames.set(t.id, t.title)
          const href = `/r/${r.id}?t=${t.id}`
          if (has(t.title) || t.resources.some((x) => has(x.label) || has(x.url))) {
            out.push({ key: `t${t.id}`, kind: 'Topic', icon: r.emoji, title: t.title, sub: `${r.title} › ${m.title}`, href })
          } else if (has(t.notes)) {
            out.push({ key: `n${t.id}`, kind: 'Note', icon: '📝', title: snippet(t.notes, s), sub: `Notes on ${t.title}`, href })
          }
        }
      }
    }
    for (const p of projects) {
      if (has(p.name) || has(p.description)) {
        out.push({ key: `p${p.id}`, kind: 'Project', icon: p.emoji, title: p.name, sub: p.description || 'Project', href: `/p/${p.id}` })
      }
      for (const i of Object.values(p.issues)) {
        if (has(i.title) || has(i.description) || `#${i.num}` === s || i.notes.some((n) => has(n.text))) {
          out.push({ key: `i${i.id}`, kind: 'Issue', icon: '🗂️', title: i.title, sub: `${p.name} · #${i.num}`, href: `/p/${p.id}?i=${i.id}` })
        }
      }
    }
    for (const c of comments) {
      if (has(c.text)) {
        out.push({
          key: `c${c.id}`,
          kind: 'Comment',
          icon: '💬',
          title: snippet(c.text, s),
          sub: `${c.userName} on ${topicNames.get(c.topicId) ?? 'a topic'}`,
          href: `/r/${c.roadmapId}?t=${c.topicId}`,
        })
      }
    }
    for (const l of logs) {
      if (has(l.text)) {
        out.push({ key: `l${l.id}`, kind: 'Journal', icon: '📓', title: snippet(l.text, s), sub: `${l.userName} · ${prettyDay(l.date)}`, href: '/journal' })
      }
    }
    return out.slice(0, 40)
  }, [q, roadmaps, projects, logs, comments])

  const active = Math.min(index, Math.max(0, results.length - 1))

  const open = (r: Result) => {
    onClose()
    go(r.href)
  }

  return (
    <div className="overlay palette-overlay" onMouseDown={onClose}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search" onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <SearchIcon size={18} />
          <input
            autoFocus
            value={q}
            placeholder="Search topics, notes, issues, journal and comments"
            aria-label="Search"
            onChange={(e) => {
              setQ(e.target.value)
              setIndex(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIndex(Math.min(active + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIndex(Math.max(active - 1, 0))
              } else if (e.key === 'Enter' && results[active]) {
                open(results[active])
              }
            }}
          />
          <kbd>Esc</kbd>
        </div>

        {q.trim() === '' ? (
          <p className="palette-hint">Type to search everything your group has written.</p>
        ) : results.length === 0 ? (
          <p className="palette-hint">Nothing matches “{q.trim()}”.</p>
        ) : (
          <div className="palette-results" role="listbox">
            {results.map((r, i) => (
              <button
                key={r.key}
                role="option"
                aria-selected={i === active}
                className={`result ${i === active ? 'on' : ''}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => open(r)}
                ref={i === active ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
              >
                <span className="result-icon">{r.icon}</span>
                <span className="result-text">
                  <strong>{r.title}</strong>
                  <span>{r.sub}</span>
                </span>
                <span className="chip">{r.kind}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
