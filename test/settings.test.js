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
    assert.deepStrictEqual(settings.load(f), { 'terminal.fontSize': null })
    fs.writeFileSync(f, '{not json')
    assert.deepStrictEqual(settings.load(f), { 'terminal.fontSize': null })
    fs.writeFileSync(f, JSON.stringify({ 'terminal.fontSize': 19, other: 3 }))
    assert.deepStrictEqual(settings.load(f), { 'terminal.fontSize': null })
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
    assert.deepStrictEqual(v, { 'terminal.fontSize': 20 })
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
