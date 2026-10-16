'use strict'
// Each pane's mode drop-down (decision 0015): the main process reads its
// presses and the page draws it from layout.js alone, so the geometry
// must hold every row inside the window and map each press back.
const test = require('node:test')
const assert = require('node:assert')
const layout = require('../app/viz/layout')
const { MODES } = require('../app/viz/modes')

const inside = (b, W, H) => b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H
const centre = b => [b.x + b.w / 2, b.y + b.h / 2]

// At each visualization text size (decision 0036) as well.
test('a drop-down holds a row per mode inside the window, and a press maps back', () => {
  const m = MODES.length
  for (const t of [1, 0.7, 1.5]) for (const [W, H] of [[720, 460], [320, 200], [1200, 760], [333, 701]]) {
    for (let n = 1; n <= 6; n++) {
      for (let i = 0; i < n; i++) {
        const where = `pane ${i} of ${n} at ${W}x${H}, text ${t}`
        const r = layout.rect(i, n, W, H)
        const d = layout.menu(r, m, W, H, t)
        if (t !== 1) assert.strictEqual(d.items[0].h, Math.round(18 * t), where)
        assert.strictEqual(d.items.length, m, where)
        const b = d.button
        assert.ok(b.x >= r.x && b.y >= r.y && b.x + b.w <= r.x + r.w && b.y + b.h <= r.y + r.h, `${where}: button outside its pane`)
        for (const [k, row] of d.items.entries()) {
          assert.ok(inside(row, W, H), `${where}: row ${k} outside the window`)
          for (const other of d.items.slice(k + 1)) assert.ok(row.x + row.w <= other.x || other.x + other.w <= row.x || row.y + row.h <= other.y || other.y + other.h <= row.y, `${where}: rows overlap`)
          assert.deepStrictEqual(layout.press(...centre(row), n, m, W, H, i, t), { pane: i, item: k }, `${where}: row ${k}`)
        }
        assert.deepStrictEqual(layout.press(...centre(b), n, m, W, H, -1, t), { pane: i, button: true }, `${where}: button`)
        // Closed, a row's place is the pane's own, not the drop-down's.
        const below = d.items[d.items.length - 1]
        const hit = layout.press(...centre(below), n, m, W, H, -1, t)
        assert.ok(hit === null || hit.button, `${where}: a closed drop-down took a press`)
      }
    }
  }
  assert.strictEqual(layout.press(-1, 5, 2, m, 720, 460, -1), null)
})
