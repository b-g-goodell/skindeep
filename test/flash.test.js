'use strict'
// The flash counter of scripts/flash.js (issue #164) on frames of known
// flashes: WCAG 2.2's general and red flash, its area and its darker
// image below 0.80.
const test = require('node:test')
const assert = require('node:assert')
const { Counter, AREA } = require('../scripts/flash')

// Frames of w by h at fps for s seconds, each pixel's grey (or [r, g,
// b]) from paint(x, y, t).
function run (w, h, fps, s, paint, window) {
  const c = Counter(w, h, fps, window)
  const d = new Uint8ClampedArray(4 * w * h)
  for (let f = 0; f < fps * s; f++) {
    const t = f / fps
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = paint(x, y, t)
        const i = 4 * (y * w + x)
        const [r, g, b] = Array.isArray(v) ? v : [v, v, v]
        d[i] = r
        d[i + 1] = g
        d[i + 2] = b
        d[i + 3] = 255
      }
    }
    c.push(d, t)
  }
  return c.report()
}

const square = hz => t => Math.floor(2 * hz * t + 1e-9) % 2

test('flash: a whole field in black and white counts each period once', () => {
  for (const hz of [5, 3]) {
    const r = run(400, 300, 60, 3, (x, y, t) => 255 * square(hz)(t))
    assert.deepStrictEqual([r.frame.general.n, r.window.general.n], [hz, hz])
  }
})

test('flash: under a quarter of a field does not count, over it does', () => {
  const side = Math.floor(Math.sqrt(AREA))
  const small = run(400, 300, 30, 2, (x, y, t) => x < side - 4 && y < side - 4 ? 255 * square(10)(t) : 0)
  assert.strictEqual(small.window.general.n, 0)
  // Each of its cells still flashes 10 times a second.
  assert.strictEqual(small.cell.n, 10)
  const big = run(400, 300, 30, 2, (x, y, t) => x < side + 4 && y < side + 4 ? 255 * square(10)(t) : 0)
  assert.deepStrictEqual([big.frame.general.n, big.window.general.n], [10, 10])
})

test('flash: flashes within one window are concurrent, a window apart they are not', () => {
  // Two halves of a quarter field, each alone under the area, flashing
  // at 2 Hz 50 ms apart: one flash of the field a period within 0.1 s,
  // none within one frame.
  const side = Math.ceil(Math.sqrt(AREA)) + 4
  const paint = (x, y, t) => x < side && y < side ? 255 * square(2)(t - (x < side / 2 ? 0 : 0.05)) : 0
  const r = run(400, 300, 60, 3, paint)
  assert.strictEqual(r.window.general.n, 2)
  assert.strictEqual(r.frame.general.n, 0)
  // A whole field at 5 Hz is still 5 within 0.1 s.
  assert.strictEqual(run(400, 300, 60, 3, (x, y, t) => 255 * square(5)(t), 0.1).window.general.n, 5)
})

test('flash: a slow fade counts once it has changed by a tenth, and bright changes above 0.80 do not', () => {
  // A triangle wave over 0.6 s, its frames 1/60 s apart changing by
  // under 0.1 each.
  const tri = t => 255 * (1 - Math.abs(((t / 0.6) % 1) * 2 - 1))
  assert.strictEqual(run(400, 300, 60, 3, (x, y, t) => tri(t)).window.general.n, 2)
  // Grey 237 is luminance 0.846, 255 is 1.
  assert.strictEqual(run(400, 300, 60, 2, (x, y, t) => square(8)(t) ? 255 : 237).window.general.n, 0)
})

test('flash: a pattern finer than a cell counts by its share of the cell', () => {
  // A stipple of one pixel in four, lit and dark at 5 Hz: a cell's mean
  // changes by a quarter, a flash. One pixel in sixteen of grey 128,
  // under 0.1 of a cell's mean: none.
  assert.strictEqual(run(400, 300, 60, 2, (x, y, t) => x % 2 === 0 && y % 2 === 0 ? 255 * square(5)(t) : 0).cell.n, 5)
  assert.strictEqual(run(400, 300, 60, 2, (x, y, t) => x % 4 === 0 && y % 4 === 0 ? 128 * square(5)(t) : 0).cell.n, 0)
})

test('flash: saturated red counts as a red flash, a dull red does not', () => {
  const r = run(400, 300, 60, 2, (x, y, t) => square(4)(t) ? [255, 0, 0] : [0, 0, 0])
  assert.strictEqual(r.window.red.n, 4)
  assert.strictEqual(run(400, 300, 60, 2, (x, y, t) => square(4)(t) ? [255, 120, 120] : [0, 0, 0]).window.red.n, 0)
})
