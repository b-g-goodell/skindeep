'use strict'
// The Claude adapter shell on temp dirs: prepare, the three channels
// through the real relays, close (decisions 0009, 0030).
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { Bus } = require('../app/metrics/bus')
const { ClaudeAdapter } = require('../app/metrics/claude')
const relay = require('./helpers/relay')
const server = require('../app/metrics/claude/server')

const fx = p => path.join(__dirname, 'fixtures', 'claude', p)
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function until (fn, ms = 5000) {
  const end = Date.now() + ms
  while (!fn()) {
    if (Date.now() > end) return false
    await sleep(20)
  }
  return true
}

// A temp profile, project (its own git root), runDir, runtime root and
// store, and a prepared adapter linked to this test's pid, so a relay
// the test runs finds it as it finds its tab. The relay commands come
// from the generated settings file.
async function setup (t, { userLine = null, deep = '' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-skins-adapter-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const dirs = {}
  for (const d of ['cfg', 'cwd', 'run', 'root']) {
    dirs[d] = path.join(root, d === 'run' || d === 'root' ? deep : '', d)
    fs.mkdirSync(dirs[d], { recursive: true, mode: 0o700 })
  }
  fs.mkdirSync(path.join(dirs.cwd, '.git'))
  if (userLine) fs.writeFileSync(path.join(dirs.cfg, 'settings.json'), JSON.stringify({ statusLine: { type: 'command', command: userLine } }))
  const bus = new Bus()
  const adapter = new ClaudeAdapter(bus, {
    cmd: ['claude'],
    env: { CLAUDE_CONFIG_DIR: dirs.cfg },
    cwd: dirs.cwd,
    runDir: dirs.run,
    root: dirs.root,
    store: path.join(root, 'store'),
    mode: 'always',
    node: { path: process.execPath, asElectron: false },
    python: 'python3',
    log: () => {},
    managedDir: path.join(root, 'no-managed')
  })
  t.after(() => adapter.close())
  const { args } = await adapter.prepare()
  adapter.attach(process.pid)
  const settings = JSON.parse(fs.readFileSync(args[1], 'utf8'))
  return {
    root,
    dirs,
    bus,
    adapter,
    file: args[1],
    hook: settings.hooks.PreToolUse[0].hooks[0].command,
    status: settings.statusLine.command,
    target: relay.link(dirs.root)
  }
}

// deep: the runtime dirs nested under it. A Unix socket path holds 107
// bytes, and the tab's socket and the relays' link are found under them.
async function relays (t, deep) {
  const s = await setup(t, { deep })
  const transcript = path.join(s.root, 'session.jsonl')
  fs.writeFileSync(transcript, '')
  const ids = { session_id: 'sess-1', transcript_path: transcript }
  for (const body of [
    Object.assign({ hook_event_name: 'SessionStart', source: 'startup' }, ids),
    Object.assign({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_use_id: 't1' }, ids)
  ]) {
    const r = await relay.run(s.hook, body)
    assert.deepStrictEqual([r.code, r.stdout, r.stderr], [0, '', ''], 'a hook prints nothing and exits 0')
  }
  const r = await relay.run(s.status, Object.assign(JSON.parse(fs.readFileSync(fx('statusline.json'), 'utf8')), ids))
  assert.deepStrictEqual([r.code, r.stdout], [0, ''], 'with no chain the statusline relay prints nothing')
  fs.appendFileSync(transcript, fs.readFileSync(fx('transcript-read.jsonl')))
  const snap = () => s.bus.snapshot()
  // The seam's clock polls the tail. Here the test polls it.
  assert.ok(await until(() => { s.adapter.poll(Date.now()); return snap()['tokens.out'] > 0 && snap()['context.window'] }), 'every channel reaches the bus')
  const m = snap()
  assert.strictEqual(m['event.tool'], 1)
  assert.strictEqual(m['tools.Read'], 1)
  assert.strictEqual(m['context.window'], 1000000)
  assert.strictEqual(m['cost.usd'], 0.3751829)

  s.adapter.close()
  assert.ok(!fs.existsSync(s.target), 'the link is removed after close')
  assert.ok(!fs.existsSync(s.adapter.server.socket), 'the socket is removed after close')
  if (!deep) assert.ok(await relay.refused(s.adapter.server.socket), 'the socket refuses connections after close')
  const before = JSON.stringify(snap())
  const late = { type: 'assistant', message: { id: 'msg_after_stop', model: 'claude-late', usage: { input_tokens: 1, output_tokens: 777, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } }
  fs.appendFileSync(transcript, JSON.stringify(late) + '\n')
  await sleep(700)
  s.adapter.poll(Date.now())
  assert.strictEqual(JSON.stringify(snap()), before, 'a line appended after close writes nothing')
  return s
}

test('S1 the relays fill the bus from hooks and statusline, the transcript follows, close releases all three', async t => {
  await relays(t, '')
})

test('S1b the same through runtime dirs whose socket and link paths exceed a Unix socket path', async t => {
  const s = await relays(t, path.join('d'.repeat(60), 'e'.repeat(60)))
  assert.ok(Buffer.byteLength(s.adapter.server.socket) > 107 && Buffer.byteLength(s.target) > 107, 'both paths are longer than sun_path holds')
})

// A session sent to the background keeps --settings FILE and outlives
// its window (decision 0030).
test('S2 after the window is gone a hook is silent, exits 0, and the settings file stays', async t => {
  const s = await setup(t)
  s.adapter.close()
  const body = { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_use_id: 't1', session_id: 'bg', transcript_path: '/nonexistent' }
  const r = await relay.run(s.hook, body)
  assert.deepStrictEqual([r.code, r.stdout, r.stderr], [0, '', ''])
  assert.ok(fs.existsSync(s.file), 'the settings file outlives the window')
  // A link left by a window that died: its socket is gone.
  fs.symlinkSync(path.join(s.dirs.run, 'gone.sock'), s.target)
  const r2 = await relay.run(s.hook, body)
  assert.deepStrictEqual([r2.code, r2.stdout, r2.stderr], [0, '', ''])
})

test('S3 the statusline relay runs the profile\'s statusline from the settings alone, with no window', async t => {
  const s = await setup(t, { userLine: 'printf "it\'s mine: %s" "$(head -c 1)"' })
  assert.ok(!fs.readFileSync(s.file, 'utf8').includes(s.dirs.run), 'the settings name no tab directory')
  s.adapter.close()
  const r = await relay.run(s.status, { session_id: 'bg' })
  assert.deepStrictEqual([r.code, r.stdout], [0, "it's mine: {"])
})

test('S4 a POST to an unknown route writes nothing', async t => {
  const s = await setup(t)
  assert.strictEqual(await relay.post(s.target, { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_use_id: 't1', session_id: 'sess-1' }, 'other'), 204)
  await sleep(200)
  const m = s.bus.snapshot()
  assert.strictEqual(m['event.tool'], undefined)
  assert.strictEqual(m['tools.Read'], undefined)
})

// Another user who could write ROOT/pids could point a link at a socket
// of their own: the relays send nothing through a pids dir that is not
// this uid's alone, and the receiver will not link into one.
test('S6 the relays send nothing through a ROOT/pids open to others, and the receiver refuses it', async t => {
  const s = await setup(t)
  const pids = path.join(s.dirs.root, 'pids')
  fs.chmodSync(pids, 0o777)
  const body = { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_use_id: 't1', session_id: 'sess-1' }
  const r = await relay.run(s.hook, body)
  assert.deepStrictEqual([r.code, r.stdout, r.stderr], [0, '', ''])
  const r2 = await relay.run(s.status, Object.assign(JSON.parse(fs.readFileSync(fx('statusline.json'), 'utf8')), { session_id: 'sess-1' }))
  assert.deepStrictEqual([r2.code, r2.stdout], [0, ''])
  await sleep(300)
  const m = s.bus.snapshot()
  assert.strictEqual(m['event.tool'], undefined, 'no hook reached the bus')
  assert.strictEqual(m['context.window'], undefined, 'no statusline reached the bus')
  await assert.rejects(server.start(s.dirs.run, s.dirs.root, () => {}, () => {}), e => e.message === `hooks links: ${pids}: mode 777, want 700`)
})

test('S5 a socket that cannot bind rejects with its path, never listens unseen', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-skins-adapter-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const dir = path.join(root, 'gone')
  await assert.rejects(server.start(dir, root, () => {}, () => {}), e => e.message.startsWith(`hooks socket ${path.join(dir, 'hooks.sock')}: cannot bind: `))
})
