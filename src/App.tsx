import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { store } from './lib/store'
import type { Comment, LogEntry, Member, Project, Roadmap } from './lib/types'
import { AppContext } from './lib/context'
import type { FocusRequest } from './lib/context'
import { loadFocus, saveFocus } from './lib/focus'
import type { Focus } from './lib/focus'
import { dayKey, formatMinutes, newId } from './lib/utils'
import { Login, NoAccess } from './components/Login'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { RoadmapList } from './components/RoadmapList'
import { RoadmapView } from './components/RoadmapView'
import { Journal } from './components/Journal'
import { ProjectList } from './components/ProjectList'
import { ProjectView } from './components/ProjectView'
import { Search } from './components/Search'
import { FocusWidget } from './components/FocusWidget'

const useHash = () => {
  const [hash, setHash] = useState(() => location.hash.slice(1) || '/')
  useEffect(() => {
    const onChange = () => {
      setHash(location.hash.slice(1) || '/')
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

export default function App() {
  // undefined = still checking who is signed in
  const [authUser, setAuthUser] = useState<Member | null | undefined>(undefined)
  const [roadmaps, setRoadmaps] = useState<Roadmap[] | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [denied, setDenied] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [focus, setFocus] = useState<Focus | null>(loadFocus)
  const toastTimer = useRef<number | undefined>(undefined)
  const focusRef = useRef<Focus | null>(focus)
  const hash = useHash()

  // The theme follows the device's light/dark setting, live.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const apply = () => {
      document.documentElement.dataset.theme = mq.matches ? 'light' : 'dark'
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => store.onAuth(setAuthUser), [])

  const uid = authUser?.uid
  useEffect(() => {
    if (!uid) return
    const onError = (err: { code?: string }) => {
      if (err.code === 'permission-denied') setDenied(true)
    }
    const stop = [
      store.watchRoadmaps(uid, setRoadmaps, onError),
      store.watchLogs(setLogs, onError),
      store.watchMembers(setMembers, onError),
      // a problem loading projects must not lock the whole app
      store.watchProjects(uid, setProjects, () => {}),
    ]
    return () => stop.forEach((fn) => fn())
  }, [uid])

  // Comments are stored under each roadmap, so listen per visible roadmap.
  const roadmapIds = (roadmaps ?? [])
    .map((r) => r.id)
    .sort()
    .join(',')
  useEffect(() => {
    if (!uid || !roadmapIds) return
    const byRoadmap = new Map<string, Comment[]>()
    const stop = roadmapIds.split(',').map((id) =>
      store.watchComments(
        id,
        (list) => {
          byRoadmap.set(id, list)
          setComments([...byRoadmap.values()].flat().sort((a, b) => a.createdAt - b.createdAt))
        },
        () => {},
      ),
    )
    return () => stop.forEach((fn) => fn())
  }, [uid, roadmapIds])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearching(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const notify = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3200)
  }, [])

  const run = useCallback(
    (p: Promise<unknown>) => {
      p.catch((err: { code?: string }) =>
        notify(
          err?.code === 'permission-denied'
            ? "You don't have permission to do that."
            : 'Could not save — check your connection and try again.',
        ),
      )
    },
    [notify],
  )

  // Saved settings (weekly goals) live on the member profile.
  const user = useMemo(
    () => (authUser ? { ...authUser, ...members.find((m) => m.uid === authUser.uid) } : null),
    [authUser, members],
  )

  const changeFocus = useCallback((f: Focus | null) => {
    focusRef.current = f
    saveFocus(f)
    setFocus(f)
  }, [])

  const startFocus = useCallback(
    (f: FocusRequest) => {
      const total = f.minutes * 60000
      changeFocus({
        roadmapId: f.roadmapId,
        topicId: f.topicId,
        title: f.title,
        roadmapTitle: f.roadmapTitle,
        total,
        left: total,
        endsAt: Date.now() + total,
      })
    },
    [changeFocus],
  )

  /** End the session and write the time actually spent to the journal. */
  const finishFocus = useCallback(
    (left: number) => {
      const f = focusRef.current
      if (!f || !authUser) return
      changeFocus(null)
      const minutes = Math.max(1, Math.round((f.total - left) / 60000))
      run(
        store.addLog({
          id: newId(),
          userId: authUser.uid,
          userName: authUser.name,
          userPhoto: authUser.photo,
          text: `Focus session — ${f.title}`,
          minutes,
          roadmapId: f.roadmapId,
          roadmapTitle: f.roadmapTitle,
          date: dayKey(),
          createdAt: Date.now(),
        }),
      )
      notify(`Logged ${formatMinutes(minutes)} of focus to your journal`)
    },
    [authUser, changeFocus, notify, run],
  )

  const openSearch = useCallback(() => setSearching(true), [])

  const signOut = () => {
    setDenied(false)
    setRoadmaps(null)
    setLogs([])
    setMembers([])
    setComments([])
    setProjects([])
    store.signOut()
  }

  const focusing = focus?.topicId ?? null
  const ctx = useMemo(
    () =>
      user
        ? { user, roadmaps: roadmaps ?? [], projects, logs, members, comments, notify, run, focusing, startFocus, openSearch }
        : null,
    [user, roadmaps, projects, logs, members, comments, notify, run, focusing, startFocus, openSearch],
  )

  if (authUser === undefined) return <Splash />
  if (authUser === null || !ctx) return <Login />
  if (denied) return <NoAccess email={authUser.email} onSignOut={signOut} />
  if (roadmaps === null) return <Splash />

  const [path, query = ''] = hash.split('?')
  const roadmapId = path.startsWith('/r/') ? path.slice(3) : null
  const projectId = path.startsWith('/p/') ? path.slice(3) : null
  const params = new URLSearchParams(query)
  const topicParam = params.get('t')
  const page =
    roadmapId || path === '/roadmaps' ? 'roadmaps' : projectId || path === '/projects' ? 'projects' : path === '/journal' ? 'journal' : 'home'

  return (
    <AppContext.Provider value={ctx}>
      <div className="shell">
        <Sidebar page={page} activeRoadmap={roadmapId} onSignOut={signOut} />
        <main className="main">
          <div className="page" key={hash}>
            {roadmapId ? (
              <RoadmapView id={roadmapId} initialTopic={topicParam} />
            ) : projectId ? (
              <ProjectView id={projectId} initialIssue={params.get('i')} />
            ) : page === 'projects' ? (
              <ProjectList />
            ) : page === 'roadmaps' ? (
              <RoadmapList />
            ) : page === 'journal' ? (
              <Journal />
            ) : (
              <Dashboard />
            )}
          </div>
        </main>
        {focus && <FocusWidget focus={focus} onChange={changeFocus} onFinish={finishFocus} />}
        {searching && <Search onClose={() => setSearching(false)} />}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </div>
    </AppContext.Provider>
  )
}

function Splash() {
  return (
    <div className="splash">
      <div className="logo-mark big" />
    </div>
  )
}
