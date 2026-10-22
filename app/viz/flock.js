'use strict'
// The flocking core of the flocking modes (decision 0015). Prey steer by
// separation, alignment and cohesion with their neighbours (Reynolds,
// "Flocks, Herds, and Schools", SIGGRAPH 1987), plus flight from any
// predator within their sight. Predators steer by pursuit of a target
// they pick: a straggler, the edge of the group, or a dash into the
// middle that splits it. One predator or a small group, as the mode
// adds them.
//
// The neighbours are by distance, every prey within r, or by rank, the
// nearest k within r, as starlings follow their nearest seven or so
// (Ballerini et al., PNAS 105, 2008). Both are found on a hashed grid.
// Fear is each prey's alarm in [0, 1]: a predator in sight raises it,
// neighbours pass it on, and it fades. It moves each prey from its
// resting rule to its flight rule: faster, tighter, more aligned, and
// in file behind the neighbour ahead, so a herd that grazes loose
// bunches at a threat and streams in columns in flight. A prey flees
// away from a predator and to the side of its run, so a dash splits the
// group and it closes again behind.
//
// The plane (dim 2) keeps z at 0. Space (dim 3) uses all three. The
// mode keeps the predators as plain objects in flock.predators and
// steps the whole by step(dt), substeps of at most H, so the motion is
// the same at any frame rate. Draws nothing and touches no DOM: loaded
// by the viz page and by the tests.

;(function (root) {
  const H = 1 / 30
  // Neighbours a prey reads at most under the distance rule.
  const MAX_N = 24

  // The prey's rule. Lengths in the mode's units, times in seconds.
  // sep: the distance kept from a neighbour at rest, bunch: the share of
  // it given up at full fear. cruise and flight: the top speed at rest
  // and at full fear, accel and accelFlight the steering's limit. The
  // weights of separation, alignment and cohesion, and the factors by
  // which fear raises alignment and cohesion. sight: the distance at
  // which a prey sees a predator, flee: the weight of flight from it,
  // fountain: the share of that flight turned to the side of the
  // predator's run. fearDecay: fear lost a second, fearSpread: the rate
  // at which a prey takes up its neighbours' fear, fearPass: the share
  // passed on. follow: the weight, in flight, of a place behind the
  // neighbour ahead. wander: a slow random steer at rest. drift: a
  // velocity the group drifts toward at rest, driftW its weight.
  // gather: the weight, at rest, of a steer to the centre of all the
  // prey, which grows with the distance from it past the radius of the
  // whole group at rest, so groups split by an attack rejoin.
  // bounds: null, or { x, y, z, r, w }: past r from the point a steer
  // back, of weight w.
  const DEFAULTS = {
    neighbours: { by: 'distance', r: 14 },
    sep: 5,
    bunch: 0.45,
    cruise: 0.8,
    flight: 16,
    minSpeed: 0,
    accel: 3,
    accelFlight: 26,
    sepW: 1.6,
    alignW: 0.5,
    cohW: 0.35,
    alignFear: 3,
    cohFear: 2,
    sight: 55,
    flee: 2.5,
    fountain: 0.7,
    fearDecay: 0.18,
    fearSpread: 4,
    fearPass: 0.88,
    follow: 0.8,
    wander: 0.5,
    drift: [0, 0, 0],
    driftW: 0.25,
    gather: 0.4,
    bounds: null
  }

  // A seeded generator in [0, 1): mulberry32, as quantum.js.
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

  // A predator: where it is, its top speed and steering limit, the
  // distance at which it takes its target, seen: the share of the prey's
  // sight at which they see it (low while it stalks), range: the
  // distance within which it reads the group for a pick. target: the
  // prey's index or -1, how: its pick, goal: a point it heads for
  // instead while it has no target, or null.
  function predator (o) {
    return Object.assign({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, speed: 20, accel: 30, reach: 1.5, seen: 1, range: Infinity, target: -1, how: 'edge', goal: null }, o)
  }

  class Flock {
    // o: { dim: 2 or 3, cap: the most prey, params: over DEFAULTS, rnd }
    constructor (o = {}) {
      this.dim = o.dim === 3 ? 3 : 2
      this.cap = o.cap || 1024
      this.rnd = o.rnd || Math.random
      this.p = Object.assign({}, DEFAULTS, o.params)
      const n3 = 3 * this.cap
      this.n = 0
      this.pos = new Float64Array(n3)
      this.vel = new Float64Array(n3)
      this.wan = new Float64Array(n3)
      this.fear = new Float32Array(this.cap)
      // The mean distance to the neighbours read in the last step, the
      // neighbours' bound when none: how alone a prey is.
      this.lone = new Float32Array(this.cap)
      // Each prey's own number, which no other prey of the run takes,
      // and the distance it has run.
      this.id = new Uint32Array(this.cap)
      this.odo = new Float64Array(this.cap)
      this.ids = 0
      this.predators = []
      this.clock = 0
      // The grid: a hashed table of chains, each prey's cell.
      let t = 1
      while (t < 2 * this.cap) t *= 2
      this.mask = t - 1
      this.head = new Int32Array(t)
      this.link = new Int32Array(this.cap)
      this.cell = new Int32Array(n3)
      this.fresh = new Float32Array(this.cap)
      this.ax = new Float64Array(3)
      this.nb = new Int32Array(MAX_N)
      this.nd = new Float64Array(MAX_N)
    }

    // A prey at (x, y, z) moving at (vx, vy, vz): its index, or -1 when
    // the flock is full.
    add (x, y, z, vx, vy, vz) {
      if (this.n >= this.cap) return -1
      const i = this.n++
      const k = 3 * i
      const flat = this.dim === 2
      this.pos[k] = x
      this.pos[k + 1] = y
      this.pos[k + 2] = flat ? 0 : z
      this.vel[k] = vx
      this.vel[k + 1] = vy
      this.vel[k + 2] = flat ? 0 : vz
      const a = this.rnd() * Math.PI * 2
      const b = flat ? 0 : Math.asin(2 * this.rnd() - 1)
      this.wan[k] = Math.cos(a) * Math.cos(b)
      this.wan[k + 1] = Math.sin(a) * Math.cos(b)
      this.wan[k + 2] = Math.sin(b)
      this.fear[i] = 0
      this.lone[i] = this.p.neighbours.r
      this.odo[i] = this.rnd() * 10
      this.id[i] = this.ids++
      return i
    }

    // Prey i gone: the last takes its index, and the predators' targets
    // follow.
    remove (i) {
      const j = --this.n
      for (const q of this.predators) {
        if (q.target === i) q.target = -1
        else if (q.target === j) q.target = i
      }
      if (i === j) return
      for (let c = 0; c < 3; c++) {
        this.pos[3 * i + c] = this.pos[3 * j + c]
        this.vel[3 * i + c] = this.vel[3 * j + c]
        this.wan[3 * i + c] = this.wan[3 * j + c]
      }
      this.fear[i] = this.fear[j]
      this.lone[i] = this.lone[j]
      this.id[i] = this.id[j]
      this.odo[i] = this.odo[j]
    }

    // A predator made from o (see predator), added.
    hunter (o) {
      const q = predator(o)
      if (this.dim === 2) q.z = q.vz = 0
      this.predators.push(q)
      return q
    }

    // The centre of the prey, and their root mean square distance from
    // it, of those within range of (x, y, z) if given: { x, y, z, r, n }.
    centre (x, y, z, range) {
      let sx = 0
      let sy = 0
      let sz = 0
      let m = 0
      const P = this.pos
      const near = range !== undefined && range < Infinity
      for (let i = 0; i < this.n; i++) {
        const k = 3 * i
        if (near && (P[k] - x) ** 2 + (P[k + 1] - y) ** 2 + (P[k + 2] - z) ** 2 > range * range) continue
        sx += P[k]
        sy += P[k + 1]
        sz += P[k + 2]
        m++
      }
      if (!m) return { x: x || 0, y: y || 0, z: z || 0, r: 0, n: 0 }
      sx /= m
      sy /= m
      sz /= m
      let s = 0
      for (let i = 0; i < this.n; i++) {
        const k = 3 * i
        const d2 = (P[k] - sx) ** 2 + (P[k + 1] - sy) ** 2 + (P[k + 2] - sz) ** 2
        if (!near || (P[k] - x) ** 2 + (P[k + 1] - y) ** 2 + (P[k + 2] - z) ** 2 <= range * range) s += d2
      }
      return { x: sx, y: sy, z: sz, r: Math.sqrt(s / m), n: m }
    }

    // Predator q picks its target by how: 'straggler', the prey most
    // alone and farthest from the group's centre, nearer ones first,
    // 'edge', the nearest prey, or 'middle', the prey nearest the centre
    // of the group within its range, at which it dashes through the
    // group. Returns the index, -1 with no prey.
    pick (q, how) {
      if (how) q.how = how
      q.target = -1
      if (!this.n) return -1
      const P = this.pos
      const dq = i => Math.hypot(P[3 * i] - q.x, P[3 * i + 1] - q.y, P[3 * i + 2] - q.z)
      let best = -1
      let score = -Infinity
      if (q.how === 'middle') {
        const c = this.centre(q.x, q.y, q.z, q.range)
        for (let i = 0; i < this.n; i++) {
          const s = -Math.hypot(P[3 * i] - c.x, P[3 * i + 1] - c.y, P[3 * i + 2] - c.z)
          if (s > score) [best, score] = [i, s]
        }
      } else if (q.how === 'straggler') {
        const c = this.centre(q.x, q.y, q.z, q.range)
        const r = this.p.neighbours.r
        for (let i = 0; i < this.n; i++) {
          const s = 1.5 * this.lone[i] / r * c.r + Math.hypot(P[3 * i] - c.x, P[3 * i + 1] - c.y, P[3 * i + 2] - c.z) - 0.35 * dq(i)
          if (s > score) [best, score] = [i, s]
        }
      } else {
        for (let i = 0; i < this.n; i++) {
          const s = -dq(i)
          if (s > score) [best, score] = [i, s]
        }
      }
      q.target = best
      return best
    }

    // Each prey's cell on the grid of side c, chained in the table.
    hash (c) {
      this.head.fill(-1)
      const P = this.pos
      const C = this.cell
      for (let i = 0; i < this.n; i++) {
        const k = 3 * i
        C[k] = Math.floor(P[k] / c)
        C[k + 1] = Math.floor(P[k + 1] / c)
        C[k + 2] = Math.floor(P[k + 2] / c)
        const b = this.bucket(C[k], C[k + 1], C[k + 2])
        this.link[i] = this.head[b]
        this.head[b] = i
      }
    }

    bucket (x, y, z) {
      return (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) & this.mask
    }

    // Prey i's neighbours into this.nb and their distances into this.nd,
    // nearest first under the rank rule: returns how many.
    near (i, c) {
      const rule = this.p.neighbours
      const P = this.pos
      const C = this.cell
      const k = 3 * i
      const [cx, cy, cz] = [C[k], C[k + 1], C[k + 2]]
      const rank = rule.by === 'rank'
      const want = rank ? Math.min(MAX_N, rule.k || 7) : MAX_N
      const r2 = rule.r * rule.r
      const reach = Math.ceil(rule.r / c)
      const zr = this.dim === 2 ? 0 : 1
      let m = 0
      for (let ring = 0; ring <= reach; ring++) {
        for (let dz = -ring * zr; dz <= ring * zr; dz++) {
          for (let dy = -ring; dy <= ring; dy++) {
            for (let dx = -ring; dx <= ring; dx++) {
              if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== ring) continue
              const x = cx + dx
              const y = cy + dy
              const z = cz + dz
              for (let j = this.head[this.bucket(x, y, z)]; j >= 0; j = this.link[j]) {
                if (j === i || C[3 * j] !== x || C[3 * j + 1] !== y || C[3 * j + 2] !== z) continue
                const d2 = (P[3 * j] - P[k]) ** 2 + (P[3 * j + 1] - P[k + 1]) ** 2 + (P[3 * j + 2] - P[k + 2]) ** 2
                if (d2 > r2) continue
                if (!rank) {
                  if (m < want) {
                    this.nb[m] = j
                    this.nd[m++] = Math.sqrt(d2)
                  }
                  continue
                }
                // Kept sorted, the farthest dropped past k.
                const d = Math.sqrt(d2)
                if (m === want && d >= this.nd[m - 1]) continue
                let s = m < want ? m++ : m - 1
                while (s > 0 && this.nd[s - 1] > d) {
                  this.nb[s] = this.nb[s - 1]
                  this.nd[s] = this.nd[s - 1]
                  s--
                }
                this.nb[s] = j
                this.nd[s] = d
              }
            }
          }
        }
        // No prey of a farther ring is nearer than ring * c.
        if (rank && m === want && this.nd[m - 1] <= ring * c) break
        if (!rank && m === want) break
      }
      return m
    }

    // Advance by dt seconds: returns the prey taken, { q, id, x, y, z }.
    step (dt) {
      const out = []
      let left = Math.max(0, dt)
      while (left > 1e-9) {
        const h = Math.min(H, left)
        this.sub(h, out)
        left -= h
      }
      return out
    }

    sub (h, out) {
      const p = this.p
      const P = this.pos
      const V = this.vel
      const Wn = this.wan
      const F = this.fear
      const rule = p.neighbours
      const c = rule.cell || (rule.by === 'rank' ? rule.r / 3 : rule.r)
      const flat = this.dim === 2
      const qs = this.predators
      this.hash(c)
      const g0 = this.centre()
      // The radius of a group of n at rest, packed at sep.
      const R0 = 0.4 * p.sep * Math.sqrt(this.n)
      const ax = this.ax
      // A steer toward (x, y, z), its length capped at 1, of weight w.
      const add = (x, y, z, w) => {
        const l = Math.hypot(x, y, z)
        if (l < 1e-9) return
        const s = w * Math.min(1, l) / l
        ax[0] += x * s
        ax[1] += y * s
        ax[2] += z * s
      }
      for (let i = 0; i < this.n; i++) {
        const k = 3 * i
        const f = F[i]
        const sep = p.sep * (1 - p.bunch * f)
        const vx = V[k]
        const vy = V[k + 1]
        const vz = V[k + 2]
        const sp = Math.hypot(vx, vy, vz)
        const m = this.near(i, c)
        let sx = 0
        let sy = 0
        let sz = 0
        let mx = 0
        let my = 0
        let mz = 0
        let ux = 0
        let uy = 0
        let uz = 0
        let dsum = 0
        let fn = 0
        let lead = -1
        let ld = Infinity
        for (let a = 0; a < m; a++) {
          const j = this.nb[a]
          const d = Math.max(1e-6, this.nd[a])
          const dx = P[k] - P[3 * j]
          const dy = P[k + 1] - P[3 * j + 1]
          const dz = P[k + 2] - P[3 * j + 2]
          if (d < sep) {
            const w = (1 - d / sep) / d
            sx += dx * w
            sy += dy * w
            sz += dz * w
          }
          mx -= dx
          my -= dy
          mz -= dz
          ux += V[3 * j]
          uy += V[3 * j + 1]
          uz += V[3 * j + 2]
          dsum += d
          if (F[j] > fn) fn = F[j]
          // The nearest neighbour ahead, within 45 degrees of the
          // heading.
          if (sp > 0.1 && -(dx * vx + dy * vy + dz * vz) > 0.7 * d * sp && d < ld) {
            lead = j
            ld = d
          }
        }
        this.lone[i] = m ? dsum / m : rule.r
        ax[0] = 0
        ax[1] = 0
        ax[2] = 0
        add(sx, sy, sz, p.sepW * (1 + f))
        // Afraid, it runs: up to the speed its fear sets, along its
        // heading. Far from the rest it trots back, up to four times its
        // resting speed.
        const gx = g0.x - P[k]
        const gy = g0.y - P[k + 1]
        const gz = g0.z - P[k + 2]
        const gd = Math.hypot(gx, gy, gz)
        const u = p.gather ? Math.max(0, Math.min(1, (gd - R0) / R0)) : 0
        const top = Math.max(p.cruise + (p.flight - p.cruise) * f, p.cruise * (1 + 3 * u * u))
        if (f > 0 && sp > 1e-6 && sp < top) add(vx / sp, vy / sp, vz / sp, f * (top - sp) / top * 2)
        if (m) {
          const vs = Math.max(1, sp)
          add((ux / m - vx) / vs, (uy / m - vy) / vs, (uz / m - vz) / vs, p.alignW * (1 + p.alignFear * f))
          add(mx / m / rule.r, my / m / rule.r, mz / m / rule.r, p.cohW * (1 + p.cohFear * f))
        }
        // In file behind the neighbour ahead.
        if (lead >= 0 && p.follow > 0 && f > 0.2) {
          const j = 3 * lead
          const ls = Math.max(0.1, Math.hypot(V[j], V[j + 1], V[j + 2]))
          const gap = sep * 0.9
          add((P[j] - V[j] / ls * gap - P[k]) / sep, (P[j + 1] - V[j + 1] / ls * gap - P[k + 1]) / sep, (P[j + 2] - V[j + 2] / ls * gap - P[k + 2]) / sep, p.follow * f)
        }
        // Flight from every predator in sight.
        let threat = 0
        for (const q of qs) {
          const dx = P[k] - q.x
          const dy = P[k + 1] - q.y
          const dz = P[k + 2] - q.z
          const d = Math.max(1e-6, Math.hypot(dx, dy, dz))
          const R = p.sight * (q.seen === undefined ? 1 : q.seen)
          if (d >= R) continue
          const t = 1 - d / R
          threat = Math.max(threat, t)
          let x = dx / d
          let y = dy / d
          let z = dz / d
          const qv = Math.hypot(q.vx, q.vy, q.vz)
          if (qv > 0.5) {
            // To the side of the predator's run, the side the prey is on.
            const ex = q.vx / qv
            const ey = q.vy / qv
            const ez = q.vz / qv
            const along = x * ex + y * ey + z * ez
            let lx = x - along * ex
            let ly = y - along * ey
            let lz = z - along * ez
            const ll = Math.hypot(lx, ly, lz)
            if (ll > 1e-6) {
              lx /= ll
              ly /= ll
              lz /= ll
              x += p.fountain * lx
              y += p.fountain * ly
              z += p.fountain * lz
            }
          }
          add(x, y, z, p.flee * (0.4 + 0.6 * t) * 4)
        }
        // A slow random steer at rest, a drift, and the bounds.
        const wv = this.rnd
        Wn[k] += (wv() - 0.5) * 1.5 * Math.sqrt(h) * 2
        Wn[k + 1] += (wv() - 0.5) * 1.5 * Math.sqrt(h) * 2
        Wn[k + 2] = flat ? 0 : Wn[k + 2] + (wv() - 0.5) * 1.5 * Math.sqrt(h) * 2
        const wl = Math.hypot(Wn[k], Wn[k + 1], Wn[k + 2]) || 1
        Wn[k] /= wl
        Wn[k + 1] /= wl
        Wn[k + 2] /= wl
        add(Wn[k], Wn[k + 1], Wn[k + 2], p.wander * (1 - f))
        const dr = p.drift
        const drl = Math.max(1, Math.hypot(dr[0], dr[1], dr[2]))
        if (p.driftW) add((dr[0] - vx) / drl, (dr[1] - vy) / drl, (dr[2] - vz) / drl, p.driftW * (1 - f))
        if (u > 0) add(gx, gy, gz, p.gather * (1 - f) * u)
        const b = p.bounds
        if (b) {
          const dx = b.x - P[k]
          const dy = b.y - P[k + 1]
          const dz = flat ? 0 : (b.z || 0) - P[k + 2]
          const d = Math.hypot(dx, dy, dz)
          if (d > b.r) add(dx / d, dy / d, dz / d, b.w * Math.min(3, (d - b.r) / b.r * 4))
        }
        // The steer, limited, then the speed.
        const A = p.accel + (p.accelFlight - p.accel) * f
        let a = Math.hypot(ax[0], ax[1], ax[2])
        const s = a > 1 ? A / a : A
        let nx = vx + ax[0] * s * h
        let ny = vy + ax[1] * s * h
        let nz = flat ? 0 : vz + ax[2] * s * h
        a = Math.hypot(nx, ny, nz)
        if (a > top) {
          // Down to the top speed no faster than the steering allows.
          const t = Math.max(top, a - A * h) / a
          nx *= t
          ny *= t
          nz *= t
        } else if (a < p.minSpeed) {
          const t = a > 1e-9 ? p.minSpeed / a : 0
          nx = a > 1e-9 ? nx * t : p.minSpeed * Wn[k]
          ny = a > 1e-9 ? ny * t : p.minSpeed * Wn[k + 1]
          nz = a > 1e-9 ? nz * t : p.minSpeed * Wn[k + 2]
        }
        V[k] = nx
        V[k + 1] = ny
        V[k + 2] = nz
        // The fear, after this prey's own steer: its sight, then its
        // neighbours', then the fade.
        let g = Math.max(0, f - p.fearDecay * h)
        if (threat > 0) g = Math.max(g, 0.55 + 0.45 * threat)
        const passed = p.fearPass * fn
        if (passed > g) g += (passed - g) * Math.min(1, p.fearSpread * h)
        this.fresh[i] = g
      }
      for (let i = 0; i < this.n; i++) {
        const k = 3 * i
        F[i] = this.fresh[i]
        P[k] += V[k] * h
        P[k + 1] += V[k + 1] * h
        P[k + 2] += V[k + 2] * h
        this.odo[i] += Math.hypot(V[k], V[k + 1], V[k + 2]) * h
      }
      this.chase(h, out)
      this.clock += h
    }

    // The predators' pursuit: each steers to where its target will be
    // when it gets there, or to its goal, at its top speed, and takes the
    // target within its reach.
    chase (h, out) {
      const P = this.pos
      const V = this.vel
      for (const q of this.predators) {
        let gx = null
        let gy = 0
        let gz = 0
        if (q.target >= this.n) q.target = -1
        if (q.target >= 0) {
          const k = 3 * q.target
          const d = Math.hypot(P[k] - q.x, P[k + 1] - q.y, P[k + 2] - q.z)
          const t = Math.min(1.5, d / Math.max(1, q.speed))
          gx = P[k] + V[k] * t
          gy = P[k + 1] + V[k + 1] * t
          gz = P[k + 2] + V[k + 2] * t
        } else if (q.goal) {
          gx = q.goal.x
          gy = q.goal.y
          gz = q.goal.z || 0
        }
        let dvx = -q.vx
        let dvy = -q.vy
        let dvz = -q.vz
        if (gx !== null) {
          const dx = gx - q.x
          const dy = gy - q.y
          const dz = this.dim === 2 ? 0 : gz - q.z
          const d = Math.hypot(dx, dy, dz)
          // At a goal it slows to a stop.
          const v = q.target >= 0 ? q.speed : Math.min(q.speed, d * 0.8)
          if (d > 1e-6) {
            dvx = dx / d * v - q.vx
            dvy = dy / d * v - q.vy
            dvz = dz / d * v - q.vz
          }
        }
        const dl = Math.hypot(dvx, dvy, dvz)
        const s = dl > q.accel * h ? q.accel * h / dl : 1
        q.vx += dvx * s
        q.vy += dvy * s
        q.vz = this.dim === 2 ? 0 : q.vz + dvz * s
        q.x += q.vx * h
        q.y += q.vy * h
        q.z += q.vz * h
        if (q.target >= 0) {
          const i = q.target
          const k = 3 * i
          if (Math.hypot(P[k] - q.x, P[k + 1] - q.y, P[k + 2] - q.z) < q.reach) {
            out.push({ q, id: this.id[i], x: P[k], y: P[k + 1], z: P[k + 2] })
            this.remove(i)
          }
        }
      }
    }
  }

  const api = { Flock, DEFAULTS, H, rng }
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.VizFlock = api
})(this)
