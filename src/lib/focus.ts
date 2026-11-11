export interface Focus {
  roadmapId: string
  topicId: string
  title: string
  roadmapTitle: string
  /** planned length, ms */
  total: number
  /** time remaining when paused, ms */
  left: number
  /** when a running session ends; null while paused */
  endsAt: number | null
}

const KEY = 'pathway:focus'

/** Sessions survive a page reload. */
export const loadFocus = (): Focus | null => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Focus) : null
  } catch {
    return null
  }
}

export const saveFocus = (f: Focus | null) => {
  try {
    if (f) localStorage.setItem(KEY, JSON.stringify(f))
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Two soft tones when a session ends. Silently skipped if audio is blocked. */
export const chime = () => {
  try {
    const ctx = new AudioContext()
    ;[660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      const at = ctx.currentTime + i * 0.22
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5)
      osc.start(at)
      osc.stop(at + 0.55)
    })
    window.setTimeout(() => ctx.close(), 1500)
  } catch {
    /* ignore */
  }
}
