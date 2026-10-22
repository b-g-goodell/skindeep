'use strict'
// Murmuration mode (decision 0015, issue #187): a murmuration of
// starlings over a clearing in a forest, seen from the forest floor at
// the clearing's edge, looking up, the trunks and the canopy framing the
// sky. Falcons dive at it: a peregrine stoops from above, a sparrowhawk
// dashes in low from the trees, a pair of peregrines hunts together.
// The flock answers with a hole around the falcon, a flash expansion
// and a wave of turning that runs across the whole shape.
//
// The birds move by the flocking core (flock.js) in three dimensions,
// each following its nearest seven by rank (Ballerini et al., PNAS 105,
// 2008). Some 600 birds are simulated and each is drawn as ten
// starlings, so the flock is some 6000 dark specks. Each speck's
// darkness is its wings' area seen from the ground: level overhead a
// bird shows its whole underside, banked in a turn its edge, so a wave
// of turning crosses the flock as a band of light or dark, as in the
// real flocks. The signal, the clock and the pointer: see react, draw
// and pointer.

;(function (root) {
  const F = typeof module === 'object' && module.exports ? require('./flock') : root.VizFlock
  const TAU = Math.PI * 2
  const CLASS_HUE = [200, 120, 40, 0, 280, 320]
  // The flock: its size at rest and its most, and the starlings drawn
  // for each bird simulated.
  const FLOCK = 600
  const CAP = 680
  const SPECKS = 10
  // Where the flock wheels: over the clearing, 78 m ahead and 46 m up.
  const HOME = { x: 0, y: 78, z: 46 }
  // The flock's rule (flock.js), metres and seconds. A simulated bird
  // stands for ten, so it keeps 1.8 m where a starling keeps about 1.
  // Starlings fly at about 10 m/s, and a falcon in sight drives them to
  // 17. The sight of a falcon at 12 m and fear passed on at 0.3 open a
  // hole about it without alarming the whole flock, which the wave of
  // turning reaches instead.
  const RULE = {
    neighbours: { by: 'rank', k: 7, r: 12 },
    sep: 1.8,
    bunch: 0.4,
    cruise: 10,
    flight: 17,
    minSpeed: 8,
    accel: 18,
    accelFlight: 45,
    alignW: 0.6,
    cohW: 0.35,
    alignFear: 2,
    cohFear: 1,
    sight: 12,
    flee: 2.5,
    fountain: 0.7,
    fearDecay: 1,
    fearSpread: 4,
    fearPass: 0.3,
    follow: 0,
    wander: 0.15,
    driftW: 0,
    gather: 0.4,
    gatherR: 24,
    level: 0.6,
    bounds: { x: HOME.x, y: HOME.y, z: HOME.z, r: 45, w: 0.6 },
    substep: 1 / 20,
    relist: 3
  }
  // The falcons: speed at rest, in the dive and in the chase within
  // the flock, the steering limit at rest and in the dive, the reach of
  // the talons, the share of the flock's sight at which a diving falcon
  // is seen, the wingspan, metres, and the passes it makes.
  const KIND = {
    peregrine: { cruise: 14, speed: 38, chase: 21, accel: 25, accelDive: 70, reach: 0.8, seen: 1.6, span: 1.0, passes: 3 },
    hawk: { cruise: 15, speed: 17, chase: 17, accel: 30, accelDive: 30, reach: 0.8, seen: 1.2, span: 0.65, passes: 2 }
  }
  const ATTACKS = ['peregrine', 'hawk', 'pair']
  // A wave of turning: its front's speed, m/s. The flock turns home by
  // one when its centre strays past TURN metres from home across the
  // ground, and holds its height by a gentle steer of every bird alike.
  const WAVE = 20
  const TURN = 12
  // The camera: the eye's height, the gaze's elevation, radians.
  const EYE = 1.7
  const ELEV = 36 * Math.PI / 180
  const CE = Math.cos(ELEV)
  const SE = Math.sin(ELEV)
  // A starling's wingspan, metres, and the trees' dark.
  const WING = 0.38
  const TREE = 'rgb(12, 17, 13)'
  // The sky through the day, by the local hour: [hour, zenith, horizon,
  // glow]. The night is held at a deep twilight, so the birds still
  // show against it.
  const SKY = [
    [0, [29, 38, 70], [52, 62, 100], 0],
    [5, [34, 44, 86], [104, 92, 122], 0.15],
    [7, [80, 118, 170], [236, 182, 140], 0.6],
    [10, [62, 118, 190], [168, 204, 230], 0.1],
    [15, [58, 114, 188], [178, 210, 232], 0.1],
    [17.5, [74, 104, 168], [240, 196, 138], 0.45],
    [19, [58, 72, 134], [238, 138, 90], 0.8],
    [20.5, [40, 50, 100], [176, 106, 114], 0.5],
    [22, [31, 42, 82], [76, 79, 120], 0.1],
    [24, [29, 38, 70], [52, 62, 100], 0]
  ]
  const DUSK = [[24, 30, 60], [96, 64, 80]]

  const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t)
  const rgb = c => `rgb(${c.map(v => Math.round(v)).join(', ')})`

  // The sky's colours at hour h, the session's idle level darkening it.
  function skyAt (h, idle) {
    let k = 0
    while (k < SKY.length - 2 && SKY[k + 1][0] <= h) k++
    const [h0, z0, o0, g0] = SKY[k]
    const [h1, z1, o1, g1] = SKY[k + 1]
    const t = Math.max(0, Math.min(1, (h - h0) / (h1 - h0)))
    const d = 0.45 * idle
    return { zen: mix(mix(z0, z1, t), DUSK[0], d), hor: mix(mix(o0, o1, t), DUSK[1], d), glow: (g0 + (g1 - g0) * t) * (1 - 0.5 * idle), morning: h < 12 }
  }

  // A small hash of an integer to [0, 1).
  const hash = id => (Math.imul(id ^ 0x5bd1e995, 0x27d4eb2d) >>> 0) / 4294967296

  // Each speck's place about its bird, in the bird's frame: along its
  // heading, to its side and up, a share of sep.
  const OFFS = new Float32Array(1021 * 3)
  for (let k = 0; k < 1021; k++) {
    OFFS[3 * k] = (hash(3 * k + 1) - 0.5) * 1.1
    OFFS[3 * k + 1] = (hash(3 * k + 2) - 0.5) * 1.1
    OFFS[3 * k + 2] = (hash(3 * k + 3) - 0.5) * 0.35
  }

  // The simulation of the sky: the flock, its waves of turning, the
  // attacks and the clock, with no canvas, so the tests run it too.
  function world (rnd) {
    const flock = new F.Flock({ dim: 3, cap: CAP, params: Object.assign({}, RULE, { bounds: Object.assign({}, RULE.bounds) }), rnd })
    // Each bird's velocity a substep ago and its lift, the way its body
    // faces, smoothed: up at rest, tilted into a turn.
    const prev = new Float32Array(3 * CAP)
    const lift = new Float32Array(3 * CAP)
    const remove = flock.remove.bind(flock)
    flock.remove = i => {
      const j = flock.n - 1
      for (let c = 0; c < 3; c++) {
        prev[3 * i + c] = prev[3 * j + c]
        lift[3 * i + c] = lift[3 * j + c]
      }
      remove(i)
    }
    let clock = 0
    // Attacks, waves, marks, the lure on the pointer, counts for the
    // probe.
    const attacks = []
    const waves = []
    const marks = []
    const carried = []
    let lure = null
    let held = null
    let started = 0
    let kills = 0
    let rippled = 0
    let turned = 0
    let next = 20
    let refill = 0
    let home = 0

    for (let i = 0; i < FLOCK; i++) {
      const a = rnd() * TAU
      const r = 30 * Math.sqrt(rnd())
      flock.add(HOME.x + r * Math.cos(a), HOME.y + r * Math.sin(a), HOME.z + (rnd() - 0.5) * 6, 10, 0, 0)
      lift[3 * i + 2] = 1
    }
    flock.step(8)
    for (let i = 0; i < 3 * flock.n; i++) prev[i] = flock.vel[i]

    const centre = () => flock.centre()

    // The flock's mean heading, a unit vector.
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

    // A wave of turning from (x, y, z): birds the front passes turn about
    // axis, by sign, each for band seconds, out to reach metres. The
    // front reaches each bird when it has run as far as the bird stood
    // from its start, so every bird turns for as long, and as far,
    // wherever it flies meanwhile. hue: the tool class's colour of its
    // first bird's mark, or null.
    function wave (o, axis, sign, band, w, reach, origin, hue) {
      if (waves.length >= 3) waves.shift()
      const l = Math.hypot(axis[0], axis[1], axis[2]) || 1
      const from = new Map()
      const P = flock.pos
      for (let i = 0; i < flock.n; i++) {
        const d = Math.hypot(P[3 * i] - o[0], P[3 * i + 1] - o[1], P[3 * i + 2] - o[2])
        if (d <= reach) from.set(flock.id[i], d)
      }
      waves.push({ o, axis: axis.map(v => v / l), sign, band, w, reach, t0: clock, from })
      if (hue !== null && origin >= 0) {
        marks.push({ id: flock.id[origin], t: clock, hue })
        if (marks.length > 12) marks.shift()
      }
    }

    // A bird at random, or -1.
    const any = () => flock.n ? Math.floor(rnd() * flock.n) : -1
    const at = i => [flock.pos[3 * i], flock.pos[3 * i + 1], flock.pos[3 * i + 2]]
    // The farthest any bird is from o.
    function extent (o) {
      let m = 0
      const P = flock.pos
      for (let i = 0; i < flock.n; i++) m = Math.max(m, Math.hypot(P[3 * i] - o[0], P[3 * i + 1] - o[1], P[3 * i + 2] - o[2]))
      return m
    }
    // An axis near the vertical, tilted a little at random, so a turn
    // rolls and pitches the flock as it wheels.
    const tilt = s => [(rnd() - 0.5) * s, (rnd() - 0.5) * s, 1]

    // The whole flock turns, from bird i, by about a quarter turn, or a
    // half turn when wide.
    function turn (i, hue, wide) {
      if (i < 0) return
      const o = at(i)
      turned++
      wave(o, tilt(0.8), rnd() < 0.5 ? -1 : 1, wide ? 1.7 : 0.8, 1.6, extent(o), i, hue)
    }

    // A falcon of kind k at (x, y, z) in attack a.
    function falcon (k, x, y, z, a, o) {
      const K = KIND[k]
      const q = flock.hunter(Object.assign({ x, y, z, speed: K.cruise, accel: K.accel, reach: K.reach, seen: 1, kind: k, attack: a, phase: 'wait', t0: clock, passes: 0, best: Infinity, waved: false, wait: 2 + 3 * rnd(), ring: rnd() * TAU }, o))
      a.members.push(q)
      return q
    }

    function phase (q, p) {
      const K = KIND[q.kind]
      q.phase = p
      q.t0 = clock
      if (p === 'dive') {
        q.speed = K.speed
        q.accel = K.accelDive
        q.seen = K.seen
        q.goal = null
        q.best = Infinity
        q.waved = false
      } else if (p === 'climb') {
        q.target = -1
        q.speed = 20
        q.accel = K.accel
        q.seen = 1
        q.passes++
        const s = Math.hypot(q.vx, q.vy) || 1
        q.goal = { x: q.x + q.vx / s * 40, y: q.y + q.vy / s * 40, z: centre().z + 50 }
      } else if (p === 'wait') {
        q.target = -1
        q.speed = K.cruise
        q.accel = K.accel
        q.seen = 1
        q.wait = 1.5 + 2 * rnd()
      } else if (p === 'leave') {
        q.target = -1
        q.speed = 22
        q.accel = K.accel
        q.seen = 1
        const a = Math.atan2(q.y - HOME.y, q.x - HOME.x)
        q.goal = { x: HOME.x + Math.cos(a) * 600, y: HOME.y + Math.sin(a) * 600, z: q.z + 60 }
      }
    }

    // An attack of kind k: a peregrine circling high above the flock, a
    // sparrowhawk low from the trees across the clearing, or a pair of
    // peregrines. at: a bird a falcon stoops on at once, from above it.
    function attack (k, at) {
      if (!flock.n || flock.predators.length > 8) return null
      const on = attacks.filter(a => a.members.some(hunting))
      if (on.length >= 2) for (const q of on[0].members) if (hunting(q)) phase(q, 'leave')
      const c = centre()
      const a = { kind: k, members: [], t0: clock }
      attacks.push(a)
      started++
      const r = rnd() * TAU
      if (at !== undefined) {
        const P = flock.pos
        const q = falcon('peregrine', P[3 * at] + 20 * Math.cos(r), P[3 * at + 1] + 20 * Math.sin(r), P[3 * at + 2] + 60, a)
        phase(q, 'dive')
        q.target = at
      } else if (k === 'hawk') {
        const x = (rnd() - 0.5) * 120
        const q = falcon('hawk', x, HOME.y + 90, 18, a)
        flock.pick(q, 'straggler')
        phase(q, 'dive')
      } else {
        const n = k === 'pair' ? 2 : 1
        for (let j = 0; j < n; j++) falcon('peregrine', c.x + 70 * Math.cos(r + j * 2), c.y + 70 * Math.sin(r + j * 2), c.z + 75 + 10 * j, a, { wait: 3 + 3 * rnd() + 1.2 * j })
      }
      next = clock + 45 + 30 * rnd()
      return a
    }

    const hunting = q => q.phase !== 'leave' && q.phase !== 'carry'

    // One more falcon for the newest attack still on, of its kind, or a
    // lone peregrine's attack when none is.
    function join () {
      const a = [...attacks].reverse().find(a => a.members.some(hunting))
      if (!a) return attack('peregrine')
      const c = centre()
      const r = rnd() * TAU
      if (a.kind === 'hawk') {
        const q = falcon('hawk', (rnd() - 0.5) * 120, HOME.y + 90, 18, a)
        flock.pick(q, 'straggler')
        phase(q, 'dive')
      } else falcon('peregrine', c.x + 70 * Math.cos(r), c.y + 70 * Math.sin(r), c.z + 80, a)
      return a
    }

    // Every falcon still circling stoops now.
    function stoop () {
      for (const a of attacks) {
        a.members.filter(q => q.phase === 'wait' || q.phase === 'climb').forEach((q, j) => {
          flock.pick(q, j % 2 ? 'middle' : 'edge')
          phase(q, 'dive')
        })
      }
    }

    // The session's events (decision 0015's table).
    function react (e) {
      if (!flock.n) return
      if (e.kind === 3) attack(ATTACKS[started % 3])
      else if (e.kind === 2) turn(any(), CLASS_HUE[e.cls] ?? 200, false)
      else if (e.kind === 4) stoop()
      else if (e.kind === 5) join()
      else if (e.kind === 6) {
        // The flock turns about, from its leading edge.
        const h = heading()
        let best = -1
        let s = -Infinity
        for (let i = 0; i < flock.n; i++) {
          const v = flock.pos[3 * i] * h[0] + flock.pos[3 * i + 1] * h[1] + flock.pos[3 * i + 2] * h[2]
          if (v > s) [best, s] = [i, v]
        }
        turn(best, null, true)
      } else {
        // A ripple: a short turn among a bird's neighbours.
        const i = any()
        rippled++
        wave(at(i), tilt(1.2), rnd() < 0.5 ? -1 : 1, 0.45, 1.2, 14, i, null)
      }
    }

    // The attacks' plans, each substep.
    function plan (h, L) {
      const c = centre()
      const P = flock.pos
      for (const q of [...flock.predators]) {
        if (q === lure) continue
        const K = KIND[q.kind]
        const age = clock - q.t0
        if (q.phase === 'wait') {
          // Circling high over the flock, then the stoop.
          q.ring += h * 0.35
          q.goal = { x: c.x + 60 * Math.cos(q.ring), y: c.y + 60 * Math.sin(q.ring), z: c.z + 70 }
          if (age > q.wait) {
            const a = q.attack.members
            flock.pick(q, a.length > 1 && a.indexOf(q) % 2 ? 'middle' : 'edge')
            phase(q, 'dive')
          }
        } else if (q.phase === 'dive') {
          if (q.target < 0) flock.pick(q, q.kind === 'hawk' ? 'straggler' : 'edge')
          const i = q.target
          const d = i >= 0 ? Math.hypot(P[3 * i] - q.x, P[3 * i + 1] - q.y, P[3 * i + 2] - q.z) : Infinity
          // Near, the flock turns away from it, a wave from its target.
          if (!q.waved && d < 22 && i >= 0) {
            q.waved = true
            const hd = heading()
            const side = hd[0] * (q.y - c.y) - hd[1] * (q.x - c.x)
            const o = at(i)
            turned++
            wave(o, tilt(0.6), side > 0 ? -1 : 1, 0.9, 1.8, extent(o), i, null)
          }
          // At the flock it slows to chase through it, the hole open
          // about it.
          if (d < 25) q.speed = K.chase
          q.best = Math.min(q.best, d)
          // Past its target or too long at it: up again for another pass.
          if (d > q.best + 4 || age > (q.kind === 'hawk' ? 7 : 5)) {
            if (q.passes + 1 >= K.passes) {
              q.passes++
              phase(q, 'leave')
            } else if (q.kind === 'hawk') {
              q.passes++
              flock.pick(q, 'straggler')
              phase(q, 'dive')
            } else phase(q, 'climb')
          }
        } else if (q.phase === 'climb') {
          if (q.z > c.z + 35 || age > 8) phase(q, 'wait')
        } else if (q.phase === 'leave' || q.phase === 'carry') {
          if (Math.hypot(q.x - HOME.x, q.y - HOME.y) > 320) drop(q)
        }
        // The session idle, the falcons leave.
        if (L.idle > 0.6 && hunting(q)) phase(q, 'leave')
      }
      for (let k = attacks.length - 1; k >= 0; k--) if (!attacks[k].members.length) attacks.splice(k, 1)
    }

    function drop (q) {
      flock.predators.splice(flock.predators.indexOf(q), 1)
      const m = q.attack.members
      m.splice(m.indexOf(q), 1)
      const k = carried.indexOf(q)
      if (k >= 0) carried.splice(k, 1)
    }

    // The waves' turns, and the hold on the flock's height, as each
    // bird's push in the core.
    function steer () {
      const V = flock.vel
      const U = flock.push
      U.fill(0, 0, 3 * flock.n)
      const rise = Math.max(-1, Math.min(1, (flock.p.bounds.z - centre().z) / 20)) * 0.5
      for (let i = 0; i < flock.n; i++) U[3 * i + 2] = rise
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
          // axis x heading: the heading's turn about the axis.
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

    // Far from home and flying away, the flock turns back: a wave of
    // turning from its leading edge, toward home.
    function homeward () {
      if (clock < home) return
      const c = centre()
      const ox = c.x - HOME.x
      const oy = c.y - HOME.y
      const od = Math.hypot(ox, oy)
      if (od < TURN) return
      const hd = heading()
      if ((hd[0] * ox + hd[1] * oy) / od < 0.2) return
      let best = 0
      let s = -Infinity
      for (let i = 0; i < flock.n; i++) {
        const v = flock.pos[3 * i] * hd[0] + flock.pos[3 * i + 1] * hd[1]
        if (v > s) [best, s] = [i, v]
      }
      const o = at(best)
      turned++
      wave(o, tilt(0.3), hd[0] * oy - hd[1] * ox > 0 ? -1 : 1, 1.3, 1.8, extent(o), best, null)
      home = clock + 4
    }

    // The world's clock advanced by h.
    function advance (h, L) {
      plan(h, L)
      // At idle the flock settles lower, toward the roost.
      flock.p.bounds.z = HOME.z - 18 * L.idle
      homeward()
      steer()
      for (const k of flock.step(h)) {
        kills++
        const q = k.q
        q.phase = 'carry'
        q.t0 = clock
        q.target = -1
        q.speed = 16
        const a = Math.atan2(q.y - HOME.y, q.x - HOME.x)
        q.goal = { x: HOME.x + Math.cos(a) * 600, y: HOME.y + Math.sin(a) * 600, z: q.z - 30 }
        carried.push(q)
      }
      // The lure stays where the pointer holds it, and its velocity, which
      // the birds read, falls away over some 0.2 s as the pointer rests.
      if (lure) {
        const e = Math.min(1, h / 0.2)
        lure.x = held[0]
        lure.y = held[1]
        lure.z = held[2]
        lure.vx -= lure.vx * e
        lure.vy -= lure.vy * e
        lure.vz -= lure.vz * e
      }
      // Each bird's lift: up, tilted by its acceleration across its
      // heading, smoothed over 0.15 s.
      const V = flock.vel
      const Lf = lift
      const e = Math.min(1, h / 0.15)
      for (let i = 0; i < flock.n; i++) {
        const j = 3 * i
        const s = Math.hypot(V[j], V[j + 1], V[j + 2]) || 1
        const ux = V[j] / s
        const uy = V[j + 1] / s
        const uz = V[j + 2] / s
        let ax = (V[j] - prev[j]) / h
        let ay = (V[j + 1] - prev[j + 1]) / h
        let az = (V[j + 2] - prev[j + 2]) / h + 9.8
        const al = ax * ux + ay * uy + az * uz
        ax -= al * ux
        ay -= al * uy
        az -= al * uz
        const l = Math.hypot(ax, ay, az) || 1
        Lf[j] += (ax / l - Lf[j]) * e
        Lf[j + 1] += (ay / l - Lf[j + 1]) * e
        Lf[j + 2] += (az / l - Lf[j + 2]) * e
        prev[j] = V[j]
        prev[j + 1] = V[j + 1]
        prev[j + 2] = V[j + 2]
      }
      // Starlings fly in from the trees to a thinned flock while no
      // falcon dives.
      if (flock.n < FLOCK && clock > refill && !flock.predators.some(q => q.phase === 'dive')) {
        const c = centre()
        const x = (rnd() - 0.5) * 140
        const k = 3 + Math.floor(rnd() * 4)
        for (let j = 0; j < k && flock.n < FLOCK; j++) {
          const i = flock.add(x + 2 * j, HOME.y + 85 + 2 * rnd(), 20 + 2 * rnd(), (c.x - x) * 0.08, -6, 5)
          if (i < 0) break
          prev[3 * i] = flock.vel[3 * i]
          prev[3 * i + 1] = flock.vel[3 * i + 1]
          prev[3 * i + 2] = flock.vel[3 * i + 2]
          lift[3 * i] = 0
          lift[3 * i + 1] = 0
          lift[3 * i + 2] = 1
        }
        refill = clock + 2 + 2 * rnd()
      }
      // An attack now and then of its own, while the session works.
      if (clock > next && L.idle < 0.3) attack(ATTACKS[started % 3])
      clock += h
    }

    // The lure on the pointer: a hawk's shape the birds shy from, held
    // at (x, y, z) and moving at (vx, vy, vz) as the pointer moves, until
    // released.
    function hold (x, y, z, vx, vy, vz) {
      if (!lure) lure = flock.hunter({ speed: 0, accel: 0, reach: 0, seen: 1.3, kind: 'hawk', phase: 'lure' })
      held = [x, y, z]
      Object.assign(lure, { x, y, z, vx, vy, vz })
    }

    function release () {
      if (!lure) return
      flock.predators.splice(flock.predators.indexOf(lure), 1)
      lure = null
      held = null
    }

    return {
      flock,
      lift,
      marks,
      react,
      advance,
      attack,
      centre,
      hold,
      release,
      get clock () { return clock },
      get lure () { return lure },
      // The flock simulated, the falcons, the attacks begun, the kills
      // and the waves of turning.
      count () {
        return { birds: flock.n, falcons: flock.predators.length - (lure ? 1 : 0), attacks: started, kills, waves: turned, ripples: rippled, clock }
      }
    }
  }

  function create (canvas) {
    const out = canvas.getContext('2d')
    const layer = document.createElement('canvas')
    const g = layer.getContext('2d', { willReadFrequently: true })
    const seed = (Math.random() * 4294967296) >>> 0
    const rnd = F.rng(seed)
    const W = world(rnd)
    const flock = W.flock
    const lift = W.lift
    const marks = W.marks
    const centre = W.centre
    // The forest: each pane size's layers, painted once.
    let forest = null
    let cw = 0
    let ch = 0
    let fo = 1
    let calm = 0
    let wind = 0
    const mark = {}
    let press = null
    // The camera. World to screen: [x, y, depth], depth <= 0 behind.
    function project (x, y, z) {
      const dz = z - EYE
      const d = y * CE + dz * SE
      if (d < 0.3) return [0, 0, d]
      const up = -y * SE + dz * CE
      return [cw / 2 + fo * x / d, ch / 2 - fo * up / d, d]
    }
    // Screen to the world: the point at distance d along the ray.
    function ray (sx, sy, d) {
      const rx = (sx - cw / 2) / fo
      const ry = (ch / 2 - sy) / fo
      // forward (0, CE, SE), right (1, 0, 0), up (0, -SE, CE)
      const x = rx
      const y = CE - ry * SE
      const z = SE + ry * CE
      const l = Math.hypot(x, y, z)
      return [x / l * d, y / l * d, EYE + z / l * d]
    }

    // The forest about the clearing, painted for the pane's size: the
    // far treeline and the near trunks, still, and the near canopy in
    // a layer for each side, moved by the wind. Each layer is cropped
    // to what it covers.
    function paintForest () {
      const fr = F.rng(seed ^ 0x9e3779b9)
      const mk = () => {
        const c = document.createElement('canvas')
        c.width = cw
        c.height = ch
        return c
      }
      const still = mk()
      const sg = still.getContext('2d', { willReadFrequently: true })
      // The treeline across the clearing, 80 to 140 m away, crowns 12 to
      // 22 m high, the farther hazier: each crown a cluster of rounds on
      // a column down to the ground.
      for (const [d0, tone] of [[115, 'rgb(40, 52, 50)'], [80, 'rgb(22, 31, 27)']]) {
        sg.fillStyle = tone
        // The undergrowth and the trunks below the crowns, one band.
        const [, yb] = project(0, d0 + 12, 7)
        sg.fillRect(0, yb, cw, ch - yb + 2)
        for (let a = -80; a <= 80; a += 1.6 + 1.6 * fr()) {
          const az = a * Math.PI / 180
          const D = d0 + 25 * fr()
          const x = Math.sin(az) * D
          const y = Math.cos(az) * D
          const top = 12 + 10 * fr()
          const [bx, , bd] = project(x, y, 0)
          if (bd <= 0.3) continue
          const r = (2.5 + 2.5 * fr()) * fo / bd
          if (bx < -3 * r || bx > cw + 3 * r) continue
          const [, ty] = project(x, y, top - 6)
          sg.fillRect(bx - 0.5 * r, ty, r, ch - ty + 2)
          sg.beginPath()
          for (let k = 0; k < 14; k++) {
            const [cx, cy] = project(x + (fr() - 0.5) * 5, y + (fr() - 0.5) * 5, top - 1 - 5 * fr())
            const rr = r * (0.3 + 0.35 * fr())
            sg.moveTo(cx + rr, cy)
            sg.arc(cx, cy, rr, 0, TAU)
          }
          sg.fill()
        }
      }
      const sides = []
      for (const side of [-1, 1]) {
        const lc = mk()
        const lg = lc.getContext('2d', { willReadFrequently: true })
        const box = [cw, ch, 0, 0]
        const grow = (x, y, r) => {
          box[0] = Math.min(box[0], x - r)
          box[1] = Math.min(box[1], y - r)
          box[2] = Math.max(box[2], x + r)
          box[3] = Math.max(box[3], y + r)
        }
        // Two trees at the clearing's edge on each side, 10 to 30 m away
        // along the ground, their trunks leaning in toward the zenith
        // and their crowns at the pane's side.
        for (let t = 0; t < 2; t++) {
          const u = -0.24 + 0.2 * t + 0.05 * fr()
          const sx = side < 0 ? u * cw : (1 - u) * cw
          const [x, y] = ray(sx, ch, 9 + 5 * t + 6 * fr())
          const r = 0.25 + 0.2 * fr()
          const top = 22 + 6 * fr()
          const p = [project(x - r, y, 0), project(x + r, y, 0), project(x + r * 0.5, y, top - 2), project(x - r * 0.5, y, top - 2)]
          if (p.some(v => v[2] <= 0.3)) continue
          sg.fillStyle = TREE
          sg.beginPath()
          sg.moveTo(p[0][0], p[0][1])
          for (const v of p.slice(1)) sg.lineTo(v[0], v[1])
          sg.fill()
          // Boughs from the upper trunk, and leaves about the crown,
          // reaching out over the clearing.
          for (let b = 0; b < 10; b++) {
            const z0 = top * (0.55 + 0.35 * fr())
            const reach = 1 + 4 * fr()
            const cx = x - side * reach
            const cy = y + (fr() - 0.4) * 5
            const cz = z0 + 1 + 2.5 * fr()
            const [ax, ay, ad] = project(x, y, z0)
            const [ex, ey, ed] = project(cx, cy, cz)
            if (ad <= 0.3 || ed <= 0.3) continue
            lg.strokeStyle = TREE
            lg.lineWidth = Math.max(1, 0.1 * fo / ed)
            lg.beginPath()
            lg.moveTo(ax, ay)
            lg.lineTo(ex, ey)
            lg.stroke()
            grow(ax, ay, 2)
            clump(lg, cx, cy, cz, 1.2 + 1.6 * fr(), fr, grow)
          }
        }
        // Boughs of the trees overhead, into the top corner.
        for (let k = 0; k < 6; k++) {
          const sx = side < 0 ? fr() * fr() * 0.26 * cw : cw - fr() * fr() * 0.26 * cw
          const sy = fr() * fr() * 0.18 * ch
          const [x, y, z] = ray(sx, sy, 9 + 8 * fr())
          clump(lg, x, y, z, 1.4 + 1.6 * fr(), fr, grow)
        }
        const x0 = Math.max(0, Math.floor(box[0]) - 2)
        const y0 = Math.max(0, Math.floor(box[1]) - 2)
        const x1 = Math.min(cw, Math.ceil(box[2]) + 2)
        const y1 = Math.min(ch, Math.ceil(box[3]) + 2)
        if (x1 <= x0 || y1 <= y0) continue
        const crop = document.createElement('canvas')
        crop.width = x1 - x0
        crop.height = y1 - y0
        crop.getContext('2d').drawImage(lc, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0)
        sides.push({ c: crop, x: x0, y: y0, side, ph: fr() * TAU })
      }
      return { still, sides }
    }

    // A clump of leaves about (x, y, z) of radius r, into lg: denser at
    // its heart, sparse and ragged at its edge, where the sky shows.
    function clump (lg, x, y, z, r, fr, grow) {
      const [, , d] = project(x, y, z)
      if (d <= 0.5) return
      lg.fillStyle = TREE
      lg.beginPath()
      for (let k = 0; k < 140; k++) {
        const u = fr() * TAU
        const v = Math.acos(2 * fr() - 1)
        const s = r * Math.pow(fr(), 0.6)
        const [px, py, pd] = project(x + s * Math.sin(v) * Math.cos(u), y + s * Math.sin(v) * Math.sin(u), z + s * Math.cos(v) * 0.6)
        if (pd <= 0.3) continue
        const lr = Math.max(0.7, (0.07 + 0.08 * fr()) * fo / pd)
        lg.moveTo(px + lr, py)
        lg.ellipse(px, py, lr, lr * 0.6, fr() * Math.PI, 0, TAU)
        grow(px, py, lr)
      }
      lg.fill()
    }

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
        forest = paintForest()
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
      calm = L.idle
      wind += dt * (0.6 + 1.6 * Math.min(1, L.treble))

      // The sky by the local hour, darker as the session idles.
      const now = new Date()
      const sky = skyAt(now.getHours() + now.getMinutes() / 60, calm)
      g.setTransform(1, 0, 0, 1, 0, 0)
      const gr = g.createLinearGradient(0, 0, 0, h)
      gr.addColorStop(0, rgb(sky.zen))
      gr.addColorStop(0.65, rgb(mix(sky.zen, sky.hor, 0.55)))
      gr.addColorStop(1, rgb(sky.hor))
      g.fillStyle = gr
      g.fillRect(0, 0, w, h)
      if (sky.glow > 0.02) {
        const gx = sky.morning ? w * 1.05 : -w * 0.05
        const gl = g.createRadialGradient(gx, h, 0, gx, h, 0.9 * Math.max(w, h))
        gl.addColorStop(0, `rgba(255, 200, 140, ${0.55 * sky.glow})`)
        gl.addColorStop(1, 'rgba(255, 200, 140, 0)')
        g.fillStyle = gl
        g.fillRect(0, 0, w, h)
      }

      // The starlings: each bird's specks, each a stroke along its wings
      // as they show from the ground, darker the more of their area
      // faces the eye. Far, under a pixel and a half, a dot as faint as
      // the bird is small.
      const P = flock.pos
      const V = flock.vel
      const Lf = lift
      const c0 = centre()
      const pc = WING * fo / Math.max(1, Math.hypot(c0.x, c0.y, c0.z - EYE))
      const dots = pc < 1.5
      const lvls = [[], [], [], [], []]
      const flap = W.clock * TAU * 11
      for (let i = 0; i < flock.n; i++) {
        const j = 3 * i
        const s = Math.hypot(V[j], V[j + 1], V[j + 2]) || 1
        const ux = V[j] / s
        const uy = V[j + 1] / s
        const uz = V[j + 2] / s
        // The bird's side, level, and the face its wings turn to the eye.
        const sl = Math.hypot(uy, ux) || 1
        const qx = uy / sl
        const qy = -ux / sl
        const ex = -P[j]
        const ey = -P[j + 1]
        const ez = EYE - P[j + 2]
        const el = Math.hypot(ex, ey, ez) || 1
        const face = Math.abs(Lf[j] * ex + Lf[j + 1] * ey + Lf[j + 2] * ez) / el
        // The wings' line on the screen, the bird's banked side.
        const bx = uy * Lf[j + 2] - uz * Lf[j + 1]
        const by = uz * Lf[j] - ux * Lf[j + 2]
        const bz = ux * Lf[j + 1] - uy * Lf[j]
        const [x0, y0, d0] = project(P[j], P[j + 1], P[j + 2])
        const [x1, y1] = project(P[j] + bx, P[j + 1] + by, P[j + 2] + bz)
        if (d0 <= 0.3) continue
        const wl = Math.hypot(x1 - x0, y1 - y0) || 1
        const wx = (x1 - x0) / wl
        const wy = (y1 - y0) / wl
        const id = flock.id[i]
        for (let k = 0; k < SPECKS; k++) {
          const o = 3 * ((id * SPECKS + k) % 1021)
          const a = OFFS[o] * RULE.sep
          const b = OFFS[o + 1] * RULE.sep
          const c = OFFS[o + 2] * RULE.sep
          const [x, y, d] = project(P[j] + a * ux + b * qx, P[j + 1] + a * uy + b * qy, P[j + 2] + a * uz + c)
          if (d <= 0.3 || x < -4 || x > w + 4 || y < -4 || y > h + 4) continue
          const pix = WING * fo / d
          const vis = (0.3 + 0.7 * face) * (0.8 + 0.2 * Math.sin(flap + 7 * hash(id * SPECKS + k)))
          const al = dots ? Math.min(1, vis * pix * 0.9) : 0.15 + 0.85 * vis
          const half = dots ? 0 : pix * (0.12 + 0.45 * vis)
          lvls[al < 0.3 ? 0 : al < 0.45 ? 1 : al < 0.6 ? 2 : al < 0.8 ? 3 : 4].push(x - wx * half, y - wy * half, x + wx * half, y + wy * half)
        }
      }
      g.fillStyle = g.strokeStyle = 'rgb(18, 14, 16)'
      g.lineCap = 'butt'
      g.lineWidth = Math.max(1, 0.7 * pc)
      const AL = [0.4, 0.55, 0.7, 0.85, 1]
      for (let k = 0; k < 5; k++) {
        const l = lvls[k]
        if (!l.length) continue
        g.globalAlpha = AL[k]
        g.beginPath()
        if (dots) for (let m = 0; m < l.length; m += 4) g.rect(l[m] - 0.6, l[m + 1] - 0.6, 1.2, 1.2)
        else {
          for (let m = 0; m < l.length; m += 4) {
            g.moveTo(l[m], l[m + 1])
            g.lineTo(l[m + 2], l[m + 3])
          }
        }
        if (dots) g.fill()
        else g.stroke()
      }
      g.globalAlpha = 1

      // The falcons, at least 16 px across so they can be followed, and
      // the lure on the pointer.
      for (const q of flock.predators) falconAt(q, q === W.lure ? 0.8 : 1)

      // The marks of tool calls' waves, about their first birds.
      for (let k = marks.length - 1; k >= 0; k--) {
        const m = marks[k]
        const age = W.clock - m.t
        if (age > 1.4) {
          marks.splice(k, 1)
          continue
        }
        let i = -1
        for (let n = 0; n < flock.n; n++) if (flock.id[n] === m.id) i = n
        if (i < 0) continue
        const [x, y, d] = project(P[3 * i], P[3 * i + 1], P[3 * i + 2])
        if (d <= 0.3) continue
        g.strokeStyle = `hsla(${m.hue}, 90%, 62%, ${1 - age / 1.4})`
        g.lineWidth = 1.5
        g.beginPath()
        g.arc(x, y, 5 + 14 * age, 0, TAU)
        g.stroke()
      }

      // The forest: the still treeline and trunks, the canopy swaying.
      g.drawImage(forest.still, 0, 0)
      const gust = 0.6 + 1.4 * Math.min(1, L.treble)
      for (const s of forest.sides) {
        const A = 0.0025 * Math.max(w, h) * gust
        const dx = A * (Math.sin(wind * 0.9 + s.ph) + 0.4 * Math.sin(wind * 2.3 + 2 * s.ph))
        const dy = 0.35 * A * Math.sin(wind * 1.3 + s.ph)
        g.drawImage(s.c, s.x + dx, s.y + dy)
      }
      out.drawImage(layer, 0, 0)
    }

    // A falcon's silhouette: wings swept back in the dive, spread when
    // it circles.
    function falconAt (q, alpha) {
      const [x, y, d] = project(q.x, q.y, q.z)
      if (d <= 0.3) return
      const K = KIND[q.kind] || KIND.hawk
      const span = Math.max(16, K.span * fo / d)
      const s = Math.hypot(q.vx, q.vy, q.vz) || 1
      const [hx, hy, hd] = project(q.x + q.vx / s, q.y + q.vy / s, q.z + q.vz / s)
      let ax = hd > 0.3 ? hx - x : 0
      let ay = hd > 0.3 ? hy - y : -1
      const al = Math.hypot(ax, ay) || 1
      ax /= al
      ay /= al
      const px = -ay
      const py = ax
      const dive = q.phase === 'dive'
      const wx = dive ? 0.18 : 0.5
      const wb = dive ? 0.32 : 0.12
      const pt = (f, l) => [x + ax * f * span + px * l * span, y + ay * f * span + py * l * span]
      const shape = [pt(0.32, 0), pt(-wb, wx), pt(-0.1, 0.06), pt(-0.42, 0.05), pt(-0.42, -0.05), pt(-0.1, -0.06), pt(-wb, -wx)]
      g.globalAlpha = alpha
      g.fillStyle = 'rgb(28, 24, 26)'
      g.beginPath()
      g.moveTo(shape[0][0], shape[0][1])
      for (const v of shape.slice(1)) g.lineTo(v[0], v[1])
      g.closePath()
      g.fill()
      g.globalAlpha = 1
    }

    return {
      draw,

      // A drag holds a hawk's lure under the pointer, at the flock's
      // distance, and the starlings shy from it. A click: a peregrine
      // stoops on the bird nearest the click.
      pointer (kind, x, y, down) {
        if (!cw) return
        if (kind === 'down') press = { x0: x, y0: y, drag: false, t: W.clock, at: null }
        else if (press && down && Math.hypot(x - press.x0, y - press.y0) > 6) press.drag = true
        if (press && press.drag && down) {
          const c = centre()
          const D = Math.hypot(c.x, c.y, c.z - EYE)
          const [px, py, pz] = ray(x, y, D)
          const k = Math.max(RULE.substep, W.clock - press.t)
          const o = press.at || [px, py, pz]
          W.hold(px, py, pz, (px - o[0]) / k, (py - o[1]) / k, (pz - o[2]) / k)
          press.at = [px, py, pz]
          press.t = W.clock
        }
        if (kind !== 'up' || !press) return
        const p = press
        press = null
        W.release()
        if (p.drag || !flock.n) return
        let best = -1
        let bd = Infinity
        for (let i = 0; i < flock.n; i++) {
          const [sx, sy, d] = project(flock.pos[3 * i], flock.pos[3 * i + 1], flock.pos[3 * i + 2])
          if (d <= 0.3) continue
          const e = Math.hypot(sx - p.x0, sy - p.y0)
          if (e < bd) [best, bd] = [i, e]
        }
        if (best >= 0) W.attack('peregrine', best)
      },

      // For the live checks: the counts of the sky, the specks drawn and
      // the flock's centre on the pane.
      probe () {
        const c = centre()
        const [x, y] = cw ? project(c.x, c.y, c.z) : [0, 0]
        return Object.assign(W.count(), { specks: flock.n * SPECKS, at: [Math.round(x), Math.round(y)] })
      }
    }
  }

  if (typeof module === 'object' && module.exports) module.exports = { RULE, KIND, HOME, FLOCK, SPECKS, skyAt, world }
  else (root.VizCanvas = root.VizCanvas || {}).murmuration = create
})(this)
