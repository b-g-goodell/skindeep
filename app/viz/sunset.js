'use strict'
// Sunset clouds mode (decision 0015, issue #189): cumulus over the
// plains of the US Southwest as the sun sets, painted in watercolour
// after Georgia O'Keeffe's skies: smooth rounded forms, soft graded
// colour, a low horizon under a wide sky, a mesa or two.
//
// The clouds are volumes. Each is a few smooth ellipsoidal blobs with a
// flat base, marched along the view ray at a low resolution: at each
// step the optical depth toward the sun is the closed-form integral of
// every blob's density along the sun's ray, so a cloud is bright on its
// sunward side, shadowed and coloured within, and lets the light
// through its thin edges, the more so toward the sun. A march keeps
// three light sums a sample (sun, sky, ground) and the alpha, so a
// change of the light's colour repaints a cloud without a new march.
// Marches run under a time budget a frame, a cloud at a time, and a
// cloud is marched again only when the sun has moved a degree or its
// shape or size has changed. The watercolour is in the repaint: wobbly
// wet and dry edges, pigment pooled at a wash's edge, uneven pigment and
// granulation, by Bousseau's density modulation (Bousseau, Kaplan,
// Thollot and Sillion, "Interactive watercolor rendering with temporal
// coherence and abstraction", NPAR 2006). The sky and the land are
// painted the same way on cached canvases, again when the light moves,
// and a paper tile lies over all.
// The signal, the clock and the pointer: see react, draw and pointer.

;(function (root) {
  const DEG = Math.PI / 180
  const CLASS_HUE = [200, 120, 40, 0, 280, 320]
  // The view: its horizontal field, the horizon's height in the pane.
  const HFOV = 76 * DEG
  const HORIZON = 0.76
  // One sunset, seconds of the clock, and the sun's elevation, degrees,
  // at its start and end. Idle sinks the sun up to IDLE_DIP more.
  const CYCLE = 300
  const EL0 = 10
  const EL1 = -7
  const IDLE_DIP = 6
  // The clouds: the number the sky keeps, the most, their base's height
  // and depth range, metres.
  const KEEP = 11
  const MOST = 18
  const BASE = 1900
  const ZMIN = 2600
  const ZMAX = 40000
  // The volume: extinction a metre for the view and for the sun's ray,
  // steps a view ray.
  const SIG = 0.0042
  const SIGL = 0.011
  const STEPS = 12
  // Milliseconds of marching and repainting a frame.
  const BUDGET = 2.5
  // The light by the sun's elevation, degrees: the sun's colour and
  // strength, the zenith, the horizon under the sun and away from it.
  const PAL = [
    [12, [1.00, 0.93, 0.78], 1.00, [0.40, 0.62, 0.80], [1.00, 0.94, 0.78], [0.88, 0.86, 0.82]],
    [6, [1.00, 0.80, 0.56], 1.00, [0.42, 0.60, 0.79], [1.00, 0.86, 0.62], [0.93, 0.80, 0.74]],
    [2, [1.00, 0.64, 0.40], 0.95, [0.45, 0.56, 0.75], [1.00, 0.74, 0.48], [0.95, 0.74, 0.70]],
    [0, [0.99, 0.50, 0.33], 0.88, [0.44, 0.50, 0.71], [0.99, 0.64, 0.42], [0.93, 0.68, 0.70]],
    [-2, [0.94, 0.40, 0.42], 0.75, [0.40, 0.43, 0.65], [0.95, 0.56, 0.44], [0.85, 0.62, 0.70]],
    [-4, [0.74, 0.32, 0.46], 0.55, [0.33, 0.33, 0.55], [0.84, 0.48, 0.46], [0.70, 0.54, 0.66]],
    [-7, [0.36, 0.22, 0.40], 0.30, [0.22, 0.22, 0.40], [0.56, 0.34, 0.42], [0.46, 0.38, 0.54]],
    [-11, [0.14, 0.10, 0.24], 0.12, [0.13, 0.13, 0.28], [0.30, 0.22, 0.34], [0.26, 0.23, 0.37]]
  ]
  // The land's bands, far to near: pigment, share of sunlight, haze.
  const LAND = [
    { pig: [0.56, 0.54, 0.72], sun: 0.15, haze: 0.55 },
    { pig: [0.66, 0.40, 0.44], sun: 0.22, haze: 0.32 },
    { pig: [0.86, 0.70, 0.58], sun: 0.40, haze: 0.38 },
    { pig: [0.84, 0.62, 0.52], sun: 0.45, haze: 0.24 },
    { pig: [0.74, 0.66, 0.56], sun: 0.42, haze: 0.12 },
    { pig: [0.76, 0.50, 0.44], sun: 0.40, haze: 0.03 }
  ]

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v
  const sstep = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)
  const mix = (a, b, t) => a + (b - a) * t

  // mulberry32, as quantum.js has it.
  function rng (a) {
    return function () {
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  // A lattice hash to [0, 1), and value noise and its sum of octaves.
  function hash (i, j, s) {
    let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041)) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }
  function noise (x, y, s) {
    const i = Math.floor(x)
    const j = Math.floor(y)
    const u = sstep(x - i)
    const v = sstep(y - j)
    const a = hash(i, j, s)
    const b = hash(i + 1, j, s)
    const c = hash(i, j + 1, s)
    const d = hash(i + 1, j + 1, s)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
  function fbm (x, y, s, n) {
    let v = 0
    let a = 0.5
    let t = 0
    for (let k = 0; k < n; k++) {
      v += a * noise(x, y, s + k * 31)
      t += a
      x *= 2.03
      y *= 2.03
      a *= 0.5
    }
    return v / t
  }

  // The light at a sun elevation, degrees: { sun, I, zen, hs, ha, amb,
  // bounce }, colours as [r, g, b] in [0, 1].
  function palette (el) {
    let k = 0
    while (k < PAL.length - 2 && el < PAL[k + 1][0]) k++
    const a = PAL[k]
    const b = PAL[k + 1]
    const t = clamp((a[0] - el) / (a[0] - b[0]), 0, 1)
    const lerp = (p, q) => [mix(p[0], q[0], t), mix(p[1], q[1], t), mix(p[2], q[2], t)]
    const p = { sun: lerp(a[1], b[1]), I: mix(a[2], b[2], t), zen: lerp(a[3], b[3]), hs: lerp(a[4], b[4]), ha: lerp(a[5], b[5]) }
    p.amb = [0, 1, 2].map(c => 0.6 * p.zen[c] + 0.4 * p.ha[c])
    const earth = [0.82, 0.52, 0.40]
    p.bounce = [0, 1, 2].map(c => earth[c] * (0.45 * p.sun[c] * p.I + 0.35 * p.amb[c]))
    return p
  }

  // Bousseau's pigment density: d above 1 darkens, below 1 lightens.
  const dens = (c, d) => c * (1 - (1 - c) * (d - 1))
  // A soft shoulder above 0.8.
  const tone = c => c < 0.8 ? c : 0.8 + 0.2 * (1 - Math.exp(-(c - 0.8) / 0.2))

  // The paper, a tile made once for every pane.
  let paper = null
  function makePaper () {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d', { willReadFrequently: true })
    const img = g.createImageData(256, 256)
    const d = img.data
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        // Tooth at two scales, tiled: the noise wraps at 256.
        const t = 0.6 * hash(x, y, 7) + 0.4 * (noise(x / 6, y / 6, 11) * 0.5 + noise(((x + 128) % 256) / 6, y / 6, 11) * 0.5)
        const v = 255 - 16 * t
        const k = 4 * (y * 256 + x)
        d[k] = v
        d[k + 1] = v - 1
        d[k + 2] = v - 4
        d[k + 3] = 255
      }
    }
    g.putImageData(img, 0, 0)
    // Fibres.
    const r = rng(1867)
    g.lineCap = 'round'
    for (let k = 0; k < 220; k++) {
      const x = r() * 256
      const y = r() * 256
      const a = r() * Math.PI
      const l = 4 + r() * 14
      g.strokeStyle = `rgba(120, 100, 80, ${0.04 + 0.05 * r()})`
      g.lineWidth = 0.6
      g.beginPath()
      g.moveTo(x, y)
      g.quadraticCurveTo(x + l * 0.5 * Math.cos(a + 0.4), y + l * 0.5 * Math.sin(a + 0.4), x + l * Math.cos(a), y + l * Math.sin(a))
      g.stroke()
    }
    return c
  }

  function create (canvas) {
    // Drawn on a canvas of the CPU and blitted to the pane once a frame,
    // as the other procedural modes are (decision 0015): every canvas
    // drawn onto it is of the CPU too.
    const out = canvas.getContext('2d')
    const cpu = c => c.getContext('2d', { willReadFrequently: true })
    const layer = document.createElement('canvas')
    const lg = cpu(layer)
    const seed = (Math.random() * 4294967296) >>> 0
    const rnd = rng(seed)
    if (!paper) paper = makePaper()
    const mark = {}
    // The pane and its view: width, height, focal length in pixels, the
    // principal point on the horizon.
    let W = 0
    let H = 0
    let f = 1
    let cx = 0
    let cy = 0
    // The sky and the land, cached, with the geometry of their paint and
    // the elevation they were painted at.
    // Each is painted small, then laid at the pane's size on the paper,
    // so a frame only blits it.
    const sky = { c: document.createElement('canvas'), full: document.createElement('canvas'), el: null, at: -1 }
    const land = { c: document.createElement('canvas'), full: document.createElement('canvas'), el: null, at: -1 }

    // Lay a small painting at the pane's size on the paper: rows y0 to
    // y0 + h of the pane.
    function lay (o, y0, h) {
      const F = o.full
      if (F.width !== W || F.height !== h) {
        F.width = W
        F.height = h
      }
      const fg = cpu(F)
      fg.globalCompositeOperation = 'copy'
      fg.imageSmoothingEnabled = true
      fg.drawImage(o.c, 0, 0, o.G.w, o.G.h, 0, 0, W, o.G.h / o.G.k)
      fg.globalCompositeOperation = 'multiply'
      fg.fillStyle = fg.createPattern(paper, 'repeat')
      fg.translate(0, -y0)
      fg.fillRect(0, y0, W, h)
      fg.setTransform(1, 0, 0, 1, 0, 0)
      // The paper leaves the land's empty sky empty.
      fg.globalCompositeOperation = 'destination-in'
      fg.drawImage(o.c, 0, 0, o.G.w, o.G.h, 0, 0, W, o.G.h / o.G.k)
      fg.globalCompositeOperation = 'source-over'
    }
    // The clock, the sunset's start on it, its side and the wind's.
    let clock = 0
    let start = 0
    let sunAz = 0
    let windSign = 1
    let scene = 0
    let sunsets = 0
    let el = EL0
    let pal = palette(el)
    let wind = 0
    // The clouds, the march in progress, the drops on the paper, the
    // rays, the old painting while it fades, the pointer.
    let clouds = []
    let job = null
    let marches = 0
    let nextId = 1
    const drops = []
    let rays = null
    let fade = null
    let press = null
    let first = true
    let forms = 0
    let thins = 0

    // A new sunset: the sun's side, the wind's, the land's seed, the
    // clock's start somewhere in its first half.
    function sunset (initial) {
      scene = (rnd() * 4294967296) >>> 0
      sunAz = (rnd() < 0.5 ? -1 : 1) * (14 + 14 * rnd()) * DEG
      windSign = rnd() < 0.5 ? -1 : 1
      start = clock - (initial ? (0.15 + 0.3 * rnd()) * CYCLE : 0)
      sky.el = land.el = null
      sky.at = land.at = -1
      clouds = []
      job = null
      sunsets++
    }

    // World to screen, a point at (X, Y, Z) metres, Z ahead.
    const sx = (X, Z) => cx + f * X / Z
    const sy = (Y, Z) => cy - f * Y / Z

    // A cloud: its base's centre (X, Y0, Z), its blobs relative to it,
    // packed as [x, y, z, 1/rx, 1/ry, 1/rz, weight], its height, its
    // size now and the size it grows to, its fade, its sprite.
    function cloud (X, Z, L, o) {
      const r = rng((rnd() * 4294967296) >>> 0)
      const Y0 = BASE * (0.85 + 0.3 * r())
      const flat = o && o.flat !== undefined ? o.flat : r()
      const blobs = []
      // A base row of flattened ovoids, then rounder crowns above.
      const n = 2 + Math.floor(r() * 3)
      const ry0 = L * (0.16 + 0.08 * (1 - flat))
      for (let k = 0; k < n; k++) {
        const u = n === 1 ? 0 : k / (n - 1) - 0.5
        const rx = L * (0.3 + 0.12 * r()) * (1 - 0.35 * Math.abs(u))
        blobs.push([u * L * 0.62 + (r() - 0.5) * L * 0.08, ry0 * 0.45, (r() - 0.5) * L * 0.15, rx, ry0 * (0.9 + 0.3 * r()), rx * (0.7 + 0.3 * r()), 1])
      }
      const m = Math.round((1 - 0.7 * flat) * (1 + r() * 3))
      for (let k = 0; k < m; k++) {
        const u = (r() - 0.5) * 0.7
        const rr = L * (0.17 + 0.12 * r()) * (1 - 0.6 * Math.abs(u))
        blobs.push([u * L, ry0 * 0.8 + rr * (0.5 + 0.4 * r()), (r() - 0.5) * L * 0.1, rr * 1.1, rr, rr, 1])
      }
      let top = 0
      for (const b of blobs) top = Math.max(top, b[1] + b[4])
      return { id: nextId++, X, Y0, Z, L, blobs, top, scale: (o && o.scale) || 1, target: 1, fade: 1, gone: false, born: clock, shape: 1, sprite: null, seed: (r() * 4294967296) >>> 0, push: 0 }
    }

    // The screen box of a cloud, [x0, y0, x1, y1].
    function bbox (c) {
      const s = c.scale
      return [sx(c.X - 0.6 * c.L * s, c.Z), sy(c.Y0 + c.top * s, c.Z), sx(c.X + 0.6 * c.L * s, c.Z), sy(c.Y0, c.Z)]
    }

    // A cloud at screen (x, y) for its base, of width L metres.
    function at (x, y, L, o) {
      const Z = clamp(f * BASE / Math.max(1, cy - y), ZMIN, ZMAX)
      return cloud((x - cx) * Z / f, Z, L, o)
    }

    // The sky's first clouds: spread over it, few overlapping.
    function populate () {
      for (let k = 0; k < KEEP; k++) {
        let best = null
        for (let tries = 0; tries < 16; tries++) {
          const y = cy - (H * 0.03 + Math.pow(rnd(), 1.4) * cy * 0.85)
          const c = at(-0.05 * W + rnd() * 1.1 * W, y, 1500 + 2500 * rnd())
          const b = bbox(c)
          let over = 0
          for (const d of clouds) {
            const e = bbox(d)
            const ix = Math.max(0, Math.min(b[2], e[2]) - Math.max(b[0], e[0]))
            const iy = Math.max(0, Math.min(b[3], e[3]) - Math.max(b[1], e[1]))
            over = Math.max(over, ix * iy / Math.max(1, (b[2] - b[0]) * (b[3] - b[1])))
          }
          if (!best || over < best.over) best = { c, over }
          if (over < 0.1) break
        }
        clouds.push(best.c)
      }
    }

    // The sun's direction, unit, world: x right, y up, z ahead.
    function sunDir (e) {
      const ce = Math.cos(e * DEG)
      return [Math.sin(sunAz) * ce, Math.sin(e * DEG), Math.cos(sunAz) * ce]
    }

    // Start a march of cloud c at the present light and size.
    function begin (c) {
      const s = c.scale
      const nb = c.blobs.length
      const B = new Float64Array(7 * nb)
      // The view ray to the cloud's middle, and the plane Z = c.Z the
      // sprite lies in: sprite pixels are SP screen pixels, a march's
      // sample every two of them.
      const mid = c.Y0 + c.top * s / 2
      const n = Math.hypot(c.X, mid, c.Z)
      const v = [c.X / n, mid / n, c.Z / n]
      const SP = Math.max(1.5, W / 480)
      const mpp = 2 * SP * c.Z / f
      // The blobs' shadow on the plane along the view ray bounds it.
      let x0 = Infinity
      let x1 = -Infinity
      let y0 = Infinity
      let y1 = -Infinity
      c.blobs.forEach((b, k) => {
        const [bx, by, bz, rx, ry, rz] = b.map(u => u * s)
        B.set([bx, by, bz, 1 / rx, 1 / ry, 1 / rz, b[6]], 7 * k)
        const px = bx - v[0] * bz / v[2]
        const py = by - v[1] * bz / v[2]
        const ex = rx + rz * Math.abs(v[0]) / v[2]
        const ey = ry + rz * Math.abs(v[1]) / v[2]
        x0 = Math.min(x0, px - ex)
        x1 = Math.max(x1, px + ex)
        y0 = Math.min(y0, py - ey)
        y1 = Math.max(y1, py + ey)
      })
      const w = Math.max(2, Math.ceil((x1 - x0) / mpp) + 2)
      const hgt = Math.max(2, Math.ceil((y1 - y0) / mpp) + 2)
      const sun = sunDir(el)
      const cos = v[0] * sun[0] + v[1] * sun[1] + v[2] * sun[2]
      // Henyey-Greenstein, forward and back, against the isotropic.
      const hg = g => (1 - g * g) / Math.pow(1 + g * g - 2 * g * cos, 1.5)
      const phase = 0.6 * hg(0.45) + 0.4 * hg(-0.15)
      job = { c, B, nb, v, sun, w, h: hgt, mpp, ox: x0 - mpp, oy: y1 + mpp, row: 0, el, scale: s, shape: c.shape, f, phase, SP, Ls: new Float32Array(w * hgt), La: new Float32Array(w * hgt), Lg: new Float32Array(w * hgt), Al: new Float32Array(w * hgt), use: new Int32Array(nb) }
    }

    // March rows of the job until the time t1, a row at least.
    function marchRows (t1) {
      const { B, nb, v, sun, w, h, mpp, ox, oy, Ls, La, Lg, Al, use, c } = job
      const [vx, vy, vz] = v
      const [ux, uy, uz] = sun
      const top = c.top * job.scale
      const s0 = c.seed
      let once = true
      for (; job.row < h; job.row++) {
        if (!once && performance.now() > t1) return false
        once = false
        const j = job.row
        const py = oy - (j + 0.5) * mpp
        for (let i = 0; i < w; i++) {
          const px = ox + (i + 0.5) * mpp
          const k = j * w + i
          // The ray's span through every blob, and the blobs it meets.
          let t0 = Infinity
          let t9 = -Infinity
          let nu = 0
          for (let b = 0; b < nb; b++) {
            const o = 7 * b
            const qx = (px - B[o]) * B[o + 3]
            const qy = (py - B[o + 1]) * B[o + 4]
            const qz = -B[o + 2] * B[o + 5]
            const Vx = vx * B[o + 3]
            const Vy = vy * B[o + 4]
            const Vz = vz * B[o + 5]
            const a = Vx * Vx + Vy * Vy + Vz * Vz
            const bb = qx * Vx + qy * Vy + qz * Vz
            const disc = bb * bb - a * (qx * qx + qy * qy + qz * qz - 1)
            if (disc <= 0) continue
            const sq = Math.sqrt(disc)
            const ta = (-bb - sq) / a
            const tb = (-bb + sq) / a
            if (ta < t0) t0 = ta
            if (tb > t9) t9 = tb
            use[nu++] = o
          }
          if (!nu) {
            Al[k] = Ls[k] = La[k] = Lg[k] = 0
            continue
          }
          const dt = (t9 - t0) / STEPS
          const jit = hash(i, j, s0)
          let T = 1
          let ls = 0
          let la = 0
          let lg = 0
          for (let st = 0; st < STEPS && T > 0.01; st++) {
            const t = t0 + (st + jit) * dt
            const x = px + vx * t
            const y = py + vy * t
            const z = vz * t
            if (y < -40) continue
            let D = 0
            for (let q = 0; q < nu; q++) {
              const o = use[q]
              const dx = (x - B[o]) * B[o + 3]
              const dy = (y - B[o + 1]) * B[o + 4]
              const dz = (z - B[o + 2]) * B[o + 5]
              const r2 = dx * dx + dy * dy + dz * dz
              if (r2 < 1) D += B[o + 6] * (1 - r2) * (1 - r2)
            }
            // The flat base.
            if (y < 120) D *= sstep((y + 40) / 160)
            if (D <= 0.1) continue
            const rho = SIG * sstep((D - 0.1) / 0.4)
            // The optical depth toward the sun, blob by blob in closed
            // form, the ray cut at the base.
            const tf = uy < 0 ? (y + 40) / -uy : Infinity
            let tau = 0
            for (let o = 0; o < 7 * nb; o += 7) {
              const qx = (x - B[o]) * B[o + 3]
              const qy = (y - B[o + 1]) * B[o + 4]
              const qz = (z - B[o + 2]) * B[o + 5]
              const Sx = ux * B[o + 3]
              const Sy = uy * B[o + 4]
              const Sz = uz * B[o + 5]
              const a = Sx * Sx + Sy * Sy + Sz * Sz
              const bb = qx * Sx + qy * Sy + qz * Sz
              const c0 = qx * qx + qy * qy + qz * qz
              const disc = bb * bb - a * (c0 - 1)
              if (disc <= 0) continue
              const sq = Math.sqrt(disc)
              const lo = Math.max(0, (-bb - sq) / a)
              const hi = Math.min(tf, (-bb + sq) / a)
              if (hi <= lo) continue
              tau += B[o + 6] * ((1 - c0) * (hi - lo) - bb * (hi * hi - lo * lo) - a * (hi * hi * hi - lo * lo * lo) / 3)
            }
            tau *= SIGL
            // Single scattering and a softer second octave for the light
            // carried deeper in.
            const S = Math.exp(-tau) + 0.2 * Math.exp(-0.25 * tau)
            const hh = clamp(y / top, 0, 1)
            const a = 1 - Math.exp(-rho * dt)
            const wt = T * a
            ls += wt * S
            la += wt * (0.4 + 0.6 * hh)
            lg += wt * 0.75 * (1 - hh)
            T *= 1 - a
          }
          Ls[k] = ls
          La[k] = la
          Lg[k] = lg
          Al[k] = 1 - T
        }
      }
      return true
    }

    // The finished march becomes the cloud's sprite, painted at once.
    function finish () {
      const j = job
      job = null
      marches++
      const c = j.c
      if (c.gone) return
      const sw = 2 * j.w
      const sh = 2 * j.h
      const cv = c.sprite && c.sprite.cv.width === sw && c.sprite.cv.height === sh ? c.sprite.cv : document.createElement('canvas')
      cv.width = sw
      cv.height = sh
      c.sprite = { cv, g: cpu(cv), m: j, colour: null, at: c.sprite ? c.sprite.at : clock }
      paint(c)
    }

    // Paint a cloud's sprite in the present light, in watercolour, at
    // twice the march's resolution: the alpha interpolated, then cut
    // with a noisy edge, wet and soft in places and dry and hard in
    // others, pigment pooled just inside it.
    function paint (c) {
      const sp = c.sprite
      const m = sp.m
      const { w, h, Ls, La, Lg, Al } = m
      const sw = 2 * w
      const sh = 2 * h
      const img = sp.g.createImageData(sw, sh)
      const d = img.data
      const p = pal
      // The sun on a cloud this high: the earth's shadow takes it once
      // the sun is below the cloud's own horizon.
      const dip = -Math.sqrt(2 * (c.Y0 + 0.5 * c.top * c.scale) / 6.371e6) / DEG
      const lit = p.I * m.phase * sstep((el - dip + 1.2) / 1.6)
      const sr = p.sun[0] * lit
      const sg = p.sun[1] * lit
      const sb = p.sun[2] * lit
      const [ar, ag, ab] = p.amb
      const [br, bg, bb] = p.bounce
      // Noise in metres on the cloud, so a new march keeps its edges.
      const nm = 1 / (0.12 * c.L * m.scale)
      const half = m.mpp / 2
      const s0 = c.seed
      for (let y = 0; y < sh; y++) {
        const fy = (y + 0.5) / 2 - 0.5
        const j0 = clamp(Math.floor(fy), 0, h - 1)
        const j1 = Math.min(h - 1, j0 + 1)
        const ty = clamp(fy - j0, 0, 1)
        const my = (m.oy - (y + 0.5) * half) * nm
        for (let x = 0; x < sw; x++) {
          const fx = (x + 0.5) / 2 - 0.5
          const i0 = clamp(Math.floor(fx), 0, w - 1)
          const i1 = Math.min(w - 1, i0 + 1)
          const tx = clamp(fx - i0, 0, 1)
          const k00 = j0 * w + i0
          const k01 = j0 * w + i1
          const k10 = j1 * w + i0
          const k11 = j1 * w + i1
          const w00 = (1 - tx) * (1 - ty)
          const w01 = tx * (1 - ty)
          const w10 = (1 - tx) * ty
          const w11 = tx * ty
          const A = Al[k00] * w00 + Al[k01] * w01 + Al[k10] * w10 + Al[k11] * w11
          const o = 4 * (y * sw + x)
          if (A < 0.004) {
            d[o + 3] = 0
            continue
          }
          const mx = (m.ox + (x + 0.5) * half) * nm
          // The edge: noise moves it, a second noise sets it wet or dry.
          const ne = noise(mx, my, s0) - 0.5 + 0.5 * (noise(mx * 2.7, my * 2.7, s0 + 3) - 0.5)
          const wet = noise(mx * 0.6 + 9, my * 0.6, s0 + 5)
          const e = A + 0.32 * ne
          const lo = 0.1
          const wd = 0.08 + 0.5 * wet * wet
          const a2 = sstep((e - lo) / wd)
          if (a2 <= 0) {
            d[o + 3] = 0
            continue
          }
          const ls = (Ls[k00] * w00 + Ls[k01] * w01 + Ls[k10] * w10 + Ls[k11] * w11) / A
          const la = (La[k00] * w00 + La[k01] * w01 + La[k10] * w10 + La[k11] * w11) / A
          const lg = (Lg[k00] * w00 + Lg[k01] * w01 + Lg[k10] * w10 + Lg[k11] * w11) / A
          let r = tone(ls * sr + la * ar + lg * br)
          let g = tone(ls * sg + la * ag + lg * bg)
          let b = tone(ls * sb + la * ab + lg * bb)
          // Pigment: pooled at the edge, uneven, granulated.
          const rim = Math.max(0, 1 - Math.abs(e - lo - 0.75 * wd - 0.04) / (0.06 + 0.2 * wd))
          const lum = 0.3 * r + 0.55 * g + 0.15 * b
          const dd = 1 + 0.45 * rim * (1 - 0.6 * wet) + 0.22 * (noise(mx * 1.3, my * 1.3, s0 + 7) - 0.5) + 0.16 * (hash(x, y, s0) - 0.5) * (1.1 - lum)
          const pool = 1 - 0.12 * rim * (1 - 0.6 * wet)
          r = dens(r, dd) * pool
          g = dens(g, dd) * pool
          b = dens(b, dd) * pool
          d[o] = 255 * clamp(r, 0, 1)
          d[o + 1] = 255 * clamp(g, 0, 1)
          d[o + 2] = 255 * clamp(b, 0, 1)
          d[o + 3] = 255 * a2
        }
      }
      sp.g.putImageData(img, 0, 0)
      sp.colour = el
    }

    // The cloud that most wants a march: one without a sprite first,
    // then a changed shape or size, then the sun moved, then the scale.
    function wanted () {
      let best = null
      let score = 0
      for (const c of clouds) {
        if (c.gone) continue
        const s = c.sprite && c.sprite.m
        let v = 0
        if (!s) v = 100 + 1 / (1 + c.Z / 1e4)
        else {
          const r = c.scale / s.scale
          if (s.shape !== c.shape || r > 1.25 || r < 0.8) v = 50
          else if (Math.abs(s.el - el) > 1) v = 10 + Math.abs(s.el - el)
          else if (Math.abs(s.f / f - 1) > 0.15) v = 5
        }
        if (v > score) {
          score = v
          best = c
        }
      }
      return best
    }

    // Marches and repaints until the budget is spent.
    function work (ms) {
      const t1 = performance.now() + ms
      let guard = 0
      while (performance.now() < t1 && guard++ < 64) {
        // A repaint where the light has moved, the most stale first.
        let stale = null
        for (const c of clouds) {
          if (c.gone || !c.sprite) continue
          const dv = Math.abs(c.sprite.colour - el)
          if (dv > 0.15 && (!stale || dv > Math.abs(stale.sprite.colour - el))) stale = c
        }
        if (stale && (!job || guard % 2)) {
          paint(stale)
          continue
        }
        if (!job) {
          const c = wanted()
          if (!c) return
          begin(c)
        }
        if (marchRows(t1)) finish()
      }
    }

    // The sky's geometry, once a size and a sunset: each texel's
    // elevation and azimuth from the sun, and its wash's noise.
    function skyGeometry () {
      const k = Math.min(1, 300 / W)
      const w = Math.max(16, Math.round(W * k))
      const bottom = Math.min(H, cy + 0.04 * H)
      const h = Math.max(8, Math.round(bottom * k))
      const n = w * h
      const G = { w, h, k, bottom, sinA: new Float32Array(n), cosA: new Float32Array(n), cosD: new Float32Array(n), t: new Float32Array(n), near: new Float32Array(n), dd: new Float32Array(n), blue: new Float32Array(n) }
      for (let y = 0; y < h; y++) {
        const Y = (y + 0.5) / k
        for (let x = 0; x < w; x++) {
          const X = (x + 0.5) / k
          const i = y * w + x
          const az = Math.atan2(X - cx, f)
          const A = Math.atan2(cy - Y, Math.hypot(f, X - cx))
          G.sinA[i] = Math.sin(A)
          G.cosA[i] = Math.cos(A)
          G.cosD[i] = Math.cos(az - sunAz)
          G.near[i] = Math.exp(-Math.pow((az - sunAz) / 0.8, 2))
          G.t[i] = sstep(Math.pow(clamp(A / (0.62 + 0.06 * (fbm(X / W * 3, Y / H * 2, scene + 1, 2) - 0.5)), 0, 1), 0.55))
          // Uneven pigment, granulation in the blue, and two tide lines
          // where one wash dried against the next.
          let dd = 0.16 * (fbm(X / W * 4, Y / H * 3, scene + 2, 3) - 0.5)
          for (let l = 0; l < 2; l++) {
            const yl = cy - H * (0.2 + 0.24 * l) - 0.05 * H * (fbm(X / W * 2.5, l * 7, scene + 3, 2) - 0.5)
            if (Y >= yl) dd += 0.09 * Math.exp(-(Y - yl) / (0.008 * H))
          }
          G.dd[i] = dd
          G.blue[i] = hash(x, y, scene + 4) - 0.5
        }
      }
      return G
    }

    // Paint the sky in the present light.
    function paintSky () {
      const G = sky.G
      const { w, h } = G
      const c = sky.c
      if (c.width !== w || c.height !== h) {
        c.width = w
        c.height = h
      }
      const g = cpu(c)
      const img = g.createImageData(w, h)
      const d = img.data
      const p = pal
      const sS = Math.sin(el * DEG)
      const cS = Math.cos(el * DEG)
      for (let i = 0; i < w * h; i++) {
        const t = G.t[i]
        const nr = G.near[i]
        let r = mix(mix(p.ha[0], p.hs[0], nr), p.zen[0], t)
        let gg = mix(mix(p.ha[1], p.hs[1], nr), p.zen[1], t)
        let b = mix(mix(p.ha[2], p.hs[2], nr), p.zen[2], t)
        // The sun's glow, near it and wide.
        const cg = clamp(G.sinA[i] * sS + G.cosA[i] * cS * G.cosD[i], -1, 1)
        const ang = Math.acos(cg)
        const glow = p.I * (0.5 * Math.exp(-ang / 0.05) + 0.22 * Math.exp(-ang / 0.32)) * (1 - 0.6 * t)
        r = tone(r + glow * p.sun[0])
        gg = tone(gg + glow * p.sun[1])
        b = tone(b + glow * p.sun[2])
        const dd = 1 + G.dd[i] + 0.2 * G.blue[i] * t
        const o = 4 * i
        d[o] = 255 * clamp(dens(r, dd), 0, 1)
        d[o + 1] = 255 * clamp(dens(gg, dd), 0, 1)
        d[o + 2] = 255 * clamp(dens(b, dd), 0, 1)
        d[o + 3] = 255
      }
      g.putImageData(img, 0, 0)
      lay(sky, 0, Math.ceil(G.h / G.k))
      sky.el = el
      sky.at = clock
    }

    // The land's top edges, far to near, screen y at screen x.
    function edges () {
      const r = rng(scene)
      const mesas = []
      const nm = 1 + Math.floor(r() * 2.5)
      for (let k = 0; k < nm; k++) {
        mesas.push({ x: (0.12 + 0.76 * r()) * W, h: (k ? 0.03 + 0.03 * r() : 0.06 + 0.035 * r()) * H, top: (0.04 + 0.08 * r()) * W, side: (0.03 + 0.04 * r()) * W })
      }
      const s = scene
      return [
        x => cy - H * (0.006 + 0.016 * fbm(x / W * 3, 0.5, s + 10, 3)),
        x => {
          let y = cy - H * 0.004
          for (const m of mesas) {
            const u = Math.abs(x - m.x)
            const prof = u < m.top ? 1 : u < m.top + m.side ? Math.pow(1 - (u - m.top) / m.side, 1.7) * (1 - 0.15 * (u - m.top) / m.side) : 0
            y = Math.min(y, cy - m.h * prof - 0.004 * H * (noise(x / W * 30, 1.5, s + 11) - 0.5) * prof)
          }
          return y
        },
        x => cy + H * (0.004 + 0.008 * fbm(x / W * 4, 2.5, s + 12, 2)),
        x => cy + H * (0.03 + 0.12 * (fbm(x / W * 1.6, 3.5, s + 13, 3) - 0.5)),
        x => cy + H * (0.085 + 0.2 * (fbm(x / W * 1.2, 4.5, s + 14, 3) - 0.5)),
        x => cy + H * (0.16 + 0.26 * (fbm(x / W * 0.9, 5.5, s + 15, 3) - 0.5))
      ]
    }

    // The land's geometry: each texel's band, how far below the band's
    // edge, its noise; and the top row.
    function landGeometry () {
      const k = Math.min(1, 520 / W)
      const E = edges()
      const w = Math.max(16, Math.round(W * k))
      const tops = E.map(e => Float32Array.from({ length: w }, (_, x) => e((x + 0.5) / k)))
      let top = H
      for (const t of tops) for (const v of t) top = Math.min(top, v)
      top = Math.max(0, Math.floor(top - 2))
      const h = Math.max(4, Math.ceil((H - top) * k))
      const n = w * h
      const G = { w, h, k, top, band: new Int8Array(n), back: new Int8Array(n), cov: new Float32Array(n), dd: new Float32Array(n), near: new Float32Array(w), shade: new Float32Array(n), shadeB: new Float32Array(n) }
      for (let x = 0; x < w; x++) {
        const az = Math.atan2((x + 0.5) / k - cx, f)
        G.near[x] = Math.exp(-Math.pow((az - sunAz) / 0.8, 2))
      }
      for (let y = 0; y < h; y++) {
        const Y = top + (y + 0.5) / k
        for (let x = 0; x < w; x++) {
          const i = y * w + x
          // The nearest band whose edge is above the texel, the band
          // behind it, and the share of the texel the nearer covers.
          const e = 0.5 / k
          let b = -1
          for (let l = tops.length - 1; l >= 0; l--) {
            if (Y >= tops[l][x] - e) {
              b = l
              break
            }
          }
          G.band[i] = b
          if (b < 0) continue
          let bk = -1
          for (let l = b - 1; l >= 0; l--) {
            if (Y >= tops[l][x] - e) {
              bk = l
              break
            }
          }
          G.back[i] = bk
          G.cov[i] = clamp((Y - tops[b][x]) * k + 0.5, 0, 1)
          const below = Math.max(0, Y - tops[b][x]) / H
          const X = (x + 0.5) / k
          // Pooled at the band's top edge, uneven, granulated earth.
          G.dd[i] = 0.28 * Math.exp(-below / 0.004) + 0.2 * (fbm(X / W * 6, Y / H * 10, scene + 20 + b, 3) - 0.5) + 0.22 * (hash(x, y, scene + 21) - 0.5)
          // A band lighter at its crest, darker into its fold.
          const fold = u => 0.18 * Math.exp(-u / 0.012) - 0.3 * clamp(u / 0.05, 0, 1)
          G.shade[i] = fold(below)
          if (bk >= 0) G.shadeB[i] = fold(Math.max(0, Y - tops[bk][x]) / H)
        }
      }
      return G
    }

    function paintLand () {
      const G = land.G
      const { w, h } = G
      const c = land.c
      if (c.width !== w || c.height !== h) {
        c.width = w
        c.height = h
      }
      const g = cpu(c)
      const img = g.createImageData(w, h)
      const d = img.data
      const p = pal
      const lit = p.I * sstep((el + 1.5) / 3)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x
          const b = G.band[i]
          const o = 4 * i
          if (b < 0) {
            d[o + 3] = 0
            continue
          }
          const nr = G.near[x]
          const dd = 1 + G.dd[i]
          const bk = G.back[i]
          const cov = G.cov[i]
          const col = (B, sh, ch) => {
            const v = B.pig[ch] * (p.sun[ch] * lit * B.sun * (1 + 0.4 * nr) + p.amb[ch] * 0.62) * (1 + sh)
            return mix(v, mix(p.ha[ch], p.hs[ch], nr), B.haze)
          }
          for (let ch = 0; ch < 3; ch++) {
            let v = col(LAND[b], G.shade[i], ch)
            if (bk >= 0) v = mix(col(LAND[bk], G.shadeB[i], ch), v, cov)
            d[o + ch] = 255 * clamp(dens(tone(v), dd), 0, 1)
          }
          d[o + 3] = bk >= 0 ? 255 : 255 * cov
        }
      }
      g.putImageData(img, 0, 0)
      lay(land, G.top, Math.ceil(G.h / G.k))
      land.el = el
      land.at = clock
    }

    // The session's events (decision 0015's table).
    function react (e) {
      if (e.kind === 3) {
        // A cloud billows up in the open sky.
        const y = cy - (0.15 + 0.6 * rnd()) * cy
        const c = at((0.1 + 0.8 * rnd()) * W, y, 1600 + 1800 * rnd(), { scale: 0.15 })
        clouds.push(c)
        trim()
      } else if (e.kind === 2) {
        // A drop of pigment in the class's colour blooms on a cloud.
        const seen = clouds.filter(c => !c.gone && c.sprite && onScreen(c))
        const c = seen.length ? seen[Math.floor(rnd() * seen.length)] : null
        const b = c ? bbox(c) : [0.2 * W, 0.2 * H, 0.8 * W, 0.6 * H]
        const r = clamp(0.3 * Math.min(b[2] - b[0], b[3] - b[1]), 0.04 * W, 0.08 * W)
        drops.push({ x: mix(b[0], b[2], 0.25 + 0.5 * rnd()), y: mix(b[1], b[3], 0.3 + 0.5 * rnd()), r, t: clock, hue: CLASS_HUE[e.cls] ?? 200, life: 7, seed: drops.length + 17 * (e.cls | 0) })
      } else if (e.kind === 4) {
        // The sun's rays break through.
        rays = { t: clock, a: rnd() * 10 }
      } else if (e.kind === 5) {
        // A cloudlet forms beside the newest cloud.
        const o = clouds.filter(c => !c.gone).pop()
        const c = o ? cloud(o.X + (rnd() < 0.5 ? -1 : 1) * o.L * (0.8 + 0.4 * rnd()), o.Z * (0.95 + 0.1 * rnd()), 600 + 500 * rnd(), { scale: 0.2, flat: 0.8 }) : at(W / 2, cy * 0.6, 900)
        clouds.push(c)
        trim()
      } else if (e.kind === 6) {
        // Condensed: the smaller half of the clouds thin away, the rest
        // grow.
        const live = clouds.filter(c => !c.gone).sort((a, b) => a.L * a.target / a.Z - b.L * b.target / b.Z)
        live.forEach((c, k) => {
          if (k < live.length / 2) c.gone = true
          else c.target = Math.min(1.6, c.target * 1.2)
        })
      } else {
        // A drop of clean water lifts the wash, its rim drying darker.
        if (drops.filter(d => d.water).length >= 8) drops.splice(drops.findIndex(d => d.water), 1)
        drops.push({ x: rnd() * W, y: rnd() * cy * 0.95, r: (0.02 + 0.025 * rnd()) * Math.max(W, H), t: clock, water: true, life: 4.5, seed: (rnd() * 1e6) | 0 })
      }
    }

    // Past the most clouds, the oldest, the least id, thins away. Ids
    // count up as clouds are made, and draw sorts the clouds by depth,
    // so their order is not their age.
    function trim () {
      const live = clouds.filter(c => !c.gone)
      if (live.length > MOST) live.reduce((a, c) => c.id < a.id ? c : a).gone = true
    }

    function onScreen (c) {
      const b = bbox(c)
      return b[2] > 0 && b[0] < W && b[3] > 0 && b[1] < H
    }

    // The clouds drift on the wind and grow, the thinning fade, those
    // blown off the pane go, and new ones come in upwind.
    function advance (h) {
      for (const c of clouds) {
        c.X += (windSign * wind + c.push) * h
        c.push *= Math.exp(-h / 3)
        c.scale += (c.target - c.scale) * (1 - Math.exp(-h / 2.2))
        if (c.gone) c.fade -= h / 3
      }
      clouds = clouds.filter(c => c.fade > 0 && !(windSign > 0 ? bbox(c)[0] > W + 20 : bbox(c)[2] < -20))
      // A crowded sky: past the clouds it keeps, the oldest of a minute
      // thins away every few seconds. A thinned sky: a cloud forms in
      // it every few seconds.
      const live = clouds.filter(c => !c.gone)
      if (live.length > KEEP && clock > thins) {
        const old = live.reduce((a, c) => c.born < a.born ? c : a)
        if (clock - old.born > 60) {
          old.gone = true
          thins = clock + 3 + 3 * rnd()
        }
      }
      if (clouds.filter(c => !c.gone).length < KEEP && clock > forms) {
        const y = cy - (H * 0.03 + Math.pow(rnd(), 1.4) * cy * 0.85)
        clouds.push(at((0.05 + 0.9 * rnd()) * W, y, 1500 + 2500 * rnd(), { scale: 0.15 }))
        forms = clock + 2 + 2 * rnd()
      }
      clock += h
    }

    function draw (synth, dt) {
      const w = canvas.width
      const h = canvas.height
      if (w < 4 || h < 4) return
      if (w !== W || h !== H) {
        W = w
        H = h
        f = W / 2 / Math.tan(HFOV / 2)
        cx = W / 2
        cy = HORIZON * H
        if (first) sunset(true)
        sky.G = skyGeometry()
        land.G = landGeometry()
        sky.el = land.el = null
        if (!clouds.length) populate()
      }
      for (const e of synth.since(mark)) react(e)
      const L = synth.level
      // The clock: a little faster while busy, slowed to a fifth as the
      // session idles. The sun sets over the cycle, idle sinks it
      // further toward dusk, and the wind follows the bass.
      const speed = (0.8 + 0.2 * Math.min(1, L.bass) + 0.2 * L.busy) * (1 - 0.8 * L.idle)
      wind = (8 + 30 * Math.min(1, L.bass)) * (1 - 0.7 * L.idle)
      let left = Math.min(0.25, speed * dt)
      while (left > 1e-9) {
        const hh = Math.min(0.05, left)
        advance(hh)
        left -= hh
      }
      let p = (clock - start) / CYCLE
      if (p >= 1) {
        // The sunset is over: a new painting, the old fading off it.
        const snap = fade ? fade.c : document.createElement('canvas')
        snap.width = W
        snap.height = H
        cpu(snap).drawImage(layer, 0, 0)
        fade = { c: snap, t: clock }
        sunset(false)
        sky.G = skyGeometry()
        land.G = landGeometry()
        populate()
        p = 0
      }
      el = Math.max(-11, EL0 + (EL1 - EL0) * p - IDLE_DIP * L.idle)
      pal = palette(el)
      if (sky.el === null || (Math.abs(sky.el - el) > 0.12 && clock - sky.at > 0.3)) paintSky()
      if (land.el === null || (Math.abs(land.el - el) > 0.12 && clock - land.at > 0.3)) paintLand()
      work(first ? 60 : BUDGET)
      first = false

      if (layer.width !== W || layer.height !== H) {
        layer.width = W
        layer.height = H
      }
      const g = lg
      g.globalCompositeOperation = 'source-over'
      g.globalAlpha = 1
      g.imageSmoothingEnabled = true
      g.drawImage(sky.full, 0, 0)
      // The sun, a soft disc of wash, large as a painter makes it.
      const sxs = cx + f * Math.tan(sunAz)
      const sys = cy - f * Math.tan(el * DEG) / Math.cos(sunAz)
      const rs = f * 1.4 * DEG
      if (sys - rs < cy + 0.05 * H) {
        const gr = g.createRadialGradient(sxs, sys, 0, sxs, sys, rs * 1.15)
        const s = pal.sun
        const cc = (k, a) => `rgba(${Math.round(255 * Math.min(1, s[0] * 0.3 + 0.75 * k))}, ${Math.round(255 * Math.min(1, s[1] * 0.45 + 0.55 * k))}, ${Math.round(255 * Math.min(1, s[2] * 0.6 + 0.3 * k))}, ${a})`
        gr.addColorStop(0, cc(1, 0.95 * pal.I))
        gr.addColorStop(0.8, cc(0.9, 0.85 * pal.I))
        gr.addColorStop(0.92, cc(0.75, 0.7 * pal.I))
        gr.addColorStop(1, cc(0.6, 0))
        g.fillStyle = gr
        g.beginPath()
        g.arc(sxs, sys, rs * 1.15, 0, 2 * Math.PI)
        g.fill()
      }
      // The rays of a stop, fanned from the sun behind the clouds.
      if (rays) {
        const age = clock - rays.t
        const env = Math.min(1, age / 0.4) * Math.exp(-Math.max(0, age - 1) / 2)
        if (env < 0.01) rays = null
        else {
          const R = 1.6 * Math.max(W, H)
          const s = pal.sun
          g.globalCompositeOperation = 'lighter'
          for (let k = 0; k < 6; k++) {
            const a = -Math.PI / 2 + (k - 2.5) * 0.3 + 0.08 * Math.sin(rays.a + k * 1.7)
            const wdt = 0.06 + 0.03 * Math.sin(rays.a * 2 + k)
            const gr = g.createRadialGradient(sxs, sys, 0, sxs, sys, R)
            gr.addColorStop(0, `rgba(${Math.round(255 * s[0])}, ${Math.round(255 * s[1])}, ${Math.round(220 * s[2])}, ${0.035 * env * pal.I})`)
            gr.addColorStop(0.6, `rgba(${Math.round(255 * s[0])}, ${Math.round(255 * s[1])}, ${Math.round(220 * s[2])}, ${0.012 * env * pal.I})`)
            gr.addColorStop(1, 'rgba(0, 0, 0, 0)')
            g.fillStyle = gr
            for (const sp of [1, 0.75, 0.5, 0.25]) {
              g.beginPath()
              g.moveTo(sxs, sys)
              g.lineTo(sxs + R * Math.cos(a - wdt * sp), sys + R * Math.sin(a - wdt * sp))
              g.lineTo(sxs + R * Math.cos(a + wdt * sp), sys + R * Math.sin(a + wdt * sp))
              g.closePath()
              g.fill()
            }
          }
          g.globalCompositeOperation = 'source-over'
        }
      }
      // The clouds, far to near.
      clouds.sort((a, b) => b.Z - a.Z)
      for (const c of clouds) {
        const sp = c.sprite
        if (!sp) continue
        const m = sp.m
        const k = (f / c.Z) * (m.mpp / 2) * (c.scale / m.scale)
        const ax = sx(c.X, c.Z)
        const ay = sy(c.Y0, c.Z)
        const x0 = ax + (m.ox / (m.mpp / 2)) * k
        const y0 = ay - (m.oy / (m.mpp / 2)) * k
        const dw = sp.cv.width * k
        const dh = sp.cv.height * k
        if (x0 > W || x0 + dw < 0 || y0 > H || y0 + dh < 0) continue
        g.globalAlpha = clamp(c.fade, 0, 1) * Math.min(1, (clock - sp.at) / 0.8 + 0.05)
        g.drawImage(sp.cv, x0, y0, dw, dh)
      }
      g.globalAlpha = 1
      g.drawImage(land.full, 0, land.G.top)
      // Drops on the paper: pigment blooms and water's backruns.
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]
        const age = clock - d.t
        if (age > d.life) {
          drops.splice(i, 1)
          continue
        }
        const r = d.r * (0.35 + 0.65 * (1 - Math.exp(-age / 0.5)))
        const a = Math.min(1, age / 0.25) * (1 - age / d.life)
        const gr = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, r)
        if (d.water) {
          gr.addColorStop(0, `rgba(255, 249, 238, ${0.3 * a})`)
          gr.addColorStop(0.72, `rgba(255, 249, 238, ${0.16 * a})`)
          gr.addColorStop(0.86, `rgba(92, 66, 96, ${0.22 * a})`)
          gr.addColorStop(1, 'rgba(92, 66, 96, 0)')
        } else {
          gr.addColorStop(0, `hsla(${d.hue}, 65%, 48%, ${0.5 * a})`)
          gr.addColorStop(0.55, `hsla(${d.hue}, 65%, 52%, ${0.34 * a})`)
          gr.addColorStop(0.86, `hsla(${d.hue}, 65%, 42%, ${0.36 * a})`)
          gr.addColorStop(1, `hsla(${d.hue}, 65%, 42%, 0)`)
        }
        // A bloom's edge is ragged, as wet paint pushes out unevenly.
        g.fillStyle = gr
        g.beginPath()
        for (let q = 0; q <= 28; q++) {
          const an = q / 28 * 2 * Math.PI
          const rr = r * (0.9 + 0.1 * noise(Math.cos(an) * 2 + 5, Math.sin(an) * 2 + 5, d.seed))
          if (q) g.lineTo(d.x + rr * Math.cos(an), d.y + rr * Math.sin(an))
          else g.moveTo(d.x + rr, d.y)
        }
        g.fill()
      }
      // The last painting fading off.
      if (fade) {
        const a = 1 - (clock - fade.t) / 5
        if (a <= 0) fade = null
        else {
          g.globalAlpha = a
          g.drawImage(fade.c, 0, 0)
          g.globalAlpha = 1
        }
      }
      out.drawImage(layer, 0, 0)
    }

    return {
      draw,

      // A drag blows the clouds under it along with it, and they keep
      // a little way on after the release. A click in the sky raises a
      // cloud there, a click on the land drops clean water on it.
      pointer (kind, x, y, down) {
        if (!W) return
        if (kind === 'down') press = { x0: x, y0: y, x, y, drag: false }
        else if (press && down) {
          if (Math.hypot(x - press.x0, y - press.y0) > 6) press.drag = true
          if (press.drag) {
            const dx = x - press.x
            for (const c of clouds) {
              const b = bbox(c)
              const u = Math.hypot(clamp(x, b[0], b[2]) - x, clamp(y, b[1], b[3]) - y) / (0.12 * W)
              if (u >= 1) continue
              const m = (1 - u) * dx * c.Z / f
              c.X += m
              c.push = 0.7 * c.push + 0.3 * m * 30
            }
          }
          press.x = x
          press.y = y
        }
        if (kind !== 'up' || !press) return
        const p = press
        press = null
        if (p.drag) return
        if (p.y0 < cy - 0.02 * H) {
          clouds.push(at(p.x0, p.y0 + 0.04 * H, 1500 + 1200 * rnd(), { scale: 0.15 }))
          trim()
        } else drops.push({ x: p.x0, y: p.y0, r: 0.04 * Math.max(W, H), t: clock, water: true, life: 4.5, seed: (rnd() * 1e6) | 0 })
      },

      // For the live checks: the clouds, those with a sprite, the sun's
      // elevation, the sunset's share run, the marches.
      probe () {
        return { clouds: clouds.length, ready: clouds.filter(c => c.sprite).length, el: Math.round(el * 100) / 100, phase: Math.round((clock - start) / CYCLE * 1000) / 1000, sunsets, marches, drops: drops.length, clock }
      }
    }
  }

  if (typeof module === 'object' && module.exports) module.exports = { PAL, LAND, CYCLE }
  else (root.VizCanvas = root.VizCanvas || {}).sunset = create
})(this)
