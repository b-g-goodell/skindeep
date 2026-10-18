'use strict'
// The butterchurn presets' steps scaled to the time since the frame
// drawn before (decision 0036, app/viz/presets.js): k = 60 dt frames of
// 1/60 s. A factor a frame becomes its k-th power, a term a frame k
// times itself, and what goes into the feedback k times its alpha, so
// that every preset moves at one speed at any frame rate.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { MODES } = require('../app/viz/modes')

const ctx = vm.createContext({ Math })
ctx.window = ctx
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'app', 'viz', 'presets.js'), 'utf8'), ctx, { filename: 'presets.js' })
// An equation as butterchurn compiles it, in the page's globals.
const eq = src => vm.runInContext(`(function (a) { ${src || ''} return a; })`, ctx)

// One frame of preset p at step k: the frame's values, a vertex's, and
// each custom wave's alpha. Math.random is fixed, so two runs agree.
function frame (p, k, level) {
  ctx.VizStep.k = k
  const audio = { time: 7.3, frame: 220, fps: 60, bass: level, mid: level, treb: level, bass_att: level, mid_att: level, treb_att: level, vol: level }
  const base = Object.assign({ zoom: 1, rot: 0, warp: 0, dx: 0, dy: 0, sx: 1, sy: 1, wave_a: 1, ob_a: 0, ib_a: 0, mv_a: 0 }, p.baseVals)
  const a = eq(p.init_eqs_str)(Object.assign({}, base, audio))
  const f = eq(p.frame_eqs_str)(Object.assign({}, a, audio))
  const v = eq(p.pixel_eqs_str)(Object.assign({}, f, { x: 0.62, y: 0.41, rad: 0.25, ang: 0.7 }))
  const waves = p.waves.map(w => eq(w.frame_eqs_str)(Object.assign({}, w.baseVals, f)).a)
  return { f, v, waves }
}

const near = (x, y, at) => assert.ok(Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(y)), `${at}: ${x} against ${y}`)

test('each preset\'s warp at k steps is its warp of one step applied k times', () => {
  const milk = MODES.filter(m => m.kind === 'milk')
  assert.strictEqual(milk.length, 5)
  for (const m of milk) {
    const p = ctx.VizPresets[m.id]
    for (const level of [0, 0.5, 2]) {
      const one = frame(p, 1, level)
      for (const k of [0.6, 2.5, 4, 6]) {
        const at = `${m.id} at k ${k}, level ${level}`
        const r = frame(p, k, level)
        assert.strictEqual(r.f.q32, k, `${at}: q32`)
        for (const key of ['zoom', 'sx', 'sy']) near(r.v[key], Math.pow(one.v[key], k), `${at}: ${key}`)
        for (const key of ['rot', 'dx', 'dy', 'warp']) near(r.v[key], one.v[key] * k, `${at}: ${key}`)
        for (const key of ['wave_a', 'ob_a', 'ib_a', 'mv_a']) near(r.f[key], one.f[key] * k, `${at}: ${key}`)
        r.waves.forEach((x, i) => near(x, one.waves[i] * k, `${at}: wave ${i} alpha`))
      }
    }
  }
})

test('without the page\'s step, as the equations run alone, k is 1', () => {
  const p = ctx.VizPresets.drift
  const f = new Function('a', `${p.frame_eqs_str} return a;`)({ wave_a: 0.9, ob_a: 0.4, ib_a: 0, mv_a: 0, bass_att: 1, mid_att: 1, treb_att: 1, time: 1 }) // eslint-disable-line no-new-func
  assert.strictEqual(f.q32, 1)
})

test('every warp shader fades by q32 steps', () => {
  for (const m of MODES.filter(m => m.kind === 'milk')) {
    const w = ctx.VizPresets[m.id].warp
    const body = w.slice(w.indexOf('{') + 1, w.lastIndexOf('}'))
    for (const line of body.split('\n').filter(l => /ret\s*(-|\*)=|ret = .*\*/.test(l))) assert.match(line, /q32/, `${m.id}: ${line}`)
    assert.match(body, /ret -= [0-9.]+\*q32;/, `${m.id}: no scaled fade`)
  }
})
