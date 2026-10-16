'use strict'
// The Gravity 3D mode's physics (decision 0015): orbits about a black
// hole hold past its last stable circular orbit at 3 r_s and fall in from
// within, what crosses the horizon is swallowed with its mass and
// momentum kept, and a spinning hole drags an orbit's plane round in its
// own sense at the Lense-Thirring rate.
const test = require('node:test')
const assert = require('node:assert')
const g = require('../app/viz/gravity3d')

const M = 900
const RS = g.rs(M)

function hole (chi = 0, j = [0, 0, 1]) {
  const h = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, m: M, hole: true, chi, jx: j[0], jy: j[1], jz: j[2] }
  h.r = g.horizon(h)
  return h
}

// A body of mass m on an orbit at k r_s, at scale times the circular
// speed, inclined by inc.
function orbiter (h, k, scale, m = 1e-3, inc = 0) {
  const r = k * RS
  const v = g.circular(h, r) * scale
  return { x: r, y: 0, z: 0, vx: 0, vy: v * Math.cos(inc), vz: v * Math.sin(inc), m, r: 1 }
}

const period = k => 2 * Math.PI * k * RS / g.circular(hole(), k * RS)
const momentum = bodies => ['vx', 'vy', 'vz'].map(c => bodies.reduce((p, b) => p + b.m * b[c], 0))

test('gravity3d: the horizon is r_s at rest and shrinks toward r_s / 2 with spin', () => {
  assert.ok(Math.abs(g.horizon(hole()) - RS) < 1e-9)
  assert.ok(Math.abs(g.horizon(hole(0.6)) - RS / 2 * 1.8) < 1e-9, 'r_+ = M / c^2 (1 + sqrt(1 - 0.36))')
  assert.ok(g.horizon(hole(g.CHI_MAX)) > RS / 2 && g.horizon(hole(g.CHI_MAX)) < 0.7 * RS)
})

test('gravity3d: the circular orbits\' angular momentum is least at 3 r_s, the last stable orbit', () => {
  const h = hole()
  const L = r => r * g.circular(h, r)
  let best = 0
  for (let k = 2.2; k < 6; k += 0.001) if (!best || L(k * RS) < L(best * RS)) best = k
  assert.ok(Math.abs(best - 3) < 0.002, `least at ${best} r_s`)
})

test('gravity3d: an orbit nudged inward holds past 3 r_s and falls in from within', () => {
  for (const k of [3.3, 4, 6]) {
    const h = hole()
    const b = orbiter(h, k, 0.999)
    const bodies = [h, b]
    let lo = Infinity
    let hi = 0
    for (let t = 0; t < 30 * period(k); t += 0.25) {
      g.step(bodies, 0.25)
      const d = Math.hypot(b.x - h.x, b.y - h.y, b.z - h.z) / RS
      lo = Math.min(lo, d)
      hi = Math.max(hi, d)
    }
    assert.strictEqual(bodies.length, 2, `swallowed from ${k} r_s`)
    assert.ok(lo > 3 && hi < k * 1.01, `at ${k} r_s it ranged ${lo} to ${hi} r_s`)
  }
  for (const k of [2.5, 2.9]) {
    const h = hole()
    const b = orbiter(h, k, 0.999, 1)
    const bodies = [h, b]
    const p0 = momentum(bodies)
    let t = 0
    while (bodies.length === 2 && t < 30 * period(k)) {
      g.step(bodies, 0.25)
      t += 0.25
    }
    assert.deepStrictEqual(bodies, [h], `not swallowed from ${k} r_s`)
    assert.ok(t < 5 * period(k), `${t} to fall from ${k} r_s`)
    assert.strictEqual(h.m, M + 1)
    momentum(bodies).forEach((p, i) => assert.ok(Math.abs(p - p0[i]) < 1e-9, `momentum ${p0} became ${momentum(bodies)}`))
  }
})

test('gravity3d: a body past the horizon is swallowed at once, its mass and momentum kept', () => {
  const h = hole(0.5)
  const b = { x: 0.6 * RS, y: 0, z: 0.1 * RS, vx: 1, vy: -2, vz: 0.5, m: 7, r: 1 }
  const p0 = momentum([h, b])
  const bodies = [h, b]
  const { swallowed } = g.step(bodies, 0.25)
  assert.deepStrictEqual(bodies, [h])
  assert.strictEqual(swallowed.length, 1)
  assert.strictEqual(h.m, M + 7)
  assert.ok(Math.abs(g.horizon(h) - g.horizon({ m: M + 7, chi: h.chi })) < 1e-9, 'the horizon grows with the mass')
  momentum(bodies).forEach((p, i) => assert.ok(Math.abs(p - p0[i]) < 1e-9, `momentum ${p0} became ${momentum(bodies)}`))
  // A dust grain past it too.
  const dust = [{ x: 0.5 * RS, y: 0, z: 0, vx: 0, vy: 0, vz: 0, hue: 0 }]
  const eaten = g.fall(dust, bodies, 0.25)
  assert.ok(dust[0].gone && eaten.get(h) === 1 && h.m > M + 7)
})

// The orbit's angular momentum turns about the spin axis: its node
// advances in the spin's sense at about 2 G J / (c^2 r^3), the
// Lense-Thirring rate, J = chi M^2 / c.
test('gravity3d: a spinning hole drags an inclined orbit round in its own sense', () => {
  const k = 8
  const T = 10 * period(k)
  const lt = 2 * 0.9 * M * M / (g.C ** 3 * (k * RS) ** 3) * T
  for (const sense of [1, -1, 0]) {
    const h = hole(sense ? 0.9 : 0, [0, 0, sense || 1])
    const b = orbiter(h, k, 1, 1e-3, Math.PI / 3)
    const bodies = [h, b]
    const node = () => Math.atan2((b.z - h.z) * (b.vx - h.vx) - (b.x - h.x) * (b.vz - h.vz), (b.y - h.y) * (b.vz - h.vz) - (b.z - h.z) * (b.vy - h.vy))
    let last = node()
    let turned = 0
    for (let t = 0; t < T; t += 0.25) {
      g.step(bodies, 0.25)
      const n = node()
      turned += Math.atan2(Math.sin(n - last), Math.cos(n - last))
      last = n
    }
    if (!sense) assert.ok(Math.abs(turned) < 1e-6, `no spin, the node turned ${turned}`)
    else assert.ok(Math.abs(turned / (sense * lt) - 1) < 0.1, `spin ${sense}: the node turned ${turned}, Lense-Thirring ${sense * lt}`)
  }
})
