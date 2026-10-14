'use strict'
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const ALLOWED = ['CC0-1.0', 'OFL-1.1', 'MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'Zlib', 'Unlicense',
  'CC-BY-3.0', 'CC-BY-4.0', 'public-domain', 'project-original']

function walk (dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? walk(p) : [path.relative(ROOT, p)]
  })
}

test('every shipped skin file is the manifest, CSS, or a licensed asset', () => {
  const assets = JSON.parse(fs.readFileSync(path.join(ROOT, 'ASSETS.json'), 'utf8'))
  const listed = new Map(assets.map(a => [a.path, a]))
  for (const a of assets) {
    for (const k of ['path', 'source', 'author', 'license']) assert.ok(a[k], `${a.path}: ${k} missing`)
    assert.ok(ALLOWED.includes(a.license), `${a.path}: license ${a.license} not allowed`)
    assert.ok(fs.existsSync(path.join(ROOT, a.path)), `${a.path}: listed but missing`)
  }
  for (const f of walk(path.join(ROOT, 'skins'))) {
    if (path.basename(f) === 'skin.json' || f.endsWith('.css')) continue
    assert.ok(listed.has(f), `${f}: not listed in ASSETS.json`)
  }
})

test('no shipped file names another product', () => {
  for (const f of walk(path.join(ROOT, 'skins'))) {
    assert.ok(!/winamp|pip-?boy|fallout|vault/i.test(f), f)
    if (/\.(json|css|txt|md)$/.test(f)) {
      const text = fs.readFileSync(path.join(ROOT, f), 'utf8')
      assert.ok(!/winamp|pip-?boy|fallout|vault-?tec/i.test(text), `${f} names another product`)
    }
  }
})
