'use strict'
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { floorWidth, floorHeight, STRIP } = require('../app/skins/scale')

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

// A quarter of a 1920 x 1080 screen under GNOME: `xprop -root
// _NET_WORKAREA` gives a work area 1048 px tall, `xprop -id <window>
// _NET_FRAME_EXTENTS` a title bar of 37 px on this app's windows.
const QUARTER = 1048 / 2 - 37
const TAB_STRIP = 24

test('every shipped skin fits a quarter of a 1080 px screen, two tabs and the title bar counted, with 10 rows at its floor', () => {
  for (const name of fs.readdirSync(SKINS)) {
    const skin = JSON.parse(fs.readFileSync(path.join(SKINS, name, 'skin.json'), 'utf8'))
    const h = floorHeight(skin)
    const r = skin.terminal.rect
    const k = (h - STRIP) / (skin.window.minHeight - STRIP)
    const rows = Math.floor((h - STRIP - (r.top + r.bottom) * k) / (skin.terminal.fontSize * 1.2))
    assert.ok(h + TAB_STRIP <= QUARTER, `${name}: floor ${h} px and the tab strip exceed ${QUARTER}`)
    assert.ok(rows >= 10, `${name}: ${rows} rows at the floor`)
  }
})

test('the height floor is half the skin area unless the font needs more, and never above minHeight', () => {
  const skin = (fontSize, top, bottom) => ({ window: { minHeight: 1022 }, terminal: { fontSize, rect: { top, bottom } } })
  assert.strictEqual(floorHeight(skin(14, 100, 100)), 522)
  assert.strictEqual(floorHeight(skin(20, 300, 300)), 622)
  assert.strictEqual(floorHeight(skin(20, 450, 450)), 1022)
})
