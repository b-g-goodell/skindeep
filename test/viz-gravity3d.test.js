'use strict'
// The Gravity 3D mode's physics (decision 0015): orbits about a black
// hole hold past its last stable circular orbit at 3 r_s and fall in from
// within, what crosses the horizon is swallowed with its mass and
// momentum kept, and a spinning hole drags an orbit's plane round in its
// own sense at the Lense-Thirring rate.
const test = require('node:test')
const assert = require('node:assert')
const g = require('../app/viz/gravity3d')
const W = require('../app/viz/waves')

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

// The waves (issue #163). A circular binary of masses m1, m2 at
// separation a about the origin at time t, in the plane spanned by unit
// p and q, Omega^2 = (m1 + m2) / a^3, with its Newtonian accelerations.
function binary (m1, m2, a, t, p = [1, 0, 0], q = [0, 1, 0]) {
  const M = m1 + m2
  const w = Math.sqrt(M / a ** 3)
  const c = Math.cos(w * t)
  const s = Math.sin(w * t)
  const at = (u, v) => [0, 1, 2].map(i => u * p[i] + v * q[i])
  return [[m1, m2 / M], [m2, -m1 / M]].map(([m, k]) => {
    const [x, y, z] = at(k * a * c, k * a * s)
    const [vx, vy, vz] = at(-k * a * w * s, k * a * w * c)
    const [ax, ay, az] = at(-k * a * w * w * c, -k * a * w * w * s)
    return { m, x, y, z, vx, vy, vz, ax, ay, az }
  })
}

test('gravity3d: an inclined circular binary\'s Iddot oscillates at 2 Omega with amplitude 2 mu a^2 Omega^2', () => {
  const p = [1, 0, 0]
  const q = [0, Math.cos(0.7), Math.sin(0.7)]
  for (const [m1, m2, a] of [[50, 30, 16], [900, 300, 120]]) {
    const M = m1 + m2
    const w = Math.sqrt(M / a ** 3)
    const A = 2 * (m1 * m2 / M) * a * a * w * w
    for (let t = 0; t < 2 * Math.PI / w; t += 0.41) {
      const Q = g.quadrupole(binary(m1, m2, a, t, p, q))
      // -A (cos 2 w t (p p - q q) + sin 2 w t (p q + q p)), as [xx, yy, zz, xy, xz, yz].
      const T = (i, j) => -A * (Math.cos(2 * w * t) * (p[i] * p[j] - q[i] * q[j]) + Math.sin(2 * w * t) * (p[i] * q[j] + q[i] * p[j]))
      const want = [T(0, 0), T(1, 1), T(2, 2), T(0, 1), T(0, 2), T(1, 2)]
      Q.forEach((v, i) => assert.ok(Math.abs(v - want[i]) < 1e-9 * A, `${m1}+${m2} at ${a}, t ${t}, component ${i}: ${v}, want ${want[i]}`))
    }
  }
})

test('gravity3d: a lone body moving uniformly has no Iddot', () => {
  const Q = g.quadrupole([{ m: 900, x: 40, y: -10, z: 5, vx: 0.5, vy: 0.2, vz: -1, ax: 0, ay: 0, az: 0 }])
  assert.ok(Q.every(v => Math.abs(v) < 1e-12), JSON.stringify(Q))
})

// Along the orbit's axis both polarizations, each 4 m1 m2 / (c^4 a r);
// in its plane h_x vanishes and h_+ halves. Far out, where the near
// zone's fade is under a percent.
test('gravity3d: the waves are strongest along the axis, both polarizations there, h_+ alone and half in the plane', () => {
  const [m1, m2, a] = [50, 30, 16]
  const w = Math.sqrt((m1 + m2) / a ** 3)
  const field = new W.Field(g.C)
  // The same two bodies throughout, moved along the orbit.
  const bodies = binary(m1, m2, a, 0)
  let t = 0
  for (; t < 120; t += 0.25) field.sample(t, binary(m1, m2, a, t).map((b, i) => Object.assign(bodies[i], b)))
  t -= 0.25
  const tr = [...field.traces.entries()].find(([k]) => k !== 'all')[1]
  const r = 1000
  const near = []
  tr.at(tr.last(), near)
  const fade = (r * r / (r * r + near[3] ** 2)) ** 2
  const full = 4 * m1 * m2 / (g.C ** 4 * a * r) * fade
  const h = [0, 0]
  const most = (x, y, z) => {
    const m = [0, 0]
    for (let k = 0; k < 64; k++) {
      // One wave period, pi / Omega, of retarded time.
      assert.ok(field.wave(tr, t - k / 64 * Math.PI / w, x, y, z, h))
      m[0] = Math.max(m[0], Math.abs(h[0]))
      m[1] = Math.max(m[1], Math.abs(h[1]))
    }
    return m
  }
  const axis = most(0, 0, r)
  assert.ok(Math.abs(axis[0] / full - 1) < 0.01 && Math.abs(axis[1] / full - 1) < 0.01, `on the axis h_+ ${axis[0]}, h_x ${axis[1]}, want ${full}`)
  for (const ang of [0, 1, 2.5]) {
    const plane = most(r * Math.cos(ang), r * Math.sin(ang), 0)
    assert.ok(plane[1] < 1e-9 * full, `in the plane h_x ${plane[1]}`)
    assert.ok(Math.abs(plane[0] / (full / 2) - 1) < 0.01, `in the plane h_+ ${plane[0]}, want ${full / 2}`)
  }
  // Between, at inclination i: h_+ (1 + cos^2 i) / 2, h_x cos i.
  const i = 1
  const mid = most(r * Math.sin(i), 0, r * Math.cos(i))
  assert.ok(Math.abs(mid[0] / (full * (1 + Math.cos(i) ** 2) / 2) - 1) < 0.01, `at ${i} rad h_+ ${mid[0]}`)
  assert.ok(Math.abs(mid[1] / (full * Math.cos(i)) - 1) < 0.01, `at ${i} rad h_x ${mid[1]}`)
})

// Peters: a circular pair shrinks at 64/5 m1 m2 M / (c^5 a^3), so a^4 =
// a0^4 - 4 beta t. Two stars of 500 at 100, where the softening moves
// the pull by a tenth of a percent, over 2.7 orbits.
test('gravity3d: radiation reaction shrinks a circular pair at Peters\' rate, momentum kept', () => {
  const m = 500
  const a0 = 100
  const v = Math.sqrt(2 * m * a0 * a0 / (a0 * a0 + 9) ** 1.5)
  const A = { x: a0 / 2, y: 0, z: 0, vx: 0, vy: v / 2, vz: 0, m, r: 1 }
  const B = { x: -a0 / 2, y: 0, z: 0, vx: 0, vy: -v / 2, vz: 0, m, r: 1 }
  const bodies = [A, B]
  const beta = 64 / 5 * m * m * 2 * m / g.C ** 5
  let t = 0
  for (; t < 540; t += 0.25) g.step(bodies, 0.25)
  const a = Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z)
  const peters = (a0 ** 4 - 4 * beta * t) ** 0.25
  assert.ok(Math.abs((a0 - a) / (a0 - peters) - 1) < 0.03, `shrank ${a0 - a}, Peters ${a0 - peters}`)
  momentum(bodies).forEach(p => assert.ok(Math.abs(p) < 1e-9, `momentum ${momentum(bodies)}`))
})
