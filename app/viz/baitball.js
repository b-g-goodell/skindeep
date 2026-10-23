'use strict'
// Bait ball mode (decision 0015, issue #188): a school of sardines in
// open water, seen by a scuba diver who floats below it and looks out
// and a little up. Dolphins herd it from below, a shark cuts through it,
// sailfish slash at its edge and gannets dive in from the surface. The
// school turns as one silver shape, flashing where its fish catch the
// light, packs into a tight ball under attack, splits and reforms, and
// opens a hole about a predator passing through.
//
// The fish move by the flocking core (flock.js) in three dimensions,
// each following its nearest seven by rank. Some 700 are simulated and
// each is drawn as four sardines, so the school is some 2800 fish. The
// sea's surface is the mode's: a steer down near it and a hold at it.
// The packing is the mode's too, a steer of each fish to the school's
// centre while predators are near, as each fish seeks the middle of a
// selfish herd (Hamilton, J. Theor. Biol. 31, 1971). The water: blue
// fading with distance, brighter toward the surface, light shafts and
// caustics from the surface's waves, snow drifting near the lens and
// the diver's bubbles. The signal, the clock and the pointer: see
// react, draw and pointer.

;(function (root) {
  const F = typeof module === 'object' && module.exports ? require('./flock') : root.VizFlock
  const TAU = Math.PI * 2
  const CLASS_HUE = [200, 120, 40, 0, 280, 320]
  // The school: its size at rest and its most, and the sardines drawn
  // for each fish simulated.
  const SCHOOL = 700
  const CAP = 780
  const DRAWN = 4
  // The world: x east, y north, z up, the surface at z = 0. The diver's
  // eye is 14 m down. The school keeps about a home 15 m north of the
  // eye and 7 m down, and never rises past SURF.
  const EYE = -14
  const HOME = { x: 0, y: 15, z: -7 }
  const SURF = -0.4
  // The distance over which the water takes all but 1/e of the light.
  const VIS = 24
  // A sardine's length and depth, metres.
  const LEN = 0.2
  const DEPTH = 0.045
  // The school's rule (flock.js), metres and seconds. A simulated fish
  // stands for five, so it keeps 0.9 m. Sardines cruise at about a metre
  // a second and burst at four or five. A predator seen at 8 m and fear
  // passed on at 0.3 open a hole about it without alarming the whole
  // school, which the waves of turning reach instead.
  const RULE = {
    neighbours: { by: 'rank', k: 7, r: 4 },
    sep: 0.9,
    bunch: 0.4,
    cruise: 1.2,
    flight: 4,
    minSpeed: 0.4,
    accel: 4,
    accelFlight: 30,
    alignW: 0.7,
    cohW: 0.4,
    alignFear: 2,
    cohFear: 1.5,
    sight: 8,
    flee: 1.4,
    fountain: 0.8,
    fearDecay: 1,
    fearSpread: 4,
    fearPass: 0.3,
    follow: 0,
    wander: 0.2,
    driftW: 0.3,
    gather: 0.5,
    gatherR: 6,
    level: 0.5,
    bounds: { x: HOME.x, y: HOME.y, z: HOME.z, r: 10, w: 0.6 },
    substep: 1 / 20,
    relist: 3
  }
  // The predators: length, metres, speed at rest, in the dash and within
  // near metres of its fish, the steering limit at rest and in the dash,
  // the reach of its jaws (a sailfish's bill), the share of the school's
  // sight at which it is seen in the dash, how far outside the ball it
  // circles and how far below it, its turn about the ball, rad/s, its
  // picks in turn, the passes it makes, the seconds a dash lasts, the
  // seconds it circles before one, and its colours, back and belly.
  const KIND = {
    dolphin: { len: 2.3, cruise: 3.5, speed: 9, chase: 7, near: 6, accel: 8, accelDash: 22, reach: 0.6, seen: 1.3, gap: 4, below: 3.5, turn: 0.35, pick: ['middle', 'edge'], passes: 4, dashT: 4, wait: [2.5, 4], top: [48, 56, 66], belly: [168, 176, 184] },
    shark: { len: 2.8, cruise: 2.5, speed: 8, chase: 6, near: 6, accel: 5, accelDash: 15, reach: 0.7, seen: 1.2, gap: 7, below: 1, turn: 0.2, pick: ['middle'], passes: 3, dashT: 5, wait: [3, 5], top: [74, 84, 92], belly: [198, 202, 204] },
    sailfish: { len: 3, cruise: 3, speed: 12, chase: 8, near: 5, accel: 10, accelDash: 28, reach: 1, seen: 1.2, gap: 4.5, below: 0, turn: 0.3, pick: ['edge'], passes: 4, dashT: 3.5, wait: [1.5, 3], top: [22, 40, 86], belly: [192, 202, 212] },
    gannet: { len: 0.9, cruise: 2, speed: 13, chase: 13, near: 0, accel: 30, accelDash: 30, reach: 0.45, seen: 1, gap: 0, below: 0, turn: 0, pick: ['edge'], passes: 1, dashT: 2.2, wait: [0, 0], top: [232, 232, 224], belly: [244, 244, 238] }
  }
  const ATTACKS = ['pod', 'shark', 'sailfish', 'gannets']
  // A wave of turning: its front's speed, m/s. The speed at which a
  // packed ball mills, m/s.
  const WAVE = 9
  const MILL = 1.8
  // The light from the sun, toward it, through the surface.
  const SUN = (() => { const l = Math.hypot(0.12, 0.2, 1); return [0.12 / l, 0.2 / l, 1 / l] })()

  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  const rgb = c => `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

  // The water's colour seen along a ray whose elevation has sine s, at
  // full light: navy below, blue level, brighter toward the surface.
  // Snell's window, the sky through the surface within 48.6 degrees of
  // the zenith, is drawn over it (see background).
  const WATER = [[-1, [2, 10, 26]], [-0.3, [5, 28, 60]], [0, [14, 70, 116]], [0.35, [36, 126, 172]], [0.66, [70, 164, 206]], [1, [110, 192, 228]]]
  const WINDOW = Math.asin(1 / 1.333)
  function water (s, light) {
    let k = 0
    while (k < WATER.length - 2 && WATER[k + 1][0] <= s) k++
    const [s0, c0] = WATER[k]
    const [s1, c1] = WATER[k + 1]
    const c = mix(c0, c1, clamp((s - s0) / (s1 - s0), 0, 1))
    return [c[0] * light, c[1] * light, c[2] * light]
  }

  // A small hash of an integer to [0, 1).
  const hash = id => (Math.imul(id ^ 0x5bd1e995, 0x27d4eb2d) >>> 0) / 4294967296

  // Each drawn sardine's place about its fish, in the fish's frame: along
  // its heading, to its side and up, a share of sep.
  const OFFS = new Float32Array(1021 * 3)
  for (let k = 0; k < 1021; k++) {
    OFFS[3 * k] = (hash(3 * k + 1) - 0.5) * 1.1
    OFFS[3 * k + 1] = (hash(3 * k + 2) - 0.5) * 1.1
    OFFS[3 * k + 2] = (hash(3 * k + 3) - 0.5) * 0.7
  }

  // The simulation of the water: the school, its waves of turning, the
  // attacks and the clock, with no canvas, so the tests run it too.
  function world (rnd) {
    const flock = new F.Flock({ dim: 3, cap: CAP, params: Object.assign({}, RULE, { drift: [0, 0, 0], bounds: Object.assign({}, RULE.bounds) }), rnd })
    // Each fish's velocity a substep ago and its back, the way its body's
    // up faces, smoothed: up at rest, rolled into a turn.
    const prev = new Float32Array(3 * CAP)
    const back = new Float32Array(3 * CAP)
    const remove = flock.remove.bind(flock)
    flock.remove = i => {
      const j = flock.n - 1
      for (let c = 0; c < 3; c++) {
        prev[3 * i + c] = prev[3 * j + c]
        back[3 * i + c] = back[3 * j + c]
      }
      remove(i)
    }
    let clock = 0
    const attacks = []
    const waves = []
    const marks = []
    // Kills, for a puff of scales, and the gannets' bubbles.
    const kills = []
    const trail = []
    let started = 0
    let eaten = 0
    let turned = 0
    let next = 15
    let refill = 0
    let pack = 0
    let packUntil = -1
    let course = rnd() * TAU
    let mill = 1

    for (let i = 0; i < SCHOOL; i++) {
      const a = rnd() * TAU
      const b = Math.asin(2 * rnd() - 1)
      const r = 5 * Math.cbrt(rnd())
      flock.add(HOME.x + r * Math.cos(a) * Math.cos(b), HOME.y + r * Math.sin(a) * Math.cos(b), HOME.z + 0.6 * r * Math.sin(b), Math.cos(course), Math.sin(course), 0)
      back[3 * i + 2] = 1
    }
    flock.step(6)
    for (let i = 0; i < 3 * flock.n; i++) prev[i] = flock.vel[i]

    const centre = () => flock.centre()
    const any = () => flock.n ? Math.floor(rnd() * flock.n) : -1
    const at = i => [flock.pos[3 * i], flock.pos[3 * i + 1], flock.pos[3 * i + 2]]
    function extent (o) {
      let m = 0
      const P = flock.pos
      for (let i = 0; i < flock.n; i++) m = Math.max(m, Math.hypot(P[3 * i] - o[0], P[3 * i + 1] - o[1], P[3 * i + 2] - o[2]))
      return m
    }
    function heading () {
      let x = 0
      let y = 0
      let z = 0
      const V = flock.vel
      for (let i = 0; i < flock.n; i++) {
        const s = Math.hypot(V[3 * i], V[3 * i + 1], V[3 * i + 2]) || 1
        x += V[3 * i] / s
        y += V[3 * i + 1] / s
        z += V[3 * i + 2] / s
      }
      const l = Math.hypot(x, y, z) || 1
      return [x / l, y / l, z / l]
    }

    // A wave of turning from o: fish the front passes turn about axis,
    // by sign, each for band seconds, out to reach metres. hue: the tool
    // class's colour of its first fish's mark, or null.
    function wave (o, axis, sign, band, w, reach, origin, hue) {
      if (waves.length >= 3) waves.shift()
      const l = Math.hypot(axis[0], axis[1], axis[2]) || 1
      const from = new Map()
      const P = flock.pos
      for (let i = 0; i < flock.n; i++) {
        const d = Math.hypot(P[3 * i] - o[0], P[3 * i + 1] - o[1], P[3 * i + 2] - o[2])
        if (d <= reach) from.set(flock.id[i], d)
      }
      waves.push({ axis: axis.map(v => v / l), sign, band, w, reach, t0: clock, from })
      if (hue !== null && origin >= 0) {
        marks.push({ id: flock.id[origin], t: clock, hue })
        if (marks.length > 12) marks.shift()
      }
    }
    const tilt = s => [(rnd() - 0.5) * s, (rnd() - 0.5) * s, 1]
    // The whole school turns from fish i, a flash running across it.
    function turn (i, hue, wide) {
      if (i < 0) return
      const o = at(i)
      turned++
      wave(o, tilt(0.6), rnd() < 0.5 ? -1 : 1, wide ? 1.2 : 0.6, 1.5, extent(o), i, hue)
    }

    // A place out in the blue, dist metres from c across the water,
    // never between the diver and the school, dz metres above c.
    function blue (c, dist, dz) {
      const a = (0.08 + 0.84 * rnd()) * Math.PI
      return [c.x + dist * Math.cos(a), c.y + dist * Math.sin(a), Math.min(-1, c.z + dz)]
    }

    function hunter (k, p, a, o) {
      const K = KIND[k]
      const q = flock.hunter(Object.assign({ x: p[0], y: p[1], z: p[2], speed: K.cruise, accel: K.accel, reach: K.reach, seen: 1, kind: k, attack: a, phase: 'circle', t0: clock, passes: 0, best: Infinity, wait: K.wait[0] + K.wait[1] * rnd(), ring: Math.atan2(p[1] - HOME.y, p[0] - HOME.x), dir: rnd() < 0.5 ? -1 : 1, beat: rnd() * TAU, sail: 0, ux: 0, uy: 1, uz: 0, picks: 0 }, o))
      a.members.push(q)
      return q
    }

    function phase (q, p) {
      const K = KIND[q.kind]
      q.phase = p
      q.t0 = clock
      if (p === 'dash') {
        q.speed = K.speed
        q.accel = K.accelDash
        q.seen = K.seen
        q.goal = null
        q.best = Infinity
        flock.pick(q, K.pick[q.picks++ % K.pick.length])
      } else if (p === 'circle') {
        q.target = -1
        q.speed = K.cruise
        q.accel = K.accel
        q.seen = 0.5
        q.wait = K.wait[0] + K.wait[1] * rnd()
      } else if (p === 'rise') {
        q.target = -1
        q.speed = 1.8
        q.accel = 6
        q.goal = { x: q.x, y: q.y, z: 0.5 }
      } else if (p === 'leave') {
        q.target = -1
        q.speed = 1.5 * K.cruise
        q.accel = K.accel
        q.seen = 1
        const a = Math.atan2(q.y - HOME.y, q.x - HOME.x)
        q.goal = { x: HOME.x + Math.cos(a) * 90, y: HOME.y + Math.abs(Math.sin(a)) * 90, z: -20 }
      }
    }

    const hunting = q => q.phase === 'circle' || q.phase === 'dash' || q.phase === 'plunge'

    // An attack of kind k: a pod of dolphins from below, a shark, a few
    // sailfish, or a volley of gannets from the surface. at: a fish a
    // shark cuts through the school at, at once.
    function attack (k, at) {
      if (!flock.n || flock.predators.length > 10) return null
      const on = attacks.filter(a => a.members.some(hunting) || a.queue.length)
      if (on.length >= 2) {
        on[0].queue.length = 0
        for (const q of on[0].members) if (hunting(q) && q.kind !== 'gannet') phase(q, 'leave')
      }
      const c = centre()
      const a = { kind: k, members: [], queue: [], t0: clock, calm: 0 }
      attacks.push(a)
      started++
      mill = rnd() < 0.5 ? -1 : 1
      if (at !== undefined) {
        const P = flock.pos
        const q = hunter('shark', blue({ x: P[3 * at], y: P[3 * at + 1], z: P[3 * at + 2] }, 18, -1), a)
        phase(q, 'dash')
        q.target = at
      } else if (k === 'pod') {
        const n = 3 + Math.floor(rnd() * 3)
        const p = blue(c, 30, -12)
        for (let j = 0; j < n; j++) hunter('dolphin', [p[0] + 3 * (rnd() - 0.5), p[1] + 3 * (rnd() - 0.5), p[2] - 2 * rnd()], a, { wait: 3 + 1.2 * j + 2 * rnd() })
      } else if (k === 'shark') hunter('shark', blue(c, 32, -4), a)
      else if (k === 'sailfish') {
        const n = 2 + Math.floor(rnd() * 2)
        const p = blue(c, 30, 0)
        for (let j = 0; j < n; j++) hunter('sailfish', [p[0] + 4 * (rnd() - 0.5), p[1] + 4 * (rnd() - 0.5), p[2] + 2 * (rnd() - 0.5)], a, { wait: 2 + 1.5 * j })
      } else volley(a, 4 + Math.floor(rnd() * 4))
      next = clock + 40 + 30 * rnd()
      return a
    }

    // Gannets into attack a: each enters the water over the school, one
    // after another.
    function volley (a, n) {
      let t = clock + 0.3
      for (let j = 0; j < n; j++) {
        a.queue.push(t)
        t += 0.4 + 0.8 * rnd()
      }
    }

    function plunge (a) {
      const c = centre()
      const x = c.x + 8 * (rnd() - 0.5)
      const y = c.y + 8 * (rnd() - 0.5)
      const a1 = rnd() * TAU
      const q = hunter('gannet', [x, y, -0.2], a, { vx: 2 * Math.cos(a1), vy: 2 * Math.sin(a1), vz: -13, speed: 13, accel: 30, phase: 'plunge' })
      q.range = 6
      flock.pick(q, 'edge')
      for (let k = 0; k < 16; k++) trail.push({ x: x + 0.5 * (rnd() - 0.5), y: y + 0.5 * (rnd() - 0.5), z: -0.2 - 1.2 * rnd(), t: clock, r: 0.004 + 0.01 * rnd() })
    }

    // One more predator for the newest attack still on, of its kind, or
    // a lone shark's attack when none is.
    function join () {
      const a = [...attacks].reverse().find(a => a.members.some(hunting) || a.queue.length)
      if (!a) return attack('shark')
      const c = centre()
      if (a.kind === 'gannets') volley(a, 3)
      else {
        const k = a.kind === 'pod' ? 'dolphin' : a.kind
        hunter(k, blue(c, 30, k === 'dolphin' ? -12 : -2), a)
      }
      return a
    }

    // Every predator circling the school dashes now.
    function strike () {
      for (const a of attacks) for (const q of a.members) if (q.phase === 'circle') phase(q, 'dash')
    }

    // The session's events (decision 0015's table).
    function react (e) {
      if (!flock.n) return
      if (e.kind === 3) attack(ATTACKS[started % 4])
      else if (e.kind === 2) {
        // A fish startles, and a flash runs across the school.
        const i = any()
        flock.fear[i] = 1
        turn(i, CLASS_HUE[e.cls] ?? 200, false)
      } else if (e.kind === 4) strike()
      else if (e.kind === 5) join()
      else if (e.kind === 6) {
        // The school balls up, and turns about from its leading edge.
        packUntil = clock + 12
        const h = heading()
        let best = -1
        let s = -Infinity
        for (let i = 0; i < flock.n; i++) {
          const v = flock.pos[3 * i] * h[0] + flock.pos[3 * i + 1] * h[1] + flock.pos[3 * i + 2] * h[2]
          if (v > s) [best, s] = [i, v]
        }
        turn(best, null, true)
      } else {
        // A glint: a short turn among a fish's neighbours.
        const i = any()
        wave(at(i), tilt(1.2), rnd() < 0.5 ? -1 : 1, 0.4, 1.2, 3, i, null)
      }
    }

    // The attacks' plans, each substep.
    function plan (h, L) {
      const c = centre()
      const R = Math.max(3, 1.3 * c.r)
      const P = flock.pos
      for (const q of [...flock.predators]) {
        const K = KIND[q.kind]
        const age = clock - q.t0
        if (q.phase === 'circle') {
          // About the school, outside it, and below it for dolphins,
          // which drive it up against the surface.
          q.ring += h * K.turn * q.dir
          const r = R + K.gap
          q.goal = { x: c.x + r * Math.cos(q.ring), y: c.y + r * Math.sin(q.ring), z: Math.min(-1.5, c.z - K.below) }
          // They take turns, a second or more apart, so the school packs
          // again between dashes.
          const busy = clock < q.attack.calm || q.attack.members.some(o => o !== q && o.phase === 'dash')
          if (age > q.wait && !busy) phase(q, 'dash')
        } else if (q.phase === 'dash') {
          if (q.target < 0) flock.pick(q, K.pick[q.picks++ % K.pick.length])
          const i = q.target
          const d = i >= 0 ? Math.hypot(P[3 * i] - q.x, P[3 * i + 1] - q.y, P[3 * i + 2] - q.z) : Infinity
          // Among the fish it slows, so the hole opens about it.
          q.speed = d < K.near ? K.chase : K.speed
          q.best = Math.min(q.best, d)
          if (d > q.best + 3 || age > K.dashT) done(q)
        } else if (q.phase === 'plunge') {
          // A gannet's plunge slows in the water.
          q.speed = Math.max(1.5, q.speed - 5 * h)
          if (age > K.dashT || q.speed <= 2) phase(q, 'rise')
        } else if (q.phase === 'rise') {
          if (q.z > -0.35) drop(q)
        } else if (q.phase === 'leave') {
          if (Math.hypot(q.x, q.y) > 80) drop(q)
        }
        if (L.idle > 0.6 && (q.phase === 'circle' || q.phase === 'dash')) phase(q, 'leave')
        // The sail goes up in the dash.
        q.sail += ((q.phase === 'dash' ? 1 : 0.15) - q.sail) * Math.min(1, h / 0.4)
      }
      for (const a of attacks) {
        while (a.queue.length && a.queue[0] <= clock) {
          a.queue.shift()
          if (L.idle <= 0.6) plunge(a)
        }
      }
      for (let k = attacks.length - 1; k >= 0; k--) if (!attacks[k].members.length && !attacks[k].queue.length) attacks.splice(k, 1)
    }

    // A pass ended: round again, or away when it has made its passes.
    function done (q) {
      if (q.kind === 'gannet') return phase(q, 'rise')
      q.attack.calm = clock + 1.5 + 1.5 * rnd()
      q.passes++
      phase(q, q.passes >= KIND[q.kind].passes ? 'leave' : 'circle')
    }

    function drop (q) {
      flock.predators.splice(flock.predators.indexOf(q), 1)
      const m = q.attack.members
      m.splice(m.indexOf(q), 1)
    }

    // The waves' turns, the surface and the packing, as each fish's push
    // in the core.
    function steer (c) {
      const P = flock.pos
      const V = flock.vel
      const U = flock.push
      U.fill(0, 0, 3 * flock.n)
      for (let i = 0; i < flock.n; i++) {
        const j = 3 * i
        // Within 2 m of the surface, down.
        const z = P[j + 2]
        if (z > SURF - 2) U[j + 2] -= 1.5 * Math.min(1, (z - SURF + 2) / 2)
        // Under attack, to the middle of the school, and round it: the
        // ball mills about its vertical axis.
        if (pack > 0.01) {
          const dx = c.x - P[j]
          const dy = c.y - P[j + 1]
          const dz = c.z - P[j + 2]
          const d = Math.hypot(dx, dy, dz)
          if (d > 1.5) {
            const w = 2 * pack * Math.min(1, (d - 1.5) / 3) / d
            U[j] += dx * w
            U[j + 1] += dy * w
            U[j + 2] += dz * w
          }
          const hd = Math.hypot(dx, dy)
          if (hd > 0.3) {
            const mx = mill * dy / hd * MILL - V[j]
            const my = -mill * dx / hd * MILL - V[j + 1]
            const mz = -V[j + 2]
            const m = 1.2 * pack / Math.max(MILL, Math.hypot(mx, my, mz))
            U[j] += mx * m
            U[j + 1] += my * m
            U[j + 2] += mz * m
          }
        }
      }
      for (let k = waves.length - 1; k >= 0; k--) {
        const w = waves[k]
        const R = WAVE * (clock - w.t0)
        if (R - WAVE * w.band > w.reach) {
          waves.splice(k, 1)
          continue
        }
        const [ax, ay, az] = w.axis
        for (let i = 0; i < flock.n; i++) {
          const j = 3 * i
          const d = w.from.get(flock.id[i])
          if (d === undefined || d > R || d < R - WAVE * w.band) continue
          const s = Math.hypot(V[j], V[j + 1], V[j + 2]) || 1
          const ux = V[j] / s
          const uy = V[j + 1] / s
          const uz = V[j + 2] / s
          const tx = ay * uz - az * uy
          const ty = az * ux - ax * uz
          const tz = ax * uy - ay * ux
          const tl = Math.hypot(tx, ty, tz)
          if (tl < 0.1) continue
          const m = w.sign * w.w / tl
          U[j] += tx * m
          U[j + 1] += ty * m
          U[j + 2] += tz * m
        }
      }
    }

    // The world's clock advanced by h.
    function advance (h, L) {
      plan(h, L)
      const c = centre()
      // The packing: up while predators hunt near the school, or for a
      // while after a compaction.
      let near = 0
      for (const q of flock.predators) if (hunting(q) && Math.hypot(q.x - c.x, q.y - c.y, q.z - c.z) < 18) near++
      const want = clock < packUntil ? 1 : Math.min(1, 0.45 * near)
      pack += (want - pack) * Math.min(1, h / 1.5)
      // Packed, the fish swim faster and turn harder, so a ball split by
      // a dash closes again in a second or two.
      flock.p.cruise = RULE.cruise + 1.2 * pack
      flock.p.accel = RULE.accel + 10 * pack
      // At rest the school cruises on a slowly wandering course, back
      // toward home when it strays, a little deeper as the session
      // idles.
      course += (rnd() - 0.5) * 0.8 * Math.sqrt(h)
      const ox = HOME.x - c.x
      const oy = HOME.y - c.y
      if (Math.hypot(ox, oy) > 4) {
        let e = Math.atan2(oy, ox) - course
        e = Math.atan2(Math.sin(e), Math.cos(e))
        course += e * Math.min(1, h * 0.5)
      }
      flock.p.bounds.z = HOME.z - 3 * L.idle
      const dr = flock.p.drift
      dr[0] = 0.9 * Math.cos(course)
      dr[1] = 0.9 * Math.sin(course)
      dr[2] = clamp((flock.p.bounds.z - c.z) * 0.15, -0.3, 0.3)
      steer(c)
      for (const k of flock.step(h)) {
        eaten++
        kills.push({ x: k.x, y: k.y, z: k.z, t: clock })
        if (kills.length > 24) kills.shift()
        done(k.q)
      }
      // The surface: no fish passes it, nor any predator but a gannet.
      const P = flock.pos
      const V = flock.vel
      for (let i = 0; i < flock.n; i++) {
        if (P[3 * i + 2] > SURF) {
          P[3 * i + 2] = SURF
          if (V[3 * i + 2] > 0) V[3 * i + 2] = 0
        }
      }
      for (const q of flock.predators) {
        if (q.kind !== 'gannet' && q.z > -0.8) {
          q.z = -0.8
          if (q.vz > 0) q.vz = 0
        }
        // The heading the body shows, smoothed.
        const s = Math.hypot(q.vx, q.vy, q.vz)
        if (s > 0.2) {
          const e = Math.min(1, h / 0.25)
          q.ux += (q.vx / s - q.ux) * e
          q.uy += (q.vy / s - q.uy) * e
          q.uz += (q.vz / s - q.uz) * e
          const l = Math.hypot(q.ux, q.uy, q.uz) || 1
          q.ux /= l
          q.uy /= l
          q.uz /= l
        }
        q.beat += h * (2 + 0.9 * s)
        if (q.phase === 'plunge' && clock - q.t0 < 1.4) trail.push({ x: q.x + 0.3 * (rnd() - 0.5), y: q.y + 0.3 * (rnd() - 0.5), z: q.z, t: clock, r: 0.003 + 0.006 * rnd() })
      }
      while (trail.length && clock - trail[0].t > 3) trail.shift()
      if (trail.length > 600) trail.splice(0, trail.length - 600)
      // Each fish's back: up, rolled by its acceleration across its
      // heading, smoothed over 0.15 s.
      const e = Math.min(1, h / 0.15)
      for (let i = 0; i < flock.n; i++) {
        const j = 3 * i
        const s = Math.hypot(V[j], V[j + 1], V[j + 2]) || 1
        const ux = V[j] / s
        const uy = V[j + 1] / s
        const uz = V[j + 2] / s
        let ax = (V[j] - prev[j]) / h
        let ay = (V[j + 1] - prev[j + 1]) / h
        let az = (V[j + 2] - prev[j + 2]) / h + 3
        const al = ax * ux + ay * uy + az * uz
        ax -= al * ux
        ay -= al * uy
        az -= al * uz
        const l = Math.hypot(ax, ay, az) || 1
        back[j] += (ax / l - back[j]) * e
        back[j + 1] += (ay / l - back[j + 1]) * e
        back[j + 2] += (az / l - back[j + 2]) * e
        prev[j] = V[j]
        prev[j + 1] = V[j + 1]
        prev[j + 2] = V[j + 2]
      }
      // A thinned school is made up by small schools swimming in from
      // the blue while no predator dashes.
      if (flock.n < SCHOOL && clock > refill && !flock.predators.some(q => q.phase === 'dash' || q.phase === 'plunge')) {
        const p = blue(c, 28, 0)
        const vx = (c.x - p[0]) / 28 * 1.5
        const vy = (c.y - p[1]) / 28 * 1.5
        const k = 8 + Math.floor(rnd() * 5)
        for (let j = 0; j < k && flock.n < SCHOOL; j++) {
          const i = flock.add(p[0] + 1.5 * (rnd() - 0.5), p[1] + 1.5 * (rnd() - 0.5), p[2] + rnd() - 0.5, vx, vy, 0)
          if (i < 0) break
          prev[3 * i] = flock.vel[3 * i]
          prev[3 * i + 1] = flock.vel[3 * i + 1]
          prev[3 * i + 2] = 0
          back[3 * i] = 0
          back[3 * i + 1] = 0
          back[3 * i + 2] = 1
        }
        refill = clock + 2 + 2 * rnd()
      }
      // An attack now and then of its own, while the session works.
      if (clock > next && L.idle < 0.3) attack(ATTACKS[started % 4])
      clock += h
    }

    return {
      flock,
      back,
      marks,
      kills,
      trail,
      react,
      advance,
      attack,
      centre,
      get clock () { return clock },
      get pack () { return pack },
      // The school simulated, the predators, the attacks begun, the
      // fish eaten and the waves of turning.
      count () {
        return { fish: flock.n, predators: flock.predators.length, attacks: started, eaten, waves: turned, pack: Math.round(pack * 100) / 100, clock }
      }
    }
  }

  // The caustics: a height field of waves on the surface, periodic on a
  // tile, whose curvature focuses the light below it. The brightness at
  // each point of the tile is the inverse of the area a small patch of
  // the surface's light covers there, 1 / |det(I + D Hess h)|, bright
  // along the folds.
  const TEX = 64
  const CWAVES = [[1, 2, 0.9, 0.3], [2, -1, 0.8, 1.7], [-3, 1, 1.1, 4.1], [1, 3, 1.3, 2.2], [3, 2, 0.7, 5.3], [-2, -3, 1.0, 0.9]]
  function caustics (t, out) {
    const k2 = TAU * TAU
    for (let y = 0; y < TEX; y++) {
      for (let x = 0; x < TEX; x++) {
        let hxx = 0
        let hyy = 0
        let hxy = 0
        for (const [kx, ky, w, ph] of CWAVES) {
          const s = Math.sin(TAU * (kx * x + ky * y) / TEX + w * t + ph) * 0.016 * k2 / (kx * kx + ky * ky)
          hxx -= s * kx * kx
          hyy -= s * ky * ky
          hxy -= s * kx * ky
        }
        const det = Math.abs((1 + hxx) * (1 + hyy) - hxy * hxy)
        out[y * TEX + x] = Math.min(1, 0.22 / Math.max(0.06, det))
      }
    }
  }

  function create (canvas) {
    const out = canvas.getContext('2d')
    const layer = document.createElement('canvas')
    const main = layer.getContext('2d', { willReadFrequently: true })
    let g = main
    // The far half of the water, drawn at half the pane's size and
    // scaled up, so far fish are softer than near ones.
    const far = document.createElement('canvas')
    const gf = far.getContext('2d')
    // The water behind it all, smooth, drawn at half size too.
    const bk = document.createElement('canvas')
    const gb = bk.getContext('2d')
    const tex = document.createElement('canvas')
    tex.width = tex.height = TEX
    const gt = tex.getContext('2d')
    const img = gt.createImageData(TEX, TEX)
    const field = new Float32Array(TEX * TEX)
    const seed = (Math.random() * 4294967296) >>> 0
    const rnd = F.rng(seed)
    const W = world(rnd)
    const flock = W.flock
    const back = W.back
    let cw = 0
    let ch = 0
    let fo = 1
    // The gaze: its yaw and pitch, which ease toward the school, and the
    // drag's turn of it, which eases back.
    let yaw = null
    let pitch = 0
    let dyaw = 0
    let dpitch = 0
    let released = -Infinity
    let press = null
    let ez = EYE
    let time = 0
    let breath = 0
    let chop = 0
    const mark = {}
    // The camera's frame: forward, right, up.
    const fw = [0, 1, 0]
    const rt = [1, 0, 0]
    const up = [0, 0, 1]
    let PX = 0
    let PY = 0
    let PD = 0
    function project (x, y, z) {
      const dx = x
      const dy = y
      const dz = z - ez
      PD = dx * fw[0] + dy * fw[1] + dz * fw[2]
      if (PD < 0.05) return false
      PX = cw / 2 + fo * (dx * rt[0] + dy * rt[1]) / PD
      PY = ch / 2 - fo * (dx * up[0] + dy * up[1] + dz * up[2]) / PD
      return true
    }
    function frame () {
      const a = yaw + dyaw
      const p = pitch + dpitch
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      const cp = Math.cos(p)
      const sp = Math.sin(p)
      fw[0] = sa * cp
      fw[1] = ca * cp
      fw[2] = sp
      rt[0] = ca
      rt[1] = -sa
      rt[2] = 0
      up[0] = -sa * sp
      up[1] = -ca * sp
      up[2] = cp
    }
    // The ray through a screen point, a unit vector.
    function ray (sx, sy) {
      const a = (sx - cw / 2) / fo
      const b = (ch / 2 - sy) / fo
      const x = fw[0] + a * rt[0] + b * up[0]
      const y = fw[1] + a * rt[1] + b * up[1]
      const z = fw[2] + b * up[2]
      const l = Math.hypot(x, y, z)
      return [x / l, y / l, z / l]
    }

    // Snow drifting near the lens, in the camera's frame: right, up,
    // forward.
    const SNOW = 110
    const snow = new Float32Array(3 * SNOW)
    for (let k = 0; k < SNOW; k++) {
      const d = 0.4 + 6.6 * rnd() * rnd()
      snow[3 * k] = (rnd() - 0.5) * 2 * d
      snow[3 * k + 1] = (rnd() - 0.5) * 1.4 * d
      snow[3 * k + 2] = d
    }
    // The diver's bubbles, in the world.
    const bubbles = []
    // The light shafts: where each meets the surface, its width, its
    // phase.
    const shafts = []
    for (let k = 0; k < 10; k++) shafts.push({ x: (rnd() - 0.5) * 60, y: 6 + 50 * rnd(), w: 0.4 + 1.6 * rnd(), ph: rnd() * TAU, f: 0.5 + rnd() })

    function draw (synth, dt) {
      const w = canvas.width
      const h = canvas.height
      if (w < 4 || h < 4) return
      if (w !== cw || h !== ch) {
        cw = w
        ch = h
        fo = 0.6 * Math.max(w, h)
        layer.width = w
        layer.height = h
        far.width = Math.max(2, Math.ceil(w / 2))
        far.height = Math.max(2, Math.ceil(h / 2))
        bk.width = far.width
        bk.height = far.height
      }
      for (const e of synth.since(mark)) W.react(e)
      const L = synth.level
      // The clock: a little faster while busy, slowed nearly to a stop
      // as the session idles.
      const speed = (0.8 + 0.2 * Math.min(1, L.bass) + 0.2 * L.busy) * (1 - 0.8 * L.idle)
      let left = Math.min(0.25, speed * dt)
      while (left > 1e-9) {
        const hh = Math.min(RULE.substep, left)
        W.advance(hh, L)
        left -= hh
      }
      time += dt
      chop += dt * (0.5 + 1.5 * Math.min(1, L.treble))
      // The light: full while the session works, dimming toward dusk as
      // it idles.
      const light = 1 - 0.62 * L.idle

      // The diver breathes: rises a little on the breath in, and lets out
      // bubbles on the breath out, slower at idle.
      const cycle = 5 + 2 * L.idle
      const was = breath
      breath = (breath + dt / cycle) % 1
      ez = EYE + 0.07 * Math.sin(TAU * breath)
      if (breath > 0.4 && breath < 0.75) {
        const n = Math.floor(breath * 60) - Math.floor((was > breath ? 0 : was) * 60)
        for (let k = 0; k < n; k++) bubble()
      }

      // The gaze eases toward the school, out and a little up, and the
      // drag's turn eases back once the pointer lets go.
      const c = W.centre()
      const ty = Math.atan2(c.x, c.y)
      const tp = clamp(Math.atan2(c.z - EYE, Math.hypot(c.x, c.y)), 0.1, 0.42)
      if (yaw === null) {
        yaw = ty
        pitch = tp
      }
      const oa = yaw + dyaw
      const op = pitch + dpitch
      const ea = Math.min(1, dt / 2)
      yaw += Math.atan2(Math.sin(ty - yaw), Math.cos(ty - yaw)) * ea
      pitch += (tp - pitch) * ea
      if (!press && time - released > 1.5) {
        const k = Math.exp(-dt / 1.2)
        dyaw *= k
        dpitch *= k
      }
      const turnA = yaw + dyaw
      const turnP = pitch + dpitch
      frame()
      // Snow turns with the gaze the other way.
      spin(turnA - oa, turnP - op, dt)

      g = gb
      g.setTransform(bk.width / cw, 0, 0, bk.height / ch, 0, 0)
      g.globalCompositeOperation = 'source-over'
      g.globalAlpha = 1
      background(light)
      surface(light)
      shaftsDraw(light, turnA)
      g = main
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.globalCompositeOperation = 'source-over'
      g.globalAlpha = 1
      g.imageSmoothingEnabled = true
      g.drawImage(bk, 0, 0, cw, ch)

      // The fish and the predators, far to near, in bands of distance,
      // the far ones on the half-sized layer.
      creatures(light)

      // The marks of tool calls' startles, about their first fish.
      const P = flock.pos
      for (let k = W.marks.length - 1; k >= 0; k--) {
        const m = W.marks[k]
        const age = W.clock - m.t
        if (age > 1.4) {
          W.marks.splice(k, 1)
          continue
        }
        let i = -1
        for (let n = 0; n < flock.n; n++) if (flock.id[n] === m.id) i = n
        if (i < 0 || !project(P[3 * i], P[3 * i + 1], P[3 * i + 2])) continue
        g.strokeStyle = `hsla(${m.hue}, 90%, 62%, ${1 - age / 1.4})`
        g.lineWidth = 1.5
        g.beginPath()
        g.arc(PX, PY, 5 + 14 * age, 0, TAU)
        g.stroke()
      }

      lens(dt, light)
      out.drawImage(layer, 0, 0)
    }

    // The water behind everything: its colour along each row's ray.
    function background (light) {
      const gr = g.createLinearGradient(0, 0, 0, ch)
      const N = 16
      for (let k = 0; k <= N; k++) {
        const r = ray(cw / 2, ch * k / N)
        gr.addColorStop(k / N, rgb(water(r[2], light)))
      }
      g.fillStyle = gr
      g.fillRect(0, 0, cw, ch)
      // Snell's window: a disc about the zenith, its edge where the ray
      // stands WINDOW from it, measured down the pane's middle.
      const p = Math.asin(clamp(fw[2], -1, 1))
      const a = Math.PI / 2 - WINDOW - p
      if (p < 0.05 || a <= -1.2) return
      const yz = ch / 2 - fo / Math.tan(p)
      const ye = ch / 2 - fo * Math.tan(a)
      const R = ye - yz
      if (R <= 0 || ye < -0.1 * R) return
      const c = water(1, light)
      // At dusk the sky through it is a deep blue, not a grey.
      const sky = mix([26, 46, 78], [190, 232, 246], clamp((light - 0.38) / 0.62, 0, 1))
      const wg = g.createRadialGradient(cw / 2, yz, 0, cw / 2, yz, 1.05 * R)
      wg.addColorStop(0, rgb(sky))
      wg.addColorStop(0.93, rgb(mix(sky, c, 0.15)))
      wg.addColorStop(0.97, `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, 0.6)`)
      wg.addColorStop(1, `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, 0)`)
      g.fillStyle = wg
      g.fillRect(0, 0, cw, Math.min(ch, ye + 0.06 * R))
    }

    // The underside of the surface, where the view reaches it: the
    // caustics' tile laid on it in perspective, strip by strip, fading
    // with the distance to it.
    function surface (light) {
      caustics(chop, field)
      const D = img.data
      for (let k = 0; k < TEX * TEX; k++) {
        const v = field[k]
        D[4 * k] = 200 + 55 * v
        D[4 * k + 1] = 235 + 20 * v
        D[4 * k + 2] = 255
        D[4 * k + 3] = 255 * v
      }
      gt.putImageData(img, 0, 0)
      const pat = g.createPattern(tex, 'repeat')
      if (!pat || !pat.setTransform || typeof DOMMatrix === 'undefined') return
      const TS = 8
      const depth = -ez
      g.globalCompositeOperation = 'lighter'
      const strip = Math.max(2, Math.round(ch / 130))
      for (let sy = 0; sy < ch; sy += strip) {
        // The ray through the strip's middle, unnormalized: fw + a rt +
        // b up, a along the row. It meets the surface at lam times it,
        // lam the same along the row, since rt is level.
        const sm = sy + strip / 2
        const at = row => {
          const b = (ch / 2 - row) / fo
          const dz = fw[2] + b * up[2]
          return [fw[0] + b * up[0], fw[1] + b * up[1], dz]
        }
        const r = at(sm)
        if (r[2] <= 0) break
        const lam = depth / r[2]
        const dist = lam * Math.hypot(r[0], r[1], r[2])
        const vis = Math.exp(-dist / VIS)
        if (vis < 0.03) break
        const x0 = lam * r[0]
        const y0 = lam * r[1]
        const r2 = at(sm + 1)
        const lam2 = depth / r2[2]
        // Metres on the surface per pixel along the row and down it.
        const ax = lam * rt[0] / fo
        const ay = lam * rt[1] / fo
        const bx = lam2 * r2[0] - x0
        const by = lam2 * r2[1] - y0
        // Screen to tile: [u, v] = s M [sx - cw / 2, sy - sm] + [u0, v0].
        const s = TEX / TS
        const m11 = ax * s
        const m21 = ay * s
        const m12 = bx * s
        const m22 = by * s
        const det = m11 * m22 - m12 * m21
        if (Math.abs(det) < 1e-12) continue
        const i11 = m22 / det
        const i12 = -m12 / det
        const i21 = -m21 / det
        const i22 = m11 / det
        const u0 = x0 * s + chop * 3
        const v0 = y0 * s + chop * 2
        pat.setTransform(new DOMMatrix([i11, i21, i12, i22, cw / 2 - (i11 * u0 + i12 * v0), sm - (i21 * u0 + i22 * v0)]))
        g.globalAlpha = clamp(0.3 * Math.pow(vis, 1.3) * light, 0, 1)
        g.fillStyle = pat
        g.fillRect(0, sy, cw, strip)
      }
      g.globalAlpha = 1
      g.globalCompositeOperation = 'source-over'
    }

    // The light shafts: each from where the surface focuses the light,
    // down along the sun's refracted ray, fading with depth and
    // distance, flickering as the waves pass.
    function shaftsDraw (light, a) {
      const gx = Math.sin(a) * 26
      const gy = Math.cos(a) * 26
      const D = 42
      g.globalCompositeOperation = 'lighter'
      for (const s of shafts) {
        // Kept within 32 m of the point the gaze looks out at.
        if (s.x - gx > 32) s.x -= 64
        if (s.x - gx < -32) s.x += 64
        if (s.y - gy > 32) s.y -= 64
        if (s.y - gy < -32) s.y += 64
        s.x += 0.002 * Math.sin(chop * 0.3 + s.ph)
        const tx = s.x
        const ty = s.y
        const bx = tx - SUN[0] / SUN[2] * D
        const by = ty - SUN[1] / SUN[2] * D
        if (!project(tx, ty, 0)) continue
        const [x0, y0, d0] = [PX, PY, PD]
        if (d0 < 3 || !project(bx, by, -D)) continue
        const [x1, y1, d1] = [PX, PY, PD]
        if (d1 < 3) continue
        const lx = x1 - x0
        const ly = y1 - y0
        const ll = Math.hypot(lx, ly) || 1
        const nx = -ly / ll
        const ny = lx / ll
        const w0 = s.w * fo / d0
        const w1 = s.w * 1.6 * fo / d1
        const flick = 0.55 + 0.45 * Math.sin(chop * 1.7 * s.f + s.ph) * Math.sin(chop * 0.9 + 2 * s.ph)
        const al = 0.16 * light * flick * Math.exp(-d0 / (2 * VIS))
        if (al < 0.004) continue
        const gr = g.createLinearGradient(x0, y0, x1, y1)
        gr.addColorStop(0, `rgba(170, 225, 255, ${al})`)
        gr.addColorStop(0.5, `rgba(120, 200, 245, ${al * 0.35})`)
        gr.addColorStop(1, 'rgba(90, 170, 230, 0)')
        g.fillStyle = gr
        g.beginPath()
        g.moveTo(x0 + nx * w0, y0 + ny * w0)
        g.lineTo(x0 - nx * w0, y0 - ny * w0)
        g.lineTo(x1 - nx * w1, y1 - ny * w1)
        g.lineTo(x1 + nx * w1, y1 + ny * w1)
        g.fill()
      }
      g.globalCompositeOperation = 'source-over'
    }

    // The caustics' brightness at a point of the surface's plane.
    function causticAt (x, y) {
      const u = ((Math.floor((x / 8 + chop * 3 / TEX) * TEX) % TEX) + TEX) % TEX
      const v = ((Math.floor((y / 8 + chop * 2 / TEX) * TEX) % TEX) + TEX) % TEX
      return field[v * TEX + u]
    }

    // The bands of distance, metres, the first two on the far layer, and
    // the levels of light on a fish, from its dark back to the flash of
    // its silver flank.
    const BANDS = [Infinity, 30, 23, 17, 11, 0]
    const FAR = 2
    const LEVELS = [0.1, 0.28, 0.48, 0.72, 1]
    const DARK = [30, 48, 66]
    const SILVER = [228, 238, 244]
    const bins = BANDS.slice(1).map(() => LEVELS.map(() => []))
    const box = [0, 0, 0, 0]
    const grow = (x, y, r = 4) => {
      box[0] = Math.min(box[0], x - r)
      box[1] = Math.min(box[1], y - r)
      box[2] = Math.max(box[2], x + r)
      box[3] = Math.max(box[3], y + r)
    }
    function creatures (light) {
      for (const b of bins) for (const l of b) l.length = 0
      box[0] = box[1] = Infinity
      box[2] = box[3] = -Infinity
      const P = flock.pos
      const V = flock.vel
      const B = back
      const ex = 0
      const ey = 0
      const ezz = ez
      const nb = BANDS.length - 1
      const band = d => { let k = 0; while (k < nb - 1 && d < BANDS[k + 1]) k++; return k }
      for (let i = 0; i < flock.n; i++) {
        const j = 3 * i
        const s = Math.hypot(V[j], V[j + 1], V[j + 2]) || 1
        const ux = V[j] / s
        const uy = V[j + 1] / s
        const uz = V[j + 2] / s
        // The flank, which mirrors the light from above to the eye when it
        // faces half way between them, and the belly, pale from below.
        const sx = uy * B[j + 2] - uz * B[j + 1]
        const sy = uz * B[j] - ux * B[j + 2]
        const sz = ux * B[j + 1] - uy * B[j]
        let vx = ex - P[j]
        let vy = ey - P[j + 1]
        let vz = ezz - P[j + 2]
        const vl = Math.hypot(vx, vy, vz) || 1
        vx /= vl
        vy /= vl
        vz /= vl
        let hx = vx + SUN[0]
        let hy = vy + SUN[1]
        let hz = vz + SUN[2]
        const hl = Math.hypot(hx, hy, hz) || 1
        hx /= hl
        hy /= hl
        hz /= hl
        const sl = Math.hypot(sx, sy, sz) || 1
        const spec = Math.pow(Math.abs(sx * hx + sy * hy + sz * hz) / sl, 5)
        const belly = Math.max(0, -(B[j] * vx + B[j + 1] * vy + B[j + 2] * vz))
        const lit = 0.1 + 0.95 * spec + 0.3 * belly + 0.3 * causticAt(P[j], P[j + 1]) * Math.min(1, Math.exp((P[j + 2] + 2) / 6))
        if (!project(P[j] + ux * LEN, P[j + 1] + uy * LEN, P[j + 2] + uz * LEN)) continue
        const hx1 = PX
        const hy1 = PY
        const hd = PD
        if (!project(P[j], P[j + 1], P[j + 2])) continue
        // Half the fish on the screen at its own distance.
        const fx = (hx1 - PX) * hd / 2
        const fy = (hy1 - PY) * hd / 2
        const id = flock.id[i]
        for (let k = 0; k < DRAWN; k++) {
          const o = 3 * ((id * DRAWN + k) % 1021)
          const oa = OFFS[o] * RULE.sep
          const ob = OFFS[o + 1] * RULE.sep
          const oc = OFFS[o + 2] * RULE.sep
          if (!project(P[j] + oa * ux + ob * sx / sl + oc * B[j], P[j + 1] + oa * uy + ob * sy / sl + oc * B[j + 1], P[j + 2] + oa * uz + ob * sz / sl + oc * B[j + 2])) continue
          if (PX < -20 || PX > cw + 20 || PY < -20 || PY > ch + 20) continue
          const v = lit * (0.8 + 0.4 * hash(id * DRAWN + k))
          let lv = 0
          while (lv < LEVELS.length - 1 && v > (LEVELS[lv] + LEVELS[lv + 1]) / 2) lv++
          const qx = fx / PD
          const qy = fy / PD
          const bd = band(PD)
          bins[bd][lv].push(PX, PY, qx, qy)
          if (bd < FAR) grow(PX, PY)
        }
      }
      // The predators into their bands.
      const qs = flock.predators.map(q => ({ q, d: Math.hypot(q.x, q.y, q.z - ez) })).sort((a, b) => b.d - a.d)
      const c = W.centre()
      const cs = Math.max(0.05, (c.z - ez) / (Math.hypot(c.x, c.y, c.z - ez) || 1))
      // The far layer is cleared and drawn only within the box its fish
      // and predators fill.
      for (const { q, d } of qs) if (band(d) < FAR && project(q.x, q.y, q.z)) grow(PX, PY, KIND[q.kind].len * 1.4 * fo / PD)
      const fx0 = Math.max(0, Math.floor(box[0] / 2) - 2)
      const fy0 = Math.max(0, Math.floor(box[1] / 2) - 2)
      const fx1 = Math.min(far.width, Math.ceil(box[2] / 2) + 2)
      const fy1 = Math.min(far.height, Math.ceil(box[3] / 2) + 2)
      gf.setTransform(1, 0, 0, 1, 0, 0)
      gf.clearRect(0, 0, far.width, far.height)
      gf.setTransform(far.width / cw, 0, 0, far.height / ch, 0, 0)
      for (let k = 0; k < nb; k++) {
        const fg = k < FAR ? gf : g
        if (k === FAR) {
          // The far layer, scaled up, before the near bands.
          g.imageSmoothingEnabled = true
          if (fx1 > fx0 && fy1 > fy0) g.drawImage(far, fx0, fy0, fx1 - fx0, fy1 - fy0, fx0 * cw / far.width, fy0 * ch / far.height, (fx1 - fx0) * cw / far.width, (fy1 - fy0) * ch / far.height)
        }
        const dm = Math.min(45, (BANDS[k] === Infinity ? 40 : BANDS[k]) + BANDS[k + 1]) / 2
        const fog = 1 - Math.exp(-dm / VIS)
        const wc = water(cs, light)
        // Near, each sardine's outline, a spindle and a forked tail. Far,
        // a stroke as long and as deep as the fish.
        const shape = LEN / 2 * fo / dm >= 6
        fg.lineCap = 'butt'
        fg.lineWidth = Math.max(k < FAR ? 1.4 : 0.9, DEPTH * fo / dm)
        for (let lv = 0; lv < LEVELS.length; lv++) {
          const l = bins[k][lv]
          if (!l.length) continue
          const dim = 0.5 + 0.5 * light
          const base = mix(DARK, SILVER, LEVELS[lv]).map(v => v * dim)
          const col = rgb(mix(base, wc, fog))
          fg.beginPath()
          for (let m = 0; m < l.length; m += 4) {
            const x0 = l[m]
            const y0 = l[m + 1]
            const qx = l[m + 2]
            const qy = l[m + 3]
            if (!shape) {
              fg.moveTo(x0 - qx, y0 - qy)
              fg.lineTo(x0 + qx, y0 + qy)
              continue
            }
            const nx = -qy * 0.24
            const ny = qx * 0.24
            fg.moveTo(x0 + qx, y0 + qy)
            fg.lineTo(x0 + 0.2 * qx + nx, y0 + 0.2 * qy + ny)
            fg.lineTo(x0 - qx + 0.8 * nx, y0 - qy + 0.8 * ny)
            fg.lineTo(x0 - 0.8 * qx, y0 - 0.8 * qy)
            fg.lineTo(x0 - qx - 0.8 * nx, y0 - qy - 0.8 * ny)
            fg.lineTo(x0 + 0.2 * qx - nx, y0 + 0.2 * qy - ny)
            fg.closePath()
          }
          if (shape) {
            fg.fillStyle = col
            fg.fill()
          } else {
            fg.strokeStyle = col
            fg.stroke()
          }
        }
        for (const { q, d } of qs) if (band(d) === k) predator(fg, q, light)
      }
      // Scales from kills, falling and fading.
      g.fillStyle = 'rgb(220, 236, 244)'
      for (const e of W.kills) {
        const age = W.clock - e.t
        if (age > 2.5) continue
        g.globalAlpha = 1 - age / 2.5
        for (let k = 0; k < 12; k++) {
          const a = hash(e.t * 1000 + k) * TAU
          const r = (0.2 + 0.5 * hash(k + 17)) * Math.min(1, age * 2)
          if (!project(e.x + r * Math.cos(a), e.y + r * Math.sin(a), e.z - 0.15 * age - 0.3 * hash(k + 5))) continue
          g.fillRect(PX - 0.8, PY - 0.8, 1.6, 1.6)
        }
      }
      // The gannets' bubbles, rising and fading.
      g.strokeStyle = 'rgb(230, 245, 255)'
      g.lineWidth = 1
      g.beginPath()
      for (const b of W.trail) {
        const age = W.clock - b.t
        if (!project(b.x, b.y, Math.min(-0.05, b.z + 0.3 * age))) continue
        const r = Math.max(0.6, b.r * fo / PD)
        g.moveTo(PX + r, PY)
        g.arc(PX, PY, r, 0, TAU)
      }
      g.globalAlpha = 0.6 * light
      g.stroke()
      g.globalAlpha = 1
    }

    // A predator's body, seen from the diver: its outline along its axis,
    // as wide as its girth across the line of sight, its fins on its
    // back and sides, coloured dark above and pale below, blued with its
    // distance, the caustics playing on it when near.
    const SHAPE = {
      // [x along the body, a share of its length from the tail, radius as
      // a share of its length]
      dolphin: [[0, 0.01], [0.12, 0.028], [0.35, 0.078], [0.6, 0.088], [0.8, 0.07], [0.88, 0.05], [0.92, 0.026], [1, 0.012]],
      shark: [[0, 0.01], [0.15, 0.03], [0.4, 0.075], [0.62, 0.085], [0.85, 0.06], [1, 0.015]],
      sailfish: [[0.1, 0.008], [0.22, 0.03], [0.45, 0.06], [0.65, 0.06], [0.78, 0.04], [0.82, 0.015], [1, 0.002]],
      gannet: [[0, 0.04], [0.25, 0.1], [0.55, 0.13], [0.8, 0.09], [0.9, 0.05], [1, 0.005]]
    }
    function predator (fg, q, light) {
      const K = KIND[q.kind]
      const Ln = K.len
      const ux = q.ux
      const uy = q.uy
      const uz = q.uz
      // The back: up, square to the axis.
      let wx = -uz * ux
      let wy = -uz * uy
      let wz = 1 - uz * uz
      const wl = Math.hypot(wx, wy, wz)
      if (wl < 1e-3) [wx, wy, wz] = [0, 1, 0]
      else [wx, wy, wz] = [wx / wl, wy / wl, wz / wl]
      const sx = uy * wz - uz * wy
      const sy = uz * wx - ux * wz
      const sz = ux * wy - uy * wx
      // Across the line of sight.
      let ex = q.x
      let ey = q.y
      let eZ = q.z - ez
      const el = Math.hypot(ex, ey, eZ) || 1
      ex /= el
      ey /= el
      eZ /= el
      let bx = uy * eZ - uz * ey
      let by = uz * ex - ux * eZ
      let bz = ux * ey - uy * ex
      const bl = Math.hypot(bx, by, bz)
      if (bl < 0.05) [bx, by, bz] = [wx, wy, wz]
      else [bx, by, bz] = [bx / bl, by / bl, bz / bl]
      // The body bends with the tail's beat, side to side for a fish,
      // up and down for a dolphin.
      const sway = q.kind === 'dolphin' ? [wx, wy, wz] : [sx, sy, sz]
      const beat = Math.sin(q.beat * 2.4)
      const pt = (f, o, v, h) => {
        const a = (f - 0.6) * Ln
        const bend = 0.09 * Ln * beat * Math.pow(Math.max(0, 0.6 - f) / 0.6, 2)
        return project(q.x + ux * a + bx * o * Ln + v[0] * h * Ln + sway[0] * bend, q.y + uy * a + by * o * Ln + v[1] * h * Ln + sway[1] * bend, q.z + uz * a + bz * o * Ln + v[2] * h * Ln + sway[2] * bend) ? [PX, PY] : null
      }
      if (!project(q.x, q.y, q.z)) return
      const cx = PX
      const cy = PY
      const d = PD
      if (cx < -K.len * fo / d * 1.5 || cx > cw + K.len * fo / d * 1.5 || cy < -K.len * fo / d * 1.5 || cy > ch + K.len * fo / d * 1.5) return
      const shape = SHAPE[q.kind]
      const top = []
      const bot = []
      for (const [f, r] of shape) {
        const a = pt(f, r, [0, 0, 0], 0)
        const b = pt(f, -r, [0, 0, 0], 0)
        if (!a || !b) return
        top.push(a)
        bot.push(b)
      }
      const fins = []
      const W3 = [wx, wy, wz]
      const S3 = [sx, sy, sz]
      const N3 = [-wx, -wy, -wz]
      const fin = (...p) => { const v = p.map(a => pt(...a)); if (v.every(Boolean)) fins.push(v) }
      if (q.kind === 'dolphin') {
        fin([0.46, 0, W3, 0.07], [0.62, 0, W3, 0.07], [0.44, 0, W3, 0.21], [0.5, 0, W3, 0.15])
        fin([0.02, 0, S3, 0], [-0.07, 0, S3, 0.13], [-0.02, 0, S3, 0])
        fin([0.02, 0, S3, 0], [-0.07, 0, S3, -0.13], [-0.02, 0, S3, 0])
        fin([0.74, 0, N3, 0.05], [0.6, 0, S3, 0.2], [0.66, 0, N3, 0.06])
        fin([0.74, 0, N3, 0.05], [0.6, 0, S3, -0.2], [0.66, 0, N3, 0.06])
      } else if (q.kind === 'shark') {
        fin([0.5, 0, W3, 0.07], [0.66, 0, W3, 0.07], [0.52, 0, W3, 0.2])
        fin([0.02, 0, W3, 0], [-0.1, 0, W3, 0.2], [0.06, 0, W3, 0.02])
        fin([0.02, 0, W3, 0], [-0.04, 0, N3, 0.1], [0.06, 0, N3, 0.01])
        fin([0.7, 0, S3, 0], [0.56, 0, S3, 0.17], [0.62, 0, S3, 0])
        fin([0.7, 0, S3, 0], [0.56, 0, S3, -0.17], [0.62, 0, S3, 0])
      } else if (q.kind === 'sailfish') {
        // The sail, raised in the dash, and the bill.
        const hs = 0.04 + 0.14 * q.sail
        fin([0.72, 0, W3, 0.05], [0.7, 0, W3, 0.05 + hs], [0.5, 0, W3, 0.05 + hs * 1.1], [0.3, 0, W3, 0.05 + hs * 0.6], [0.22, 0, W3, 0.03])
        fin([0.12, 0, W3, 0], [0.0, 0, W3, 0.12], [0.06, 0, W3, 0], [0.0, 0, N3, 0.12])
      } else if (q.kind === 'gannet') {
        fin([0.75, 0, S3, 0.06], [0.1, 0, S3, 0.16], [0.35, 0, S3, 0.04])
        fin([0.75, 0, S3, -0.06], [0.1, 0, S3, -0.16], [0.35, 0, S3, -0.04])
      }
      const fog = 1 - Math.exp(-d / VIS)
      const s = clamp(eZ, -1, 1)
      const wc = water(s, light)
      const dim = 0.55 + 0.45 * light
      const topC = mix(K.top.map(v => v * dim), wc, fog)
      const belC = mix(K.belly.map(v => v * dim * Math.max(0.55, Math.min(1, (q.z + 30) / 26))), wc, fog)
      const a = pt(0.6, 0, W3, 0.08)
      const b = pt(0.6, 0, N3, 0.08)
      let fill = rgb(mix(topC, belC, 0.5))
      if (a && b && Math.hypot(a[0] - b[0], a[1] - b[1]) > 1.5) {
        const gr = fg.createLinearGradient(a[0], a[1], b[0], b[1])
        gr.addColorStop(0, rgb(topC))
        gr.addColorStop(1, rgb(belC))
        fill = gr
      }
      fg.fillStyle = rgb(topC)
      for (const f of fins) {
        fg.beginPath()
        fg.moveTo(f[0][0], f[0][1])
        for (const v of f.slice(1)) fg.lineTo(v[0], v[1])
        fg.closePath()
        fg.fill()
      }
      fg.fillStyle = fill
      fg.beginPath()
      fg.moveTo(top[0][0], top[0][1])
      for (const v of top.slice(1)) fg.lineTo(v[0], v[1])
      for (const v of bot.reverse()) fg.lineTo(v[0], v[1])
      fg.closePath()
      fg.fill()
      if (q.kind === 'sailfish') {
        const t = pt(1, 0, W3, 0)
        const n = pt(1.32, 0, W3, 0)
        if (t && n) {
          fg.strokeStyle = rgb(topC)
          fg.lineWidth = Math.max(1, 0.012 * Ln * fo / d)
          fg.beginPath()
          fg.moveTo(t[0], t[1])
          fg.lineTo(n[0], n[1])
          fg.stroke()
          // Its bars, lit in the dash.
          if (q.sail > 0.3) {
            fg.strokeStyle = `rgba(120, 190, 255, ${0.5 * q.sail * (1 - fog)})`
            fg.beginPath()
            for (let k = 0; k < 6; k++) {
              const u0 = pt(0.3 + 0.07 * k, 0.04, W3, 0)
              const u1 = pt(0.3 + 0.07 * k, -0.04, W3, 0)
              if (u0 && u1) {
                fg.moveTo(u0[0], u0[1])
                fg.lineTo(u1[0], u1[1])
              }
            }
            fg.stroke()
          }
        }
      }
      // The caustics on its back, near.
      if (fg === g && d < 20 && light > 0.5) {
        const pat = g.createPattern(tex, 'repeat')
        if (pat && pat.setTransform && typeof DOMMatrix !== 'undefined') {
          const k = fo / d * 8 / TEX
          pat.setTransform(new DOMMatrix([k, 0, 0, k, cx - q.x * fo / d, cy + q.y * 0.3 * fo / d]))
          g.save()
          g.clip()
          g.globalCompositeOperation = 'lighter'
          g.globalAlpha = 0.35 * (1 - fog) * light * Math.min(1, Math.exp((q.z + 2) / 8))
          g.fillStyle = pat
          g.fillRect(cx - Ln * fo / d, cy - Ln * fo / d, 2 * Ln * fo / d, 2 * Ln * fo / d)
          g.restore()
        }
      }
    }

    // Snow in the camera's frame, turned by the gaze's turn and drifting.
    function spin (da, dp, dt) {
      const ca = Math.cos(da)
      const sa = Math.sin(da)
      const cp = Math.cos(dp)
      const sp = Math.sin(dp)
      for (let k = 0; k < SNOW; k++) {
        let x = snow[3 * k]
        let y = snow[3 * k + 1]
        let z = snow[3 * k + 2]
        // A turn of the gaze right by da moves the snow left.
        const x1 = x * ca - z * sa
        const z1 = x * sa + z * ca
        x = x1
        z = z1
        const y1 = y * cp - z * sp
        const z2 = y * sp + z * cp
        y = y1 + dt * (0.03 + 0.02 * Math.sin(time * 0.3 + k))
        z = z2
        x += dt * 0.05 * Math.sin(time * 0.2 + 3 * k)
        if (z < 0.3 || z > 7 || Math.abs(x) > z * 0.9 || Math.abs(y) > z * 0.7) {
          z = 0.4 + 6.6 * rnd() * rnd()
          x = (rnd() - 0.5) * 1.8 * z
          y = (rnd() - 0.5) * 1.4 * z
        }
        snow[3 * k] = x
        snow[3 * k + 1] = y
        snow[3 * k + 2] = z
      }
    }

    function bubble () {
      if (bubbles.length > 80) return
      const side = rnd() < 0.5 ? -1 : 1
      bubbles.push({
        x: rt[0] * side * (0.1 + 0.12 * rnd()) + fw[0] * (0.35 + 0.2 * rnd()),
        y: rt[1] * side * (0.1 + 0.12 * rnd()) + fw[1] * (0.35 + 0.2 * rnd()),
        z: ez - 0.25 + fw[2] * 0.35,
        vz: 0.4 + 0.5 * rnd(),
        r: 0.002 + 0.008 * rnd() * rnd(),
        ph: rnd() * TAU
      })
    }

    // Near the lens: snow, and the diver's bubbles rising past it.
    function lens (dt, light) {
      g.fillStyle = `rgba(210, 230, 240, ${0.35 * light})`
      g.beginPath()
      for (let k = 0; k < SNOW; k++) {
        const z = snow[3 * k + 2]
        if (z < 1.2) continue
        const x = cw / 2 + fo * snow[3 * k] / z
        const y = ch / 2 - fo * snow[3 * k + 1] / z
        const r = Math.max(0.5, 0.0015 * fo / z)
        g.rect(x - r, y - r, 2 * r, 2 * r)
      }
      g.fill()
      g.fillStyle = `rgba(200, 225, 240, ${0.1 * light})`
      g.beginPath()
      for (let k = 0; k < SNOW; k++) {
        const z = snow[3 * k + 2]
        if (z >= 1.2) continue
        const x = cw / 2 + fo * snow[3 * k] / z
        const y = ch / 2 - fo * snow[3 * k + 1] / z
        const r = 0.006 * fo / z
        g.moveTo(x + r, y)
        g.arc(x, y, r, 0, TAU)
      }
      g.fill()
      g.lineWidth = 1.2
      g.strokeStyle = `rgba(225, 245, 255, ${0.55 * (0.5 + 0.5 * light)})`
      g.fillStyle = 'rgba(200, 235, 255, 0.07)'
      for (let k = bubbles.length - 1; k >= 0; k--) {
        const b = bubbles[k]
        b.vz = Math.min(1.6, b.vz + dt * 0.8)
        b.z += b.vz * dt
        b.r *= 1 + 0.06 * dt
        b.ph += dt * 9
        const wob = 0.004 * Math.sin(b.ph)
        if (!project(b.x + wob * rt[0], b.y + wob * rt[1], b.z) || PY < -60 || b.z - ez > 3) {
          bubbles.splice(k, 1)
          continue
        }
        const r = b.r * fo / PD
        g.beginPath()
        g.ellipse(PX, PY, r * (1 + 0.12 * Math.sin(b.ph)), r * (1 - 0.12 * Math.sin(b.ph)), 0, 0, TAU)
        g.fill()
        g.stroke()
        if (r > 3) {
          g.beginPath()
          g.arc(PX - 0.35 * r, PY - 0.35 * r, 0.18 * r, 0, TAU)
          g.stroke()
        }
      }
    }

    return {
      draw,

      // A drag turns the diver's gaze, which eases back to the school once
      // let go. A click: a shark cuts through the school at the fish
      // nearest the click.
      pointer (kind, x, y, down) {
        if (!cw) return
        if (kind === 'down') press = { x0: x, y0: y, drag: false, a: dyaw, p: dpitch }
        else if (press && down && Math.hypot(x - press.x0, y - press.y0) > 6) press.drag = true
        if (press && press.drag && down) {
          dyaw = clamp(press.a - (x - press.x0) / fo, -0.9, 0.9)
          dpitch = clamp(press.p + (y - press.y0) / fo, -0.5, 0.6)
        }
        if (kind !== 'up' || !press) return
        const p = press
        press = null
        released = time
        if (p.drag || !flock.n) return
        let best = -1
        let bd = Infinity
        for (let i = 0; i < flock.n; i++) {
          if (!project(flock.pos[3 * i], flock.pos[3 * i + 1], flock.pos[3 * i + 2])) continue
          const e = Math.hypot(PX - p.x0, PY - p.y0)
          if (e < bd) [best, bd] = [i, e]
        }
        if (best >= 0) W.attack('shark', best)
      },

      // For the live checks: the counts of the water, the sardines drawn
      // and the school's centre on the pane.
      probe () {
        const c = W.centre()
        const on = cw && project(c.x, c.y, c.z)
        return Object.assign(W.count(), { drawn: flock.n * DRAWN, at: on ? [Math.round(PX), Math.round(PY)] : [0, 0] })
      }
    }
  }

  if (typeof module === 'object' && module.exports) module.exports = { RULE, KIND, HOME, SURF, SCHOOL, DRAWN, water, world, create }
  else (root.VizCanvas = root.VizCanvas || {}).baitball = create
})(this)
