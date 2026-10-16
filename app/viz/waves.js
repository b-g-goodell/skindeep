'use strict'
// The gravitational waves of the Gravity modes (decision 0015, issue
// #163), at quadrupole order, G = 1:
//   h_ij^TT(t, x) = 2 / (c^4 r) Lambda_ij,kl(n) Iddot_kl(t - r / c),
// with Iddot_ij = sum_k m_k (2 v_i v_j + x_i a_j + a_i x_j) about the
// centre of mass, exact from the bodies' places, velocities and
// accelerations. The bodies are split into sources: each pair whose
// members pull hardest on each other and are bound is one, about its own
// centre of mass, and every other body with every such pair's centre of
// mass is one more, about the centre of mass of all. By the parallel
// axis theorem the sources' Iddot sum to the whole system's, so the far
// field is the system's, and the fronts of a tight pair leave the pair.
// Each source's Iddot and place are kept against simulation time in a
// ring buffer, read at the retarded time t_r = t - |x - X(t_r)| / c, and
// its field fades within its near zone. The strain is drawn as tanh(GAIN
// h) (shown): GAIN is the one exaggeration.

;(function (root) {
  const GAIN = 5000
  // Samples a source keeps: 128 units of time at the modes' step of 0.25,
  // a front's travel of 1472 at c = 11.5, past every view.
  const KEEP = 512
  let ids = 0

  // Iddot of bodies { m, x, y, z, vx, vy, vz, ax, ay, az } about their
  // centre of mass, [xx, yy, zz, xy, xz, yz]: places, velocities and
  // accelerations taken relative to the centre's, so a body moving
  // uniformly alone gives zero. z terms are 0 where absent, and a body's
  // (ex, ey, ez), where a mode sets them, are left out of its
  // acceleration (gravity3d.js: accel). With c, each body's term is held
  // to 4 m c^2 in norm, the most a body moving at c gives: a
  // Paczynski-Wiita pull grows without bound at a horizon, a fall in
  // general relativity does not.
  function quadrupole (bodies, out = [0, 0, 0, 0, 0, 0], c = 0) {
    let m = 0
    const cm = [0, 0, 0, 0, 0, 0, 0, 0, 0]
    for (const b of bodies) {
      m += b.m
      cm[0] += b.m * b.x
      cm[1] += b.m * b.y
      cm[2] += b.m * (b.z || 0)
      cm[3] += b.m * b.vx
      cm[4] += b.m * b.vy
      cm[5] += b.m * (b.vz || 0)
      cm[6] += b.m * (b.ax - (b.ex || 0))
      cm[7] += b.m * (b.ay - (b.ey || 0))
      cm[8] += b.m * ((b.az || 0) - (b.ez || 0))
    }
    out.fill(0)
    if (!m) return out
    for (let i = 0; i < 9; i++) cm[i] /= m
    for (const b of bodies) {
      const x = b.x - cm[0]
      const y = b.y - cm[1]
      const z = (b.z || 0) - cm[2]
      const vx = b.vx - cm[3]
      const vy = b.vy - cm[4]
      const vz = (b.vz || 0) - cm[5]
      const ax = b.ax - (b.ex || 0) - cm[6]
      const ay = b.ay - (b.ey || 0) - cm[7]
      const az = (b.az || 0) - (b.ez || 0) - cm[8]
      const t0 = 2 * vx * vx + 2 * x * ax
      const t1 = 2 * vy * vy + 2 * y * ay
      const t2 = 2 * vz * vz + 2 * z * az
      const t3 = 2 * vx * vy + x * ay + ax * y
      const t4 = 2 * vx * vz + x * az + ax * z
      const t5 = 2 * vy * vz + y * az + ay * z
      let k = b.m
      if (c) {
        const n = Math.sqrt(t0 * t0 + t1 * t1 + t2 * t2 + 2 * (t3 * t3 + t4 * t4 + t5 * t5))
        if (n > 4 * c * c) k *= 4 * c * c / n
      }
      out[0] += k * t0
      out[1] += k * t1
      out[2] += k * t2
      out[3] += k * t3
      out[4] += k * t4
      out[5] += k * t5
    }
    return out
  }

  // A body's id, kept on it, which keys its pair's trace.
  const id = b => b.gw || (b.gw = ++ids)

  // The orbital frequency of bodies about their centre of mass, Omega^2
  // = sum m |x| |a| / sum m |x|^2, with x and a relative to the centre's
  // and a as quadrupole takes it: Omega for a circular pair, the
  // heaviest orbit's for a crowd.
  function frequency (bodies) {
    let m = 0
    const cm = [0, 0, 0, 0, 0, 0]
    for (const b of bodies) {
      m += b.m
      cm[0] += b.m * b.x
      cm[1] += b.m * b.y
      cm[2] += b.m * (b.z || 0)
      cm[3] += b.m * (b.ax - (b.ex || 0))
      cm[4] += b.m * (b.ay - (b.ey || 0))
      cm[5] += b.m * ((b.az || 0) - (b.ez || 0))
    }
    if (!m) return 0
    let top = 0
    let bottom = 0
    for (const b of bodies) {
      const x = len(b.x - cm[0] / m, b.y - cm[1] / m, (b.z || 0) - cm[2] / m)
      const a = len(b.ax - (b.ex || 0) - cm[3] / m, b.ay - (b.ey || 0) - cm[4] / m, (b.az || 0) - (b.ez || 0) - cm[5] / m)
      top += b.m * x * a
      bottom += b.m * x * x
    }
    return bottom > 0 ? Math.sqrt(top / bottom) : 0
  }

  // The sources of bodies, each Iddot held as quadrupole holds it with c:
  // { key, Q (Iddot), x, y, z, size, axis, omega }, the
  // pairs first, each with d, its members' separation, and m, their
  // mass, and the rest, key 'all', last. size is the source's rms
  // radius, sqrt(tr I / M). axis is the unit angular momentum about its
  // centre, +z when it has none. omega is its orbital frequency.
  function sources (bodies, c = 0) {
    const n = bodies.length
    const best = new Array(n).fill(-1)
    const pull = new Array(n).fill(0)
    for (let i = 0; i < n; i++) {
      const a = bodies[i]
      for (let j = i + 1; j < n; j++) {
        const b = bodies[j]
        const d2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + ((a.z || 0) - (b.z || 0)) ** 2 || 1e-12
        if (b.m / d2 > pull[i]) {
          pull[i] = b.m / d2
          best[i] = j
        }
        if (a.m / d2 > pull[j]) {
          pull[j] = a.m / d2
          best[j] = i
        }
      }
    }
    const out = []
    const rest = []
    const used = new Array(n).fill(false)
    for (let i = 0; i < n; i++) {
      const j = best[i]
      if (j <= i || best[j] !== i) continue
      const a = bodies[i]
      const b = bodies[j]
      const m = a.m + b.m
      const mu = a.m * b.m / m
      const d = [a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0)]
      const v = [a.vx - b.vx, a.vy - b.vy, (a.vz || 0) - (b.vz || 0)]
      const r = Math.hypot(...d)
      if (0.5 * mu * (v[0] ** 2 + v[1] ** 2 + v[2] ** 2) - a.m * b.m / r >= 0) continue
      used[i] = used[j] = true
      const p = {
        m,
        x: (a.m * a.x + b.m * b.x) / m,
        y: (a.m * a.y + b.m * b.y) / m,
        z: (a.m * (a.z || 0) + b.m * (b.z || 0)) / m,
        vx: (a.m * a.vx + b.m * b.vx) / m,
        vy: (a.m * a.vy + b.m * b.vy) / m,
        vz: (a.m * (a.vz || 0) + b.m * (b.vz || 0)) / m,
        ax: (a.m * (a.ax - (a.ex || 0)) + b.m * (b.ax - (b.ex || 0))) / m,
        ay: (a.m * (a.ay - (a.ey || 0)) + b.m * (b.ay - (b.ey || 0))) / m,
        az: (a.m * ((a.az || 0) - (a.ez || 0)) + b.m * ((b.az || 0) - (b.ez || 0))) / m
      }
      rest.push(p)
      const ka = id(a)
      const kb = id(b)
      out.push({ key: ka < kb ? `${ka}-${kb}` : `${kb}-${ka}`, Q: quadrupole([a, b], undefined, c), x: p.x, y: p.y, z: p.z, size: Math.sqrt(mu / m) * r, axis: unit(cross(d, v)), omega: frequency([a, b]), d, m })
    }
    for (let i = 0; i < n; i++) if (!used[i]) rest.push(bodies[i])
    let m = 0
    const cm = [0, 0, 0, 0, 0, 0]
    for (const b of rest) {
      m += b.m
      cm[0] += b.m * b.x
      cm[1] += b.m * b.y
      cm[2] += b.m * (b.z || 0)
      cm[3] += b.m * b.vx
      cm[4] += b.m * b.vy
      cm[5] += b.m * (b.vz || 0)
    }
    if (m) {
      for (let i = 0; i < 6; i++) cm[i] /= m
      let I = 0
      const L = [0, 0, 0]
      for (const b of rest) {
        const d = [b.x - cm[0], b.y - cm[1], (b.z || 0) - cm[2]]
        const l = cross(d, [b.vx - cm[3], b.vy - cm[4], (b.vz || 0) - cm[5]])
        I += b.m * (d[0] ** 2 + d[1] ** 2 + d[2] ** 2)
        for (let k = 0; k < 3; k++) L[k] += b.m * l[k]
      }
      out.push({ key: 'all', Q: quadrupole(rest, undefined, c), x: cm[0], y: cm[1], z: cm[2], size: Math.sqrt(I / m), axis: unit(L), omega: frequency(rest) })
    }
    return out
  }

  function cross (a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  }

  function unit (v) {
    const l = Math.hypot(...v)
    return l > 0 ? v.map(x => x / l) : [0, 0, 1]
  }

  // One source's history: its Iddot, its running integral, its place
  // and its near zone's radius against time, the last KEEP samples. A
  // read before the first sample or after the last is nothing: the
  // source was not yet, or is no more.
  function Trace () {
    this.t = new Float64Array(KEEP)
    this.q = new Float64Array(6 * KEEP)
    this.s = new Float64Array(6 * KEEP)
    this.p = new Float64Array(4 * KEEP)
    this.n = 0
    this.head = 0
    this.axis = [0, 0, 1]
    this.live = true
    // The newest place.
    this.nx = this.ny = this.nz = 0
  }

  Trace.prototype.push = function (t, Q, x, y, z, near) {
    const k = this.head
    const j = (k + KEEP - 1) % KEEP
    const dt = this.n ? t - this.t[j] : 0
    this.t[k] = t
    for (let i = 0; i < 6; i++) {
      this.q[6 * k + i] = Q[i]
      this.s[6 * k + i] = this.n ? this.s[6 * j + i] + (Q[i] + this.q[6 * j + i]) * dt / 2 : 0
    }
    this.p[4 * k] = x
    this.p[4 * k + 1] = y
    this.p[4 * k + 2] = z
    this.p[4 * k + 3] = near
    this.head = (k + 1) % KEEP
    this.n = Math.min(KEEP, this.n + 1)
    this.nx = x
    this.ny = y
    this.nz = z
  }

  // The newest sample, and the time of the oldest kept.
  Trace.prototype.last = function () {
    return this.n ? this.t[(this.head + KEEP - 1) % KEEP] : -Infinity
  }

  Trace.prototype.first = function () {
    return this.n ? this.t[(this.head + KEEP - this.n) % KEEP] : Infinity
  }

  // The sample at or before t, as its slot, with the fraction of the way
  // to the next in F[0]; -1 when the source was not at t.
  const F = [0]
  Trace.prototype.find = function (t) {
    const n = this.n
    if (!n) return -1
    const newest = (this.head + KEEP - 1) % KEEP
    const tl = this.t[newest]
    if (t > tl + 1e-9 || t < this.first()) return -1
    // From the newest back, by the step, then sample by sample.
    let back = Math.min(n - 1, Math.max(0, Math.floor((tl - t) / 0.25)))
    let k = (newest + KEEP - back) % KEEP
    while (back > 0 && this.t[k] < t) {
      back--
      k = (k + 1) % KEEP
    }
    while (back < n - 1 && this.t[k] > t) {
      back++
      k = (k + KEEP - 1) % KEEP
    }
    F[0] = back === 0 || this.t[k] === t ? 0 : (t - this.t[k]) / (this.t[(k + 1) % KEEP] - this.t[k])
    return k
  }

  // Into out, the place and the near zone's radius at time t, linearly
  // between samples; into q, if given, the Iddot. False when the source
  // was not at t.
  Trace.prototype.at = function (t, out, q) {
    const k = this.find(t)
    if (k < 0) return false
    const s = F[0]
    const k1 = s ? (k + 1) % KEEP : k
    for (let i = 0; i < 4; i++) out[i] = this.p[4 * k + i] + s * (this.p[4 * k1 + i] - this.p[4 * k + i])
    if (q) for (let i = 0; i < 6; i++) q[i] = this.q[6 * k + i] + s * (this.q[6 * k1 + i] - this.q[6 * k + i])
    return true
  }

  // Into q, the mean Iddot over [t - b, t + b], nothing outside the
  // samples kept: a box filter in retarded time, so a front thinner than
  // a drawn cell, or the edge where a source begins or ends, is drawn
  // ramped over the box rather than aliased. A live source's future is
  // not nothing but not yet known: the box stops at its newest sample.
  // False when the box misses the samples.
  const S0 = [0, 0, 0, 0, 0, 0]
  Trace.prototype.mean = function (t, b, q) {
    const t0 = Math.max(this.first(), t - b)
    const t1 = Math.min(this.last(), t + b)
    if (!(t1 > t0)) return false
    this.integral(t0, S0)
    this.integral(t1, q)
    const w = (this.live ? Math.min(t + b, this.last()) : t + b) - (t - b)
    for (let i = 0; i < 6; i++) q[i] = (q[i] - S0[i]) / w
    return true
  }

  // The running integral of Iddot at t, within the samples kept, into q.
  Trace.prototype.integral = function (t, q) {
    const k = this.find(t)
    const s = F[0]
    const k1 = s ? (k + 1) % KEEP : k
    const dt = s ? this.t[k1] - this.t[k] : 0
    // The trapezoid to t, Iddot linear between the samples.
    for (let i = 0; i < 6; i++) {
      const a = this.q[6 * k + i]
      const b = this.q[6 * k1 + i]
      q[i] = this.s[6 * k + i] + dt * s * (a + (a + s * (b - a))) / 2
    }
  }

  // The field of a mode with wave speed c: every source's trace, by key.
  // A source not seen for KEEP samples has left every view and goes.
  function Field (c) {
    this.c = c
    this.traces = new Map()
  }

  Field.prototype.reset = function () {
    this.traces.clear()
  }

  // A sample of bodies at time t. Returns the sources. Each source's
  // near zone reaches the larger of twice its size and its reduced
  // wavelength c / (2 Omega), Omega its orbital frequency: within it the
  // field is the Newtonian tide, not yet a wave, and the formula does
  // not hold.
  Field.prototype.sample = function (t, bodies) {
    const list = sources(bodies, this.c)
    for (const s of list) {
      let tr = this.traces.get(s.key)
      if (!tr) this.traces.set(s.key, tr = new Trace())
      const near = this.c / (2 * Math.max(s.omega, 1e-6))
      tr.push(t, s.Q, s.x, s.y, s.z, Math.max(2 * s.size + 2, Math.min(near, 1e6)))
      tr.axis = s.axis
    }
    for (const tr of this.traces.values()) tr.live = tr.last() === t
    for (const [k, tr] of this.traces) if (t - tr.last() > KEEP * 0.25) this.traces.delete(k)
    return list
  }

  // Every place kept moved by (dx, dy, dz), as a mode moves its bodies
  // when it recentres them.
  Field.prototype.shift = function (dx, dy, dz) {
    for (const tr of this.traces.values()) {
      for (let k = 0; k < KEEP; k++) {
        tr.p[4 * k] += dx
        tr.p[4 * k + 1] += dy
        tr.p[4 * k + 2] += dz
      }
      tr.nx += dx
      tr.ny += dy
      tr.nz += dz
    }
  }

  const X = [0, 0, 0, 0]
  const Q = [0, 0, 0, 0, 0, 0]
  const E = [[0, 0, 0], [0, 0, 0]]
  const N = [0, 0, 0]
  // Math.hypot is several times slower.
  const len = (x, y, z) => Math.sqrt(x * x + y * y + z * z)

  // Q's quadratic form on unit vectors a and b.
  function form (q, a, b) {
    return q[0] * a[0] * b[0] + q[1] * a[1] * b[1] + q[2] * a[2] * b[2] +
      q[3] * (a[0] * b[1] + a[1] * b[0]) + q[4] * (a[0] * b[2] + a[2] * b[0]) + q[5] * (a[1] * b[2] + a[2] * b[1])
  }

  // The polarizations of tr's wave at (x, y, z) at time t into out, as
  // [h_+, h_x] about its axis: with n the direction from the source at
  // the retarded time, e_phi = axis x n and e_theta = e_phi x n
  // normalized, h_+ = (Q_tt - Q_pp) / (c^4 r) and h_x = 2 Q_tp / (c^4 r).
  // With view, a unit vector, e_phi = view x n instead: the basis of a
  // viewer looking along view, never singular for n across the view.
  // With blur, Iddot is its mean over t_r +- blur (Trace.mean). Within
  // the near zone, r below r_0 as sample sets it at the retarded time,
  // the field fades by (r^2 / (r^2 + r_0^2))^2 instead of growing as
  // 1 / r. False when the source was not at the retarded time.
  Field.prototype.wave = function (tr, t, x, y, z, out, view, blur) {
    const c = this.c
    if (!tr.n) return false
    // Three steps of the map that takes t_r to t - |x - X(t_r)| / c,
    // from t_r = t, the newest place, which close on its fixed point as
    // (v / c)^3 for a source moving at v. Places outside the samples are
    // the nearest sample's.
    const lo = tr.first()
    const hi = tr.last()
    let r = len(x - tr.nx, y - tr.ny, z - tr.nz)
    let u = t - r / c
    for (let k = 0; k < 2; k++) {
      if (!blur && (u < lo || u > hi + 1e-9)) return false
      tr.at(Math.max(lo, Math.min(hi, u)), X)
      r = len(x - X[0], y - X[1], z - X[2])
      u = t - r / c
    }
    if (blur) {
      tr.at(Math.max(lo, Math.min(hi, u)), X)
      if (!tr.mean(u, blur, Q)) return false
    } else if (!tr.at(u, X, Q)) return false
    const dx = x - X[0]
    const dy = y - X[1]
    const dz = z - X[2]
    r = len(dx, dy, dz)
    if (r < 1e-9) {
      out[0] = out[1] = 0
      return true
    }
    const n = N
    n[0] = dx / r
    n[1] = dy / r
    n[2] = dz / r
    const a = view || tr.axis
    const p = E[1]
    p[0] = a[1] * n[2] - a[2] * n[1]
    p[1] = a[2] * n[0] - a[0] * n[2]
    p[2] = a[0] * n[1] - a[1] * n[0]
    let l = len(p[0], p[1], p[2])
    if (l < 1e-9) {
      // Along the axis: any transverse basis.
      const s = Math.abs(n[2]) < 0.9 ? 2 : 0
      p[0] = s === 2 ? n[1] : 0
      p[1] = s === 2 ? -n[0] : n[2]
      p[2] = s === 2 ? 0 : -n[1]
      l = len(p[0], p[1], p[2])
    }
    p[0] /= l
    p[1] /= l
    p[2] /= l
    const e = E[0]
    e[0] = p[1] * n[2] - p[2] * n[1]
    e[1] = p[2] * n[0] - p[0] * n[2]
    e[2] = p[0] * n[1] - p[1] * n[0]
    const r0 = X[3]
    const f = r * r / (r * r + r0 * r0)
    const k = f * f / (c * c * c * c * r)
    out[0] = k * (form(Q, e, e) - form(Q, p, p))
    out[1] = k * 2 * form(Q, e, p)
    return true
  }

  // The tightest pair, watched for the live checks: the turns of its
  // orbit and the sign changes of its h_+ at a point DIST from it, along
  // its axis (axis true) or in its plane, which a wave at twice the
  // orbital frequency changes four times a turn.
  const DIST = 80
  function Watch (field, axis) {
    this.field = field
    this.axis = axis
    this.key = null
  }

  Watch.prototype.sample = function (t, list) {
    const pairs = list.filter(s => s.key !== 'all')
    const period = s => 2 * Math.PI * Math.sqrt(len(s.d[0], s.d[1], s.d[2]) ** 3 / s.m)
    let s = this.key && pairs.find(p => p.key === this.key)
    if (!s) {
      this.key = null
      s = pairs.reduce((a, b) => !a || period(b) < period(a) ? b : a, null)
      if (!s) return
      this.key = s.key
      this.turns = 0
      this.flips = 0
      this.sign = 0
      const a = s.axis
      const o = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]
      this.p = unit(cross(a, o))
      this.q = cross(a, this.p)
      this.dir = this.axis ? a.slice() : this.p.slice()
      this.ang = Math.atan2(dot(s.d, this.q), dot(s.d, this.p))
    }
    const ang = Math.atan2(dot(s.d, this.q), dot(s.d, this.p))
    this.turns += Math.atan2(Math.sin(ang - this.ang), Math.cos(ang - this.ang)) / (2 * Math.PI)
    this.ang = ang
    this.sep = len(s.d[0], s.d[1], s.d[2])
    this.period = period(s)
    const h = [0, 0]
    const tr = this.field.traces.get(s.key)
    if (tr && this.field.wave(tr, t, s.x + DIST * this.dir[0], s.y + DIST * this.dir[1], s.z + DIST * this.dir[2], h) && h[0]) {
      const sg = Math.sign(h[0])
      if (this.sign && sg !== this.sign) this.flips++
      this.sign = sg
    }
  }

  Watch.prototype.report = function () {
    if (!this.key) return null
    const r = x => Math.round(x * 1000) / 1000
    return { sep: r(this.sep), period: r(this.period), turns: r(Math.abs(this.turns)), flips: this.flips }
  }

  function dot (a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  }

  // The pane says the waves are exaggerated, in the captions' face and
  // colour at text size t: at its top right, clear of the drop-down's
  // button (layout.js: 4 px in, 150 by 20 at t = 1), else shorter, else
  // under the button.
  const SAYS = [`gravitational waves, exaggerated x${GAIN}`, `waves exaggerated x${GAIN}`]
  function label (g, w, t) {
    g.font = `${Math.round(11 * t)}px "DejaVu Sans Mono", monospace`
    g.fillStyle = 'rgba(200, 255, 220, 0.55)'
    g.textBaseline = 'top'
    const right = 4 + Math.round(150 * t) + 6
    let at = null
    for (const s of SAYS) {
      if (w - 6 - g.measureText(s).width >= right) {
        at = s
        break
      }
    }
    if (at) {
      g.textAlign = 'right'
      g.fillText(at, w - 6, 6)
    } else g.fillText(SAYS[1], 6, 4 + Math.round(20 * t) + 4)
    g.textAlign = 'start'
    g.textBaseline = 'alphabetic'
  }

  // The strain as drawn, on a grid gw by gh of h into out: tanh(GAIN h /
  // s), s the grid's local steepness, the largest step of GAIN h to a
  // neighbour over 0.8, at least 1. Where a strong source's strain turns
  // from + to - within a cell, the turn then spans a cell or so, not an
  // edge that the blur up to the pane would draw as steps. Elsewhere s
  // is 1.
  function shown (h, gw, gh, out) {
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const o = j * gw + i
        const c = GAIN * h[o]
        let d = 0
        if (i > 0) d = Math.max(d, Math.abs(GAIN * h[o - 1] - c))
        if (i < gw - 1) d = Math.max(d, Math.abs(GAIN * h[o + 1] - c))
        if (j > 0) d = Math.max(d, Math.abs(GAIN * h[o - gw] - c))
        if (j < gh - 1) d = Math.max(d, Math.abs(GAIN * h[o + gw] - c))
        out[o] = Math.tanh(c / Math.max(1, d / 0.8))
      }
    }
    return out
  }

  const api = { GAIN, quadrupole, sources, Trace, Field, Watch, shown, label }
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.VizWaves = api
})(this)
