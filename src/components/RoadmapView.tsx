import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { CollisionDetection, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  Check,
  Copy,
  Download,
  ExternalLink,
  GripVertical,
  Link as LinkIcon,
  MessageCircle,
  Share2,
  StickyNote,
  Timer,
  Trash2,
  X,
} from 'lucide-react'
import { go, useApp } from '../lib/context'
import { burst } from '../lib/confetti'
import { store } from '../lib/store'
import type { Member, Milestone, Roadmap, Status, Topic } from '../lib/types'
import { duplicateRoadmap, exportRoadmap } from '../lib/transfer'
import { ago, dueInfo, milestoneDone, newId, now, peopleOn, progressOf, shortDate, statusOf } from '../lib/utils'
import { ShareDialog } from './ShareDialog'
import { Avatar, EditableText, Empty, ProgressBar, ProgressRing, QuickAdd, StatusButton, useEscape } from './ui'

const NEXT: Record<Status, Status> = { todo: 'doing', doing: 'done', done: 'todo' }

const move = <T,>(list: T[], from: number, to: number) => {
  if (to < 0 || to >= list.length) return
  const [item] = list.splice(from, 1)
  list.splice(to, 0, item)
}

/** One connector line drawn behind the nodes. */
interface Wire {
  key: string
  kind: 'spine' | 'topic'
  /** milestone id for a spine segment, topic id for a branch */
  id: string
  d: string
  ex: number
  ey: number
}

/**
 * While dragging a milestone only other milestones are drop targets. While
 * dragging a topic, the milestone under the pointer decides which list it goes
 * into, then the nearest topic in that list decides the position.
 */
const collide: CollisionDetection = (args) => {
  const kind = (c: { data: { current?: { type?: string } } }) => c.data.current?.type
  if (args.active.data.current?.type === 'milestone') {
    return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => kind(c) === 'milestone') })
  }
  const topics = args.droppableContainers.filter((c) => kind(c) === 'topic')
  const zones = args.droppableContainers.filter((c) => kind(c) === 'zone')
  const zone = pointerWithin({ ...args, droppableContainers: zones })[0]
  if (zone) {
    const mid = String(zone.id).slice(2)
    const inZone = topics.filter((c) => c.data.current?.mid === mid)
    if (inZone.length === 0) return [zone]
    const lowest = Math.max(...inZone.map((c) => args.droppableRects.get(c.id)?.bottom ?? 0))
    if (args.pointerCoordinates && args.pointerCoordinates.y > lowest) return [zone]
    return closestCenter({ ...args, droppableContainers: inZone })
  }
  return closestCenter({ ...args, droppableContainers: [...topics, ...zones] })
}

export function RoadmapView({ id, initialTopic }: { id: string; initialTopic?: string | null }) {
  const { user, roadmaps, members, run, notify } = useApp()
  const [openTopic, setOpenTopic] = useState<string | null>(initialTopic ?? null)
  const [drag, setDrag] = useState<{ type: 'topic' | 'milestone'; id: string } | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [wires, setWires] = useState<Wire[]>([])
  const [sharing, setSharing] = useState(false)
  const [viewAs, setViewAs] = useState<string | null>(null)
  const flowRef = useRef<HTMLDivElement>(null)
  const roadmap = roadmaps.find((r) => r.id === id)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  /** Read where the nodes ended up on screen and draw the links between them. */
  const measure = useCallback(() => {
    const el = flowRef.current
    if (!el) return
    const base = el.getBoundingClientRect()
    const rel = (r: DOMRect) => ({
      l: r.left - base.left,
      r: r.right - base.left,
      t: r.top - base.top,
      b: r.bottom - base.top,
      cx: r.left - base.left + r.width / 2,
      cy: r.top - base.top + r.height / 2,
    })
    const out: Wire[] = []
    const nodes = [...el.querySelectorAll<HTMLElement>('[data-mnode]')]
    nodes.forEach((n, i) => {
      const M = rel(n.getBoundingClientRect())
      const mid = n.dataset.mnode!
      const branches = [...(n.parentElement?.querySelectorAll<HTMLElement>('[data-topic]') ?? [])].map((t) => ({
        id: t.dataset.topic!,
        T: rel(t.getBoundingClientRect()),
      }))
      // On narrow screens the topics sit underneath their milestone instead of beside it.
      const stacked = branches.some(({ T }) => T.l < M.r && T.r > M.l)
      const trunk = stacked ? M.l + 22 : M.cx

      const next = nodes[i + 1]
      if (next) {
        const N = rel(next.getBoundingClientRect())
        out.push({ key: `s:${mid}`, kind: 'spine', id: mid, d: `M ${trunk} ${M.b} L ${trunk} ${N.t}`, ex: trunk, ey: N.t })
      }
      for (const { id: tid, T } of branches) {
        let d: string
        let ex: number
        if (stacked) {
          ex = T.l
          const r = Math.max(0, Math.min(12, ex - trunk, T.cy - M.b))
          d = `M ${trunk} ${M.b} V ${T.cy - r} Q ${trunk} ${T.cy} ${trunk + r} ${T.cy} H ${ex}`
        } else {
          const right = T.l >= M.r
          const sx = right ? M.r : M.l
          ex = right ? T.l : T.r
          const mx = (sx + ex) / 2
          d = `M ${sx} ${M.cy} C ${mx} ${M.cy}, ${mx} ${T.cy}, ${ex} ${T.cy}`
        }
        out.push({ key: `t:${tid}`, kind: 'topic', id: tid, d, ex, ey: T.cy })
      }
    })
    setWires(out)
  }, [])

  const milestones = roadmap?.milestones
  useLayoutEffect(() => {
    if (drag) return
    measure()
    // again once the drop animation and web fonts have settled
    const t = window.setTimeout(measure, 320)
    return () => window.clearTimeout(t)
  }, [milestones, drag, measure])

  useEffect(() => {
    const el = flowRef.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    document.fonts?.ready.then(measure)
    return () => ro.disconnect()
  }, [measure, roadmap?.id])

  if (!roadmap) {
    return (
      <div className="card">
        <Empty
          emoji="🫥"
          title="Roadmap not found"
          text="It may have been deleted."
          action={
            <a className="btn primary" href="#/roadmaps">
              Back to roadmaps
            </a>
          }
        />
      </div>
    )
  }

  // Only the owner changes the structure. People it is shared with can follow
  // progress, comment and set target dates.
  const canEdit = roadmap.ownerId === user.uid
  const people = peopleOn(roadmap, members)
  // Whose progress is on screen: your own if it is your roadmap, otherwise the owner's.
  const viewUid = viewAs && people.some((m) => m.uid === viewAs) ? viewAs : canEdit ? user.uid : roadmap.ownerId
  const viewingSelf = viewUid === user.uid
  const viewed = people.find((m) => m.uid === viewUid)
  const p = progressOf(roadmap, viewUid)

  /** Apply a change to a copy of the milestones and save it. */
  const mutate = (fn: (ms: Milestone[]) => void) => {
    const ms = structuredClone(roadmap.milestones)
    fn(ms)
    run(store.updateRoadmap(roadmap.id, { milestones: ms, updatedAt: now() }))
  }

  const setStatus = (m: Milestone, t: Topic, status: Status) => {
    run(store.setProgress(roadmap.id, user.uid, t.id, status))
    if (status === 'done' && viewingSelf) {
      const rest = m.topics.filter((x) => x.id !== t.id)
      if (rest.every((x) => statusOf(roadmap, user.uid, x.id) === 'done')) {
        burst()
        notify(p.done + 1 === p.total ? `Roadmap complete — ${roadmap.title} 🎉` : `Milestone complete — ${m.title} 🎉`)
      }
    }
  }

  const remove = () => {
    if (!confirm(`Delete "${roadmap.title}" for everyone? This cannot be undone.`)) return
    run(store.deleteRoadmap(roadmap.id))
    go('/roadmaps')
  }

  const homeOf = (topicId: string) => roadmap.milestones.find((m) => m.topics.some((t) => t.id === topicId))

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDrag(null)
    setOverId(null)
    if (!over || active.id === over.id) return
    const a = String(active.id)
    const o = String(over.id)

    if (active.data.current?.type === 'milestone') {
      const from = roadmap.milestones.findIndex((m) => `m:${m.id}` === a)
      const to = roadmap.milestones.findIndex((m) => `m:${m.id}` === o)
      if (from >= 0 && to >= 0) mutate((ms) => move(ms, from, to))
      return
    }

    const fromId = homeOf(a)?.id
    const toId = o.startsWith('z:') ? o.slice(2) : homeOf(o)?.id
    if (!fromId || !toId) return
    mutate((ms) => {
      const from = ms.find((m) => m.id === fromId)!
      const to = ms.find((m) => m.id === toId)!
      const fi = from.topics.findIndex((t) => t.id === a)
      const onTopic = !o.startsWith('z:')
      if (from === to) {
        move(from.topics, fi, onTopic ? to.topics.findIndex((t) => t.id === o) : to.topics.length - 1)
      } else {
        const [topic] = from.topics.splice(fi, 1)
        to.topics.splice(onTopic ? to.topics.findIndex((t) => t.id === o) : to.topics.length, 0, topic)
      }
    })
  }

  let opened: { m: Milestone; t: Topic; mi: number; ti: number } | null = null
  let dragged: Topic | null = null
  roadmap.milestones.forEach((m, mi) =>
    m.topics.forEach((t, ti) => {
      if (t.id === openTopic) opened = { m, t, mi, ti }
      if (drag?.type === 'topic' && t.id === drag.id) dragged = t
    }),
  )
  const sel = opened as { m: Milestone; t: Topic; mi: number; ti: number } | null
  const draggedTopic = dragged as Topic | null
  const dragHome = drag?.type === 'topic' ? homeOf(drag.id)?.id : undefined
  const completeIds = new Set(
    roadmap.milestones.filter((m) => m.topics.length > 0 && milestoneDone(roadmap, viewUid, m) === m.topics.length).map((m) => m.id),
  )

  return (
    <div style={{ '--c': roadmap.color } as CSSProperties}>
      <a className="back" href="#/roadmaps">
        <ArrowLeft size={16} /> Roadmaps
      </a>

      <header className="roadmap-hero">
        <span className="emoji-tile xl">{roadmap.emoji}</span>
        <div className="roadmap-hero-text">
          <EditableText readOnly={!canEdit} className="h1" label="Roadmap title" value={roadmap.title} onSave={(v) => v && run(store.updateRoadmap(roadmap.id, { title: v, updatedAt: now() }))} />
          <EditableText
            readOnly={!canEdit}
            className="desc"
            label="Goal"
            placeholder="Add a goal…"
            value={roadmap.description}
            onSave={(v) => run(store.updateRoadmap(roadmap.id, { description: v, updatedAt: now() }))}
          />
          <div className="hero-meta">
            <span>
              {p.done} of {p.total} done
            </span>
            {p.doing > 0 && <span>{p.doing} in progress</span>}
            <span>by {roadmap.ownerId === user.uid ? 'you' : roadmap.ownerName}</span>
          </div>
          <div className="hero-actions">
            {canEdit && (
              <button className="btn small" onClick={() => setSharing(true)}>
                <Share2 size={14} /> {roadmap.sharedWith?.length ? `Shared with ${roadmap.sharedWith.length}` : 'Share'}
              </button>
            )}
            <button
              className="btn small"
              onClick={() => {
                const copy = duplicateRoadmap(roadmap, user)
                run(store.createRoadmap(copy))
                notify('Roadmap duplicated')
                go(`/r/${copy.id}`)
              }}
            >
              <Copy size={14} /> Duplicate
            </button>
            <button className="btn small" onClick={() => exportRoadmap(roadmap)}>
              <Download size={14} /> Export
            </button>
          </div>
        </div>
        <ProgressRing pct={p.pct} size={92} stroke={8} color={roadmap.color} />
      </header>

      {people.length > 1 && (
        <div className="peers" role="tablist" aria-label="Whose progress to show">
          <span className="tiny">Progress of</span>
          {people.map((m) => {
            const mp = progressOf(roadmap, m.uid)
            return (
              <button key={m.uid} role="tab" aria-selected={m.uid === viewUid} className={`peer ${m.uid === viewUid ? 'on' : ''}`} onClick={() => setViewAs(m.uid)}>
                <Avatar name={m.name} photo={m.photo} size={28} />
                <span>
                  <span>
                    {m.uid === user.uid ? 'You' : m.name.split(' ')[0]}
                    {m.uid === roadmap.ownerId && m.uid !== user.uid ? ' (owner)' : ''} · {mp.pct}%
                  </span>
                  <ProgressBar pct={mp.pct} color={roadmap.color} />
                </span>
              </button>
            )
          })}
        </div>
      )}

      {!canEdit && (
        <p className="share-note">
          {roadmap.ownerName} shared this roadmap with you. You can follow progress, comment on topics and set target dates.
          {!viewingSelf && viewed ? ` Showing ${viewed.name.split(' ')[0]}’s progress.` : ''}
        </p>
      )}

      <div className="flow-legend">
        <span>
          <GripVertical size={14} /> {canEdit ? 'Drag topics to reorder them or move them to another milestone' : 'Click a topic to open its notes and discussion'}
        </span>
        <span className="legend-keys">
          <i className="key todo" /> Not started <i className="key doing" /> In progress <i className="key done" /> Done
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collide}
        onDragStart={({ active }) =>
          setDrag({ type: active.data.current?.type === 'milestone' ? 'milestone' : 'topic', id: String(active.id) })
        }
        onDragOver={({ over }) => setOverId(over ? String(over.id) : null)}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setDrag(null)
          setOverId(null)
        }}
      >
        <div ref={flowRef} className={`flow ${drag ? `drag-${drag.type}` : ''}`}>
          <svg className="wires" aria-hidden>
            {wires.map((w) => {
              const state =
                w.kind === 'spine' ? (completeIds.has(w.id) ? 'done' : 'todo') : statusOf(roadmap, viewUid, w.id)
              return (
                <g key={w.key} className={`wire ${w.kind} ${state}`}>
                  <path d={w.d} />
                  {w.kind === 'topic' && <circle cx={w.ex} cy={w.ey} r={4} />}
                </g>
              )
            })}
          </svg>

          <SortableContext items={roadmap.milestones.map((m) => `m:${m.id}`)} strategy={verticalListSortingStrategy}>
            {roadmap.milestones.map((m, mi) => (
              <Stage
                key={m.id}
                roadmap={roadmap}
                milestone={m}
                index={mi}
                uid={viewUid}
                canEdit={canEdit}
                readOnly={!viewingSelf}
                members={members}
                complete={completeIds.has(m.id)}
                // show where a topic from another milestone would land
                foreignOver={dragHome && dragHome !== m.id ? overId : null}
                onOpen={setOpenTopic}
                onStatus={(t) => setStatus(m, t, NEXT[statusOf(roadmap, user.uid, t.id)])}
                onRename={(v) => mutate((ms) => void (ms[mi].title = v))}
                onDue={(due) => mutate((ms) => void (ms[mi].due = due))}
                onDelete={() => {
                  if (m.topics.length === 0 || confirm(`Delete "${m.title}" and its ${m.topics.length} topic(s)?`)) mutate((ms) => void ms.splice(mi, 1))
                }}
                onAdd={(title) => mutate((ms) => void ms[mi].topics.push({ id: newId(), title, notes: '', resources: [] }))}
              />
            ))}
          </SortableContext>

          {canEdit && (
            <section className="stage ghost">
              <div className="mnode" data-mnode="new">
                <QuickAdd
                  placeholder={roadmap.milestones.length ? 'Add a milestone' : 'Name your first milestone'}
                  onAdd={(title) => mutate((ms) => void ms.push({ id: newId(), title, topics: [] }))}
                />
              </div>
            </section>
          )}
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
          {draggedTopic && (
            <div className="pill-wrap floating">
              <TopicPill roadmap={roadmap} topic={draggedTopic} uid={viewUid} members={members} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {roadmap.ownerId === user.uid && (
        <button className="btn ghost danger delete-roadmap" onClick={remove}>
          <Trash2 size={16} /> Delete roadmap
        </button>
      )}

      {sharing && (
        <ShareDialog
          what="roadmap"
          can="They can follow your progress, comment on topics and set target dates, but not change the topics."
          sharedWith={roadmap.sharedWith ?? []}
          onSave={(uids) => run(store.updateRoadmap(roadmap.id, { sharedWith: uids, updatedAt: now() }))}
          onClose={() => setSharing(false)}
        />
      )}

      {sel && (
        <TopicDrawer
          key={sel.t.id}
          roadmap={roadmap}
          milestone={sel.m}
          topic={sel.t}
          status={statusOf(roadmap, user.uid, sel.t.id)}
          canEdit={canEdit}
          canUp={sel.ti > 0}
          canDown={sel.ti < sel.m.topics.length - 1}
          onStatus={(s) => setStatus(sel.m, sel.t, s)}
          onChange={(patch) => mutate((ms) => void Object.assign(ms[sel.mi].topics[sel.ti], patch))}
          onMove={(dir) => mutate((ms) => move(ms[sel.mi].topics, sel.ti, sel.ti + dir))}
          onDelete={() => {
            setOpenTopic(null)
            mutate((ms) => void ms[sel.mi].topics.splice(sel.ti, 1))
          }}
          onClose={() => setOpenTopic(null)}
        />
      )}
    </div>
  )
}

/** A milestone node on the spine with its topics branching off to one side. */
function Stage({
  roadmap,
  milestone: m,
  index,
  uid,
  members,
  canEdit,
  readOnly,
  complete,
  foreignOver,
  onOpen,
  onStatus,
  onRename,
  onDue,
  onDelete,
  onAdd,
}: {
  roadmap: Roadmap
  milestone: Milestone
  index: number
  uid: string
  members: Member[]
  /** may change topics and milestones */
  canEdit: boolean
  /** looking at someone else's progress */
  readOnly: boolean
  complete: boolean
  foreignOver: string | null | undefined
  onOpen: (topicId: string) => void
  onStatus: (t: Topic) => void
  onRename: (title: string) => void
  onDue: (due: string | null) => void
  onDelete: () => void
  onAdd: (title: string) => void
}) {
  const sortable = useSortable({ id: `m:${m.id}`, data: { type: 'milestone' }, disabled: !canEdit })
  const zone = useDroppable({ id: `z:${m.id}`, data: { type: 'zone', mid: m.id } })
  const done = milestoneDone(roadmap, uid, m)
  const pct = m.topics.length ? Math.round((done / m.topics.length) * 100) : 0

  return (
    <section
      ref={sortable.setNodeRef}
      className={`stage ${index % 2 ? 'left' : ''} ${complete ? 'complete' : ''} ${sortable.isDragging ? 'lifting' : ''}`}
      style={{ transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }}
    >
      <div className="mnode" data-mnode={m.id}>
        <div className="mnode-top">
          <span className="mnode-badge">{complete ? <Check size={15} strokeWidth={3.2} /> : index + 1}</span>
          <span className="tiny">Milestone</span>
          <span className="spacer" />
          {canEdit && (
            <>
              <button className="icon-btn sm danger mnode-del" aria-label="Delete milestone" title="Delete milestone" onClick={onDelete}>
                <Trash2 size={14} />
              </button>
              <button
                ref={sortable.setActivatorNodeRef}
                className="icon-btn sm grip"
                title="Drag to reorder"
                {...sortable.attributes}
                {...sortable.listeners}
                aria-label={`Reorder milestone ${m.title}`}
              >
                <GripVertical size={15} />
              </button>
            </>
          )}
        </div>
        <EditableText readOnly={!canEdit} className="h2" label="Milestone title" value={m.title} onSave={(v) => v && onRename(v)} />
        <div className="mnode-progress">
          <ProgressBar pct={pct} color={roadmap.color} />
          <span>
            {done}/{m.topics.length}
          </span>
        </div>
        <DueChip due={m.due ?? null} complete={complete} onChange={onDue} />
      </div>

      <div ref={zone.setNodeRef} className={`branch ${foreignOver === `z:${m.id}` ? 'drop-end' : ''}`}>
        <SortableContext items={m.topics.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {m.topics.map((t) => (
            <SortableTopic
              key={t.id}
              roadmap={roadmap}
              topic={t}
              mid={m.id}
              uid={uid}
              members={members}
              canEdit={canEdit}
              readOnly={readOnly}
              dropBefore={foreignOver === t.id}
              onOpen={() => onOpen(t.id)}
              onStatus={() => onStatus(t)}
            />
          ))}
        </SortableContext>
        {canEdit && (
          <div className="pill-add">
            <QuickAdd placeholder="Add a topic" onAdd={onAdd} />
          </div>
        )}
      </div>
    </section>
  )
}

/** Target date for a milestone: shows how far away it is, click to pick or change. */
function DueChip({ due, complete, onChange }: { due: string | null; complete: boolean; onChange: (due: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const info = due ? dueInfo(due, complete) : null
  return (
    <div className="mnode-due">
      <button
        className={`due-chip ${info?.tone ?? 'none'}`}
        title={due ? 'Change target date' : 'Set a target date'}
        onClick={() => {
          const el = input.current
          if (!el) return
          if (typeof el.showPicker === 'function') el.showPicker()
          else el.focus()
        }}
      >
        <CalendarDays size={13} />
        {due && info ? `${shortDate(due)} · ${info.label}` : 'Set target date'}
      </button>
      {due && (
        <button className="icon-btn sm" aria-label="Clear target date" title="Clear target date" onClick={() => onChange(null)}>
          <X size={13} />
        </button>
      )}
      <input ref={input} type="date" className="due-input" value={due ?? ''} tabIndex={-1} aria-label="Target date" onChange={(e) => onChange(e.target.value || null)} />
    </div>
  )
}

interface PillProps {
  roadmap: Roadmap
  topic: Topic
  uid: string
  members: Member[]
  canEdit?: boolean
  readOnly?: boolean
  onOpen?: () => void
  onStatus?: () => void
}

function SortableTopic({ mid, dropBefore, ...pill }: PillProps & { mid: string; dropBefore: boolean }) {
  const s = useSortable({ id: pill.topic.id, data: { type: 'topic', mid }, disabled: !pill.canEdit })
  return (
    <div
      ref={s.setNodeRef}
      data-topic={pill.topic.id}
      className={`pill-wrap ${pill.canEdit ? '' : 'locked'} ${s.isDragging ? 'ghosted' : ''} ${dropBefore ? 'drop-before' : ''}`}
      style={{ transform: CSS.Translate.toString(s.transform), transition: s.transition }}
      {...s.attributes}
      {...s.listeners}
      aria-label={pill.canEdit ? `${pill.topic.title}. Press space to pick up and move.` : pill.topic.title}
    >
      <TopicPill {...pill} />
    </div>
  )
}

function TopicPill({ roadmap, topic: t, uid, members, canEdit, readOnly, onOpen, onStatus }: PillProps) {
  const { comments, focusing } = useApp()
  const talk = comments.filter((c) => c.topicId === t.id).length
  const s = statusOf(roadmap, uid, t.id)
  const doneBy = members.filter((x) => x.uid !== uid && statusOf(roadmap, x.uid, t.id) === 'done')
  return (
    <div className={`pill is-${s}`}>
      <StatusButton status={s} color={roadmap.color} readOnly={readOnly} onClick={() => onStatus?.()} />
      <button className="pill-main" onClick={onOpen}>
        <span className="pill-title">{t.title}</span>
        {t.notes && <StickyNote size={14} className="hint-icon" aria-label="Has notes" />}
        {t.resources.length > 0 && (
          <span className="hint-icon">
            <LinkIcon size={13} /> {t.resources.length}
          </span>
        )}
        {talk > 0 && (
          <span className="hint-icon">
            <MessageCircle size={13} /> {talk}
          </span>
        )}
        {focusing === t.id && <Timer size={14} className="hint-icon live" aria-label="Focus session running" />}
      </button>
      {doneBy.length > 0 && (
        <span className="avatar-stack">
          {doneBy.slice(0, 3).map((x) => (
            <Avatar key={x.uid} name={x.name} photo={x.photo} size={20} title={`${x.name} finished this`} />
          ))}
        </span>
      )}
      {canEdit && <GripVertical size={15} className="pill-grip" aria-hidden />}
    </div>
  )
}

const FOCUS_LENGTHS = [15, 25, 45, 60]

function TopicDrawer({
  roadmap,
  milestone,
  topic,
  status,
  canEdit,
  canUp,
  canDown,
  onStatus,
  onChange,
  onMove,
  onDelete,
  onClose,
}: {
  roadmap: Roadmap
  milestone: Milestone
  topic: Topic
  status: Status
  canEdit: boolean
  canUp: boolean
  canDown: boolean
  onStatus: (s: Status) => void
  onChange: (patch: Partial<Topic>) => void
  onMove: (dir: -1 | 1) => void
  onDelete: () => void
  onClose: () => void
}) {
  const { user, comments, run, focusing, startFocus } = useApp()
  const [notes, setNotes] = useState(topic.notes)
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [minutes, setMinutes] = useState(25)
  const [message, setMessage] = useState('')
  const thread = comments.filter((c) => c.roadmapId === roadmap.id && c.topicId === topic.id)

  const saveNotes = () => {
    if (canEdit && notes !== topic.notes) onChange({ notes })
  }
  const close = () => {
    saveNotes()
    onClose()
  }
  useEscape(close)

  const addLink = () => {
    let u = url.trim()
    if (!u) return
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`
    if (!URL.canParse(u)) return
    const host = new URL(u).hostname.replace(/^www\./, '')
    onChange({ notes, resources: [...topic.resources, { id: newId(), label: label.trim() || host, url: u }] })
    setLabel('')
    setUrl('')
  }

  const send = () => {
    const text = message.trim()
    if (!text) return
    run(
      store.addComment({
        id: newId(),
        roadmapId: roadmap.id,
        topicId: topic.id,
        userId: user.uid,
        userName: user.name,
        userPhoto: user.photo,
        text,
        createdAt: now(),
      }),
    )
    setMessage('')
  }

  return (
    <div className="overlay drawer-overlay" onMouseDown={close}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={topic.title} style={{ '--c': roadmap.color } as CSSProperties} onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <span className="tiny">
            {roadmap.emoji} {milestone.title}
          </span>
          <button className="icon-btn" onClick={close} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <EditableText readOnly={!canEdit} className="h2 drawer-title" label="Topic title" value={topic.title} onSave={(v) => v && onChange({ title: v })} />

        {!canEdit && <span className="tiny">Your own progress on this topic</span>}
        <div className="segmented status-seg">
          {(['todo', 'doing', 'done'] as Status[]).map((s) => (
            <button key={s} className={status === s ? `on ${s}` : ''} aria-pressed={status === s} onClick={() => onStatus(s)}>
              {s === 'todo' ? 'Not started' : s === 'doing' ? 'In progress' : 'Done'}
            </button>
          ))}
        </div>

        <div className="field">
          <span>Focus session</span>
          <div className="focus-row">
            <div className="chips" role="group" aria-label="Session length">
              {FOCUS_LENGTHS.map((m) => (
                <button type="button" key={m} className={`chip-btn ${minutes === m ? 'on' : ''}`} aria-pressed={minutes === m} onClick={() => setMinutes(m)}>
                  {m}m
                </button>
              ))}
            </div>
            <button
              className="btn small primary"
              disabled={focusing !== null}
              onClick={() => {
                if (status === 'todo') onStatus('doing')
                startFocus({ roadmapId: roadmap.id, topicId: topic.id, title: topic.title, roadmapTitle: `${roadmap.emoji} ${roadmap.title}`, minutes })
                close()
              }}
            >
              <Timer size={15} /> Start
            </button>
          </div>
          <small className="muted">
            {focusing !== null ? 'A session is already running — finish it first.' : 'The time is added to your journal when the session ends.'}
          </small>
        </div>

        <label className="field">
          <span>Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            rows={6}
            readOnly={!canEdit}
            placeholder={canEdit ? 'Key takeaways, questions, things to revisit…' : 'No notes yet'}
          />
        </label>

        <div className="field">
          <span>Resources</span>
          {topic.resources.map((r) => (
            <div key={r.id} className="resource">
              <a href={r.url} target="_blank" rel="noreferrer noopener">
                <ExternalLink size={14} />
                <span>{r.label}</span>
              </a>
              {canEdit && (
                <button
                  className="icon-btn sm"
                  aria-label={`Remove ${r.label}`}
                  onClick={() => onChange({ notes, resources: topic.resources.filter((x) => x.id !== r.id) })}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {!canEdit && topic.resources.length === 0 && <small className="muted">No links yet</small>}
          <form
            hidden={!canEdit}
            className="resource-add"
            onSubmit={(e) => {
              e.preventDefault()
              addLink()
            }}
          >
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a link" aria-label="Link URL" />
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" aria-label="Link label" />
            <button className="btn small" disabled={!url.trim()}>
              Add
            </button>
          </form>
        </div>

        <div className="field">
          <span>
            Discussion {thread.length > 0 && <em>{thread.length}</em>}
          </span>
          {thread.map((c) => (
            <div key={c.id} className="comment">
              <Avatar name={c.userName} photo={c.userPhoto} size={28} />
              <div className="comment-body">
                <div className="comment-meta">
                  <strong>{c.userId === user.uid ? 'You' : c.userName}</strong>
                  <span className="tiny">{ago(c.createdAt)}</span>
                  {c.userId === user.uid && (
                    <button className="icon-btn sm danger" aria-label="Delete comment" title="Delete comment" onClick={() => run(store.deleteComment(c))}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <p>{c.text}</p>
              </div>
            </div>
          ))}
          <form
            className="comment-add"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask a question or share a tip" aria-label="Write a comment" maxLength={1000} />
            <button className="btn small" disabled={!message.trim()}>
              Send
            </button>
          </form>
        </div>

        <div className="drawer-foot" hidden={!canEdit}>
          <button className="btn ghost small" disabled={!canUp} onClick={() => onMove(-1)}>
            <ArrowUp size={15} /> Up
          </button>
          <button className="btn ghost small" disabled={!canDown} onClick={() => onMove(1)}>
            <ArrowDown size={15} /> Down
          </button>
          <span className="spacer" />
          <button className="btn ghost small danger" onClick={onDelete}>
            <Trash2 size={15} /> Delete topic
          </button>
        </div>
      </aside>
    </div>
  )
}
