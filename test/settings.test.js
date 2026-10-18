'use strict'
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const settings = require('../app/settings')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'settings-test-'))

test('a missing or broken file, and any value outside a setting\'s list, read as the skin default', () => {
  const d = tmp()
  try {
    const f = path.join(d, 'settings.json')
    assert.deepStrictEqual(settings.load(f), { 'terminal.fontSize': null, 'text.skin': null, 'text.window': null, 'text.viz': null, 'viz.fps': null, 'viz.trace': null, panels: {} })
    fs.writeFileSync(f, '{not json')
    assert.deepStrictEqual(settings.load(f), { 'terminal.fontSize': null, 'text.skin': null, 'text.window': null, 'text.viz': null, 'viz.fps': null, 'viz.trace': null, panels: {} })
    fs.writeFileSync(f, JSON.stringify({ 'terminal.fontSize': 19, other: 3 }))
    assert.deepStrictEqual(settings.load(f), { 'terminal.fontSize': null, 'text.skin': null, 'text.window': null, 'text.viz': null, 'viz.fps': null, 'viz.trace': null, panels: {} })
  } finally {
    fs.rmSync(d, { recursive: true, force: true })
  }
})

test('a saved setting reads back, and the menu marks it beside the skin\'s own value', () => {
  const d = tmp()
  try {
    const f = path.join(d, 'deeper', 'settings.json')
    settings.save(f, { 'terminal.fontSize': 20 })
    const v = settings.load(f)
    assert.deepStrictEqual(v, { 'terminal.fontSize': 20, 'text.skin': null, 'text.window': null, 'text.viz': null, 'viz.fps': null, 'viz.trace': null, panels: {} })
    const [row] = settings.menu(v, { terminal: { fontSize: 19 } })
    assert.strictEqual(row.choices[0].label, 'Skin default (19 px)')
    assert.strictEqual(row.choices[0].current, false)
    assert.deepStrictEqual(row.choices.filter(c => c.current).map(c => c.value), [20])
    assert.deepStrictEqual(fs.readdirSync(path.dirname(f)), ['settings.json'])
  } finally {
    fs.rmSync(d, { recursive: true, force: true })
  }
})

// The text sizes of decision 0036: percents, null the default.
test('a text size reads back as a factor, and the menu offers it beside the default', () => {
  const d = tmp()
  try {
    const f = path.join(d, 'settings.json')
    settings.save(f, { 'text.skin': 150, 'text.window': 80, 'text.viz': 133 })
    const v = settings.load(f)
    assert.deepStrictEqual([v['text.skin'], v['text.window'], v['text.viz']], [150, 80, null])
    assert.deepStrictEqual(['text.skin', 'text.window', 'text.viz', 'terminal.fontSize'].map(id => settings.scale(v, id)), [1.5, 0.8, 1, 1])
    const rows = settings.menu(v, null)
    assert.deepStrictEqual(rows.map(r => r.label), ['Terminal font size', 'Skin text size', 'Window text size', 'Visualization text size', 'Visualization frame rate', 'Gravity 3D sharpness'])
    const skin = rows[1]
    assert.strictEqual(skin.choices[0].label, 'Skin default (100%)')
    assert.deepStrictEqual(skin.choices.map(c => c.label).slice(1), settings.TEXT_SCALES.map(p => `${p}%`))
    assert.deepStrictEqual(skin.choices.filter(c => c.current).map(c => c.value), [150])
    assert.strictEqual(rows[3].choices[0].label, 'Default (100%)')
    assert.strictEqual(rows[3].choices[0].current, true)
  } finally {
    fs.rmSync(d, { recursive: true, force: true })
  }
})

test('only a defined setting and one of its values is valid', () => {
  assert.ok(settings.valid('terminal.fontSize', 8))
  assert.ok(settings.valid('terminal.fontSize', 32))
  assert.ok(settings.valid('terminal.fontSize', null))
  assert.ok(!settings.valid('terminal.fontSize', 33))
  assert.ok(!settings.valid('terminal.fontSize', '14'))
  assert.ok(!settings.valid('skin.css', null))
  assert.ok(settings.valid('text.window', 150))
  assert.ok(!settings.valid('text.window', 100))
  assert.ok(!settings.valid('text.window', 1.5))
  for (const v of [15, 20, 24, 30, 60, null]) assert.ok(settings.valid('viz.fps', v), `viz.fps ${v}`)
  for (const v of [0, 25, 120, '30', 30.5]) assert.ok(!settings.valid('viz.fps', v), `viz.fps ${v}`)
  for (const v of [15000, 45000, 60000, 90000, 135000, null]) assert.ok(settings.valid('viz.trace', v), `viz.trace ${v}`)
  for (const v of [0, 30000, 200000, '45000']) assert.ok(!settings.valid('viz.trace', v), `viz.trace ${v}`)
})

// The visualization's frame rate cap (decision 0036): frames a second,
// null for none, the display's own rate.
test('a frame rate cap reads back, null in effect for none, and the menu offers it beside Uncapped', () => {
  const d = tmp()
  try {
    const f = path.join(d, 'settings.json')
    settings.save(f, { 'viz.fps': 24 })
    assert.strictEqual(settings.value(settings.load(f), 'viz.fps'), 24)
    settings.save(f, { 'viz.fps': 25 })
    const v = settings.load(f)
    assert.strictEqual(v['viz.fps'], null)
    assert.strictEqual(settings.value(v, 'viz.fps'), null)
    assert.strictEqual(settings.value({ 'text.viz': 150 }, 'text.viz'), 150)
    assert.strictEqual(settings.value({}, 'text.viz'), 100)
    assert.strictEqual(settings.value({}, 'no.such'), null)
    const row = settings.menu(settings.load(f), null).find(r => r.id === 'viz.fps')
    assert.deepStrictEqual(row.choices.map(c => c.label), ['Uncapped (display rate)', '15 fps', '20 fps', '24 fps', '30 fps', '60 fps'])
    assert.deepStrictEqual(row.choices.filter(c => c.current).map(c => c.value), [null])
  } finally {
    fs.rmSync(d, { recursive: true, force: true })
  }
})

// Panel sizes (decision 0035): kept by skin name and split id, a
// malformed entry dropped, a skin's reset dropping only its own.
test('panel sizes read back by skin and split, and a reset drops one skin\'s', () => {
  const d = tmp()
  try {
    const f = path.join(d, 'settings.json')
    let v = settings.load(f)
    v = settings.setPanel(v, 'deck', 'playlist', 412)
    v = settings.setPanel(v, 'deck', 'meters', 254)
    v = settings.setPanel(v, 'coffee', 'slate', 200)
    settings.save(f, v)
    assert.deepStrictEqual(settings.load(f).panels, { deck: { playlist: 412, meters: 254 }, coffee: { slate: 200 } })
    v = settings.setPanel(settings.load(f), 'deck', null)
    assert.deepStrictEqual(v.panels, { coffee: { slate: 200 } })
    assert.strictEqual(v['terminal.fontSize'], null)
    fs.writeFileSync(f, JSON.stringify({ panels: { deck: { playlist: '412', meters: -1, ok: 300 }, 'Bad Name': { a: 1 }, coffee: [1], library: { desk: 250 } } }))
    assert.deepStrictEqual(settings.load(f).panels, { deck: { ok: 300 }, library: { desk: 250 } })
    fs.writeFileSync(f, JSON.stringify({ panels: 'wide' }))
    assert.deepStrictEqual(settings.load(f).panels, {})
  } finally {
    fs.rmSync(d, { recursive: true, force: true })
  }
})

// Gravity 3D's sharpness (decision 0015): pixels traced a pane, null
// for the mode's own, which is the PANE of gravity3d.js.
test('a trace size reads back, the default in effect is Gravity 3D\'s own, and the menu shows pixels a pane', () => {
  const g3 = require('../app/viz/gravity3d')
  assert.strictEqual(settings.TRACE_OWN, g3.PANE)
  assert.strictEqual(settings.value({}, 'viz.trace'), g3.PANE)
  assert.strictEqual(settings.value({ 'viz.trace': 135000 }, 'viz.trace'), 135000)
  const row = settings.menu({ 'viz.trace': 45000 }, null).find(r => r.id === 'viz.trace')
  assert.deepStrictEqual(row.choices.map(c => c.label), ['Default (30000 px a pane)', '15000 px a pane', '45000 px a pane', '60000 px a pane', '90000 px a pane', '135000 px a pane'])
  assert.deepStrictEqual(row.choices.filter(c => c.current).map(c => c.value), [45000])
})
