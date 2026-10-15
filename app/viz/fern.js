'use strict'
// Fern mode (decision 0015): an iterated function system, Barnsley's fern
// and three relatives, grown point by point by the chaos game into a
// density buffer that fades. The signal steers it: the growth rate from
// the bass and the busy level, a prompt morphs to the next species, a
// tool call feeds the leaflets on the side its class picks and lights
// them in the class's colour, a stop and the treble blow wind through
// it, a subagent sprouts a small frond at its foot, and an idle spell
// slows the growth and turns it amber.

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
  // Each map's colour: stem brown, then three greens.
  const MAP_RGB = [[0.55, 0.38, 0.18], [0.3, 0.85, 0.35], [0.6, 1, 0.45], [0.12, 0.62, 0.3]]
  const CLASS_HUE = [200, 120, 40, 0, 280, 320]
  const K = 12

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
    const sprouts = []
    const orbit = { x: 0, y: 0 }
    // The view box, eased toward the box the points fill.
    const box = { x0: -2.5, x1: 2.8, y0: 0, y1: 10 }
    const seen = { x0: 0, x1: 0, y0: 0, y1: 0 }
    const col = [0.3, 0.8, 0.3]
    // The leaflet map last applied, 2 or 3, which the frond's own map
    // keeps: the side of the frond the point is on. 0 on the stem.
    let side = 0
    const maps = [[], [], [], []]
    const cum = new Float32Array(4)

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
          // The old frond dims at once, so the prompt shows before the
          // morph has grown.
          for (const a of [r, gr, b]) for (let i = 0; i < a.length; i++) a[i] *= 0.3
        } else if (e.kind === 2) {
          flash = { map: 2 + (e.cls % 2), rgb: hueRgb(CLASS_HUE[e.cls] ?? 200), t: synth.t }
        } else if (e.kind === 4) {
          gust = 1
        } else if (e.kind === 5) {
          sprouts.push({ t: synth.t, side: sprouts.length % 2 ? -1 : 1 })
          if (sprouts.length > 3) sprouts.shift()
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

    return {
      draw (synth, dt) {
        const w = canvas.width
        const h = canvas.height
        if (w < 2 || h < 2) return
        if (w !== cw || h !== ch) resize(w, h)
        react(synth)
        const L = synth.level
        const t = synth.t
        const idle = L.idle
        morph = Math.min(1, morph + dt / 2.5)
        gust *= Math.exp(-dt / 1.5)
        burst *= Math.exp(-dt / 0.8)
        for (let i = sprouts.length - 1; i >= 0; i--) if (t - sprouts[i].t > 25) sprouts.splice(i, 1)

        // The maps of the moment: a morph between two species, the
        // flashed leaflet's weight raised.
        const m = smooth(morph)
        const fa = SPECIES[from]
        const fb = SPECIES[to]
        const fl = flash ? Math.max(0, 1 - (t - flash.t) / 1.6) : 0
        if (fl === 0) flash = null
        let sum = 0
        for (let k = 0; k < 4; k++) {
          for (let j = 0; j < 7; j++) maps[k][j] = fa[k][j] + (fb[k][j] - fa[k][j]) * m
          if (flash && k === flash.map) maps[k][6] *= 1 + 4 * fl
          sum += maps[k][6]
        }
        let acc = 0
        for (let k = 0; k < 4; k++) {
          acc += maps[k][6] / sum
          cum[k] = acc
        }

        // Growth and fading: fast and short-lived at work, a slow
        // trickle that lingers at idle.
        const rate = (40000 + 300000 * Math.min(1, L.bass) + 150000 * L.busy + 200000 * burst) * (1 - 0.8 * idle)
        const n = Math.min(12000, Math.round(rate * dt))
        const fade = Math.exp(-dt / (1.5 + 5 * idle))

        const x0 = box.x0
        const y0 = box.y0
        const sw = box.x1 - box.x0
        const sh = box.y1 - box.y0
        // Room on each side for the wind.
        const s = Math.min(bw * 0.8 / sw, bh * 0.94 / sh)
        const ox = (bw - sw * s) / 2
        const oy = bh - (bh - sh * s) / 2
        const bend = (0.02 + 0.05 * L.treble) * Math.sin(t * 1.1) + 0.1 * gust * Math.sin(t * 6) + 0.02 * idle * Math.sin(t * 0.5)
        // Amber with the season.
        const au = idle
        seen.x0 = seen.y0 = Infinity
        seen.x1 = seen.y1 = -Infinity
        const tr = flash ? flash.rgb : null
        const sp = sprouts.length
        // A point into the buffer, bent by the wind; a sprout's turned by
        // ang about the foot, shrunk and mirrored by side.
        const plot = (x, y, rgb, a, side, ang) => {
          const u = (y - y0) / sh
          let X = x + bend * u * u * sh
          let Y = y
          if (ang) {
            const c = Math.cos(ang)
            const si = Math.sin(ang)
            const dx = X - (x0 + sw / 2)
            const dy = Y - y0
            X = x0 + sw / 2 + side * (dx * c - dy * si) * 0.4
            Y = y0 + (dx * si + dy * c) * 0.4
          }
          const ix = Math.floor(ox + (X - x0) * s)
          const iy = Math.floor(oy - (Y - y0) * s)
          if (ix < 0 || iy < 0 || ix >= bw || iy >= bh) return
          const at = iy * bw + ix
          r[at] += rgb[0] * a
          gr[at] += rgb[1] * a
          b[at] += rgb[2] * a
        }
        const rgb = [0, 0, 0]
        iterate(maps, cum, n, orbit, (x, y, k, i) => {
          if (x < seen.x0) seen.x0 = x
          if (x > seen.x1) seen.x1 = x
          if (y < seen.y0) seen.y0 = y
          if (y > seen.y1) seen.y1 = y
          const c = MAP_RGB[k]
          for (let j = 0; j < 3; j++) col[j] += (c[j] - col[j]) * 0.3
          const lum = 0.3 * col[0] + 0.6 * col[1] + 0.1 * col[2]
          rgb[0] = col[0] + (lum * 1.3 - col[0]) * au
          rgb[1] = col[1] + (lum * 0.7 - col[1]) * au
          rgb[2] = col[2] + (lum * 0.15 - col[2]) * au
          if (k === 0 || k > 1) side = k
          if (tr && side === flash.map) for (let j = 0; j < 3; j++) rgb[j] += (1.4 * tr[j] - rgb[j]) * fl
          plot(x, y, rgb, 1, 1, 0)
          if (sp && (i & 3) === 0) {
            const sv = sprouts[(i >> 2) % sp]
            const a = Math.min(1, (t - sv.t) / 2) * Math.max(0, 1 - (t - sv.t) / 25)
            plot(x, y, rgb, a, sv.side, sv.side * 0.5)
          }
        })
        if (n > 50 && seen.x1 > seen.x0 && seen.y1 > seen.y0) {
          const e = 1 - Math.exp(-dt * 2)
          for (const key of ['x0', 'x1', 'y0', 'y1']) box[key] += (seen[key] - box[key]) * e
        }

        for (let i = 0; i < px.length; i++) {
          const R = (r[i] *= fade)
          const G = (gr[i] *= fade)
          const B = (b[i] *= fade)
          px[i] = 0xff000000 | (Math.min(255, 320 * B / (B + K)) << 16) | (Math.min(255, 320 * G / (G + K)) << 8) | Math.min(255, 320 * R / (R + K))
        }
        bg.putImageData(img, 0, 0)
        g.imageSmoothingEnabled = false
        g.drawImage(buf, 0, 0, w, h)
      }
    }
  }

  if (typeof module === 'object' && module.exports) module.exports = { SPECIES, iterate }
  else (root.VizCanvas = root.VizCanvas || {}).fern = create
})(this)
