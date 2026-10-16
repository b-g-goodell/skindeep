'use strict'
const test = require('node:test')
const assert = require('node:assert')
const splits = require('../app/renderer/splits')

// A skin of 1000 x 722 at first (a 700 px skin area), 800 x 522 at
// least, its terminal 200 px from the right and 60 from the top.
const skin = {
  window: { width: 1000, height: 722, minWidth: 800, minHeight: 522 },
  terminal: { rect: { left: 10, top: 60, right: 200, bottom: 10 } },
  splits: [
    { id: 'side', edge: 'right', min: 150, max: 400 },
    { id: 'band', edge: 'top', min: 60, max: 140 }
  ]
}

test('a split holds the saved size within its min and max, its default without one', () => {
  assert.deepStrictEqual(splits.sizes(skin, {}, 1000, 700), { side: 200, band: 60 })
  assert.deepStrictEqual(splits.sizes(skin, { side: 300, band: 100 }, 1000, 700), { side: 300, band: 100 })
  assert.deepStrictEqual(splits.sizes(skin, { side: 9000, band: 0 }, 1000, 700), { side: 400, band: 60 })
  assert.deepStrictEqual(splits.sizes(skin, { side: 'wide', band: NaN }, 1000, 700), { side: 200, band: 60 })
})

test('below the initial size a split\'s growth gives way pixel for pixel, never below its default', () => {
  assert.deepStrictEqual(splits.sizes(skin, { side: 400, band: 140 }, 1000, 700), { side: 400, band: 140 })
  assert.deepStrictEqual(splits.sizes(skin, { side: 400, band: 140 }, 950, 680), { side: 350, band: 120 })
  assert.deepStrictEqual(splits.sizes(skin, { side: 400, band: 140 }, 800, 500), { side: 200, band: 60 })
  assert.deepStrictEqual(splits.sizes(skin, { side: 150 }, 800, 500), { side: 150, band: 60 })
  assert.deepStrictEqual(splits.range(skin, skin.splits[0], 900, 700), { min: 150, max: 300, def: 200 })
  assert.deepStrictEqual(splits.sizes(skin, { side: 400 }, 1400, 900), { side: 400, band: 60 })
})

test('a followed key moves by its split\'s change, the terminal\'s edge takes the size', () => {
  const at = { side: 300, band: 100 }
  assert.deepStrictEqual(splits.rect({ right: 12, top: 60, width: 180, bottom: 10 }, { width: 'side', top: 'band' }, skin, at), { right: 12, top: 100, width: 280, bottom: 10 })
  assert.deepStrictEqual(splits.rect({ left: 8, top: 54, right: 194, bottom: 4 }, { right: 'side' }, skin, at), { left: 8, top: 54, right: 294, bottom: 4 })
  assert.deepStrictEqual(splits.rect({ left: 8, top: 4, width: 10, height: 10 }, undefined, skin, at), { left: 8, top: 4, width: 10, height: 10 })
  assert.deepStrictEqual(splits.terminal(skin, at), { left: 10, top: 100, right: 300, bottom: 10 })
})

test('a split moves its own edge, or the size of a rect anchored there', () => {
  assert.ok(splits.movable('right', 'right', { right: 1, width: 1 }))
  assert.ok(splits.movable('right', 'width', { right: 1, width: 1 }))
  assert.ok(!splits.movable('right', 'width', { left: 1, width: 1 }))
  assert.ok(!splits.movable('right', 'left', { left: 1, right: 1 }))
  assert.ok(splits.movable('bottom', 'height', { bottom: 1, height: 1 }))
  assert.ok(!splits.movable('top', 'height', { bottom: 1, height: 1 }))
})
