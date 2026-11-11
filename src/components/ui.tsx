import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import type { Status } from '../lib/types'

const AVATAR_COLORS = ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e']

export function Avatar({
  name,
  photo,
  size = 32,
  title,
}: {
  name: string
  photo?: string | null
  size?: number
  title?: string
}) {
  const [broken, setBroken] = useState(false)
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const style: CSSProperties = {
    width: size,
    height: size,
    fontSize: size * 0.4,
    background: AVATAR_COLORS[hash % AVATAR_COLORS.length],
  }
  return (
    <span className="avatar" style={style} title={title ?? name}>
      {photo && !broken ? (
        <img src={photo} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        initials || '?'
      )}
    </span>
  )
}

export function ProgressRing({
  pct,
  size = 56,
  stroke = 6,
  color = 'var(--accent)',
  children,
}: {
  pct: number
  size?: number
  stroke?: number
  color?: string
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`${pct}% complete`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <span className="ring-label">{children ?? `${pct}%`}</span>
    </span>
  )
}

export function ProgressBar({ pct, color }: { pct: number; color?: string }) {
  return (
    <span className="bar" role="img" aria-label={`${pct}% complete`}>
      <span style={{ width: `${pct}%`, background: color }} />
    </span>
  )
}

const STATUS_LABEL: Record<Status, string> = {
  todo: 'Not started',
  doing: 'In progress',
  done: 'Done',
}

/** Round status toggle: empty → half (in progress) → check (done). */
export function StatusButton({
  status,
  onClick,
  color,
  readOnly = false,
}: {
  status: Status
  onClick: () => void
  color?: string
  /** show the state but do not let it be changed (someone else's progress) */
  readOnly?: boolean
}) {
  if (readOnly) {
    return (
      <span className={`status status-${status} read-only`} style={{ '--c': color } as CSSProperties} role="img" aria-label={`Status: ${STATUS_LABEL[status]}`} title={STATUS_LABEL[status]}>
        {status === 'done' && <Check size={14} strokeWidth={3.5} />}
      </span>
    )
  }
  return (
    <button
      type="button"
      className={`status status-${status}`}
      style={{ '--c': color } as CSSProperties}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      title={`${STATUS_LABEL[status]} — click to change`}
      aria-label={`Status: ${STATUS_LABEL[status]}. Click to change.`}
    >
      {status === 'done' && <Check size={14} strokeWidth={3.5} />}
    </button>
  )
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEscape(onClose)
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}

/** Text that turns into an input when clicked. */
export function EditableText({
  value,
  onSave,
  className = '',
  placeholder = 'Untitled',
  label,
  readOnly = false,
}: {
  value: string
  onSave: (v: string) => void
  className?: string
  placeholder?: string
  label: string
  readOnly?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (readOnly) return value ? <span className={`editable-static ${className}`}>{value}</span> : null

  if (!editing) {
    return (
      <span
        className={`editable ${className} ${value ? '' : 'is-empty'}`}
        role="button"
        tabIndex={0}
        title="Click to edit"
        aria-label={`${label}: ${value || placeholder}. Click to edit.`}
        onClick={() => {
          setDraft(value)
          setEditing(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setDraft(value)
            setEditing(true)
          }
        }}
      >
        {value || placeholder}
      </span>
    )
  }

  const commit = () => {
    setEditing(false)
    const v = draft.trim()
    if (v !== value.trim()) onSave(v)
  }

  return (
    <input
      className={`editable-input ${className}`}
      autoFocus
      value={draft}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') setEditing(false)
      }}
    />
  )
}

/** Single-line "type and press Enter" input that stays focused for quick entry. */
export function QuickAdd({
  placeholder,
  onAdd,
  className = '',
}: {
  placeholder: string
  onAdd: (v: string) => void
  className?: string
}) {
  const [v, setV] = useState('')
  return (
    <form
      className={`quick-add ${className}`}
      onSubmit={(e) => {
        e.preventDefault()
        const t = v.trim()
        if (!t) return
        onAdd(t)
        setV('')
      }}
    >
      <span className="quick-plus" aria-hidden>
        +
      </span>
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {v.trim() && <kbd>Enter ↵</kbd>}
    </form>
  )
}

export function Empty({
  emoji,
  title,
  text,
  action,
}: {
  emoji: string
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty-emoji">{emoji}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}
