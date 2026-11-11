import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Plus } from 'lucide-react'
import { go, useApp } from '../lib/context'
import { PROJECT_STATUSES } from '../lib/projectMeta'
import { store } from '../lib/store'
import type { Project } from '../lib/types'
import { COLORS, addDays, dayKey, newId, peopleOn, projectHealth, shortDate } from '../lib/utils'
import { Avatar, Empty, Modal, ProgressBar } from './ui'

const PROJECT_EMOJIS = ['📦', '🚀', '🛠️', '🌐', '📱', '🎯', '🧪', '📊', '🎨', '🤖', '🔐', '☁️', '🏗️', '📝', '🎮', '💡']

export function ProjectList() {
  const { user, projects, members } = useApp()
  const [creating, setCreating] = useState(false)

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Projects</h1>
          <p className="muted">Plan a timeline, track issues and see whether the work is keeping up with the schedule.</p>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          <Plus size={17} /> New project
        </button>
      </header>

      {projects.length === 0 ? (
        <div className="card">
          <Empty
            emoji="📦"
            title="No projects yet"
            text="Create a project with a start and end date, break it into phases and log issues as you go."
            action={
              <button className="btn primary" onClick={() => setCreating(true)}>
                <Plus size={17} /> Create a project
              </button>
            }
          />
        </div>
      ) : (
        <div className="roadmap-grid">
          {projects.map((p) => {
            const h = projectHealth(p)
            const people = peopleOn(p, members)
            return (
              <a key={p.id} className="roadmap-card project-card" href={`#/p/${p.id}`} style={{ '--c': p.color } as CSSProperties}>
                <div className="roadmap-card-top">
                  <span className="emoji-tile lg">{p.emoji}</span>
                  <span className={`due-chip ${h.tone}`}>{h.label}</span>
                </div>
                <h3>{p.name}</h3>
                <p className="muted small">
                  {PROJECT_STATUSES[p.status]} · {shortDate(p.start)} – {shortDate(p.end)}
                  {p.ownerId !== user.uid ? ` · by ${p.ownerName}` : ''}
                </p>
                <div className="mini-bars">
                  <div>
                    <span>Schedule</span>
                    <ProgressBar pct={h.timePct} color="var(--muted)" />
                    <span>{h.timePct}%</span>
                  </div>
                  <div>
                    <span>Resolved</span>
                    <ProgressBar pct={h.workPct} color={p.color} />
                    <span>
                      {h.resolved}/{h.total}
                    </span>
                  </div>
                </div>
                <div className="roadmap-card-foot">
                  <span className="muted small">
                    {h.open + h.doing} open{h.overdue ? ` · ${h.overdue} overdue` : ''}
                  </span>
                  <span className="avatar-stack">
                    {people.slice(0, 4).map((m) => (
                      <Avatar key={m.uid} name={m.name} photo={m.photo} size={22} />
                    ))}
                  </span>
                </div>
              </a>
            )
          })}
          <button className="roadmap-card add" onClick={() => setCreating(true)}>
            <Plus size={22} />
            New project
          </button>
        </div>
      )}

      {creating && <NewProject onClose={() => setCreating(false)} />}
    </>
  )
}

function NewProject({ onClose }: { onClose: () => void }) {
  const { user, run } = useApp()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [start, setStart] = useState(dayKey())
  const [end, setEnd] = useState(addDays(dayKey(), 30))
  const [emoji, setEmoji] = useState(PROJECT_EMOJIS[0])
  const [color, setColor] = useState(COLORS[1])
  const valid = name.trim() && start && end && start <= end

  const create = () => {
    const now = Date.now()
    const project: Project = {
      id: newId(),
      name: name.trim(),
      description: description.trim(),
      emoji,
      color,
      ownerId: user.uid,
      ownerName: user.name,
      sharedWith: [],
      status: 'active',
      start,
      end,
      phases: [],
      issues: {},
      createdAt: now,
      updatedAt: now,
    }
    run(store.createProject(project))
    onClose()
    go(`/p/${project.id}`)
  }

  return (
    <Modal title="New project" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) create()
        }}
      >
        <label className="field">
          <span>Project name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Portfolio website" autoFocus maxLength={60} />
        </label>
        <label className="field">
          <span>
            What is it for? <em>optional</em>
          </span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One line about the outcome" maxLength={140} />
        </label>
        <div className="field-pair">
          <label className="field">
            <span>Start date</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
          </label>
          <label className="field">
            <span>End date</span>
            <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />
          </label>
        </div>
        {start && end && start > end && <p className="error">The end date must be on or after the start date.</p>}
        <div className="field">
          <span>Icon</span>
          <div className="emoji-grid">
            {PROJECT_EMOJIS.map((e) => (
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
          <button className="btn primary" disabled={!valid}>
            Create project
          </button>
        </div>
      </form>
    </Modal>
  )
}
