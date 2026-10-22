'use strict'
// The Carbon mode (decision 0015, issue #144): its slim data file against
// the research data it is generated from, and the physics the mode draws
// from it.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const slim = require('../scripts/research/carbon_slim')
const D = require('../app/viz/carbon-data')
const C = require('../app/viz/carbon')

const full = JSON.parse(fs.readFileSync(slim.SRC, 'utf8'))

test('carbon-data.js is what the script writes from the research data', () => {
  assert.strictEqual(fs.readFileSync(slim.OUT, 'utf8'), slim.text(), 'run node scripts/research/carbon_slim.js')
})

test('carbon: levels and lines match the research data', () => {
  assert.strictEqual(D.levels.length, full.levels.length)
  assert.strictEqual(D.lines.length, full.lines.length)
  D.levels.forEach((l, i) => {
    const f = full.levels[i]
    assert.strictEqual(l.id, f.id)
    assert.strictEqual(l.E, f.energy_cm, l.id)
    assert.strictEqual(l.eV, f.energy_eV, l.id)
    assert.strictEqual(l.tau, f.tau_s, l.id)
    assert.strictEqual(l.g, 2 * l.J + 1, l.id)
  })
  D.lines.forEach((l, i) => {
    const f = full.lines[i]
    assert.strictEqual(D.levels[l.u].id, f.upper)
    assert.strictEqual(D.levels[l.l].id, f.lower)
    assert.strictEqual(l.A, f.A_s)
    assert.strictEqual(l.branch, f.branch)
  })
  assert.strictEqual(D.limit, full.ionization.limits['2P1/2'].energy_cm)
})

test('carbon: each level\'s g_J is NIST\'s measured value or the LS formula, and J = 0 has none', () => {
  // NIST ASD's three measured C I values (research, carbon-beyond.md 5.2).
  const measured = { '2p2_3P_1': 1.5010623, '2p2_3P_2': 1.5010469, '2p3s_1Po_1': 0.97 }
  const gs = 2.00231930436092
  const ls = new Set()
  let zero = 0
  D.levels.forEach((l, i) => {
    assert.strictEqual(l.gJ !== null, full.levels[i].J !== '0', l.id)
    if (l.J === 0) {
      assert.strictEqual(l.gJsrc, null, l.id)
      zero++
      return
    }
    if (measured[l.id] !== undefined) {
      assert.deepStrictEqual([l.gJ, l.gJsrc], [measured[l.id], 'measured'], l.id)
      return
    }
    const S = (Number(l.term[0]) - 1) / 2
    const L = 'SPDF'.indexOf(l.term[1])
    const J = l.J
    const g = 1 + (gs - 1) * (J * (J + 1) + S * (S + 1) - L * (L + 1)) / (2 * J * (J + 1))
    assert.ok(Math.abs(l.gJ - g) < 1e-12, `${l.id}: ${l.gJ} against ${g}`)
    assert.strictEqual(l.gJsrc, 'LS', l.id)
    ls.add(l.gJ.toFixed(4))
  })
  assert.strictEqual(Object.keys(measured).filter(id => D.levels.find(l => l.id === id).gJsrc === 'measured').length, 3)
  assert.strictEqual(zero, 12)
  // Nine LS values from 0.4988 to 2.0023, as the research prints; 3P at
  // 1.501160 against the measured 1.50106 and 1.50105.
  assert.deepStrictEqual([...ls].sort(), ['0.4988', '0.6659', '1.0000', '1.0835', '1.1671', '1.2506', '1.3341', '1.5012', '2.0023'])
  assert.strictEqual(D.levels.find(l => l.id === '2p4p_3P_2').gJ.toFixed(6), '1.501160')
  assert.strictEqual(D.levels.find(l => l.id === '2p4p_3D_3').gJ.toFixed(3), '1.334')
})

test('carbon: Ritz wavelengths from the level energies agree with NIST', () => {
  let worst = 0
  for (const l of D.lines) {
    const nm = 1e7 / (D.levels[l.u].E - D.levels[l.l].E)
    worst = Math.max(worst, Math.abs(nm / l.vac - 1))
  }
  // Research section 5: the largest residual is 1.4e-7, from NIST's rounding.
  assert.ok(worst < 2e-7, `worst relative residual ${worst}`)
})

test('carbon: each level\'s branching ratios sum to 1, and 1 / sum A is its lifetime', () => {
  const by = new Map()
  for (const l of D.lines) {
    const e = by.get(l.u) || { b: 0, A: 0 }
    e.b += l.branch
    e.A += l.A
    by.set(l.u, e)
  }
  assert.strictEqual(by.size, D.levels.length - 1, 'every level but 3P0 decays')
  for (const [u, e] of by) {
    assert.ok(Math.abs(e.b - 1) < 1e-12, `${D.levels[u].id}: branches sum to ${e.b}`)
    assert.ok(Math.abs(1 / e.A / D.levels[u].tau - 1) < 1e-9, `${D.levels[u].id}: 1 / sum A`)
  }
})

test('carbon: every cascade reaches the ground term by listed decays', () => {
  for (let i = 0; i < D.levels.length; i++) {
    const seen = new Set([i])
    const todo = [i]
    let reached = C.ground(D.levels[i])
    while (todo.length && !reached) {
      const k = todo.pop()
      for (const l of D.lines) {
        if (l.u !== k || seen.has(l.l)) continue
        seen.add(l.l)
        todo.push(l.l)
        if (C.ground(D.levels[l.l])) reached = true
      }
    }
    assert.ok(reached, `${D.levels[i].id} does not reach 3P`)
  }
  // And the mode's own walk, by the branching ratios, stops there.
  for (let run = 0; run < 200; run++) {
    let i = D.levels.length - 1 - (run % 30)
    for (let n = 0; n < 40 && !C.ground(D.levels[i]); n++) i = D.lines[C.decay(i, Math.random())].l
    assert.ok(C.ground(D.levels[i]), 'a walk stopped short of the ground term')
    assert.strictEqual(C.tauScreen(D.levels[i]), Infinity, 'the ground term rests')
  }
})

test('carbon: the two clocks, NIST\'s rates by one factor and light by another', () => {
  // The factors of issue #166: events NIST / 5e6, light c / 5e17, each
  // five times slower than 1e6 and 1e17.
  assert.strictEqual(C.EVENT, 5e6)
  assert.strictEqual(C.LIGHT, 5e17)
  const at = id => D.levels.find(l => l.id === id)
  for (const id of ['2p4p_1P_1', '2p3s_1Po_1', '2s2p3_5So_2', '2p2_1D_2']) {
    assert.ok(Math.abs(C.tauScreen(at(id)) / (at(id).tau * C.EVENT) - 1) < 1e-12, id)
  }
  // Lifetimes on screen: 2p3s 1Po1 13.6 ms, 2p4p 3D3 1.22 s.
  assert.ok(Math.abs(C.tauScreen(at('2p3s_1Po_1')) - 0.01362) < 1e-5)
  assert.ok(Math.abs(C.tauScreen(at('2p4p_3D_3')) - 1.2163) < 1e-4)
  // Ratios kept: a 2p4p level waits 25 to 90 times as long as a 2p3s one.
  const r = C.tauScreen(at('2p4p_3D_3')) / C.tauScreen(at('2p3s_3Po_2'))
  assert.ok(r > 80 && r < 90, `ratio ${r}`)
  // c / 5e17 is 0.5996 nm/s: 11.33 bohr a second.
  assert.ok(Math.abs(C.Clock.light - 299792458 / C.LIGHT / 0.0529177210544e-9) < 1e-9)
  assert.ok(Math.abs(C.Clock.light - 11.33) < 0.01)
})

test('carbon: what moves with the clocks keeps its relation to them', () => {
  // The field stays below the slowest allowed decay, 2p4p 3D3 at 0.822 a
  // second on screen: 1.2 x 243 ns x 1e6, its share of that rate, as at
  // a clock of 1e6.
  const radiating = D.levels.filter(l => l.tau && l.tau < 1e-6)
  const slowest = radiating.reduce((a, b) => b.tau > a.tau ? b : a)
  assert.strictEqual(slowest.id, '2p4p_3D_3')
  assert.ok(Math.abs(C.FIELD_MAX - 0.24) < 1e-12)
  assert.ok(Math.abs(C.FIELD_MAX * C.tauScreen(slowest) - 1.2 * slowest.tau * 1e6) < 1e-12)
  assert.ok(C.FIELD_MAX < 1 / C.tauScreen(slowest) / 3, 'a few times below the slowest decay')
  // The swirl's clip on the light clock: 3 rad/s at 1e17, so the same
  // m / rho^2 in atomic units.
  assert.ok(Math.abs(C.SPIN_MAX * C.Clock.au - 3 * 2.4188843265864) < 1e-9)
  // The detector's trace on the event clock: 2 ms and 1 s at 1e6.
  assert.ok(Math.abs(C.TRACE_DT / C.EVENT - 2e-9) < 1e-21)
  assert.ok(Math.abs(C.TRACE_T / C.EVENT - 1e-6) < 1e-18)
  // The dial's range is kept, its start calibrated (issue #169).
  assert.deepStrictEqual([C.B_MAX, C.B_START], [2e-3, 0.15e-3])
})

test('carbon: the ensemble jumps by its rates and keeps each M_L within its L', () => {
  const N = 2000
  const atoms = C.Ensemble.make(N, () => D.levels.findIndex(l => l.id === '2p3s_1Po_1'))
  let jumps = 0
  const lines = []
  C.Ensemble.step(atoms, 1, 0, () => assert.fail('no field, no collision'), (i, k) => {
    const a = atoms[i]
    const q = C.Ensemble.q(a, D.lines[k])
    a.M -= q
    a.lv = D.lines[k].l
    const L = 'SPDF'.indexOf(D.levels[a.lv].term[1])
    assert.ok(Math.abs(a.M) <= L, `M_L ${a.M} in L ${L}`)
    jumps++
    lines.push(k)
  })
  // tau on the event clock is 13.6 ms, so in 1 s every atom has left,
  // 92.35 % of them by 193.1 nm to 1D2, the rest to 1S0 and 3P, and
  // rests. The share is binomial: at N = 2000 its standard deviation is
  // 0.0059, so the bound of 0.03 is 5 of them and a correct ensemble
  // fails it once in about 2 million runs. At N = 200 the bound of 0.05
  // was 2.7 deviations, a false failure once in 130.
  assert.ok(atoms.every(a => !D.levels[a.lv].conf.includes('3s')))
  const to1D = lines.filter(k => D.levels[D.lines[k].l].id === '2p2_1D_2').length / lines.length
  assert.ok(Math.abs(to1D - 0.9235) < 0.03, `share to 1D2 ${to1D}`)
  assert.strictEqual(jumps, N)
})

// The cloud's particles (issue #165). A seeded generator, mulberry32, so
// each run draws the same numbers: the statistical tests below are
// deterministic, and their bound is the Kolmogorov-Smirnov statistic's
// critical value at a share 0.001 of independent draws, 1.95 / sqrt(n)
// (the asymptotic Kolmogorov distribution).
function seeded (seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), s | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
// The CDF of a density on [a, b], by the trapezoid on n steps, from the
// orbitals themselves and not the mode's tables.
function cdfOf (dens, a, b, n) {
  const cs = new Float64Array(n + 1)
  let prev = dens(a)
  for (let k = 1; k <= n; k++) {
    const v = dens(a + (b - a) * k / n)
    cs[k] = cs[k - 1] + (v + prev) / 2
    prev = v
  }
  return x => {
    if (x <= a) return 0
    if (x >= b) return 1
    const f = (x - a) / (b - a) * n
    const k = Math.floor(f)
    return (cs[k] + (f - k) * (cs[k + 1] - cs[k])) / cs[n]
  }
}
const ksStat = (xs, F) => {
  const s = Float64Array.from(xs).sort()
  let d = 0
  for (let i = 0; i < s.length; i++) d = Math.max(d, Math.abs(F(s[i]) - i / s.length), Math.abs(F(s[i]) - (i + 1) / s.length))
  return d
}
const KS = n => 1.95 / Math.sqrt(n)
const radialCdfs = new Map()
const radialCdf = key => {
  if (!radialCdfs.has(key)) radialCdfs.set(key, cdfOf(r => C.radialP(key, r) ** 2, 0, 200, 200000))
  return radialCdfs.get(key)
}
// Each slot's radii against its orbital's P(r)^2, and its cos theta, by
// |m|, against P_l^|m|(cos theta)^2, or uniform where the slot has no
// n_m: [{ what, n, d, bound }].
function cloudKs (c) {
  const out = []
  c.kinds.forEach((k, s) => {
    const rs = []
    const byM = new Map()
    for (let i = C.Cloud.SLOT_AT[s]; i < C.Cloud.SLOT_AT[s + 1]; i++) {
      const r = Math.hypot(c.pts[3 * i], c.pts[3 * i + 1], c.pts[3 * i + 2])
      rs.push(r)
      const m = k.cum ? Math.abs(c.m[i]) : -1
      if (!byM.has(m)) byM.set(m, [])
      byM.get(m).push(c.pts[3 * i + 2] / r)
    }
    out.push({ what: `slot ${s} ${k.key} radius`, n: rs.length, d: ksStat(rs, radialCdf(k.key)), bound: KS(rs.length) })
    for (const [m, cs] of byM) {
      if (cs.length < 30) continue
      const F = m < 0 ? x => (x + 1) / 2 : cdfOf(x => C.legendre(k.l, m, x) ** 2, -1, 1, 20000)
      out.push({ what: `slot ${s} ${k.key} cos theta at |m| ${m}`, n: cs.length, d: ksStat(cs, F), bound: KS(cs.length) })
    }
  })
  return out
}
const at = id => D.levels.find(l => l.id === id)
const meanROf = key => D.outer[key] ? D.outer[key].meanR : D.rhf.meanR[key]

test('carbon: the cloud at rest keeps each electron\'s |psi|^2 under Nelson\'s dynamics', () => {
  // From a stationary start, 2400 steps of a 20th of a second, 120 s on
  // screen, ten atomic units of time: the radii of each slot against its
  // orbital's distribution, the polar angles against |Y_lm|^2. Two
  // levels: the ground term, whose 2p slots hold m = 0 and 1, and a
  // 2p4p level of M_L = 2, whose outer 4p electron, a node in its P(r),
  // turns at m = 1.
  for (const [id, M] of [['2p2_3P_1', 1], ['2p4p_3D_3', 2]]) {
    const rand = seeded(165)
    const c = C.Cloud.make(at(id), M, rand)
    for (let i = 0; i < 2400; i++) C.Cloud.step(c, 1 / 20, rand)
    for (const k of cloudKs(c)) assert.ok(k.d <= k.bound, `${id} M_L ${M} ${k.what}: KS ${k.d.toFixed(4)} over ${k.bound.toFixed(4)} at n ${k.n}`)
    assert.strictEqual(c.pts.length, 3 * C.Cloud.N)
    assert.ok(c.pts.every(Number.isFinite))
    // The drawn points, each path's mean over SMOOTH, lag it by
    // sqrt(D SMOOTH) an axis, rms, D = 1 / 2 atomic unit on the light
    // clock: 0.10 bohr, a little less where the drift holds the path in.
    const lag = Math.sqrt(C.NELSON / 2 / C.Clock.au * C.SMOOTH)
    for (let s = 0; s < 6; s++) {
      let v = 0
      for (let i = 3 * C.Cloud.SLOT_AT[s]; i < 3 * C.Cloud.SLOT_AT[s + 1]; i++) v += (c.q[i] - c.pts[i]) ** 2
      const rms = Math.sqrt(v / (3 * (C.Cloud.SLOT_AT[s + 1] - C.Cloud.SLOT_AT[s])))
      assert.ok(rms > 0.7 * lag && rms < 1.1 * lag, `${id} slot ${s}: the drawn points lag ${rms} bohr against ${lag}`)
    }
  }
})

test('carbon: a cloud started from a wrong density relaxes to |psi|^2', () => {
  // Every particle of the ground term 3P1, M_L = 1, at three times its
  // orbital's mean radius and within 0.3 rad of the axis, where
  // |Y_1,1|^2 vanishes, as many toward +z as toward -z: every slot fails
  // the bound. After 240 s on screen, 20 atomic units of time, in steps
  // of a quarter second, every slot passes it. Nelson's process does not
  // cross a node of rho, so the start keeps each nodal domain's share:
  // both lobes of |Y_1,0|^2 about the plane z = 0.
  const rand = seeded(7)
  const c = C.Cloud.make(at('2p2_3P_1'), 1, rand)
  c.kinds.forEach((k, s) => {
    for (let i = C.Cloud.SLOT_AT[s]; i < C.Cloud.SLOT_AT[s + 1]; i++) {
      const r = 3 * meanROf(k.key)
      const th = i % 2 ? Math.PI - 0.3 * Math.sqrt(rand()) : 0.3 * Math.sqrt(rand())
      const ph = 2 * Math.PI * rand()
      c.pts[3 * i] = r * Math.sin(th) * Math.cos(ph)
      c.pts[3 * i + 1] = r * Math.sin(th) * Math.sin(ph)
      c.pts[3 * i + 2] = r * Math.cos(th)
    }
  })
  for (const k of cloudKs(c)) assert.ok(k.d > k.bound, `the wrong start passes ${k.what}: KS ${k.d.toFixed(4)}`)
  for (let i = 0; i < 960; i++) C.Cloud.step(c, 0.25, rand)
  for (const k of cloudKs(c)) assert.ok(k.d <= k.bound, `${k.what}: KS ${k.d.toFixed(4)} over ${k.bound.toFixed(4)} at n ${k.n}`)
})

test('carbon: a jump carries every particle to the lower level\'s density, none made or lost', () => {
  // 2p4p 1P1 to 2p3s 1Po1, then on to the ground term before the first
  // move ends, at frames of a 60th of a second: every particle keeps its
  // index and moves less than a bohr a frame, the 4p cloud of mean
  // radius 14.6 bohr carried into 3s and then 2p, and after the moves
  // each slot holds its new orbital's density. The raised slot's
  // particles, in 2p, carry PTS_CORE / PTS_OUTER of a particle's ink.
  const rand = seeded(42)
  const c = C.Cloud.make(at('2p4p_1P_1'), 1, rand)
  const n = C.Cloud.N
  let worst = 0
  let prev = Float32Array.from(c.pts)
  const frames = k => {
    for (let f = 0; f < k; f++) {
      C.Cloud.step(c, 1 / 60, rand)
      assert.strictEqual(c.pts.length, 3 * n)
      for (let i = 0; i < n; i++) worst = Math.max(worst, Math.hypot(c.pts[3 * i] - prev[3 * i], c.pts[3 * i + 1] - prev[3 * i + 1], c.pts[3 * i + 2] - prev[3 * i + 2]))
      prev = Float32Array.from(c.pts)
    }
  }
  assert.deepStrictEqual(C.Cloud.to(c, at('2p3s_1Po_1'), 1), [5])
  frames(Math.round(60 * C.MORPH))
  for (const k of cloudKs(c)) assert.ok(k.d <= k.bound, `in 3s: ${k.what}: KS ${k.d.toFixed(4)} over ${k.bound.toFixed(4)}`)
  assert.deepStrictEqual(C.Cloud.to(c, at('2p2_3P_1'), 0), [5])
  frames(Math.round(20 * C.MORPH))
  assert.ok(C.Cloud.moving(c, 5) > 0.9 * C.PTS_OUTER, 'the move to 2p under way')
  assert.deepStrictEqual(C.Cloud.to(c, at('2p3s_1Po_1'), 0), [5])
  frames(Math.round(15 * C.MORPH))
  assert.deepStrictEqual(C.Cloud.to(c, at('2p2_3P_1'), 0), [5], 'a second move before the first ends')
  frames(Math.round(70 * C.MORPH))
  assert.strictEqual(C.Cloud.moving(c, 5), 0)
  for (const k of cloudKs(c)) assert.ok(k.d <= k.bound, `in 2p: ${k.what}: KS ${k.d.toFixed(4)} over ${k.bound.toFixed(4)}`)
  assert.ok(worst < 1, `a particle moved ${worst} bohr in a frame`)
  for (let i = C.Cloud.SLOT_AT[5]; i < n; i++) assert.ok(Math.abs(c.w[i] - C.PTS_CORE / C.PTS_OUTER) < 1e-6 && !c.amber[i])
  assert.ok(c.pts.every(Number.isFinite))
})

test('carbon: a cloud of M_L != 0 circulates about the axis, one of M_L = 0 does not', () => {
  // Madelung's current, m / rho_perp about z, through the noise: the
  // turn about z, x0 y1 - y0 x1, summed over each step of a quarter
  // second for 50 s and over the particles, which the swirl moves by m
  // times the step in atomic units where it is not clipped. The osmotic
  // drift has no part about z. The ground term 3P1: at M_L = 1 its 2p
  // particles hold m = 0 and 1, at M_L = 0 they hold m = -1 and 1 alike.
  // Unclipped, an m = 1 particle turns 4.1 bohr^2 in all, so M_L = 1
  // gives about 1.3 a particle. At M_L = 0 the draw of each particle's m
  // and the noise leave about 0.08 either way: the bound is 0.2 of
  // M_L = 1's, over three of those.
  const turned = M => {
    const rand = seeded(3)
    const c = C.Cloud.make(at('2p2_3P_1'), M, rand)
    let sum = 0
    for (let f = 0; f < 200; f++) {
      const before = Float32Array.from(c.pts)
      C.Cloud.step(c, 0.25, rand)
      for (let k = 0; k < C.Cloud.N; k++) sum += before[3 * k] * c.pts[3 * k + 1] - before[3 * k + 1] * c.pts[3 * k]
    }
    return sum / C.Cloud.N
  }
  const plus = turned(1)
  const minus = turned(-1)
  const none = turned(0)
  assert.ok(plus > 0.3, `M_L = +1 turns counterclockwise about z: ${plus}`)
  assert.ok(minus < -0.3, `and M_L = -1 the other way: ${minus}`)
  assert.ok(Math.abs(none) < 0.2 * plus, `M_L = 0 does not turn: ${none} against ${plus}`)
})

test('carbon: the radial samplers give each orbital\'s mean radius', () => {
  for (const k of ['1s', '2s', '2p']) {
    const m = C.meanR(C.table(k))
    assert.ok(Math.abs(m / D.rhf.meanR[k] - 1) < 0.015, `${k}: ${m} against Bunge's ${D.rhf.meanR[k]}`)
  }
  for (const [k, t] of Object.entries(D.outer)) {
    const m = C.meanR(C.table(k))
    assert.ok(Math.abs(m / t.meanR - 1) < 0.01, `${k}: ${m} against ${t.meanR}`)
  }
})

test('carbon: each radiation pattern sums over M to an isotropic one', () => {
  for (const [type, rank] of [['E1', 1], ['M1', 1], ['E2', 2]]) {
    const sums = [-1, -0.5, 0, 0.3, 0.9, 1].map(c => {
      let s = 0
      for (let q = -rank; q <= rank; q++) {
        // Each pattern normalized over the sphere first.
        let norm = 0
        for (let i = 0; i < 2000; i++) norm += C.pattern(type, q, -1 + (i + 0.5) / 1000) / 1000
        s += C.pattern(type, q, c) / norm
        assert.ok(C.pattern(type, q, c) <= C.patternMax(type, q) + 1e-12, `${type} ${q}: above its maximum`)
      }
      return s
    })
    for (const s of sums) assert.ok(Math.abs(s - sums[0]) < 1e-3, `${type}: ${sums}`)
  }
  // A detection direction follows the pattern: Delta M = 0 of E1, sin^2,
  // puts 0.6875 of its detections at |cos Theta| < 1/2.
  let near = 0
  const n = 20000
  for (let i = 0; i < n; i++) if (Math.abs(C.detectDir('E1', 0)[2]) < 0.5) near++
  assert.ok(Math.abs(near / n - 0.6875) < 0.02, `share near the equator ${near / n}`)
})

test('carbon: a jump\'s source is the product of the two orbitals the line moves', () => {
  const mv = C.mover(at('2p4p_1P_1'), at('2p3s_1Po_1'))
  assert.deepStrictEqual([mv.lf, mv.lt], [1, 0])
  assert.strictEqual(C.mover(at('2p4p_3P_2'), at('2s2p3_3Do_3')), null, 'a two-electron jump has no one-electron source')
  // 4p times 3s, Delta M = 0: the angular part is cos theta, so the sign
  // at each point is that of z times the radial product P_4p P_3s, and
  // the flash takes it at each particle of the 4p cloud where it stands.
  const sign = C.sourceSign(mv, 0)
  const rand = seeded(5)
  let wrong = 0
  let plus = 0
  for (let i = 0; i < 6000; i++) {
    const r = 40 * rand()
    const z = 2 * rand() - 1
    const ph = 2 * Math.PI * rand()
    const s = Math.sqrt(1 - z * z)
    const v = sign(r * s * Math.cos(ph), r * s * Math.sin(ph), r * z)
    if (Math.sign(z) * Math.sign(C.radialP(mv.from, r) * C.radialP(mv.to, r)) !== v) wrong++
    if (v > 0) plus++
  }
  assert.strictEqual(wrong, 0)
  assert.ok(plus > 2000 && plus < 4000, `both signs: ${plus} of 6000 positive`)
})

test('carbon: the Clebsch-Gordan weights leave an unaligned atom isotropic and an aligned one not', () => {
  // Summed over M_L, every radiating level's photon is isotropic: the
  // field's incoherent collisions make no beat. M_L = 0 of 2p4p 3P2,
  // the pulse's level, favours the directions across its axis.
  D.levels.forEach((l, i) => {
    if (!D.lines.some(x => x.u === i)) return
    const L = 'SPDF'.indexOf(l.term[1])
    const s = [0, 0, 0]
    for (let M = -L; M <= L; M++) C.emission(i, M).forEach((v, k) => { s[k] += v })
    assert.ok(Math.abs(s[1]) < 1e-9 * s[0] && Math.abs(s[2]) < 1e-9 * s[0], `${l.id}: ${s}`)
  })
  const p = C.emission(D.levels.findIndex(l => l.id === '2p4p_3P_2'), 0)
  assert.ok(p[1] > 0.3, `aligned 3P2: ${p}`)
  assert.strictEqual(C.cg(1, 0, 1, 0, 2, 0) ** 2, 2 / 3)
  for (const ln of D.lines) {
    for (const M of [-1, 0, 1]) {
      const w = C.Ensemble.weights(ln, M).reduce((s, e) => s + e[1], 0)
      assert.ok(Math.abs(w - 1) < 1e-12, 'weights sum to 1')
    }
  }
})

test('carbon: an axis turns about B at g_J mu_B B / h on the event clock, and stands along B', () => {
  const i = D.levels.findIndex(l => l.id === '2p2_3P_2')
  const b = { T: 1e-3, u: [1, 0, 0] }
  // 1.5010469 x 13.996 GHz/T x 1 mT / 5e6: 4.202 turns a second.
  const f = C.Larmor.rate(D.levels[i], b)
  assert.ok(Math.abs(f - 1.5010469 * 1.39962449171e10 * 1e-3 / C.EVENT) < 1e-9, `${f}`)
  assert.ok(Math.abs(f - 4.202) < 1e-3, `${f}`)
  // At the dial's start, 0.15 mT: 0.630 turns a second on screen, the
  // axis's look repeating at twice that, 1.26 a second, and 1.68 at
  // g_J 2, 2s2p3 5So2's.
  assert.ok(Math.abs(2 * C.Larmor.rate(D.levels[i], { T: C.B_START, u: [1, 0, 0] }) - 1.261) < 1e-3)
  const q = D.levels.find(l => l.id === '2s2p3_5So_2')
  assert.ok(Math.abs(2 * C.Larmor.rate(q, { T: C.B_START, u: [1, 0, 0] }) - 1.682) < 1e-3)
  const a = { lv: i, n: [0, 0, 1], t0: 0 }
  const t = 0.01
  const n = C.Larmor.axis(a, t, b)
  const ang = 2 * Math.PI * f * t
  // Right-handed about x: z goes toward -y.
  assert.ok(Math.abs(n[2] - Math.cos(ang)) < 1e-12 && Math.abs(n[1] + Math.sin(ang)) < 1e-12, `${n}`)
  assert.deepStrictEqual(C.Larmor.axis(a, 5, { T: 1e-3, u: [0, 0, 1] }).map(v => Math.round(v * 1e12) / 1e12), [0, 0, 1])
  assert.strictEqual(C.Larmor.rate(D.levels.find(l => l.J === 0), b), 0)
  // The drawn atom's frame: a rotation whose z column is the axis, for a
  // tilted B and a tilted axis.
  const tilt = { T: 0.7e-3, u: [Math.sin(1), 0, Math.cos(1)] }
  const n0 = C.turnAbout([0, 1, 0], 0.4, [0, 0, 1])
  const at = { lv: i, n: n0, t0: 0.2, O: C.rotation([0, 1, 0], 0.4) }
  const O = C.Larmor.frame(at, 1.37, tilt)
  const ax = C.Larmor.axis(at, 1.37, tilt)
  for (let r = 0; r < 3; r++) {
    assert.ok(Math.abs(O[3 * r + 2] - ax[r]) < 1e-12, `z column ${r}`)
    for (let c = 0; c < 3; c++) {
      const d = O[r] * O[c] + O[3 + r] * O[3 + c] + O[6 + r] * O[6 + c]
      assert.ok(Math.abs(d - (r === c ? 1 : 0)) < 1e-12, 'orthonormal')
    }
  }
})

// The lines of issue #167's table: 2p4d 3Fo2 to 2p2 3P1, 119.4 nm, and
// 2p4p 1P1 to 2p3s 1Po1, 538.2 nm, both in vacuum.
const line119 = () => D.lines.find(l => D.levels[l.u].id === '2p4d_3Fo_2' && D.levels[l.l].id === '2p2_3P_1')
const line538 = () => D.lines.find(l => D.levels[l.u].id === '2p4p_1P_1' && D.levels[l.l].id === '2p3s_1Po_1')

test('carbon: a front is its edge and a trail of lambda / TRAIL, its period lambda / c on the light clock', () => {
  const a = line119()
  const b = line538()
  assert.ok(Math.abs(a.vac - 119.43) < 0.01 && Math.abs(b.vac - 538.18) < 0.01, `${a.vac} ${b.vac}`)
  // Issue #167's table: 2256 and 10170 bohr, 94 and 424 times the view's
  // 24 bohr, periods 40 s and 180 s on a light clock of 1e17, so five
  // times those at 5e17.
  assert.ok(Math.abs(C.Front.lambda(a) - 2256) < 1, `${C.Front.lambda(a)}`)
  assert.ok(Math.abs(C.Front.lambda(b) - 10170) < 1, `${C.Front.lambda(b)}`)
  assert.strictEqual(Math.round(C.Front.lambda(a) / 24), 94)
  assert.strictEqual(Math.round(C.Front.lambda(b) / 24), 424)
  const slow = C.LIGHT / 1e17
  assert.ok(Math.abs(C.Front.period(a) / slow / 40 - 1) < 0.01, `${C.Front.period(a)}`)
  assert.ok(Math.abs(C.Front.period(b) / slow / 180 - 1) < 0.01, `${C.Front.period(b)}`)
  assert.ok(Math.abs(C.Front.period(a) - 199.1) < 0.1 && Math.abs(C.Front.period(b) - 897.6) < 0.1)
  assert.ok(Math.abs(C.Front.period(b) * C.Clock.light - C.Front.lambda(b)) < 1e-9)
  // The trail: lambda / 1e4, 0.2256 and 1.017 bohr, in the true ratio
  // of the wavelengths, 4.5.
  assert.strictEqual(C.TRAIL, 1e4)
  const fa = C.Front.make(0, a, 0, 0)
  const fb = C.Front.make(0, b, 0, 0)
  assert.ok(Math.abs(fa.trail - 0.2256) < 1e-4 && Math.abs(fb.trail - 1.0170) < 1e-4, `${fa.trail} ${fb.trail}`)
  assert.ok(Math.abs(fb.trail / fa.trail - b.vac / a.vac) < 1e-12)
  assert.ok(Math.abs(fb.trail / fa.trail - 4.507) < 1e-3)
  // Every front is in the near zone: lambda / 2 pi is past the view by
  // 15 times at the shortest line, and no crest is drawn.
  const shortest = D.lines.reduce((x, y) => y.vac < x.vac ? y : x)
  assert.ok(C.Front.lambda(shortest) / (2 * Math.PI) > 14 * 24)
  assert.ok(!('gap' in fa))
  const src = fs.readFileSync(require.resolve('../app/viz/carbon'), 'utf8')
  assert.ok(!/crest spacing a symbol|CRESTS/.test(src))
})

// The invisible fronts' pass on a fake canvas of 200 by 200 pixels, the
// site at its centre, 10 pixels a bohr: what it changes lies in the
// band behind the edge and nothing ahead of it.
function warped (ln, Rb) {
  const W = 200
  const data = new Uint8ClampedArray(W * W * 4)
  let s = 7
  for (let i = 0; i < data.length; i += 4) {
    s = (s * 1103515245 + 12345) % 2147483648
    const v = (s >> 16) & 255
    data[i] = data[i + 1] = data[i + 2] = v
    data[i + 3] = 255
  }
  const before = data.slice()
  const g = { getImageData: () => ({ data }), putImageData () {} }
  const fr = { cx: 100, cy: 100, k: 10, turn: (x, y, z) => ({ x, y: z, z: y }) }
  const f = C.Front.make(0, ln, 1, 0, [0, 0, 1])
  C.Warp.apply(g, [f], fr, { x: 0, y: 0, w: W, h: W }, Rb / C.Clock.light)
  const radii = []
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      if (data[i] !== before[i]) radii.push(Math.hypot(x - 100, y - 100))
    }
  }
  return { f, radii, R: Rb * fr.k, w: C.Warp.width(f, fr.k) }
}

test('carbon: the ultraviolet and infrared passes act across the trail behind the edge, and the haze has no ripple', () => {
  // 119.4 nm sharpens a band of 2.26 pixels at 10 pixels a bohr, 909.7
  // nm (2p3p 3P2 to 2p3s 3Po2) shifts one of 17.2: lambda / 1e4 each.
  const ir = D.lines.find(l => D.levels[l.u].id === '2p3p_3P_2' && D.levels[l.l].id === '2p3s_3Po_2')
  for (const [ln, w] of [[line119(), 2.256], [ir, 17.19]]) {
    const r = warped(ln, 6)
    assert.ok(Math.abs(r.w - w) < 0.01, `band ${r.w}`)
    assert.ok(r.radii.length > 20, `${ln.vac}: ${r.radii.length} pixels changed`)
    const lo = Math.min(...r.radii)
    const hi = Math.max(...r.radii)
    assert.ok(hi < r.R + 1 && lo >= Math.ceil(r.R - r.w), `${ln.vac}: changed from ${lo} to ${hi}, edge ${r.R}, band ${r.w}`)
  }
  // The profiles: the sharpening falls from the edge inward, the shift
  // is one lobe of one sign, HAZE at its peak, none outside the band.
  const fu = C.Front.make(0, line119(), 0, 0)
  const fi = C.Front.make(0, ir, 0, 0)
  assert.strictEqual(C.Warp.profile(fu, 0), 1)
  assert.strictEqual(C.Warp.profile(fi, 0.5), C.HAZE)
  let signs = 0
  let last = 0
  for (let u = 0; u <= 1; u += 0.01) {
    assert.ok(C.Warp.profile(fu, u + 0.01) <= C.Warp.profile(fu, u))
    const p = C.Warp.profile(fi, u)
    assert.ok(p >= 0)
    if (p > 0 && last === 0) signs++
    last = p
  }
  assert.strictEqual(signs, 1)
  assert.strictEqual(C.Warp.profile(fi, -0.01), 0)
  assert.strictEqual(C.Warp.profile(fu, 1.01), 0)
  // The least band, BAND_MIN pixels, where lambda / TRAIL is thinner.
  assert.strictEqual(C.Warp.width(fu, 1), C.BAND_MIN)
})

// Issue #168: the backdrop's grid is in bohr against the scale bar, its
// spacing a whole part of the bar's length and GRID_PX pixels or more,
// at the atom boxes of a full pane (about 12.7 pixels a bohr) and a
// small one (about 2).
test('carbon: the backdrop grid divides the scale bar and keeps its least spacing', () => {
  for (const [k, w] of [[12.7, 625], [2.06, 140], [3, 230], [6, 300], [25, 900], [1, 60]]) {
    const bar = C.barStep(k, w)
    const grid = C.gridStep(k, w)
    assert.ok(bar * k >= w * 0.1 || bar === 50, `bar ${bar} at ${k}, ${w}`)
    assert.strictEqual(bar % grid, 0, `grid ${grid} in bar ${bar}`)
    assert.ok(grid * k >= C.GRID_PX || grid === bar, `grid ${grid} at ${k}`)
  }
  assert.strictEqual(C.gridStep(12.7, 625), 1)
  assert.strictEqual(C.barStep(12.7, 625), 5)
  assert.strictEqual(C.gridStep(2.06, 140), 5)
  assert.strictEqual(C.barStep(2.06, 140), 10)
})
