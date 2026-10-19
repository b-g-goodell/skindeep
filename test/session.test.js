'use strict'
// The Session with a real pty. Every test awaits the end and kills the
// child's group in a finally: a child that ignores SIGHUP outlives node.
const test = require('node:test')
const assert = require('node:assert')
const { Session } = require('../app/session')
const { Tabs } = require('../app/tabs')
const { RecordingView } = require('./helpers/recording-view')
const cli = require('../app/cli')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// The grace runs on libuv's monotonic clock in whole ms, so a 2000 ms
// grace timed from outside can read a ms or two short: 1999 ms in 2 of
// 224 runs, 2026-10-12. Times are taken on the monotonic clock.
const now = () => performance.now()
const SLACK_MS = 5

// An adapter that records every call made to it.
function recorder (over = {}) {
  const a = { calls: [], out: 0 }
  a.prepare = over.prepare || (async () => { a.calls.push('prepare'); return { args: [], notice: null } })
  a.attach = pid => a.calls.push(['attach', pid])
  a.onOutput = n => { if (!a.calls.includes('output')) a.calls.push('output'); a.out += n }
  a.onInput = () => a.calls.push('input')
  a.close = () => a.calls.push('close')
  return a
}

function make (argv, over = {}) {
  const view = over.view || new RecordingView()
  const told = []
  const logged = []
  const s = new Session(Object.assign({
    file: cli.resolveCommand(argv[0], process.env.PATH),
    argv,
    cwd: process.cwd(),
    env: process.env,
    label: argv[0],
    adapters: [],
    view,
    tell: m => told.push(m),
    log: m => logged.push(m)
  }, over))
  return { s, view, told, logged }
}

function gone (pid) {
  try { process.kill(-pid, 0); return false } catch (e) { return e.code === 'ESRCH' }
}

function cleanup (s) {
  if (s.pid) try { process.kill(-s.pid, 'SIGKILL') } catch (e) {}
}

async function until (pred, ms = 5000) {
  const end = Date.now() + ms
  while (!pred()) {
    if (Date.now() > end) throw new Error('timed out waiting')
    await sleep(20)
  }
}

const spawned = s => new Promise(resolve => s.once('spawn', resolve))

test('S1 exit 7 before the view loads ends 7', { timeout: 10000 }, async () => {
  const { s, told } = make(['sh', '-c', 'exit 7'])
  try {
    s.start(80, 24)
    assert.strictEqual(await s.ended, 7)
    assert.strictEqual(s.status, 7)
    assert.deepStrictEqual(told, [])
  } finally { cleanup(s) }
})

test('S2 death by signal n gives 128+n', { timeout: 10000 }, async () => {
  for (const [sig, want] of [['TERM', 143], ['KILL', 137], ['HUP', 129]]) {
    const { s } = make(['sh', '-c', `kill -${sig} $$`])
    try {
      s.start(80, 24)
      assert.strictEqual(await s.ended, want, sig)
    } finally { cleanup(s) }
  }
})

test('S3 a HUP-ignoring child is killed after the grace on close', { timeout: 6000 }, async () => {
  const { s, view } = make(['sh', '-c', 'trap "" HUP; echo ready; sleep 20'])
  try {
    s.start(80, 24)
    await until(() => view.text().includes('ready'))
    const t0 = now()
    s.hangup()
    assert.strictEqual(await s.ended, 137)
    const took = now() - t0
    assert.ok(took >= 2000 - SLACK_MS, `ended after ${took} ms`)
    // A killed grandchild lingers as a zombie until its new parent reaps it.
    await until(() => gone(s.pid), 1000)
  } finally { cleanup(s) }
})

// A wrapped tab (decision 0037): the wrapper's words exec'd around the
// CLI's, the CLI's exit status through, the strip's command line the
// CLI's, and a hangup to the CLI alone, never to its shell.
test('S16 a wrap runs the launcher around the argv and signals the command it runs', { timeout: 10000 }, async () => {
  const shell = argv => ['bash', '--norc', '-i', '-c', argv.map(a => `'${a}'`).join(' ')]
  const program = 'process.on("SIGHUP", () => { console.log("hup"); process.exit(3) }); console.log("WRAPPED=" + process.env.WRAPPED); console.log("ready"); setInterval(() => {}, 1000)'
  const { s, view } = make(['node', '-e', program], {
    file: '/usr/bin/env',
    wrap: argv => ['env', 'WRAPPED=1', ...shell(argv)],
    pollMs: 100
  })
  try {
    s.start(80, 24)
    await until(() => view.text().includes('ready'))
    assert.ok(view.text().includes('WRAPPED=1'), view.text())
    await sleep(300)
    // The strip names the command at the end of the wrapper chain.
    const strip = view.strips().pop()
    assert.ok(/^node -e /.test(strip.cmdline), strip.cmdline)
    s.hangup()
    assert.strictEqual(await s.ended, 3)
    assert.ok(view.text().includes('hup'), view.text())
  } finally { cleanup(s) }
})

// The window's tabs over one real Session: an app error is app/tabs.js's.
function tabbed (s) {
  const told = []
  const tabs = new Tabs({ make: id => ({ id, session: s }), tell: m => told.push(m), log: () => {} })
  tabs.add({})
  return { tabs, told }
}

test('S4 an internal error ends 125 by the same kill policy', { timeout: 6000 }, async () => {
  const { s, view } = make(['sh', '-c', 'trap "" HUP; echo ready; sleep 20'])
  const { tabs, told } = tabbed(s)
  try {
    s.start(80, 24)
    await until(() => view.text().includes('ready'))
    const t0 = now()
    tabs.fail(new Error('boom'))
    assert.strictEqual(await tabs.ended, 125)
    assert.strictEqual(await s.ended, 137)
    const took = now() - t0
    assert.ok(took >= 2000 - SLACK_MS, `ended after ${took} ms`)
    // A killed grandchild lingers as a zombie until its new parent reaps it.
    await until(() => gone(s.pid), 1000)
    assert.strictEqual(told.length, 1)
    assert.match(told[0], /^internal error: Error: boom/)
  } finally { cleanup(s) }
})

test('S5 a default-disposition child ends 129 on close, inside the grace', { timeout: 6000 }, async () => {
  const { s } = make(['sleep', '30'])
  try {
    const pid = spawned(s)
    s.start(80, 24)
    await pid
    const t0 = now()
    s.hangup()
    assert.strictEqual(await s.ended, 129)
    assert.ok(now() - t0 < 1500, `ended after ${now() - t0} ms`)
  } finally { cleanup(s) }
})

test('S6 a second hangup does not restart the grace', { timeout: 6000 }, async () => {
  const { s, view } = make(['sh', '-c', 'trap "" HUP; echo ready; sleep 20'])
  try {
    s.start(80, 24)
    await until(() => view.text().includes('ready'))
    const t0 = now()
    s.hangup()
    await sleep(1000)
    s.hangup()
    assert.strictEqual(await s.ended, 137)
    const took = now() - t0
    assert.ok(took >= 2000 - SLACK_MS && took < 2800, `ended after ${took} ms`)
  } finally { cleanup(s) }
})

test('S7 pty bytes reach the view unchanged, as Buffers', { timeout: 10000 }, async () => {
  const a = recorder()
  // a, one CJK character as its three UTF-8 bytes, b
  const want = Buffer.from([0x61, 0xe4, 0xb8, 0xad, 0x62])
  const { s, view } = make(['printf', 'a\\344\\270\\255b'], { adapters: [a] })
  try {
    s.start(80, 24)
    assert.strictEqual(await s.ended, 0)
    const chunks = view.sent.filter(([c]) => c === 'pty:data').map(([, d]) => d)
    assert.ok(chunks.length > 0 && chunks.every(Buffer.isBuffer))
    assert.deepStrictEqual(view.bytes(), want)
    assert.strictEqual(a.out, want.length)
  } finally { cleanup(s) }
})

test('S8 input reaches the child', { timeout: 10000 }, async () => {
  const { s, view } = make(['sh', '-c', 'read x && echo got:$x'])
  try {
    const pid = spawned(s)
    s.start(80, 24)
    await pid
    s.input('hi\r')
    assert.strictEqual(await s.ended, 0)
    assert.match(view.text(), /got:hi/)
  } finally { cleanup(s) }
})

test('S9 the child environment has the terminal type and none of the app variables', { timeout: 10000 }, async () => {
  const env = Object.assign({}, process.env, { SKINNED_SKIN: 'x', SKINNED_RUNTIME_DIR: 'x', CHROME_DESKTOP: 'x', FC_FONTATIONS: 'x' })
  const { s, view } = make(['env'], { env })
  try {
    s.start(200, 24)
    assert.strictEqual(await s.ended, 0)
    const vars = view.text().split(/\r?\n/)
    assert.ok(vars.includes('TERM=xterm-256color'))
    assert.ok(vars.includes('COLORTERM=truecolor'))
    for (const k of ['SKINNED_SKIN', 'SKINNED_RUNTIME_DIR', 'CHROME_DESKTOP', 'FC_FONTATIONS']) {
      assert.ok(!vars.some(v => v.startsWith(k + '=')), k)
    }
  } finally { cleanup(s) }
})

// A prepare the test settles by hand.
function held () {
  let release
  const p = new Promise(resolve => { release = resolve })
  return { p, release }
}

function tempDir (t) {
  const fs = require('fs')
  const os = require('os')
  const path = require('path')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  return dir
}

test('P1 a close during prepare spawns nothing and ends 129', { timeout: 10000 }, async t => {
  const fs = require('fs')
  const path = require('path')
  const mark = path.join(tempDir(t), 'MARK')
  const h = held()
  const a = recorder({ prepare: () => h.p })
  const { s } = make(['sh', '-c', `echo x > ${mark}`], { adapters: [a] })
  try {
    s.start(80, 24)
    s.hangup()
    assert.strictEqual(await s.ended, 129)
    h.release({ args: [], notice: null })
    await sleep(500)
    assert.strictEqual(s.pid, null)
    assert.deepStrictEqual(a.calls.filter(c => c === 'close'), ['close'])
    assert.ok(!fs.existsSync(mark), 'the child ran')
  } finally { cleanup(s) }
})

test('P2 an internal error during prepare ends 125 with no spawn', { timeout: 10000 }, async t => {
  const fs = require('fs')
  const path = require('path')
  const mark = path.join(tempDir(t), 'MARK')
  const h = held()
  const a = recorder({ prepare: () => h.p })
  const { s } = make(['sh', '-c', `echo x > ${mark}`], { adapters: [a] })
  const { tabs, told } = tabbed(s)
  try {
    s.start(80, 24)
    tabs.fail(new Error('boom'))
    assert.strictEqual(await tabs.ended, 125)
    h.release({ args: [], notice: null })
    await sleep(500)
    assert.strictEqual(s.pid, null)
    assert.strictEqual(told.length, 1)
    assert.ok(!fs.existsSync(mark), 'the child ran')
  } finally { cleanup(s) }
})

test('P3 a rejecting prepare spawns without its arguments and still closes', { timeout: 10000 }, async () => {
  const a = recorder({ prepare: async () => { throw new Error('no port') } })
  const { s, view, logged } = make(['echo', 'u1'], { adapters: [a] })
  try {
    s.start(80, 24)
    assert.strictEqual(await s.ended, 0)
    assert.match(view.text(), /^u1\r?\n/)
    assert.strictEqual(s.notice, 'meters limited: adapter failed')
    assert.ok(a.calls.includes('close'))
    assert.ok(logged.some(l => l.includes('no port')))
  } finally { cleanup(s) }
})

test('P4 a spawn failure ends 125, with no unhandled rejection', { timeout: 10000 }, async () => {
  const rejections = []
  const onRejection = e => rejections.push(e)
  process.on('unhandledRejection', onRejection)
  const a = recorder()
  const { s, told } = make(['sh', '-c', 'exit 0'], { adapters: [a] })
  try {
    s.start('80', 24)
    assert.strictEqual(await s.ended, 125)
    await sleep(50)
    assert.strictEqual(told.length, 1)
    assert.match(told[0], /^cannot start sh: .*cols/)
    assert.ok(a.calls.includes('close'))
    assert.deepStrictEqual(rejections, [])
  } finally {
    process.off('unhandledRejection', onRejection)
    cleanup(s)
  }
})

test('P5 prepare, spawn, attach with the pid, output, close, then the end', { timeout: 10000 }, async () => {
  const a = recorder()
  const { s } = make(['echo', 'hi'], { adapters: [a] })
  try {
    let pid = null
    s.once('spawn', p => { pid = p; a.calls.push('spawn') })
    s.start(80, 24)
    await s.ended
    a.calls.push('ended')
    assert.deepStrictEqual(a.calls, ['prepare', ['attach', pid], 'spawn', 'output', 'close', 'ended'])
    assert.ok(pid > 0)
  } finally { cleanup(s) }
})

test('P6 adapter arguments go after argv[0], before the user arguments', { timeout: 10000 }, async () => {
  const a = recorder({ prepare: async () => ({ args: ['x1', 'x2'], notice: null }) })
  const { s, view } = make(['echo', 'u1'], { adapters: [a] })
  try {
    s.start(80, 24)
    assert.strictEqual(await s.ended, 0)
    assert.match(view.text(), /^x1 x2 u1\r?\n/)
  } finally { cleanup(s) }
})

test('T1 at spawn the view receives the strip', { timeout: 10000 }, async () => {
  const identity = require('../app/identity')
  const a = recorder({ prepare: async () => ({ args: [], notice: 'meters limited: test' }) })
  const { s, view } = make(['echo', 'a b'], { adapters: [a], label: 'echo [x]' })
  try {
    s.start(80, 24)
    await s.ended
    assert.deepStrictEqual(view.strips()[0], {
      label: 'echo [x]',
      cmdline: "echo 'a b'",
      cwd: identity.tildify(process.cwd()),
      notice: 'meters limited: test'
    })
  } finally { cleanup(s) }
})

test('T2 a view that loads after the spawn receives the latest strip', { timeout: 10000 }, async () => {
  const { s, view } = make(['sh', '-c', 'echo ready; sleep 5'])
  try {
    s.start(80, 24)
    await until(() => view.text().includes('ready'))
    view.sent.length = 0
    view.load()
    assert.strictEqual(view.strips().length, 1)
    assert.strictEqual(view.strips()[0].cmdline, "sh -c 'echo ready; sleep 5'")
    s.hangup()
    await s.ended
  } finally { cleanup(s) }
})

test('T3 the strip follows an exec in the child', { timeout: 10000 }, async () => {
  const { s, view } = make(['sh', '-c', 'sleep 0.3 && exec sleep 5'], { pollMs: 100 })
  try {
    s.start(80, 24)
    await until(() => view.strips().some(x => x.cmdline === 'sleep 5'))
    assert.strictEqual(view.strips()[0].cmdline, "sh -c 'sleep 0.3 && exec sleep 5'")
    s.hangup()
    await s.ended
  } finally { cleanup(s) }
})

test('S10 a hangup at the instant of spawn reaches the child', { timeout: 20000 }, async () => {
  // node-pty's child calls setsid after the fork returns, so its group can
  // be missing when the spawn event fires.
  for (let i = 0; i < 20; i++) {
    const { s } = make(['sleep', '30'])
    try {
      s.once('spawn', () => s.hangup())
      s.start(80, 24)
      assert.strictEqual(await s.ended, 129, `run ${i}`)
    } finally { cleanup(s) }
  }
})

test('T4 a notice the adapters report later reaches the strip', { timeout: 10000 }, async () => {
  const a = recorder()
  let notice = null
  a.report = () => ({ notice })
  const { s, view } = make(['sh', '-c', 'echo ready; sleep 5'], { adapters: [a], pollMs: 100 })
  try {
    s.start(80, 24)
    await until(() => view.text().includes('ready'))
    notice = 'meters waiting: test'
    await until(() => view.strips().some(x => x.notice === 'meters waiting: test'))
    notice = null
    await until(() => view.strips().pop().notice === null)
    s.hangup()
    await s.ended
  } finally { cleanup(s) }
})

// An executable file whose exec fails after it resolved, in a temp dir
// that also holds the error file.
function failing (t, name, bytes) {
  const fs = require('fs')
  const path = require('path')
  const dir = tempDir(t)
  const file = path.join(dir, name)
  fs.writeFileSync(file, bytes, { mode: 0o755 })
  return { file, execError: path.join(dir, 'exec-error') }
}

test('S11 an exec whose interpreter is missing ends 127 with the reason on fd 3', { timeout: 10000 }, async t => {
  const { file, execError } = failing(t, 'nointerp', '#!/nonexistent/interp\necho hi\n')
  const { s, told, view } = make(['nointerp'], { file, execError })
  try {
    s.start(80, 24)
    assert.strictEqual(await s.ended, 127)
    assert.deepStrictEqual(told, ['cannot start nointerp: required file not found'])
    assert.strictEqual(s.failure, 'required file not found')
    assert.doesNotMatch(view.text(), /Traceback/)
  } finally { cleanup(s) }
})

test('S12 an exec of no executable format ends 126 with the reason on fd 3', { timeout: 10000 }, async t => {
  const { file, execError } = failing(t, 'badelf', Buffer.from('\x7fELFgarbage', 'latin1'))
  const { s, told } = make(['badelf'], { file, execError })
  try {
    s.start(80, 24)
    assert.strictEqual(await s.ended, 126)
    assert.deepStrictEqual(told, ['cannot start badelf: Exec format error'])
  } finally { cleanup(s) }
})

test('S13 with no python3 on the PATH nothing spawns, the tab ends 125 with the reason on fd 3', { timeout: 10000 }, async t => {
  const { file, execError } = failing(t, 'nointerp', '#!/nonexistent/interp\necho hi\n')
  const { s, told } = make(['nointerp'], { file, execError, env: { PATH: tempDir(t) } })
  try {
    await s.start(80, 24)
    assert.strictEqual(await s.ended, 125)
    assert.strictEqual(s.pid, null)
    assert.deepStrictEqual(told, ['cannot start nointerp: python3 not found on PATH, the app needs it to start a command'])
  } finally { cleanup(s) }
})

test('S14 a CLI that exits by itself leaves its last screen, a hung-up one is not asked', { timeout: 10000 }, async () => {
  let asked = 0
  const screen = () => { asked++; return Promise.resolve('bye\nfrom the CLI') }
  const a = make(['sh', '-c', 'exit 0'], { screen })
  try {
    a.s.start(80, 24)
    assert.strictEqual(await a.s.ended, 0)
    assert.strictEqual(a.s.lastScreen, 'bye\nfrom the CLI')
    assert.strictEqual(asked, 1)
  } finally { cleanup(a.s) }
  const b = make(['sh', '-c', 'sleep 30'], { screen })
  try {
    const up = spawned(b.s)
    b.s.start(80, 24)
    await up
    b.s.hangup()
    assert.strictEqual(await b.s.ended, 129)
    assert.strictEqual(b.s.lastScreen, null)
    assert.strictEqual(asked, 1)
  } finally { cleanup(b.s) }
})

test('S15 a screen that never answers delays the end by at most a second', { timeout: 10000 }, async () => {
  const { s } = make(['sh', '-c', 'exit 3'], { screen: () => new Promise(() => {}) })
  try {
    const t0 = Date.now()
    s.start(80, 24)
    assert.strictEqual(await s.ended, 3)
    assert.ok(Date.now() - t0 < 1500, `${Date.now() - t0} ms`)
    assert.strictEqual(s.lastScreen, null)
  } finally { cleanup(s) }
})

test('T5 the strip writes words under the home directory with ~, the probe keeps the real path', { timeout: 10000 }, async () => {
  const home = require('os').homedir()
  const { s, view } = make(['sh', '-c', 'exit 0', `${home}/x`])
  try {
    s.start(80, 24)
    await s.ended
    assert.strictEqual(view.strips()[0].cmdline, "sh -c 'exit 0' ~/x")
    assert.ok(s.cmdline.endsWith(` ${home}/x`), s.cmdline)
  } finally { cleanup(s) }
})
