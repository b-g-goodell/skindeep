'use strict'
// Quantum mode (decision 0015): a wave function on a 128 by 64 grid
// evolved by the time-dependent Schroedinger equation, hbar = m = 1, by
// the split-step Fourier method: half a step of the potential, a step of
// the kinetic term in momentum space, half a step of the potential. Each
// factor is a phase, so the step is unitary. Drawn by domain colouring:
// the hue is the phase, the brightness the amplitude. Wave packets fly
// at a wall with slits, and the far edge is a detector screen that
// records each detection as a dot, drawn from the probability reaching
// it, so the interference fringes build up dot by dot. A tool call fires
// a packet whose wavelength is its class's, a prompt changes the slits
// and fires, a subagent fires two at once, a stop or a compaction
// measures the position and collapses the state to a narrow packet
// there, and an output event fires one. While the agent idles the wall
// fades into a harmonic trap holding a coherent state that circles in
// it, an orbital at rest. A press and drag of the pointer paints a
// barrier along its path, a ridge of potential above the packets'
// energy that they scatter off, and leak through as it fades. A click
// drops a short one.

;(function (root) {
  const NX = 128
  const NY = 64
  const DT = 0.5
  const WALL = 52
  const V0 = 4
  const SCREEN = NX - 14
  const OMEGA = 0.05
  // The painted barrier: its height, its radius in grid points, and its
  // fade's time constant in seconds. A packet's energy is k^2 / 2, about
  // 0.4 to 1.
  const BAR_H = 2.5
  const BAR_R = 1.6
  const BAR_TAU = 4
  // The slits' centres and half widths, by layout; a circle for the last.
  const LAYOUTS = [
    { slits: [[24, 2], [40, 2]] },
    { slits: [[32, 3]] },
    { slits: [[20, 2], [32, 2], [44, 2]] },
    { disc: [62, 32, 7] }
  ]

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
    }

    // The potential V, per point: its half step, exp(-i V dt / 2).
    potential (V) {
      for (let i = 0; i < V.length; i++) {
        this.vr[i] = Math.cos(-V[i] * this.dt / 2)
        this.vi[i] = Math.sin(-V[i] * this.dt / 2)
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

    // Multiply by a real factor per point: an absorber.
    damp (m) {
      for (let i = 0; i < m.length; i++) {
        this.re[i] *= m[i]
        this.im[i] *= m[i]
      }
    }

    fft2 (sign) {
      const { re, im, nx, ny } = this
      for (let y = 0; y < ny; y++) fft(re, im, y * nx, 1, this.px, sign)
      for (let x = 0; x < nx; x++) fft(re, im, x, nx, this.py, sign)
    }

    step () {
      this.mul(this.vr, this.vi)
      this.fft2(-1)
      this.mul(this.kr, this.ki)
      this.fft2(1)
      this.mul(this.vr, this.vi)
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
    const mark = {}
    const V = new Float64Array(NX * NY)
    const wall = new Float64Array(NX * NY)
    const trap = new Float64Array(NX * NY)
    const mask = new Float64Array(NX * NY)
    const bar = new Float64Array(NX * NY)
    // The barrier's tallest point, the pointer's last grid point while
    // pressed, the grid's place on the pane as last drawn, and the
    // strokes painted so far.
    let barTop = 0
    let pen = null
    let view = null
    let strokes = 0
    const acc = new Float64Array(NY)
    const hist = new Float64Array(NY)
    let caught = 0
    let layout = 0
    let held = -1
    let time = 0
    let dots = []
    let flashes = []

    for (let y = 0; y < NY; y++) {
      for (let x = 0; x < NX; x++) {
        const i = y * NX + x
        trap[i] = 0.5 * OMEGA * OMEGA * ((x - NX / 2) * (x - NX / 2) + (y - NY / 2) * (y - NY / 2))
        const ex = x < 8 ? (8 - x) / 8 : x >= SCREEN ? (x - SCREEN + 1) / (NX - SCREEN) : 0
        const ey = y < 5 ? (5 - y) / 5 : y >= NY - 5 ? (y - NY + 6) / 5 : 0
        mask[i] = (1 - 0.3 * ex * ex) * (1 - 0.2 * ey * ey)
      }
    }

    function build () {
      wall.fill(0)
      const l = LAYOUTS[layout]
      for (let y = 0; y < NY; y++) {
        for (let x = 0; x < NX; x++) {
          let v = 0
          if (l.slits) {
            if (x >= WALL && x < WALL + 3 && !l.slits.some(([c, h]) => Math.abs(y - c) <= h)) v = V0
          } else {
            const [cx, cy, r] = l.disc
            if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) v = V0
          }
          wall[y * NX + x] = v
        }
      }
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

    // The pane's pixel (x, y) as a grid point, by the transform the last
    // frame drew with.
    function grid (x, y) {
      if (!view) return null
      const { turn, s, sy, ox, oy } = view
      return turn ? [(y - ox) / s, (x - oy) / sy] : [(x - ox) / s, (y - oy) / sy]
    }

    function fire (y0, k) {
      wave.packet(20, y0, 6, 7, k, 0)
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
      flashes.push({ x, y, t: time })
    }

    function react (e, bass) {
      if (e.kind === 2) fire(NY / 2 + (Math.random() - 0.5) * 6, 1 + 0.1 * (e.cls || 0))
      else if (e.kind === 3) {
        layout = (layout + 1) % LAYOUTS.length
        build()
        fire(NY / 2, 1.1)
      } else if (e.kind === 5) {
        fire(NY / 2 - 12, 1.2)
        fire(NY / 2 + 12, 1.2)
      } else if (e.kind === 4 || e.kind === 6) measure()
      else fire(NY / 2 + (Math.random() - 0.5) * 6, 0.9 + 0.5 * Math.min(1, bass))
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
    fire(NY / 2, 1.1)
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
        // An orbital at rest: a coherent state set circling in the trap.
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
        if (n > 3) wave.damp(new Float64Array(NX * NY).fill(Math.sqrt(3 / n)))

        let top = 1
        for (let y = 0; y < NY; y++) {
          hist[y] *= 0.9993
          top = Math.max(top, hist[y])
        }
        const { re, im } = wave
        for (let y = 0; y < NY; y++) {
          const hy = hist[y] / top
          for (let x = 0; x < NX; x++) {
            const i = y * NX + x
            const a = Math.sqrt(re[i] * re[i] + im[i] * im[i])
            const v = 1 - Math.exp(-a / 0.03)
            let r = 0
            let gg = 0
            let b = 0
            if (a > 1e-9) {
              const c = re[i] / a
              const s = im[i] / a
              r = v * (0.5 + 0.5 * c)
              gg = v * (0.5 - 0.25 * c + 0.433 * s)
              b = v * (0.5 - 0.25 * c - 0.433 * s)
            }
            const wl = wall[i] / V0 * (1 - q)
            const tp = Math.min(1, trap[i] / 2) * q
            const br = bar[i] / BAR_H
            r += 0.42 * wl + 0.55 * br
            gg += 0.42 * wl + 0.05 * tp + 0.3 * br
            b += 0.45 * wl + 0.22 * tp + 0.08 * br
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
        for (const f of flashes) {
          const k = (time - f.t) / 12
          g.strokeStyle = `rgba(255, 255, 255, ${1 - k})`
          g.lineWidth = 0.4
          g.beginPath()
          g.arc(f.x, f.y, 2 + 14 * k, 0, Math.PI * 2)
          g.stroke()
        }
        g.restore()
        g.setTransform(1, 0, 0, 1, 0, 0)
        out.drawImage(layer, 0, 0)
      },

      // Paint along the pointer's path while it is pressed, the gaps
      // between its reports filled in steps of half a point.
      pointer (kind, x, y, down) {
        const at = grid(x, y)
        if (!down || !at) {
          pen = null
          return
        }
        if (kind === 'down' || !pen) {
          strokes++
          paint(at[0], at[1])
        } else {
          const n = Math.max(1, Math.ceil(Math.hypot(at[0] - pen[0], at[1] - pen[1]) / 0.5))
          for (let k = 1; k <= n; k++) paint(pen[0] + (at[0] - pen[0]) * k / n, pen[1] + (at[1] - pen[1]) * k / n)
        }
        pen = at
      },

      // For the live checks: the barrier's height and extent.
      probe () {
        let cells = 0
        for (let i = 0; i < bar.length; i++) if (bar[i] > 0.5) cells++
        return { strokes, barrier: barTop, cells }
      }
    }
  }

  if (typeof module === 'object' && module.exports) module.exports = { Wave, fft, plan }
  else (root.VizCanvas = root.VizCanvas || {}).quantum = create
})(this)
