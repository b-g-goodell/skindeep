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
    assert.strictEqual(C.waitMean(D.levels[i]), Infinity, 'the ground term rests')
  }
})

test('carbon: the clock, allowed waits slowed by one factor, slow ones real up to the cap', () => {
  const at = id => D.levels.find(l => l.id === id)
  assert.ok(Math.abs(C.waitMean(at('2p4p_1P_1')) - at('2p4p_1P_1').tau * 2e7) < 1e-12)
  assert.strictEqual(C.waitMean(at('2s2p3_5So_2')), at('2s2p3_5So_2').tau)
  assert.strictEqual(C.waitMean(at('2p2_1S_0')), at('2p2_1S_0').tau)
  assert.strictEqual(C.waitMean(at('2p2_1D_2')), 8)
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
  const at = id => D.levels.find(l => l.id === id)
  const mv = C.mover(at('2p4p_1P_1'), at('2p3s_1Po_1'))
  assert.deepStrictEqual([mv.lf, mv.lt], [1, 0])
  assert.strictEqual(C.mover(at('2p4p_3P_2'), at('2s2p3_3Do_3')), null, 'a two-electron jump has no one-electron source')
  // 4p times 3s, Delta M = 0: the angular part is cos theta, so the
  // mean |cos theta| of the points is 2/3, and each point's sign is that
  // of z times the radial product P_4p P_3s.
  const p = C.source(mv, 0, 6000)
  let mean = 0
  let wrong = 0
  for (let i = 0; i < p.length; i += 4) {
    const r = Math.hypot(p[i], p[i + 1], p[i + 2])
    mean += Math.abs(p[i + 2]) / r
    if (Math.sign(p[i + 2]) * Math.sign(C.radialP(mv.from, r) * C.radialP(mv.to, r)) !== p[i + 3]) wrong++
  }
  mean /= p.length / 4
  assert.ok(Math.abs(mean - 2 / 3) < 0.02, `mean |cos theta| ${mean}`)
  assert.strictEqual(wrong, 0)
})
