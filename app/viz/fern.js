'use strict'
// Fern mode (decision 0015): a forest of fronds, iterated function
// systems of Barnsley's fern and three relatives, under an infinite zoom
// into the hero frond's own copy of itself, in hues that drift. Each
// point is the image of a point of the attractor under a random address
// of maps, each map bent by a small rotation of its own depth, so every
// frond and leaflet waves with a phase lag that grows along the frond.
// The camera follows the bent chain of copies by a continuous power of
// its similarity, so the zoom has no seam. The forest's companions hang
// in the frames of the copies, fade in small and out large. The picture
// passes through a slowly drifting Moebius map. The signal steers it:
// the activity the zoom's speed and the growth, a prompt morphs every
// frond to the next species, a tool call lights the fronds on one side
// in its class's colour, a stop and the treble blow wind through it, a
// subagent sprouts a frond, an idle spell slows and stills it. A click
// lights the fronds on its side in gold and blows a gust.

;(function (root) {
  // Each map [a, b, c, d, e, f, p]: x' = a x + b y + e, y' = c x + d y + f,
  // picked with probability p. Four maps each: the stem, the frond's
  // copy of itself, the left and the right leaflet.
  const SPECIES = [
    // Barnsley's fern.
    [[0, 0, 0, 0.16, 0, 0, 0.01], [0.85, 0.04, -0.04, 0.85, 0, 1.6, 0.85], [0.2, -0.26, 0.23, 0.22, 0, 1.6, 0.07], [-0.15, 0.28, 0.26, 0.24, 0, 0.44, 0.07]],
    // Cyclosorus, a thelypteroid fern.
    [[0, 0, 0, 0.25, 0, -0.4, 0.02], [0.95, 0.005, -0.005, 0.93, -0.002, 0.5, 0.84], [0.035, -0.2, 0.16, 0.04, -0.09, 0.02, 0.07], [-0.04, 0.2, 0.16, 0.04, 0.083, 0.12, 0.07]],
    // Culcita, Barnsley's maps mutated.
    [[0, 0, 0, 0.25, 0, -0.14, 0.02], [0.85, 0.02, -0.02, 0.83, 0, 1, 0.84], [0.09, -0.28, 0.3, 0.11, 0, 0.6, 0.07], [-0.09, 0.28, 0.3, 0.09, 0, 0.7, 0.07]],
    // A fishbone fern.
    [[0, 0, 0, 0.25, 0, -0.4, 0.02], [0.95, 0.002, -0.002, 0.93, -0.002, 0.5, 0.84], [0.035, -0.11, 0.27, 0.01, -0.05, 0.005, 0.07], [-0.04, 0.11, 0.27, 0.01, 0.047, 0.06, 0.07]]
  ]
  const CLASS_HUE = [200, 120, 40, 0, 280, 320]
  const K = 4
  // The picture through a drifting Moebius map, or not.
  const WARP = true
  // Waved maps per frond below a frond's or a leaflet's own frame.
  const D = 6
  // The phase lag of the wave per depth, in radians.
  const LAG = 0.55
  // The view: the camera frame's point at the pane's centre, and the
  // camera units in half the pane's shorter side.
  const QY = 0.58
  const H = 0.62

  // A species in the frond's own frame: the copy map made a similarity
  // (its mean scale and rotation), then all four conjugated so the stem's
  // foot is the origin and the copy's fixed point, the tip, is (0, 1).
  function unit (maps) {
    const m = maps.map(r => r.slice())
    const g = m[1]
    const s = (g[0] + g[3]) / 2
    const r = (g[1] - g[2]) / 2
    g[0] = g[3] = s
    g[1] = r
    g[2] = -r
    const det = (1 - s) * (1 - s) + r * r
    const tx = ((1 - s) * g[4] + r * g[5]) / det
    const ty = (-r * g[4] + (1 - s) * g[5]) / det
    const by = m[0][5] / (1 - m[0][3])
    const L = Math.hypot(tx, ty - by)
    const co = (ty - by) / L
    const si = tx / L
    return m.map(([a, b, c, d, e, f, p]) => {
      const ra = co * a - si * c
      const rb = co * b - si * d
      const rc = si * a + co * c
      const rd = si * b + co * d
      const ux = b * by + e
      const uy = d * by + f - by
      return [ra * co - rb * si, ra * si + rb * co, rc * co - rd * si, rc * si + rd * co, (co * ux - si * uy) / L, (si * ux + co * uy) / L, p]
    })
  }
  const UNIT = SPECIES.map(unit)

  // The frames of the hero's copies, seen from the camera at depth d:
  // copy k's frame is the root's under G_1 ... G_k, G_k(z) = a_k z + b,
  // a_k = alpha e^{i theta(k)}, and the camera's frame is copy J's under
  // the power u of G_{J+1}, J = floor(d), u = d - J. Returns, for k from
  // J + lo to J + hi, the map from copy k's frame to the camera's, as
  // [ar, ai, br, bi] per k. Continuous in d: at u = 1 the power is
  // G_{J+1} itself.
  function frames (ar, ai, br, bi, theta, d, lo, hi, out) {
    const J = Math.floor(d)
    const u = d - J
    const n = hi - lo + 1
    const F = out && out.length >= 4 * n ? out : new Float64Array(4 * n)
    const sub = k => {
      const c = Math.cos(theta(k))
      const s = Math.sin(theta(k))
      return [ar * c - ai * s, ar * s + ai * c]
    }
    // G_{J+1}^u about its fixed point z* = b / (1 - a).
    const [gr, gi] = sub(J + 1)
    const dr = 1 - gr
    const di = -gi
    const dd = dr * dr + di * di
    const zr = (br * dr + bi * di) / dd
    const zi = (bi * dr - br * di) / dd
    const mod = Math.pow(Math.hypot(gr, gi), u)
    const ang = u * Math.atan2(gi, gr)
    const pr = mod * Math.cos(ang)
    const pi = mod * Math.sin(ang)
    // The power: z -> p z + z* (1 - p); its inverse, F_J.
    const qr = zr * (1 - pr) + zi * pi
    const qi = zi * (1 - pr) - zr * pi
    const pd = pr * pr + pi * pi
    const fr = pr / pd
    const fi = -pi / pd
    const er = -(fr * qr - fi * qi)
    const ei = -(fr * qi + fi * qr)
    const at = k => 4 * (k - J - lo)
    const put = (k, a, b, c, e) => {
      const o = at(k)
      F[o] = a
      F[o + 1] = b
      F[o + 2] = c
      F[o + 3] = e
    }
    if (lo <= 0 && hi >= 0) put(J, fr, fi, er, ei)
    // Deeper: F_{k+1} = F_k o G_{k+1}.
    let ar0 = fr
    let ai0 = fi
    let br0 = er
    let bi0 = ei
    for (let k = J + 1; k <= J + hi; k++) {
      const [sr, sj] = sub(k)
      const nbr = ar0 * br - ai0 * bi + br0
      const nbi = ar0 * bi + ai0 * br + bi0
      const nar = ar0 * sr - ai0 * sj
      const nai = ar0 * sj + ai0 * sr
      ar0 = nar
      ai0 = nai
      br0 = nbr
      bi0 = nbi
      if (k >= J + lo) put(k, ar0, ai0, br0, bi0)
    }
    // Shallower: F_{k-1} = F_k o G_k^{-1}, G_k^{-1}(z) = (z - b) / a_k.
    ar0 = fr
    ai0 = fi
    br0 = er
    bi0 = ei
    for (let k = J; k > J + lo; k--) {
      const [sr, sj] = sub(k)
      const sd = sr * sr + sj * sj
      const nar = (ar0 * sr + ai0 * sj) / sd
      const nai = (ai0 * sr - ar0 * sj) / sd
      br0 -= nar * br - nai * bi
      bi0 -= nar * bi + nai * br
      ar0 = nar
      ai0 = nai
      if (k - 1 <= J + hi) put(k - 1, ar0, ai0, br0, bi0)
    }
    return F
  }

  function hueRgb (h) {
    const f = n => {
      const k = (n + h / 30) % 12
      return 0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    }
    return [f(0), f(8), f(4)]
  }

  function smooth (x) {
    const t = Math.max(0, Math.min(1, x))
    return t * t * (3 - 2 * t)
  }

  // A number in [0, 1) from integers: the forest's companions are a
  // function of their copy's depth, so they stay put as the zoom passes.
  function hash (k, q, n) {
    let h = (Math.imul(k, 374761393) + Math.imul(q, 668265263) + Math.imul(n, 2246822519)) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }

  // The chaos game's orbit, bounded: a map set whose interpolation
  // diverges restarts at the origin.
  function iterate (maps, cum, n, p, out) {
    let x = p.x
    let y = p.y
    for (let i = 0; i < n; i++) {
      const u = Math.random()
      let k = 0
      while (k < 3 && u > cum[k]) k++
      const m = maps[k]
      const nx = m[0] * x + m[1] * y + m[4]
      y = m[2] * x + m[3] * y + m[5]
      x = nx
      if (!(Math.abs(x) < 1e3 && Math.abs(y) < 1e3)) {
        x = 0
        y = 0
      }
      out(x, y, k, i)
    }
    p.x = x
    p.y = y
  }

  // The hue wheel, 1024 steps.
  const WHEEL = new Float32Array(3 * 1024)
  for (let i = 0; i < 1024; i++) WHEEL.set(hueRgb(i * 360 / 1024), 3 * i)

  function create (canvas) {
    const g = canvas.getContext('2d')
    const buf = document.createElement('canvas')
    // On the CPU: the pixels are written there, and blitted once.
    const bg = buf.getContext('2d', { willReadFrequently: true })
    const mark = {}
    let img = null
    let px = null
    let r = null
    let gr = null
    let b = null
    let bw = 0
    let bh = 0
    let cw = 0
    let ch = 0
    let from = 0
    let to = 0
    let morph = 1
    let gust = 0
    let burst = 0
    let flash = null
    let tick = 0
    let clicks = 0
    // The camera's depth in copies of the hero, the octaves zoomed, and
    // the hue's drift.
    let depth = 0
    let octaves = 0
    let drift = 0
    let wave = 0
    let seed = 0x9e3779b9
    const sprouts = []
    // A map set per species slot, slot s showing species from + s
    // morphing to to + s, the hero in slot 0; their weights, cumulative;
    // an orbit of the attractor per slot.
    const slots = [0, 1, 2, 3].map(() => ({ maps: [[], [], [], []], cum: new Float64Array(4), x: 0, y: 0 }))
    // Waved maps: the hero's per depth, a companion's per depth below
    // its foot, 6 numbers per map, 4 maps per depth.
    let heroT = new Float64Array(0)
    const compT = new Float64Array(24 * D)
    let F = new Float64Array(0)
    // The warp: z -> (a z + b) / (c z + 1), eased from one draw to the
    // next, as [ar, ai, br, bi, cr, ci].
    const warp = { at: [1, 0, 0, 0, 0, 0], from: [1, 0, 0, 0, 0, 0], to: [1, 0, 0, 0, 0, 0], t: -1e9 }

    function rnd () {
      seed ^= seed << 13
      seed ^= seed >>> 17
      seed ^= seed << 5
      return (seed >>> 0) * 2.3283064365386963e-10
    }

    function resize (w, h) {
      cw = w
      ch = h
      const k = Math.max(1, Math.ceil(Math.sqrt(w * h / 120000)))
      bw = Math.max(1, Math.ceil(w / k))
      bh = Math.max(1, Math.ceil(h / k))
      buf.width = bw
      buf.height = bh
      img = bg.createImageData(bw, bh)
      px = new Uint32Array(img.data.buffer)
      r = new Float32Array(bw * bh)
      gr = new Float32Array(bw * bh)
      b = new Float32Array(bw * bh)
    }

    function react (synth) {
      for (const e of synth.since(mark)) {
        if (e.kind === 3) {
          from = to
          to = (to + 1) % SPECIES.length
          morph = 0
          // The old forest dims at once, so the prompt shows before the
          // morph has grown.
          for (const a of [r, gr, b]) for (let i = 0; i < a.length; i++) a[i] *= 0.3
        } else if (e.kind === 2) {
          flash = { side: e.cls % 2 ? 1 : -1, rgb: hueRgb(CLASS_HUE[e.cls] ?? 200), t: synth.t }
        } else if (e.kind === 4) {
          gust = 1
        } else if (e.kind === 5) {
          // A frond at the foot of the copy just past the camera's.
          const side = sprouts.length % 2 ? 1 : -1
          sprouts.push({ k: Math.floor(depth) + 1, x: side * (0.12 + 0.2 * Math.random()), side, t: synth.t, hue: 360 * Math.random(), slot: Math.floor(4 * Math.random()), ph: 6.3 * Math.random() })
          if (sprouts.length > 4) sprouts.shift()
        } else if (e.kind === 6) {
          r.fill(0)
          gr.fill(0)
          b.fill(0)
        } else {
          gust = Math.max(gust, 0.5)
          burst = 1
        }
      }
    }

    // T's maps at depth slot s, each bent by its rotation: the copy's by
    // th, the leaflets' by lf. f o R(angle) keeps f's translation.
    function bend (T, s, maps, th, lf) {
      for (let i = 0; i < 4; i++) {
        const m = maps[i]
        const t = i === 1 ? th : i === 0 ? 0 : lf
        const c = Math.cos(t)
        const n = Math.sin(t)
        const o = 24 * s + 6 * i
        T[o] = m[0] * c + m[1] * n
        T[o + 1] = m[1] * c - m[0] * n
        T[o + 2] = m[2] * c + m[3] * n
        T[o + 3] = m[3] * c - m[2] * n
        T[o + 4] = m[4]
        T[o + 5] = m[5]
      }
    }

    return {
      draw (synth, dt) {
        const w = canvas.width
        const h = canvas.height
        if (w < 2 || h < 2) return
        if (w !== cw || h !== ch) resize(w, h)
        react(synth)
        const L = synth.level
        const t = synth.t
        tick = t
        const idle = L.idle
        const bass = Math.min(1, L.bass)
        morph = Math.min(1, morph + dt / 2.5)
        gust *= Math.exp(-dt / 1.5)
        burst *= Math.exp(-dt / 0.8)
        for (let i = sprouts.length - 1; i >= 0; i--) if (t - sprouts[i].t > 40) sprouts.splice(i, 1)
        const fl = flash ? Math.max(0, 1 - (t - flash.t) / 1.6) : 0
        if (fl === 0) flash = null

        // The species of the moment, per slot.
        const m = smooth(morph)
        for (const [s, sl] of slots.entries()) {
          const fa = UNIT[(from + s) % 4]
          const fb = UNIT[(to + s) % 4]
          let acc = 0
          for (let k = 0; k < 4; k++) {
            for (let j = 0; j < 7; j++) sl.maps[k][j] = fa[k][j] + (fb[k][j] - fa[k][j]) * m
            acc += sl.maps[k][6]
            sl.cum[k] = acc
          }
          for (let k = 0; k < 4; k++) sl.cum[k] /= acc
        }
        const hero = slots[0].maps
        const rho = hero[1][0] * hero[1][0] + hero[1][2] * hero[1][2]
        const per = -Math.log(rho) / 2 / Math.LN2

        // The zoom, in octaves a second, and the clocks of the wind and
        // the hue.
        const speed = (0.07 + 0.22 * bass + 0.1 * L.busy + 0.25 * burst) * (1 - 0.85 * idle)
        octaves += speed * dt
        depth += speed * dt / per
        wave += dt * (1 - 0.9 * idle)
        drift += dt * (14 + 30 * bass + 20 * L.treble) * (1 - 0.8 * idle)
        const amp = (1 + 0.8 * L.treble + 2.5 * gust) * (1 - 0.9 * idle)
        const A = 0.03 * amp
        const th = k => A * Math.sin(1.3 * wave - LAG * k)

        // The hero's copies from about 4 times the view down to a
        // fiftieth of it.
        const lo = -Math.ceil(2 / per)
        const hi = Math.ceil(5.6 / per)
        const J = Math.floor(depth)
        const n = hi - lo + 1
        if (F.length < 4 * n) F = new Float64Array(4 * n)
        frames(hero[1][0], hero[1][2], hero[1][4], hero[1][5], th, depth, lo, hi, F)
        const S = n + D + 1
        if (heroT.length < 24 * S) heroT = new Float64Array(24 * S)
        for (let s = 0; s < S; s++) bend(heroT, s, hero, th(J + lo + s), 3 * th(J + lo + s))

        // The items to grow: the hero's shells, each a copy's stem and
        // leaflets, and the companions. Each with its share of the points
        // by the area it shows.
        const items = []
        const aspect = bw / bh
        const big = Math.max(1, aspect) * H
        const view = H * H * aspect * 4
        for (let k = J + lo; k <= J + hi; k++) {
          const o = 4 * (k - J - lo)
          const sz = Math.hypot(F[o], F[o + 1])
          const area = 0.3 * sz * sz * (1 - rho)
          // Nothing of a copy is left when it leaves the window, at
          // four times the view or more.
          const out = 1 - smooth((sz - 2) / 1.5)
          const share = (sz < 1.2 ? area : area * Math.pow(1.2 / sz, 4)) * out
          items.push({ hero: true, k, o, w: share, a: 1, side: 0, hue: 24 * (k - depth) })
          // The companions of copy k, one slot each side, more per copy
          // the more copies an octave holds.
          const p = 1.2 * per
          for (let q = 0; q < 2; q++) {
            const ex = Math.max(0, Math.min(1, (p - hash(k, q, 0)) / 0.08))
            if (!ex) continue
            const side = q ? 1 : -1
            const size = 0.4 + 0.75 * hash(k, q, 1)
            const s = sz * size
            const a = ex * smooth((s - 0.025) / 0.1) * (1 - smooth((s - 1.6) / 2)) * out
            if (a <= 0) continue
            const rx = side * (0.06 + 0.6 * hash(k, q, 2))
            const ry = -0.12 + 0.3 * hash(k, q, 3)
            const X = F[o] * rx - F[o + 1] * ry + F[o + 2]
            const Y = F[o] * ry + F[o + 1] * rx + F[o + 3]
            if (Math.abs(X) > big + s || Math.abs(Y - QY) > H + s) continue
            const ph = 6.3 * hash(k, q, 4)
            const tilt = -side * (0.1 + 0.7 * hash(k, q, 5)) + 0.06 * amp * Math.sin(0.9 * wave + ph)
            items.push({ k, o, rx, ry, size, tilt, mirror: hash(k, q, 6) < 0.5, slot: Math.floor(4 * hash(k, q, 7)), ph, a, side, w: Math.min(0.3 * s * s, view) * a, hue: 360 * hash(k, q, 8) + 24 * (k - depth) })
          }
        }
        for (const sp of sprouts) {
          const o = 4 * (sp.k - J - lo)
          if (o < 0 || o >= 4 * n) continue
          const sz = Math.hypot(F[o], F[o + 1])
          const size = 0.85 * smooth((t - sp.t) / 2.5)
          const s = sz * size
          const a = (1 - smooth((s - 1.6) / 2)) * (1 - smooth((t - sp.t - 30) / 10)) * (1 - smooth((sz - 2) / 1.5))
          if (a <= 0 || size <= 0) continue
          const tilt = -sp.side * 0.35 + 0.06 * amp * Math.sin(0.9 * wave + sp.ph)
          items.push({ k: sp.k, o, rx: sp.x, ry: 0, size, tilt, mirror: false, slot: sp.slot, ph: sp.ph, a: a * (1 + 2 * Math.max(0, 1 - (t - sp.t) / 2)), side: sp.side, w: Math.max(0.02, Math.min(0.3 * s * s, view)), hue: sp.hue + 24 * (sp.k - depth), sprout: t - sp.t })
        }

        // The warp: a new draw every 9 s, kept near the identity.
        if (WARP) {
          if (t - warp.t > 9) {
            warp.from = warp.at.slice()
            const ang = 0.15 * (2 * Math.random() - 1)
            const mag = 1 + 0.08 * (2 * Math.random() - 1)
            const bb = 0.12 * Math.random()
            const ba = 6.3 * Math.random()
            const cc = 0.35 * Math.random()
            const ca = 6.3 * Math.random()
            warp.to = [mag * Math.cos(ang), mag * Math.sin(ang), bb * Math.cos(ba), bb * Math.sin(ba), cc * Math.cos(ca), cc * Math.sin(ca)]
            warp.t = t
          }
          const e = smooth((t - warp.t) / 9)
          for (let j = 0; j < 6; j++) warp.at[j] = warp.from[j] + (warp.to[j] - warp.from[j]) * e
        }
        const [war, wai, wbr, wbi, wcr, wci] = warp.at

        // Growth and fading: fast and short-lived at work, a slow
        // trickle that lingers at idle.
        const rate = bw * bh * (4.5 + 5 * bass + 3 * L.busy + 4 * burst) * (1 - 0.5 * idle)
        const total = Math.min(20000, Math.round(rate * dt))
        const fade = Math.exp(-dt / (0.45 + 0.6 * idle))
        let sum = 0
        for (const it of items) sum += it.w
        const half = Math.min(bw, bh) / 2
        const cx = bw / 2
        const cy = bh / 2
        const hue0 = drift + 1e5
        const gc = Math.cos(0.11 * t)
        const gs = Math.sin(0.11 * t)
        const fr = flash ? flash.rgb : null
        const au = 0.6 * idle

        // One point into the buffer, in camera units, through the warp.
        const plot = (X, Y, hue, a, lit) => {
          let ux = (X) / H
          let uy = (Y - QY) / H
          if (WARP) {
            const nr = war * ux - wai * uy + wbr
            const ni = war * uy + wai * ux + wbi
            const dr = wcr * ux - wci * uy + 1
            const di = wcr * uy + wci * ux
            const dd = dr * dr + di * di
            if (dd < 1e-6) return
            ux = (nr * dr + ni * di) / dd
            uy = (ni * dr - nr * di) / dd
          }
          const ix = (cx + ux * half) | 0
          const iy = (cy - uy * half) | 0
          if (ix < 0 || iy < 0 || ix >= bw || iy >= bh) return
          const at = iy * bw + ix
          const c = 3 * ((((hue0 + hue + 80 * (ux * gc + uy * gs)) * 2.8444444) | 0) & 1023)
          let R = WHEEL[c]
          let G = WHEEL[c + 1]
          let B = WHEEL[c + 2]
          if (au) {
            const l = 0.35 * R + 0.5 * G + 0.15 * B
            R += (1.2 * l - R) * au
            G += (0.75 * l - G) * au
            B += (0.25 * l - B) * au
          }
          if (lit) {
            R += (1.4 * fr[0] - R) * lit
            G += (1.4 * fr[1] - G) * lit
            B += (1.4 * fr[2] - B) * lit
          }
          r[at] += R * a
          gr[at] += G * a
          b[at] += B * a
        }

        for (const it of items) {
          let cnt = total * it.w / sum
          cnt = Math.floor(cnt) + (rnd() < cnt % 1 ? 1 : 0)
          if (!cnt) continue
          const o = it.o
          // Copy k's frame to the camera's, and for a companion its foot
          // and lean in that frame: one similarity, z -> fa z + fb.
          let far = F[o]
          let fai = F[o + 1]
          let fbr = F[o + 2]
          let fbi = F[o + 3]
          let T = heroT
          let sl = slots[0]
          let s0 = it.k + 1 - (J + lo)
          const lit = fr && flash.side === it.side ? fl : 0
          if (!it.hero) {
            const c = it.size * Math.cos(it.tilt)
            const s = it.size * Math.sin(it.tilt)
            fbr += far * it.rx - fai * it.ry
            fbi += far * it.ry + fai * it.rx
            const nr = far * c - fai * s
            fai = far * s + fai * c
            far = nr
            sl = slots[it.slot]
            T = compT
            s0 = 0
            const ph = it.ph
            for (let q = 0; q < D; q++) {
              const th0 = A * Math.sin(1.1 * wave + ph - LAG * (q + 1))
              bend(compT, q, sl.maps, th0, 3 * th0)
            }
          }
          const cum = sl.cum
          const maps = sl.maps
          const c0 = cum[0]
          const c1 = cum[1]
          const c2 = cum[2]
          const p0 = maps[0][6]
          const p02 = p0 + maps[2][6]
          const p023 = p02 + maps[3][6]
          const mir = it.mirror ? -1 : 1
          const a = it.a
          let ox = sl.x
          let oy = sl.y
          for (let j = 0; j < cnt; j++) {
            // A step of the slot's orbit: the base point.
            let u = rnd()
            let i = u < c0 ? 0 : u < c1 ? 1 : u < c2 ? 2 : 3
            const m = maps[i]
            let x = m[0] * ox + m[1] * oy + m[4]
            let y = m[2] * ox + m[3] * oy + m[5]
            if (!(Math.abs(x) < 1e3 && Math.abs(y) < 1e3)) {
              x = 0
              y = 0
            }
            ox = x
            oy = y
            // The waved address, the deepest map first.
            let up = 0
            const first = it.hero ? 1 : 0
            for (let q = D - 1; q >= 0; q--) {
              u = rnd()
              i = u < c0 ? 0 : u < c1 ? 1 : u < c2 ? 2 : 3
              if (i === 1) up++
              const e = 24 * (s0 + first + q) + 6 * i
              const nx = T[e] * x + T[e + 1] * y + T[e + 4]
              y = T[e + 2] * x + T[e + 3] * y + T[e + 5]
              x = nx
            }
            // The hero's shell: its copy's stem or a leaflet.
            let side = it.side
            if (it.hero) {
              u = rnd() * p023
              i = u < p0 ? 0 : u < p02 ? 2 : 3
              side = i === 2 ? -1 : i === 3 ? 1 : 0
              const e = 24 * s0 + 6 * i
              const nx = T[e] * x + T[e + 1] * y + T[e + 4]
              y = T[e + 2] * x + T[e + 3] * y + T[e + 5]
              x = nx
            }
            x *= mir
            const X = far * x - fai * y + fbr
            const Y = far * y + fai * x + fbi
            const lt = it.hero ? (fr && flash.side === side ? fl : 0) : lit
            plot(X, Y, it.hue + 9 * up + 25 * side, a, lt)
          }
          sl.x = ox
          sl.y = oy
        }

        for (let i = 0; i < px.length; i++) {
          const R = (r[i] *= fade)
          const G = (gr[i] *= fade)
          const B = (b[i] *= fade)
          px[i] = 0xff000000 | (Math.min(255, 300 * B / (B + K)) << 16) | (Math.min(255, 300 * G / (G + K)) << 8) | Math.min(255, 300 * R / (R + K))
        }
        bg.putImageData(img, 0, 0)
        g.imageSmoothingEnabled = true
        g.drawImage(buf, 0, 0, w, h)
      },

      // A click lights the fronds on its side of the pane in gold and
      // blows a gust.
      pointer (kind, x) {
        if (kind !== 'down') return
        flash = { side: x < canvas.width / 2 ? -1 : 1, rgb: hueRgb(48), t: tick }
        gust = Math.max(gust, 0.7)
        clicks++
      },

      // For the live checks: the clicks and the octaves zoomed.
      probe () {
        return { clicks, zoom: octaves }
      }
    }
  }

  if (typeof module === 'object' && module.exports) module.exports = { SPECIES, UNIT, iterate, frames }
  else (root.VizCanvas = root.VizCanvas || {}).fern = create
})(this)
