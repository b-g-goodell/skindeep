'use strict'
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { createRegistry } = require('../app/skins/registry')
const { validate } = require('../app/skins/validate')

const F = path.join(__dirname, 'fixtures', 'registry')
const SHIPPED = path.join(F, 'shipped')
const skins = createRegistry({ shippedDir: SHIPPED })
assert.ok(skins.start('alpha').view)

const get = url => skins.handle({ url })

test('T1 a file of the current skin: 200 with its content type', async () => {
  for (const [url, type] of [['skin://alpha/images/knob.png', 'image/png'], ['skin://alpha/skin.css', 'text/css']]) {
    const r = await get(url)
    assert.strictEqual(r.status, 200, url)
    assert.strictEqual(r.headers.get('content-type'), type, url)
  }
})

test('T2 a literal .. segment: 404', async () => {
  assert.strictEqual((await get('skin://alpha/../outside/secret.png')).status, 404)
})

test('T3 %2e%2e segments: 404', async () => {
  assert.strictEqual((await get('skin://alpha/%2e%2e/%2e%2e/outside/secret.png')).status, 404)
})

test('T4 ..%2F to an existing .png and .css outside: 404', async () => {
  for (const url of ['skin://alpha/..%2F..%2Foutside%2Fsecret.png', 'skin://alpha/..%2F..%2Foutside%2Fsecret.css']) {
    assert.strictEqual((await get(url)).status, 404, url)
  }
})

test('T5 ..%2F into a sibling whose name starts with the skin name: 404', async () => {
  assert.strictEqual((await get('skin://alpha/..%2Falpha-evil%2Fx.png')).status, 404)
})

test('T6 a symlink pointing out of the skin: 404', async () => {
  assert.strictEqual((await get('skin://alpha/images/out.png')).status, 404)
})

test('T7 a symlink inside the skin: 200', async () => {
  const r = await get('skin://alpha/images/in.png')
  assert.strictEqual(r.status, 200)
  assert.strictEqual(r.headers.get('content-type'), 'image/png')
})

test('T8 a host that names no skin: 404', async () => {
  assert.strictEqual((await get('skin://nosuch/images/knob.png')).status, 404)
})

test('T9 .json and .txt inside the skin: 404', async () => {
  for (const url of ['skin://alpha/skin.json', 'skin://alpha/notes.txt']) {
    assert.strictEqual((await get(url)).status, 404, url)
  }
})

test('T10 a malformed escape: 404, and the promise resolves', async () => {
  assert.strictEqual((await get('skin://alpha/%E0%A4%A.png')).status, 404)
})

test('T11 every 200 carries cache-control: no-store', async () => {
  for (const url of ['skin://alpha/images/knob.png', 'skin://alpha/skin.css', 'skin://alpha/images/in.png']) {
    const r = await get(url)
    assert.strictEqual(r.status, 200, url)
    assert.strictEqual(r.headers.get('cache-control'), 'no-store', url)
  }
})

test('T12 a skin switched away from: 404', async () => {
  const r = createRegistry({ shippedDir: SHIPPED })
  r.start('alpha')
  assert.ok(r.select('foo').view)
  assert.strictEqual((await r.handle({ url: 'skin://alpha/images/knob.png' })).status, 404)
})

function tempDir (t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skin-registry-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  return dir
}

function copySkin (from, to) {
  fs.cpSync(from, to, { recursive: true, verbatimSymlinks: true })
  return to
}

test('S1 start with no spec: deck when shipped, else the first shipped skin, else none', t => {
  const repo = createRegistry({ shippedDir: path.join(__dirname, '..', 'skins') })
  assert.strictEqual(repo.start(null).view.name, 'deck')
  assert.strictEqual(createRegistry({ shippedDir: SHIPPED }).start(null).view.name, 'alpha')
  const none = createRegistry({ shippedDir: tempDir(t) })
  assert.deepStrictEqual(none.start(null), { view: null })
  assert.strictEqual(none.current(), null)
})

test('S2 start of a missing NAME and of a broken PATH: the validator errors', () => {
  const r = createRegistry({ shippedDir: SHIPPED })
  assert.deepStrictEqual(r.start('nosuch').errors, validate(path.join(SHIPPED, 'nosuch')).errors)
  const broken = path.join(SHIPPED, 'broken')
  assert.deepStrictEqual(r.start(broken + '/').errors, validate(broken).errors)
  assert.strictEqual(r.current(), null)
})

test('S3 select of a broken entry: its errors, and nothing changes', async () => {
  const r = createRegistry({ shippedDir: SHIPPED })
  const before = r.start('alpha').view
  assert.deepStrictEqual(r.select('broken').errors, validate(path.join(SHIPPED, 'broken')).errors)
  assert.deepStrictEqual(r.current(), before)
  assert.strictEqual((await r.handle({ url: 'skin://alpha/skin.css' })).status, 200)
})

test('S4 select of an unknown entry: an error, and nothing changes', () => {
  const r = createRegistry({ shippedDir: SHIPPED })
  const before = r.start('alpha').view
  assert.strictEqual(r.select('nosuch').errors.length, 1)
  assert.deepStrictEqual(r.current(), before)
})

test('S5 selecting the current skin again reads it from disk', t => {
  const dir = tempDir(t)
  copySkin(path.join(SHIPPED, 'alpha'), path.join(dir, 'alpha'))
  const r = createRegistry({ shippedDir: dir })
  assert.strictEqual(r.start('alpha').view.window.width, 1200)
  const file = path.join(dir, 'alpha', 'skin.json')
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('"width": 1200', '"width": 1300'))
  assert.strictEqual(r.select('alpha').view.window.width, 1300)
  assert.strictEqual(r.current().window.width, 1300)
})

test('S6 the view carries no directory, and its base serves the stylesheet', async () => {
  const r = createRegistry({ shippedDir: SHIPPED })
  const v = r.start('alpha').view
  assert.ok(!('dir' in v))
  assert.deepStrictEqual([v.id, v.label, v.base], ['alpha', 'alpha', 'skin://alpha/'])
  assert.strictEqual((await r.handle({ url: v.base + v.stylesheet })).status, 200)
})

test('S7 a shipped directory whose manifest name differs is marked current once selected', () => {
  const r = createRegistry({ shippedDir: SHIPPED })
  r.start('alpha')
  assert.ok(r.select('foo').view)
  assert.deepStrictEqual(r.list().filter(e => e.current).map(e => e.id), ['foo'])
})

const PATHS = path.join(F, 'paths')
const real = p => fs.realpathSync(p)
const ids = r => r.list().map(e => e.id)

test('I1 a path skin with a fresh name: listed once, selectable, its files served', async () => {
  const r = createRegistry({ shippedDir: SHIPPED })
  r.start('alpha')
  const o = r.open(path.join(PATHS, 'fresh'))
  assert.strictEqual(o.id, 'fresh')
  assert.strictEqual(o.view.base, 'skin://fresh/')
  assert.deepStrictEqual(r.list().filter(e => e.id === 'fresh'), [{ id: 'fresh', label: 'fresh', location: real(path.join(PATHS, 'fresh')), current: true }])
  assert.ok(r.select('alpha').view)
  assert.ok(r.select('fresh').view)
  assert.strictEqual((await r.handle({ url: 'skin://fresh/skin.css' })).status, 200)
})

test('I2 one directory reached by its shipped name and by a path: one entry', () => {
  const r = createRegistry({ shippedDir: SHIPPED })
  r.start('foo')
  const o = r.open(path.join(SHIPPED, 'alpha') + '/')
  assert.strictEqual(o.id, 'alpha')
  assert.deepStrictEqual(r.list().filter(e => e.id === 'alpha'), [{ id: 'alpha', label: 'alpha', location: null, current: true }])
  assert.strictEqual(new Set(ids(r)).size, ids(r).length)
})

test('I3 a path skin with a shipped skin\'s name wins, and the list shows its folder', async () => {
  const r = createRegistry({ shippedDir: SHIPPED })
  r.start('alpha')
  const copy = path.join(PATHS, 'deck-copy')
  assert.strictEqual(r.open(copy).id, 'alpha')
  assert.deepStrictEqual(r.list().filter(e => e.id === 'alpha'), [{ id: 'alpha', label: 'alpha', location: real(copy), current: true }])
  const css = await (await r.handle({ url: 'skin://alpha/skin.css' })).text()
  assert.ok(css.includes('COPY-MARKER'))
  assert.ok(r.select('foo').view)
  assert.ok(r.select('alpha').view)
  assert.ok((await (await r.handle({ url: 'skin://alpha/skin.css' })).text()).includes('COPY-MARKER'))
  assert.strictEqual(r.open(path.join(SHIPPED, 'alpha')).id, 'alpha')
  assert.deepStrictEqual(r.list().filter(e => e.id === 'alpha'), [{ id: 'alpha', label: 'alpha', location: null, current: true }])
  assert.ok(!(await (await r.handle({ url: 'skin://alpha/skin.css' })).text()).includes('COPY-MARKER'))
})

test('I4 the list marks exactly one entry current after any sequence of select and open', () => {
  const r = createRegistry({ shippedDir: SHIPPED })
  r.start('alpha')
  const steps = [
    () => r.select('foo'), () => r.open(path.join(PATHS, 'fresh')), () => r.select('broken'),
    () => r.open(path.join(PATHS, 'deck-copy')), () => r.select('alpha'), () => r.open(path.join(SHIPPED, 'foo')),
    () => r.select('nosuch'), () => r.open(path.join(SHIPPED, 'broken'))
  ]
  for (const step of steps) {
    step()
    assert.strictEqual(r.list().filter(e => e.current).length, 1)
  }
})

test('open of a broken directory: its errors, and nothing changes', () => {
  const r = createRegistry({ shippedDir: SHIPPED })
  const before = r.start('alpha').view
  const listed = r.list()
  assert.deepStrictEqual(r.open(path.join(SHIPPED, 'broken')).errors, validate(path.join(SHIPPED, 'broken')).errors)
  assert.deepStrictEqual(r.current(), before)
  assert.deepStrictEqual(r.list(), listed)
})

test('I5 spec names a shipped skin, the folder of a path skin, and start of it opens the same skin', () => {
  const r = createRegistry({ shippedDir: SHIPPED })
  assert.strictEqual(r.spec(), null)
  r.start('alpha')
  assert.strictEqual(r.spec(), 'alpha')
  const copy = path.join(PATHS, 'deck-copy')
  r.open(copy)
  assert.strictEqual(r.spec(), real(copy))
  r.select('foo')
  r.select('alpha')
  assert.strictEqual(r.spec(), real(copy))
  r.open(path.join(PATHS, 'fresh'))
  const again = createRegistry({ shippedDir: SHIPPED })
  assert.ok(again.start(r.spec()).view)
  assert.deepStrictEqual(again.current(), r.current())
})

test('a byte range is served as asked, so a sound can loop and seek', async () => {
  const whole = Buffer.from(await (await get('skin://alpha/skin.css')).arrayBuffer())
  const range = async r => skins.handle({ url: 'skin://alpha/skin.css', headers: new Headers({ range: r }) })
  const a = await range('bytes=2-5')
  assert.strictEqual(a.status, 206)
  assert.strictEqual(a.headers.get('content-range'), `bytes 2-5/${whole.length}`)
  assert.deepStrictEqual(Buffer.from(await a.arrayBuffer()), whole.subarray(2, 6))
  assert.deepStrictEqual(Buffer.from(await (await range('bytes=3-')).arrayBuffer()), whole.subarray(3))
  assert.deepStrictEqual(Buffer.from(await (await range('bytes=-4')).arrayBuffer()), whole.subarray(whole.length - 4))
  assert.strictEqual((await range(`bytes=${whole.length}-`)).status, 416)
  assert.strictEqual((await get('skin://alpha/skin.css')).headers.get('accept-ranges'), 'bytes')
})
