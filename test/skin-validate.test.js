'use strict'
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { validate } = require('../app/skins/validate')

const F = path.join(__dirname, 'fixtures', 'skins')
const ROOT = path.join(__dirname, '..', 'skins')

test('the all-widgets fixture is valid', () => {
  const r = validate(path.join(F, 'all-widgets'))
  assert.deepStrictEqual(r.errors, [])
  assert.strictEqual(r.skin.name, 'all-widgets')
})

test('a skin with a loop and a random sound is valid', () => {
  const r = validate(path.join(F, 'sounds'))
  assert.deepStrictEqual(r.errors, [])
  assert.deepStrictEqual(r.skin.sounds.map(s => s.mode), ['loop', 'random'])
})

test('every shipped skin is valid', () => {
  const dirs = fs.existsSync(ROOT) ? fs.readdirSync(ROOT) : []
  for (const d of dirs) {
    const r = validate(path.join(ROOT, d))
    assert.deepStrictEqual(r.errors, [], d)
    // The registry keys a shipped skin by its directory (decision 0008).
    assert.strictEqual(r.skin.name, d, `${d}: the manifest name must equal the directory name`)
  }
})

const BROKEN = {
  'broken-json': ['skin.json: (file): not valid JSON'],
  'broken-metric': ['skin.json: widgets[0].bind: unknown metric "foo.bar"'],
  'broken-type': ['skin.json: widgets[0].type: unknown widget type "slider"'],
  'broken-list': [
    'skin.json: widgets[0].bind: "tools.total": a list widget shows checklist.items',
    'skin.json: widgets[0].rows: must be a number',
    'skin.json: widgets[0].toggle.labels: must be two strings',
    'skin.json: widgets[0].toggle.rect: overlaps the list at the minimum window',
    'skin.json: widgets[0].toggle.rect: overlaps the terminal at the minimum window',
    'skin.json: widgets[1].bind: "checklist.items": a list-valued metric needs a list widget',
    'skin.json: widgets[2].bind: "checklist.items": a limits widget shows limits.items',
    'skin.json: widgets[2].meter: must be bar or needle',
    'skin.json: widgets[2].direction: must be row or column'
  ],
  'broken-fallback': [
    'skin.json: widgets[0].resets: unknown metric "foo.when"',
    'skin.json: widgets[0].fallback.color: unknown field',
    'skin.json: widgets[0].fallback.bind: unknown metric "foo.spend"',
    'skin.json: widgets[0].fallback.label: must be a string'
  ],
  'broken-image': ['skin.json: widgets[1].image: "images/nope.png": file not found'],
  'broken-sprite': ['skin.json: widgets[1].sheet: is 512 x 32 px'],
  'broken-contrast': ['skin.json: terminal.theme.foreground: contrast with background is 1.26'],
  'broken-small': ['skin.json: terminal.rect: leaves about'],
  'broken-escape': ['skin.json: widgets[1].image: "../all-widgets/images/knob.png": outside the skin directory'],
  'broken-css': ['skin.css: line 2: @import is not allowed', 'skin.css: line 3: url(https://example.org/x.png)'],
  'broken-script': ['evil.js: (file): file type not allowed in a skin'],
  'broken-rect': ['skin.json: widgets[0].rect: needs exactly two of left, right, width'],
  'broken-menu': ['skin.json: menu: missing'],
  'broken-sound': [
    'skin.json: sounds[0].file: "sounds/nope.ogg": file not found',
    'skin.json: sounds[1].file: "menu.svg": file type not allowed here',
    'skin.json: sounds[1].interval: needs 1 <= min <= max <= 3600 seconds',
    'skin.json: sounds[2].loud: unknown field',
    'skin.json: sounds[2].file: "../sounds/sounds/beep.ogg": outside the skin directory',
    'skin.json: sounds[2].mode: must be loop or random',
    'skin.json: sounds[3].volume: must be a number from 0 to 1',
    'skin.json: sounds[3].interval: only a random sound has an interval'
  ],
  'broken-menu-rect': [
    'skin.json: menu.image: "nope.svg": file not found',
    'skin.json: menu.rect: is 20 x 12 px at the minimum window',
    'skin.json: menu.rect: lies outside the skin area at the minimum window',
    'skin.json: menu.rect: overlaps the terminal at the minimum window'
  ]
}

for (const [dir, expected] of Object.entries(BROKEN)) {
  test(`${dir} fails naming file and field`, () => {
    const r = validate(path.join(F, dir))
    assert.strictEqual(r.skin, null)
    assert.strictEqual(r.errors.length, expected.length, r.errors.join('\n'))
    expected.forEach((want, i) => assert.ok(r.errors[i].includes(`test/fixtures/skins/${dir}/${want}`), r.errors[i]))
  })
}
