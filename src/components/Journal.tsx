import { useMemo, useState } from 'react'
import { Clock, Trash2 } from 'lucide-react'
import { useApp } from '../lib/context'
import { store } from '../lib/store'
import type { LogEntry } from '../lib/types'
import { dayKey, formatMinutes, newId, prettyDay } from '../lib/utils'
import { Avatar, Empty } from './ui'

const DURATIONS = [15, 30, 45, 60, 90, 120]

export function Journal() {
  const { user, roadmaps, logs, members, run } = useApp()
  const [text, setText] = useState('')
  const [minutes, setMinutes] = useState(30)
  const [roadmapId, setRoadmapId] = useState('')
  const [date, setDate] = useState(dayKey())
  const [filter, setFilter] = useState<'all' | 'mine'>('all')

  const shown = filter === 'mine' ? logs.filter((l) => l.userId === user.uid) : logs

  const groups = useMemo(() => {
    const sorted = [...shown].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    const out: { date: string; entries: LogEntry[] }[] = []
    for (const l of sorted) {
      const last = out[out.length - 1]
      if (last && last.date === l.date) last.entries.push(l)
      else out.push({ date: l.date, entries: [l] })
    }
    return out
  }, [shown])

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 6)
  const weekMinutes = logs
    .filter((l) => l.userId === user.uid && l.date >= dayKey(weekAgo))
    .reduce((n, l) => n + (l.minutes || 0), 0)

  const submit = () => {
    const t = text.trim()
    if (!t) return
    const r = roadmaps.find((x) => x.id === roadmapId)
    run(
      store.addLog({
        id: newId(),
        userId: user.uid,
        userName: user.name,
        userPhoto: user.photo,
        text: t,
        minutes,
        roadmapId: r?.id ?? null,
        roadmapTitle: r ? `${r.emoji} ${r.title}` : null,
        date: date || dayKey(),
        createdAt: Date.now(),
      }),
    )
    setText('')
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Learning journal</h1>
          <p className="muted">A few lines after each session is the easiest way to make learning stick.</p>
        </div>
        <div className="week-pill">
          <Clock size={16} />
          <strong>{formatMinutes(weekMinutes)}</strong> this week
        </div>
      </header>

      <form
        className="card composer"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="composer-top">
          <Avatar name={user.name} photo={user.photo} size={36} />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
            }}
            rows={3}
            placeholder="What did you learn today?"
            aria-label="What did you learn today?"
          />
        </div>
        <div className="composer-row">
          <div className="chips" role="group" aria-label="Time spent">
            {DURATIONS.map((d) => (
              <button type="button" key={d} className={`chip-btn ${minutes === d ? 'on' : ''}`} aria-pressed={minutes === d} onClick={() => setMinutes(d)}>
                {formatMinutes(d)}
              </button>
            ))}
          </div>
          <select value={roadmapId} onChange={(e) => setRoadmapId(e.target.value)} aria-label="Roadmap">
            <option value="">No roadmap</option>
            {roadmaps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.emoji} {r.title}
              </option>
            ))}
          </select>
          <input type="date" value={date} max={dayKey()} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
          <button className="btn primary" disabled={!text.trim()}>
            Log it
          </button>
        </div>
      </form>

      {logs.length > 0 && members.length > 1 && (
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
            Everyone
          </button>
          <button role="tab" aria-selected={filter === 'mine'} className={filter === 'mine' ? 'on' : ''} onClick={() => setFilter('mine')}>
            Just me
          </button>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="card">
          <Empty emoji="📝" title="Your journal is empty" text="Log your first session above — it also counts toward your streak." />
        </div>
      ) : (
        <div className="feed">
          {groups.map((g) => (
            <section key={g.date}>
              <h3 className="feed-day">{prettyDay(g.date)}</h3>
              {g.entries.map((l) => (
                <article key={l.id} className="card entry">
                  <Avatar name={l.userName} photo={l.userPhoto} size={34} />
                  <div className="entry-body">
                    <div className="entry-meta">
                      <strong>{l.userId === user.uid ? 'You' : l.userName}</strong>
                      {l.minutes > 0 && <span className="chip">{formatMinutes(l.minutes)}</span>}
                      {l.roadmapTitle && (
                        <a className="chip link-chip" href={l.roadmapId ? `#/r/${l.roadmapId}` : undefined}>
                          {l.roadmapTitle}
                        </a>
                      )}
                    </div>
                    <p>{l.text}</p>
                  </div>
                  {l.userId === user.uid && (
                    <button className="icon-btn sm danger" aria-label="Delete entry" title="Delete entry" onClick={() => confirm('Delete this entry?') && run(store.deleteLog(l.id))}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </article>
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  )
}
