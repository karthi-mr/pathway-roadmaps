import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { AlertTriangle, ArrowLeft, CalendarDays, Check, CircleDot, Loader, MessageCircle, Plus, RotateCcw, Search, Share2, Trash2, X } from 'lucide-react'
import { go, useApp } from '../lib/context'
import { ISSUE_STATUSES, ISSUE_TYPES, PRIORITIES, PROJECT_STATUSES } from '../lib/projectMeta'
import { store } from '../lib/store'
import type { Issue, IssueStatus, IssueType, Member, Phase, Priority, Project, ProjectStatus } from '../lib/types'
import {
  addDays,
  ago,
  dayKey,
  daysBetween,
  daysUntil,
  dueInfo,
  issueOverdue,
  issuesOf,
  newId,
  now,
  parseKey,
  peopleOn,
  projectHealth,
  shortDate,
} from '../lib/utils'
import { ShareDialog } from './ShareDialog'
import { Avatar, EditableText, Empty, Modal, ProgressBar, useEscape } from './ui'

type Tab = 'overview' | 'timeline' | 'issues'
const COLUMNS: IssueStatus[] = ['open', 'doing', 'resolved']

export function ProjectView({ id, initialIssue }: { id: string; initialIssue?: string | null }) {
  const { user, projects, members, run } = useApp()
  const [tab, setTab] = useState<Tab>(initialIssue ? 'issues' : 'overview')
  const [openIssue, setOpenIssue] = useState<string | null>(initialIssue ?? null)
  const [creating, setCreating] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [phase, setPhase] = useState<Phase | 'new' | null>(null)
  const project = projects.find((p) => p.id === id)

  if (!project) {
    return (
      <div className="card">
        <Empty
          emoji="🫥"
          title="Project not found"
          text="It may have been deleted, or it is no longer shared with you."
          action={
            <a className="btn primary" href="#/projects">
              Back to projects
            </a>
          }
        />
      </div>
    )
  }

  const isOwner = project.ownerId === user.uid
  const people = peopleOn(project, members)
  const issues = issuesOf(project)
  const h = projectHealth(project)
  const selected = openIssue ? project.issues[openIssue] : undefined

  const update = (patch: Partial<Project>) => run(store.updateProject(project.id, { ...patch, updatedAt: now() }))

  /** Save an issue, keeping the resolved stamp in step with its status. */
  const saveIssue = (issue: Issue) => {
    const resolved = issue.status === 'resolved'
    run(
      store.saveIssue(project.id, {
        ...issue,
        resolvedAt: resolved ? (issue.resolvedAt ?? now()) : null,
        resolvedBy: resolved ? (issue.resolvedBy ?? user.uid) : null,
      }),
    )
  }

  const remove = () => {
    if (!confirm(`Delete "${project.name}" and its ${issues.length} issue(s) for everyone? This cannot be undone.`)) return
    run(store.deleteProject(project.id))
    go('/projects')
  }

  const openIssueTab = (issueId: string) => {
    setTab('issues')
    setOpenIssue(issueId)
  }

  return (
    <div style={{ '--c': project.color } as CSSProperties}>
      <a className="back" href="#/projects">
        <ArrowLeft size={16} /> Projects
      </a>

      <header className="roadmap-hero project-hero">
        <span className="emoji-tile xl">{project.emoji}</span>
        <div className="roadmap-hero-text">
          <EditableText readOnly={!isOwner} className="h1" label="Project name" value={project.name} onSave={(v) => v && update({ name: v })} />
          <EditableText readOnly={!isOwner} className="desc" label="Description" placeholder="Add a description…" value={project.description} onSave={(v) => update({ description: v })} />
          <div className="project-meta">
            <select value={project.status} disabled={!isOwner} aria-label="Project status" onChange={(e) => update({ status: e.target.value as ProjectStatus })}>
              {Object.entries(PROJECT_STATUSES).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <label>
              <span>Start</span>
              <input
                type="date"
                value={project.start}
                disabled={!isOwner}
                onChange={(e) => e.target.value && update({ start: e.target.value, end: e.target.value > project.end ? e.target.value : project.end })}
              />
            </label>
            <label>
              <span>End</span>
              <input type="date" value={project.end} min={project.start} disabled={!isOwner} onChange={(e) => e.target.value && e.target.value >= project.start && update({ end: e.target.value })} />
            </label>
            <span className={`due-chip ${h.tone}`}>{h.label}</span>
          </div>
          <div className="hero-actions">
            {isOwner && (
              <button className="btn small" onClick={() => setSharing(true)}>
                <Share2 size={14} /> {project.sharedWith.length ? `Shared with ${project.sharedWith.length}` : 'Share'}
              </button>
            )}
            <span className="avatar-stack">
              {people.map((m) => (
                <Avatar key={m.uid} name={m.name} photo={m.photo} size={26} title={m.uid === project.ownerId ? `${m.name} (owner)` : m.name} />
              ))}
            </span>
          </div>
        </div>
        <div className="project-bars">
          <Meter label="Schedule used" value={`${h.timePct}%`} pct={h.timePct} color="var(--muted)" />
          <Meter label="Issues resolved" value={`${h.resolved}/${h.total}`} pct={h.workPct} color={project.color} />
          <span className="tiny">
            {daysUntil(project.end) >= 0 ? `${daysUntil(project.end)} day${daysUntil(project.end) === 1 ? '' : 's'} left` : `${-daysUntil(project.end)}d past the end date`}
          </span>
        </div>
      </header>

      <div className="tabs-row">
        <div className="segmented" role="tablist">
          {(['overview', 'timeline', 'issues'] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {t === 'overview' ? 'Overview' : t === 'timeline' ? 'Timeline' : `Issues · ${issues.length}`}
            </button>
          ))}
        </div>
        <button className="btn primary small" onClick={() => setCreating(true)}>
          <Plus size={15} /> New issue
        </button>
      </div>

      {tab === 'overview' && <Overview project={project} issues={issues} people={people} onOpen={openIssueTab} onTimeline={() => setTab('timeline')} />}
      {tab === 'timeline' && <Timeline project={project} issues={issues} onPhase={setPhase} onOpen={openIssueTab} />}
      {tab === 'issues' && <Board project={project} issues={issues} people={people} onOpen={setOpenIssue} onSave={saveIssue} onNew={() => setCreating(true)} />}

      {isOwner && (
        <button className="btn ghost danger delete-roadmap" onClick={remove}>
          <Trash2 size={16} /> Delete project
        </button>
      )}

      {creating && (
        <NewIssue
          project={project}
          people={people}
          onClose={() => setCreating(false)}
          onCreate={(issue) => {
            saveIssue(issue)
            setTab('issues')
          }}
        />
      )}

      {phase && (
        <PhaseForm
          project={project}
          phase={phase === 'new' ? null : phase}
          onClose={() => setPhase(null)}
          onSave={(next) => update({ phases: next })}
        />
      )}

      {sharing && (
        <ShareDialog
          what="project"
          can="They can create, edit and resolve issues and manage the timeline, but not delete the project or change who it is shared with."
          sharedWith={project.sharedWith}
          onSave={(uids) => update({ sharedWith: uids })}
          onClose={() => setSharing(false)}
        />
      )}

      {selected && (
        <IssueDrawer
          key={selected.id}
          project={project}
          issue={selected}
          people={people}
          canDelete={isOwner || selected.createdBy === user.uid}
          onSave={saveIssue}
          onDelete={() => {
            setOpenIssue(null)
            run(store.deleteIssue(project.id, selected.id))
          }}
          onClose={() => setOpenIssue(null)}
        />
      )}
    </div>
  )
}

function Meter({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div className="meter">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <ProgressBar pct={pct} color={color} />
    </div>
  )
}

/* ---------- Overview ---------- */

function Overview({
  project,
  issues,
  people,
  onOpen,
  onTimeline,
}: {
  project: Project
  issues: Issue[]
  people: Member[]
  onOpen: (id: string) => void
  onTimeline: () => void
}) {
  const h = projectHealth(project)
  const live = issues.filter((i) => i.status !== 'resolved')
  const attention = live
    .filter((i) => i.due && daysUntil(i.due) <= 7)
    .sort((a, b) => a.due!.localeCompare(b.due!))
    .concat(live.filter((i) => !i.due && (i.priority === 'urgent' || i.priority === 'high')))
    .slice(0, 6)
  const load = [...people.map((m) => ({ m, n: live.filter((i) => i.assigneeId === m.uid).length }))]
  const unassigned = live.filter((i) => !i.assigneeId || !people.some((m) => m.uid === i.assigneeId)).length
  const max = Math.max(1, unassigned, ...load.map((x) => x.n))
  const today = dayKey()
  const phases = [...project.phases].filter((p) => !p.done && p.end >= today).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 4)
  const recent = issues
    .filter((i) => i.status === 'resolved' && i.resolvedAt)
    .sort((a, b) => b.resolvedAt! - a.resolvedAt!)
    .slice(0, 4)

  return (
    <>
      <section className="stats">
        <Tile tone="violet" icon={<CircleDot size={20} />} value={h.open} label="Open" />
        <Tile tone="amber" icon={<Loader size={20} />} value={h.doing} label="In progress" />
        <Tile tone="green" icon={<Check size={20} />} value={h.resolved} label="Resolved" />
        <Tile tone="red" icon={<AlertTriangle size={20} />} value={h.overdue} label="Overdue" />
      </section>

      <div className="dash-grid">
        <div className="col">
          <section className="card">
            <div className="card-head">
              <h2>Needs attention</h2>
              <span className="muted small">Due within a week, overdue or high priority</span>
            </div>
            {attention.length === 0 ? (
              <p className="muted small">{issues.length ? 'Nothing urgent right now.' : 'No issues yet — add the first one with “New issue”.'}</p>
            ) : (
              <div className="rows">
                {attention.map((i) => (
                  <button key={i.id} className="row" onClick={() => onOpen(i.id)}>
                    <span className="issue-type">{ISSUE_TYPES[i.type].icon}</span>
                    <span className="row-text">
                      <strong>{i.title}</strong>
                      <span className="muted">
                        #{i.num} · {PRIORITIES[i.priority]} · {people.find((m) => m.uid === i.assigneeId)?.name ?? 'Unassigned'}
                      </span>
                    </span>
                    {i.due ? <span className={`due-chip ${dueInfo(i.due, false).tone}`}>{dueInfo(i.due, false).label}</span> : <span className={`prio prio-${i.priority}`}>{PRIORITIES[i.priority]}</span>}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Recently resolved</h2>
            </div>
            {recent.length === 0 ? (
              <p className="muted small">Resolved issues show up here.</p>
            ) : (
              <div className="rows">
                {recent.map((i) => (
                  <button key={i.id} className="row" onClick={() => onOpen(i.id)}>
                    <span className="issue-type">{ISSUE_TYPES[i.type].icon}</span>
                    <span className="row-text">
                      <strong>{i.title}</strong>
                      <span className="muted">
                        #{i.num} · resolved {ago(i.resolvedAt!)} by {people.find((m) => m.uid === i.resolvedBy)?.name.split(' ')[0] ?? 'someone'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="col">
          <section className="card">
            <div className="card-head">
              <h2>Workload</h2>
              <span className="muted small">Unresolved issues</span>
            </div>
            <div className="goal-rows">
              {load.map(({ m, n }) => (
                <div key={m.uid} className="load-row">
                  <Avatar name={m.name} photo={m.photo} size={28} />
                  <div>
                    <div className="goal-line">
                      <span>{m.name}</span>
                      <strong>{n}</strong>
                    </div>
                    <ProgressBar pct={(n / max) * 100} color={project.color} />
                  </div>
                </div>
              ))}
              {unassigned > 0 && (
                <div className="load-row">
                  <span className="avatar unassigned">?</span>
                  <div>
                    <div className="goal-line">
                      <span>Unassigned</span>
                      <strong>{unassigned}</strong>
                    </div>
                    <ProgressBar pct={(unassigned / max) * 100} color="var(--muted)" />
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Up next on the timeline</h2>
              <button className="link" onClick={onTimeline}>
                Timeline
              </button>
            </div>
            {phases.length === 0 ? (
              <p className="muted small">No upcoming phases. Add phases on the Timeline tab to plan the work.</p>
            ) : (
              <div className="rows">
                {phases.map((p) => (
                  <div key={p.id} className="row">
                    <span className="phase-dot" />
                    <span className="row-text">
                      <strong>{p.title}</strong>
                      <span className="muted">
                        {shortDate(p.start)} – {shortDate(p.end)}
                      </span>
                    </span>
                    <span className={`due-chip ${p.start <= today ? 'soon' : 'none'}`}>{p.start <= today ? 'in progress' : `starts in ${daysUntil(p.start)}d`}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  )
}

function Tile({ icon, tone, value, label }: { icon: ReactNode; tone: string; value: number; label: string }) {
  return (
    <div className={`stat tone-${tone}`}>
      <span className="stat-icon">{icon}</span>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  )
}

/* ---------- Timeline (Gantt) ---------- */

function Timeline({
  project,
  issues,
  onPhase,
  onOpen,
}: {
  project: Project
  issues: Issue[]
  onPhase: (p: Phase | 'new') => void
  onOpen: (id: string) => void
}) {
  const phases = [...project.phases].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
  const dated = issues.filter((i) => i.due)
  const today = dayKey()
  // The chart covers the project dates plus anything that falls outside them.
  const from = [project.start, ...phases.map((p) => p.start), ...dated.map((i) => i.due!)].sort()[0]
  const to = [project.end, ...phases.map((p) => p.end), ...dated.map((i) => i.due!)].sort().at(-1)!
  const days = daysBetween(from, to) + 1
  const left = (key: string) => (daysBetween(from, key) / days) * 100
  const width = (a: string, b: string) => ((daysBetween(a, b) + 1) / days) * 100

  const months: { label: string; left: number; width: number }[] = []
  let cursor = from
  while (cursor <= to) {
    const d = parseKey(cursor)
    const last = dayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0))
    const end = last < to ? last : to
    months.push({ label: d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), left: left(cursor), width: width(cursor, end) })
    cursor = addDays(end, 1)
  }

  const track = { '--day': `${100 / days}%` } as CSSProperties
  const showToday = today >= from && today <= to

  return (
    <section className="card">
      <div className="card-head">
        <h2>Timeline</h2>
        <button className="btn small" onClick={() => onPhase('new')}>
          <Plus size={15} /> Add phase
        </button>
      </div>

      <div className="gantt-scroll">
        <div className="gantt" style={{ minWidth: `max(100%, ${180 + days * 12}px)` }}>
          <div className="gantt-row gantt-head">
            <div className="gantt-label">
              {shortDate(from)} – {shortDate(to)}
            </div>
            <div className="gantt-track">
              {months.map((m) => (
                <span key={m.left} className="gantt-month" style={{ left: `${m.left}%`, width: `${m.width}%` }}>
                  {m.label}
                </span>
              ))}
            </div>
          </div>

          <div className="gantt-body">
            <div className="gantt-row">
              <div className="gantt-label">
                <strong>Whole project</strong>
              </div>
              <div className="gantt-track" style={track}>
                <span className="gantt-bar whole" style={{ left: `${left(project.start)}%`, width: `${width(project.start, project.end)}%` }}>
                  {shortDate(project.start)} – {shortDate(project.end)}
                </span>
              </div>
            </div>

            {phases.map((p) => (
              <div key={p.id} className="gantt-row">
                <div className="gantt-label">
                  <strong>{p.title}</strong>
                  <span>
                    {shortDate(p.start)} – {shortDate(p.end)}
                  </span>
                </div>
                <div className="gantt-track" style={track}>
                  <button
                    className={`gantt-bar ${p.done ? 'done' : p.end < today ? 'late' : ''}`}
                    style={{ left: `${left(p.start)}%`, width: `${width(p.start, p.end)}%` }}
                    title={`${p.title}: ${shortDate(p.start)} – ${shortDate(p.end)}${p.done ? ' (done)' : p.end < today ? ' (past its end date)' : ''}. Click to edit.`}
                    onClick={() => onPhase(p)}
                  >
                    {p.done && <Check size={13} strokeWidth={3} />}
                    <span>{p.title}</span>
                  </button>
                </div>
              </div>
            ))}

            {dated.length > 0 && (
              <div className="gantt-row">
                <div className="gantt-label">
                  <strong>Issue due dates</strong>
                  <span>{dated.length} with a date</span>
                </div>
                <div className="gantt-track" style={track}>
                  {dated.map((i) => (
                    <button
                      key={i.id}
                      className={`gantt-dot ${i.status === 'resolved' ? 'done' : issueOverdue(i) ? 'late' : ''}`}
                      style={{ left: `calc(${left(i.due!)}% + var(--day) / 2)` }}
                      title={`#${i.num} ${i.title} — due ${shortDate(i.due!)}`}
                      aria-label={`#${i.num} ${i.title}, due ${shortDate(i.due!)}`}
                      onClick={() => onOpen(i.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {showToday && (
              <div className="gantt-today" style={{ left: `calc(180px + (100% - 180px) * ${(daysBetween(from, today) + 0.5) / days})` }}>
                <span>Today</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {phases.length === 0 && <p className="muted small hint">Break the project into phases (for example Design, Build, Test) to see them as bars here.</p>}
    </section>
  )
}

function PhaseForm({
  project,
  phase,
  onSave,
  onClose,
}: {
  project: Project
  phase: Phase | null
  onSave: (phases: Phase[]) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(phase?.title ?? '')
  const [start, setStart] = useState(phase?.start ?? (project.start > dayKey() ? project.start : dayKey()))
  const [end, setEnd] = useState(phase?.end ?? addDays(project.start > dayKey() ? project.start : dayKey(), 6))
  const [done, setDone] = useState(phase?.done ?? false)
  const valid = title.trim() && start && end && start <= end

  const save = () => {
    const next: Phase = { id: phase?.id ?? newId(), title: title.trim(), start, end, done }
    onSave(phase ? project.phases.map((p) => (p.id === phase.id ? next : p)) : [...project.phases, next])
    onClose()
  }

  return (
    <Modal title={phase ? 'Edit phase' : 'New phase'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) save()
        }}
      >
        <label className="field">
          <span>Phase name</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Design" autoFocus maxLength={60} />
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
        <label className="check">
          <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} />
          This phase is finished
        </label>
        <div className="form-actions">
          {phase && (
            <button
              type="button"
              className="btn ghost danger"
              onClick={() => {
                onSave(project.phases.filter((p) => p.id !== phase.id))
                onClose()
              }}
            >
              <Trash2 size={15} /> Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!valid}>
            {phase ? 'Save' : 'Add phase'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Issue board ---------- */

function Board({
  project,
  issues,
  people,
  onOpen,
  onSave,
  onNew,
}: {
  project: Project
  issues: Issue[]
  people: Member[]
  onOpen: (id: string) => void
  onSave: (issue: Issue) => void
  onNew: () => void
}) {
  const { user } = useApp()
  const [q, setQ] = useState('')
  const [who, setWho] = useState('')
  const [priority, setPriority] = useState('')
  const [type, setType] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  const s = q.trim().toLowerCase()
  const shown = issues.filter(
    (i) =>
      (!s || i.title.toLowerCase().includes(s) || i.description.toLowerCase().includes(s) || `#${i.num}` === s) &&
      (!who || (who === 'none' ? !i.assigneeId : i.assigneeId === who)) &&
      (!priority || i.priority === priority) &&
      (!type || i.type === type),
  )
  const filtered = shown.length !== issues.length
  const dragged = dragId ? project.issues[dragId] : undefined

  if (issues.length === 0) {
    return (
      <div className="card">
        <Empty
          emoji="🗂️"
          title="No issues yet"
          text="An issue is anything that needs doing or fixing: a task, a bug or a feature."
          action={
            <button className="btn primary" onClick={onNew}>
              <Plus size={17} /> Create the first issue
            </button>
          }
        />
      </div>
    )
  }

  return (
    <>
      <div className="board-filters">
        <label className="filter-search">
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter issues" aria-label="Filter issues" />
        </label>
        <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Assignee">
          <option value="">Anyone</option>
          <option value={user.uid}>Assigned to me</option>
          {people
            .filter((m) => m.uid !== user.uid)
            .map((m) => (
              <option key={m.uid} value={m.uid}>
                {m.name}
              </option>
            ))}
          <option value="none">Unassigned</option>
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority">
          <option value="">Any priority</option>
          {Object.entries(PRIORITIES).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          <option value="">Any type</option>
          {Object.entries(ISSUE_TYPES).map(([k, t]) => (
            <option key={k} value={k}>
              {t.icon} {t.label}
            </option>
          ))}
        </select>
        {filtered && (
          <span className="muted small">
            {shown.length} of {issues.length}
          </span>
        )}
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={({ active }) => setDragId(String(active.id))}
        onDragCancel={() => setDragId(null)}
        onDragEnd={({ active, over }) => {
          setDragId(null)
          const issue = project.issues[String(active.id)]
          const status = over?.id as IssueStatus | undefined
          if (issue && status && COLUMNS.includes(status) && issue.status !== status) onSave({ ...issue, status })
        }}
      >
        <div className="board">
          {COLUMNS.map((status) => (
            <Column key={status} status={status} count={shown.filter((i) => i.status === status).length}>
              {shown
                .filter((i) => i.status === status)
                .map((i) => (
                  <DraggableIssue key={i.id} issue={i} people={people} onOpen={() => onOpen(i.id)} onResolve={() => onSave({ ...i, status: 'resolved' })} />
                ))}
            </Column>
          ))}
        </div>
        <DragOverlay dropAnimation={null}>{dragged && <IssueCard issue={dragged} people={people} floating />}</DragOverlay>
      </DndContext>
    </>
  )
}

function Column({ status, count, children }: { status: IssueStatus; count: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section ref={setNodeRef} className={`board-col col-${status} ${isOver ? 'over' : ''}`} aria-label={ISSUE_STATUSES[status]}>
      <header>
        <span className="col-dot" />
        <h3>{ISSUE_STATUSES[status]}</h3>
        <span className="count">{count}</span>
      </header>
      <div className="board-cards">
        {children}
        {count === 0 && <p className="board-empty">{status === 'resolved' ? 'Drop an issue here to resolve it' : 'Nothing here'}</p>}
      </div>
    </section>
  )
}

function DraggableIssue(props: { issue: Issue; people: Member[]; onOpen: () => void; onResolve: () => void }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: props.issue.id })
  return (
    <div ref={setNodeRef} className={isDragging ? 'ghosted' : ''} {...attributes} {...listeners} aria-label={`Issue ${props.issue.num}: ${props.issue.title}`}>
      <IssueCard {...props} />
    </div>
  )
}

function IssueCard({
  issue: i,
  people,
  floating,
  onOpen,
  onResolve,
}: {
  issue: Issue
  people: Member[]
  floating?: boolean
  onOpen?: () => void
  onResolve?: () => void
}) {
  const assignee = people.find((m) => m.uid === i.assigneeId)
  const due = i.due ? dueInfo(i.due, i.status === 'resolved') : null
  return (
    <article className={`issue-card ${floating ? 'floating' : ''} ${i.status === 'resolved' ? 'is-resolved' : ''}`}>
      <div className="issue-top">
        <span className="issue-key">
          {ISSUE_TYPES[i.type].icon} #{i.num}
        </span>
        <span className={`prio prio-${i.priority}`}>{PRIORITIES[i.priority]}</span>
      </div>
      <button className="issue-title" onClick={onOpen}>
        {i.title}
      </button>
      <div className="issue-foot">
        {due && i.due && (
          <span className={`due-chip ${due.tone}`}>
            <CalendarDays size={12} /> {i.status === 'resolved' ? shortDate(i.due) : due.label}
          </span>
        )}
        {i.notes.length > 0 && (
          <span className="hint-icon">
            <MessageCircle size={13} /> {i.notes.length}
          </span>
        )}
        <span className="spacer" />
        {i.status !== 'resolved' && onResolve && (
          <button className="icon-btn sm ok" title="Mark resolved" aria-label="Mark resolved" onClick={onResolve}>
            <Check size={15} />
          </button>
        )}
        {assignee ? <Avatar name={assignee.name} photo={assignee.photo} size={24} title={`Assigned to ${assignee.name}`} /> : <span className="avatar unassigned sm" title="Unassigned">?</span>}
      </div>
    </article>
  )
}

/* ---------- Issue forms ---------- */

function IssueSelects({
  issue,
  people,
  onChange,
}: {
  issue: Pick<Issue, 'type' | 'priority' | 'assigneeId' | 'due'>
  people: Member[]
  onChange: (patch: Partial<Issue>) => void
}) {
  return (
    <div className="field-grid">
      <label className="field">
        <span>Type</span>
        <select value={issue.type} onChange={(e) => onChange({ type: e.target.value as IssueType })}>
          {Object.entries(ISSUE_TYPES).map(([k, t]) => (
            <option key={k} value={k}>
              {t.icon} {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Priority</span>
        <select value={issue.priority} onChange={(e) => onChange({ priority: e.target.value as Priority })}>
          {Object.entries(PRIORITIES).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Assignee</span>
        <select value={issue.assigneeId ?? ''} onChange={(e) => onChange({ assigneeId: e.target.value || null })}>
          <option value="">Unassigned</option>
          {people.map((m) => (
            <option key={m.uid} value={m.uid}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Due date</span>
        <input type="date" value={issue.due ?? ''} onChange={(e) => onChange({ due: e.target.value || null })} />
      </label>
    </div>
  )
}

function NewIssue({
  project,
  people,
  onCreate,
  onClose,
}: {
  project: Project
  people: Member[]
  onCreate: (issue: Issue) => void
  onClose: () => void
}) {
  const { user } = useApp()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [fields, setFields] = useState<Pick<Issue, 'type' | 'priority' | 'assigneeId' | 'due'>>({
    type: 'task',
    priority: 'medium',
    assigneeId: user.uid,
    due: null,
  })

  const create = () => {
    const num = Math.max(0, ...Object.values(project.issues).map((i) => i.num)) + 1
    onCreate({
      id: newId(),
      num,
      title: title.trim(),
      description: description.trim(),
      ...fields,
      status: 'open',
      createdBy: user.uid,
      createdByName: user.name,
      createdAt: now(),
      resolvedAt: null,
      resolvedBy: null,
      notes: [],
    })
    onClose()
  }

  return (
    <Modal title="New issue" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          if (title.trim()) create()
        }}
      >
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing or fixing?" autoFocus maxLength={140} />
        </label>
        <label className="field">
          <span>
            Details <em>optional</em>
          </span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Steps, context, what done looks like…" />
        </label>
        <IssueSelects issue={fields} people={people} onChange={(patch) => setFields((f) => ({ ...f, ...patch }))} />
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!title.trim()}>
            Create issue
          </button>
        </div>
      </form>
    </Modal>
  )
}

function IssueDrawer({
  project,
  issue,
  people,
  canDelete,
  onSave,
  onDelete,
  onClose,
}: {
  project: Project
  issue: Issue
  people: Member[]
  canDelete: boolean
  onSave: (issue: Issue) => void
  onDelete: () => void
  onClose: () => void
}) {
  const { user } = useApp()
  const [title, setTitle] = useState(issue.title)
  const [description, setDescription] = useState(issue.description)
  const [note, setNote] = useState('')

  /** Text typed but not yet saved travels with every other change. */
  const draft = (): Issue => ({ ...issue, title: title.trim() || issue.title, description })
  const saveText = () => {
    const next = draft()
    if (next.title !== issue.title || next.description !== issue.description) onSave(next)
  }
  const close = () => {
    saveText()
    onClose()
  }
  useEscape(close)

  const addNote = () => {
    const text = note.trim()
    if (!text) return
    onSave({
      ...draft(),
      notes: [...issue.notes, { id: newId(), userId: user.uid, userName: user.name, userPhoto: user.photo, text, createdAt: now() }],
    })
    setNote('')
  }

  const resolved = issue.status === 'resolved'
  const resolver = people.find((m) => m.uid === issue.resolvedBy)

  return (
    <div className="overlay drawer-overlay" onMouseDown={close}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Issue ${issue.num}`} style={{ '--c': project.color } as CSSProperties} onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <span className="tiny">
            {project.emoji} {project.name} · #{issue.num}
          </span>
          <button className="icon-btn" onClick={close} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <input className="issue-title-input" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveText} aria-label="Issue title" maxLength={140} />

        <div className="segmented status-seg">
          {COLUMNS.map((s) => (
            <button key={s} className={issue.status === s ? `on ${s === 'resolved' ? 'done' : s === 'doing' ? 'doing' : ''}` : ''} aria-pressed={issue.status === s} onClick={() => onSave({ ...draft(), status: s })}>
              {ISSUE_STATUSES[s]}
            </button>
          ))}
        </div>

        {resolved ? (
          <div className="resolved-banner">
            <Check size={16} />
            <span>
              Resolved {issue.resolvedAt ? ago(issue.resolvedAt) : ''}
              {resolver ? ` by ${resolver.uid === user.uid ? 'you' : resolver.name}` : ''}
            </span>
            <button className="btn small" onClick={() => onSave({ ...draft(), status: 'open' })}>
              <RotateCcw size={14} /> Reopen
            </button>
          </div>
        ) : (
          <button className="btn primary" onClick={() => onSave({ ...draft(), status: 'resolved' })}>
            <Check size={16} /> Resolve issue
          </button>
        )}

        <label className="field">
          <span>Details</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} onBlur={saveText} rows={5} placeholder="Steps, context, what done looks like…" />
        </label>

        <IssueSelects issue={issue} people={people} onChange={(patch) => onSave({ ...draft(), ...patch })} />

        <div className="field">
          <span>
            Activity {issue.notes.length > 0 && <em>{issue.notes.length}</em>}
          </span>
          {issue.notes.map((n) => (
            <div key={n.id} className="comment">
              <Avatar name={n.userName} photo={n.userPhoto} size={28} />
              <div className="comment-body">
                <div className="comment-meta">
                  <strong>{n.userId === user.uid ? 'You' : n.userName}</strong>
                  <span className="tiny">{ago(n.createdAt)}</span>
                  {n.userId === user.uid && (
                    <button className="icon-btn sm danger" aria-label="Delete note" title="Delete note" onClick={() => onSave({ ...draft(), notes: issue.notes.filter((x) => x.id !== n.id) })}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <p>{n.text}</p>
              </div>
            </div>
          ))}
          <form
            className="comment-add"
            onSubmit={(e) => {
              e.preventDefault()
              addNote()
            }}
          >
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an update or how it was fixed" aria-label="Add a note" maxLength={1000} />
            <button className="btn small" disabled={!note.trim()}>
              Add
            </button>
          </form>
        </div>

        <div className="drawer-foot">
          <span className="tiny">
            Created by {issue.createdBy === user.uid ? 'you' : issue.createdByName} · {ago(issue.createdAt)}
          </span>
          <span className="spacer" />
          {canDelete && (
            <button className="btn ghost small danger" onClick={() => confirm(`Delete issue #${issue.num}?`) && onDelete()}>
              <Trash2 size={15} /> Delete
            </button>
          )}
        </div>
      </aside>
    </div>
  )
}
