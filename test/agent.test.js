'use strict'
// The agent adapter seam: dispatch, the label, the failure rule, the
// order of operations, close.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { Bus } = require('../app/metrics/bus')
const { open, kindOf } = require('../app/metrics/agent')
const identity = require('../app/identity')

const { refused } = require('./helpers/relay')

function tempDir (t) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-test-'))
  t.after(() => fs.rmSync(d, { recursive: true, force: true }))
  return d
}

function ctx (t, cmd, over = {}) {
  const d = tempDir(t)
  fs.mkdirSync(path.join(d, 'cfg'))
  fs.mkdirSync(path.join(d, 'run'))
  return Object.assign({
    cmd,
    cwd: d,
    env: { PATH: process.env.PATH, CLAUDE_CONFIG_DIR: path.join(d, 'cfg'), CODEX_HOME: path.join(d, 'codex') },
    runDir: path.join(d, 'run'),
    root: path.join(d, 'root'),
    store: path.join(d, 'store'),
    options: { statusline: 'always' },
    bus: new Bus(),
    log: () => {},
    managedDir: path.join(d, 'no-managed')
  }, over)
}

test('dispatch: claude and codex, bare or with an underscore suffix, else plain', () => {
  const rows = {
    claude: 'claude',
    '/usr/local/bin/claude': 'claude',
    'scripts/fake/claude': 'claude',
    claude_work: 'claude',
    codex: 'codex',
    codex_work: 'codex',
    '/usr/local/bin/codex_work': 'codex',
    bash: 'plain',
    'codex-shared': 'plain',
    'claude-skins': 'plain',
    claudex: 'plain',
    codex_: 'plain'
  }
  for (const [cmd, kind] of Object.entries(rows)) assert.strictEqual(kindOf([cmd]), kind, cmd)
})

test('the label names the profile of the dispatched adapter', () => {
  const home = os.homedir()
  const env = { CLAUDE_CONFIG_DIR: path.join(home, '.claude-work'), CODEX_HOME: path.join(home, '.codex-work') }
  const rows = [
    [['/usr/local/bin/claude'], 'claude [work]'],
    [['claude_work'], 'claude_work [work]'],
    [['codex_work'], 'codex_work [work]'],
    [['codex-shared'], 'codex-shared'],
    [['bash'], 'bash']
  ]
  for (const [cmd, want] of rows) assert.strictEqual(identity.label(cmd, env, kindOf(cmd)), want, cmd[0])
})

test('a failed prepare resolves the failure notice and leaves no socket listening', async t => {
  const c = ctx(t, ['claude'])
  const store = path.join(c.runDir, 'store-is-a-file')
  fs.writeFileSync(store, '')
  const agent = open(Object.assign(c, { store }))
  try {
    assert.deepStrictEqual(await agent.prepare(), { args: [], notice: 'meters limited: adapter failed' })
    assert.ok(agent.adapter.server, 'the receiver had started')
    assert.ok(await refused(agent.adapter.server.socket), 'the hook socket refuses connections')
  } finally { agent.close() }
})

test('close during an in-flight prepare leaves no socket listening', async t => {
  const agent = open(ctx(t, ['claude']))
  const p = agent.prepare()
  agent.close()
  await p
  assert.ok(agent.adapter.server)
  assert.ok(await refused(agent.adapter.server.socket), 'the hook socket refuses connections')
})

test('attach before prepare throws, close twice does not', async t => {
  for (const cmd of [['claude'], ['codex'], ['bash']]) {
    const agent = open(ctx(t, cmd))
    assert.throws(() => agent.attach(process.pid), /before prepare/)
    await agent.prepare()
    agent.attach(process.pid)
    assert.throws(() => agent.attach(process.pid), /attach twice/)
    agent.close()
    agent.close()
  }
})

test('open writes nothing to the bus, and plain prepares nothing', async t => {
  const c = ctx(t, ['bash'])
  const agent = open(c)
  try {
    assert.deepStrictEqual(c.bus.snapshot(), {})
    assert.strictEqual(agent.kind, 'plain')
    assert.deepStrictEqual(await agent.prepare(), { args: [], notice: null })
  } finally { agent.close() }
})
