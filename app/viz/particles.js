'use strict'
// Local attraction and repulsion form colored cells and flowing filaments.
// Inspired by Fluoddity's emergent particles, with an independent simulation.
;(function (root) {
  const COLORS = ['#ff557d', '#ffb44f', '#dbf56b', '#56e6b2', '#62bafa', '#c181ff']
  const RANGE = 0.105
  const wrap = (x, n) => ((x % n) + n) % n
  const delta = (x, n) => x - Math.round(x / n) * n

  function world (aspect, filaments, random = Math.random, count = 1200) {
    const p = Array.from({ length: count }, (_, i) => ({ x: random() * aspect, y: random(), vx: 0, vy: 0, kind: i % COLORS.length }))
    let clock = 0
    let pulse = 0
    let pointer = null
    const ax = new Float32Array(count)
    const ay = new Float32Array(count)
    const next = new Int32Array(count)
    const nx = Math.max(3, Math.floor(aspect / RANGE))
    const ny = Math.floor(1 / RANGE)
    const heads = new Int32Array(nx * ny)

    function step (dt, energy) {
      const h = Math.min(1 / 60, Math.max(0, dt))
      clock += h
      pulse *= Math.exp(-h / 2)
      heads.fill(-1)
      for (let i = 0; i < count; i++) {
        const a = p[i]
        const cell = Math.min(ny - 1, Math.floor(a.y * ny)) * nx + Math.min(nx - 1, Math.floor(a.x / aspect * nx))
        next[i] = heads[cell]
        heads[cell] = i
      }
      for (let i = 0; i < count; i++) {
        const a = p[i]
        const cx = Math.floor(a.x / aspect * nx)
        const cy = Math.floor(a.y * ny)
        let fx = 0
        let fy = 0
        for (let sy = -1; sy <= 1; sy++) {
          for (let sx = -1; sx <= 1; sx++) {
            let j = heads[wrap(cy + sy, ny) * nx + wrap(cx + sx, nx)]
            while (j !== -1) {
              if (i !== j) {
                const b = p[j]
                const x = delta(b.x - a.x, aspect)
                const y = delta(b.y - a.y, 1)
                const d2 = x * x + y * y
                if (d2 > 1e-12 && d2 < RANGE * RANGE) {
                  const d = Math.sqrt(d2)
                  const r = d / RANGE
                  const diff = wrap(b.kind - a.kind, COLORS.length)
                  const attraction = diff === 0 ? 0.32 : diff === 1 ? 0.21 : diff === 5 ? -0.08 : -0.16
                  const f = r < 0.22 ? (r / 0.22 - 1) * 2.4 : attraction * (1 - Math.abs(2 * (r - 0.22) / 0.78 - 1))
                  fx += f * x / d
                  fy += f * y / d
                  if (filaments && diff === 0) {
                    fx += 0.7 * (b.vx - a.vx)
                    fy += 0.7 * (b.vy - a.vy)
                  }
                }
              }
              j = next[j]
            }
          }
        }
        if (filaments) {
          // A slowly changing incompressible flow carries the strands.
          const t = clock * 0.12
          const x = a.x / aspect * Math.PI * 4
          const y = a.y * Math.PI * 4
          fx += 0.6 * Math.sin(y + t) * Math.cos(x - t * 0.7)
          fy -= 0.6 * Math.cos(y + t) * Math.sin(x - t * 0.7) / aspect
        }
        if (pointer) {
          const x = delta(a.x - pointer.x, aspect)
          const y = delta(a.y - pointer.y, 1)
          const d = Math.hypot(x, y)
          if (d > 1e-5 && d < 0.22) {
            const f = (1 - d / 0.22) * 5
            fx += f * x / d
            fy += f * y / d
          }
        }
        ax[i] = fx
        ay[i] = fy
      }
      const drive = 0.35 + 0.65 * energy + 0.3 * pulse
      const damp = Math.exp(-h * 7)
      for (let i = 0; i < count; i++) {
        const a = p[i]
        a.vx = (a.vx + ax[i] * h * drive) * damp
        a.vy = (a.vy + ay[i] * h * drive) * damp
        const speed = Math.hypot(a.vx, a.vy)
        if (speed > 0.35) {
          a.vx *= 0.35 / speed
          a.vy *= 0.35 / speed
        }
        a.x = wrap(a.x + a.vx * h, aspect)
        a.y = wrap(a.y + a.vy * h, 1)
      }
    }
    return { p, step, excite () { pulse = Math.min(2, pulse + 0.5) }, point (x, y) { pointer = x === null ? null : { x, y } } }
  }

  function create (canvas, env, filaments = false) {
    const g = canvas.getContext('2d')
    let sim = null
    let width = 0
    let height = 0
    let activity = 0
    const mark = {}
    return {
      draw (synth, dt) {
        const w = canvas.width
        const h = canvas.height
        if (w < 4 || h < 4) return
        if (w !== width || h !== height) {
          width = w
          height = h
          sim = world(w / h, filaments)
          g.fillStyle = '#05070f'
          g.fillRect(0, 0, w, h)
        }
        for (const e of synth.since(mark)) if (e.kind !== 1) sim.excite()
        const level = synth.level
        const target = Math.min(1, 0.7 * level.bass + 0.3 * level.busy)
        activity += (target - activity) * (1 - Math.exp(-dt * 2))
        let left = Math.min(0.1, dt)
        while (left > 0) {
          const step = Math.min(left, 1 / 60)
          sim.step(step, activity)
          left -= step
        }
        g.globalCompositeOperation = 'source-over'
        g.fillStyle = `rgba(5, 7, 15, ${1 - Math.exp(-dt * (filaments ? 2.5 : 7))})`
        g.fillRect(0, 0, w, h)
        g.globalCompositeOperation = 'lighter'
        const r = Math.max(0.8, h / 500)
        for (let kind = 0; kind < COLORS.length; kind++) {
          g.fillStyle = COLORS[kind]
          g.globalAlpha = 0.12
          g.beginPath()
          for (const p of sim.p) if (p.kind === kind) {
            g.moveTo(p.x * h + 3 * r, p.y * h)
            g.arc(p.x * h, p.y * h, 3 * r, 0, Math.PI * 2)
          }
          g.fill()
          g.globalAlpha = 0.85
          g.beginPath()
          for (const p of sim.p) if (p.kind === kind) {
            g.moveTo(p.x * h + r, p.y * h)
            g.arc(p.x * h, p.y * h, r, 0, Math.PI * 2)
          }
          g.fill()
        }
        g.globalAlpha = 1
        g.globalCompositeOperation = 'source-over'
      },
      pointer (kind, x, y, down) {
        if (!sim) return
        if (kind === 'up' || !down) sim.point(null)
        else sim.point(x / height, y / height)
      }
    }
  }

  if (typeof module === 'object' && module.exports) module.exports = { world, create }
  else {
    const modes = root.VizCanvas = root.VizCanvas || {}
    modes.chromatic = (canvas, env) => create(canvas, env, false)
    modes.filaments = (canvas, env) => create(canvas, env, true)
  }
})(this)
