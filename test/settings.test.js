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
    assert.deepStrictEqual(settings.load(f), { 'terminal.fontSize': null, panels: {} })
    fs.writeFileSync(f, '{not json')
    assert.deepStrictEqual(settings.load(f), { 'terminal.fontSize': null, panels: {} })
    fs.writeFileSync(f, JSON.stringify({ 'terminal.fontSize': 19, other: 3 }))
    assert.deepStrictEqual(settings.load(f), { 'terminal.fontSize': null, panels: {} })
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
    assert.deepStrictEqual(v, { 'terminal.fontSize': 20, panels: {} })
    const [row] = settings.menu(v, { terminal: { fontSize: 19 } })
    assert.strictEqual(row.choices[0].label, 'Skin default (19 px)')
    assert.strictEqual(row.choices[0].current, false)
    assert.deepStrictEqual(row.choices.filter(c => c.current).map(c => c.value), [20])
    assert.deepStrictEqual(fs.readdirSync(path.dirname(f)), ['settings.json'])
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
