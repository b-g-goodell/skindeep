'use strict'
// Every Canvas2D mode moves at one speed at any frame rate (decision
// 0036): each is drawn on stub canvases at 15 and at 60 frames a second
// over the same wall time, its signal held steady, and its motion a
// second compared: the fade of each canvas that keeps its pixels from
// frame to frame, Dot plane's turn, Quantum's simulated time, and the
// light Fern's buffer holds.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { MODES } = require('../app/viz/modes')

const VIZ = path.join(__dirname, '..', 'app', 'viz')
const W = 200
const H = 130
const WARM = 0.5
const SPAN = 2
const LEVEL = { bass: 1, treble: 0.3, busy: 1, idle: 0 }

// A 2D context that draws nothing and records each fill: its style,
// alpha, box, and each putImageData.
function context (canvas) {
  const s = { fillStyle: '#000', strokeStyle: '#000', globalAlpha: 1, globalCompositeOperation: 'source-over', font: '10px sans-serif', lineWidth: 1 }
  const image = (w, h) => (typeof w === 'object' ? image(w.width, w.height) : { width: w, height: h, data: new Uint8ClampedArray(4 * Math.max(1, w) * Math.max(1, h)) })
  const fns = {
    fillRect: (x, y, w, h) => canvas.ops.push({ fill: s.fillStyle, alpha: s.globalAlpha, op: s.globalCompositeOperation, x, y, w, h }),
    createImageData: image,
    getImageData: (x, y, w, h) => image(w, h),
    putImageData: () => canvas.ops.push({ put: true }),
    measureText: t => ({ width: 6 * String(t).length, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 6 * String(t).length, fontBoundingBoxAscent: 9, fontBoundingBoxDescent: 3 }),
    createLinearGradient: () => ({ addColorStop () {} }),
    createRadialGradient: () => ({ addColorStop () {} }),
    createConicGradient: () => ({ addColorStop () {} }),
    createPattern: () => ({}),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    isPointInPath: () => false
  }
  return new Proxy(s, {
    get: (t, k) => (k in fns ? fns[k] : k === 'canvas' ? canvas : k in t ? t[k] : () => {}),
    set: (t, k, v) => { t[k] = v; return true }
  })
}

// One page of the viz scripts, its Math.random seeded again by seed(),
// and the canvases made since, in order. Loaded once: each mode's state
// is its create()'s own.
function page () {
  const canvases = []
  const canvas = (w, h) => {
    const c = { width: w, height: h, ops: [], style: {}, addEventListener () {}, ownerDocument: null }
    let g = null
    c.getContext = () => (g = g || context(c))
    c.ownerDocument = { defaultView: { innerWidth: W, innerHeight: H, devicePixelRatio: 1 } }
    canvases.push(c)
    return c
  }
  let state = 12345
  const M = Object.create(Math)
  M.random = () => (state = (state * 16807) % 2147483647) / 2147483647
  class ImageData {
    constructor (w, h) {
      Object.assign(this, { width: w, height: h, data: new Uint8ClampedArray(4 * w * h) })
    }
  }
  function Path2D () {
    return new Proxy({}, { get: () => () => {} })
  }
  const ctx = vm.createContext({ Math: M, ImageData, Path2D, performance: { now: () => 0 }, document: { createElement: () => canvas(300, 150) }, console })
  ctx.window = ctx
  const html = fs.readFileSync(path.join(VIZ, 'index.html'), 'utf8')
  for (const src of [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => !s.includes('node_modules') && s !== 'viz.js')) {
    vm.runInContext(fs.readFileSync(path.join(VIZ, src), 'utf8'), ctx, { filename: src })
  }
  const seed = () => {
    state = 12345
    canvases.length = 0
  }
  return { ctx, canvas, canvases, seed }
}
const viz = page()

// Mode id drawn at fps for WARM and then SPAN seconds: its probe before
// and after the span, and per canvas that keeps its pixels through the
// span, the log of what its fades leave of it a second.
function run (id, fps) {
  const { ctx, canvas, canvases, seed } = viz
  seed()
  const main = canvas(W, H)
  // Gravity 3D's trace at its least, for the test's time.
  const mode = ctx.VizCanvas[id](main, { text: () => 1, trace: () => 2000 })
  // A steady signal: the synthesiser's levels, a tone and flat bands,
  // and no events.
  const synth = { t: 0, level: Object.assign({}, LEVEL), samples: Float32Array.from({ length: 1024 }, (_, n) => 0.5 * Math.sin(n / 9)), bands: new Float32Array(48).fill(0.3), flashes: [], touches: [], voices: [], beats: 0, rises: 0, since: () => [], bytes: () => new Uint8Array(1024).fill(128) }
  const dt = 1 / fps
  const frames = n => {
    for (let k = 0; k < n; k++) {
      synth.t += dt
      mode.draw(synth, dt)
    }
  }
  frames(Math.round(WARM * fps))
  for (const c of canvases) c.ops = []
  const before = mode.probe ? mode.probe() : null
  frames(Math.round(SPAN * fps))
  const after = mode.probe ? mode.probe() : null
  const fades = canvases.map(c => {
    const whole = o => o.fill !== undefined && o.x <= 0 && o.y <= 0 && o.x + o.w >= c.width && o.y + o.h >= c.height
    if (c.ops.some(o => o.put || (whole(o) && o.alpha >= 1 && !/^rgba\(.*,\s*0?\.\d+\)$/.test(o.fill)))) return null
    let ln = 0
    for (const o of c.ops) {
      const m = whole(o) && o.op === 'source-over' && /^rgba\(0, 0, 0, ([0-9.e-]+)\)$/.exec(o.fill)
      if (m) ln += Math.log(1 - Number(m[1]) * o.alpha)
    }
    return ln / SPAN
  })
  return { before, after, fades }
}

const canvasModes = MODES.filter(m => m.kind === 'canvas').map(m => m.id)
const runs = new Map(canvasModes.map(id => [id, { slow: run(id, 15), fast: run(id, 60) }]))
const within = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b))

test('every Canvas2D mode\'s fades leave as much of a canvas a second at 15 frames a second as at 60', () => {
  // The canvases that keep their pixels and fade, in the order made. A
  // cache shared by the page's modes is made once, so canvases are not
  // matched by count.
  const fading = r => r.fades.filter(x => x !== null && x !== 0)
  let seen = 0
  for (const [id, { slow, fast }] of runs) {
    const s = fading(slow)
    const f = fading(fast)
    assert.strictEqual(s.length, f.length, `${id}: ${s.length} fading canvases at 15 fps, ${f.length} at 60`)
    s.forEach((x, i) => {
      seen++
      assert.ok(within(x, f[i], 0.03), `${id}: canvas ${i} fades by ${x.toFixed(3)} a second at 15 fps against ${f[i].toFixed(3)} at 60`)
    })
  }
  // Scope's, Superscope's and Gravity's trails at least.
  assert.ok(seen >= 3, `only ${seen} fading canvases seen`)
})

test('Dot plane turns as many degrees a second at 15 frames a second as at 60', () => {
  const { slow, fast } = runs.get('dotplane')
  const turn = r => ((r.after.rotation - r.before.rotation) % 360 + 360) % 360 / SPAN
  assert.ok(within(turn(slow), turn(fast), 0.03), `${turn(slow).toFixed(2)} degrees a second at 15 fps against ${turn(fast).toFixed(2)} at 60`)
})

test('Quantum\'s simulated time keeps wall time alike at 15 and 60 frames a second', () => {
  const { slow, fast } = runs.get('quantum')
  const rate = r => (r.after.time - r.before.time) / SPAN
  assert.ok(within(rate(slow), rate(fast), 0.03), `${rate(slow).toFixed(3)} a second at 15 fps against ${rate(fast).toFixed(3)} at 60`)
})

test('Fern\'s buffer holds as much light at 15 frames a second as at 60', () => {
  const { slow, fast } = runs.get('fern')
  assert.ok(slow.after.light > 0 && within(slow.after.light, fast.after.light, 0.15), `${slow.after.light.toFixed(1)} at 15 fps against ${fast.after.light.toFixed(1)} at 60`)
})
