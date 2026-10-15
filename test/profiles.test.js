'use strict'
// The profiles of New tab... (decision 0025): records newest first, one
// per profile, Forget, the list order, and the environment of a tab.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const profiles = require('../app/profiles')

function tempDir (t) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'profiles-test-'))
  t.after(() => fs.rmSync(d, { recursive: true, force: true }))
  return path.join(d, 'profiles')
}

test('records: one per profile, newest first, forgotten one by one', t => {
  const d = tempDir(t)
  profiles.record(d, 'claude', '/p/work', 1000)
  profiles.record(d, 'codex', '/p/lab', 2000)
  profiles.record(d, 'claude', '/p/work', 3000)
  fs.writeFileSync(path.join(d, 'junk'), 'x')
  fs.writeFileSync(path.join(d, 'claude-0000000000000000'), 'not json')
  assert.deepStrictEqual(profiles.read(d), [{ t: 3000, agent: 'claude', dir: '/p/work' }, { t: 2000, agent: 'codex', dir: '/p/lab' }])
  profiles.forget(d, 'claude', '/p/work')
  assert.deepStrictEqual(profiles.read(d), [{ t: 2000, agent: 'codex', dir: '/p/lab' }])
  assert.deepStrictEqual(profiles.read(path.join(d, 'none')), [])
})

test('the list: the default, the open tabs, then the records, each once', () => {
  const dflt = profiles.defaultDir('claude')
  const records = [{ t: 3, agent: 'claude', dir: '/p/a' }, { t: 2, agent: 'codex', dir: '/p/x' }, { t: 1, agent: 'claude', dir: '/p/b' }]
  assert.deepStrictEqual(profiles.list('claude', records, ['/p/b', dflt]), [
    { dir: dflt, isDefault: true, remembered: false },
    { dir: '/p/b', isDefault: false, remembered: true },
    { dir: '/p/a', isDefault: false, remembered: true }
  ])
})

test('a tab\'s environment: the variable set, or unset for the default', () => {
  const env = { PATH: '/bin', CLAUDE_CONFIG_DIR: '/p/lab' }
  assert.deepStrictEqual(profiles.envFor(env, 'claude', '/p/work'), { PATH: '/bin', CLAUDE_CONFIG_DIR: '/p/work' })
  assert.deepStrictEqual(profiles.envFor(env, 'claude', profiles.defaultDir('claude')), { PATH: '/bin' })
  assert.deepStrictEqual(profiles.envFor(env, 'codex', '/p/x'), { PATH: '/bin', CLAUDE_CONFIG_DIR: '/p/lab', CODEX_HOME: '/p/x' })
  assert.strictEqual(env.CLAUDE_CONFIG_DIR, '/p/lab')
  assert.strictEqual(profiles.of(env, 'claude'), '/p/lab')
  assert.strictEqual(profiles.of(env, 'codex'), profiles.defaultDir('codex'))
})
