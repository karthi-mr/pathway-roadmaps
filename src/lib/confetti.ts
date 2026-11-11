/** A short confetti burst — used when a milestone is completed. */
export function burst(colors: string[] = ['#8b5cf6', '#22d3ee', '#34d399', '#fbbf24', '#f43f5e']) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const canvas = document.createElement('canvas')
  const dpr = window.devicePixelRatio || 1
  canvas.width = innerWidth * dpr
  canvas.height = innerHeight * dpr
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:999'
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  const parts = Array.from({ length: 110 }, () => {
    const angle = Math.random() * Math.PI * 2
    const speed = 5 + Math.random() * 9
    return {
      x: innerWidth / 2,
      y: innerHeight * 0.38,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 5,
      size: 5 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
    }
  })

  const start = performance.now()
  const duration = 1600
  const frame = (now: number) => {
    const t = (now - start) / duration
    ctx.clearRect(0, 0, innerWidth, innerHeight)
    for (const p of parts) {
      p.vy += 0.28
      p.vx *= 0.985
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      ctx.save()
      ctx.globalAlpha = Math.max(0, 1 - t * t)
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      ctx.restore()
    }
    if (t < 1) requestAnimationFrame(frame)
    else canvas.remove()
  }
  requestAnimationFrame(frame)
}
