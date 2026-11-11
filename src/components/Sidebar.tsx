import { Briefcase, LayoutDashboard, LogOut, Map as MapIcon, NotebookPen, Search } from 'lucide-react'
import { useApp } from '../lib/context'
import { store } from '../lib/store'
import { progressOf } from '../lib/utils'
import { Avatar } from './ui'

const NAV = [
  { key: 'home', href: '#/', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'roadmaps', href: '#/roadmaps', label: 'Roadmaps', icon: MapIcon },
  { key: 'projects', href: '#/projects', label: 'Projects', icon: Briefcase },
  { key: 'journal', href: '#/journal', label: 'Journal', icon: NotebookPen },
]

const isMac = /Mac|iPhone|iPad/.test(navigator.platform)

export function Sidebar({
  page,
  activeRoadmap,
  onSignOut,
}: {
  page: string
  activeRoadmap: string | null
  onSignOut: () => void
}) {
  const { user, roadmaps, projects, openSearch } = useApp()

  return (
    <aside className="sidebar">
      <a className="brand" href="#/">
        <span className="logo-mark" />
        Pathway
      </a>

      <button className="search-trigger" onClick={openSearch}>
        <Search size={16} />
        <span>Search</span>
        <kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>

      <nav className="nav" aria-label="Main">
        {NAV.map((n) => (
          <a key={n.key} href={n.href} className={page === n.key ? 'active' : ''} aria-current={page === n.key ? 'page' : undefined}>
            <n.icon size={18} />
            <span>{n.label}</span>
          </a>
        ))}
      </nav>

      {roadmaps.length > 0 && (
        <div className="side-roadmaps">
          <div className="side-label">Roadmaps</div>
          {roadmaps.slice(0, 6).map((r) => (
            <a key={r.id} href={`#/r/${r.id}`} className={activeRoadmap === r.id ? 'active' : ''}>
              <span className="side-emoji">{r.emoji}</span>
              <span className="side-title">{r.title}</span>
              <span className="side-pct">{progressOf(r, user.uid).pct}%</span>
            </a>
          ))}
        </div>
      )}

      {projects.length > 0 && (
        <div className="side-roadmaps">
          <div className="side-label">Projects</div>
          {projects.slice(0, 5).map((p) => (
            <a key={p.id} href={`#/p/${p.id}`} className={location.hash.startsWith(`#/p/${p.id}`) ? 'active' : ''}>
              <span className="side-emoji">{p.emoji}</span>
              <span className="side-title">{p.name}</span>
            </a>
          ))}
        </div>
      )}

      <div className="side-foot">
        {store.mode === 'local' && <div className="demo-pill">Demo mode · saved in this browser</div>}
        <div className="me">
          <Avatar name={user.name} photo={user.photo} size={34} />
          <div className="me-text">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button className="icon-btn search-mobile" onClick={openSearch} aria-label="Search" title="Search">
            <Search size={17} />
          </button>
          <button className="icon-btn" onClick={onSignOut} aria-label="Sign out" title="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  )
}
