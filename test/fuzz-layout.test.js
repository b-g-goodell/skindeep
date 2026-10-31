'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { layout } = require('../scripts/fuzz/layout')

test('layout finds collisions between widgets and with the terminal', () => {
  const text = (holder, y) => ({ holder, owner: `widget-${holder}`, part: 'label', box: { x: 0, y, width: 100, height: 20 } })
  const page = { texts: [text(1, 0), text(2, 10)], term: { x: 200, y: 0, width: 500, height: 500 } }
  assert.deepEqual(layout(page), ['widget-1 / widget-2: text overlaps'])
  page.texts[1].box.y = 25
  assert.deepEqual(layout(page), [])
  page.term.x = 50
  assert.equal(layout(page).length, 2)
})
