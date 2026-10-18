'use strict'
// Gravity mode (decision 0015): bodies under Newtonian attraction, G = 1,
// softened at short range, stepped by leapfrog in the frame of their
// centre of mass, so the view never drifts. Bodies that touch merge,
// keeping mass and momentum. Dust is massless and only falls. The rates
// set the time step: the bass and the busy level speed the clock, an
// idle spell slows it nearly to a stop. Each event adds mass or bodies:
// a tool call a planet on a near circular orbit in its class's colour, a
// prompt a comet that slings past the star, a stop a flare that adds to
// the star's mass, a subagent a second star, a compaction drags every
// body inward, and an output event a puff of dust. The pointer throws a
// moon: a click drops one on a circular orbit, a drag flings it from the
// press with the drag's velocity, its aim drawn while pressed. The
// bodies radiate gravitational waves (waves.js), drawn in the plane at a
// wave speed of C, which drives the waves alone, not the dynamics: the
// seed's pair of stars in close orbit spins a two-armed spiral of h_+.

;(function (root) {
  const CLASS_HUE = [200, 120, 40, 0, 280, 320]
  const SOFT = 9
  const H = 0.25
  const MAX_BODIES = 28
  const MAX_DUST = 360
  // The view's half size, in simulation units.
  const VIEW = 240
  const W = typeof module === 'object' && module.exports ? require('./waves') : root.VizWaves
  // The waves' speed: a front crosses the view of 480 in 42 units of
  // time, 1 to 4 s at the clock's usual rates.
  const C = 11.5
  // The seed's tight pair: two stars of PAIR_M at PAIR_SEP, PAIR_R from
  // the star.
  const PAIR_M = 64
  const PAIR_SEP = 22
  const PAIR_R = 170

  // One leapfrog step of h for bodies { x, y, vx, vy, m, r }, then
  // mergers. Returns the points where bodies merged.
  function step (bodies, h) {
    accel(bodies)
    for (const b of bodies) {
      b.vx += b.ax * h / 2
      b.vy += b.ay * h / 2
      b.x += b.vx * h
      b.y += b.vy * h
    }
    accel(bodies)
    for (const b of bodies) {
      b.vx += b.ax * h / 2
      b.vy += b.ay * h / 2
    }
    const merged = []
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i]
        const b = bodies[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        if (dx * dx + dy * dy > (a.r + b.r) * (a.r + b.r)) continue
        const m = a.m + b.m
        const big = a.m >= b.m ? a : b
        a.x = (a.x * a.m + b.x * b.m) / m
        a.y = (a.y * a.m + b.y * b.m) / m
        a.vx = (a.vx * a.m + b.vx * b.m) / m
        a.vy = (a.vy * a.m + b.vy * b.m) / m
        a.hue = big.hue
        a.star = a.star || b.star
        a.m = m
        a.r = radius(m, a.star)
        bodies.splice(j, 1)
        merged.push({ x: a.x, y: a.y, m: Math.min(a.m, b.m) })
        j--
      }
    }
    return merged
  }

  function accel (bodies) {
    for (const a of bodies) {
      a.ax = 0
      a.ay = 0
    }
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i]
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d2 = dx * dx + dy * dy + SOFT
        const f = 1 / (d2 * Math.sqrt(d2))
        a.ax += dx * f * b.m
        a.ay += dy * f * b.m
        b.ax -= dx * f * a.m
        b.ay -= dy * f * a.m
      }
    }
  }

  function radius (m, star) {
    return star ? 4 + 1.1 * Math.cbrt(m) : 1.2 + 1.3 * Math.cbrt(m)
  }

  // Total momentum to zero and the centre of mass to the origin. Returns
  // the shift.
  function centre (bodies) {
    let m = 0
    let px = 0
    let py = 0
    let x = 0
    let y = 0
    for (const b of bodies) {
      m += b.m
      px += b.m * b.vx
      py += b.m * b.vy
      x += b.m * b.x
      y += b.m * b.y
    }
    if (!m) return [0, 0, 0]
    for (const b of bodies) {
      b.vx -= px / m
      b.vy -= py / m
      b.x -= x / m
      b.y -= y / m
    }
    return [-x / m, -y / m, 0]
  }

  // env.text(): the visualization text size, a factor (decision 0036).
  function create (canvas, env) {
    // Drawn on a canvas of the CPU, then blitted to the pane: under
    // swiftshader the pane's canvas rasterizes paths and gradients in
    // software GL, several times slower.
    const out = canvas.getContext('2d')
    const layer = document.createElement('canvas')
    const g = layer.getContext('2d', { willReadFrequently: true })
    // The trails, kept from frame to frame, under the frame's bodies.
    const trails = document.createElement('canvas')
    const tg = trails.getContext('2d', { willReadFrequently: true })
    const mark = {}
    let bodies = []
    let dust = []
    let flares = []
    let clock = 0
    let cw = 0
    let ch = 0
    // The view as last drawn, the pointer's press and its last point
    // while pressed, and the moons thrown.
    let view = null
    let aim = null
    let thrown = 0
    // The waves, their grid of cells and the pair the probe watches.
    const field = new W.Field(C)
    const watch = new W.Watch(field, false)
    const grid = document.createElement('canvas')
    const gg = grid.getContext('2d', { willReadFrequently: true })
    let img = null
    let hs = null
    let vs = null
    const hv = [0, 0]

    function body (x, y, vx, vy, m, hue, star) {
      const b = { x, y, vx, vy, m, hue, star: !!star, r: radius(m, star), ax: 0, ay: 0 }
      bodies.push(b)
      return b
    }

    // The heaviest body, and the speed of a circular orbit about it at
    // distance r.
    function sun () {
      return bodies.reduce((s, b) => !s || b.m > s.m ? b : s, null)
    }

    function planet (hue, m) {
      const s = sun()
      const r = 50 + Math.random() * 160
      const a = Math.random() * Math.PI * 2
      const v = Math.sqrt(s.m / r) * (0.85 + Math.random() * 0.3) * (Math.random() < 0.15 ? -1 : 1)
      body(s.x + r * Math.cos(a), s.y + r * Math.sin(a), s.vx - v * Math.sin(a), s.vy + v * Math.cos(a), m, hue)
    }

    // The star, a planet, and a pair of stars in close orbit about each
    // other farther out, which radiates.
    function seed () {
      bodies = []
      dust = []
      field.reset()
      body(0, 0, 0, 0, 900, 48, true)
      body(60, 0, 0, Math.sqrt(900 / 60), 2 + Math.random() * 3, 200)
      const a = Math.random() * Math.PI * 2
      const V = Math.sqrt((900 + 2 * PAIR_M) / PAIR_R)
      // The pair's circular speed, softened.
      const v = Math.sqrt(2 * PAIR_M * PAIR_SEP * PAIR_SEP / (PAIR_SEP * PAIR_SEP + SOFT) ** 1.5) / 2
      const [c, si] = [Math.cos(a), Math.sin(a)]
      for (const [k, hue] of [[1, 15], [-1, 30]]) {
        body(PAIR_R * c + k * PAIR_SEP / 2 * c, PAIR_R * si + k * PAIR_SEP / 2 * si, -(V + k * v) * si, (V + k * v) * c, PAIR_M, hue, true)
      }
      // A belt of dust between the inner planets.
      for (let k = 0; k < 160; k++) {
        const r = 90 + Math.random() * 35
        const a = Math.random() * Math.PI * 2
        const v = Math.sqrt(900 / r)
        dust.push({ x: r * Math.cos(a), y: r * Math.sin(a), vx: -v * Math.sin(a), vy: v * Math.cos(a), hue: 40 })
      }
      centre(bodies)
    }

    function react (e) {
      const s = sun()
      if (e.kind === 2) {
        planet(CLASS_HUE[e.cls] ?? 200, 1 + Math.random() * 6)
      } else if (e.kind === 3) {
        // From the edge, aimed to pass close by the star.
        const a = Math.random() * Math.PI * 2
        const r = VIEW * 1.3
        const miss = (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 40)
        const v = Math.sqrt(2 * s.m / r) * 1.05
        const b = body(s.x + r * Math.cos(a), s.y + r * Math.sin(a), 0, 0, 0.5, 190)
        const dx = s.x - b.x
        const dy = s.y - b.y
        const d = Math.hypot(dx, dy)
        b.vx = s.vx + v * (dx / d - miss / d * dy / d)
        b.vy = s.vy + v * (dy / d + miss / d * dx / d)
        b.comet = true
        // The star announces the comet with a ring, before it arrives.
        flares.push({ x: s.x, y: s.y, t: clock, r: s.r })
      } else if (e.kind === 4) {
        s.m *= 1.12
        s.r = radius(s.m, s.star)
        flares.push({ x: s.x, y: s.y, t: clock, r: s.r })
      } else if (e.kind === 5) {
        if (bodies.filter(b => b.star).length < 5) {
          const a = Math.random() * Math.PI * 2
          const r = 150 + Math.random() * 60
          const m = 150 + Math.random() * 200
          const v = Math.sqrt(s.m / r) * 0.9
          body(s.x + r * Math.cos(a), s.y + r * Math.sin(a), s.vx - v * Math.sin(a), s.vy + v * Math.cos(a), m, 15, true)
        } else planet(300, 8)
      } else if (e.kind === 6) {
        for (const b of bodies) {
          b.vx *= 0.6
          b.vy *= 0.6
        }
      } else {
        const p = bodies[Math.floor(Math.random() * bodies.length)]
        for (let k = 0; k < 14; k++) {
          const a = k / 14 * Math.PI * 2
          const v = 0.3 + Math.random() * 0.5
          dust.push({ x: p.x + (p.r + 3) * Math.cos(a), y: p.y + (p.r + 3) * Math.sin(a), vx: p.vx + v * Math.cos(a), vy: p.vy + v * Math.sin(a), hue: p.hue })
        }
      }
      trim()
    }

    // The lightest planets past the cap gone, the oldest dust past its
    // cap, the frame recentred.
    function trim () {
      while (bodies.length > MAX_BODIES) bodies.splice(bodies.indexOf(bodies.filter(b => !b.star).reduce((a, b) => a.m < b.m ? a : b)), 1)
      if (dust.length > MAX_DUST) dust.splice(0, dust.length - MAX_DUST)
      recentre()
    }

    // The bodies recentred, the waves' places moved with them.
    function recentre () {
      const [dx, dy] = centre(bodies)
      field.shift(dx, dy, 0)
    }

    // Dust falls in the bodies' field, stepped as they are.
    function fall (h) {
      for (const d of dust) {
        let ax = 0
        let ay = 0
        for (const b of bodies) {
          const dx = b.x - d.x
          const dy = b.y - d.y
          const d2 = dx * dx + dy * dy + SOFT
          const f = b.m / (d2 * Math.sqrt(d2))
          ax += dx * f
          ay += dy * f
        }
        d.vx += ax * h
        d.vy += ay * h
        d.x += d.vx * h
        d.y += d.vy * h
      }
    }

    // The waves on a grid of cells, 32 across the pane's shorter side and
    // 8 px at least, blurred up to the pane: at each, the sum over
    // sources of h_+ in the plane, the only polarization there, as
    // shown (waves.js), + in a cool tint and - in a warm one, opaque over
    // black: the frame's ground, the trails added over it.
    function drawWaves (w, h, s, cx, cy, dim) {
      const cell = Math.max(8, Math.round(Math.min(w, h) / 32))
      const gw = Math.ceil(w / cell) + 1
      const gh = Math.ceil(h / cell) + 1
      if (grid.width !== gw || grid.height !== gh || !img) {
        grid.width = gw
        grid.height = gh
        img = gg.createImageData(gw, gh)
        hs = new Float32Array(gw * gh)
        vs = new Float32Array(gw * gh)
      }
      const px = img.data
      const traces = [...field.traces.values()]
      const k = 0.4 * dim
      // A cell and a half's light time.
      const blur = 1.5 * cell / s / C
      for (let j = 0; j < gh; j++) {
        const y = (j * cell - cy) / s
        for (let i = 0; i < gw; i++) {
          const x = (i * cell - cx) / s
          let hp = 0
          for (const tr of traces) if (field.wave(tr, clock, x, y, 0, hv, null, blur)) hp += hv[0]
          hs[j * gw + i] = hp
        }
      }
      W.shown(hs, gw, gh, vs)
      for (let j = 0; j < gh; j++) {
        for (let i = 0; i < gw; i++) {
          const v = vs[j * gw + i] * k
          const o = 4 * (j * gw + i)
          if (v >= 0) {
            px[o] = 60 * v
            px[o + 1] = 150 * v
            px[o + 2] = 255 * v
          } else {
            px[o] = -255 * v
            px[o + 1] = -150 * v
            px[o + 2] = -60 * v
          }
          px[o + 3] = 255
        }
      }
      gg.putImageData(img, 0, 0)
      g.imageSmoothingEnabled = true
      g.drawImage(grid, 0, 0, gw, gh, -cell / 2, -cell / 2, gw * cell, gh * cell)
    }

    seed()
    return {
      draw (synth, dt) {
        const w = canvas.width
        const h = canvas.height
        if (w < 4 || h < 4) return
        if (w !== cw || h !== ch) {
          cw = w
          ch = h
          layer.width = trails.width = w
          layer.height = trails.height = h
          tg.fillStyle = '#000'
          tg.fillRect(0, 0, w, h)
        }
        for (const e of synth.since(mark)) react(e)
        const L = synth.level
        // Simulation time per second: the clock.
        const speed = (6 + 30 * Math.min(1, L.bass) + 14 * L.busy + 10 * L.treble) * (1 - 0.9 * L.idle)
        let left = Math.min(speed * dt, 60 * H)
        const bursts = []
        while (left > 0) {
          const hh = Math.min(H, left)
          for (const m of step(bodies, hh)) bursts.push(m)
          fall(hh)
          left -= hh
          clock += hh
          // After the step: a body merged in it carries its last
          // acceleration for one sample, and the pair's end leaves as a
          // front.
          watch.sample(clock, field.sample(clock, bodies))
        }
        if (bursts.length) recentre()
        for (const m of bursts) flares.push({ x: m.x, y: m.y, t: clock, r: 6 + 2 * Math.cbrt(m.m) })
        bodies = bodies.filter(b => b.star || Math.hypot(b.x, b.y) < VIEW * 4)
        dust = dust.filter(d => Math.hypot(d.x, d.y) < VIEW * 2 && bodies.every(b => (b.x - d.x) ** 2 + (b.y - d.y) ** 2 > b.r * b.r))
        if (bodies.length < 2) seed()

        const s = Math.min(w, h) / (2 * VIEW)
        const cx = w / 2
        const cy = h / 2
        view = { s, cx, cy }
        // Trails: long while busy, gone while idle, when time all but
        // stops. They fade by 0.04 to 0.2 each 1/60 s.
        tg.fillStyle = `rgba(0, 0, 0, ${1 - Math.pow(1 - (0.04 + 0.16 * L.idle), 60 * dt)})`
        tg.fillRect(0, 0, w, h)
        const dim = 1 - 0.45 * L.idle
        for (const d of dust) {
          tg.fillStyle = `hsla(${d.hue}, 70%, 75%, ${0.8 * dim})`
          tg.fillRect(cx + d.x * s, cy + d.y * s, 1.5, 1.5)
        }
        tg.lineCap = 'round'
        for (const b of bodies) {
          const x = cx + b.x * s
          const y = cy + b.y * s
          if (b.sx !== undefined && !b.star) {
            tg.strokeStyle = `hsla(${b.hue}, ${b.comet ? 40 : 85}%, ${b.comet ? 80 : 60}%, ${0.9 * dim})`
            tg.lineWidth = Math.max(1, Math.min(3, b.r * s * 0.8))
            tg.beginPath()
            tg.moveTo(b.sx, b.sy)
            tg.lineTo(x, y)
            tg.stroke()
          }
          b.sx = x
          b.sy = y
        }
        // The waves under the trails, which are added over them.
        drawWaves(w, h, s, cx, cy, dim)
        g.globalCompositeOperation = 'lighter'
        g.drawImage(trails, 0, 0)
        g.globalCompositeOperation = 'source-over'

        // The bodies and the flares over the trails.
        for (const b of bodies) {
          const r = Math.max(2, b.r * s * (b.star ? 1 : 1.4))
          if (b.star) {
            const glow = g.createRadialGradient(b.sx, b.sy, r * 0.3, b.sx, b.sy, r * 3.2)
            glow.addColorStop(0, `hsla(${b.hue}, 100%, 85%, ${dim})`)
            glow.addColorStop(0.35, `hsla(${b.hue}, 100%, 60%, ${0.35 * dim})`)
            glow.addColorStop(1, `hsla(${b.hue}, 100%, 50%, 0)`)
            g.fillStyle = glow
            g.fillRect(b.sx - r * 3.2, b.sy - r * 3.2, r * 6.4, r * 6.4)
          }
          g.fillStyle = b.star ? `hsl(${b.hue}, 100%, ${90 * dim}%)` : `hsl(${b.hue}, ${b.comet ? 40 : 80}%, ${(b.comet ? 85 : 62) * dim}%)`
          g.beginPath()
          g.arc(b.sx, b.sy, r, 0, Math.PI * 2)
          g.fill()
        }
        flares = flares.filter(f => clock - f.t < 25)
        for (const f of flares) {
          const a = 1 - (clock - f.t) / 25
          g.strokeStyle = `rgba(255, 230, 170, ${a})`
          g.lineWidth = 2
          g.beginPath()
          g.arc(cx + f.x * s, cy + f.y * s, (f.r + (clock - f.t) * 3) * s, 0, Math.PI * 2)
          g.stroke()
        }
        if (aim) {
          g.strokeStyle = 'rgba(255, 255, 255, 0.7)'
          g.lineWidth = 1.5
          g.setLineDash([4, 4])
          g.beginPath()
          g.moveTo(aim.x0, aim.y0)
          g.lineTo(aim.x1, aim.y1)
          g.stroke()
          g.setLineDash([])
        }
        W.label(g, w, env && env.text ? env.text() : 1)
        out.drawImage(layer, 0, 0)
      },

      // A press marks the moon's place, the release throws it: on a
      // circular orbit about the heaviest body for a click, else with
      // a velocity in proportion to the drag.
      pointer (kind, x, y, down) {
        if (kind === 'down') aim = { x0: x, y0: y, x1: x, y1: y }
        else if (aim && down) Object.assign(aim, { x1: x, y1: y })
        if (kind !== 'up' || !aim || !view) return
        const { s, cx, cy } = view
        const px = (aim.x0 - cx) / s
        const py = (aim.y0 - cy) / s
        const dx = (aim.x1 - aim.x0) / s
        const dy = (aim.y1 - aim.y0) / s
        aim = null
        const sn = sun()
        let vx = sn.vx
        let vy = sn.vy
        if (Math.hypot(dx, dy) * s < 5) {
          const rx = px - sn.x
          const ry = py - sn.y
          const r = Math.max(sn.r + 4, Math.hypot(rx, ry))
          const v = Math.sqrt(sn.m / r)
          vx -= v * ry / r
          vy += v * rx / r
        } else {
          vx += dx * 0.02
          vy += dy * 0.02
        }
        body(px, py, vx, vy, 2 + Math.random() * 3, 55)
        thrown++
        trim()
      },

      // For the live checks: the bodies, the moons thrown, the waves'
      // sources and the pair watched (waves.js).
      probe () {
        return { thrown, bodies: bodies.length, sources: field.traces.size, pair: watch.report() }
      }
    }
  }

  if (typeof module === 'object' && module.exports) module.exports = { step, centre, quadrupole: W.quadrupole, C }
  else (root.VizCanvas = root.VizCanvas || {}).gravity = create
})(this)
