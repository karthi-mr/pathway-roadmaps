import { useState } from 'react'
import { BarChart3, Map as MapIcon, NotebookPen, Users } from 'lucide-react'
import { store } from '../lib/store'

const FEATURES = [
  { icon: MapIcon, title: 'Build roadmaps', text: 'Break any skill into milestones and topics.' },
  { icon: BarChart3, title: 'See your progress', text: 'Streaks, activity and completion at a glance.' },
  { icon: NotebookPen, title: 'Keep a learning journal', text: 'Log what you learned and how long you spent.' },
  { icon: Users, title: 'Learn together', text: 'Share roadmaps with your group, each at your own pace.' },
]

export function Login() {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const local = store.mode === 'local'

  const signIn = async () => {
    setBusy(true)
    setError(null)
    try {
      await store.signIn(name)
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError(
          code === 'auth/unauthorized-domain'
            ? 'This domain is not authorised for sign-in. Add it under Authentication → Settings → Authorized domains in the Firebase console.'
            : 'Sign-in failed. Please try again.',
        )
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-glow" aria-hidden />
      <section className="login-hero">
        <div className="brand">
          <span className="logo-mark" />
          Pathway
        </div>
        <h1>
          Plan what to learn.
          <br />
          <span className="grad-text">Watch yourself get there.</span>
        </h1>
        <ul className="feature-list">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <span className="feature-icon">
                <f.icon size={18} />
              </span>
              <div>
                <strong>{f.title}</strong>
                <span>{f.text}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="login-card">
        <h2>{local ? 'Try it out' : 'Welcome back'}</h2>
        {local ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              signIn()
            }}
          >
            <p className="muted">
              Demo mode — no Firebase project is connected yet, so everything you add is saved in this browser only.
            </p>
            <label className="field">
              <span>Your name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Karthi" autoFocus />
            </label>
            <button className="btn primary wide" disabled={busy}>
              Start learning
            </button>
          </form>
        ) : (
          <>
            <p className="muted">Sign in with the Google account your group invited.</p>
            <button className="btn google wide" onClick={signIn} disabled={busy}>
              <GoogleLogo />
              {busy ? 'Signing in…' : 'Continue with Google'}
            </button>
          </>
        )}
        {error && <p className="error">{error}</p>}
      </section>
    </div>
  )
}

export function NoAccess({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <div className="login single">
      <div className="login-glow" aria-hidden />
      <section className="login-card">
        <div className="empty-emoji">🔒</div>
        <h2>This account isn't on the list</h2>
        <p className="muted">
          <strong>{email}</strong> hasn't been given access to this workspace. Ask the owner to add this email to the
          allow-list in <code>firestore.rules</code>, or sign in with a different account.
        </p>
        <button className="btn primary wide" onClick={onSignOut}>
          Use a different account
        </button>
      </section>
    </div>
  )
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.7 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.500-4.800 7.200l7.700 6c4.500-4.200 6.900-10.300 6.900-17.700z" />
      <path fill="#FBBC05" d="M10.500 28.600c-.500-1.500-.800-3-.800-4.600s.3-3.100.8-4.600l-7.900-6.200C.9 16.500 0 20.100 0 24s.9 7.500 2.600 10.800l7.900-6.200z" />
      <path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.700-6c-2.200 1.500-4.900 2.300-8.200 2.300-6.300 0-11.600-4.200-13.500-9.900l-7.900 6.200C6.500 42.600 14.600 48 24 48z" />
    </svg>
  )
}
