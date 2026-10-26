'use strict'
// The flocking core of the flocking modes (decision 0015): a group holds
// together with no predator, prey within a predator's sight move away
// from it, and a predator closes on the target it picks, under the
// neighbour rule by distance and by rank. Seeded, so each run is the same.
const test = require('node:test')
const assert = require('node:assert')
const { Flock, DEFAULTS, rng } = require('../app/viz/flock')

const RULES = [{ by: 'distance', r: 14 }, { by: 'rank', k: 7, r: 30 }]

// n prey at rest in a disc (a ball in three dimensions) of radius R.
function herd (rule, seed, dim = 2, n = 120, R = 30) {
  const rnd = rng(seed)
  const f = new Flock({ dim, cap: n, rnd, params: { neighbours: rule } })
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2
    const b = dim === 3 ? Math.asin(2 * rnd() - 1) : 0
    const r = R * Math.cbrt(rnd())
    f.add(r * Math.cos(a) * Math.cos(b), r * Math.sin(a) * Math.cos(b), r * Math.sin(b), 0, 0, 0)
  }
  return f
}

const at = (f, i) => [f.pos[3 * i], f.pos[3 * i + 1], f.pos[3 * i + 2]]
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

// The groups of prey linked by chains of steps shorter than link.
function groups (f, link) {
  const up = Array.from({ length: f.n }, (_, i) => i)
  const root = i => (up[i] === i ? i : (up[i] = root(up[i])))
  for (let i = 0; i < f.n; i++) for (let j = i + 1; j < f.n; j++) if (dist(at(f, i), at(f, j)) < link) up[root(i)] = root(j)
  return new Set(up.map((_, i) => root(i))).size
}

for (const rule of RULES) {
  for (const dim of [2, 3]) {
    test(`flock: a group holds together with no predator, ${dim}D, by ${rule.by}`, () => {
      const f = herd(rule, 7, dim)
      const r0 = f.centre().r
      for (let t = 0; t < 120; t += 10) {
        f.step(10)
        assert.strictEqual(groups(f, 2 * DEFAULTS.sep + 4), 1, `split at ${t + 10} s`)
        const c = f.centre()
        assert.ok(c.r < 1.5 * r0, `spread to ${c.r.toFixed(1)} from ${r0.toFixed(1)} at ${t + 10} s`)
        if (dim === 2) for (let i = 0; i < f.n; i++) assert.strictEqual(f.pos[3 * i + 2], 0)
      }
      // At rest, not frozen: the prey still move about.
      let moved = 0
      for (let i = 0; i < f.n; i++) moved += f.odo[i]
      assert.ok(moved / f.n > 20, `ran ${(moved / f.n).toFixed(1)} each in 120 s`)
    })
  }

  test(`flock: prey within a predator's sight move away from it, by ${rule.by}`, () => {
    // The same herd twice from one seed: once with a predator standing
    // at the point, once without.
    const run = (with_) => {
      const f = herd(rule, 11)
      f.step(20)
      const c = f.centre()
      const spot = [c.x + c.r + 25, c.y, 0]
      if (with_) f.hunter({ x: spot[0], y: spot[1], speed: 0 })
      const seen = []
      for (let i = 0; i < f.n; i++) if (dist(at(f, i), spot) < DEFAULTS.sight) seen.push([f.id[i], dist(at(f, i), spot)])
      f.step(3)
      const now = new Map()
      for (let i = 0; i < f.n; i++) now.set(f.id[i], dist(at(f, i), spot))
      return seen.map(([id, d]) => now.get(id) - d)
    }
    const fled = run(true)
    const calm = run(false)
    assert.ok(fled.length >= 10, `only ${fled.length} prey in sight`)
    const mean = a => a.reduce((s, v) => s + v, 0) / a.length
    assert.ok(fled.every(d => d > 0), `${fled.filter(d => d <= 0).length} of ${fled.length} in sight came no farther`)
    assert.ok(mean(fled) > 10, `in sight, ${mean(fled).toFixed(1)} farther in 3 s`)
    assert.ok(Math.abs(mean(calm)) < 2, `with no predator, ${mean(calm).toFixed(1)} farther in 3 s`)
  })

  test(`flock: a predator closes on the target it picks, as a straggler, at the edge or in the middle, by ${rule.by}`, () => {
    for (const how of ['straggler', 'edge', 'middle']) {
      const f = herd(rule, 23)
      f.step(20)
      const c = f.centre()
      const q = f.hunter({ x: c.x + c.r + 70, y: c.y + 10, speed: 24, accel: 30, reach: 1.5 })
      const i = f.pick(q, how)
      assert.ok(i >= 0)
      const id = f.id[i]
      const from = at(f, i)
      // What each pick means, among the herd as it stands.
      const all = Array.from({ length: f.n }, (_, j) => j)
      const me = [q.x, q.y, q.z]
      if (how === 'edge') assert.ok(all.every(j => dist(at(f, j), me) >= dist(from, me)), 'edge: not the nearest')
      if (how === 'middle') assert.ok(all.every(j => dist(at(f, j), [c.x, c.y, 0]) >= dist(from, [c.x, c.y, 0]) - 1e-9), 'middle: not the nearest the centre')
      if (how === 'straggler') {
        const lone = all.map(j => f.lone[j]).sort((a, b) => a - b)
        assert.ok(f.lone[i] >= lone[Math.floor(f.n / 2)], `straggler: ${f.lone[i].toFixed(1)} from its neighbours, the median ${lone[Math.floor(f.n / 2)].toFixed(1)}`)
        assert.ok(dist(from, [c.x, c.y, 0]) > c.r, 'straggler: inside the group')
      }
      // Closer at every look, till it takes the target.
      let last = dist(from, me)
      let taken = null
      for (let t = 0; t < 30 && !taken; t += 0.5) {
        const got = f.step(0.5)
        taken = got.find(g => g.id === id)
        if (taken) break
        assert.strictEqual(f.id[q.target], id, `${how}: lost its target`)
        const d = dist(at(f, q.target), [q.x, q.y, q.z])
        assert.ok(d < last, `${how}: ${d.toFixed(1)} from the target at ${t + 0.5} s, ${last.toFixed(1)} before`)
        last = d
      }
      assert.ok(taken, `${how}: not taken in 30 s, ${last.toFixed(1)} away`)
      assert.strictEqual(taken.q, q)
      assert.strictEqual(f.n, 119)
      assert.strictEqual(q.target, -1)
    }
  })
}

test('flock: a removed prey leaves the predators\' targets on the same prey', () => {
  const f = herd(RULES[0], 3, 2, 10, 10)
  const a = f.hunter({})
  const b = f.hunter({})
  a.target = 9
  b.target = 4
  const id9 = f.id[9]
  f.remove(4)
  assert.strictEqual(b.target, -1)
  assert.strictEqual(a.target, 4)
  assert.strictEqual(f.id[4], id9)
})
