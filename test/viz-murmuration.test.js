'use strict'
// The flocking core under the Murmuration's rule (decision 0015, issue
// #187): 600 birds in space, each following its nearest seven, with the
// longer substep and the neighbours searched every third substep. The
// mode's sky keeps its flock whole with no falcon, birds within a
// falcon's sight move away from it, a falcon closes on the bird it
// picks, and a push the mode sets turns the birds it is set on. Seeded.
const test = require('node:test')
const assert = require('node:assert')
const { Flock, rng } = require('../app/viz/flock')
const core = require('../app/viz/flock')
const { RULE, HOME, FLOCK, world, create } = require('../app/viz/murmuration')

// The flock as the mode starts it: a disc over the clearing, flying.
function flock (seed) {
  const rnd = rng(seed)
  const f = new Flock({ dim: 3, cap: FLOCK + 10, rnd, params: Object.assign({}, RULE, { bounds: Object.assign({}, RULE.bounds) }) })
  for (let i = 0; i < FLOCK; i++) {
    const a = rnd() * Math.PI * 2
    const r = 30 * Math.sqrt(rnd())
    f.add(HOME.x + r * Math.cos(a), HOME.y + r * Math.sin(a), HOME.z + (rnd() - 0.5) * 6, 10, 0, 0)
  }
  f.step(8)
  return f
}

const at = (f, i) => [f.pos[3 * i], f.pos[3 * i + 1], f.pos[3 * i + 2]]
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

// The groups of birds linked by chains of steps shorter than link.
function groups (f, link) {
  const up = Array.from({ length: f.n }, (_, i) => i)
  const root = i => (up[i] === i ? i : (up[i] = root(up[i])))
  for (let i = 0; i < f.n; i++) for (let j = i + 1; j < f.n; j++) if (dist(at(f, i), at(f, j)) < link) up[root(i)] = root(j)
  const size = new Map()
  for (let i = 0; i < f.n; i++) size.set(root(i), (size.get(root(i)) || 0) + 1)
  return [...size.values()].sort((a, b) => b - a)
}

test('murmuration: the flock holds together over the clearing with no falcon', () => {
  // The mode's own sky, its waves of turning wheeling the flock about
  // its home, the session quiet enough that no falcon comes.
  const w = world(rng(7))
  const f = w.flock
  const L = { bass: 0.5, treble: 0.5, busy: 0, idle: 0.5 }
  for (let t = 0; t < 60; t += 10) {
    for (let k = 0; k < 200; k++) w.advance(0.05, L)
    const g = groups(f, 6)
    // A bird or two may stray from the rest for a moment.
    assert.ok(g[0] >= FLOCK - 3, `split at ${t + 10} s: ${g.slice(0, 4).join('/')}`)
    const c = f.centre()
    const off = Math.hypot(c.x - HOME.x, c.y - HOME.y)
    assert.ok(off < 35 && Math.abs(c.z - HOME.z) < 15, `the flock's centre ${off.toFixed(1)} m from home, ${(c.z - HOME.z).toFixed(1)} m above, at ${t + 10} s`)
    assert.ok(c.r < 30, `spread to ${c.r.toFixed(1)} m at ${t + 10} s`)
  }
  assert.strictEqual(w.count().falcons, 0)
  assert.ok(w.count().waves >= 5, `${w.count().waves} waves of turning in 60 s`)
  // Flying, at the starlings' speed.
  let sp = 0
  for (let i = 0; i < f.n; i++) sp += Math.hypot(f.vel[3 * i], f.vel[3 * i + 1], f.vel[3 * i + 2])
  assert.ok(sp / f.n >= RULE.minSpeed && sp / f.n <= RULE.cruise + 1, `mean speed ${(sp / f.n).toFixed(1)}`)
})

test('murmuration: birds within a falcon\'s sight move away from it', () => {
  // The same flock twice from one seed: once with a falcon hanging at
  // its middle, once without, each bird in sight measured from it.
  const run = (falcon) => {
    const f = flock(11)
    const c = f.centre()
    const spot = [c.x, c.y, c.z]
    if (falcon) f.hunter({ x: spot[0], y: spot[1], z: spot[2], speed: 0 })
    const seen = []
    for (let i = 0; i < f.n; i++) if (dist(at(f, i), spot) < RULE.sight) seen.push([f.id[i], dist(at(f, i), spot)])
    f.step(0.6)
    const now = new Map()
    for (let i = 0; i < f.n; i++) now.set(f.id[i], dist(at(f, i), spot))
    return seen.map(([id, d]) => now.get(id) - d)
  }
  const fled = run(true)
  const calm = run(false)
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length
  assert.ok(fled.length >= 20, `only ${fled.length} birds in sight`)
  assert.ok(fled.filter(d => d > 0).length >= 0.9 * fled.length, `${fled.filter(d => d <= 0).length} of ${fled.length} in sight came no farther`)
  assert.ok(mean(fled) > mean(calm) + 2, `in sight, ${mean(fled).toFixed(1)} m farther in 0.6 s, ${mean(calm).toFixed(1)} with no falcon`)
})

test('murmuration: a falcon closes on the bird it picks and takes it', () => {
  for (const how of ['edge', 'middle', 'straggler']) {
    const f = flock(23)
    const c = f.centre()
    const q = f.hunter({ x: c.x + 40, y: c.y, z: c.z + 60, speed: 24, accel: 70, reach: 0.8 })
    const i = f.pick(q, how)
    assert.ok(i >= 0)
    const id = f.id[i]
    let last = dist(at(f, i), [q.x, q.y, q.z])
    let taken = null
    for (let t = 0; t < 20 && !taken; t += 0.25) {
      taken = f.step(0.25).find(g => g.id === id)
      if (taken) break
      const d = dist(at(f, q.target), [q.x, q.y, q.z])
      assert.ok(d < last, `${how}: ${d.toFixed(1)} m from its bird at ${t + 0.25} s, ${last.toFixed(1)} before`)
      last = d
    }
    assert.ok(taken, `${how}: not taken in 20 s, ${last.toFixed(1)} m away`)
    assert.strictEqual(f.n, FLOCK - 1)
  }
})

test('murmuration: a push about the vertical turns the birds it is set on', () => {
  const f = flock(5)
  const heading = (i) => Math.atan2(f.vel[3 * i + 1], f.vel[3 * i])
  const before = Array.from({ length: f.n }, (_, i) => heading(i))
  // Half the flock pushed to its left, as a wave of turning sets it.
  for (let k = 0; k < 10; k++) {
    for (let i = 0; i < f.n; i += 2) {
      const s = Math.hypot(f.vel[3 * i], f.vel[3 * i + 1]) || 1
      f.push[3 * i] = -1.6 * f.vel[3 * i + 1] / s
      f.push[3 * i + 1] = 1.6 * f.vel[3 * i] / s
      f.push[3 * i + 2] = 0
    }
    f.step(0.05)
  }
  const turn = (i) => {
    let d = heading(i) - before[i]
    while (d > Math.PI) d -= 2 * Math.PI
    while (d < -Math.PI) d += 2 * Math.PI
    return d
  }
  let pushed = 0
  let rest = 0
  for (let i = 0; i < f.n; i++) {
    if (i % 2 === 0) pushed += turn(i)
    else rest += turn(i)
  }
  pushed /= Math.ceil(f.n / 2)
  rest /= Math.floor(f.n / 2)
  assert.ok(pushed > 0.4, `pushed, turned ${pushed.toFixed(2)} rad left in 0.5 s`)
  assert.ok(pushed > rest + 0.2, `pushed ${pushed.toFixed(2)} rad, the rest ${rest.toFixed(2)}`)
})

// A canvas that draws nothing, and the mode on one with its flock,
// caught as the mode makes it. The mode paints its forest on canvases
// of its own, so the test lends it a document.
function canvas (w, h) {
  const g = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : k === 'measureText' ? () => ({ width: 1 }) : () => ({ addColorStop () {} })),
    set: (t, k, v) => { t[k] = v; return true }
  })
  return { width: w, height: h, style: {}, getContext: () => g }
}

function pane (w, h) {
  const Flock = core.Flock
  let f = null
  core.Flock = class extends Flock { constructor (o) { super(o); f = this } }
  try {
    return { r: create(canvas(w, h)), f }
  } finally {
    core.Flock = Flock
  }
}

test('murmuration: a drag\'s lure stays under the pointer while it rests', () => {
  const doc = global.document
  global.document = { createElement: () => canvas(300, 150) }
  try {
    const { r, f } = pane(800, 600)
    const synth = { level: { bass: 0.5, treble: 0.5, busy: 0.5, idle: 0 }, since: () => [] }
    for (let k = 0; k < 30; k++) r.draw(synth, 1 / 60)
    const lure = () => f.predators.find(q => q.phase === 'lure')
    const speed = q => Math.hypot(q.vx, q.vy, q.vz)
    // A drag across the pane, a move a draw.
    r.pointer('down', 400, 300, true)
    let x = 400
    for (let k = 0; k < 20; k++) {
      x += 8
      r.pointer('move', x, 300, true)
      r.draw(synth, 1 / 60)
    }
    const q = lure()
    assert.ok(q, 'no lure on the drag')
    assert.ok(speed(q) > 0.5, `the dragged lure moves at ${speed(q).toFixed(2)} m/s`)
    // Two moves within one draw: the lure goes to the second, at a
    // velocity no larger than the step over a substep.
    r.pointer('move', x + 8, 300, true)
    const a = [q.x, q.y, q.z]
    r.pointer('move', x + 16, 300, true)
    const held = [q.x, q.y, q.z]
    const step = dist(a, held)
    assert.ok(speed(q) <= step / RULE.substep + 1e-9, `two moves in a draw: ${speed(q).toFixed(1)} m/s for ${step.toFixed(2)} m`)
    // The pointer held still 2 s.
    for (let k = 0; k < 120; k++) r.draw(synth, 1 / 60)
    assert.strictEqual(lure(), q)
    assert.ok(dist([q.x, q.y, q.z], held) < 1, `the lure ${dist([q.x, q.y, q.z], held).toFixed(1)} m from the held point after 2 s still`)
    assert.ok(speed(q) < 0.5, `the resting lure moves at ${speed(q).toFixed(2)} m/s`)
    r.pointer('up', x + 16, 300, false)
    assert.strictEqual(lure(), undefined)
  } finally {
    if (doc === undefined) delete global.document
    else global.document = doc
  }
})
