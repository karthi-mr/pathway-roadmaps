import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ArrowRight, CalendarClock, CheckCircle, Clock, Flame, ListChecks, Plus, RotateCcw, Target, Users } from 'lucide-react'
import { ISSUE_TYPES, PRIORITIES } from '../lib/projectMeta'
import { go, useApp } from '../lib/context'
import { store } from '../lib/store'
import {
  REVIEW_STEPS,
  activityByDay,
  ago,
  dayKey,
  deadlinesOf,
  dueInfo,
  dueReviews,
  formatMinutes,
  greeting,
  issueOverdue,
  issuesOf,
  learningRoadmaps,
  nextTopic,
  now,
  prettyDay,
  progressOf,
  shortDate,
  statusOf,
  streakOf,
  weekStats,
} from '../lib/utils'
import { Avatar, Empty, Modal, ProgressBar, StatusButton } from './ui'

const WEEKS = 18

export function Dashboard() {
  const { user, roadmaps: visible, logs, members, run } = useApp()
  // Shared roadmaps count as "mine" only once I have started working through them.
  const roadmaps = useMemo(() => learningRoadmaps(visible, user.uid), [visible, user.uid])

  const activity = useMemo(() => activityByDay(roadmaps, logs, user.uid), [roadmaps, logs, user.uid])
  const streak = streakOf(activity)
  const totals = roadmaps.reduce(
    (acc, r) => {
      const p = progressOf(r, user.uid)
      return { done: acc.done + p.done, doing: acc.doing + p.doing, total: acc.total + p.total }
    },
    { done: 0, doing: 0, total: 0 },
  )
  const minutes = logs.filter((l) => l.userId === user.uid).reduce((n, l) => n + (l.minutes || 0), 0)

  const active = roadmaps
    .map((r) => ({ r, p: progressOf(r, user.uid), next: nextTopic(r, user.uid) }))
    .filter((x) => x.next)
    .sort((a, b) => b.p.doing - a.p.doing || b.p.done - a.p.done)
    .slice(0, 3)

  const team = members
    .map((m) => {
      const act = activityByDay(roadmaps, logs, m.uid)
      const done = roadmaps.reduce((n, r) => n + progressOf(r, m.uid).done, 0)
      return { m, done, streak: streakOf(act) }
    })
    .sort((a, b) => b.done - a.done)

  const firstName = user.name.split(' ')[0]

  return (
    <>
      <header className="page-head">
        <div>
          <h1>
            {greeting()}, {firstName} <span className="wave">👋</span>
          </h1>
          <p className="muted">
            {totals.total === 0
              ? 'Create your first roadmap to get going.'
              : totals.doing > 0
                ? `You have ${totals.doing} topic${totals.doing === 1 ? '' : 's'} in progress. Keep it moving.`
                : totals.done === totals.total
                  ? 'Everything is done — time for a new roadmap?'
                  : 'Pick a topic below and start your next session.'}
          </p>
        </div>
        <button className="btn primary" onClick={() => go('/roadmaps?new')}>
          <Plus size={17} /> New roadmap
        </button>
      </header>

      <section className="stats">
        <Stat icon={<Flame size={20} />} tone="amber" value={streak} unit={streak === 1 ? 'day' : 'days'} label="Current streak" />
        <Stat icon={<CheckCircle size={20} />} tone="green" value={totals.done} unit={`/ ${totals.total}`} label="Topics completed" />
        <Stat icon={<Target size={20} />} tone="violet" value={totals.doing} label="In progress" />
        <Stat icon={<Clock size={20} />} tone="cyan" value={formatMinutes(minutes)} label="Time logged" />
      </section>

      <div className="dash-grid">
        <div className="col">
          <section className="card">
            <div className="card-head">
              <h2>Continue learning</h2>
              <a className="link" href="#/roadmaps">
                All roadmaps <ArrowRight size={15} />
              </a>
            </div>
            {active.length === 0 ? (
              <Empty
                emoji="🗺️"
                title={roadmaps.length ? 'All caught up' : 'No roadmaps yet'}
                text={roadmaps.length ? 'Every topic is complete. Add more or start something new.' : 'A roadmap breaks a skill into milestones and topics you can tick off.'}
                action={
                  <button className="btn primary" onClick={() => go('/roadmaps?new')}>
                    <Plus size={17} /> Create a roadmap
                  </button>
                }
              />
            ) : (
              <div className="continue-list">
                {active.map(({ r, p, next }) => (
                  <div key={r.id} className="continue" style={{ '--c': r.color } as CSSProperties}>
                    <a className="continue-main" href={`#/r/${r.id}`}>
                      <span className="emoji-tile">{r.emoji}</span>
                      <div className="continue-text">
                        <strong>{r.title}</strong>
                        <span className="muted">
                          {p.done} of {p.total} topics · {p.pct}%
                        </span>
                        <ProgressBar pct={p.pct} color={r.color} />
                      </div>
                    </a>
                    <div className="next-up">
                      <StatusButton
                        status={statusOf(r, user.uid, next!.topic.id)}
                        color={r.color}
                        onClick={() => {
                          const cur = statusOf(r, user.uid, next!.topic.id)
                          run(store.setProgress(r.id, user.uid, next!.topic.id, cur === 'todo' ? 'doing' : 'done'))
                        }}
                      />
                      <a href={`#/r/${r.id}?t=${next!.topic.id}`}>
                        <span className="tiny">Next up · {next!.milestone.title}</span>
                        <strong>{next!.topic.title}</strong>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <SharedWithMe />
          <Reviews />

          <section className="card">
            <div className="card-head">
              <h2>Activity</h2>
              <span className="muted small">Last {WEEKS} weeks</span>
            </div>
            <Heatmap activity={activity} />
          </section>
        </div>

        <div className="col">
          <WeeklyGoal />
          <MyIssues />
          <Deadlines />

          <section className="card">
            <div className="card-head">
              <h2>Your group</h2>
            </div>
            <div className="team">
              {team.map(({ m, done, streak: s }, i) => (
                <div key={m.uid} className="team-row">
                  <span className="rank">{i + 1}</span>
                  <Avatar name={m.name} photo={m.photo} size={36} />
                  <div className="team-text">
                    <strong>
                      {m.name}
                      {m.uid === user.uid && <span className="you">you</span>}
                    </strong>
                    <span className="muted">
                      {done} topic{done === 1 ? '' : 's'} done
                    </span>
                  </div>
                  <span className={`streak-chip ${s ? 'on' : ''}`} title="Current streak">
                    <Flame size={14} /> {s}
                  </span>
                </div>
              ))}
            </div>
            {members.length < 2 && (
              <p className="muted small hint">
                {store.mode === 'local'
                  ? 'Once Firebase is connected, the people you invite appear here.'
                  : 'Teammates appear here after their first sign-in.'}
              </p>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Latest notes</h2>
              <a className="link" href="#/journal">
                Journal <ArrowRight size={15} />
              </a>
            </div>
            {logs.length === 0 ? (
              <p className="muted small">Nothing logged yet. Write down what you learn after each session.</p>
            ) : (
              <div className="mini-feed">
                {logs.slice(0, 4).map((l) => (
                  <div key={l.id} className="mini-entry">
                    <Avatar name={l.userName} photo={l.userPhoto} size={26} />
                    <div>
                      <p>{l.text}</p>
                      <span className="tiny">
                        {l.userName.split(' ')[0]} · {prettyDay(l.date)}
                        {l.minutes ? ` · ${formatMinutes(l.minutes)}` : ''}
                      </span>
                    </div>
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

/** Study time and topics finished since Monday, measured against the person's own targets. */
function WeeklyGoal() {
  const { user, roadmaps, logs, run } = useApp()
  const [editing, setEditing] = useState(false)
  const week = weekStats(roadmaps, logs, user.uid)
  const goalMinutes = user.goalMinutes ?? 0
  const goalTopics = user.goalTopics ?? 0
  const hasGoal = goalMinutes > 0 || goalTopics > 0
  const [hours, setHours] = useState('')
  const [topics, setTopics] = useState('')

  const open = () => {
    setHours(goalMinutes ? String(goalMinutes / 60) : '')
    setTopics(goalTopics ? String(goalTopics) : '')
    setEditing(true)
  }

  const save = () => {
    const h = Math.min(100, Math.max(0, Number(hours) || 0))
    const t = Math.min(200, Math.max(0, Math.round(Number(topics) || 0)))
    run(store.updateMember(user.uid, { goalMinutes: Math.round(h * 60), goalTopics: t }))
    setEditing(false)
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>This week</h2>
        <button className="link" onClick={open}>
          {hasGoal ? 'Edit goal' : 'Set a goal'}
        </button>
      </div>
      <div className="goal-rows">
        <GoalRow label="Study time" value={formatMinutes(week.minutes)} target={goalMinutes ? formatMinutes(goalMinutes) : null} pct={goalMinutes ? (week.minutes / goalMinutes) * 100 : 0} />
        <GoalRow label="Topics finished" value={String(week.topics)} target={goalTopics ? String(goalTopics) : null} pct={goalTopics ? (week.topics / goalTopics) * 100 : 0} />
      </div>
      {!hasGoal && <p className="muted small hint">Set a weekly target to see how you are tracking against it.</p>}

      {editing && (
        <Modal title="Weekly goal" onClose={() => setEditing(false)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault()
              save()
            }}
          >
            <p className="muted">The week runs Monday to Sunday. Leave a field empty to skip that target.</p>
            <label className="field">
              <span>Study time (hours per week)</span>
              <input type="number" min="0" max="100" step="0.5" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. 5" autoFocus />
            </label>
            <label className="field">
              <span>Topics to finish per week</span>
              <input type="number" min="0" max="200" step="1" inputMode="numeric" value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="e.g. 4" />
            </label>
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button className="btn primary">Save goal</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}

function GoalRow({ label, value, target, pct }: { label: string; value: string; target: string | null; pct: number }) {
  const capped = Math.min(100, Math.round(pct))
  const hit = target !== null && pct >= 100
  return (
    <div className={`goal-row ${hit ? 'hit' : ''}`}>
      <div className="goal-line">
        <span>{label}</span>
        <strong>
          {value}
          {target && <small> / {target}</small>}
          {hit && ' ✓'}
        </strong>
      </div>
      {target && <ProgressBar pct={capped} color={hit ? 'var(--green)' : 'var(--accent)'} />}
    </div>
  )
}

/** Finished topics that are due for a quick revision (1, 7 and 30 days after finishing). */
function Reviews() {
  const { user, roadmaps, run } = useApp()
  const due = dueReviews(roadmaps, user.uid)
  if (due.length === 0) return null

  return (
    <section className="card">
      <div className="card-head">
        <h2>
          <RotateCcw size={16} className="head-icon" /> Revise today
        </h2>
        <span className="muted small">
          {due.length} topic{due.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="rows">
        {due.slice(0, 5).map(({ roadmap, topic, entry }) => {
          const step = entry.r ?? 0
          return (
            <div key={topic.id} className="row" style={{ '--c': roadmap.color } as CSSProperties}>
              <span className="emoji-tile sm">{roadmap.emoji}</span>
              <a className="row-text" href={`#/r/${roadmap.id}?t=${topic.id}`}>
                <strong>{topic.title}</strong>
                <span className="muted">
                  {step === 0 ? 'Finished' : 'Last revised'} {ago(entry.rt ?? entry.t)} · revision {step + 1} of {REVIEW_STEPS.length}
                </span>
              </a>
              <button
                className="btn small"
                onClick={() => run(store.setEntry(roadmap.id, user.uid, topic.id, { ...entry, r: step + 1, rt: now() }))}
              >
                Revised
              </button>
            </div>
          )
        })}
      </div>
      {due.length > 5 && <p className="muted small hint">+{due.length - 5} more after these.</p>}
    </section>
  )
}

/** Unfinished milestones that have a target date. */
function Deadlines() {
  const { user, roadmaps } = useApp()
  const list = deadlinesOf(learningRoadmaps(roadmaps, user.uid), user.uid)
  if (list.length === 0) return null
  const behind = list.filter((x) => dueInfo(x.milestone.due!, false).tone === 'over').length

  return (
    <section className="card">
      <div className="card-head">
        <h2>
          <CalendarClock size={16} className="head-icon" /> Target dates
        </h2>
        <span className={`due-chip ${behind ? 'over' : 'ok'}`}>{behind ? `${behind} behind` : 'On track'}</span>
      </div>
      <div className="rows">
        {list.slice(0, 5).map(({ roadmap, milestone, done, total }) => {
          const info = dueInfo(milestone.due!, false)
          return (
            <a key={milestone.id} className="row" href={`#/r/${roadmap.id}`} style={{ '--c': roadmap.color } as CSSProperties}>
              <span className="emoji-tile sm">{roadmap.emoji}</span>
              <span className="row-text">
                <strong>{milestone.title}</strong>
                <span className="muted">
                  {roadmap.title} · {shortDate(milestone.due!)} · {done}/{total}
                </span>
              </span>
              <span className={`due-chip ${info.tone}`}>{info.label}</span>
            </a>
          )
        })}
      </div>
    </section>
  )
}

/** Roadmaps other people shared with me, showing how far the owner has got. */
function SharedWithMe() {
  const { user, roadmaps, members } = useApp()
  const shared = roadmaps.filter((r) => r.ownerId !== user.uid)
  if (shared.length === 0) return null

  return (
    <section className="card">
      <div className="card-head">
        <h2>
          <Users size={16} className="head-icon" /> Shared with you
        </h2>
        <span className="muted small">Their progress</span>
      </div>
      <div className="rows">
        {shared.slice(0, 5).map((r) => {
          const owner = members.find((m) => m.uid === r.ownerId)
          const p = progressOf(r, r.ownerId)
          return (
            <a key={r.id} className="row" href={`#/r/${r.id}`} style={{ '--c': r.color } as CSSProperties}>
              <Avatar name={owner?.name ?? r.ownerName} photo={owner?.photo} size={34} />
              <span className="row-text">
                <strong>
                  {r.emoji} {r.title}
                </strong>
                <span className="muted">
                  {r.ownerName} · {p.done} of {p.total} topics
                </span>
                <ProgressBar pct={p.pct} color={r.color} />
              </span>
              <strong className="row-pct">{p.pct}%</strong>
            </a>
          )
        })}
      </div>
    </section>
  )
}

/** Unresolved project issues assigned to me, most pressing first. */
function MyIssues() {
  const { user, projects } = useApp()
  const mine = projects
    .flatMap((project) => issuesOf(project).map((issue) => ({ project, issue })))
    .filter(({ issue }) => issue.assigneeId === user.uid && issue.status !== 'resolved')
    .sort((a, b) => (a.issue.due ?? '9999').localeCompare(b.issue.due ?? '9999'))
  if (mine.length === 0) return null
  const late = mine.filter(({ issue }) => issueOverdue(issue)).length

  return (
    <section className="card">
      <div className="card-head">
        <h2>
          <ListChecks size={16} className="head-icon" /> Your issues
        </h2>
        <span className={`due-chip ${late ? 'over' : 'none'}`}>{late ? `${late} overdue` : `${mine.length} open`}</span>
      </div>
      <div className="rows">
        {mine.slice(0, 5).map(({ project, issue }) => (
          <a key={issue.id} className="row" href={`#/p/${project.id}?i=${issue.id}`}>
            <span className="issue-type">{ISSUE_TYPES[issue.type].icon}</span>
            <span className="row-text">
              <strong>{issue.title}</strong>
              <span className="muted">
                {project.name} · #{issue.num}
              </span>
            </span>
            {issue.due ? (
              <span className={`due-chip ${dueInfo(issue.due, false).tone}`}>{dueInfo(issue.due, false).label}</span>
            ) : (
              <span className={`prio prio-${issue.priority}`}>{PRIORITIES[issue.priority]}</span>
            )}
          </a>
        ))}
      </div>
      {mine.length > 5 && <p className="muted small hint">+{mine.length - 5} more in Projects.</p>}
    </section>
  )
}

function Stat({
  icon,
  tone,
  value,
  unit,
  label,
}: {
  icon: ReactNode
  tone: string
  value: number | string
  unit?: string
  label: string
}) {
  return (
    <div className={`stat tone-${tone}`}>
      <span className="stat-icon">{icon}</span>
      <div>
        <div className="stat-value">
          {value}
          {unit && <small>{unit}</small>}
        </div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  )
}

function Heatmap({ activity }: { activity: Map<string, number> }) {
  const today = new Date()
  const todayKey = dayKey(today)
  // Start on the Sunday WEEKS-1 weeks before this week.
  const start = new Date(today)
  start.setDate(today.getDate() - today.getDay() - (WEEKS - 1) * 7)

  const weeks: { key: string; count: number; future: boolean }[][] = []
  const cursor = new Date(start)
  for (let w = 0; w < WEEKS; w++) {
    const col = []
    for (let d = 0; d < 7; d++) {
      const key = dayKey(cursor)
      col.push({ key, count: activity.get(key) ?? 0, future: key > todayKey })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(col)
  }
  const activeDays = weeks.flat().filter((c) => c.count > 0).length

  return (
    <>
      <div className="heatmap" role="img" aria-label={`${activeDays} active days in the last ${WEEKS} weeks`}>
        {weeks.map((col, i) => (
          <div key={i} className="heat-col">
            {col.map((c) => (
              <span
                key={c.key}
                className={`heat lvl-${c.future ? 'x' : Math.min(c.count, 4)} ${c.key === todayKey ? 'today' : ''}`}
                title={c.future ? undefined : `${prettyDay(c.key)}: ${c.count} activit${c.count === 1 ? 'y' : 'ies'}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="heat-foot">
        <span className="muted small">
          {activeDays} active day{activeDays === 1 ? '' : 's'}
        </span>
        <span className="heat-legend">
          Less
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className={`heat lvl-${l}`} />
          ))}
          More
        </span>
      </div>
    </>
  )
}
