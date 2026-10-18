'use strict'
// Fern mode (decision 0015): a night garden of fern fronds, one a turn.
// A prompt sends up a fiddlehead, which unrolls along its spiral as the
// turn works, pinna by pinna from the foot, and opens at the stop. A tool
// call lights the pinna behind the coil in its class's colour, which
// keeps a trace, and looses spores of that colour. An output event runs
// light up the rachis, a subagent sprouts a small frond at the turn's
// foot, a compaction withers the older half of the garden, and the
// stop and the treble blow wind through it. At idle the fronds curl half
// shut, the hues pale to moonlight and fireflies come out. Behind, a
// still forest of the four species grown by the chaos game. A press
// curls the fronds near it, and gold spores rise from it.

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


  const CLASS_HUE = [200, 120, 40, 0, 280, 320]
  // Rachis nodes per frond, pinna stations per side, nodes per pinna.
  const NN = 44
  const NS = 22
  const NP = 8
  // Turns' fronds and subagents' fronds on the ground at most.
  const MAXF = 6
  const MAXB = 3
  // The stipe: the stalk below the blade, open even in a fiddlehead.
  const STIPE = 0.28

  function smooth (x) {
    const t = Math.max(0, Math.min(1, x))
    return t * t * (3 - 2 * t)
  }

  function hsl (h, s, l) {
    h = ((h % 360) + 360) % 360
    const f = n => {
      const k = (n + h / 30) % 12
      return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    }
    return [f(0), f(8), f(4)]
  }

  // A strand, a rachis or a pinna, from its foot (x, y) heading a
  // (radians from up, clockwise, y down), length len. Its part c from the
  // foot is open, bent by bend in all and by sway(s) per unit length; the
  // rest is a coil of T turns whose curvature grows as s^1.5 toward the
  // tip, as a fiddlehead's. Fills P with x, y, heading and s per node,
  // the coil given at least its share of the n segments; returns n + 1.
  function strand (x, y, a, len, c, T, bend, sway, P, n) {
    let k = 0
    P[k++] = x
    P[k++] = y
    P[k++] = a
    P[k++] = 0
    const ub = 1 - Math.min(0.6, 1.6 * (1 - c))
    let s0 = 0
    for (let i = 1; i <= n; i++) {
      const u = i / n
      const s = u <= ub ? c * u / ub : c + (1 - c) * (u - ub) / (1 - ub)
      const ds = s - s0
      const mid = (s + s0) / 2
      a += (bend + sway(mid)) * ds
      if (mid > c) a += T * 2 * Math.PI * 2.5 * Math.pow((mid - c) / (1 - c), 1.5) * ds / (1 - c)
      x += len * ds * Math.sin(a)
      y -= len * ds * Math.cos(a)
      P[k++] = x
      P[k++] = y
      P[k++] = a
      P[k++] = s
      s0 = s
    }
    return n + 1
  }

  const still = () => 0

  function create (canvas) {
    const out = canvas.getContext('2d')
    const buf = document.createElement('canvas')
    // On the CPU: the pixels are written there, and blitted once.
    const bg = buf.getContext('2d', { willReadFrequently: true })
    const mark = {}
    const P = new Float64Array(4 * (NN + 1))
    const Q = new Float64Array(4 * (NP + 1))
    let img = null
    let px = null
    let R = null
    let G = null
    let B = null
    let base = null
    let bw = 0
    let bh = 0
    let cw = 0
    let ch = 0
    let t = 0
    let gust = 0
    let wake = 0
    let hue = 360 * Math.random()
    let ripe = 0
    let clicks = 0
    let grown = 0
    const fronds = []
    const spores = []
    // The light a frame adds, as a share of what a frame of 1/60 s adds:
    // the buffer then holds as much light at any frame rate (draw).
    let gain = 1
    const flies = Array.from({ length: 40 }, () => ({ x: Math.random(), y: 0.25 + 0.65 * Math.random(), ph: 6.3 * Math.random(), v: 0.4 + Math.random() }))

    // A line of light into the buffer, a dot a pixel.
    function line (x0, y0, x1, y1, r, g, b) {
      const dx = x1 - x0
      const dy = y1 - y0
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))))
      const sx = dx / n
      const sy = dy / n
      let x = x0
      let y = y0
      for (let i = 0; i < n; i++) {
        const ix = x | 0
        const iy = y | 0
        if (ix >= 0 && iy >= 0 && ix < bw && iy < bh) {
          const at = iy * bw + ix
          R[at] += r * gain
          G[at] += g * gain
          B[at] += b * gain
        }
        x += sx
        y += sy
      }
    }

    // A soft dot of light of radius rad.
    function glow (x, y, rad, r, g, b) {
      const x0 = Math.max(0, Math.floor(x - rad))
      const x1 = Math.min(bw - 1, Math.ceil(x + rad))
      const y0 = Math.max(0, Math.floor(y - rad))
      const y1 = Math.min(bh - 1, Math.ceil(y + rad))
      const k = 1 / (rad * rad)
      for (let iy = y0; iy <= y1; iy++) {
        for (let ix = x0; ix <= x1; ix++) {
          const d = ((ix - x) * (ix - x) + (iy - y) * (iy - y)) * k
          if (d >= 1) continue
          const w = (1 - d) * (1 - d) * gain
          const at = iy * bw + ix
          R[at] += r * w
          G[at] += g * w
          B[at] += b * w
        }
      }
    }

    // The widest gap on the ground.
    function place () {
      let best = 0.5
      let far = -1
      for (let k = 0; k < 24; k++) {
        const x = 0.18 + 0.64 * Math.random()
        let d = 1
        for (const f of fronds) if (!f.wither && !f.baby) d = Math.min(d, Math.abs(f.x - x))
        if (d > far) {
          far = d
          best = x
        }
      }
      return best
    }

    // A frond: a fiddlehead at the foot of the ground. Past the cap the
    // oldest of its kind withers.
    function sprout (opts) {
      const x = opts.x ?? place()
      hue = (hue + 67 + 40 * Math.random()) % 360
      // Each leans away from the middle, as a crown of fronds spreads.
      const side = x < 0.5 ? -1 : 1
      const f = { x, scale: 0.8 + 0.2 * Math.random(), hue, open: 0, rise: 0, ph: 6.3 * Math.random(), side, lean: side * (0.05 + 0.15 * Math.random()), tint: new Float32Array(NS), thue: new Float32Array(NS), wither: 0, shy: 0, sap: [], born: t, baby: false, parent: null, puff: null, goal: 0, next: 0, ...opts }
      fronds.push(f)
      const kin = fronds.filter(q => !q.wither && q.baby === f.baby)
      if (kin.length > (f.baby ? MAXB : MAXF)) kin[0].wither = 0.001
      return f
    }
    for (let i = 0; i < 4; i++) {
      const f = sprout({ x: 0.18 + 0.64 * (i + 0.3 * Math.random()) / 3.3 })
      f.open = 0.9 + 0.1 * Math.random()
      f.rise = 1
    }
    const first = sprout({})
    first.open = 0.2
    first.rise = 1

    // The turn's frond: the newest that is no subagent's and not
    // withering.
    function active () {
      for (let i = fronds.length - 1; i >= 0; i--) if (!fronds[i].wither && !fronds[i].baby) return fronds[i]
      return sprout({})
    }

    function react (e) {
      const f = active()
      if (e.kind === 3) {
        // The last turn's frond opens the rest of the way.
        f.goal = 1
        sprout({})
        wake = 1
      } else if (e.kind === 2) {
        // The pinna behind the coil lights and keeps a trace, each call
        // the next pinna up, so a turn's tools stack from the foot.
        const j = Math.min(NS - 1, Math.max(f.next, Math.floor(0.9 * NS * f.open)))
        f.next = j + 1
        const h = CLASS_HUE[e.cls] ?? 200
        f.tint[j] = 1
        f.thue[j] = h
        f.puff = { j, h }
      } else if (e.kind === 4) {
        gust = 1
        f.goal = 1
      } else if (e.kind === 5) {
        sprout({ x: f.x - f.side * 0.045, baby: true, parent: f, scale: 0.3 + 0.1 * Math.random(), hue: f.hue + 40, side: -f.side, lean: -f.side * 0.3 })
      } else if (e.kind === 6) {
        const live = fronds.filter(q => !q.wither && q !== f)
        for (const q of live.slice(0, Math.ceil(live.length / 2))) q.wither = 0.001
      } else {
        f.sap.push(t)
        if (f.sap.length > 6) f.sap.shift()
        f.open = Math.min(1, f.open + 0.01)
      }
    }

    // The backdrop, once per size: the night, the far forest of the four
    // species grown by the chaos game, the mist on the ground.
    function backdrop () {
      base = new Uint8ClampedArray(3 * bw * bh)
      const sh = new Float32Array(bw * bh)
      const p = { x: 0, y: 0 }
      for (let k = 0; k < 22; k++) {
        const maps = UNIT[k % 4]
        let acc = 0
        const cum = maps.map(m => (acc += m[6]))
        for (let j = 0; j < 4; j++) cum[j] /= acc
        const far = k % 2
        const hh = bh * (0.3 + 0.35 * Math.random()) * (far ? 0.65 : 1)
        const fx = bw * (k + Math.random()) / 22
        const fy = bh * (far ? 0.88 : 1.02)
        const mir = Math.random() < 0.5 ? -1 : 1
        const tilt = 0.25 * (Math.random() - 0.5)
        const co = Math.cos(tilt)
        const si = Math.sin(tilt)
        const w = far ? 0.35 : 0.7
        iterate(maps, cum, Math.round(hh * 200), p, (x, y) => {
          const ix = (fx + (mir * x * co - y * si) * hh) | 0
          const iy = (fy - (mir * x * si + y * co) * hh) | 0
          if (ix >= 0 && iy >= 0 && ix < bw && iy < bh) sh[iy * bw + ix] += w
        })
      }
      for (let iy = 0; iy < bh; iy++) {
        const mist = smooth((iy / bh - 0.5) / 0.5)
        for (let ix = 0; ix < bw; ix++) {
          const at = iy * bw + ix
          const d = sh[at] / (sh[at] + 2)
          base[3 * at] = 3 + 10 * mist + 24 * d
          base[3 * at + 1] = 6 + 22 * mist + 54 * d
          base[3 * at + 2] = 14 + 30 * mist + 60 * d
        }
      }
    }

    // One frond into the buffer. rank: 1 the newest, less the older.
    function frond (f, L, idle, rank) {
      const S = bh / 380
      const H = bh * f.scale * (0.3 + 0.7 * smooth(f.rise)) * (1 - 0.4 * smooth(f.wither))
      const bx = f.x * bw
      const by = bh * 1.01 + bh * 0.5 * smooth(f.wither)
      // Asleep at idle, shy of the pointer, curled back as it withers.
      const open = f.open * (1 - 0.5 * idle) * (1 - 0.8 * f.shy) * (1 - f.wither)
      const c = STIPE + (1 - STIPE) * open
      const T = f.side * (0.35 + 2.2 * (1 - open))
      // The wind: a wave out along the rachis, its own phase per frond.
      const w0 = (0.12 + 0.35 * gust + 0.15 * L.treble) * (1 - 0.7 * idle)
      const ph = 1.3 * t + f.ph
      const n = strand(bx, by, f.lean + 0.06 * w0 * Math.sin(ph), H, c, T, f.side * 0.35, s => w0 * f.side * Math.sin(ph - 3.5 * s), P, NN)
      // Hues drifting from the foot to the tip, moonlit at idle, amber
      // and dim as it withers, the newest brightest.
      const drift = f.hue + 14 * t * (1 - 0.8 * idle)
      const sat = (0.9 - 0.6 * idle) * (1 - 0.6 * f.wither)
      const fresh = Math.max(0, 1 - (t - f.born) / 4)
      const lum = (0.25 + 0.75 * rank) * (1 - 0.35 * idle) * (1 - 0.7 * smooth(f.wither)) * (1 + 0.8 * fresh + 0.4 * wake * rank)
      const amp = 0.55 * lum
      const tone = h => h + (40 - h) * f.wither
      for (let i = 1; i < n; i++) {
        const v = hsl(tone(drift + 100 * P[4 * i + 3]), sat, 0.5)
        const k = 1.2 * amp
        line(P[4 * i - 4], P[4 * i - 3], P[4 * i], P[4 * i + 1], v[0] * k, v[1] * k, v[2] * k)
        line(P[4 * i - 4] + 1, P[4 * i - 3], P[4 * i] + 1, P[4 * i + 1], v[0] * k, v[1] * k, v[2] * k)
      }
      // The pinnae at fixed stations of the blade, so they stay put as
      // the rachis opens, each curled until the coil has passed it.
      const flutter = 0.05 + 0.15 * L.treble + 0.2 * gust
      let i = 1
      for (let j = 0; j < NS; j++) {
        const s = STIPE + (1 - STIPE) * (j + 0.5) / NS
        while (i < n - 1 && P[4 * i + 3] < s) i++
        const s0 = P[4 * i - 1]
        const s1 = P[4 * i + 3]
        const u = s1 > s0 ? Math.min(1, (s - s0) / (s1 - s0)) : 1
        const x = P[4 * i - 4] + (P[4 * i] - P[4 * i - 4]) * u
        const y = P[4 * i - 3] + (P[4 * i + 1] - P[4 * i - 3]) * u
        const a = P[4 * i - 2] + (P[4 * i + 2] - P[4 * i - 2]) * u
        const cp = smooth((c - s) / 0.18 + 0.1)
        const b = (s - STIPE) / (1 - STIPE)
        const lp = H * 0.24 * Math.min(1, 0.45 + 3 * b) * Math.pow(1 - b, 0.85) * (0.2 + 0.8 * cp)
        if (lp < 1) continue
        let v
        let k = amp
        if (f.tint[j] > 0.02) {
          v = hsl(f.thue[j], 1, 0.55)
          k = Math.max(amp, 0.6) * (0.8 + 1.2 * f.tint[j])
        } else v = hsl(tone(drift + 100 * s + 25), sat, 0.5)
        const r = v[0] * k
        const g = v[1] * k
        const bb = v[2] * k
        for (let side = -1; side <= 1; side += 2) {
          const ang = a + side * (0.2 + 0.85 * cp) * (1 - 0.15 * b) + flutter * Math.sin(2.7 * t + 9 * s + side + f.ph)
          const m = strand(x, y, ang, lp, 0.15 + 0.85 * cp, -side * (0.25 + 1.2 * (1 - cp)), side * 0.25 * cp, still, Q, NP)
          for (let q = 1; q < m; q++) line(Q[4 * q - 4], Q[4 * q - 3], Q[4 * q], Q[4 * q + 1], r, g, bb)
          if (cp < 0.4 || lp < 6) continue
          // The pinnules, a comb along the pinna.
          for (let q = 1; q < m - 1; q++) {
            const pl = lp * 0.16 * (1 - 0.8 * q / m) * cp
            for (let sd = -1; sd <= 1; sd += 2) {
              const aa = Q[4 * q + 2] + sd * 0.75
              line(Q[4 * q], Q[4 * q + 1], Q[4 * q] + pl * Math.sin(aa), Q[4 * q + 1] - pl * Math.cos(aa), 0.8 * r, 0.8 * g, 0.8 * bb)
            }
          }
        }
        if (f.puff && f.puff.j === j) {
          const h = hsl(f.puff.h, 1, 0.6)
          for (let q = 0; q < 26; q++) spores.push({ x, y, vx: S * 50 * (Math.random() - 0.5), vy: S * (-15 - 40 * Math.random()), c: h, t })
          f.puff = null
        }
      }
      // Sap: an output event's light running up the rachis to the coil.
      for (const s0 of f.sap) {
        const u = (t - s0) / 1.2
        if (u > 1) continue
        const at = Math.min(n - 1, Math.floor(u * (n - 1)))
        const v = hsl(drift + 140, 0.6, 0.7)
        glow(P[4 * at], P[4 * at + 1], 4 * S + 2, 1.5 * v[0], 1.5 * v[1], 1.5 * v[2])
      }
      // The coil glows while it is a coil.
      if (open < 0.9) {
        const v = hsl(drift + 100, sat, 0.6)
        const k = 0.5 * (1 - open) * lum
        glow(P[4 * n - 4], P[4 * n - 3], 10 * S + 2, v[0] * k, v[1] * k, v[2] * k)
      }
    }

    return {
      draw (synth, dt) {
        const w = canvas.width
        const h = canvas.height
        if (w < 4 || h < 4) return
        if (w !== cw || h !== ch) {
          cw = w
          ch = h
          const k = Math.max(1, Math.sqrt(w * h / 160000))
          bw = buf.width = Math.max(1, Math.round(w / k))
          bh = buf.height = Math.max(1, Math.round(h / k))
          img = bg.createImageData(bw, bh)
          px = new Uint32Array(img.data.buffer)
          R = new Float32Array(bw * bh)
          G = new Float32Array(bw * bh)
          B = new Float32Array(bw * bh)
          backdrop()
        }
        for (const e of synth.since(mark)) react(e)
        const L = synth.level
        const idle = L.idle
        const bass = Math.min(1, L.bass)
        t += dt
        gust *= Math.exp(-dt / 1.8)
        wake *= Math.exp(-dt / 1.5)

        // The turn's frond rises and unrolls as the session works; on the
        // sound output alone, a frond fully open sprouts the next while
        // the sound goes on.
        const f = active()
        f.rise = Math.min(1, f.rise + dt / 2.5)
        const was = f.open
        f.open = Math.min(1, f.open + dt * (0.004 + 0.04 * bass + 0.02 * L.busy) * (1 - idle))
        grown += f.open - was
        if (f.open > 0.97) {
          ripe += dt * bass
          if (ripe > 4) {
            ripe = 0
            sprout({})
          }
        }
        for (const q of fronds) {
          if (q.goal && q.open < 1) {
            grown += Math.min(1 - q.open, dt * 0.5)
            q.open = Math.min(1, q.open + dt * 0.5)
          }
          if (q.baby) {
            q.rise = Math.min(1, q.rise + dt / 2)
            q.open = Math.min(1, q.open + dt * 0.1 * (1 - 0.8 * idle))
            if (!q.wither && q.parent.wither) q.wither = 0.001
          }
          if (q.wither) q.wither = Math.min(1, q.wither + dt / 5)
          q.shy *= Math.exp(-dt / 2.5)
          for (let j = 0; j < NS; j++) if (q.tint[j] > 0.3) q.tint[j] = Math.max(0.3, q.tint[j] * Math.exp(-dt / 3))
        }
        for (let i = fronds.length - 1; i >= 0; i--) if (fronds[i].wither >= 1) fronds.splice(i, 1)

        // The light fades fast at work, lingers at idle. A light held
        // still fills the buffer to its added light over 1 - fade, so
        // each frame adds its light times (1 - fade) / (1 - fade of 1/60
        // s): as much at 15 frames a second as at 60.
        const tau = 0.06 + 0.5 * idle
        const fade = Math.exp(-dt / tau)
        gain = (1 - fade) / (1 - Math.exp(-1 / 60 / tau))
        for (let i = 0; i < R.length; i++) {
          R[i] *= fade
          G[i] *= fade
          B[i] *= fade
        }
        fronds.forEach((q, i) => frond(q, L, idle, (i + 1) / fronds.length))
        const S = bh / 380
        for (let i = spores.length - 1; i >= 0; i--) {
          const p = spores[i]
          const age = t - p.t
          if (age > 5) {
            spores.splice(i, 1)
            continue
          }
          p.vy += 6 * S * dt
          p.x += (p.vx + 14 * S * Math.sin(1.3 * t + i)) * dt
          p.y += p.vy * dt
          const a = 0.5 * (1 - age / 5)
          glow(p.x, p.y, 2.2 * S + 1, p.c[0] * a, p.c[1] * a, p.c[2] * a)
        }
        if (spores.length > 400) spores.splice(0, spores.length - 400)
        // Fireflies come out at idle.
        for (const q of flies) {
          const a = (0.05 + 0.6 * idle) * Math.max(0, Math.sin(1.7 * q.v * t + q.ph))
          if (a < 0.02) continue
          glow((q.x + 0.05 * Math.sin(0.23 * t * q.v + q.ph)) * bw, (q.y + 0.04 * Math.sin(0.31 * t + 2 * q.ph)) * bh, 2.5 * S + 1.2, a, 0.9 * a, 0.45 * a)
        }
        const K = 0.6
        for (let i = 0; i < px.length; i++) {
          const r = R[i]
          const g = G[i]
          const b = B[i]
          const o = 3 * i
          px[i] = 0xff000000 | (Math.min(255, base[o + 2] + 280 * b / (b + K)) << 16) | (Math.min(255, base[o + 1] + 280 * g / (g + K)) << 8) | Math.min(255, base[o] + 280 * r / (r + K))
        }
        bg.putImageData(img, 0, 0)
        out.imageSmoothingEnabled = true
        out.drawImage(buf, 0, 0, w, h)
      },

      // A press: the fronds near it curl up as a sensitive plant's do
      // and slowly unroll, and a puff of gold spores rises from it.
      pointer (kind, x, y) {
        if (kind !== 'down' || !cw) return
        clicks++
        for (const f of fronds) if (Math.abs(f.x * cw - x) < cw * 0.2) f.shy = 1
        const S = bh / 380
        const c = hsl(48, 1, 0.6)
        for (let k = 0; k < 30; k++) spores.push({ x: x * bw / cw, y: y * bh / ch, vx: S * 70 * (Math.random() - 0.5), vy: S * (-20 - 50 * Math.random()), c, t })
      },

      // For the live checks: the clicks, the unrolling so far, the fronds,
      // and for the tests the light the buffer holds.
      probe () {
        let light = 0
        if (R) for (let i = 0; i < R.length; i++) light += R[i] + G[i] + B[i]
        return { clicks, grown, fronds: fronds.length, light }
      }
    }
  }

  if (typeof module === 'object' && module.exports) module.exports = { SPECIES, UNIT, iterate, strand }
  else (root.VizCanvas = root.VizCanvas || {}).fern = create
})(this)
