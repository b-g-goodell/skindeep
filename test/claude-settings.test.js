'use strict'
// The settings writer at its interface: a temp profile, a temp project
// that is its own git root, a temp runtime root and store.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const settings = require('../app/metrics/claude/settings')
const { Bus } = require('../app/metrics/bus')
const { ClaudeAdapter } = require('../app/metrics/claude')

const NODE = { path: '/usr/bin/node', asElectron: false }
const SECRET = 'sk-ant-test-credential-0123456789'

function dirs (t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-skins-settings-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const d = { cfg: path.join(root, 'cfg'), repo: path.join(root, 'repo'), run: path.join(root, 'run'), root: path.join(root, 'root') }
  for (const k of Object.keys(d)) fs.mkdirSync(d[k])
  d.store = path.join(root, 'store')
  fs.mkdirSync(path.join(d.repo, '.git'))
  fs.mkdirSync(path.join(d.repo, '.claude'))
  return d
}

function write (file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data))
}

function prepare (d, over = {}) {
  return settings.prepare(Object.assign({
    cmd: ['claude'],
    env: { CLAUDE_CONFIG_DIR: d.cfg },
    cwd: d.repo,
    root: d.root,
    store: d.store,
    mode: 'always',
    node: NODE,
    python: '/usr/bin/python3',
    managedDir: path.join(d.cfg, '..', 'no-managed')
  }, over))
}

const read = r => JSON.parse(fs.readFileSync(r.args[1], 'utf8'))

// The chained command the statusline relay carries inline, or null.
function chainOf (r) {
  const line = read(r).statusLine
  const last = line.command.split(' ').pop()
  return last === '-' ? null : Buffer.from(last, 'base64url').toString('utf8')
}

const adapter = (d, over = {}) => new ClaudeAdapter(new Bus(), Object.assign({ cmd: ['claude'], env: { CLAUDE_CONFIG_DIR: d.cfg }, cwd: d.repo, runDir: d.run, root: d.root, store: d.store, mode: 'always', node: NODE, python: '/usr/bin/python3', log: () => {}, managedDir: path.join(d.cfg, '..', 'no-managed') }, over))

test('W1 a user --settings: no arguments, the notice, no file written', async t => {
  const d = dirs(t)
  const a = adapter(d, { cmd: ['claude', '--settings', '/x.json'] })
  try {
    assert.deepStrictEqual(await a.prepare(), { args: [], notice: 'meters limited: --settings given' })
    assert.ok(!fs.existsSync(d.store))
  } finally { a.close() }
})

test('W2 --setting-sources project ignores a user statusLine, the default sources chain it', t => {
  const d = dirs(t)
  write(path.join(d.cfg, 'settings.json'), { statusLine: { type: 'command', command: 'user-line' } })
  assert.strictEqual(chainOf(prepare(d)), 'user-line')
  assert.strictEqual(chainOf(prepare(d, { cmd: ['claude', '--setting-sources', 'project'] })), null)
})

test('W3 a statusLine in the git root local settings is chained from a subdirectory', t => {
  const d = dirs(t)
  write(path.join(d.repo, '.claude', 'settings.local.json'), { statusLine: { type: 'command', command: 'local-line' } })
  const sub = path.join(d.repo, 'a', 'b')
  fs.mkdirSync(sub, { recursive: true })
  assert.strictEqual(chainOf(prepare(d, { cwd: sub })), 'local-line')
})

test('W4 a settings env block keeps only the compaction keys', t => {
  const d = dirs(t)
  write(path.join(d.cfg, 'settings.json'), { env: { ANTHROPIC_AUTH_TOKEN: SECRET, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '400000' } })
  const r = prepare(d)
  assert.strictEqual(r.compaction.compactWindow, 400000)
  const layers = settings.layers({ env: { CLAUDE_CONFIG_DIR: d.cfg }, cwd: d.repo, argv: [] })
  assert.deepStrictEqual(layers.map(l => l.data.env), [{ CLAUDE_CODE_AUTO_COMPACT_WINDOW: '400000' }, {}, {}])
  assert.ok(!JSON.stringify(r).includes(SECRET))
  assert.ok(!JSON.stringify(layers).includes(SECRET))
  for (const f of fs.readdirSync(d.store)) assert.ok(!fs.readFileSync(path.join(d.store, f), 'utf8').includes(SECRET), f)
})

test('W5 chain-only writes the hooks alone, always writes the relay with the effective fields', t => {
  const d = dirs(t)
  const s = read(prepare(d, { mode: 'chain-only' }))
  assert.deepStrictEqual(Object.keys(s.hooks).sort(), [...settings.HOOK_EVENTS].sort())
  assert.strictEqual(Object.keys(s.hooks).length, 11)
  for (const ev of settings.HOOK_EVENTS) {
    assert.deepStrictEqual(s.hooks[ev], [{ hooks: [{ type: 'command', command: `'/usr/bin/python3' -I -S '${path.join(__dirname, '..', 'app', 'relay', 'hook.py')}' '${d.root}'`, timeout: 1 }] }], ev)
  }
  assert.ok(!('statusLine' in s))

  write(path.join(d.cfg, 'settings.json'), { statusLine: { type: 'command', command: 'mine', padding: 2, refreshInterval: 5, hideVimModeIndicator: true } })
  const r = prepare(d, { mode: 'always' })
  const line = read(r).statusLine
  assert.ok(line.command.startsWith(`'/usr/bin/node' '${path.join(__dirname, '..', 'app', 'relay', 'statusline.js')}' '${d.root}' `), line.command)
  assert.strictEqual(chainOf(r), 'mine')
  assert.deepStrictEqual([line.padding, line.refreshInterval, line.hideVimModeIndicator], [2, 5, true])
})

test('W6 the settings file is mode 0600, named for its text, written once and kept', t => {
  const d = dirs(t)
  const r = prepare(d)
  assert.strictEqual(fs.statSync(r.args[1]).mode & 0o777, 0o600)
  assert.strictEqual(fs.statSync(d.store).mode & 0o777, 0o700)
  assert.strictEqual(path.dirname(r.args[1]), d.store)
  const before = fs.statSync(r.args[1]).mtimeMs
  assert.strictEqual(prepare(d).args[1], r.args[1], 'the same text, the same file')
  assert.strictEqual(fs.statSync(r.args[1]).mtimeMs, before, 'not written again')
  write(path.join(d.cfg, 'settings.json'), { statusLine: { type: 'command', command: 'other' } })
  const r2 = prepare(d)
  assert.notStrictEqual(r2.args[1], r.args[1], 'another chain, another file')
  assert.ok(fs.existsSync(r.args[1]), 'the first file stays')
  assert.deepStrictEqual(fs.readdirSync(d.store).sort(), [path.basename(r.args[1]), path.basename(r2.args[1])].sort())
})

test('W7 managed settings: a statusLine or a hook block sets the notice, managed compaction wins', t => {
  const d = dirs(t)
  const managed = path.join(d.cfg, '..', 'managed')
  write(path.join(d.cfg, 'settings.json'), { autoCompactWindow: 600000 })
  const cases = [
    [{ statusLine: { type: 'command', command: 'corp-line' } }, 'statusLine'],
    [{ disableAllHooks: true }, 'disableAllHooks'],
    [{ allowManagedHooksOnly: true }, 'allowManagedHooksOnly']
  ]
  for (const [data, key] of cases) {
    fs.rmSync(managed, { recursive: true, force: true })
    write(path.join(managed, 'managed-settings.json'), Object.assign({ autoCompactWindow: 300000 }, data))
    const r = prepare(d, { managedDir: managed })
    assert.deepStrictEqual(r.managed, [key], key)
    assert.strictEqual(r.compaction.compactWindow, 300000, key)
  }
  fs.rmSync(managed, { recursive: true, force: true })
  write(path.join(managed, 'managed-settings.d', '10-corp.json'), { env: { CLAUDE_CODE_AUTO_COMPACT_WINDOW: '250000', ANTHROPIC_AUTH_TOKEN: SECRET } })
  const r = prepare(d, { managedDir: managed })
  assert.deepStrictEqual(r.managed, [])
  assert.strictEqual(r.compaction.compactWindow, 250000)
  assert.ok(!JSON.stringify(r).includes(SECRET))
  fs.rmSync(managed, { recursive: true, force: true })
  assert.deepStrictEqual(prepare(d, { managedDir: managed }).managed, [])
})

test('W7 the adapter: managed hooks off give the notice and no hook meters', async t => {
  const d = dirs(t)
  const managed = path.join(d.cfg, '..', 'managed')
  write(path.join(managed, 'managed-settings.json'), { disableAllHooks: true })
  const bus = new Bus()
  const logged = []
  const a = new ClaudeAdapter(bus, { cmd: ['claude'], env: { CLAUDE_CONFIG_DIR: d.cfg }, cwd: d.repo, runDir: d.run, root: d.root, store: d.store, mode: 'always', node: NODE, python: '/usr/bin/python3', log: m => logged.push(m), managedDir: managed })
  try {
    const r = await a.prepare()
    assert.strictEqual(r.notice, 'meters limited: managed settings')
    assert.ok(logged.some(l => l.includes('managed settings: disableAllHooks')), logged.join('\n'))
    assert.strictEqual(a.report().channels.find(c => c.name === 'hooks').state, 'off')
  } finally { a.close() }
})
