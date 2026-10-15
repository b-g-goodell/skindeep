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

test('the scan: config dirs by the names they hold, bounded, links not followed', t => {
  const root = path.dirname(tempDir(t))
  const mk = (rel, ...files) => {
    const d = path.join(root, rel)
    fs.mkdirSync(d, { recursive: true })
    for (const f of files) {
      if (f.endsWith('/')) fs.mkdirSync(path.join(d, f), { recursive: true })
      else fs.writeFileSync(path.join(d, f), '')
    }
    return d
  }
  fs.writeFileSync(path.join(root, '.claude.json'), '')
  mk('.claude', '.credentials.json', 'projects/')
  const split = mk('.split/a/.claude', '.claude.json', 'sessions/')
  mk('.split/a/.claude/inner', '.credentials.json')
  mk('.split/b/.claude', '.claude.json')
  mk('.codex', 'auth.json', 'config.toml')
  mk('.decoy', 'settings.json', 'config.toml')
  mk('a/b/c/d/.claude', '.credentials.json')
  mk('x/node_modules/.claude', '.credentials.json')
  fs.symlinkSync(path.join(root, '.claude'), path.join(root, 'link'))
  fs.symlinkSync(root, path.join(root, 'loop'))
  const found = profiles.scan(root, { depth: 4 })
  assert.deepStrictEqual(found, [
    { agent: 'claude', dir: path.join(root, '.claude') },
    { agent: 'codex', dir: path.join(root, '.codex') },
    { agent: 'claude', dir: split }
  ])
  assert.deepStrictEqual(profiles.scan(root, { depth: 5 }).map(r => r.dir).filter(d => d.includes('/a/b/')), [path.join(root, 'a/b/c/d/.claude')])
  assert.ok(profiles.scan(root, { cap: 1 }).length === 0)
  const dflt = profiles.defaultDir('claude')
  assert.deepStrictEqual(profiles.list('claude', [{ t: 1, agent: 'claude', dir: '/p/a' }], [], [...found, { agent: 'claude', dir: '/p/a' }]), [
    { dir: dflt, isDefault: true, remembered: false },
    { dir: '/p/a', isDefault: false, remembered: true },
    { dir: path.join(root, '.claude'), isDefault: false, remembered: false },
    { dir: split, isDefault: false, remembered: false }
  ])
})
