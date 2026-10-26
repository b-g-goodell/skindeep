'use strict'
// The flocking core under the Bait ball's rule (decision 0015, issue
// #188): 700 sardines in open water, each following its nearest seven.
// The mode's water keeps its school whole with no predator, fish within
// a predator's sight move away from it, a predator closes on the fish it
// picks, and under attack the school packs into a ball that never
// breaks the surface. Seeded.
const test = require('node:test')
const assert = require('node:assert')
const { Flock, rng } = require('../app/viz/flock')
const { RULE, HOME, SURF, SCHOOL, world } = require('../app/viz/baitball')

// The school as the mode starts it: a ball about home, cruising.
function school (seed) {
  const rnd = rng(seed)
  const f = new Flock({ dim: 3, cap: SCHOOL + 10, rnd, params: Object.assign({}, RULE, { drift: [0, 0, 0], bounds: Object.assign({}, RULE.bounds) }) })
  for (let i = 0; i < SCHOOL; i++) {
    const a = rnd() * Math.PI * 2
    const b = Math.asin(2 * rnd() - 1)
    const r = 5 * Math.cbrt(rnd())
    f.add(HOME.x + r * Math.cos(a) * Math.cos(b), HOME.y + r * Math.sin(a) * Math.cos(b), HOME.z + 0.6 * r * Math.sin(b), 1, 0, 0)
  }
  f.step(6)
  return f
}

const at = (f, i) => [f.pos[3 * i], f.pos[3 * i + 1], f.pos[3 * i + 2]]
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const mean = a => a.reduce((s, v) => s + v, 0) / a.length

// The groups of fish linked by chains of steps shorter than link.
function groups (f, link) {
  const up = Array.from({ length: f.n }, (_, i) => i)
  const root = i => (up[i] === i ? i : (up[i] = root(up[i])))
  for (let i = 0; i < f.n; i++) for (let j = i + 1; j < f.n; j++) if (dist(at(f, i), at(f, j)) < link) up[root(i)] = root(j)
  const size = new Map()
  for (let i = 0; i < f.n; i++) size.set(root(i), (size.get(root(i)) || 0) + 1)
  return [...size.values()].sort((a, b) => b - a)
}

// The median distance of the fish from the school's centre.
function median (f) {
  const c = f.centre()
  const d = []
  for (let i = 0; i < f.n; i++) d.push(dist(at(f, i), [c.x, c.y, c.z]))
  d.sort((a, b) => a - b)
  return d[d.length >> 1]
}

test('baitball: the school holds together in open water with no predator', () => {
  // The mode's own water, the session quiet enough that no attack comes.
  const w = world(rng(7))
  const f = w.flock
  const L = { bass: 0.5, treble: 0.5, busy: 0, idle: 0.5 }
  for (let t = 0; t < 60; t += 10) {
    for (let k = 0; k < 200; k++) w.advance(0.05, L)
    const g = groups(f, 2)
    assert.ok(g[0] >= SCHOOL - 3, `split at ${t + 10} s: ${g.slice(0, 4).join('/')}`)
    const c = f.centre()
    const off = Math.hypot(c.x - HOME.x, c.y - HOME.y)
    assert.ok(off < 12 && Math.abs(c.z - HOME.z) < 4, `the school's centre ${off.toFixed(1)} m from home, ${(c.z - HOME.z).toFixed(1)} m above, at ${t + 10} s`)
    assert.ok(c.r < 7, `spread to ${c.r.toFixed(1)} m at ${t + 10} s`)
  }
  assert.strictEqual(w.count().predators, 0)
  // Cruising, not frozen.
  let sp = 0
  for (let i = 0; i < f.n; i++) sp += Math.hypot(f.vel[3 * i], f.vel[3 * i + 1], f.vel[3 * i + 2])
  assert.ok(sp / f.n > 0.5 && sp / f.n <= RULE.cruise + 0.2, `mean speed ${(sp / f.n).toFixed(2)}`)
})

test('baitball: fish within a predator\'s sight move away from it', () => {
  // The same school twice from one seed: once with a predator hanging at
  // its middle, once without, each fish in sight measured from it.
  const run = (predator) => {
    const f = school(11)
    const c = f.centre()
    const spot = [c.x, c.y, c.z]
    if (predator) f.hunter({ x: spot[0], y: spot[1], z: spot[2], speed: 0 })
    const seen = []
    for (let i = 0; i < f.n; i++) if (dist(at(f, i), spot) < RULE.sight) seen.push([f.id[i], dist(at(f, i), spot)])
    f.step(1)
    const now = new Map()
    for (let i = 0; i < f.n; i++) now.set(f.id[i], dist(at(f, i), spot))
    return seen.map(([id, d]) => now.get(id) - d)
  }
  const fled = run(true)
  const calm = run(false)
  assert.ok(fled.length >= 100, `only ${fled.length} fish in sight`)
  assert.ok(fled.filter(d => d > 0).length >= 0.9 * fled.length, `${fled.filter(d => d <= 0).length} of ${fled.length} in sight came no farther`)
  assert.ok(mean(fled) > mean(calm) + 1.5, `in sight, ${mean(fled).toFixed(2)} m farther in 1 s, ${mean(calm).toFixed(2)} with no predator`)
})

test('baitball: a predator closes on the fish it picks and takes it', () => {
  for (const how of ['edge', 'middle', 'straggler']) {
    const f = school(23)
    const c = f.centre()
    const q = f.hunter({ x: c.x + 25, y: c.y + 5, z: c.z - 6, speed: 9, accel: 22, reach: 0.6 })
    const i = f.pick(q, how)
    assert.ok(i >= 0)
    const id = f.id[i]
    let last = dist(at(f, i), [q.x, q.y, q.z])
    let taken = null
    for (let t = 0; t < 20 && !taken; t += 0.25) {
      taken = f.step(0.25).find(g => g.id === id)
      if (taken) break
      const d = dist(at(f, q.target), [q.x, q.y, q.z])
      assert.ok(d < last, `${how}: ${d.toFixed(1)} m from its fish at ${t + 0.25} s, ${last.toFixed(1)} before`)
      last = d
    }
    assert.ok(taken, `${how}: not taken in 20 s, ${last.toFixed(1)} m away`)
    assert.strictEqual(f.n, SCHOOL - 1)
  }
})

test('baitball: under attack the school packs into a ball below the surface', () => {
  // A pod of dolphins at the mode's school, the session busy enough that
  // they hunt, quiet enough that no other attack starts.
  const w = world(rng(7))
  const f = w.flock
  const L = { bass: 0.5, treble: 0.5, busy: 0.5, idle: 0.35 }
  for (let k = 0; k < 100; k++) w.advance(0.05, L)
  const rest = median(f)
  w.attack('pod')
  let tight = Infinity
  let top = -Infinity
  for (let k = 0; k < 800; k++) {
    w.advance(0.05, L)
    for (let i = 0; i < f.n; i++) top = Math.max(top, f.pos[3 * i + 2])
    if (k % 20 === 19) tight = Math.min(tight, median(f))
  }
  assert.ok(tight < 0.6 * rest, `packed to a median of ${tight.toFixed(2)} m from ${rest.toFixed(2)} at rest`)
  assert.ok(top <= SURF + 1e-9, `a fish at ${top.toFixed(2)} m, above ${SURF}`)
  assert.ok(w.count().eaten > 0, 'the pod ate nothing in 40 s')
})
