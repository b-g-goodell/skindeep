'use strict'
// A skin's stylesheet as served (decision 0036): every px font size and
// line height scaled by var(--text-scale), nothing else changed, and
// the units that would escape the scale found.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { rewrite, strays } = require('../app/skins/textscale')

const S = 'var(--text-scale, 1)'

test('font sizes and line heights in px are scaled, in the shorthand too', () => {
  assert.strictEqual(rewrite('.a { font-size: 8px; line-height: 10px }'), `.a { font-size: calc(8px * ${S}); line-height: calc(10px * ${S}) }`)
  assert.strictEqual(rewrite('.b{font: bold 22px/24px "Amatic SC", cursive}'), `.b{font: bold calc(22px * ${S})/calc(24px * ${S}) "Amatic SC", cursive}`)
  assert.strictEqual(rewrite('.c { font: 11px/1.2 X; font-size: 0.85em; line-height: 1.4 }'), `.c { font: calc(11px * ${S})/1.2 X; font-size: 0.85em; line-height: 1.4 }`)
})

test('widths, offsets, letter spacing, families and other properties keep their pixels', () => {
  const css = '.a { width: 80px; left: 184px; letter-spacing: 2px; font-family: "Pix 12px"; font-weight: 700; padding: 1px 5px; }\n.b { font: 9px "Pix 12px"; }'
  const out = rewrite(css)
  assert.strictEqual(out.split('\n')[0], css.split('\n')[0])
  assert.strictEqual(out.split('\n')[1], `.b { font: calc(9px * ${S}) "Pix 12px"; }`)
})

test('every shipped skin keeps its lines, and only its text sizes change', () => {
  const root = path.join(__dirname, '..', 'skins')
  for (const name of fs.readdirSync(root)) {
    const f = path.join(root, name, 'skin.css')
    if (!fs.existsSync(f)) continue
    const css = fs.readFileSync(f, 'utf8')
    const out = rewrite(css)
    assert.strictEqual(out.split('\n').length, css.split('\n').length, name)
    assert.ok(out.includes(S), `${name}: nothing scaled`)
    assert.strictEqual(out.replace(/calc\((\d*\.?\d+px) \* var\(--text-scale, 1\)\)/g, '$1'), css, name)
    assert.deepStrictEqual(strays(css), [], name)
  }
})

test('a text size in another unit, or an absolute keyword, is found', () => {
  const found = strays('.a{font-size:12pt}\n.b{font: bold 1rem/1.2 X}\n.c{font-size: large}\n.d{line-height:2vh}\n.e{font-size:1.1em;line-height:1.3;font:9px/12px "Q 2pt"}')
  assert.deepStrictEqual(found.map(f => f.what), ['pt', 'rem', 'large', 'vh'])
})
