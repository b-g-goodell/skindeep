'use strict'
// Gravity 3D mode (decision 0015): the Gravity mode's bodies in three
// dimensions, seen through a perspective camera that turns about their
// centre of mass, with black holes. G = 1 and c = C, so a hole of mass M
// has its Schwarzschild radius r_s = 2 M / C^2. A hole pulls by the
// Paczynski-Wiita potential -M / (r - r_+), r_+ its horizon, which puts
// the last stable circular orbit at 3 r_s, and a spinning (Kerr) hole,
// of spin a = chi M / C^2, drags what moves near it by the Lense-Thirring
// acceleration v x B, B = (2 M a / (C r^3)) (j - 3 (j . n) n), j its axis
// and n the direction from it. What crosses a horizon is swallowed, its
// mass and angular momentum the hole's. Other pairs attract as in the
// Gravity mode, softened. Each hole is drawn as its shadow, ringed by its
// photon ring at sqrt(27) / 2 r_s, and bends the light of what lies
// behind it by the point-mass lens: the distant stars, and the dust, its
// disc's far side among it. The signal and the pointer: see react and
// pointer.

;(function (root) {
  const CLASS_HUE = [200, 120, 40, 0, 280, 320]
  const SOFT = 9
  const H = 0.25
  const MAX_BODIES = 28
  const MAX_DUST = 700
  const VIEW = 240
  // The speed of light: a hole of mass 900 has r_s 13.6, on screen.
  const C = 11.5
  const C2 = C * C
  // Spin at most this fraction of the extreme M / C^2, the horizon at
  // least 0.66 r_s.
  const CHI_MAX = 0.95
  const HOLE_MAX = 1500
  // A dust grain's mass, and the disc's viscosity: between 3 and DISC
  // r_s of a hole a grain's velocity relaxes at rate VISC toward a
  // circular orbit's, a little slower, so the disc's grains settle on
  // circles and spiral in, and plunge from the last stable orbit.
  const DUST_M = 0.004
  const VISC = 0.01
  const SLOW = 0.995
  const DISC = 10
  const RING = Math.sqrt(27) / 2

  const rs = m => 2 * m / C2
  // Math.hypot is several times slower.
  const len = (x, y, z = 0) => Math.sqrt(x * x + y * y + z * z)

  // The outer horizon of hole h: r_+ = M / C^2 + sqrt((M / C^2)^2 - a^2).
  function horizon (h) {
    const g = h.m / C2
    const a = (h.chi || 0) * g
    return g + Math.sqrt(g * g - a * a)
  }

  // The speed of a circular orbit at distance r about body s.
  function circular (s, r) {
    return s.hole ? Math.sqrt(s.m * r) / (r - horizon(s)) : Math.sqrt(s.m / r)
  }

  // The Lense-Thirring acceleration of what is at r from spinning hole h,
  // moving at v relative to it, into out.
  function drag (h, rx, ry, rz, vx, vy, vz, out) {
    const d2 = rx * rx + ry * ry + rz * rz
    const d = Math.sqrt(d2)
    const k = 2 * h.m * (h.chi * h.m / C2) / (C * d2 * d)
    const jn = (h.jx * rx + h.jy * ry + h.jz * rz) / d2
    const bx = k * (h.jx - 3 * jn * rx)
    const by = k * (h.jy - 3 * jn * ry)
    const bz = k * (h.jz - 3 * jn * rz)
    out[0] = vy * bz - vz * by
    out[1] = vz * bx - vx * bz
    out[2] = vx * by - vy * bx
  }

  const lt = [0, 0, 0]

  function accel (bodies) {
    for (const a of bodies) {
      a.ax = 0
      a.ay = 0
      a.az = 0
    }
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i]
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dz = b.z - a.z
        let f
        if (a.hole || b.hole) {
          // Paczynski-Wiita, about the larger horizon of the pair.
          const s = Math.max(a.hole ? horizon(a) : 0, b.hole ? horizon(b) : 0)
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
          const gap = Math.max(d - s, 0.02 * s)
          f = 1 / (gap * gap * d)
        } else {
          const d2 = dx * dx + dy * dy + dz * dz + SOFT
          f = 1 / (d2 * Math.sqrt(d2))
        }
        a.ax += dx * f * b.m
        a.ay += dy * f * b.m
        a.az += dz * f * b.m
        b.ax -= dx * f * a.m
        b.ay -= dy * f * a.m
        b.az -= dz * f * a.m
      }
    }
    for (const h of bodies) {
      if (!h.hole || !h.chi) continue
      for (const b of bodies) {
        if (b === h) continue
        drag(h, b.x - h.x, b.y - h.y, b.z - h.z, b.vx - h.vx, b.vy - h.vy, b.vz - h.vz, lt)
        b.ax += lt[0]
        b.ay += lt[1]
        b.az += lt[2]
        h.ax -= lt[0] * b.m / h.m
        h.ay -= lt[1] * b.m / h.m
        h.az -= lt[2] * b.m / h.m
      }
    }
  }

  function leap (bodies, h) {
    accel(bodies)
    for (const b of bodies) {
      b.vx += b.ax * h / 2
      b.vy += b.ay * h / 2
      b.vz += b.az * h / 2
      b.x += b.vx * h
      b.y += b.vy * h
      b.z += b.vz * h
    }
    accel(bodies)
    for (const b of bodies) {
      b.vx += b.ax * h / 2
      b.vy += b.ay * h / 2
      b.vz += b.az * h / 2
    }
  }

  // The longest safe substep: near a hole, a small part of the gap to
  // its horizon over the speed across it.
  function limit (bodies) {
    let hm = Infinity
    for (const h of bodies) {
      if (!h.hole) continue
      const s = horizon(h)
      for (const b of bodies) {
        if (b === h) continue
        const gap = Math.max(1e-6, len(b.x - h.x, b.y - h.y, b.z - h.z) - s - (b.hole ? horizon(b) : 0))
        const v = len(b.vx - h.vx, b.vy - h.vy, b.vz - h.vz)
        hm = Math.min(hm, 0.03 * gap / (v + 1e-9), 0.05 * gap * Math.sqrt(gap / h.m))
      }
    }
    return hm
  }

  // Hole h swallows b: mass, momentum and angular momentum kept, the
  // spin capped below the extreme.
  function absorb (h, b) {
    const m = h.m + b.m
    const mu = h.m * b.m / m
    const rx = b.x - h.x
    const ry = b.y - h.y
    const rz = b.z - h.z
    const vx = b.vx - h.vx
    const vy = b.vy - h.vy
    const vz = b.vz - h.vz
    const sh = (h.chi || 0) * h.m * h.m / C
    const sb = b.hole ? (b.chi || 0) * b.m * b.m / C : 0
    const jx = sh * h.jx + sb * (b.jx || 0) + mu * (ry * vz - rz * vy)
    const jy = sh * h.jy + sb * (b.jy || 0) + mu * (rz * vx - rx * vz)
    const jz = sh * h.jz + sb * (b.jz || 0) + mu * (rx * vy - ry * vx)
    const J = len(jx, jy, jz)
    h.x = (h.x * h.m + b.x * b.m) / m
    h.y = (h.y * h.m + b.y * b.m) / m
    h.z = (h.z * h.m + b.z * b.m) / m
    h.vx = (h.vx * h.m + b.vx * b.m) / m
    h.vy = (h.vy * h.m + b.vy * b.m) / m
    h.vz = (h.vz * h.m + b.vz * b.m) / m
    h.m = m
    if (J > 0) {
      h.chi = Math.min(CHI_MAX, J * C / (m * m))
      h.jx = jx / J
      h.jy = jy / J
      h.jz = jz / J
    }
    h.r = horizon(h)
  }

  // Swallowings, then mergers of bodies that touch, as in the Gravity
  // mode. Each is pushed to its list.
  function collide (bodies, merged, swallowed) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        let a = bodies[i]
        let b = bodies[j]
        const d = len(a.x - b.x, a.y - b.y, a.z - b.z)
        if (a.hole || b.hole) {
          if (b.hole && (!a.hole || b.m > a.m)) [a, b] = [b, a]
          if (d > horizon(a) + (b.hole ? horizon(b) : 0)) continue
          absorb(a, b)
          bodies[i] = a
          swallowed.push({ x: a.x, y: a.y, z: a.z, m: b.m, hole: a })
        } else {
          if (d > a.r + b.r) continue
          const m = a.m + b.m
          const big = a.m >= b.m ? a : b
          for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz']) a[k] = (a[k] * a.m + b[k] * b.m) / m
          a.hue = big.hue
          a.star = a.star || b.star
          a.comet = big.comet
          merged.push({ x: a.x, y: a.y, z: a.z, m: Math.min(a.m, b.m) })
          a.m = m
          a.r = radius(m, a.star)
        }
        bodies.splice(j, 1)
        j = i
      }
    }
  }

  // Step bodies { x, y, z, vx, vy, vz, m, r, hole, chi, jx, jy, jz } by
  // h, in leapfrog substeps short enough near a horizon. Returns the
  // mergers and the swallowings.
  function step (bodies, h) {
    const merged = []
    const swallowed = []
    let t = 0
    while (t < h) {
      const hs = Math.min(h - t, Math.max(h / 256, limit(bodies)))
      leap(bodies, hs)
      collide(bodies, merged, swallowed)
      t += hs
    }
    return { merged, swallowed }
  }

  function radius (m, star) {
    return star ? 4 + 1.1 * Math.cbrt(m) : 1.2 + 1.3 * Math.cbrt(m)
  }

  // Dust falls in the bodies' field and is dragged by spinning holes,
  // each grain in substeps short enough near a horizon. A grain that
  // crosses a horizon is swallowed, one inside another body joins it.
  // Returns the grains each hole swallowed, as a Map.
  function fall (dust, bodies, h) {
    const holes = bodies.filter(b => b.hole)
    const eaten = new Map()
    const r2 = holes.map(horizon)
    const disc = holes.map(b => DISC * rs(b.m))
    const isco = holes.map(b => 3 * rs(b.m))
    const hz = bodies.map(b => b.hole ? horizon(b) : 0)
    for (const d of dust) {
      let n = 1
      for (let i = 0; i < holes.length; i++) {
        const o = holes[i]
        const gap = Math.max(1e-3, len(d.x - o.x, d.y - o.y, d.z - o.z) - r2[i])
        const v = len(d.vx - o.vx, d.vy - o.vy, d.vz - o.vz)
        n = Math.max(n, Math.ceil(h * v / (0.08 * gap)))
      }
      n = Math.min(n, 12)
      const hs = h / n
      for (let k = 0; k < n && !d.gone; k++) {
        let ax = 0
        let ay = 0
        let az = 0
        for (let bi = 0; bi < bodies.length; bi++) {
          const b = bodies[bi]
          const dx = b.x - d.x
          const dy = b.y - d.y
          const dz = b.z - d.z
          let f
          if (b.hole) {
            const r = Math.sqrt(dx * dx + dy * dy + dz * dz)
            const gap = Math.max(r - hz[bi], 0.02 * hz[bi])
            f = b.m / (gap * gap * r)
          } else {
            const d2 = dx * dx + dy * dy + dz * dz + SOFT
            f = b.m / (d2 * Math.sqrt(d2))
          }
          ax += dx * f
          ay += dy * f
          az += dz * f
        }
        d.vx += ax * hs
        d.vy += ay * hs
        d.vz += az * hs
        for (let i = 0; i < holes.length; i++) {
          const o = holes[i]
          const rx = d.x - o.x
          const ry = d.y - o.y
          const rz = d.z - o.z
          if (o.chi) {
            drag(o, rx, ry, rz, d.vx - o.vx, d.vy - o.vy, d.vz - o.vz, lt)
            d.vx += lt[0] * hs
            d.vy += lt[1] * hs
            d.vz += lt[2] * hs
          }
          const r = Math.sqrt(rx * rx + ry * ry + rz * rz)
          if (r < disc[i] && r > isco[i]) {
            // The circular velocity in the plane of the grain's orbit.
            const vx = d.vx - o.vx
            const vy = d.vy - o.vy
            const vz = d.vz - o.vz
            const lx = ry * vz - rz * vy
            const ly = rz * vx - rx * vz
            const lz = rx * vy - ry * vx
            const tx = ly * rz - lz * ry
            const ty = lz * rx - lx * rz
            const tz = lx * ry - ly * rx
            const tl = len(tx, ty, tz)
            if (tl > 0) {
              const c = circular(o, r) * SLOW / tl
              const k = Math.min(1, VISC * hs)
              d.vx += (tx * c - vx) * k
              d.vy += (ty * c - vy) * k
              d.vz += (tz * c - vz) * k
            }
          }
        }
        d.x += d.vx * hs
        d.y += d.vy * hs
        d.z += d.vz * hs
        for (let i = 0; i < holes.length; i++) {
          const o = holes[i]
          if ((d.x - o.x) ** 2 + (d.y - o.y) ** 2 + (d.z - o.z) ** 2 > r2[i] * r2[i]) continue
          for (const key of ['vx', 'vy', 'vz']) o[key] = (o[key] * o.m + d[key] * DUST_M) / (o.m + DUST_M)
          o.m += DUST_M
          d.gone = true
          eaten.set(o, (eaten.get(o) || 0) + 1)
          break
        }
      }
    }
    return eaten
  }

  // Total momentum to zero and the centre of mass to the origin, the
  // dust and the trails moved with the bodies.
  function centre (bodies, dust = []) {
    let m = 0
    const p = [0, 0, 0]
    const q = [0, 0, 0]
    for (const b of bodies) {
      m += b.m
      p[0] += b.m * b.vx
      p[1] += b.m * b.vy
      p[2] += b.m * b.vz
      q[0] += b.m * b.x
      q[1] += b.m * b.y
      q[2] += b.m * b.z
    }
    if (!m) return
    for (const o of [...bodies, ...dust]) {
      o.vx -= p[0] / m
      o.vy -= p[1] / m
      o.vz -= p[2] / m
      o.x -= q[0] / m
      o.y -= q[1] / m
      o.z -= q[2] / m
      if (!o.trail) continue
      for (let i = 0; i < o.trail.length; i += 3) {
        o.trail[i] -= q[0] / m
        o.trail[i + 1] -= q[1] / m
        o.trail[i + 2] -= q[2] / m
      }
    }
  }

  // A seeded generator, so every pane shows the same sky.
  function rng (s) {
    return () => {
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  // Two unit vectors normal to unit n and to each other.
  function basis (n) {
    const a = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]
    const u = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]]
    const l = len(...u)
    u[0] /= l
    u[1] /= l
    u[2] /= l
    return [u, [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]]]
  }

  // The distant stars: directions only, so they turn with the camera and
  // show no parallax. Most lie anywhere, some in a band about a great
  // circle, a galaxy's disc seen from inside, its glow a haze of soft
  // dots brightest toward one point, and a few bright ones on the circle
  // the camera's line of sight through the centre sweeps at its first
  // pitch, so a hole there lines up with one now and then.
  function sky (pitch) {
    const r = rng(83)
    const gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r())
    const band = [0.35, -0.42, 0.84].map(v => v / len(0.35, -0.42, 0.84))
    const [e1, e2] = basis(band)
    const onBand = (t, lat) => e1.map((v, i) => Math.cos(lat) * (Math.cos(t) * v + Math.sin(t) * e2[i]) + Math.sin(lat) * band[i])
    const stars = []
    const hues = [210, 220, 230, 200, 40, 48, 15, 120, 280, 320]
    for (let k = 0; k < 3000; k++) {
      let n
      if (k < 2000) {
        const z = 2 * r() - 1
        const a = 2 * Math.PI * r()
        n = [Math.sqrt(1 - z * z) * Math.cos(a), Math.sqrt(1 - z * z) * Math.sin(a), z]
      } else n = onBand(2 * Math.PI * r(), 0.06 * gauss())
      const b = Math.pow(r(), 3)
      stars.push({ n, b: 0.2 + 0.8 * b, size: b > 0.6 ? 2 : b > 0.2 ? 1.5 : 1, hue: hues[Math.floor(r() * hues.length)], sat: 30 + 40 * r() })
    }
    for (let k = 0; k < 6; k++) {
      const a = 2 * Math.PI * (k + r() * 0.5) / 6
      const z = -Math.sin(pitch) + 0.01 * gauss()
      const c = Math.sqrt(1 - z * z)
      stars.push({ n: [-c * Math.cos(a), -c * Math.sin(a), z], b: 1, size: 2, hue: hues[k], sat: 60 })
    }
    const haze = []
    for (let k = 0; k < 120; k++) {
      const t = 2 * Math.PI * r()
      const core = Math.exp(-((Math.atan2(Math.sin(t - 1), Math.cos(t - 1))) ** 2) / 0.5)
      haze.push({ n: onBand(t, 0.035 * gauss()), a: 0.035 + 0.07 * core * r(), size: 0.05 + 0.05 * r(), warm: r() < 0.2 + 0.6 * core })
    }
    return { stars, haze }
  }

  // A sprite of a soft dot, white at its centre, in hue.
  function sprite (hue) {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    // On the CPU, as the layer it is drawn on: a sprite on the GPU is
    // read back at every draw.
    const g = c.getContext('2d', { willReadFrequently: true })
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, `hsla(${hue}, 60%, 75%, 1)`)
    grad.addColorStop(0.4, `hsla(${hue}, 60%, 55%, 0.35)`)
    grad.addColorStop(1, `hsla(${hue}, 60%, 40%, 0)`)
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    return c
  }

  // Heat from a fall: 0 far out, 1 at the last stable orbit and within.
  // The colour of a grain or a body as it heats: toward orange that
  // whitens, then a blue white.
  function hot (hue, sat, light, heat) {
    if (heat <= 0.02) return [hue, sat, light]
    if (heat < 0.7) {
      const t = heat / 0.7
      const dh = ((30 - hue + 540) % 360) - 180
      return [(hue + dh * Math.min(1, 2 * t) + 360) % 360, sat + (95 - sat) * t * (1 - t) * 2, light + (88 - light) * t]
    }
    const t = (heat - 0.7) / 0.3
    return [215, 70 * t, 88 + 8 * t]
  }

  function create (canvas) {
    // Drawn on a canvas of the CPU, then blitted to the pane, as the
    // Gravity mode is.
    const out = canvas.getContext('2d')
    const layer = document.createElement('canvas')
    const g = layer.getContext('2d', { willReadFrequently: true })
    const mark = {}
    const PITCH = 0.36
    const { stars, haze } = sky(PITCH)
    for (const s of stars) {
      s.fill = `hsl(${s.hue}, ${s.sat | 0}%, 85%)`
      s.arc = `hsl(${s.hue}, ${(s.sat + 20) | 0}%, 85%)`
    }
    const blue = sprite(228)
    const warm = sprite(32)
    const styles = new Map()
    let bodies = []
    let dust = []
    let flares = []
    let clock = 0
    let subs = 0
    let shed = 0
    // The camera: its turn about the vertical and its height, in
    // radians, and the time the pointer last turned it. The press while
    // the pointer is down, and the counts the probe reports.
    const cam = { yaw: 0.6, pitch: PITCH, held: -1e9 }
    let press = null
    let thrown = 0
    let turns = 0
    let swallowed = 0
    let arcs = 0
    // The pane's signal clock at the last frame.
    let tick = 0
    // The frame's projection: centre, focal length, camera distance and
    // basis (right, up, toward the camera).
    const V = { cx: 0, cy: 0, f: 1, D: 620, r: [1, 0, 0], u: [0, 1, 0], e: [0, 0, 1] }
    const P = { x: 0, y: 0, d: 0, k: 0 }

    function body (x, y, z, vx, vy, vz, m, hue, kind) {
      const b = { x, y, z, vx, vy, vz, m, hue, star: kind === 'star', hole: kind === 'hole', comet: kind === 'comet', chi: 0, jx: 0, jy: 0, jz: 1, r: 0, ax: 0, ay: 0, az: 0, trail: [], tt: clock, flash: 0, px: 0, py: 0, pd: 1, pk: 0, layer: 0, heat: 0 }
      b.r = b.hole ? horizon(b) : radius(m, b.star)
      bodies.push(b)
      return b
    }

    // Body m on a circular orbit about s at distance r, in the plane of
    // unit normal n, at angle a, retrograde if back.
    function orbit (s, r, n, a, m, hue, kind, back) {
      const [p, q] = basis(n)
      const c = Math.cos(a)
      const si = Math.sin(a)
      const v = circular(s, r) * (back ? -1 : 1)
      return body(s.x + r * (c * p[0] + si * q[0]), s.y + r * (c * p[1] + si * q[1]), s.z + r * (c * p[2] + si * q[2]),
        s.vx + v * (-si * p[0] + c * q[0]), s.vy + v * (-si * p[1] + c * q[1]), s.vz + v * (-si * p[2] + c * q[2]), m, hue, kind)
    }

    // A unit normal tilted from the vertical by up to t.
    function tilt (t) {
      const a = Math.random() * Math.PI * 2
      const i = (Math.random() * 2 - 1) * t
      return [Math.sin(i) * Math.cos(a), Math.sin(i) * Math.sin(a), Math.cos(i)]
    }

    function sun () {
      return bodies.reduce((s, b) => !s || b.m > s.m ? b : s, null)
    }

    // A grain, every one of the same shape, which keeps the loops over
    // them fast.
    function grain (o) {
      return Object.assign({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, hue: 0, disc: false, gone: false, px: 0, py: 0, pd: 1, pk: 0, layer: 0, mu: 1, inner: false, ix: 0, iy: 0, imu: 0, heat: 0, beam: 1 }, o)
    }

    // Grains on circular orbits about hole h, in its equator.
    function disc (h, n, r0, r1, hue) {
      const [p, q] = basis([h.jx, h.jy, h.jz])
      for (let k = 0; k < n; k++) {
        const r = r0 + (r1 - r0) * Math.random()
        const a = Math.random() * Math.PI * 2
        const v = circular(h, r)
        const c = Math.cos(a)
        const si = Math.sin(a)
        const w = (Math.random() - 0.5) * 0.02 * r
        const at = [0, 1, 2].map(i => r * (c * p[i] + si * q[i]) + w * [h.jx, h.jy, h.jz][i])
        const vel = [0, 1, 2].map(i => v * (-si * p[i] + c * q[i]))
        dust.push(grain({ x: h.x + at[0], y: h.y + at[1], z: h.z + at[2], vx: h.vx + vel[0], vy: h.vy + vel[1], vz: h.vz + vel[2], hue, disc: true }))
      }
    }

    // A spinning hole at the centre with its disc, a companion star that
    // feeds it, and three planets.
    function seed () {
      bodies = []
      dust = []
      const h = body(0, 0, 0, 0, 0, 0, 900, 0, 'hole')
      const n = tilt(0.12)
      Object.assign(h, { chi: 0.7, jx: n[0], jy: n[1], jz: n[2] })
      h.r = horizon(h)
      const s = rs(h.m)
      disc(h, 420, 3.3 * s, 8 * s, 30)
      orbit(h, 175, tilt(0.35), Math.random() * 6.3, 80, 48, 'star')
      for (const [r, hue] of [[128, 200], [215, 120], [245, 30]]) orbit(h, r, tilt(0.3), Math.random() * 6.3, 2 + Math.random() * 3, hue)
      centre(bodies, dust)
    }

    function planet (hue, m) {
      const s = sun()
      // Clear of a hole's disc.
      const r = s.hole ? Math.min(VIEW, (DISC + 1) * rs(s.m) + Math.random() * 120) : Math.max(s.r + 20, 60 + Math.random() * 160)
      orbit(s, r, tilt(0.5), Math.random() * 6.3, m, hue, 'planet', Math.random() < 0.15)
    }

    // The events, as decision 0015 lists them.
    function react (e) {
      const s = sun()
      if (e.kind === 2) {
        planet(CLASS_HUE[e.cls] ?? 200, 1 + Math.random() * 6)
      } else if (e.kind === 3) {
        // From the edge, aimed to pass close by the heaviest body: for a
        // hole, within a few r_s, so some are swallowed.
        const n = tilt(1.2)
        const [p, q] = basis(n)
        const a = Math.random() * Math.PI * 2
        const r = VIEW * 1.3
        const d = [Math.cos(a) * p[0] + Math.sin(a) * q[0], Math.cos(a) * p[1] + Math.sin(a) * q[1], Math.cos(a) * p[2] + Math.sin(a) * q[2]]
        const miss = (s.hole ? rs(s.m) * (1.5 + 3 * Math.random()) : 20 + Math.random() * 40) * (Math.random() < 0.5 ? -1 : 1)
        const v = Math.sqrt(2 * s.m / r) * 1.05
        const side = [n[1] * d[2] - n[2] * d[1], n[2] * d[0] - n[0] * d[2], n[0] * d[1] - n[1] * d[0]]
        const b = body(s.x + r * d[0], s.y + r * d[1], s.z + r * d[2], 0, 0, 0, 0.5, 190, 'comet')
        b.vx = s.vx + v * (-d[0] + miss / r * side[0])
        b.vy = s.vy + v * (-d[1] + miss / r * side[1])
        b.vz = s.vz + v * (-d[2] + miss / r * side[2])
        flares.push({ x: s.x, y: s.y, z: s.z, t: clock, r: s.hole ? RING * rs(s.m) : s.r })
      } else if (e.kind === 4) {
        s.m = Math.min(Math.max(s.m, HOLE_MAX), s.m * 1.12)
        s.r = s.hole ? horizon(s) : radius(s.m, s.star)
        s.flash = 1
        flares.push({ x: s.x, y: s.y, z: s.z, t: clock, r: s.hole ? RING * rs(s.m) : s.r })
      } else if (e.kind === 5) {
        // A subagent: a black hole, then a star, in turn, three of each
        // at most, a star first when none is left.
        subs++
        const holes = bodies.filter(b => b.hole).length
        const suns = bodies.filter(b => b.star).length
        const r = 150 + Math.random() * 60
        if (subs % 2 && holes < 3 && suns > 0) {
          const h = orbit(s, r, tilt(0.4), Math.random() * 6.3, 150 + Math.random() * 150, 0, 'hole')
          const n = tilt(1)
          Object.assign(h, { chi: 0.3 + 0.6 * Math.random(), jx: n[0], jy: n[1], jz: n[2] })
          h.r = horizon(h)
          disc(h, 50, 3.3 * rs(h.m), 7 * rs(h.m), 280)
          flares.push({ x: h.x, y: h.y, z: h.z, t: clock, r: RING * rs(h.m) })
        } else if (suns < 3) orbit(s, r, tilt(0.4), Math.random() * 6.3, 100 + Math.random() * 150, 15, 'star')
        else planet(300, 8)
      } else if (e.kind === 6) {
        for (const o of [...bodies, ...dust]) {
          o.vx *= 0.6
          o.vy *= 0.6
          o.vz *= 0.6
        }
      } else {
        // A puff of dust from a body that is not a hole.
        const from = bodies.filter(b => !b.hole)
        const p = from[Math.floor(Math.random() * from.length)]
        if (p) {
          for (let k = 0; k < 16; k++) {
            const z = 1 - 2 * (k + 0.5) / 16
            const a = k * 2.39996
            const c = Math.sqrt(1 - z * z)
            const d = [c * Math.cos(a), c * Math.sin(a), z]
            const v = 0.3 + Math.random() * 0.5
            dust.push(grain({ x: p.x + (p.r + 3) * d[0], y: p.y + (p.r + 3) * d[1], z: p.z + (p.r + 3) * d[2], vx: p.vx + v * d[0], vy: p.vy + v * d[1], vz: p.vz + v * d[2], hue: p.hue }))
          }
        }
      }
      trim()
    }

    // The lightest planets past the cap gone, the oldest dust past its
    // cap, a disc's last, the frame recentred.
    function trim () {
      while (bodies.length > MAX_BODIES) bodies.splice(bodies.indexOf(bodies.filter(b => !b.star && !b.hole).reduce((a, b) => a.m < b.m ? a : b)), 1)
      cap()
      centre(bodies, dust)
    }

    function cap () {
      let over = dust.length - MAX_DUST
      if (over <= 0) return
      dust = dust.filter(d => d.disc || over-- <= 0)
      if (dust.length > MAX_DUST) dust.splice(0, dust.length - MAX_DUST)
    }

    // The star nearest each hole sheds grains from the point between
    // them where their pulls balance, L1, at about the star's angular
    // speed: slower than a circular orbit there, so they fall in a stream
    // toward the hole and feed its disc.
    function feed (hh) {
      shed += hh * 1.5
      const holes = bodies.filter(b => b.hole)
      while (shed >= 1) {
        shed--
        for (const h of holes) {
          const s = bodies.filter(b => b.star).reduce((a, b) => !a || len(b.x - h.x, b.y - h.y, b.z - h.z) < len(a.x - h.x, a.y - h.y, a.z - h.z) ? b : a, null)
          if (!s) continue
          const dx = h.x - s.x
          const dy = h.y - s.y
          const dz = h.z - s.z
          const d = len(dx, dy, dz)
          if (d > VIEW * 1.5) continue
          const l1 = d * Math.cbrt(s.m / (3 * h.m))
          const k = (1 - l1 / d) * (1.1 + 0.35 * Math.random())
          const j = () => (Math.random() - 0.5) * 0.08
          dust.push(grain({ x: s.x + dx / d * l1, y: s.y + dy / d * l1, z: s.z + dz / d * l1, vx: h.vx + (s.vx - h.vx) * k + j(), vy: h.vy + (s.vy - h.vy) * k + j(), vz: h.vz + (s.vz - h.vz) * k + j(), hue: s.hue }))
        }
      }
      cap()
    }

    // The camera's basis from its turn and height.
    function aim (w, h) {
      const cy = Math.cos(cam.yaw)
      const sy = Math.sin(cam.yaw)
      const cp = Math.cos(cam.pitch)
      const sp = Math.sin(cam.pitch)
      V.e = [cp * cy, cp * sy, sp]
      V.r = [-sy, cy, 0]
      V.u = [-sp * cy, -sp * sy, cp]
      V.cx = w / 2
      V.cy = h / 2
      V.f = Math.min(w, h) / 2 / Math.tan(0.42)
    }

    // A point of the world into P: its place on screen, its depth along
    // the view and its scale.
    function project (x, y, z) {
      const X = x * V.r[0] + y * V.r[1]
      const Y = x * V.u[0] + y * V.u[1] + z * V.u[2]
      const d = Math.max(1, V.D - (x * V.e[0] + y * V.e[1] + z * V.e[2]))
      P.k = V.f / d
      P.x = V.cx + X * P.k
      P.y = V.cy - Y * P.k
      P.d = d
    }

    // The Einstein radius, in pixels squared, of hole o for a source at
    // depth d (Infinity for the sky): theta_E^2 = 2 r_s (D_s - D_l) /
    // (D_l D_s), a point-mass lens.
    function einstein (o, d) {
      if (d === Infinity) return V.f * V.f * 2 * o.s / o.d
      return d <= o.d ? 0 : V.f * V.f * 2 * o.s * (d - o.d) / (o.d * d)
    }

    // P moved to its outer image through every hole in front of it. Its
    // magnification in P.mu.
    function lens (holes, d) {
      P.mu = 1
      for (const o of holes) {
        const t2 = einstein(o, d)
        if (!t2) continue
        const bx = P.x - o.x
        const by = P.y - o.y
        const b = len(bx, by) || 1e-3
        const te = Math.sqrt(t2)
        const u = b / te
        const s = Math.sqrt(u * u + 4)
        const tp = (u + s) / 2
        P.x = o.x + bx / b * tp * te
        P.y = o.y + by / b * tp * te
        P.mu *= (u * u + 2) / (2 * u * s) + 0.5
      }
    }

    function style (hue, sat, light, a) {
      const key = (((hue | 0) * 128 + (sat | 0)) * 128 + (light | 0)) * 32 + Math.round(a * 20)
      let s = styles.get(key)
      if (!s) {
        s = `hsla(${hue | 0}, ${sat | 0}%, ${light | 0}%, ${Math.round(a * 20) / 20})`
        if (styles.size > 4000) styles.clear()
        styles.set(key, s)
      }
      return s
    }

    // Squares of side s centred at (x, y), batched by fill and alpha and
    // filled one path a batch: on a canvas of the CPU a call costs more
    // than its few pixels.
    const batch = new Map()
    function rect (fill, a, x, y, s) {
      const k = Math.min(20, Math.round(a * 20))
      if (k <= 0) return
      let bins = batch.get(fill)
      if (!bins) {
        bins = []
        batch.set(fill, bins)
      }
      ;(bins[k] || (bins[k] = [])).push(x - s / 2, y - s / 2, s)
    }

    function flush () {
      for (const [fill, bins] of batch) {
        g.fillStyle = fill
        for (let k = 1; k < bins.length; k++) {
          const b = bins[k]
          if (!b || !b.length) continue
          g.globalAlpha = k / 20
          g.beginPath()
          for (let i = 0; i < b.length; i += 3) g.rect(b[i], b[i + 1], b[i + 2], b[i + 2])
          g.fill()
          b.length = 0
        }
      }
      if (batch.size > 600) batch.clear()
      g.globalAlpha = 1
    }

    // The heat of a point at (x, y, z) from the holes: 0 far out, about
    // 0.6 at the last stable orbit, 1 within 2 r_s.
    // The hole that heats the point most, set by heatAt.
    let hotHole = null
    function heatAt (holes, x, y, z) {
      let heat = 0
      hotHole = null
      for (const o of holes) {
        const d = len(x - o.b.x, y - o.b.y, z - o.b.z)
        const t = Math.min(1, (2.3 * o.s / d) ** 2)
        if (t > heat) {
          heat = t
          hotHole = o.b
        }
      }
      return heat
    }

    // The distant stars and the galaxy's glow, lensed by each hole: a
    // star's outer image pushed out, its inner one inside the Einstein
    // ring, both drawn as arcs when it lies close behind the hole, a
    // ring when it lines up.
    function drawSky (holes, dim, w, h) {
      g.globalCompositeOperation = 'lighter'
      const { r, u, e, f, cx, cy } = V
      for (const o of haze) {
        const n = o.n
        const Z = -(n[0] * e[0] + n[1] * e[1] + n[2] * e[2])
        if (Z < 0.1) continue
        P.x = cx + f * (n[0] * r[0] + n[1] * r[1]) / Z
        P.y = cy - f * (n[0] * u[0] + n[1] * u[1] + n[2] * u[2]) / Z
        lens(holes, Infinity)
        const sz = o.size * f * Math.min(2, Math.sqrt(P.mu))
        if (P.x < -sz || P.y < -sz || P.x > w + sz || P.y > h + sz) continue
        g.globalAlpha = Math.min(1, o.a * dim)
        g.drawImage(o.warm ? warm : blue, P.x - sz, P.y - sz, 2 * sz, 2 * sz)
      }
      for (const s of stars) {
        const n = s.n
        const Z = -(n[0] * e[0] + n[1] * e[1] + n[2] * e[2])
        if (Z < 0.1) continue
        const x0 = cx + f * (n[0] * r[0] + n[1] * r[1]) / Z
        const y0 = cy - f * (n[0] * u[0] + n[1] * u[1] + n[2] * u[2]) / Z
        P.x = x0
        P.y = y0
        lens(holes, Infinity)
        const a = s.b * dim
        if (P.x >= 0 && P.y >= 0 && P.x < w && P.y < h) rect(s.fill, a * Math.min(2, P.mu), P.x, P.y, s.size * Math.min(2.5, Math.sqrt(P.mu)))
        // Inner images and arcs, by the hole nearest the star's line.
        for (const o of holes) {
          const te = Math.sqrt(einstein(o, Infinity))
          const bx = x0 - o.x
          const by = y0 - o.y
          const b = len(bx, by)
          const uu = b / te
          if (uu > 2.5) continue
          const sq = Math.sqrt(uu * uu + 4)
          const tm = (sq - uu) / 2
          const mum = (uu * uu + 2) / (2 * uu * sq) - 0.5
          const ang = Math.atan2(by, bx)
          if (uu < 0.3) {
            // The star seen as a disc of radius RHO theta_E: an arc of
            // half angle asin(RHO / u) on each side, a ring within RHO.
            const RHO = 0.05
            const half = uu <= RHO ? Math.PI : Math.asin(RHO / uu)
            g.strokeStyle = s.arc
            g.globalAlpha = Math.min(1, a * (0.5 + 0.5 * (1 - uu / 0.3)))
            g.lineWidth = 0.8 + s.size * 0.3
            g.beginPath()
            g.arc(o.x, o.y, (uu + sq) / 2 * te, ang - half, ang + half)
            arcs++
            g.stroke()
            g.beginPath()
            g.arc(o.x, o.y, tm * te, ang + Math.PI - half, ang + Math.PI + half)
            g.stroke()
          } else if (mum > 0.02) {
            rect(s.fill, a * mum * 1.5, o.x - bx / b * tm * te, o.y - by / b * tm * te, s.size * Math.min(1.5, Math.sqrt(mum) + 0.5))
          }
        }
      }
      flush()
      g.globalCompositeOperation = 'source-over'
    }

    // A hole: the soft glow of its lensed disc light, its shadow and its
    // photon ring at sqrt(27) / 2 r_s apparent. A spinning hole's shadow
    // is flattened on its approaching side and shifted toward the
    // receding one, by about 2 a sin i, i its tilt from the line of
    // sight.
    function drawHole (o, dim) {
      const b = o.b
      const R = RING * o.s * o.k
      const t = [V.e[1] * b.jz - V.e[2] * b.jy, V.e[2] * b.jx - V.e[0] * b.jz, V.e[0] * b.jy - V.e[1] * b.jx]
      let tx = t[0] * V.r[0] + t[1] * V.r[1] + t[2] * V.r[2]
      let ty = -(t[0] * V.u[0] + t[1] * V.u[1] + t[2] * V.u[2])
      const sini = len(tx, ty)
      if (sini > 1e-6) {
        tx /= sini
        ty /= sini
      }
      const shift = 2 * b.chi * b.m / C2 * sini * o.k
      const flat = 1 - 0.22 * b.chi * sini
      const ox = o.x - tx * shift
      const oy = o.y - ty * shift
      const path = () => {
        g.beginPath()
        for (let k = 0; k <= 48; k++) {
          const a = k / 48 * Math.PI * 2
          let p = Math.cos(a) * R
          const q = Math.sin(a) * R
          if (p > 0) p *= flat
          const x = ox + p * tx - q * ty
          const y = oy + p * ty + q * tx
          if (k) g.lineTo(x, y)
          else g.moveTo(x, y)
        }
        g.closePath()
      }
      const glow = g.createRadialGradient(ox, oy, R * 0.9, ox, oy, R * 2.2)
      glow.addColorStop(0, `hsla(36, 100%, 70%, ${(0.25 + 0.4 * b.flash) * dim})`)
      glow.addColorStop(1, 'hsla(36, 100%, 50%, 0)')
      g.fillStyle = glow
      g.fillRect(ox - R * 2.2, oy - R * 2.2, R * 4.4, R * 4.4)
      path()
      g.fillStyle = '#000'
      g.fill()
      g.strokeStyle = `hsla(40, 100%, ${80 + 15 * b.flash}%, ${Math.min(1, (0.55 + 0.45 * b.flash) * dim)})`
      g.lineWidth = Math.max(1, R * 0.07) * (1 + b.flash)
      g.stroke()
    }

    // A body's trail: its places, kept in the world as the camera moves,
    // projected each frame, fading with age.
    function drawTrail (b, layerOf, L, dim, keep) {
      const tr = b.trail
      const n = Math.min(tr.length / 3, Math.ceil(keep * tr.length / 3))
      if (n < 2) return
      const CH = 6
      const per = Math.ceil(n / CH)
      g.lineWidth = Math.max(1, Math.min(3, b.r * b.pk * 0.8))
      const start = tr.length / 3 - n
      for (let c = 0; c < CH; c++) {
        const i0 = start + c * per
        const i1 = Math.min(start + n - 1, i0 + per)
        if (i1 <= i0) continue
        const m = 3 * ((i0 + i1) >> 1)
        project(tr[m], tr[m + 1], tr[m + 2])
        if (layerOf(P.d) !== L) continue
        const a = (c + 1) / CH * 0.9 * dim
        g.strokeStyle = style(b.hue, b.comet ? 40 : 85, b.comet ? 80 : 60, a)
        g.beginPath()
        for (let i = i0; i <= i1; i++) {
          project(tr[3 * i], tr[3 * i + 1], tr[3 * i + 2])
          if (i === i0) g.moveTo(P.x, P.y)
          else g.lineTo(P.x, P.y)
        }
        if (i1 === start + n - 1) g.lineTo(b.px, b.py)
        g.stroke()
      }
    }

    function drawBody (b, dim) {
      const fog = Math.max(0.5, Math.min(1.1, 1.3 - 0.5 * b.pd / V.D))
      const lit = dim * fog
      const r = Math.max(1.5, b.r * b.pk * (b.star ? 1 : 1.4))
      const [hue, sat, light] = hot(b.hue, b.star ? 100 : b.comet ? 40 : 80, b.star ? 90 : b.comet ? 85 : 62, b.heat)
      if (b.star || b.heat > 0.15) {
        const R = b.star ? r * 3.2 : r * (1.5 + 3 * b.heat)
        const glow = g.createRadialGradient(b.px, b.py, r * 0.3, b.px, b.py, R)
        glow.addColorStop(0, `hsla(${hue | 0}, 100%, 85%, ${lit})`)
        glow.addColorStop(0.35, `hsla(${hue | 0}, 100%, 60%, ${0.35 * lit})`)
        glow.addColorStop(1, `hsla(${hue | 0}, 100%, 50%, 0)`)
        g.fillStyle = glow
        g.fillRect(b.px - R, b.py - R, 2 * R, 2 * R)
      }
      g.fillStyle = `hsl(${hue | 0}, ${sat | 0}%, ${(light * lit) | 0}%)`
      g.beginPath()
      g.arc(b.px, b.py, r, 0, Math.PI * 2)
      g.fill()
    }

    seed()
    return {
      draw (synth, dt) {
        const w = canvas.width
        const h = canvas.height
        if (w < 4 || h < 4) return
        if (layer.width !== w || layer.height !== h) {
          layer.width = w
          layer.height = h
        }
        for (const e of synth.since(mark)) react(e)
        const L = synth.level
        // Simulation time per second: the clock, as in the Gravity mode.
        const speed = (6 + 30 * Math.min(1, L.bass) + 14 * L.busy + 10 * L.treble) * (1 - 0.9 * L.idle)
        let left = Math.min(speed * dt, 60 * H)
        const bursts = []
        const eaten = []
        while (left > 0) {
          const hh = Math.min(H, left)
          const r = step(bodies, hh)
          for (const m of r.merged) bursts.push(m)
          for (const m of r.swallowed) eaten.push(m)
          for (const [o, n] of fall(dust, bodies, hh)) {
            o.flash = Math.min(1, o.flash + 0.03 * n)
            swallowed += n
          }
          feed(hh)
          left -= hh
          clock += hh
        }
        if (bursts.length || eaten.length) centre(bodies, dust)
        for (const m of bursts) flares.push({ x: m.x, y: m.y, z: m.z, t: clock, r: 6 + 2 * Math.cbrt(m.m) })
        for (const m of eaten) {
          m.hole.flash = 1
          swallowed++
        }
        bodies = bodies.filter(b => b.star || b.hole || len(b.x, b.y, b.z) < VIEW * 4)
        dust = dust.filter(d => !d.gone && len(d.x, d.y, d.z) < VIEW * 2 && bodies.every(b => b.hole || (b.x - d.x) ** 2 + (b.y - d.y) ** 2 + (b.z - d.z) ** 2 > b.r * b.r))
        if (bodies.length < 2) seed()
        for (const b of bodies) {
          b.flash *= Math.exp(-dt / 0.6)
          // A place every 1.5 time units, or every 4 units of travel.
          if (b.hole || b.star) continue
          const tr = b.trail
          const k = tr.length - 3
          if (k >= 0 && clock - b.tt < 1.5 && (b.x - tr[k]) ** 2 + (b.y - tr[k + 1]) ** 2 + (b.z - tr[k + 2]) ** 2 < 16) continue
          b.tt = clock
          tr.push(b.x, b.y, b.z)
          if (tr.length > 3 * 64) tr.splice(0, 3)
        }

        // The camera turns slowly by itself, unless the pointer turned
        // it in the last 4 s.
        const now = synth.t
        if (now - cam.held > 4) cam.yaw += dt * 0.06 * (1 - 0.8 * L.idle)
        aim(w, h)
        const dim = 1 - 0.45 * L.idle
        // Trails: long while busy, gone while idle, when time all but
        // stops.
        const keep = 1 - 0.85 * L.idle
        g.globalCompositeOperation = 'source-over'
        g.fillStyle = '#000'
        g.fillRect(0, 0, w, h)

        // The holes on screen, far to near: a body or a grain is drawn
        // after every hole behind it and before every one in front.
        const holes = []
        for (const b of bodies) {
          if (!b.hole) continue
          project(b.x, b.y, b.z)
          holes.push({ b, x: P.x, y: P.y, d: P.d, k: P.k, s: rs(b.m) })
        }
        holes.sort((a, b) => b.d - a.d)
        const layerOf = d => {
          let n = 0
          for (const o of holes) if (o.d > d) n++
          return n
        }
        drawSky(holes, dim, w, h)
        const hs = holes.map(o => ({ b: o.b, s: o.s }))
        for (const b of bodies) {
          project(b.x, b.y, b.z)
          b.pd = P.d
          b.pk = P.k
          b.px = P.x
          b.py = P.y
          b.layer = layerOf(P.d)
          b.heat = b.hole ? 0 : heatAt(hs.filter(o => o.b !== b), b.x, b.y, b.z)
        }
        for (const d of dust) {
          project(d.x, d.y, d.z)
          const x0 = P.x
          const y0 = P.y
          d.pd = P.d
          d.pk = P.k
          d.layer = layerOf(P.d)
          const behind = holes.filter(o => o.d < P.d)
          lens(behind, P.d)
          d.px = P.x
          d.py = P.y
          d.mu = P.mu
          // The inner image, inside the ring, of a grain close behind a
          // hole.
          d.inner = false
          for (const o of behind) {
            const t2 = einstein(o, d.pd)
            if (!t2) continue
            const bx = x0 - o.x
            const by = y0 - o.y
            const b = len(bx, by) || 1e-3
            const te = Math.sqrt(t2)
            const u = b / te
            if (u > 2) continue
            const s = Math.sqrt(u * u + 4)
            const tm = (s - u) / 2
            d.inner = true
            d.ix = o.x - bx / b * tm * te
            d.iy = o.y - by / b * tm * te
            d.imu = (u * u + 2) / (2 * u * s) - 0.5
          }
          d.heat = heatAt(hs, d.x, d.y, d.z)
          // Beaming: brighter where the grain comes toward the camera.
          const o = hotHole
          const vl = o && d.heat > 0.05 ? ((d.vx - o.vx) * V.e[0] + (d.vy - o.vy) * V.e[1] + (d.vz - o.vz) * V.e[2]) / C : 0
          d.beam = Math.max(0.35, Math.min(2.2, (1 + 0.6 * vl) ** 2))
        }
        const order = bodies.filter(b => !b.hole).sort((a, b) => b.pd - a.pd)
        g.lineCap = 'round'
        for (let Lr = 0; Lr <= holes.length; Lr++) {
          for (const b of order) if (b.trail.length) drawTrail(b, layerOf, Lr, dim, keep)
          g.globalCompositeOperation = 'lighter'
          for (const d of dust) {
            if (d.layer !== Lr) continue
            const heat = d.heat
            const [hue, sat, light] = hot(d.hue, 70, 75, Math.round(heat * 12) / 12)
            const fog = Math.max(0.5, Math.min(1.1, 1.3 - 0.5 * d.pd / V.D))
            const a = (0.55 + 0.45 * heat) * dim * fog * (heat > 0.05 ? d.beam : 1)
            const fill = style(hue, sat, light, 1)
            rect(fill, a, d.px, d.py, (1.2 + 1.3 * heat) * Math.min(2, Math.sqrt(d.mu)))
            if (d.inner && d.imu > 0.03) rect(fill, a * d.imu * 2, d.ix, d.iy, 1.5)
          }
          flush()
          g.globalCompositeOperation = 'source-over'
          for (const b of order) if (b.layer === Lr) drawBody(b, dim)
          if (Lr < holes.length) drawHole(holes[Lr], dim)
        }

        flares = flares.filter(f => clock - f.t < 18)
        for (const f of flares) {
          const a = (1 - (clock - f.t) / 18) ** 2
          project(f.x, f.y, f.z)
          g.strokeStyle = `rgba(255, 230, 170, ${a})`
          g.lineWidth = 2
          g.beginPath()
          g.arc(P.x, P.y, (f.r + (clock - f.t) * 3) * P.k, 0, Math.PI * 2)
          g.stroke()
        }
        out.drawImage(layer, 0, 0)
        tick = now
      },

      // A drag turns the camera about the centre: across, about the
      // vertical, and up and down, its height. A click throws a moon
      // from the point under it, on the plane through the centre facing
      // the camera, on a circular orbit about the heaviest body.
      pointer (kind, x, y, down) {
        if (kind === 'down') {
          press = { x0: x, y0: y, yaw: cam.yaw, pitch: cam.pitch, moved: false }
          return
        }
        if (!press) return
        const dx = x - press.x0
        const dy = y - press.y0
        if (kind === 'move' && down) {
          if (!press.moved && len(dx, dy) >= 5) {
            press.moved = true
            turns++
          }
          if (press.moved) {
            cam.yaw = press.yaw - dx * 0.008
            cam.pitch = Math.max(-1.45, Math.min(1.45, press.pitch + dy * 0.008))
            cam.held = tick
          }
          return
        }
        if (kind !== 'up') return
        const moved = press.moved || len(dx, dy) >= 5
        press = null
        if (moved || !V.f) return
        const k = V.f / V.D
        const X = (x - V.cx) / k
        const Y = -(y - V.cy) / k
        const p = [0, 1, 2].map(i => X * V.r[i] + Y * V.u[i])
        const s = sun()
        let rel = [p[0] - s.x, p[1] - s.y, p[2] - s.z]
        let d = len(...rel)
        const least = s.hole ? 3.3 * rs(s.m) : s.r + 4
        if (d < 1e-6) {
          rel = V.r.slice()
          d = 1
        }
        if (d < least) {
          rel = rel.map(v => v / d * least)
          d = least
        }
        const n = s.hole ? [s.jx, s.jy, s.jz] : [0, 0, 1]
        let t = [n[1] * rel[2] - n[2] * rel[1], n[2] * rel[0] - n[0] * rel[2], n[0] * rel[1] - n[1] * rel[0]]
        if (len(...t) < 1e-3 * d) t = [V.u[1] * rel[2] - V.u[2] * rel[1], V.u[2] * rel[0] - V.u[0] * rel[2], V.u[0] * rel[1] - V.u[1] * rel[0]]
        const tl = len(...t)
        const v = circular(s, d)
        body(s.x + rel[0], s.y + rel[1], s.z + rel[2], s.vx + v * t[0] / tl, s.vy + v * t[1] / tl, s.vz + v * t[2] / tl, 2 + Math.random() * 3, 55, 'planet')
        thrown++
        trim()
      },

      // For the live checks: the moons thrown, the camera's turns by a
      // drag, what the holes have swallowed, the stars drawn as arcs or
      // rings, the bodies and the dust.
      probe () {
        return { thrown, turns, swallowed, arcs, holes: bodies.filter(b => b.hole).length, bodies: bodies.length, dust: dust.length, disc: dust.filter(d => d.disc).length }
      }
    }
  }

  const api = { step, fall, centre, horizon, circular, rs, C, CHI_MAX }
  if (typeof module === 'object' && module.exports) module.exports = api
  else (root.VizCanvas = root.VizCanvas || {}).gravity3d = create
})(this)
