'use strict'
// The last skin used: one record per window, the newest wins, a race
// within RACE_MS of the newest offers every skin it names.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const last = require('../app/skins/last')

function tempDir (t) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'last-skin-test-'))
  t.after(() => fs.rmSync(d, { recursive: true, force: true }))
  return path.join(d, 'last-skins')
}

test('no record: nothing to pick', t => {
  assert.strictEqual(last.pick(last.read(tempDir(t))), null)
})

test('a window\'s own switches: its newest record alone counts', t => {
  const d = tempDir(t)
  last.record(d, 100, 'deck', 1000)
  last.record(d, 100, 'phosphor', 1500)
  assert.deepStrictEqual(last.read(d), [{ pid: 100, t: 1500, spec: 'phosphor' }])
  assert.deepStrictEqual(last.pick(last.read(d)), { spec: 'phosphor' })
})

test('windows apart by more than the race window: the newest wins', t => {
  const d = tempDir(t)
  last.record(d, 100, 'deck', 1000)
  last.record(d, 200, '/home/u/my-skin', 1000 + last.RACE_MS + 1)
  assert.deepStrictEqual(last.pick(last.read(d)), { spec: '/home/u/my-skin' })
})

test('windows within the race window with different skins: every skin, newest first, once', t => {
  const d = tempDir(t)
  last.record(d, 100, 'deck', 10000)
  last.record(d, 200, 'phosphor', 12000)
  last.record(d, 300, 'deck', 13000)
  last.record(d, 400, 'old', 1000)
  assert.deepStrictEqual(last.pick(last.read(d)), { choices: ['deck', 'phosphor'] })
})

test('windows within the race window with one skin: no question', t => {
  const d = tempDir(t)
  last.record(d, 100, 'deck', 10000)
  last.record(d, 200, 'deck', 10001)
  assert.deepStrictEqual(last.pick(last.read(d)), { spec: 'deck' })
})

test('prune keeps the race window, forget keeps nothing, a torn file is skipped', t => {
  const d = tempDir(t)
  last.record(d, 100, 'deck', 1000)
  last.record(d, 200, 'phosphor', 20000)
  last.record(d, 300, 'deck', 19000)
  fs.writeFileSync(path.join(d, '400'), '{"t": 3')
  last.prune(d, last.read(d))
  assert.deepStrictEqual(last.read(d).map(r => r.pid), [200, 300])
  last.forget(d)
  assert.deepStrictEqual(fs.readdirSync(d), [])
})
