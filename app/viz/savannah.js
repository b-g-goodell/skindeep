'use strict'
// Savannah hunt mode (decision 0015, issue #186): a herd of wildebeest
// with zebra among them on a dry plain, hunted by a lone cheetah, a
// pride of lions or a pack of wild dogs, seen from a helicopter above
// that tracks the herd. The herd and the predators move by the flocking
// core (flock.js): the herd grazes loose, bunches at a threat, streams
// in file in flight, and splits and wheels around an attack. The mode
// adds each hunt's plan: the cheetah stalks a straggler unseen and
// sprints, the lions take places around the herd and charge from all
// sides, the dogs run the herd openly and in relays, the lead dogs
// dropping back as they tire. Every predator gives up when its stamina
// is spent, rests and leaves, and a catch keeps the hunters at the kill.
//
// The camera looks down at 60 degrees from a long lens, so the view is
// near orthographic: the ground foreshortened by sin 60, heights by cos
// 60. It follows the herd and the chase, eased, and frames the herd.
// The ground: dry grass at two scales, game trails, acacias and bush,
// long shadows from a low sun, and dust where the herd runs. The
// signal, the clock and the pointer: see react, draw and pointer.

;(function (root) {
  const F = typeof module === 'object' && module.exports ? require('./flock') : root.VizFlock
  const TAU = Math.PI * 2
  const CLASS_HUE = [200, 120, 40, 0, 280, 320]
  // The herd: its size at rest and its most, and the share of zebra.
  const HERD = 180
  const CAP = 260
  const ZEBRA = 0.2
  // The herd's rule (flock.js), lengths in metres, times in seconds:
  // wildebeest graze some 5 m apart at under 1 m/s and flee at 16.
  // A wildebeest tires after some 20 s at a gallop, so a pack that runs
  // in relays wears it down.
  const RULE = { neighbours: { by: 'distance', r: 14 }, sep: 5, cruise: 0.8, flight: 16, sight: 55, endurance: 20, tire: 0.4 }
  // Each predator's top speed, steering limit, pace while it stalks or
  // trails, seconds of sprint, reach, and its share of the prey's sight
  // while it stalks.
  const KIND = {
    cheetah: { speed: 29, accel: 13, slow: 5, stamina: 14, reach: 1.6, hidden: 0.3, len: 2.1, body: '#c9a15a', size: 1 },
    lion: { speed: 19, accel: 9, slow: 5.5, stamina: 8, reach: 1.9, hidden: 0.35, len: 2.6, body: '#b98a4c', size: 1.25 },
    dog: { speed: 18.5, accel: 9, slow: 8, stamina: 9, reach: 1.4, hidden: 1, len: 1.5, body: '#5d4a33', size: 0.8 }
  }
  const KINDS = ['cheetah', 'lion', 'dog']
  // The camera's elevation and the sun's, radians.
  const ELEV = Math.PI / 3
  const FY = Math.sin(ELEV)
  const CZ = Math.cos(ELEV)
  // The trees' cell, metres.
  const CELL = 70

  // The tiles, made once for every pane: dry grass at 24 m a tile, and
  // patches of paler and darker ground at 600 m.
  let tiles = null
  function makeTiles (rnd) {
    const grass = document.createElement('canvas')
    grass.width = grass.height = 256
    const g = grass.getContext('2d', { willReadFrequently: true })
    g.fillStyle = '#bda36b'
    g.fillRect(0, 0, 256, 256)
    const blades = ['#c9b27c', '#b39a60', '#d6c38f', '#a68d56', '#8e7d4c', '#9c9a5e', '#cdb985']
    g.lineCap = 'round'
    for (let k = 0; k < 2600; k++) {
      const x = rnd() * 256
      const y = rnd() * 256
      const a = -Math.PI / 2 + (rnd() - 0.5) * 1.6
      const l = 2 + rnd() * 5
      g.strokeStyle = blades[Math.floor(rnd() * blades.length)]
      g.lineWidth = 0.8 + rnd() * 0.8
      for (const ox of [-256, 0, 256]) {
        for (const oy of [-256, 0, 256]) {
          if (x + ox < -8 || x + ox > 264 || y + oy < -8 || y + oy > 264) continue
          g.beginPath()
          g.moveTo(x + ox, y + oy)
          g.lineTo(x + ox + l * Math.cos(a), y + oy + l * Math.sin(a))
          g.stroke()
        }
      }
    }
    const patch = document.createElement('canvas')
    patch.width = patch.height = 256
    const p = patch.getContext('2d', { willReadFrequently: true })
    p.clearRect(0, 0, 256, 256)
    const tints = ['rgba(236, 220, 176, 0.55)', 'rgba(128, 104, 60, 0.45)', 'rgba(140, 140, 80, 0.45)', 'rgba(210, 172, 118, 0.5)']
    for (let k = 0; k < 40; k++) {
      const x = rnd() * 256
      const y = rnd() * 256
      const r = 12 + rnd() * 40
      const c = tints[Math.floor(rnd() * tints.length)]
      for (const ox of [-256, 0, 256]) {
        for (const oy of [-256, 0, 256]) {
          const gr = p.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r)
          gr.addColorStop(0, c)
          gr.addColorStop(1, c.replace(/[0-9.]+\)$/, '0)'))
          p.fillStyle = gr
          p.fillRect(x + ox - r, y + oy - r, 2 * r, 2 * r)
        }
      }
    }
    const dust = document.createElement('canvas')
    dust.width = dust.height = 64
    const d = dust.getContext('2d', { willReadFrequently: true })
    const gr = d.createRadialGradient(32, 32, 0, 32, 32, 32)
    gr.addColorStop(0, 'rgba(232, 204, 156, 0.9)')
    gr.addColorStop(0.5, 'rgba(222, 190, 140, 0.45)')
    gr.addColorStop(1, 'rgba(210, 180, 130, 0)')
    d.fillStyle = gr
    d.fillRect(0, 0, 64, 64)
    return { grass, patch, dust }
  }

  // A cell's trees and bushes, the same for the cell every time:
  // { x, y, h, r, acacia }.
  function cellTrees (ix, iy, seed) {
    const rnd = F.rng((Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ seed) >>> 0)
    const u = rnd()
    const n = u < 0.4 ? 0 : u < 0.78 ? 1 : u < 0.93 ? 2 : 3
    const out = []
    for (let k = 0; k < n; k++) {
      const acacia = rnd() < 0.4
      out.push({ x: (ix + rnd()) * CELL, y: (iy + rnd()) * CELL, acacia, h: acacia ? 5 + rnd() * 4 : 1.2 + rnd() * 1.4, r: acacia ? 3.5 + rnd() * 2.5 : 1.2 + rnd() * 1.8, tone: rnd() })
    }
    return out
  }

  // A small hash of an id to [0, 1).
  const hash = id => (Math.imul(id ^ 0x5bd1e995, 0x27d4eb2d) >>> 0) / 4294967296

  function create (canvas) {
    const out = canvas.getContext('2d')
    const layer = document.createElement('canvas')
    const g = layer.getContext('2d', { willReadFrequently: true })
    const seed = (Math.random() * 4294967296) >>> 0
    const rnd = F.rng(seed)
    if (!tiles) tiles = makeTiles(F.rng(20261022))
    const flock = new F.Flock({ dim: 2, cap: CAP, params: Object.assign({}, RULE, { drift: [0, 0, 0] }), rnd })
    // The ground, painted at the view's scale on a canvas a margin
    // larger than the pane and blitted each frame, painted again only
    // when the view leaves it or its scale or the shadows change: its
    // world corner, scale and shadows' length. And the light over the
    // whole, painted again when the dusk changes.
    const field = document.createElement('canvas')
    const fg = field.getContext('2d', { willReadFrequently: true })
    const grassFill = fg.createPattern(tiles.grass, 'repeat')
    const patchFill = fg.createPattern(tiles.patch, 'repeat')
    let laid = null
    const light = document.createElement('canvas')
    const lg = light.getContext('2d', { willReadFrequently: true })
    let lit = null
    const mark = {}
    // The world: the herd's slow drift, the wind, the sun's bearing.
    let heading = rnd() * TAU
    const wind = rnd() * TAU
    const sunAz = rnd() * TAU
    const trailSeed = seed
    // The camera: where it tracks, its scale in pixels a metre, the
    // pointer's pan, and the view as last drawn. North is up.
    const cam = { x: 0, y: 0, s: 3, px: 0, py: 0 }
    let view = null
    let cw = 0
    let ch = 0
    let clock = 0
    let calm = 0
    // Hunts, kills, dust, startles, stots, and the counts for the probe.
    const hunts = []
    const carcasses = []
    let dust = []
    const marks = []
    const stots = new Map()
    let started = 0
    let kills = 0
    let next = 8
    let refill = 0
    let press = null

    for (let i = 0; i < HERD; i++) {
      const a = rnd() * TAU
      const r = 35 * Math.sqrt(rnd())
      flock.add(r * Math.cos(a), r * Math.sin(a), 0, 0.05 * Math.cos(a + 1), 0.05 * Math.sin(a + 1), 0)
    }
    flock.step(12)

    const herd = () => flock.centre()

    // A predator of kind k at (x, y), in hunt h.
    function predator (k, x, y, h, o) {
      const K = KIND[k]
      const q = flock.hunter(Object.assign({ x, y, speed: K.slow, accel: K.accel, reach: K.reach, seen: K.hidden, range: 160, kind: k, hunt: h, phase: 'stalk', stamina: K.stamina, t0: clock, fa: 0 }, o))
      h.members.push(q)
      return q
    }

    function phase (q, p) {
      q.phase = p
      q.t0 = clock
      const K = KIND[q.kind]
      if (p === 'chase') {
        q.speed = K.speed
        q.seen = 1
        q.goal = null
      } else if (p === 'trail') {
        q.speed = 11
        q.target = -1
        q.seen = 1
      } else if (p === 'tired' || p === 'feed') {
        q.speed = p === 'tired' ? 1.5 : 3
        q.target = -1
        q.seen = 0.8
        q.goal = p === 'tired' ? { x: q.x + q.vx * 1.5, y: q.y + q.vy * 1.5 } : q.goal
      } else if (p === 'leave') {
        const c = herd()
        const a = Math.atan2(q.y - c.y, q.x - c.x)
        q.speed = 6
        q.target = -1
        q.seen = 0.5
        q.goal = { x: c.x + Math.cos(a) * 900, y: c.y + Math.sin(a) * 900 }
      }
    }

    // A hunt of kind k, its hunters entering from outside the view, or
    // from (x, y) at once in a sprint at the nearest animal.
    function hunt (k, at) {
      if (flock.predators.length > (at ? 15 : 9) || !flock.n) return null
      // Two hunts at most: the oldest still hunting gives up.
      const on = hunts.filter(h => h.members.some(hunting))
      if (on.length >= 2) for (const q of on[0].members) if (hunting(q)) phase(q, 'tired')
      const c = herd()
      const R = Math.max(30, 1.6 * c.r)
      const a = rnd() * TAU
      const h = { kind: k, members: [], t0: clock }
      hunts.push(h)
      started++
      if (at) {
        const q = predator('cheetah', at.x, at.y, h)
        flock.pick(q, 'edge')
        phase(q, 'chase')
      } else if (k === 'cheetah') {
        const q = predator(k, c.x + Math.cos(a) * (R + 70), c.y + Math.sin(a) * (R + 70), h)
        flock.pick(q, 'straggler')
      } else if (k === 'lion') {
        const n = 3 + (rnd() < 0.5 ? 1 : 0)
        for (let j = 0; j < n; j++) {
          const fa = a + (j - (n - 1) / 2) * TAU / n * 0.9
          predator(k, c.x + Math.cos(fa) * (R + 60 + 20 * rnd()), c.y + Math.sin(fa) * (R + 60 + 20 * rnd()), h, { phase: 'flank', fa })
        }
      } else {
        const n = 5 + (rnd() < 0.5 ? 1 : 0)
        for (let j = 0; j < n; j++) predator(k, c.x + Math.cos(a) * (R + 80) + 8 * (rnd() - 0.5), c.y + Math.sin(a) * (R + 80) + 8 * (rnd() - 0.5), h, { phase: 'approach' })
      }
      next = clock + 60 + 30 * rnd()
      return h
    }

    // One more hunter for the newest hunt still running, of its kind,
    // from outside the view: a lone cheetah's hunt when none runs.
    function join () {
      const h = [...hunts].reverse().find(h => h.members.some(hunting))
      if (!h) return hunt('cheetah')
      const c = herd()
      const a = rnd() * TAU
      const R = Math.max(30, 1.6 * c.r) + 100
      const q = predator(h.kind, c.x + Math.cos(a) * R, c.y + Math.sin(a) * R, h, { fa: a })
      flock.pick(q, h.kind === 'lion' ? 'middle' : 'straggler')
      if (h.members.some(m => m.phase === 'chase')) phase(q, 'chase')
      else if (h.kind !== 'cheetah') q.phase = h.members[0].phase
      return h
    }

    const hunting = q => q.phase !== 'feed' && q.phase !== 'leave' && q.phase !== 'tired'

    // Every hunter still closing in charges now: a stalking cheetah
    // breaks cover, the pride charges from where it stands, the pack's
    // two leaders run.
    function charge () {
      for (const h of hunts) {
        const wait = h.members.filter(q => q.phase === 'stalk' || q.phase === 'flank' || q.phase === 'approach')
        wait.forEach((q, j) => {
          if (q.kind === 'dog' && j >= 2) return phase(q, 'trail')
          flock.pick(q, q.kind === 'lion' && j === 0 ? 'middle' : q.kind === 'lion' ? 'edge' : 'straggler')
          phase(q, 'chase')
        })
      }
    }

    // Prey i's index by its id, or -1.
    function find (id) {
      for (let i = 0; i < flock.n; i++) if (flock.id[i] === id) return i
      return -1
    }

    // The session's events (decision 0015's table).
    function react (e) {
      const n = flock.n
      if (!n) return
      if (e.kind === 3) {
        hunt(KINDS[started % 3])
      } else if (e.kind === 2) {
        // A startle at an animal, marked in the class's colour.
        const i = Math.floor(rnd() * n)
        flock.fear[i] = Math.max(flock.fear[i], 0.5)
        marks.push({ id: flock.id[i], t: clock, hue: CLASS_HUE[e.cls] ?? 200 })
        if (marks.length > 12) marks.shift()
      } else if (e.kind === 4) {
        charge()
      } else if (e.kind === 5) {
        join()
      } else if (e.kind === 6) {
        // A stampede: the whole herd runs, turning away from its drift.
        for (let i = 0; i < n; i++) flock.fear[i] = Math.max(flock.fear[i], 0.8)
        heading += (rnd() < 0.5 ? -1 : 1) * Math.PI / 2
      } else {
        // An animal stots, kicking up dust.
        const i = Math.floor(rnd() * n)
        stots.set(flock.id[i], clock)
        puff(flock.pos[3 * i], flock.pos[3 * i + 1], 2, 1.5)
      }
    }

    function puff (x, y, k, r) {
      for (let j = 0; j < k; j++) dust.push({ x: x + (rnd() - 0.5) * 2, y: y + (rnd() - 0.5) * 2, z: 0.5, r: r * (0.6 + 0.8 * rnd()), t: clock, life: 2.5 + 2 * rnd() })
    }

    // The hunts' plans, each step of the clock.
    function plan (h, L) {
      const c = herd()
      const R = Math.max(30, 1.6 * c.r)
      for (const q of [...flock.predators]) {
        const K = KIND[q.kind]
        const age = clock - q.t0
        if (q.phase === 'stalk') {
          // Unseen, slow, at a straggler, until near or seen.
          if (q.target < 0) flock.pick(q, 'straggler')
          q.speed = K.slow
          const i = q.target
          const d = i >= 0 ? Math.hypot(flock.pos[3 * i] - q.x, flock.pos[3 * i + 1] - q.y) : Infinity
          if (d < 55 || (i >= 0 && flock.fear[i] > 0.5) || age > 50) phase(q, 'chase')
        } else if (q.phase === 'flank') {
          // Each lion to its place around the herd, then all charge.
          q.goal = { x: c.x + Math.cos(q.fa) * (R + 18), y: c.y + Math.sin(q.fa) * (R + 18) }
          q.target = -1
          const pride = q.hunt.members.filter(m => m.phase === 'flank')
          const placed = pride.every(m => !m.goal || Math.hypot(m.goal.x - m.x, m.goal.y - m.y) < 14)
          if (placed || age > 45 || nearFear(q, 22) > 0.5) {
            pride.forEach((m, j) => {
              flock.pick(m, j === 0 ? 'middle' : 'edge')
              phase(m, 'chase')
            })
          }
        } else if (q.phase === 'approach') {
          // The pack trots up openly, then two run at a straggler.
          q.goal = { x: c.x, y: c.y }
          q.speed = K.slow
          if (Math.hypot(c.x - q.x, c.y - q.y) < R + 40) {
            const pack = q.hunt.members.filter(m => m.phase === 'approach')
            pack.forEach((m, j) => {
              if (j < 2) {
                flock.pick(m, 'straggler')
                phase(m, 'chase')
              } else phase(m, 'trail')
            })
          }
        } else if (q.phase === 'chase') {
          q.stamina -= h
          if (q.target < 0) flock.pick(q, q.kind === 'lion' ? 'edge' : 'straggler')
          if (q.stamina <= 0) {
            // A dog hands the chase to the freshest dog trailing.
            const fresh = q.kind === 'dog' && q.hunt.members.filter(m => m.phase === 'trail' && m.stamina > 0.6 * K.stamina).sort((a, b) => b.stamina - a.stamina)[0]
            if (fresh && clock - q.hunt.t0 < 75) {
              fresh.target = q.target
              phase(fresh, 'chase')
              phase(q, 'trail')
            } else phase(q, 'tired')
          }
        } else if (q.phase === 'trail') {
          // Behind the dog running, getting its wind back.
          q.stamina = Math.min(K.stamina, q.stamina + 0.7 * h)
          const lead = q.hunt.members.find(m => m.phase === 'chase')
          if (lead) q.goal = { x: lead.x - lead.vx * 0.3, y: lead.y - lead.vy * 0.3 }
          else if (q.stamina > 0.6 * K.stamina && clock - q.hunt.t0 < 75) {
            flock.pick(q, 'straggler')
            phase(q, 'chase')
          } else phase(q, 'tired')
          if (q.phase === 'trail') q.speed = lead ? K.speed - 1 : 6
        } else if (q.phase === 'tired') {
          if (age > 12) phase(q, 'leave')
        } else if (q.phase === 'feed') {
          if (age > 30) phase(q, 'leave')
        } else if (q.phase === 'leave') {
          if (Math.hypot(q.x - c.x, q.y - c.y) > R + 220) drop(q)
        }
        // The session idle, every hunt rests.
        if (L.idle > 0.6 && hunting(q)) phase(q, 'tired')
      }
      for (let k = hunts.length - 1; k >= 0; k--) if (!hunts[k].members.length) hunts.splice(k, 1)
    }

    function drop (q) {
      flock.predators.splice(flock.predators.indexOf(q), 1)
      const m = q.hunt.members
      m.splice(m.indexOf(q), 1)
    }

    // The most fear among the prey within d of predator q.
    function nearFear (q, d) {
      let f = 0
      for (let i = 0; i < flock.n; i++) if (Math.abs(flock.pos[3 * i] - q.x) < d && Math.abs(flock.pos[3 * i + 1] - q.y) < d) f = Math.max(f, flock.fear[i])
      return f
    }

    // The world's clock advanced by h: the hunts' plans, the flock,
    // the catches, the dust, and the herd made whole again.
    function advance (h, L) {
      plan(h, L)
      const drift = (0.15 + 0.35 * Math.min(1, L.bass)) * (1 - L.idle)
      flock.p.drift = [Math.cos(heading) * drift, Math.sin(heading) * drift, 0]
      heading += 0.004 * h * Math.sin(clock / 47)
      for (const k of flock.step(h)) {
        kills++
        const q = k.q
        carcasses.push({ x: k.x, y: k.y, t: clock })
        puff(k.x, k.y, 6, 2.5)
        for (const m of q.hunt.members) {
          if (m.phase === 'leave') continue
          phase(m, 'feed')
          const a = rnd() * TAU
          m.goal = { x: k.x + Math.cos(a) * 1.8, y: k.y + Math.sin(a) * 1.8 }
        }
      }
      // Dust where the animals run.
      const P = flock.pos
      const V = flock.vel
      for (let i = 0; i < flock.n; i++) {
        const sp = Math.hypot(V[3 * i], V[3 * i + 1])
        if (sp > 7 && rnd() < (sp - 7) * 0.09 * h) puff(P[3 * i] - V[3 * i] * 0.1, P[3 * i + 1] - V[3 * i + 1] * 0.1, 1, 1.4)
      }
      for (const q of flock.predators) {
        const sp = Math.hypot(q.vx, q.vy)
        if (sp > 9 && rnd() < sp * 0.12 * h) puff(q.x, q.y, 1, 1.2)
      }
      const wv = 0.8 + 3.5 * Math.min(1, L.treble)
      for (const d of dust) {
        d.x += Math.cos(wind) * wv * h
        d.y += Math.sin(wind) * wv * h
        d.z += 0.35 * h
        d.r += 0.9 * h
      }
      dust = dust.filter(d => clock - d.t < d.life)
      if (dust.length > 320) dust.splice(0, dust.length - 320)
      for (let k = carcasses.length - 1; k >= 0; k--) if (clock - carcasses[k].t > 90) carcasses.splice(k, 1)
      for (const [id, t] of stots) if (clock - t > 1) stots.delete(id)
      // Stragglers from beyond join a thinned herd while nothing runs.
      if (flock.n < HERD && clock > refill && !flock.predators.some(q => q.phase === 'chase')) {
        const c = herd()
        const a = heading + Math.PI + (rnd() - 0.5) * 1.2
        const R = Math.max(30, 1.6 * c.r) + 70
        const k = 1 + Math.floor(rnd() * 3)
        for (let j = 0; j < k; j++) flock.add(c.x + Math.cos(a) * R + 4 * j, c.y + Math.sin(a) * R + 3 * j, 0, -Math.cos(a) * 3, -Math.sin(a) * 3, 0)
        refill = clock + 3 + 3 * rnd()
      }
      // A hunt now and then of its own, while the session works.
      if (clock > next && L.idle < 0.3) hunt(KINDS[started % 3])
      clock += h
    }

    // World to screen: [x, y] for a point at height z.
    function project (x, y, z) {
      const { s, cx, cy, ox, oy } = view
      return [cx + s * (x - ox), cy + s * FY * (y - oy) - s * CZ * (z || 0)]
    }

    // Screen to the world's ground.
    function unproject (x, y) {
      const { s, cx, cy, ox, oy } = view
      return { x: ox + (x - cx) / s, y: oy + (y - cy) / (s * FY) }
    }

    // The ground's transform on context c: world metres to pixels.
    function ground (c) {
      const { s, cx, cy, ox, oy } = view
      c.setTransform(s, 0, 0, s * FY, cx - s * ox, cy - s * FY * oy)
    }

    // The camera: on the herd and the hunters near it, its scale to
    // frame them, eased as a helicopter follows.
    function track (w, h, dt) {
      const c = herd()
      let x0 = c.x - Math.max(30, 1.6 * c.r)
      let x1 = c.x + Math.max(30, 1.6 * c.r)
      let y0 = c.y - Math.max(30, 1.6 * c.r)
      let y1 = c.y + Math.max(30, 1.6 * c.r)
      for (const q of flock.predators) {
        const d = Math.hypot(q.x - c.x, q.y - c.y)
        if (q.phase === 'leave' || d > 220 || (d > 130 && q.phase !== 'chase' && q.phase !== 'feed')) continue
        x0 = Math.min(x0, q.x - 12)
        x1 = Math.max(x1, q.x + 12)
        y0 = Math.min(y0, q.y - 12)
        y1 = Math.max(y1, q.y + 12)
      }
      const x = (x0 + x1) / 2
      const y = (y0 + y1) / 2
      const s = Math.max(0.5, Math.min(10, Math.min(w / (x1 - x0), h / (FY * (y1 - y0))) * 0.92))
      const k = 1 - Math.exp(-dt / 1.6)
      cam.x += (x - cam.x) * k
      cam.y += (y - cam.y) * k
      cam.s += (s - cam.s) * (1 - Math.exp(-dt / 2.5))
      if (!press || !press.drag) {
        const e = Math.exp(-dt / 3)
        cam.px *= e
        cam.py *= e
      }
      // The helicopter's sway, in pixels.
      const sx = 1.2 * Math.sin(clock * 0.37) + 0.7 * Math.sin(clock * 0.91)
      const sy = 1.0 * Math.sin(clock * 0.29 + 1) + 0.6 * Math.sin(clock * 0.83)
      view = { s: cam.s, cx: w / 2, cy: h / 2, ox: cam.x + cam.px + sx / cam.s, oy: cam.y + cam.py + sy / cam.s }
    }

    // The world box of the pixels [x0, x1] by [y0, y1].
    function box (x0, y0, x1, y1) {
      const a = unproject(x0, y0)
      const b = unproject(x1, y1)
      return [a.x, a.y, b.x, b.y]
    }

    // The game trails: three families of winding paths, each repeated
    // across the plain.
    function trails (g, bx) {
      const fam = [[0.3, 230], [1.9, 310], [2.7, 410]]
      g.lineCap = 'round'
      g.lineJoin = 'round'
      g.strokeStyle = 'rgba(226, 206, 160, 0.55)'
      g.lineWidth = 0.9
      g.beginPath()
      fam.forEach(([a0, D], j) => {
        const a = a0 + (trailSeed % 97) / 97
        const ux = Math.cos(a)
        const uy = Math.sin(a)
        let s0 = Infinity
        let s1 = -Infinity
        let l0 = Infinity
        let l1 = -Infinity
        for (const [x, y] of [[bx[0], bx[1]], [bx[2], bx[1]], [bx[0], bx[3]], [bx[2], bx[3]]]) {
          s0 = Math.min(s0, x * ux + y * uy)
          s1 = Math.max(s1, x * ux + y * uy)
          l0 = Math.min(l0, -x * uy + y * ux)
          l1 = Math.max(l1, -x * uy + y * ux)
        }
        for (let k = Math.floor((l0 - 40) / D); k <= Math.ceil((l1 + 40) / D); k++) {
          for (let s = Math.floor(s0 / 8) * 8, first = true; s <= s1 + 8; s += 8, first = false) {
            const l = k * D + 30 * Math.sin(s / 130 + k * 1.7 + j) + 12 * Math.sin(s / 45 + k) + 4 * Math.sin(s / 17 + 2 * k)
            const x = s * ux - l * uy
            const y = s * uy + l * ux
            if (first) g.moveTo(x, y)
            else g.lineTo(x, y)
          }
        }
      })
      g.stroke()
    }

    // An ellipse in the current path of g, its start joined to nothing.
    function oval (x, y, rx, ry, a, c = g) {
      c.moveTo(x + rx * Math.cos(a), y + rx * Math.sin(a))
      c.ellipse(x, y, rx, ry, a, 0, TAU)
    }

    // The ground's canvas, a quarter of the pane's larger side past each
    // edge: grass at two scales, the trails and the trees' shadows.
    function layGround (w, h, lenK, shx, shy, shA) {
      const m = Math.round(0.25 * Math.max(w, h))
      const s = view.s
      const o = unproject(-m, -m)
      laid = { x: o.x, y: o.y, s, lenK }
      field.width = w + 2 * m
      field.height = h + 2 * m
      const c = fg
      c.setTransform(1, 0, 0, 1, 0, 0)
      c.fillStyle = '#b79d66'
      c.fillRect(0, 0, field.width, field.height)
      c.setTransform(s, 0, 0, s * FY, -s * o.x, -s * FY * o.y)
      const bx = box(-m, -m, w + m, h + m)
      for (const [fill, k] of [[grassFill, 24 / 256], [patchFill, 600 / 256]]) {
        c.save()
        c.scale(k, k)
        c.fillStyle = fill
        c.fillRect(bx[0] / k, bx[1] / k, (bx[2] - bx[0]) / k, (bx[3] - bx[1]) / k)
        c.restore()
      }
      trails(c, bx)
      c.fillStyle = 'rgba(52, 36, 18, 0.36)'
      c.beginPath()
      for (let ix = Math.floor(bx[0] / CELL) - 1; ix <= Math.floor(bx[2] / CELL); ix++) {
        for (let iy = Math.floor(bx[1] / CELL) - 1; iy <= Math.floor(bx[3] / CELL); iy++) {
          for (const t of cellTrees(ix, iy, seed)) {
            const l = t.h * lenK
            if (t.acacia) {
              oval(t.x + shx * l * 0.55, t.y + shy * l * 0.55, t.r * 1.15, t.r * 0.85, shA, c)
              oval(t.x + shx * l * 0.25, t.y + shy * l * 0.25, l * 0.25, 0.4, shA, c)
            } else oval(t.x + shx * l * 0.5, t.y + shy * l * 0.5, l * 0.5 + t.r * 0.6, t.r * 0.8, shA, c)
          }
        }
      }
      c.fill()
    }

    function draw (synth, dt) {
      const w = canvas.width
      const h = canvas.height
      if (w < 4 || h < 4) return
      if (w !== cw || h !== ch) {
        cw = w
        ch = h
        layer.width = w
        layer.height = h
      }
      for (const e of synth.since(mark)) react(e)
      const L = synth.level
      // The clock: a little faster while busy, slowed nearly to a stop
      // as the session idles, as a film's slow motion.
      const speed = (0.8 + 0.2 * Math.min(1, L.bass) + 0.2 * L.busy) * (1 - 0.8 * L.idle)
      let left = Math.min(0.25, speed * dt)
      while (left > 1e-9) {
        const hh = Math.min(F.H, left)
        advance(hh, L)
        left -= hh
      }
      calm = L.idle
      track(w, h, dt)
      const s = view.s
      const bx = box(-30, -30, w + 30, h + 30)
      // The sun, lower as the session idles, and the shadows' run per
      // metre of height.
      const sunEl = (15 - 7 * calm) * Math.PI / 180
      const lenK = 1 / Math.tan(sunEl)
      const shx = -Math.cos(sunAz)
      const shy = -Math.sin(sunAz)
      const shA = Math.atan2(shy, shx)
      const trees = []
      for (let ix = Math.floor(bx[0] / CELL) - 1; ix <= Math.floor(bx[2] / CELL); ix++) {
        for (let iy = Math.floor(bx[1] / CELL) - 1; iy <= Math.floor(bx[3] / CELL); iy++) for (const t of cellTrees(ix, iy, seed)) trees.push(t)
      }

      // The ground, from its canvas, painted again when it no longer
      // covers the pane at about this scale.
      const at = laid && project(laid.x, laid.y, 0)
      const r = laid && s / laid.s
      if (!laid || Math.abs(r - 1) > 0.03 || Math.abs(lenK / laid.lenK - 1) > 0.03 || at[0] > 0 || at[1] > 0 || at[0] + field.width * r < w || at[1] + field.height * r < h) {
        layGround(w, h, lenK, shx, shy, shA)
      }
      const [fx, fy] = project(laid.x, laid.y, 0)
      const fr = s / laid.s
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.drawImage(field, fx, fy, field.width * fr, field.height * fr)

      // The animals' shadows, cast long by the low sun, and the kills.
      ground(g)
      const P = flock.pos
      const V = flock.vel
      g.fillStyle = `rgba(52, 36, 18, ${0.34 + 0.1 * calm})`
      g.beginPath()
      for (let i = 0; i < flock.n; i++) {
        const l = 1.3 * lenK
        oval(P[3 * i] + shx * l * 0.5, P[3 * i + 1] + shy * l * 0.5, l * 0.5 + 0.6, 0.45, shA)
      }
      for (const q of flock.predators) {
        const l = 0.9 * KIND[q.kind].size * lenK
        oval(q.x + shx * l * 0.5, q.y + shy * l * 0.5, l * 0.5 + 0.5, 0.35, shA)
      }
      g.fill()
      g.fillStyle = 'rgba(70, 30, 20, 0.85)'
      g.beginPath()
      for (const k of carcasses) oval(k.x, k.y, 1.1, 0.5, 0.7)
      g.fill()
      g.setTransform(1, 0, 0, 1, 0, 0)

      // The animals, back to front.
      const items = []
      for (let i = 0; i < flock.n; i++) {
        const [x, y] = project(P[3 * i], P[3 * i + 1], 0)
        if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue
        items.push([y, i, x])
      }
      items.sort((a, b) => a[0] - b[0])
      // A heading in the world to its angle on screen and its
      // foreshortening.
      const screenOf = (vx, vy) => [Math.atan2(FY * vy, vx), Math.hypot(vx, FY * vy) / (Math.hypot(vx, vy) || 1)]
      const legs = s > 3.2
      const groups = [[], [], []]
      for (const [y, i, x] of items) {
        const id = flock.id[i]
        const u = hash(id)
        const zebra = u < ZEBRA
        const sp = Math.hypot(V[3 * i], V[3 * i + 1])
        // Grazing, it faces its own way, the core's wander; running,
        // where it runs.
        const run = Math.min(1, sp / 1.5)
        const W = flock.wan
        const [a, k] = screenOf(run * V[3 * i] + (1 - run) * W[3 * i] * 0.5 + 1e-6, run * V[3 * i + 1] + (1 - run) * W[3 * i + 1] * 0.5)
        const st = stots.get(id)
        const hop = st !== undefined ? Math.abs(Math.sin((clock - st) * Math.PI / 0.45)) * 1.1 * (1 - (clock - st)) : 0
        const gait = flock.odo[i] / (sp > 4 ? 3.2 : 1.6) * TAU
        const bob = sp > 4 ? Math.abs(Math.sin(gait)) * 0.15 : 0
        groups[zebra ? 2 : u < 0.6 ? 0 : 1].push([x, y, a, k, 0.85 + 0.3 * hash(id + 7), hop + bob, gait, sp, zebra])
      }
      const bodies = ['#2f2924', '#3d342c', '#ddd8cc']
      // Legs first, under the bodies.
      if (legs) {
        g.strokeStyle = 'rgba(40, 32, 26, 0.9)'
        g.lineWidth = Math.max(0.6, 0.18 * s)
        g.beginPath()
        for (const set of groups) {
          for (const [x, y, a, k, z, up, gait] of set) {
            const L2 = 0.75 * z * s * k
            const ca = Math.cos(a)
            const sa = Math.sin(a)
            const top = y - (0.85 + up) * s * CZ
            const sw = 0.3 * Math.sin(gait) * s * k
            for (const [o, ph] of [[L2, 1], [-L2, -1]]) {
              g.moveTo(x + ca * o, top + sa * o)
              g.lineTo(x + ca * (o + sw * ph), y - up * s * CZ + sa * (o + sw * ph))
            }
          }
        }
        g.stroke()
      }
      groups.forEach((set, gi) => {
        if (!set.length) return
        g.fillStyle = bodies[gi]
        g.beginPath()
        for (const [x, y, a, k, z, up, , sp] of set) {
          const by = y - (0.85 + up) * s * CZ
          const rx = Math.max(1, 1.15 * z * s * k)
          const ry = Math.max(0.7, 0.42 * z * s)
          oval(x, by, rx, ry, a)
          // The head: down to the grass while grazing.
          const hx = x + Math.cos(a) * rx * 1.15
          const hy = by + Math.sin(a) * rx * 1.15 + (sp < 0.6 ? 0.45 * s * CZ : -0.15 * s * CZ)
          oval(hx, hy, Math.max(0.6, 0.36 * z * s), Math.max(0.5, 0.26 * z * s), a)
        }
        g.fill()
      })
      // Zebra's stripes, near enough to see.
      if (s > 5 && groups[2].length) {
        g.strokeStyle = 'rgba(30, 28, 26, 0.75)'
        g.lineWidth = Math.max(0.5, 0.12 * s)
        g.beginPath()
        for (const [x, y, a, k, z, up] of groups[2]) {
          const by = y - (0.85 + up) * s * CZ
          const ca = Math.cos(a)
          const sa = Math.sin(a)
          for (const o of [-0.7, -0.25, 0.2, 0.65]) {
            const px = x + ca * o * z * s * k
            const py = by + sa * o * z * s * k
            g.moveTo(px - sa * 0.35 * s, py + ca * 0.35 * s)
            g.lineTo(px + sa * 0.35 * s, py - ca * 0.35 * s)
          }
        }
        g.stroke()
      }

      // The predators, outlined so they read on the grass.
      for (const q of flock.predators) {
        const K = KIND[q.kind]
        const [x, y] = project(q.x, q.y, 0)
        const sp = Math.hypot(q.vx, q.vy)
        const [a, k] = screenOf(q.vx || 1e-6, q.vy)
        const rest = q.phase === 'tired' || q.phase === 'feed'
        const by = y - (rest && sp < 0.5 ? 0.25 : 0.7) * K.size * s * CZ
        const rx = Math.max(1.6, K.len / 2 * s * k * (sp > 12 ? 1.2 : 1))
        const ry = Math.max(0.9, 0.3 * K.size * s)
        g.fillStyle = K.body
        g.strokeStyle = 'rgba(30, 20, 10, 0.85)'
        g.lineWidth = Math.max(0.7, 0.12 * s)
        g.beginPath()
        oval(x, by, rx, ry, a)
        oval(x + Math.cos(a) * rx * 1.1, by + Math.sin(a) * rx * 1.1, Math.max(0.8, 0.3 * K.size * s), Math.max(0.7, 0.25 * K.size * s), a)
        g.fill()
        g.stroke()
        if (q.kind === 'dog') {
          // The white tip of a wild dog's tail.
          g.fillStyle = '#f2eee4'
          g.beginPath()
          oval(x - Math.cos(a) * rx * 1.35, by - Math.sin(a) * rx * 1.35, Math.max(0.6, 0.18 * s), Math.max(0.6, 0.18 * s), 0)
          g.fill()
        }
      }

      // The trees over what stands behind them.
      for (const t of trees) {
        const [x, y] = project(t.x, t.y, 0)
        const rr = t.r * s
        if (x < -rr * 2 || x > w + rr * 2 || y < -rr * 2 || y > h + t.h * s + rr * 2) continue
        const top = y - t.h * s * CZ
        if (t.acacia) {
          g.strokeStyle = '#4a3a28'
          g.lineWidth = Math.max(1, 0.35 * s)
          g.beginPath()
          g.moveTo(x, y)
          g.lineTo(x, top + rr * 0.2)
          g.stroke()
        }
        // The canopy: a flat crown of a few clumps, or a round bush,
        // lit on the sun's side.
        const tone = Math.round(62 + 30 * t.tone)
        const [lx, ly] = [Math.cos(sunAz), FY * Math.sin(sunAz)]
        const clumps = t.acacia ? 5 : 3
        const sq = t.acacia ? 0.5 : 0.75
        for (const [k, dx, dy, rs] of [[0, 0, 0, 1], [1, lx * 0.28, ly * 0.28 - 0.12, 0.62]]) {
          g.fillStyle = k ? `rgba(${tone + 62}, ${tone + 66}, ${tone + 8}, 0.6)` : `rgb(${tone - 18}, ${tone}, ${tone - 34})`
          g.beginPath()
          for (let j = 0; j < clumps; j++) {
            const a = j / clumps * TAU + t.tone * 9
            const o = j ? 0.5 : 0
            oval(x + (Math.cos(a) * o + dx) * rr, top + (Math.sin(a) * o * sq + dy) * rr, rr * rs * (j ? 0.55 : 0.7), rr * rs * (j ? 0.55 : 0.7) * sq, 0)
          }
          g.fill()
        }
      }

      // The dust, lit by the low sun.
      for (const d of dust) {
        const age = (clock - d.t) / d.life
        const [x, y] = project(d.x, d.y, d.z)
        const r = d.r * s
        if (x < -r || x > w + r || y < -r || y > h + r) continue
        g.globalAlpha = 0.5 * Math.sin(Math.PI * Math.min(1, age * 1.2 + 0.05)) * (1 - age)
        g.drawImage(tiles.dust, x - r, y - r, 2 * r, 2 * r)
      }
      g.globalAlpha = 1

      // The light: haze toward the far edge, dusk as the session
      // idles, the lens's vignette.
      if (!lit || lit.w !== w || lit.h !== h || Math.abs(lit.calm - calm) > 0.02) {
        lit = { w, h, calm }
        light.width = w
        light.height = h
        const haze = lg.createLinearGradient(0, 0, 0, h)
        haze.addColorStop(0, `rgba(255, 214, 150, ${0.22 + 0.1 * calm})`)
        haze.addColorStop(0.5, 'rgba(255, 214, 150, 0.04)')
        haze.addColorStop(1, 'rgba(80, 50, 20, 0.1)')
        lg.fillStyle = haze
        lg.fillRect(0, 0, w, h)
        if (calm > 0.01) {
          lg.fillStyle = `rgba(60, 20, 30, ${0.45 * calm})`
          lg.fillRect(0, 0, w, h)
        }
        const v = lg.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6)
        v.addColorStop(0, 'rgba(0, 0, 0, 0)')
        v.addColorStop(1, 'rgba(20, 10, 0, 0.45)')
        lg.fillStyle = v
        lg.fillRect(0, 0, w, h)
      }
      g.drawImage(light, 0, 0)

      // The tool calls' startles, a bracket in the class's colour.
      for (let k = marks.length - 1; k >= 0; k--) {
        const m = marks[k]
        const age = clock - m.t
        const i = age < 1.5 ? find(m.id) : -1
        if (i < 0) {
          marks.splice(k, 1)
          continue
        }
        const [x, y] = project(P[3 * i], P[3 * i + 1], 0.8)
        const r = 7 + 5 * age
        const e = r * 0.4
        g.strokeStyle = `hsla(${m.hue}, 90%, 62%, ${1 - age / 1.5})`
        g.lineWidth = 1.5
        g.beginPath()
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          g.moveTo(x + sx * r, y + sy * (r - e))
          g.lineTo(x + sx * r, y + sy * r)
          g.lineTo(x + sx * (r - e), y + sy * r)
        }
        g.stroke()
      }
      out.drawImage(layer, 0, 0)
    }

    return {
      draw,

      // A drag moves the helicopter over the plain, and it drifts back
      // to the herd after the release. A click: a cheetah breaks cover
      // where it lands and sprints at the nearest animal.
      pointer (kind, x, y, down) {
        if (kind === 'down') press = { x0: x, y0: y, x, y, drag: false }
        else if (press && down) {
          if (Math.hypot(x - press.x0, y - press.y0) > 6) press.drag = true
          if (press.drag && view) {
            cam.px -= (x - press.x) / view.s
            cam.py -= (y - press.y) / (view.s * FY)
          }
          press.x = x
          press.y = y
        }
        if (kind !== 'up' || !press) return
        const p = press
        press = null
        if (p.drag || !view) return
        hunt('cheetah', unproject(p.x0, p.y0))
      },

      // For the live checks: the herd, the predators, the hunts begun
      // and the kills.
      probe () {
        return { prey: flock.n, predators: flock.predators.length, hunts: started, kills, clock }
      }
    }
  }

  if (typeof module === 'object' && module.exports) module.exports = { KIND, RULE, HERD }
  else (root.VizCanvas = root.VizCanvas || {}).savannah = create
})(this)
