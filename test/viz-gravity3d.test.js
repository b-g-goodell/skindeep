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

// The view's centre (issue #171). The seed's system as the mode builds
// it: a hole of 900 spinning at 0.7, a companion at 175, a star of 50
// and a hole of 30 16 apart about their centre of mass, and planets of
// 4 at 215 and 245, all about their common centre of mass.
function seeded () {
  const h = hole(0.7, [0, Math.sin(0.1), Math.cos(0.1)])
  const bodies = [h]
  const add = (r, a, m, kind, inc = 0) => {
    const v = g.circular(h, r)
    const b = { x: r * Math.cos(a), y: r * Math.sin(a) * Math.cos(inc), z: r * Math.sin(a) * Math.sin(inc), vx: -v * Math.sin(a), vy: v * Math.cos(a) * Math.cos(inc), vz: v * Math.cos(a) * Math.sin(inc), m, r: 2, hole: kind === 'hole', chi: 0, jx: 0, jy: 0, jz: 1, star: kind === 'star', trail: [] }
    if (b.hole) b.r = g.horizon(b)
    bodies.push(b)
    return b
  }
  const c = add(175, 0.4, 80, 'star', 0.3)
  bodies.pop()
  const v = Math.sqrt(80 * 16) / (16 - g.rs(30))
  for (const [m, k, kind] of [[50, 30 / 80, 'star'], [30, -50 / 80, 'hole']]) {
    const b = { x: c.x + k * 16, y: c.y, z: c.z, vx: c.vx, vy: c.vy + k * v, vz: c.vz, m, r: kind === 'hole' ? 0 : 6, hole: kind === 'hole', chi: 0, jx: 0, jy: 0, jz: 1, star: kind === 'star', trail: [] }
    if (b.hole) b.r = g.horizon(b)
    bodies.push(b)
  }
  add(215, 2, 4, 'planet', 0.2)
  add(245, 4, 4, 'planet', -0.25)
  g.centre(bodies)
  return bodies
}

// A camera as the mode's, over a full pane of 1200 by 760, about the
// heaviest hole.
function camera (bodies, yaw, pitch = 0.36, w = 1200, h = 760) {
  const V = { D: 620 }
  const a = g.anchor(bodies)
  g.aim(V, yaw, pitch, w, h, a ? [a.x, a.y, a.z] : [0, 0, 0])
  return V
}
const onScreen = (V, x, y, z) => {
  const P = {}
  g.place(V, P, x, y, z)
  return [P.x, P.y]
}

test('gravity3d: the view holds the heaviest hole at the pane\'s centre while the companion orbits about the centre of mass', () => {
  const bodies = seeded()
  const h = bodies[0]
  const star = bodies[1]
  const out = []
  let off = 0
  const span = [Infinity, -Infinity]
  for (let k = 0; k < 2000; k++) {
    g.step(bodies, 0.25)
    // The mode recentres at every event and swallowing.
    if (k % 50 === 49) g.centre(bodies)
    momentum(bodies).forEach(p => assert.ok(Math.abs(p) < 1e-6, `step ${k}: momentum ${momentum(bodies)}`))
    assert.strictEqual(g.anchor(bodies), h, `step ${k}: another body anchors the view`)
    const V = camera(bodies, 0.6 + 0.004 * k, 0.36 + 0.3 * Math.sin(k / 300))
    const [x, y] = onScreen(V, h.x, h.y, h.z)
    assert.ok(Math.abs(x - 600) < 1e-6 && Math.abs(y - 380) < 1e-6, `step ${k}: the hole at ${x}, ${y}`)
    g.frameOf(V, h.x, h.y, h.z, out)
    assert.ok(Math.abs(out[0]) < 1e-9 && Math.abs(out[1]) < 1e-9 && Math.abs(out[2] - 620) < 1e-9, `step ${k}: the trace sees the hole at ${out}`)
    off = Math.max(off, Math.hypot(h.x, h.y, h.z))
    const s = onScreen(V, star.x, star.y, star.z)
    span[0] = Math.min(span[0], s[0])
    span[1] = Math.max(span[1], s[0])
  }
  // The hole circles the centre of mass, where the view stood before.
  assert.ok(off > 8, `the hole strayed only ${off} from the centre of mass`)
  assert.ok(span[1] - span[0] > 100, `the companion crossed only ${span[1] - span[0]} pixels`)
})

test('gravity3d: a recentring moves nothing on screen, and a swallowing keeps the hole at the centre, the trails moved by its recoil alone', () => {
  const bodies = seeded()
  const h = bodies[0]
  const p = bodies[3]
  for (let k = 0; k < 40; k++) {
    g.step(bodies, 0.25)
    p.trail.push(p.x, p.y, p.z)
  }
  const places = V => [h, ...bodies.slice(1, 3)].map(b => onScreen(V, b.x, b.y, b.z)).concat(Array.from({ length: p.trail.length / 3 }, (_, i) => onScreen(V, p.trail[3 * i], p.trail[3 * i + 1], p.trail[3 * i + 2])))
  const most = (a, b) => Math.max(...a.map((q, i) => Math.hypot(q[0] - b[i][0], q[1] - b[i][1])))
  // The far planet leaves, as the mode drops a body past its reach: the
  // centre of mass moves, and the recentring moves every body and trail.
  bodies.splice(4, 1)
  const before = places(camera(bodies, 1))
  const q = g.centre(bodies)
  assert.ok(Math.hypot(...q) > 0.5, `the recentring moved the bodies only ${Math.hypot(...q)}`)
  const after = places(camera(bodies, 1))
  assert.ok(most(before, after) < 1e-9, `a recentring moved the screen by ${most(before, after)} pixels`)
  // A star of 50 falls in from 1.2 r_+, and the mode recentres.
  const r = 1.2 * g.horizon(h)
  bodies.push({ x: h.x + r, y: h.y, z: h.z, vx: h.vx - 20, vy: h.vy, vz: h.vz, m: 50, r: 6, star: true, trail: [] })
  const was = [h.x, h.y, h.z]
  const V0 = camera(bodies, 1)
  const trail0 = places(V0).slice(3)
  const { swallowed } = g.step(bodies, 0.25)
  assert.strictEqual(swallowed.length, 1)
  const q2 = g.centre(bodies)
  assert.strictEqual(g.anchor(bodies), h)
  const V1 = camera(bodies, 1)
  const [x, y] = onScreen(V1, h.x, h.y, h.z)
  assert.ok(Math.abs(x - 600) < 1e-6 && Math.abs(y - 380) < 1e-6, `the merged hole at ${x}, ${y}`)
  // The trails moved on screen by the hole's own move across the
  // recentring, its recoil, under a pixel.
  const move = most(trail0, places(V1).slice(3))
  const recoil = Math.hypot(h.x - was[0] - q2[0], h.y - was[1] - q2[1], h.z - was[2] - q2[2])
  assert.ok(move < 1, `the trails jumped ${move} pixels at the swallowing, the hole's recoil ${recoil}`)
  assert.ok(move > 0 && move < recoil * V1.f / 300, `the trails moved ${move} pixels for a recoil of ${recoil}`)
})

test('gravity3d: with no hole the view stands at the origin, the centre of mass', () => {
  assert.strictEqual(g.anchor([{ m: 50, x: 3, y: 0, z: 0, star: true }, { m: 4, x: -40, y: 1, z: 0 }]), null)
  const V = camera([{ m: 50, x: 3, y: 0, z: 0, star: true }], 0.6)
  assert.deepStrictEqual(V.o, [0, 0, 0])
  const [x, y] = onScreen(V, 0, 0, 0)
  assert.ok(x === 600 && y === 380)
})

// The Doppler shift (decision 0015, 2026-10-18).
const close = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a}, want ${b}`)

test('gravity3d: the Doppler factor is 1 at rest and across the line at low speed, above 1 coming and below 1 going', () => {
  const C = g.C
  // n, the unit vector toward the camera, along +x.
  assert.strictEqual(g.doppler(0, 0, 0, 1, 0, 0), 1)
  close(g.doppler(0, 0.01 * C, 0, 1, 0, 0), 1, 1e-4, 'across the line at beta 0.01')
  close(g.doppler(0, 0, -0.01 * C, 1, 0, 0), 1, 1e-4, 'across the line at beta 0.01')
  assert.ok(g.doppler(0.3 * C, 0, 0, 1, 0, 0) > 1, 'coming toward the camera')
  assert.ok(g.doppler(-0.3 * C, 0, 0, 1, 0, 0) < 1, 'going away')
  // D = 1 / (gamma (1 - beta cos theta)) at beta = 0.6, gamma = 1.25.
  const D = th => g.doppler(0.6 * C * Math.cos(th), 0.6 * C * Math.sin(th), 0, 1, 0, 0)
  close(D(0), 2, 1e-12, 'theta 0')
  close(D(Math.PI / 3), 8 / 7, 1e-12, 'theta 60 degrees')
  close(D(Math.PI / 2), 0.8, 1e-12, 'theta 90 degrees')
  close(D(Math.PI), 0.5, 1e-12, 'theta 180 degrees')
  // Past the speed cap, the speed is taken as BETA C.
  const b = g.BETA
  close(g.doppler(3 * C, 0, 0, 1, 0, 0), Math.sqrt(1 - b * b) / (1 - b), 1e-9, 'at 3 C')
})

test('gravity3d: the colour rule turns a hue toward blue for D > 1 and toward red for D < 1, by lambda / D', () => {
  // Unwrapped hue along the spectrum: red, below 0, up through 0 to
  // violet, HUE_BLUE.
  const un = h => h > g.HUE_BLUE ? h - 360 : h
  for (let h = 0; h < 360; h += 15) close(g.shift(h, 1), h, 1e-9, `hue ${h} at D = 1`)
  for (const h of [350, 0, 15, 30, 48, 120, 200, 215, 240]) {
    const up = un(g.shift(h, 1.05))
    const down = un(g.shift(h, 0.95))
    assert.ok(up > un(h) && up <= g.HUE_BLUE, `hue ${h} at D 1.05 is ${up}`)
    assert.ok(down < un(h) && down >= g.HUE_RED, `hue ${h} at D 0.95 is ${down}`)
  }
  // The purples move along their arc toward violet and toward red.
  for (const h of [280, 300, 320, 340]) {
    assert.ok(g.shift(h, 1.05) < h && g.shift(h, 1.05) >= g.HUE_BLUE, `hue ${h} at D 1.05 is ${g.shift(h, 1.05)}`)
    assert.ok(g.shift(h, 0.95) > h && g.shift(h, 0.95) <= 360 + g.HUE_RED, `hue ${h} at D 0.95 is ${g.shift(h, 0.95)}`)
  }
  // The nominal wavelength of a hue is that of the spectral colour of
  // that hue, and the shift divides it by D.
  for (const l of [450, 470.5, 500, 549, 580, 611, 630]) close(g.wavelength(g.spectral(l)), l, 1e-6, `lambda ${l} nm`)
  for (const [h, D] of [[30, 1.2], [120, 0.95], [200, 1.03], [0, 1.1], [215, 0.9]]) {
    close(g.wavelength(un(g.shift(h, D))), g.wavelength(un(h)) / D, 1e-6, `lambda of hue ${h} at D ${D}`)
  }
  // Clamped at the range's ends.
  close(g.shift(200, 5), g.HUE_BLUE, 1e-9, 'far bluer')
  close(g.shift(30, 0.2), 360 + g.HUE_RED, 1e-9, 'far redder')
  close(g.shift(300, 0.1), 360 + g.HUE_RED, 1e-9, 'a purple far redder')
})

test('gravity3d: the gravitational shift of light from rest at r is sqrt(1 - r_s / r), 0 within r_s', () => {
  const h = { b: { x: 0, y: 0, z: 0 }, s: RS }
  close(g.lapse([h], 4 * RS, 0, 0), Math.sqrt(0.75), 1e-12, 'at 4 r_s')
  close(g.lapse([h, { b: { x: 8 * RS, y: 0, z: 0 }, s: RS }], 4 * RS, 0, 0), 0.75, 1e-12, 'between two holes at 4 r_s')
  assert.strictEqual(g.lapse([h], 0.9 * RS, 0, 0), 0)
  assert.strictEqual(g.lapse([], 1, 2, 3), 1)
})

test('gravity3d: a trail kept every step follows a fast orbit, its places 4 of travel and one step apart at most', () => {
  const h = hole()
  const b = Object.assign(orbiter(h, 4, 1), { trail: [], tv: [], tt: 0 })
  const bodies = [h, b]
  const v = g.circular(h, 4 * RS)
  let t = 0
  for (let k = 0; k < 2000; k++) {
    g.step(bodies, 0.25)
    t += 0.25
    g.track(b, t, h)
  }
  const tr = b.trail
  assert.strictEqual(tr.length, 3 * 64)
  for (let i = 3; i < tr.length; i += 3) {
    const d = Math.hypot(tr[i] - tr[i - 3], tr[i + 1] - tr[i - 2], tr[i + 2] - tr[i - 1])
    assert.ok(d <= 4 + 0.25 * v + 1e-9, `places ${d} apart at speed ${v}`)
  }
  assert.strictEqual(g.track(Object.assign({}, b, { star: true }), t + 10, h), false, 'a star keeps no trail')
})

test('gravity3d: a planet merged into a star leaves no trail on it, and two planets keep the larger\'s', () => {
  const trail = [1, 2, 3, 4, 5, 6]
  const planet = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, m: 5, r: 3, hue: 120, trail: trail.slice(), tv: [0, 0, 0, 0, 0, 0], tt: 0 }
  const star = { x: 4, y: 0, z: 0, vx: 0, vy: 0, vz: 0, m: 100, r: 9, hue: 15, star: true, trail: [], tv: [], tt: 0 }
  const bodies = [planet, star]
  g.step(bodies, 0.01)
  assert.strictEqual(bodies.length, 1)
  assert.ok(bodies[0].star)
  assert.deepStrictEqual(bodies[0].trail, [], 'the star keeps the planet\'s trail, drawn to it straight as it moves on')
  const small = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, m: 2, r: 3, hue: 120, trail: [9, 9, 9], tv: [0, 0, 0], tt: 0 }
  const large = { x: 4, y: 0, z: 0, vx: 0, vy: 0, vz: 0, m: 6, r: 3, hue: 200, trail: trail.slice(), tv: [0, 0, 0, 0, 0, 0], tt: 0 }
  const two = [small, large]
  g.step(two, 0.01)
  assert.strictEqual(two.length, 1)
  assert.deepStrictEqual(two[0].trail, trail)
  assert.strictEqual(two[0].hue, 200)
})
