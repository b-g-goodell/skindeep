'use strict'
// The visualization's frame rate cap (decision 0036, app/viz/pace.js):
// the frames drawn of a display's frames keep to the cap, and none is
// skipped for the jitter of the display's clock.
const test = require('node:test')
const assert = require('node:assert')
const { due } = require('../app/viz/pace')

// A display of hz frames a second for secs seconds, each frame's time
// off by up to jitter ms: the times of the frames drawn under fps.
function run (hz, fps, secs, jitter = 0) {
  let next = 0
  const drawn = []
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let k = 0; k < hz * secs; k++) {
    const now = 1000 + k * 1000 / hz + (rnd() * 2 - 1) * jitter
    const d = due(now, next, fps)
    next = d.next
    if (d.draw) drawn.push(now)
  }
  return drawn
}

// The most frames drawn in any window of one second.
function peak (times) {
  let most = 0
  for (let i = 0, j = 0; i < times.length; i++) {
    while (times[i] - times[j] >= 1000) j++
    most = Math.max(most, i - j + 1)
  }
  return most
}

test('no cap draws every frame of the display', () => {
  for (const fps of [0, null, undefined]) assert.strictEqual(run(60, fps, 5).length, 300)
})

test('each cap draws its rate on a 60 Hz and a 144 Hz display, never more in any second', () => {
  for (const hz of [60, 144]) {
    for (const fps of [15, 20, 24, 30, 60]) {
      if (fps > hz) continue
      for (const jitter of [0, 1.5]) {
        const t = run(hz, fps, 10, jitter)
        const at = `${fps} fps on ${hz} Hz, jitter ${jitter}`
        assert.ok(Math.abs(t.length - 10 * fps) <= 1, `${at}: ${t.length} frames in 10 s`)
        assert.ok(peak(t) <= fps + 1, `${at}: ${peak(t)} frames in one second`)
      }
    }
  }
})

test('a cap of the display\'s own rate skips no frame for jitter', () => {
  assert.strictEqual(run(60, 60, 10, 1.5).length, 600)
  assert.strictEqual(run(30, 30, 10, 1.5).length, 300)
})

test('a loop fallen behind starts again from now, with no burst of frames', () => {
  let next = 0
  let d = due(1000, next, 15)
  assert.ok(d.draw)
  next = d.next
  d = due(5000, next, 15)
  assert.ok(d.draw)
  assert.ok(Math.abs(d.next - (5000 + 1000 / 15)) < 1e-9)
  assert.ok(!due(5017, d.next, 15).draw)
})
