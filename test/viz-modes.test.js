'use strict'
// The visualization's modes (decision 0015): every mode the menu lists
// has a renderer among the scripts the viz page loads, and the
// butterchurn presets' equations give finite numbers.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { MODES } = require('../app/viz/modes')

const VIZ = path.join(__dirname, '..', 'app', 'viz')

// The page's own scripts, in its order, run against a bare window: they
// only register at load and touch no DOM until a renderer is created.
function loadPage () {
  const html = fs.readFileSync(path.join(VIZ, 'index.html'), 'utf8')
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => !s.includes('node_modules') && s !== 'viz.js')
  // The window is the global, as in a page.
  const window = { Math, Float32Array, Uint32Array, Array, Object }
  window.window = window
  const ctx = vm.createContext(window)
  for (const s of srcs) vm.runInContext(fs.readFileSync(path.join(VIZ, s), 'utf8'), ctx, { filename: s })
  return { window, srcs }
}

test('mode ids and labels are unique, and every kind is known', () => {
  assert.ok(MODES.length >= 2)
  assert.strictEqual(new Set(MODES.map(m => m.id)).size, MODES.length)
  assert.strictEqual(new Set(MODES.map(m => m.label)).size, MODES.length)
  for (const m of MODES) {
    assert.match(m.id, /^[a-z]+$/, m.id)
    assert.ok(['milk', 'canvas'].includes(m.kind), `${m.id}: kind ${m.kind}`)
  }
})

test('every mode the menu lists has a renderer the viz page loads', () => {
  const { window, srcs } = loadPage()
  assert.ok(srcs.includes('modes.js'), 'the page loads modes.js')
  assert.deepStrictEqual(Array.from(window.VizModes, m => m.id), MODES.map(m => m.id))
  for (const m of MODES) {
    if (m.kind === 'milk') assert.ok(window.VizPresets[m.id], `${m.id}: no butterchurn preset`)
    else assert.strictEqual(typeof window.VizCanvas[m.id], 'function', `${m.id}: no Canvas2D renderer`)
  }
  // A milk mode without WebGL2 shows the scope.
  assert.strictEqual(typeof window.VizCanvas.scope, 'function')
  // Nothing is drawn that the menu cannot pick.
  const ids = new Set(MODES.map(m => m.id))
  for (const k of [...Object.keys(window.VizPresets), ...Object.keys(window.VizCanvas)]) assert.ok(ids.has(k), `${k}: drawn but not a mode`)
})

// Butterchurn compiles each equation string as new Function('a', eqs +
// ' return a;') and keeps a NaN it returns, so the screen goes black.
test('preset equations give finite numbers for quiet and loud input', () => {
  const { window } = loadPage()
  const fn = src => new Function('a', `${src || ''} return a;`) // eslint-disable-line no-new-func
  const OUT = ['zoom', 'rot', 'warp', 'cx', 'cy', 'dx', 'dy', 'sx', 'sy', 'decay', 'wave_r', 'wave_g', 'wave_b', 'wave_a', 'wave_x', 'wave_y', 'q1']
  for (const m of MODES.filter(m => m.kind === 'milk')) {
    const p = window.VizPresets[m.id]
    for (const level of [0, 0.5, 3]) {
      const audio = { time: 7.3, frame: 220, fps: 60, bass: level, mid: level, treb: level, bass_att: level, mid_att: level, treb_att: level, vol: level }
      const a = fn(p.init_eqs_str)(Object.assign({}, p.baseVals, audio))
      const f = fn(p.frame_eqs_str)(Object.assign({}, a, audio))
      for (const k of OUT) if (k in f) assert.ok(Number.isFinite(f[k]), `${m.id} frame ${k} = ${f[k]} at level ${level}`)
      for (const rad of [0, 0.05, 0.5, 0.71]) {
        for (const ang of [-3, 0, 1.5]) {
          const x = 0.5 + rad * Math.cos(ang)
          const y = 0.5 + rad * Math.sin(ang)
          const px = fn(p.pixel_eqs_str)(Object.assign({}, f, { x, y, rad, ang }))
          for (const k of OUT) if (k in px) assert.ok(Number.isFinite(px[k]), `${m.id} pixel ${k} = ${px[k]} at rad ${rad}, level ${level}`)
        }
      }
      for (const [i, w] of p.waves.entries()) {
        const wf = fn(w.frame_eqs_str)(Object.assign({}, w.baseVals, f))
        for (const sample of [0, 0.5, 1]) {
          const pt = fn(w.point_eqs_str)(Object.assign({}, wf, { sample, value1: 0.1, value2: -0.1, x: 0.6, y: 0.4 }))
          for (const k of ['x', 'y', 'r', 'g', 'b', 'a']) assert.ok(Number.isFinite(pt[k]), `${m.id} wave ${i} ${k} = ${pt[k]}`)
        }
      }
    }
  }
})
