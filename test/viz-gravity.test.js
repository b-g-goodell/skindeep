'use strict'
// The Gravity mode's waves (decision 0015, issue #163): the Iddot of a
// circular binary in the plane oscillates at twice its orbital frequency
// with amplitude 2 mu a^2 Omega^2, a lone body moving uniformly gives
// none, and a pair stepped by the mode radiates at twice its orbital
// frequency, h_x nothing in its plane and h_+ there 2 m1 m2 / (c^4 a r).
const test = require('node:test')
const assert = require('node:assert')
const g = require('../app/viz/gravity')
const W = require('../app/viz/waves')

// Bodies of masses m1, m2 on a circular orbit of separation a about
// their centre of mass at the origin, at time t, Omega^2 = (m1 + m2) /
// a^3: places, velocities and accelerations, a = -Omega^2 x.
function binary (m1, m2, a, t, phase = 0) {
  const M = m1 + m2
  const w = Math.sqrt(M / a ** 3)
  const c = Math.cos(w * t + phase)
  const s = Math.sin(w * t + phase)
  return [[m1, m2 / M], [m2, -m1 / M]].map(([m, k]) => ({
    m,
    x: k * a * c,
    y: k * a * s,
    vx: -k * a * w * s,
    vy: k * a * w * c,
    ax: -k * a * w * w * c,
    ay: -k * a * w * w * s
  }))
}

test('gravity: a circular binary\'s Iddot oscillates at 2 Omega with amplitude 2 mu a^2 Omega^2', () => {
  for (const [m1, m2, a] of [[64, 64, 22], [900, 3, 60], [300, 120, 45]]) {
    const M = m1 + m2
    const w = Math.sqrt(M / a ** 3)
    const A = 2 * (m1 * m2 / M) * a * a * w * w
    for (let t = 0; t < 2 * Math.PI / w; t += 0.37) {
      const Q = g.quadrupole(binary(m1, m2, a, t, 0.4))
      const p = 2 * (w * t + 0.4)
      const want = [-A * Math.cos(p), A * Math.cos(p), 0, -A * Math.sin(p), 0, 0]
      Q.forEach((q, i) => assert.ok(Math.abs(q - want[i]) < 1e-9 * A, `${m1}+${m2} at ${a}, t ${t}, component ${i}: ${q}, want ${want[i]}`))
    }
  }
})

test('gravity: a lone body moving uniformly has no Iddot', () => {
  for (const b of [{ m: 900, x: 0, y: 0, vx: 0, vy: 0 }, { m: 3, x: 120, y: -40, vx: 1.7, vy: 0.3 }]) {
    const Q = g.quadrupole([{ ...b, ax: 0, ay: 0 }])
    assert.ok(Q.every(q => Math.abs(q) < 1e-12), JSON.stringify(Q))
  }
})

// The mode's seed pair, two stars of 64 at 22, stepped by the mode,
// sampled into a field as the mode samples it.
function stepped (T) {
  const a = 22
  const m = 64
  const v = Math.sqrt(2 * m * a * a / (a * a + 9) ** 1.5) / 2
  const bodies = [
    { x: a / 2, y: 0, vx: 0, vy: v, m, r: 8.4, ax: 0, ay: 0 },
    { x: -a / 2, y: 0, vx: 0, vy: -v, m, r: 8.4, ax: 0, ay: 0 }
  ]
  const field = new W.Field(g.C)
  const watch = new W.Watch(field, false)
  let t = 0
  while (t < T) {
    g.step(bodies, 0.25)
    t += 0.25
    watch.sample(t, field.sample(t, bodies))
  }
  return { bodies, field, watch, t, a, m }
}

test('gravity: a pair stepped by the mode radiates at twice its orbital frequency', () => {
  const { watch } = stepped(600)
  const r = watch.report()
  // Two cycles a turn, four sign changes, less the turn before the
  // first front reached the point.
  assert.ok(r.turns > 8, JSON.stringify(r))
  assert.ok(Math.abs(r.flips / r.turns - 4) < 0.6, `${r.flips} sign changes in ${r.turns} turns`)
})

test('gravity: in the plane h_x vanishes and h_+ is 2 m1 m2 / (c^4 a r)', () => {
  const { field, t, a, m } = stepped(120)
  const tr = [...field.traces.values()].find(x => x.live && field.traces.get('all') !== x)
  const h = [0, 0]
  const r = 1000
  const near = []
  tr.at(tr.last(), near)
  const f = (r * r / (r * r + near[3] ** 2)) ** 2
  // The softened pair's own Omega: v^2 / a with the softened pull.
  const want = 2 * m * m / (g.C ** 4 * a * r) * Math.pow(a * a / (a * a + 9), 1.5) * f
  let hp = 0
  let hx = 0
  for (let k = 0; k < 120; k++) {
    const ang = k / 120 * 2 * Math.PI
    assert.ok(field.wave(tr, t, r * Math.cos(ang), r * Math.sin(ang), 0, h))
    hp = Math.max(hp, Math.abs(h[0]))
    hx = Math.max(hx, Math.abs(h[1]))
  }
  assert.ok(hx < 1e-12 * hp, `h_x ${hx} in the plane`)
  assert.ok(Math.abs(hp / want - 1) < 0.02, `h_+ ${hp}, want ${want}`)
})
