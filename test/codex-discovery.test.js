'use strict'
// Codex rollout discovery at its interface: a temp CODEX_HOME, a real
// sleep child for the fd route, mtimes set relative to the real clock.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')
const { Discovery } = require('../app/metrics/codex/discovery')

const CWD = '/work/project'
const DAY = 86400000
const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'codex-discovery-'))
const kids = []

test.after(() => {
  for (const k of kids) try { k.kill('SIGKILL') } catch (e) {}
  fs.rmSync(root, { recursive: true, force: true })
})

let serial = 0
function uuid () {
  return `01a12c5b-c2a0-7221-b9e6-${String(++serial).padStart(12, '0')}`
}

function home () {
  const h = path.join(root, `home-${++serial}`)
  fs.mkdirSync(path.join(h, 'sessions'), { recursive: true })
  return h
}

const pad = n => String(n).padStart(2, '0')

// The local date dir `back` days before now, as the code steps it.
function day (back = 0) {
  const d = new Date(Date.now() - back * DAY)
  return path.join(String(d.getFullYear()), pad(d.getMonth() + 1), pad(d.getDate()))
}

// A rollout whose first line is session_meta. stamp: the thread's
// creation, in the payload and the name. written: when the line was
// written, its top-level timestamp, which Codex 0.162 sets at the first
// prompt. mtime: the last write. bulk: bytes of instructions that
// lengthen the first line.
function rollout (h, dir, { id = uuid(), cwd = CWD, source = 'cli', parent, stamp = Date.now(), written = stamp, mtime, bulk = 0 } = {}) {
  const d = path.join(h, 'sessions', dir)
  fs.mkdirSync(d, { recursive: true })
  const t = new Date(stamp)
  const local = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}-${pad(t.getMinutes())}-${pad(t.getSeconds())}`
  const file = path.join(d, `rollout-${local}-${id}.jsonl`)
  const src = parent ? { subagent: { thread_spawn: { parent_thread_id: parent, depth: 1 } } } : source
  const meta = { timestamp: new Date(written).toISOString(), type: 'session_meta', payload: { id, timestamp: t.toISOString(), cwd, source: src, originator: 'codex-tui', cli_version: '0.162.1' } }
  if (bulk) meta.payload.instructions = 'x'.repeat(bulk)
  const next = { timestamp: t.toISOString(), type: 'event_msg', payload: { type: 'task_started' } }
  fs.writeFileSync(file, JSON.stringify(meta) + '\n' + JSON.stringify(next) + '\n')
  if (mtime !== undefined) touch(file, mtime)
  return file
}

function touch (p, ms) {
  fs.utimesSync(p, new Date(ms), new Date(ms))
}

// A real child holding `file` open as its stdout. Returns its pid.
function hold (file) {
  const fd = fs.openSync(file, 'a')
  const k = spawn('sleep', ['30'], { stdio: ['ignore', fd, 'ignore'] })
  fs.closeSync(fd)
  kids.push(k)
  return k.pid
}

function disc (h, argv, launched = Date.now(), cwd = CWD) {
  return new Discovery({ env: { CODEX_HOME: h }, argv, cwd, launched })
}

const pick = r => ({ file: r.file, how: r.how, exact: r.exact })

test('T1 resume <id> finds the rollout named for the id in any date dir', () => {
  for (const back of [100, 120]) {
    const h = home()
    const id = uuid()
    const old = Date.now() - back * DAY
    const f = rollout(h, day(back), { id, cwd: '/elsewhere', stamp: old, mtime: old })
    touch(path.join(h, 'sessions', day(back)), old)
    const r = disc(h, ['-s', 'read-only', 'resume', id]).find()
    assert.deepStrictEqual({ file: r.file, how: r.how, exact: r.exact, thread: r.thread }, { file: f, how: 'argv', exact: true, thread: id }, `${back} days back`)
  }
})

test('T2 route order: argv, then fd, then the cwd route', () => {
  const h = home()
  const launched = Date.now() - 5000
  const id = uuid()
  const byId = rollout(h, day(), { id, cwd: '/elsewhere', stamp: launched + 1000 })
  const held = rollout(h, day(), { cwd: '/elsewhere', source: 'vscode', stamp: launched + 1000 })
  const fresh = rollout(h, day(), { stamp: launched + 1000 })
  const pid = hold(held)
  assert.deepStrictEqual(pick(disc(h, ['resume', id], launched).find(pid)), { file: byId, how: 'argv', exact: true })
  assert.deepStrictEqual(pick(disc(h, [], launched).find(pid)), { file: held, how: 'fd', exact: true })
  assert.deepStrictEqual(pick(disc(h, [], launched).find()), { file: fresh, how: 'new', exact: false })
})

test('T3 a subagent rollout is never chosen, held open or fresh in our cwd', () => {
  const h = home()
  const launched = Date.now() - 5000
  const sub = rollout(h, day(), { parent: uuid(), stamp: launched + 1000 })
  const pid = hold(sub)
  assert.strictEqual(disc(h, [], launched).find(pid).file, null)
})

test('T4 the launch cut: stamped 3 s before launch is not new, 1 s before is', () => {
  const launched = Date.now()
  for (const [ago, chosen] of [[3000, false], [1000, true]]) {
    const h = home()
    const f = rollout(h, day(), { stamp: launched - ago })
    assert.strictEqual(disc(h, [], launched).find().file, chosen ? f : null, `stamped ${ago} ms before launch`)
  }
})

test('T5 a miss reports none and the routes tried, in order', () => {
  const absent = path.join(root, 'absent')
  assert.deepStrictEqual(disc(absent, ['resume', uuid()]).find(process.pid), { file: null, how: 'none', tried: ['argv', 'fd', 'resumed'] })
  assert.deepStrictEqual(disc(home(), ['resume', '--last']).find(process.pid), { file: null, how: 'none', tried: ['fd', 'resumed'] })
  assert.deepStrictEqual(disc(home(), []).find(), { file: null, how: 'none', tried: ['new'] })
})

test('T6 a symlinked CODEX_HOME: the fd route finds the held rollout', () => {
  const real = home()
  const link = path.join(root, `link-${++serial}`)
  fs.symlinkSync(real, link)
  const launched = Date.now() - 5000
  const f = rollout(real, day(), { cwd: '/elsewhere', stamp: launched + 1000 })
  const pid = hold(f)
  assert.deepStrictEqual(pick(disc(link, [], launched).find(pid)), { file: f, how: 'fd', exact: true })
})

test('T7 -C <dir>: a rollout whose session_meta.cwd is <dir> is found', () => {
  for (const argv of [['-C', '/work/other'], ['--cd', '/work/other'], ['--cd=/work/other'], ['-C/work/other'], ['-C', '../other']]) {
    const h = home()
    const f = rollout(h, day(), { cwd: '/work/other' })
    assert.strictEqual(disc(h, argv, Date.now() - 5000).find().file, f, argv.join(' '))
  }
})

test('T8 a first line over 64 KiB is read, and the rollout is found', () => {
  const h = home()
  const f = rollout(h, day(), { bulk: 80 * 1024 })
  assert.ok(fs.readFileSync(f, 'utf8').indexOf('\n') > 64 * 1024)
  assert.strictEqual(disc(h, [], Date.now() - 5000).find().file, f)
})

test('T10 subagents: spawned once, active while written within 20 s', () => {
  const h = home()
  const launched = Date.now() - 60000
  const thread = uuid()
  rollout(h, day(), { id: thread, stamp: launched + 1000 })
  const kid = rollout(h, day(), { parent: thread, stamp: Date.now() - 1000, mtime: Date.now() - 1000 })
  const d = disc(h, [], launched)
  assert.deepStrictEqual(d.subagents(thread), { spawned: 1, active: 1 })
  touch(kid, Date.now() - 21000)
  assert.deepStrictEqual(d.subagents(thread), { spawned: 0, active: 0 })
})

test('T9 a subagent of ours in a date dir other than today\'s, created after launch, is counted', () => {
  const h = home()
  const launched = Date.now() - 60000
  const thread = uuid()
  rollout(h, day(1), { parent: thread, stamp: Date.now() - 1000, mtime: Date.now() - 1000 })
  assert.deepStrictEqual(disc(h, [], launched).subagents(thread), { spawned: 1, active: 1 })
})

test('T11 a subagent of our subagent is not counted', () => {
  const h = home()
  const launched = Date.now() - 60000
  const thread = uuid()
  const child = uuid()
  rollout(h, day(), { id: child, parent: thread, stamp: Date.now() - 2000, mtime: Date.now() - 2000 })
  rollout(h, day(), { parent: child, stamp: Date.now() - 1000, mtime: Date.now() - 1000 })
  assert.deepStrictEqual(disc(h, [], launched).subagents(thread), { spawned: 1, active: 1 })
})

test('T12 fresh session: an older session of our cwd written after launch is not chosen, ours is', () => {
  const h = home()
  const launched = Date.now() - 10000
  const ours = rollout(h, day(), { stamp: launched + 1000, mtime: launched + 2000 })
  rollout(h, day(), { stamp: launched - 3 * 3600000, mtime: launched + 2500 })
  assert.deepStrictEqual(pick(disc(h, [], launched).find()), { file: ours, how: 'new', exact: false })
})

test('T18 fresh session: a session of our cwd created before launch and first prompted after it is not chosen', () => {
  const h = home()
  const launched = Date.now() - 10000
  rollout(h, day(), { stamp: launched - 60000, written: launched + 1000, mtime: launched + 1000 })
  const ours = rollout(h, day(), { stamp: launched + 500, written: launched + 3000, mtime: launched + 3000 })
  assert.deepStrictEqual(pick(disc(h, [], launched).find()), { file: ours, how: 'new', exact: false })
})

test('T13 fresh session: of two rollouts of our cwd stamped after launch, the earlier is chosen', () => {
  const h = home()
  const launched = Date.now() - 10000
  const first = rollout(h, day(), { stamp: launched + 1000, mtime: launched + 3000 })
  rollout(h, day(), { stamp: launched + 2000, mtime: launched + 4000 })
  assert.strictEqual(disc(h, [], launched).find().file, first)
})

test('T14 resume --last: a rollout of our cwd 10 days back, appended after launch, is found', () => {
  const h = home()
  const old = Date.now() - 10 * DAY
  const f = rollout(h, day(10), { stamp: old, mtime: Date.now() })
  touch(path.join(h, 'sessions', day(10)), old)
  const r = disc(h, ['resume', '--last'], Date.now() - 5000).find()
  assert.deepStrictEqual(pick(r), { file: f, how: 'resumed', exact: false })
})

test('T15 resume --last: a fresh unrelated session in our cwd is not chosen', () => {
  const h = home()
  const launched = Date.now() - 10000
  const old = Date.now() - 10 * DAY
  const resumed = rollout(h, day(10), { stamp: old, mtime: old })
  touch(path.join(h, 'sessions', day(10)), old)
  rollout(h, day(), { stamp: launched + 5000 })
  const d = disc(h, ['resume', '--last'], launched)
  assert.deepStrictEqual(d.find(), { file: null, how: 'none', tried: ['resumed'] })
  touch(resumed, Date.now())
  assert.deepStrictEqual(pick(d.find()), { file: resumed, how: 'resumed', exact: false })
})

test('T16 resume <name> takes the resumed route', () => {
  const h = home()
  const launched = Date.now() - 10000
  const old = Date.now() - 3 * DAY
  const f = rollout(h, day(3), { stamp: old, mtime: Date.now() })
  touch(path.join(h, 'sessions', day(3)), old)
  rollout(h, day(), { stamp: launched + 1000 })
  assert.deepStrictEqual(pick(disc(h, ['resume', 'my-session'], launched).find()), { file: f, how: 'resumed', exact: false })
  assert.deepStrictEqual(disc(home(), ['resume', 'my-session']).find(), { file: null, how: 'none', tried: ['resumed'] })
})

test('T19 fork <id>: the source, written after launch, is not followed, the new thread is', () => {
  const h = home()
  const launched = Date.now() - 10000
  const id = uuid()
  rollout(h, day(2), { id, stamp: Date.now() - 2 * DAY, mtime: launched + 3000 })
  const ours = rollout(h, day(), { stamp: launched + 800, mtime: launched + 900 })
  assert.deepStrictEqual(pick(disc(h, ['fork', id], launched).find()), { file: ours, how: 'forked', exact: false })
  assert.deepStrictEqual(disc(home(), ['fork', id]).find(), { file: null, how: 'none', tried: ['forked'] })
})

test('T17 latch: after a hit, a newer candidate does not change the answer', () => {
  const h = home()
  const launched = Date.now() - 10000
  const first = rollout(h, day(), { stamp: launched + 1000, mtime: launched + 1000 })
  const d = disc(h, [], launched)
  const a = d.find()
  assert.strictEqual(a.file, first)
  const newer = rollout(h, day(), { stamp: launched + 2000 })
  assert.strictEqual(d.find(hold(newer)), a)
})

// A rollout whose first line references `from`'s history up to `end`,
// as Codex 0.162.1 writes a fork.
function forkOf (h, from, end, id = uuid()) {
  const file = rollout(h, day(), { id })
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  const meta = JSON.parse(lines[0])
  meta.payload.history_mode = 'paginated'
  meta.payload.history_base = { thread_id: from, end_byte_offset: end, end_ordinal_exclusive: 2 }
  lines[0] = JSON.stringify(meta)
  fs.writeFileSync(file, lines.join('\n'))
  return { file, id }
}

test('T20 a fork of a fork: its sources, oldest first, each to the byte it was forked at', () => {
  const h = home()
  const a = rollout(h, day(1), { id: uuid() })
  const aId = path.basename(a).slice(-42, -6)
  const b = forkOf(h, aId, fs.statSync(a).size)
  const c = forkOf(h, b.id, 100)
  assert.deepStrictEqual(disc(h, ['fork', b.id]).bases(c.file), [{ file: a, end: fs.statSync(a).size }, { file: b.file, end: 100 }])
  assert.deepStrictEqual(disc(h, []).bases(a), [])
})

test('T21 a source not found, a fork naming itself, or a bad offset gives no sources', () => {
  const h = home()
  assert.deepStrictEqual(disc(h, []).bases(forkOf(h, uuid(), 10).file), [])
  const id = uuid()
  assert.deepStrictEqual(disc(h, []).bases(forkOf(h, id, 10, id).file), [])
  const a = rollout(h, day(), { id: uuid() })
  assert.deepStrictEqual(disc(h, []).bases(forkOf(h, path.basename(a).slice(-42, -6), -1).file), [])
})
