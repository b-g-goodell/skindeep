'use strict'
// Quantum mode (decision 0015): a wave function on a 128 by 64 grid
// evolved by the Gross-Pitaevskii equation, hbar = m = 1,
//   i d/dt psi = -1/2 laplacian psi + (V + U(rho)) psi,  rho = |psi|^2,
// a mean-field model of a repulsive condensate whose packets push on
// one another where they overlap. U is saturable, U = g rho / (1 + rho
// / rho_s), so the phase it adds in a step stays small. The step is the
// split-step Fourier method: half a step of V + U, a step of the kinetic
// term in momentum space, half a step of V + U with U read from the new
// density. Each factor is a phase, so the step is unitary and the norm
// leaves only through the absorbing mask at the edges and the detector
// screen. Two things are not unitary: a measurement, which projects and
// rescales the state to its norm before, and a cap that rescales the
// whole state down when its norm passes 3, which also lowers U.
// Drawn by the local wavelength: the hue at a point is the wavenumber
// read from the phase gradient there, red for long waves (k 0.4) through
// yellow, green and blue to violet for short (k 2), the brightness the
// amplitude, and the phase itself the stripes of the brightness, so a
// red packet carries wide stripes and a violet one narrow. A point whose
// phase flips between neighbours, a node of a standing wave, is drawn
// grey. Packets fly from the left at a wall of potential generated from
// a seed, slits, a grating, discs, a cavity of two half-silvered walls,
// blocks, or wells that lens and guide, with heights from 0.5 to 3
// against packet energies of 0.1 to 2, so the slow red packets reflect
// where the fast violet ones pass. The far edge is a detector screen
// that records each detection as a dot, drawn from the probability
// reaching it, so the interference fringes build up dot by dot. A tool
// call fires a packet whose wavelength is its class's, a prompt draws
// the next seed's wall and fires, a subagent fires two of different
// wavelengths at once, a stop or a compaction measures the position and
// collapses the state to a narrow packet there, and an output event
// fires one. While the agent idles the wall fades into a harmonic trap
// holding a packet set circling in it, an orbital at rest.
// The pointer: a drag throws a packet from the press along the drag,
// its wavelength set by the drag's length, short for a long drag, with
// the aim drawn in the colour it will throw. A press held still for a
// quarter second arms a brush, an amber ring, and then paints a barrier
// along its path, a ridge of potential above the packets' energy that
// they scatter off, and leak through as it fades. A click measures
// softly whether the particle is under it, a Gaussian window of five
// points: found, with the probability the window holds, the state
// collapses into the window and a white ring flashes, else the window
// is carved out of the wave and a dark ring marks the miss. A click
// where there is no wave to measure drops a packet at rest.

;(function (root) {
  const NX = 128
  const NY = 64
  const DT = 0.5
  const SCREEN = NX - 14
  const OMEGA = 0.05
  // The mean-field term: g and the saturation density.
  const G = 25
  const RHO_S = 0.02
  // The generated wall: its x range, its height range, and the depth of
  // its wells.
  const WALL_X0 = 34
  const WALL_X1 = SCREEN - 4
  const H_MIN = 0.5
  const H_MAX = 3
  const WELL_MAX = 1.2
  // The packets' wavenumbers: by tool class, the throw's range, and the
  // hue scale's ends.
  const K_CLASS = [0.5, 0.75, 1, 1.25, 1.5, 1.75]
  const K_MIN = 0.4
  const K_MAX = 2
  // The painted barrier: its height, its radius in grid points, and its
  // fade's time constant in seconds. The hold that arms the brush, in
  // ms, and the drag in pane pixels that makes a throw.
  const BAR_H = 2.5
  const BAR_R = 1.6
  const BAR_TAU = 4
  const HOLD_MS = 250
  const DRAG_PX = 6
  // The soft measurement's window, in grid points.
  const POKE_R = 5

  // The bit reversal and the twiddles of an n-point FFT.
  function plan (n) {
    const bits = Math.log2(n)
    const rev = new Uint32Array(n)
    for (let i = 0; i < n; i++) {
      let r = 0
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b)
      rev[i] = r
    }
    const cos = new Float64Array(n / 2)
    const sin = new Float64Array(n / 2)
    for (let k = 0; k < n / 2; k++) {
      cos[k] = Math.cos(2 * Math.PI * k / n)
      sin[k] = Math.sin(2 * Math.PI * k / n)
    }
    return { n, rev, cos, sin }
  }

  // In place, the n points from off by stride. sign -1 forward, 1 back,
  // unscaled.
  function fft (re, im, off, stride, p, sign) {
    const n = p.n
    for (let i = 0; i < n; i++) {
      const j = p.rev[i]
      if (j <= i) continue
      const a = off + i * stride
      const b = off + j * stride
      let t = re[a]
      re[a] = re[b]
      re[b] = t
      t = im[a]
      im[a] = im[b]
      im[b] = t
    }
    for (let size = 2; size <= n; size *= 2) {
      const half = size / 2
      const tstep = n / size
      for (let i = 0; i < n; i += size) {
        for (let k = 0; k < half; k++) {
          const wr = p.cos[k * tstep]
          const wi = sign * p.sin[k * tstep]
          const a = off + (i + k) * stride
          const b = a + half * stride
          const tr = wr * re[b] - wi * im[b]
          const ti = wr * im[b] + wi * re[b]
          re[b] = re[a] - tr
          im[b] = im[a] - ti
          re[a] += tr
          im[a] += ti
        }
      }
    }
  }

  // A wave function on an nx by ny periodic grid, index y * nx + x.
  class Wave {
    constructor (nx, ny, dt) {
      this.nx = nx
      this.ny = ny
      this.dt = dt
      const n = nx * ny
      this.re = new Float64Array(n)
      this.im = new Float64Array(n)
      this.vr = new Float64Array(n).fill(1)
      this.vi = new Float64Array(n)
      this.kr = new Float64Array(n)
      this.ki = new Float64Array(n)
      this.px = plan(nx)
      this.py = plan(ny)
      // exp(-i k^2 dt / 2), with the inverse transform's 1 / n.
      for (let y = 0; y < ny; y++) {
        const ky = 2 * Math.PI * (y < ny / 2 ? y : y - ny) / ny
        for (let x = 0; x < nx; x++) {
          const kx = 2 * Math.PI * (x < nx / 2 ? x : x - nx) / nx
          const ph = -(kx * kx + ky * ky) / 2 * dt
          this.kr[y * nx + x] = Math.cos(ph) / n
          this.ki[y * nx + x] = Math.sin(ph) / n
        }
      }
      this.g = 0
      this.rhoS = 1
      this.ur = null
      this.ui = null
    }

    // The potential V, per point: its half step, exp(-i V dt / 2).
    potential (V) {
      for (let i = 0; i < V.length; i++) {
        this.vr[i] = Math.cos(-V[i] * this.dt / 2)
        this.vi[i] = Math.sin(-V[i] * this.dt / 2)
      }
    }

    // The mean-field term U = g rho / (1 + rho / rhoS), g = 0 for none:
    // its half step as a table over U from 0 to g rhoS.
    nonlinear (g, rhoS) {
      this.g = g
      this.rhoS = rhoS
      if (!g) return
      const n = 1024
      this.ur = new Float64Array(n)
      this.ui = new Float64Array(n)
      for (let k = 0; k < n; k++) {
        const u = g * rhoS * k / (n - 1)
        this.ur[k] = Math.cos(-u * this.dt / 2)
        this.ui[k] = Math.sin(-u * this.dt / 2)
      }
    }

    mul (ar, ai) {
      const { re, im } = this
      for (let i = 0; i < re.length; i++) {
        const r = re[i] * ar[i] - im[i] * ai[i]
        im[i] = re[i] * ai[i] + im[i] * ar[i]
        re[i] = r
      }
    }

    // Half a step of U from the present density.
    mean () {
      if (!this.g) return
      const { re, im, ur, ui, g, rhoS } = this
      const scale = 1023 / (g * rhoS)
      for (let i = 0; i < re.length; i++) {
        const rho = re[i] * re[i] + im[i] * im[i]
        if (rho < 2e-5) continue
        const k = Math.round(g * rho / (1 + rho / rhoS) * scale)
        const r = re[i] * ur[k] - im[i] * ui[k]
        im[i] = re[i] * ui[k] + im[i] * ur[k]
        re[i] = r
      }
    }

    // Multiply by a real factor per point: an absorber.
    damp (m) {
      for (let i = 0; i < m.length; i++) {
        this.re[i] *= m[i]
        this.im[i] *= m[i]
      }
    }

    scale (f) {
      for (let i = 0; i < this.re.length; i++) {
        this.re[i] *= f
        this.im[i] *= f
      }
    }

    fft2 (sign) {
      const { re, im, nx, ny } = this
      for (let y = 0; y < ny; y++) fft(re, im, y * nx, 1, this.px, sign)
      for (let x = 0; x < nx; x++) fft(re, im, x, nx, this.py, sign)
    }

    step () {
      this.mul(this.vr, this.vi)
      this.mean()
      this.fft2(-1)
      this.mul(this.kr, this.ki)
      this.fft2(1)
      this.mul(this.vr, this.vi)
      this.mean()
    }

    norm () {
      let s = 0
      for (let i = 0; i < this.re.length; i++) s += this.re[i] * this.re[i] + this.im[i] * this.im[i]
      return s
    }

    // Add a Gaussian packet of norm a at (x0, y0), widths sx and sy,
    // momentum (kx, ky).
    packet (x0, y0, sx, sy, kx, ky, a = 1) {
      const c = Math.sqrt(a / (2 * Math.PI * sx * sy))
      for (let y = 0; y < this.ny; y++) {
        for (let x = 0; x < this.nx; x++) {
          const e = c * Math.exp(-((x - x0) * (x - x0)) / (4 * sx * sx) - ((y - y0) * (y - y0)) / (4 * sy * sy))
          if (e < 1e-9) continue
          const ph = kx * x + ky * y
          const i = y * this.nx + x
          this.re[i] += e * Math.cos(ph)
          this.im[i] += e * Math.sin(ph)
        }
      }
    }

    // A point drawn from |psi|^2, or -1 for a wave too faint to measure.
    sample (rand = Math.random) {
      const total = this.norm()
      if (total < 1e-6) return -1
      let u = rand() * total
      for (let i = 0; i < this.re.length; i++) {
        u -= this.re[i] * this.re[i] + this.im[i] * this.im[i]
        if (u <= 0) return i
      }
      return this.re.length - 1
    }

    // A soft measurement of the position about (x0, y0): the window
    // w = exp(-r^2 / 2 R^2) and its complement sqrt(1 - w^2) are the two
    // outcomes' operators. The state goes to the outcome drawn, rescaled
    // to its norm before. Returns true when found, false when not, and
    // null for a wave too faint to measure. rand draws the outcome.
    poke (x0, y0, R, rand = Math.random) {
      const { re, im, nx, ny } = this
      const total = this.norm()
      if (total < 1e-6) return null
      const w = new Float64Array(re.length)
      let pin = 0
      for (let y = 0; y < ny; y++) {
        for (let x = 0; x < nx; x++) {
          const i = y * nx + x
          w[i] = Math.exp(-((x - x0) * (x - x0) + (y - y0) * (y - y0)) / (2 * R * R))
          pin += w[i] * w[i] * (re[i] * re[i] + im[i] * im[i])
        }
      }
      pin /= total
      const found = rand() < pin
      const s = 1 / Math.sqrt(found ? pin : 1 - pin)
      for (let i = 0; i < re.length; i++) {
        const f = (found ? w[i] : Math.sqrt(Math.max(0, 1 - w[i] * w[i]))) * s
        re[i] *= f
        im[i] *= f
      }
      return found
    }
  }

  // A seeded generator in [0, 1): mulberry32.
  function rng (seed) {
    let a = seed >>> 0
    return () => {
      a = (a + 0x6D2B79F5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  const FAMILIES = ['slits', 'grating', 'discs', 'cavity', 'blocks', 'wells']

  // The wall for a seed on an nx by ny grid: { V, family }. V is zero
  // left of WALL_X0, from WALL_X1 on, and in the absorber's rows, and
  // lies in [-WELL_MAX, H_MAX]. The family is the seed's modulo their
  // count, so consecutive seeds walk through all of them, the rest is
  // drawn from the seed, and a few discs may be added.
  function wallgen (seed, nx = NX, ny = NY) {
    const r = rng(seed)
    const pick = (a, b) => a + (b - a) * r()
    const int = (a, b) => Math.floor(pick(a, b + 1))
    const V = new Float64Array(nx * ny)
    const x0 = WALL_X0
    const x1 = Math.min(nx, WALL_X1)
    const y0 = 6
    const y1 = ny - 6
    // A height that reflects the slow packets and passes the fast ones
    // more often than not, and now and then a wall nothing passes.
    const height = () => r() < 0.25 ? pick(2, H_MAX) : pick(H_MIN, 1.8)
    const box = (xa, xb, ya, yb, h) => {
      for (let y = Math.max(y0, Math.ceil(ya)); y < Math.min(y1, yb); y++) {
        for (let x = Math.max(x0, Math.ceil(xa)); x < Math.min(x1, xb); x++) V[y * nx + x] = h
      }
    }
    const disc = (cx, cy, rad, h, lens) => {
      for (let y = Math.max(y0, Math.floor(cy - rad)); y < Math.min(y1, cy + rad + 1); y++) {
        for (let x = Math.max(x0, Math.floor(cx - rad)); x < Math.min(x1, cx + rad + 1); x++) {
          const d2 = ((x - cx) * (x - cx) + (y - cy) * (y - cy)) / (rad * rad)
          if (d2 <= 1) V[y * nx + x] = lens ? h * (1 - d2) : h
        }
      }
    }
    const slitwall = (xa, thick, h, slits) => {
      for (let y = y0; y < y1; y++) {
        if (slits.some(([c, hw]) => Math.abs(y - c) <= hw)) continue
        for (let x = xa; x < Math.min(x1, xa + thick); x++) V[y * nx + x] = h
      }
    }
    const family = FAMILIES[seed % FAMILIES.length]
    if (family === 'slits') {
      const n = int(1, 4)
      const slits = []
      for (let k = 0; k < n; k++) slits.push([y0 + 4 + (y1 - y0 - 8) * (k + 0.5 + pick(-0.3, 0.3)) / n, int(1, 3)])
      slitwall(int(44, 72), int(2, 4), height(), slits)
    } else if (family === 'grating') {
      const pitch = int(6, 12)
      const hw = int(1, Math.max(1, Math.floor(pitch / 4)))
      const phase = pick(0, pitch)
      const slits = []
      for (let c = y0 + phase; c < y1; c += pitch) slits.push([c, hw])
      const xa = int(42, 60)
      slitwall(xa, int(2, 3), height(), slits)
      // A second grating half a pitch over makes a Talbot carpet.
      if (r() < 0.5) slitwall(xa + int(10, 22), 2, height(), slits.map(([c, w]) => [c + pitch / 2, w]))
    } else if (family === 'discs') {
      const n = int(2, 5)
      for (let k = 0; k < n; k++) disc(pick(x0 + 10, x1 - 10), pick(y0 + 6, y1 - 6), int(3, 8), r() < 0.2 ? -pick(0.4, WELL_MAX) : height(), false)
    } else if (family === 'cavity') {
      const xa = int(42, 56)
      const gap = int(10, 24)
      const slits = r() < 0.4 ? [[ny / 2 + pick(-8, 8), int(2, 5)]] : []
      slitwall(xa, 2, pick(0.6, 1.6), slits)
      slitwall(xa + gap, 2, pick(0.6, 1.6), slits)
    } else if (family === 'blocks') {
      const n = int(4, 8)
      for (let k = 0; k < n; k++) {
        const xa = pick(x0, x1 - 4)
        const ya = pick(y0, y1 - 3)
        box(xa, xa + int(3, 10), ya, ya + int(3, 14), height())
      }
    } else {
      // Wells: a lens, a guide along x, or both.
      const which = int(0, 2)
      if (which !== 1) disc(pick(x0 + 14, x1 - 16), pick(y0 + 10, y1 - 10), int(8, 13), -pick(0.5, WELL_MAX), true)
      if (which !== 0) {
        const c = pick(y0 + 6, y1 - 6)
        const hw = int(2, 3)
        box(pick(x0, x0 + 16), x1, c - hw, c + hw + 1, -pick(0.4, 0.9))
      }
    }
    if (r() < 0.35) {
      const n = int(1, 2)
      for (let k = 0; k < n; k++) disc(pick(x0 + 6, x1 - 6), pick(y0 + 4, y1 - 4), int(2, 5), height(), false)
    }
    for (let i = 0; i < V.length; i++) V[i] = Math.max(-WELL_MAX, Math.min(H_MAX, V[i]))
    return { V, family }
  }

  // The hue sectors of the spectral scale: 2 is the rising edge, 3 the
  // falling one.
  const SECTORS = [[1, 2, 0], [3, 1, 0], [0, 1, 2], [0, 3, 1], [2, 0, 1]]

  // The colour of wavenumber k on the spectral scale, written to out.
  function spectral (k, out) {
    const t = Math.max(0, Math.min(1, (k - K_MIN) / (K_MAX - K_MIN)))
    // The hue from 0 to 280 degrees in sectors of 60, full saturation.
    const h = t * 280 / 60
    const s = Math.min(4, Math.floor(h))
    const f = h - s
    const c = SECTORS[s]
    for (let j = 0; j < 3; j++) out[j] = c[j] === 2 ? f : c[j] === 3 ? 1 - f : c[j]
    // Pure green and pure blue read dim on black: lift them.
    out[0] = 0.15 + 0.85 * out[0]
    out[1] = 0.1 + 0.9 * out[1]
    out[2] = 0.15 + 0.85 * out[2]
  }

  function create (canvas) {
    // The pane is composed on a canvas of the CPU and blitted once: under
    // swiftshader the pane's canvas draws in software GL, far slower.
    const out = canvas.getContext('2d')
    const layer = document.createElement('canvas')
    const g = layer.getContext('2d', { willReadFrequently: true })
    const buf = document.createElement('canvas')
    buf.width = NX
    buf.height = NY
    const bg = buf.getContext('2d', { willReadFrequently: true })
    const img = bg.createImageData(NX, NY)
    const px = new Uint32Array(img.data.buffer)
    const wave = new Wave(NX, NY, DT)
    wave.nonlinear(G, RHO_S)
    const mark = {}
    const V = new Float64Array(NX * NY)
    let wall = new Float64Array(NX * NY)
    const trap = new Float64Array(NX * NY)
    const mask = new Float64Array(NX * NY)
    const bar = new Float64Array(NX * NY)
    const rgb = [0, 0, 0]
    // The barrier's tallest point, the pointer's press while it lasts,
    // the brush's last grid point, the grid's place on the pane as last
    // drawn, and the counts the probe reports.
    let barTop = 0
    let press = null
    let pen = null
    let view = null
    let presses = 0
    let strokes = 0
    let throws = 0
    let pokes = 0
    let catches = 0
    const acc = new Float64Array(NY)
    const hist = new Float64Array(NY)
    let caught = 0
    let seed = 1
    let family = ''
    let held = -1
    let time = 0
    let dots = []
    let flashes = []

    for (let y = 0; y < NY; y++) {
      for (let x = 0; x < NX; x++) {
        const i = y * NX + x
        trap[i] = 0.5 * OMEGA * OMEGA * ((x - NX / 2) * (x - NX / 2) + (y - NY / 2) * (y - NY / 2))
        // The absorber: strongest at the left, where reflected packets
        // leave, so a busy session's echoes die before they pile up.
        const ex = x < 10 ? (10 - x) / 10 : x >= SCREEN ? (x - SCREEN + 1) / (NX - SCREEN) : 0
        const ey = y < 6 ? (6 - y) / 6 : y >= NY - 6 ? (y - NY + 7) / 6 : 0
        mask[i] = (1 - (x < 10 ? 0.5 : 0.3) * ex * ex) * (1 - 0.35 * ey * ey)
      }
    }

    function build () {
      const w = wallgen(seed, NX, NY)
      wall = w.V
      family = w.family
      held = -1
    }

    // The potential for the idle level q: the wall fading into the trap,
    // and the painted barrier.
    function blend (q) {
      for (let i = 0; i < V.length; i++) V[i] = (1 - q) * wall[i] + q * trap[i] + bar[i]
      wave.potential(V)
      held = q
    }

    // Raise the barrier in a disc about the grid point (gx, gy).
    function paint (gx, gy) {
      const r2 = BAR_R * BAR_R
      for (let y = Math.max(0, Math.floor(gy - BAR_R)); y <= Math.min(NY - 1, Math.ceil(gy + BAR_R)); y++) {
        for (let x = Math.max(0, Math.floor(gx - BAR_R)); x <= Math.min(NX - 1, Math.ceil(gx + BAR_R)); x++) {
          const d2 = (x - gx) * (x - gx) + (y - gy) * (y - gy)
          if (d2 > r2) continue
          const i = y * NX + x
          bar[i] = Math.max(bar[i], BAR_H * (1 - 0.5 * d2 / r2))
        }
      }
      barTop = BAR_H
      held = -1
    }

    // The brush from its last point to (gx, gy), the gap filled in steps
    // of half a point.
    function stroke (gx, gy) {
      if (!pen) paint(gx, gy)
      else {
        const n = Math.max(1, Math.ceil(Math.hypot(gx - pen[0], gy - pen[1]) / 0.5))
        for (let k = 1; k <= n; k++) paint(pen[0] + (gx - pen[0]) * k / n, pen[1] + (gy - pen[1]) * k / n)
      }
      pen = [gx, gy]
    }

    // The pane's pixel (x, y) as a grid point, by the transform the last
    // frame drew with.
    function grid (x, y) {
      if (!view) return null
      const { turn, s, sy, ox, oy } = view
      return turn ? [(y - ox) / s, (x - oy) / sy] : [(x - ox) / s, (y - oy) / sy]
    }

    function fire (y0, k) {
      wave.packet(16 + 8 * Math.random(), y0, 6, 7, k, 0)
    }

    // The throw's wavenumber for a drag of len grid points.
    const throwK = len => Math.max(K_MIN, Math.min(K_MAX, K_MIN + len / 20))

    function throwAt (p) {
      const dx = p.cx - p.x0
      const dy = p.cy - p.y0
      const len = Math.hypot(dx, dy)
      if (len === 0) return
      const k = throwK(len)
      const x = Math.max(4, Math.min(NX - 5, p.x0))
      const y = Math.max(4, Math.min(NY - 5, p.y0))
      wave.packet(x, y, 4, 4, k * dx / len, k * dy / len)
      throws++
    }

    function pokeAt (gx, gy) {
      pokes++
      const x = Math.max(0, Math.min(NX - 1, gx))
      const y = Math.max(0, Math.min(NY - 1, gy))
      if (wave.norm() < 0.02) {
        wave.packet(x, y, 3, 3, 0, 0)
        flashes.push({ x, y, t: time, kind: 'drop' })
        return
      }
      const found = wave.poke(x, y, POKE_R)
      if (found) catches++
      flashes.push({ x, y, t: time, kind: found ? 'catch' : 'miss' })
    }

    function measure () {
      const i = wave.sample()
      if (i < 0) return
      const n = wave.norm()
      const x = i % NX
      const y = (i - x) / NX
      wave.re.fill(0)
      wave.im.fill(0)
      wave.packet(x, y, 2, 2, 0, 0, n)
      flashes.push({ x, y, t: time, kind: 'catch' })
    }

    function react (e, bass) {
      if (e.kind === 2) fire(NY / 2 + (Math.random() - 0.5) * 6, K_CLASS[e.cls] || 1)
      else if (e.kind === 3) {
        seed++
        build()
        fire(NY / 2, 1)
      } else if (e.kind === 5) {
        fire(NY / 2 - 12, 0.75)
        fire(NY / 2 + 12, 1.5)
      } else if (e.kind === 4 || e.kind === 6) measure()
      else fire(NY / 2 + (Math.random() - 0.5) * 6, 0.6 + 0.9 * Math.min(1, bass))
    }

    // Probability absorbed by the screen becomes detections, each where
    // the absorbed probability says.
    function detect () {
      const { re, im } = wave
      let sum = 0
      for (let y = 0; y < NY; y++) {
        for (let x = SCREEN; x < NX; x++) {
          const i = y * NX + x
          const p = (re[i] * re[i] + im[i] * im[i]) * (1 - mask[i] * mask[i])
          acc[y] += p
          sum += p
        }
      }
      caught += sum
      const Q = 0.03
      while (caught >= Q) {
        caught -= Q
        let total = 0
        for (let y = 0; y < NY; y++) total += acc[y]
        let u = Math.random() * total
        let y = 0
        while (y < NY - 1 && (u -= acc[y]) > 0) y++
        hist[y] += 1
        dots.push({ x: SCREEN + 2 + Math.random() * (NX - SCREEN - 4), y: y + Math.random() - 0.5, t: time })
      }
      if (caught < 1e-4) acc.fill(0)
    }

    build()
    blend(0)
    fire(NY / 2, 1)
    let clock = 0
    let ow = 0
    let oh = 0
    return {
      draw (synth, dt) {
        const w = canvas.width
        const h = canvas.height
        if (w < 4 || h < 4) return
        const L = synth.level
        for (const e of synth.since(mark)) react(e, L.bass)
        const q = Math.min(1, L.idle * 1.4)
        // A press held still long enough arms the brush.
        if (press && !press.gesture && performance.now() - press.t >= HOLD_MS) {
          press.gesture = 'paint'
          strokes++
          stroke(press.cx, press.cy)
        }
        if (barTop > 0) {
          const f = Math.exp(-Math.min(0.1, dt) / BAR_TAU)
          for (let i = 0; i < bar.length; i++) bar[i] *= f
          barTop *= f
          if (barTop < 0.05) {
            bar.fill(0)
            barTop = 0
          }
          held = -1
        }
        if (held < 0 || Math.abs(q - held) > 0.02 || (q === 0 && held !== 0)) blend(q)
        // An orbital at rest: a packet set circling in the trap, a
        // coherent state at its insertion that the mean-field term then
        // makes breathe.
        if (q > 0.6 && wave.norm() < 0.3) wave.packet(NX / 2 + 14, NY / 2, 1 / Math.sqrt(2 * OMEGA), 1 / Math.sqrt(2 * OMEGA), 0, OMEGA * 14)
        clock += Math.min(0.1, dt) * (8 + 16 * Math.min(1, L.bass) + 8 * L.busy) * (1 - 0.4 * L.idle)
        let steps = 0
        while (clock >= DT && steps < 4) {
          wave.step()
          detect()
          wave.damp(mask)
          clock -= DT
          time += DT
          steps++
        }
        if (steps === 4) clock = 0
        const n = wave.norm()
        if (n > 3) wave.scale(Math.sqrt(3 / n))

        let top = 1
        for (let y = 0; y < NY; y++) {
          hist[y] *= 0.9993
          top = Math.max(top, hist[y])
        }
        const { re, im } = wave
        for (let y = 0; y < NY; y++) {
          const hy = hist[y] / top
          const yn = y < NY - 1 ? NX : -NX
          for (let x = 0; x < NX; x++) {
            const i = y * NX + x
            const a = Math.sqrt(re[i] * re[i] + im[i] * im[i])
            let r = 0
            let gg = 0
            let b = 0
            if (a > 1e-3) {
              const v = 1 - Math.exp(-a / 0.03)
              // The local wavenumber from the phase to the next point
              // along x and along y, a flip between them read as a node.
              const j = x < NX - 1 ? i + 1 : i - 1
              const l = i + yn
              const kx = Math.atan2(im[j] * re[i] - re[j] * im[i], re[j] * re[i] + im[j] * im[i])
              const ky = Math.atan2(im[l] * re[i] - re[l] * im[i], re[l] * re[i] + im[l] * im[i])
              const k = Math.hypot(kx, ky)
              if (k > 2.4) {
                rgb[0] = 0.45
                rgb[1] = 0.45
                rgb[2] = 0.5
              } else spectral(k, rgb)
              // A wave at rest, or standing, is dimmer than one moving.
              const m = v * (0.66 + 0.34 * re[i] / a) * (0.55 + 0.45 * Math.min(1, k / K_MIN))
              r = m * rgb[0]
              gg = m * rgb[1]
              b = m * rgb[2]
            }
            const wl = wall[i] * (1 - q)
            const tp = Math.min(1, trap[i] / 2) * q
            const br = bar[i] / BAR_H
            if (wl > 0) {
              const hh = 0.2 + 0.5 * wl / H_MAX
              r += 0.75 * hh
              gg += 0.8 * hh
              b += hh
            } else if (wl < 0) {
              const d = -wl / WELL_MAX
              r += 0.12 + 0.2 * d
              gg += 0.04 * d
              b += 0.22 + 0.45 * d
            }
            r += 0.55 * br
            gg += 0.05 * tp + 0.3 * br
            b += 0.22 * tp + 0.08 * br
            if (x >= SCREEN) {
              r += 0.05 + 0.25 * hy
              gg += 0.06 + 0.3 * hy
              b += 0.05 + 0.15 * hy
            }
            px[i] = 0xff000000 | (Math.min(255, b * 255) << 16) | (Math.min(255, gg * 255) << 8) | Math.min(255, r * 255)
          }
        }
        bg.putImageData(img, 0, 0)

        // The grid on the pane: the long way along the pane's long side.
        // Cells stretched across the grid's short side up to 1.5 times,
        // to fill more of a squarish pane.
        const turn = Math.min(w / NY, h / NX) > Math.min(w / NX, h / NY)
        const [W, H] = turn ? [h, w] : [w, h]
        const s = Math.min(W / NX, H / NY)
        const sy = Math.min(H / NY, 1.5 * s)
        const ox = (W - NX * s) / 2
        const oy = (H - NY * sy) / 2
        view = { turn, s, sy, ox, oy }
        if (w !== ow || h !== oh) {
          ow = w
          oh = h
          layer.width = w
          layer.height = h
          g.setTransform(1, 0, 0, 1, 0, 0)
          g.fillStyle = '#000'
          g.fillRect(0, 0, w, h)
        }
        if (turn) g.setTransform(0, s, sy, 0, oy, ox)
        else g.setTransform(s, 0, 0, sy, ox, oy)
        g.imageSmoothingEnabled = true
        g.drawImage(buf, 0, 0)
        g.save()
        g.beginPath()
        g.rect(0, 0, NX, NY)
        g.clip()
        dots = dots.filter(d => time - d.t < 400)
        for (const d of dots) {
          const a = Math.max(0, 1 - (time - d.t) / 400)
          g.fillStyle = time - d.t < 3 ? `rgba(255, 255, 255, ${a})` : `rgba(170, 255, 200, ${0.8 * a})`
          g.fillRect(d.x - 0.35, d.y - 0.35, 0.7, 0.7)
        }
        flashes = flashes.filter(f => time - f.t < 12)
        g.lineWidth = 0.4
        for (const f of flashes) {
          const k = (time - f.t) / 12
          g.beginPath()
          if (f.kind === 'miss') {
            g.strokeStyle = `rgba(90, 110, 255, ${0.9 * (1 - k)})`
            g.arc(f.x, f.y, POKE_R + 6 * k, 0, Math.PI * 2)
          } else {
            g.strokeStyle = `rgba(255, 255, 255, ${1 - k})`
            g.arc(f.x, f.y, 2 + 14 * k, 0, Math.PI * 2)
          }
          g.stroke()
        }
        // The pointer: the aim of a throw in the colour it will throw,
        // the ring that closes as a hold arms the brush, and the brush.
        if (press) {
          if (press.gesture === 'throw') {
            const len = Math.hypot(press.cx - press.x0, press.cy - press.y0)
            spectral(throwK(len), rgb)
            g.strokeStyle = `rgb(${Math.round(255 * rgb[0])}, ${Math.round(255 * rgb[1])}, ${Math.round(255 * rgb[2])})`
            g.lineWidth = 0.6
            g.beginPath()
            g.moveTo(press.x0, press.y0)
            g.lineTo(press.cx, press.cy)
            g.stroke()
            g.beginPath()
            g.arc(press.x0, press.y0, 2.5, 0, Math.PI * 2)
            g.stroke()
          } else {
            const f = press.gesture === 'paint' ? 1 : Math.min(1, (performance.now() - press.t) / HOLD_MS)
            g.strokeStyle = press.gesture === 'paint' ? 'rgba(255, 190, 60, 0.95)' : `rgba(255, 190, 60, ${0.3 + 0.5 * f})`
            g.lineWidth = 0.5
            g.beginPath()
            g.arc(press.cx, press.cy, BAR_R + 0.8 + 5 * (1 - f), 0, Math.PI * 2)
            g.stroke()
          }
        }
        g.restore()
        g.setTransform(1, 0, 0, 1, 0, 0)
        out.drawImage(layer, 0, 0)
      },

      // The gestures: a press moved DRAG_PX pixels before the hold arms
      // the brush is a throw, released at its aim. A press held still
      // paints from the hold on, see draw. A press released before
      // either is a click, a soft measurement there.
      pointer (kind, x, y, down) {
        const at = grid(x, y)
        if (kind === 'down' && at) {
          presses++
          press = { x0: at[0], y0: at[1], px: x, py: y, t: performance.now(), gesture: null, cx: at[0], cy: at[1] }
          return
        }
        if (!press) return
        if (at && down) {
          press.cx = at[0]
          press.cy = at[1]
          if (!press.gesture && Math.hypot(x - press.px, y - press.py) >= DRAG_PX) press.gesture = 'throw'
          if (press.gesture === 'paint') stroke(at[0], at[1])
        }
        if (down && kind !== 'up') return
        if (press.gesture === 'throw') throwAt(press)
        else if (!press.gesture) pokeAt(press.cx, press.cy)
        press = null
        pen = null
      },

      // For the live checks: the pointer's counts, the barrier's height
      // and extent, and the wall.
      probe () {
        let cells = 0
        for (let i = 0; i < bar.length; i++) if (bar[i] > 0.5) cells++
        return { presses, strokes, throws, pokes, catches, barrier: barTop, cells, seed, family }
      }
    }
  }

  if (typeof module === 'object' && module.exports) module.exports = { Wave, fft, plan, wallgen, rng, FAMILIES, NX, NY, WALL_X0, WALL_X1, H_MAX, WELL_MAX }
  else (root.VizCanvas = root.VizCanvas || {}).quantum = create
})(this)
