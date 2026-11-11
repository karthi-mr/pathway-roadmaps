import { useEffect, useState } from 'react'
import { Check, Pause, Play, X } from 'lucide-react'
import { chime, clock } from '../lib/focus'
import type { Focus } from '../lib/focus'
import { ProgressRing } from './ui'

/** Floating countdown that stays on screen while you move around the app. */
export function FocusWidget({
  focus,
  onChange,
  onFinish,
}: {
  focus: Focus
  onChange: (f: Focus | null) => void
  /** `left` = ms that were still on the clock */
  onFinish: (left: number) => void
}) {
  const [nowTs, setNowTs] = useState(() => Date.now())

  useEffect(() => {
    const tick = () => {
      const n = Date.now()
      setNowTs(n)
      if (focus.endsAt && n >= focus.endsAt) {
        chime()
        onFinish(0)
      }
    }
    const t = window.setInterval(tick, 500)
    return () => window.clearInterval(t)
  }, [focus, onFinish])

  const running = focus.endsAt !== null
  const left = focus.endsAt ? Math.max(0, focus.endsAt - nowTs) : focus.left
  const time = clock(left)

  // Show the countdown in the browser tab too.
  useEffect(() => {
    const original = document.title
    return () => {
      document.title = original
    }
  }, [])
  useEffect(() => {
    document.title = `${time} · ${focus.title}`
  }, [time, focus.title])

  return (
    <div className={`focus-widget ${running ? '' : 'paused'}`} role="timer" aria-label={`Focus session, ${time} left`}>
      <ProgressRing pct={Math.round(((focus.total - left) / focus.total) * 100)} size={58} stroke={5}>
        {time}
      </ProgressRing>
      <a className="focus-text" href={`#/r/${focus.roadmapId}?t=${focus.topicId}`}>
        <span className="tiny">{running ? 'Focusing on' : 'Paused'}</span>
        <strong>{focus.title}</strong>
      </a>
      <div className="focus-actions">
        {running ? (
          <button className="icon-btn" title="Pause" aria-label="Pause" onClick={() => onChange({ ...focus, endsAt: null, left })}>
            <Pause size={17} />
          </button>
        ) : (
          <button className="icon-btn" title="Resume" aria-label="Resume" onClick={() => onChange({ ...focus, endsAt: Date.now() + focus.left })}>
            <Play size={17} />
          </button>
        )}
        <button className="icon-btn ok" title="Finish now and log the time" aria-label="Finish now and log the time" onClick={() => onFinish(left)}>
          <Check size={18} />
        </button>
        <button
          className="icon-btn danger"
          title="Discard session"
          aria-label="Discard session"
          onClick={() => confirm('Discard this focus session without logging it?') && onChange(null)}
        >
          <X size={17} />
        </button>
      </div>
    </div>
  )
}
