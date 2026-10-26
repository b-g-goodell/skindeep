'use strict'
// The gravitational waves of the Gravity modes (decision 0015, issue
// #163), app/viz/waves.js: a change at a source reaches distance r after
// r / c and not before, a moving source's front is centred where it was
// sent, the sources' Iddot sum to the whole system's, and the box filter
// of the drawn field takes a mean.
const test = require('node:test')
const assert = require('node:assert')
const W = require('../app/viz/waves')

const C = 10
const QC = [3, -3, 0, 1, 0, 0]

// A trace of Iddot 0 until t0 and QC from t0, its place x(t), its near
// zone 1 wide, sampled every 0.25 up to t1.
function trace (t0, t1, x = () => 0) {
  const tr = new W.Trace()
  for (let t = 0; t <= t1 + 1e-9; t += 0.25) tr.push(t, t < t0 ? [0, 0, 0, 0, 0, 0] : QC, x(t), 0, 0, 1)
  return tr
}

test('waves: a change at the source reaches r after r / c, and not before', () => {
  const f = new W.Field(C)
  const tr = trace(10, 100)
  const h = [0, 0]
  for (const r of [50, 200, 600]) {
    // Along y, in the plane of the source's axis z: e_phi = -x, e_theta =
    // -z, so h_+ = (Q_zz - Q_xx) / (c^4 r), faded within the near zone.
    const at = t => {
      assert.ok(f.wave(tr, t, 0, r, 0, h), `no field at r ${r}, t ${t}`)
      return h[0]
    }
    const arrive = 10 + r / C
    for (const t of [r / C + 1, arrive - 0.26, arrive - 0.3]) assert.strictEqual(at(t), 0, `at r ${r} the change arrived by ${t}, before ${arrive}`)
    const want = (QC[2] - QC[0]) / (C ** 4 * r) * (r * r / (r * r + 1)) ** 2
    for (const t of [arrive, arrive + 0.01, arrive + 5]) assert.ok(Math.abs(at(t) - want) < 1e-12 * Math.abs(want) + 1e-18, `at r ${r}, t ${t}: ${at(t)}, want ${want}`)
  }
  // Before the source's first sample there is nothing to read.
  assert.strictEqual(f.wave(trace(0, 100), 100, 0, 50 + C * 101, 0, h), false)
})

test('waves: a moving source\'s front is centred where it was sent', () => {
  const f = new W.Field(C)
  const v = 0.25 * C
  const tr = trace(10, 40, t => v * t)
  const h = [0, 0]
  const T = 40
  const R = C * (T - 10)
  const sent = v * 10
  const lit = x => f.wave(tr, T, x, 0.01, 0, h) && Math.abs(h[0]) + Math.abs(h[1]) > 0
  // Ahead of the source and behind it, the front lies R from where the
  // change was sent, not from where the source is at T.
  for (const side of [1, -1]) {
    assert.ok(lit(sent + side * R * 0.97), `side ${side}: no field inside the front`)
    assert.ok(!lit(sent + side * R * 1.03), `side ${side}: field past the front`)
  }
  assert.ok(Math.abs(v * T - sent) > 0.1 * R, 'the source moved by more than the tolerance')
})

// Five bodies with any places, velocities and accelerations.
function crowd () {
  let s = 7
  const r = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647 - 0.5
  }
  return [400, 90, 30, 3, 0.5].map(m => ({ m, x: 300 * r(), y: 300 * r(), z: 300 * r(), vx: r(), vy: r(), vz: r(), ax: 0.01 * r(), ay: 0.01 * r(), az: 0.01 * r() }))
}

test('waves: the sources\' Iddot sum to the whole system\'s', () => {
  const bodies = crowd()
  // Two of them in a tight bound pair, which becomes a source of its own.
  Object.assign(bodies[2], { x: bodies[1].x + 5, y: bodies[1].y, z: bodies[1].z, vx: bodies[1].vx, vy: bodies[1].vy + 2, vz: bodies[1].vz })
  const list = W.sources(bodies)
  assert.ok(list.length >= 2 && list[list.length - 1].key === 'all', JSON.stringify(list.map(s => s.key)))
  const sum = [0, 1, 2, 3, 4, 5].map(i => list.reduce((a, s) => a + s.Q[i], 0))
  const whole = W.quadrupole(bodies)
  const scale = Math.max(...whole.map(Math.abs))
  whole.forEach((q, i) => assert.ok(Math.abs(sum[i] - q) < 1e-9 * scale, `component ${i}: ${sum[i]} against ${q}`))
})

test('waves: a body moving uniformly alone radiates nothing', () => {
  const b = { m: 5, x: 30, y: -20, z: 7, vx: 1.5, vy: -0.5, vz: 0.25, ax: 0, ay: 0, az: 0 }
  for (let t = 0; t < 10; t++) {
    const Q = W.quadrupole([{ ...b, x: b.x + b.vx * t, y: b.y + b.vy * t, z: b.z + b.vz * t }])
    assert.ok(Q.every(q => Math.abs(q) < 1e-12), JSON.stringify(Q))
  }
  // Nor a crowd's centre of mass moving uniformly: the Iddot is the same
  // at any uniform velocity of the whole.
  const bodies = crowd()
  const moved = bodies.map(b => ({ ...b, vx: b.vx + 3, vy: b.vy - 2 }))
  const a = W.quadrupole(bodies)
  W.quadrupole(moved).forEach((q, i) => assert.ok(Math.abs(q - a[i]) < 1e-9 * Math.max(...a.map(Math.abs)), `component ${i}`))
})

test('waves: the drawn field\'s box filter takes the mean of Iddot, nothing outside the samples', () => {
  const tr = new W.Trace()
  for (let t = 10; t <= 100 + 1e-9; t += 0.25) tr.push(t, [Math.sin(t), 0, 0, 0, 0, 0], 0, 0, 0, 1)
  tr.live = false
  const q = [0, 0, 0, 0, 0, 0]
  for (const [t, b] of [[50, 0.5], [50.1, 2], [70.3, 1]]) {
    assert.ok(tr.mean(t, b, q))
    const want = (Math.cos(t - b) - Math.cos(t + b)) / (2 * b)
    assert.ok(Math.abs(q[0] - want) < 0.01, `${t} +- ${b}: ${q[0]}, want ${want}`)
  }
  // Half the box before the first sample: half the mean, a ramp, not an
  // edge.
  const one = new W.Trace()
  for (let t = 10; t <= 20 + 1e-9; t += 0.25) one.push(t, [1, 0, 0, 0, 0, 0], 0, 0, 0, 1)
  one.live = false
  assert.ok(one.mean(10, 1, q) && Math.abs(q[0] - 0.5) < 1e-9, `${q[0]}`)
  assert.ok(!one.mean(8.5, 1, q), 'a box wholly before the samples reads nothing')
})

test('waves: the gain keeps GAIN for a weak field and lowers it so a strong one\'s top tenth is drawn at tanh(1)', () => {
  const n = 1000
  const buf = new Float32Array(n)
  const zero = new Float32Array(n)
  // A weak field, a seed pair's at most: GAIN, and shown as before.
  const weak = Float32Array.from({ length: n }, (_, i) => 0.9 / W.GAIN * Math.sin(i))
  assert.strictEqual(W.gain(weak, zero, n, buf), W.GAIN)
  const a = W.shown(weak, 40, 25, new Float32Array(n))
  const b = W.shown(weak, 40, 25, new Float32Array(n), W.GAIN)
  assert.deepStrictEqual(a, b)
  // Bright cells under a tenth of the pane leave GAIN.
  const spot = Float32Array.from({ length: n }, (_, i) => i < 0.05 * n ? 1 : 1e-6)
  assert.strictEqual(W.gain(spot, zero, n, buf), W.GAIN)
  // A strong field, as a second hole's pair radiates: |h| from 1e-4 to
  // 1e-2, every cell past tanh(1) at GAIN. The cell at the top tenth is
  // drawn at tanh(1), the strongest cells below saturation, by either
  // polarization.
  const strong = Float32Array.from({ length: n }, (_, i) => (i % 2 ? -1 : 1) * 1e-4 * 100 ** (i / (n - 1)))
  const k = W.gain(zero, strong, n, buf)
  const top = 1e-4 * 100 ** (Math.floor(0.9 * n) / (n - 1))
  assert.ok(Math.abs(k * top - 1) < 1e-4, `the top tenth at ${k * top}`)
  assert.ok(Math.tanh(k * 1e-2) < 0.99, `the strongest cell at ${Math.tanh(k * 1e-2)}`)
  let sat = 0
  for (let i = 0; i < n; i++) if (Math.abs(Math.tanh(k * strong[i])) > 0.9) sat++
  assert.ok(sat < 0.1 * n, `${sat} cells saturated`)
})
