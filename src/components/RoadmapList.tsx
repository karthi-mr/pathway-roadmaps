import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Plus, Upload } from 'lucide-react'
import { go, useApp } from '../lib/context'
import { store } from '../lib/store'
import { TEMPLATES, buildMilestones } from '../lib/templates'
import { importRoadmap } from '../lib/transfer'
import type { Roadmap } from '../lib/types'
import { COLORS, EMOJIS, allTopics, newId, progressOf } from '../lib/utils'
import { Avatar, Empty, Modal, ProgressRing } from './ui'

export function RoadmapList() {
  const { user, roadmaps, members, run, notify } = useApp()
  const file = useRef<HTMLInputElement>(null)

  const onImport = async (f: File | undefined) => {
    if (!f) return
    try {
      const roadmap = importRoadmap(await f.text(), user)
      run(store.createRoadmap(roadmap))
      notify(`Imported “${roadmap.title}”`)
      go(`/r/${roadmap.id}`)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not read that file.')
    }
  }
  const [creating, setCreating] = useState(() => location.hash.endsWith('?new'))
  const [filter, setFilter] = useState<'all' | 'mine' | 'shared'>('all')

  // "#/roadmaps?new" opens the dialog directly (used by buttons elsewhere).
  useEffect(() => {
    if (location.hash.endsWith('?new')) history.replaceState(null, '', '#/roadmaps')
  }, [])

  const shown = filter === 'all' ? roadmaps : roadmaps.filter((r) => (r.ownerId === user.uid) === (filter === 'mine'))
  const hasShared = roadmaps.some((r) => r.ownerId !== user.uid)

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Roadmaps</h1>
          <p className="muted">Your roadmaps are private until you share them with someone.</p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => file.current?.click()}>
            <Upload size={16} /> Import
          </button>
          <button className="btn primary" onClick={() => setCreating(true)}>
            <Plus size={17} /> New roadmap
          </button>
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              onImport(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
      </header>

      {hasShared && (
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
            All
          </button>
          <button role="tab" aria-selected={filter === 'mine'} className={filter === 'mine' ? 'on' : ''} onClick={() => setFilter('mine')}>
            Mine
          </button>
          <button role="tab" aria-selected={filter === 'shared'} className={filter === 'shared' ? 'on' : ''} onClick={() => setFilter('shared')}>
            Shared with me
          </button>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="card">
          <Empty
            emoji="🧭"
            title="No roadmaps here yet"
            text="Start from a template or build your own from scratch."
            action={
              <button className="btn primary" onClick={() => setCreating(true)}>
                <Plus size={17} /> Create a roadmap
              </button>
            }
          />
        </div>
      ) : (
        <div className="roadmap-grid">
          {shown.map((r) => {
            const own = r.ownerId === user.uid
            // a shared roadmap shows how far its owner has got
            const p = progressOf(r, own ? user.uid : r.ownerId)
            const others = members.filter((m) => m.uid !== user.uid && (m.uid === r.ownerId || (r.sharedWith ?? []).includes(m.uid)))
            return (
              <a key={r.id} className="roadmap-card" href={`#/r/${r.id}`} style={{ '--c': r.color } as CSSProperties}>
                <div className="roadmap-card-top">
                  <span className="emoji-tile lg">{r.emoji}</span>
                  <ProgressRing pct={p.pct} size={54} stroke={5} color={r.color} />
                </div>
                <h3>{r.title}</h3>
                <p className="muted clamp">{r.description || 'No description'}</p>
                {!own ? (
                  <span className="chip share-chip">Shared by {r.ownerName}</span>
                ) : (r.sharedWith ?? []).length > 0 ? (
                  <span className="chip share-chip">Shared with {(r.sharedWith ?? []).length}</span>
                ) : null}
                <div className="roadmap-card-foot">
                  <span className="muted small">
                    {r.milestones.length} milestone{r.milestones.length === 1 ? '' : 's'} · {allTopics(r).length} topics
                  </span>
                  <span className="avatar-stack">
                    {others.slice(0, 3).map((m) => (
                      <Avatar key={m.uid} name={m.name} photo={m.photo} size={22} title={`${m.name} · ${progressOf(r, m.uid).pct}%`} />
                    ))}
                  </span>
                </div>
              </a>
            )
          })}
          <button className="roadmap-card add" onClick={() => setCreating(true)}>
            <Plus size={22} />
            New roadmap
          </button>
        </div>
      )}

      {creating && <NewRoadmap onClose={() => setCreating(false)} />}
    </>
  )
}

function NewRoadmap({ onClose }: { onClose: () => void }) {
  const { user, run } = useApp()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('🚀')
  const [color, setColor] = useState(COLORS[0])
  const [template, setTemplate] = useState('blank')

  const create = () => {
    const t = TEMPLATES.find((x) => x.key === template)!
    const now = Date.now()
    const roadmap: Roadmap = {
      id: newId(),
      title: title.trim(),
      description: description.trim(),
      emoji,
      color,
      ownerId: user.uid,
      ownerName: user.name,
      createdAt: now,
      updatedAt: now,
      milestones: buildMilestones(t),
      sharedWith: [],
      progress: {},
    }
    run(store.createRoadmap(roadmap))
    onClose()
    go(`/r/${roadmap.id}`)
  }

  return (
    <Modal title="New roadmap" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          if (title.trim()) create()
        }}
      >
        <label className="field">
          <span>What do you want to learn?</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. System Design" autoFocus maxLength={60} />
        </label>
        <label className="field">
          <span>
            Goal <em>optional</em>
          </span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Why this, and by when?" maxLength={140} />
        </label>

        <div className="field">
          <span>Start from</span>
          <div className="template-row">
            {TEMPLATES.map((t) => (
              <button type="button" key={t.key} className={`template ${template === t.key ? 'on' : ''}`} aria-pressed={template === t.key} onClick={() => setTemplate(t.key)}>
                <span>{t.emoji}</span>
                {t.name}
                <small>{t.outline.length ? `${t.outline.reduce((n, m) => n + m[1].length, 0)} topics` : 'Empty'}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Icon</span>
          <div className="emoji-grid">
            {EMOJIS.map((e) => (
              <button type="button" key={e} className={emoji === e ? 'on' : ''} aria-pressed={emoji === e} onClick={() => setEmoji(e)}>
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Colour</span>
          <div className="color-row">
            {COLORS.map((c) => (
              <button type="button" key={c} className={color === c ? 'on' : ''} style={{ background: c }} aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} />
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!title.trim()}>
            Create roadmap
          </button>
        </div>
      </form>
    </Modal>
  )
}
