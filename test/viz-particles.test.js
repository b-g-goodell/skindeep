'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { world, create } = require('../app/viz/particles')
const { rng } = require('../scripts/fuzz/model')

for (const filaments of [false, true]) {
  test(`particles: a click leaves an impulse after release, filaments ${filaments}`, () => {
    const a = world(1.6, filaments, rng(233), 120)
    const b = world(1.6, filaments, rng(233), 120)
    a.poke(a.p[0].x + 0.03, a.p[0].y)
    a.point(null)
    assert.ok(a.p[0].vx < 0)
    for (const p of a.p) assert.ok(Math.hypot(p.vx, p.vy) <= 0.350001)
    a.step(1 / 60, 0)
    b.step(1 / 60, 0)
    assert.notDeepEqual(a.p, b.p)
  })

  test(`particles: a click before the first draw is handled and reported, filaments ${filaments}`, () => {
    const canvas = { width: 720, height: 460, getContext: () => ({ fillRect () {} }) }
    const mode = create(canvas, {}, filaments)
    assert.equal(mode.probe().presses, 0)
    mode.pointer('down', 360, 230, true)
    mode.pointer('up', 360, 230, false)
    assert.equal(mode.probe().presses, 1)
    assert.ok(mode.probe().particles > 0)
  })

  test(`particles: bounded motion at idle and under activity, filaments ${filaments}`, () => {
    const a = world(1.6, filaments, rng(233), 120)
    const b = world(1.6, filaments, rng(233), 120)
    const start = a.p.map(p => [p.x, p.y])
    for (let k = 0; k < 180; k++) {
      a.step(1 / 60, 0)
      b.step(1 / 60, 1)
    }
    assert.notDeepEqual(a.p.map(p => [p.x, p.y]), start)
    assert.notDeepEqual(a.p, b.p)
    a.point(0.8, 0.5)
    a.excite()
    for (let k = 0; k < 180; k++) a.step(1 / 30, 1)
    for (const p of a.p) {
      assert.ok(p.x >= 0 && p.x < 1.6 && p.y >= 0 && p.y < 1)
      assert.ok(Math.hypot(p.vx, p.vy) <= 0.350001)
    }
  })
}
