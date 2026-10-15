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

// The main process maps a click to a pane with the arithmetic the page
// lays the panes out with.
test('the panes tile the window, and a point maps back to its pane', () => {
  const layout = require('../app/viz/layout')
  const { window } = loadPage()
  assert.strictEqual(typeof window.VizLayout.at, 'function', 'the page loads layout.js')
  assert.deepStrictEqual(layout.grid(1, 720, 460), { cols: 1, rows: 1 })
  assert.deepStrictEqual(layout.grid(2, 720, 460), { cols: 2, rows: 1 })
  assert.deepStrictEqual(layout.grid(2, 400, 900), { cols: 1, rows: 2 })
  for (const [W, H] of [[720, 460], [333, 701]]) {
    for (let n = 1; n <= 7; n++) {
      let area = 0
      for (let i = 0; i < n; i++) {
        const r = layout.rect(i, n, W, H)
        area += r.w * r.h
        assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H, `${n} at ${W}x${H}: pane ${i} outside`)
        for (const [x, y] of [[r.x, r.y], [r.x + r.w - 1, r.y + r.h - 1], [r.x + r.w / 2, r.y + r.h / 2]]) assert.strictEqual(layout.at(x, y, n, W, H), i, `${n} at ${W}x${H}: (${x}, ${y})`)
      }
      const { cols, rows } = layout.grid(n, W, H)
      assert.ok(area <= W * H && (cols * rows === n ? area === W * H : true), `${n} at ${W}x${H}: panes overlap or leave a gap`)
    }
  }
  assert.strictEqual(layout.at(-1, 5, 2, 720, 460), -1)
})

test('the procedural modes follow the ten, each its own renderer file', () => {
  assert.deepStrictEqual(MODES.map(m => m.id), ['drift', 'rings', 'plasma', 'stardust', 'whirlpool', 'scope', 'analyzer', 'fire', 'superscope', 'dotplane', 'fern', 'go', 'zoom', 'gravity', 'quantum'])
  const html = fs.readFileSync(path.join(VIZ, 'index.html'), 'utf8')
  for (const id of ['fern', 'go', 'zoom', 'gravity', 'quantum']) assert.ok(html.includes(`<script src="${id}.js">`), `${id}.js not loaded`)
})

// Go on a 5 by 5 board. at(x, y) is the point.
const go = require('../app/viz/go')
const at = (x, y) => y * 5 + x
function board (stones) {
  const b = new go.Board(5)
  for (const [c, x, y] of stones) b.cells[at(x, y)] = c
  return b
}
const B = go.BLACK
const W = go.WHITE

test('go: a stone or a group without liberties is captured', () => {
  let b = board([[W, 1, 1], [B, 0, 1], [B, 1, 0], [B, 2, 1]])
  assert.deepStrictEqual(b.play(at(1, 2), B), [at(1, 1)])
  assert.strictEqual(b.cells[at(1, 1)], 0)
  b = board([[W, 1, 1], [W, 2, 1], [B, 0, 1], [B, 3, 1], [B, 1, 0], [B, 2, 0], [B, 1, 2]])
  assert.deepStrictEqual(b.play(at(2, 2), B).sort(), [at(1, 1), at(2, 1)].sort())
  assert.strictEqual(b.group(at(2, 2)).libs.size, 6, 'joined to (1, 2), with the two points freed')
})

test('go: suicide is refused, a move that captures first is not suicide', () => {
  let b = board([[B, 1, 0], [B, 0, 1]])
  assert.strictEqual(b.play(at(0, 0), W), null)
  assert.strictEqual(b.cells[at(0, 0)], 0, 'the refused stone is lifted')
  b = board([[W, 1, 0], [W, 0, 1], [B, 2, 0], [B, 1, 1], [B, 0, 2]])
  assert.strictEqual(b.copy().play(at(0, 0), W), null, 'three white stones with no liberty')
  assert.deepStrictEqual(b.play(at(0, 0), B).sort(), [at(1, 0), at(0, 1)].sort())
  assert.strictEqual(b.play(at(0, 0), B), null, 'the point is taken')
})

test('go: a single stone just captured may not be retaken at once (ko)', () => {
  const b = board([[B, 1, 0], [B, 0, 1], [B, 1, 2], [W, 1, 1], [W, 2, 0], [W, 3, 1], [W, 2, 2]])
  assert.deepStrictEqual(b.play(at(2, 1), B), [at(1, 1)])
  assert.strictEqual(b.play(at(1, 1), W), null, 'ko')
  assert.deepStrictEqual(b.play(at(4, 4), W), [])
  assert.deepStrictEqual(b.play(at(0, 4), B), [])
  assert.deepStrictEqual(b.play(at(1, 1), W), [at(2, 1)], 'the ko is free after a move elsewhere')
})

test('go: the mover takes a capture, never fills its own eye, and counts territory', () => {
  const b = board([[W, 1, 1], [B, 0, 1], [B, 1, 0], [B, 2, 1]])
  assert.strictEqual(go.choose(b, B, 4, -1, () => 0), at(1, 2))
  const full = board([])
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if ((x + y) % 2 || x === 2) full.cells[at(x, y)] = B
  for (let k = 0; k < 25; k++) if (!full.cells[k]) assert.ok(full.eye(k, B), `${k} is an eye`)
  assert.strictEqual(go.choose(full, B, 2, -1), -1, 'black passes rather than fill its eyes')
  const wall = board([])
  for (let y = 0; y < 5; y++) {
    wall.cells[at(1, y)] = B
    wall.cells[at(3, y)] = W
  }
  const own = go.territory(wall)
  assert.deepStrictEqual([0, 1, 2, 3, 4].map(x => own[at(x, 2)]), [B, B, 0, W, W])
  const small = go.territory(wall, 4)
  assert.deepStrictEqual([0, 1, 2, 3, 4].map(x => small[at(x, 2)]), [0, B, 0, W, 0], 'a region of five is open ground')
})

const quantum = require('../app/viz/quantum')

test('quantum: the split-step is unitary and a free packet moves at its momentum', () => {
  const w = new quantum.Wave(64, 32, 0.5)
  w.packet(16, 16, 4, 5, 1.1, 0.2)
  const V = Float64Array.from({ length: 64 * 32 }, (_, i) => (i % 64 >= 30 && i % 64 < 33 && Math.abs(Math.floor(i / 64) - 16) > 3 ? 4 : 0.3 * Math.sin(i)))
  w.potential(V)
  const n0 = w.norm()
  assert.ok(Math.abs(n0 - 1) < 5e-3, `norm ${n0}`)
  for (let k = 0; k < 200; k++) w.step()
  assert.ok(Math.abs(w.norm() - n0) < 1e-9, `norm ${n0} became ${w.norm()}`)

  const f = new quantum.Wave(128, 32, 0.5)
  f.packet(16, 16, 4, 4, 1, 0)
  for (let k = 0; k < 40; k++) f.step()
  let m = 0
  for (let i = 0; i < f.re.length; i++) m += (i % 128) * (f.re[i] * f.re[i] + f.im[i] * f.im[i])
  m /= f.norm()
  assert.ok(Math.abs(m - 36) < 0.5, `mean x ${m}, want 16 + 1 * 20`)

  // A measurement draws a point where the wave is.
  const i = f.sample(() => 0.5)
  assert.ok(Math.abs(i % 128 - 36) < 6, `sampled x ${i % 128}`)
})

test('quantum: the FFT inverts', () => {
  const p = quantum.plan(16)
  const re = Float64Array.from({ length: 16 }, (_, i) => Math.sin(i * 1.3) + i)
  const im = Float64Array.from({ length: 16 }, (_, i) => Math.cos(i * 0.7))
  const r0 = Float64Array.from(re)
  quantum.fft(re, im, 0, 1, p, -1)
  assert.ok(Math.abs(re[0] - r0.reduce((a, b) => a + b, 0)) < 1e-9, 'the zero frequency is the sum')
  quantum.fft(re, im, 0, 1, p, 1)
  for (let i = 0; i < 16; i++) assert.ok(Math.abs(re[i] / 16 - r0[i]) < 1e-9)
})

test('gravity: an orbit keeps its energy, and a merger keeps mass and momentum', () => {
  const gravity = require('../app/viz/gravity')
  const body = (x, y, vx, vy, m) => ({ x, y, vx, vy, m, r: 1, ax: 0, ay: 0 })
  const bodies = [body(0, 0, 0, 0, 1000), body(100, 0, 0, Math.sqrt(1000 / 100), 1)]
  gravity.centre(bodies)
  const energy = () => {
    const [a, b] = bodies
    const d = Math.hypot(a.x - b.x, a.y - b.y)
    return 0.5 * (a.m * (a.vx ** 2 + a.vy ** 2) + b.m * (b.vx ** 2 + b.vy ** 2)) - a.m * b.m / Math.sqrt(d * d + 9)
  }
  const e0 = energy()
  for (let k = 0; k < 2000; k++) gravity.step(bodies, 0.25)
  assert.ok(Math.abs(energy() / e0 - 1) < 1e-3, `energy ${e0} became ${energy()}`)
  const pair = [body(0, 0, 1, 0, 3), body(1, 0, -1, 2, 1)]
  const merged = gravity.step(pair, 0.01)
  assert.strictEqual(pair.length, 1)
  assert.strictEqual(merged.length, 1)
  assert.strictEqual(pair[0].m, 4)
  assert.ok(Math.abs(pair[0].vx * 4 - 2) < 0.05 && Math.abs(pair[0].vy * 4 - 2) < 0.05, 'momentum (2, 2)')
})

test('fern: every species is a set of contractions whose weights sum to one', () => {
  const fern = require('../app/viz/fern')
  for (const [k, maps] of fern.SPECIES.entries()) {
    assert.strictEqual(maps.length, 4)
    assert.ok(Math.abs(maps.reduce((s, m) => s + m[6], 0) - 1) < 1e-3, `species ${k}: weights`)
    for (const m of maps) assert.ok(Math.abs(m[0] * m[3] - m[1] * m[2]) < 1, `species ${k}: a map that expands`)
  }
  const box = [Infinity, -Infinity, Infinity, -Infinity]
  const cum = [0.01, 0.86, 0.93, 1]
  fern.iterate(fern.SPECIES[0], cum, 20000, { x: 0, y: 0 }, (x, y) => {
    box[0] = Math.min(box[0], x)
    box[1] = Math.max(box[1], x)
    box[2] = Math.min(box[2], y)
    box[3] = Math.max(box[3], y)
  })
  assert.ok(box[0] > -2.3 && box[1] < 2.8 && box[2] >= 0 && box[3] < 10.1 && box[3] > 9.5, `Barnsley's fern spans ${box}`)
})

// A fake Canvas2D context that records every stroke colour.
function recorder () {
  const strokes = []
  const g = new Proxy({}, {
    get (t, k) {
      if (k === 'strokes') return strokes
      if (k === 'strokeStyle') return t.strokeStyle
      return (v) => { if (k === 'stroke') strokes.push(g.strokeStyle) }
    },
    set (t, k, v) { if (k === 'strokeStyle') t.strokeStyle = v; return true }
  })
  return g
}

test('scope: a class 3 tool flash is red, hue 0, and an unknown class falls back to 200', () => {
  const { window } = loadPage()
  const g = recorder()
  const r = window.VizCanvas.scope({ width: 400, height: 200, getContext: () => g })
  const synth = { t: 1, level: { treble: 0, bass: 0, busy: 0 }, bands: [0, 0], samples: new Float32Array(16), flashes: [{ kind: 2, cls: 3, t: 0.9 }, { kind: 2, cls: 9, t: 0.9 }] }
  r.draw(synth)
  const hues = g.strokes.map(s => s.match(/^hsla\((\d+),/)).filter(Boolean).map(m => Number(m[1]))
  assert.ok(hues.includes(0), `class 3 ring stroked with hue 0, got ${JSON.stringify(g.strokes)}`)
  assert.ok(hues.includes(200), `unknown class falls back to hue 200, got ${JSON.stringify(g.strokes)}`)
})
