'use strict'
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { floorWidth } = require('../app/skins/scale')

const SKINS = path.join(__dirname, '..', 'skins')

// Every shipped skin fits half a 1920 px screen, its terminal
// still 40 columns wide at the window's minimum.
test('every shipped skin fits half a 1920 px screen with 40 columns at its floor', () => {
  for (const name of fs.readdirSync(SKINS)) {
    const skin = JSON.parse(fs.readFileSync(path.join(SKINS, name, 'skin.json'), 'utf8'))
    const w = floorWidth(skin)
    const r = skin.terminal.rect
    const k = w / skin.window.minWidth
    const cols = Math.floor((w - (r.left + r.right) * k) / (skin.terminal.fontSize * 0.6))
    assert.ok(w <= 960, `${name}: floor ${w} px exceeds 960`)
    assert.ok(cols >= 40, `${name}: ${cols} columns at the floor`)
  }
})

test('the floor is half the minWidth unless the font needs more, and never above minWidth', () => {
  const skin = (fontSize, left, right) => ({ window: { minWidth: 1000 }, terminal: { fontSize, rect: { left, right } } })
  assert.strictEqual(floorWidth(skin(14, 100, 100)), 500)
  assert.strictEqual(floorWidth(skin(20, 300, 200)), 960)
  assert.strictEqual(floorWidth(skin(32, 300, 300)), 1000)
})
