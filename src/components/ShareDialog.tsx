import { useState } from 'react'
import { useApp } from '../lib/context'
import { Avatar, Modal } from './ui'

/** Pick which registered people can see a roadmap or project. */
export function ShareDialog({
  what,
  can,
  sharedWith,
  onSave,
  onClose,
}: {
  /** e.g. "roadmap" */
  what: string
  /** one sentence on what a shared person is allowed to do */
  can: string
  sharedWith: string[]
  onSave: (uids: string[]) => void
  onClose: () => void
}) {
  const { user, members } = useApp()
  const [picked, setPicked] = useState<string[]>(sharedWith)
  const others = members.filter((m) => m.uid !== user.uid)

  const toggle = (uid: string) => setPicked((p) => (p.includes(uid) ? p.filter((x) => x !== uid) : [...p, uid]))

  return (
    <Modal title={`Share ${what}`} onClose={onClose}>
      <div className="form">
        <p className="muted">
          Only you and the people you tick can see this {what}. {can}
        </p>
        {others.length === 0 ? (
          <p className="share-empty">
            Nobody else has signed in yet. People appear here after their first sign-in to Pathway — you can only share with registered users.
          </p>
        ) : (
          <div className="share-list">
            {others.map((m) => (
              <label key={m.uid} className={`share-row ${picked.includes(m.uid) ? 'on' : ''}`}>
                <input type="checkbox" checked={picked.includes(m.uid)} onChange={() => toggle(m.uid)} />
                <Avatar name={m.name} photo={m.photo} size={34} />
                <span className="row-text">
                  <strong>{m.name}</strong>
                  <span className="muted">{m.email}</span>
                </span>
              </label>
            ))}
          </div>
        )}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={others.length === 0}
            onClick={() => {
              // keep only people that still exist
              onSave(picked.filter((id) => others.some((m) => m.uid === id)))
              onClose()
            }}
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  )
}
