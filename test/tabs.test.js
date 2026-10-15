'use strict'
// The tabs of a window (decision 0023) over fake sessions: the app's
// status, the 125 latch, the active tab after a close, the order.
const test = require('node:test')
const assert = require('node:assert')
const { Tabs } = require('../app/tabs')
const { Session } = require('../app/session')
const { RecordingView } = require('./helpers/recording-view')
const cli = require('../app/cli')

// A session that ends with `code` when hung up, or when exit(code) is
// called, as a CLI exiting on its own.
function fakeSession (hupCode = 129) {
  const s = { hups: 0 }
  s.ended = new Promise(resolve => { s.exit = resolve })
  s.hangup = () => { s.hups++; s.exit(hupCode) }
  return s
}

function make (over = {}) {
  const told = []
  const logged = []
  const tabs = new Tabs(Object.assign({
    make: (id, cwd) => ({ id, cwd, session: fakeSession() }),
    tell: m => told.push(m),
    log: m => logged.push(m)
  }, over))
  return { tabs, told, logged }
}

const tick = () => new Promise(resolve => setImmediate(resolve))

test('the app ends with the last tab, with its status', async () => {
  const { tabs } = make()
  const a = tabs.add('/a')
  const b = tabs.add('/b')
  a.session.exit(0)
  await tick()
  assert.deepStrictEqual(tabs.list.map(t => t.id), [b.id])
  assert.strictEqual(tabs.done, false)
  b.session.exit(7)
  assert.strictEqual(await tabs.ended, 7)
})

test('the first tab ending last gives its status, not the first-ended one', async () => {
  const { tabs } = make()
  const a = tabs.add('/a')
  const b = tabs.add('/b')
  b.session.exit(3)
  await tick()
  a.session.exit(5)
  assert.strictEqual(await tabs.ended, 5)
})

test('an app error decides 125 over the last tab, and is told once', async () => {
  const { tabs, told, logged } = make()
  const a = tabs.add('/a')
  const b = tabs.add('/b')
  tabs.fail(new Error('boom'))
  tabs.fail(new Error('again'))
  assert.strictEqual(await tabs.ended, cli.EXIT_APP)
  assert.strictEqual(told.length, 1)
  assert.match(told[0], /internal error: Error: boom/)
  assert.ok(logged.some(m => /again/.test(m)))
  assert.deepStrictEqual([a.session.hups, b.session.hups], [1, 1])
})

test('an app error after the last tab is logged, the status stands', async () => {
  const { tabs, told, logged } = make()
  tabs.add('/a').session.exit(4)
  assert.strictEqual(await tabs.ended, 4)
  tabs.fail(new Error('late'))
  assert.strictEqual(told.length, 0)
  assert.ok(logged.some(m => /late/.test(m)))
})

test('a close before the CLI started gives 129, through a real Session', async () => {
  const view = new RecordingView()
  const tabs = new Tabs({
    make: (id, cwd) => ({ id, cwd, session: new Session({ file: '/bin/sh', argv: ['sh'], cwd, env: process.env, label: 'sh', view, tell: () => {}, log: () => {} }) }),
    tell: () => {},
    log: () => {}
  })
  const t = tabs.add(process.cwd())
  tabs.close(t.id)
  assert.strictEqual(await tabs.ended, 129)
})

test('closing the active tab activates its right neighbour, else its left', async () => {
  const { tabs } = make()
  const [a, b, c] = ['/a', '/b', '/c'].map(d => tabs.add(d))
  assert.strictEqual(tabs.active, c)
  tabs.activate(b.id)
  tabs.close(b.id)
  await tick()
  assert.strictEqual(tabs.active, c)
  tabs.close(c.id)
  await tick()
  assert.strictEqual(tabs.active, a)
  assert.strictEqual(tabs.done, false)
})

test('closing a background tab keeps the active one', async () => {
  const { tabs } = make()
  const a = tabs.add('/a')
  const b = tabs.add('/b')
  const actives = []
  tabs.on('active', t => actives.push(t.id))
  tabs.close(a.id)
  await tick()
  assert.strictEqual(tabs.active, b)
  assert.deepStrictEqual(actives, [])
})

test('step wraps, move reorders, a gone tab reports its code and whether it was closed', async () => {
  const { tabs } = make()
  const [a, b, c] = ['/a', '/b', '/c'].map(d => tabs.add(d))
  tabs.step(1)
  assert.strictEqual(tabs.active, a)
  tabs.step(-1)
  assert.strictEqual(tabs.active, c)
  tabs.move(c.id, 0)
  assert.deepStrictEqual(tabs.list.map(t => t.id), [c.id, a.id, b.id])
  tabs.move(c.id, 99)
  assert.deepStrictEqual(tabs.list.map(t => t.id), [a.id, b.id, c.id])
  const gone = []
  tabs.on('gone', (t, code) => gone.push([t.id, code, t.closed]))
  b.session.exit(2)
  tabs.close(a.id)
  await tick()
  assert.deepStrictEqual(gone, [[b.id, 2, false], [a.id, 129, true]])
})

test('no tab is added once the app is ending', async () => {
  const { tabs } = make()
  tabs.add('/a')
  tabs.hangupAll()
  assert.strictEqual(tabs.add('/b'), null)
  assert.strictEqual(await tabs.ended, 129)
})

test('a monitor tab ending last ends the app with the last CLI tab\'s status', async () => {
  const { tabs } = make({ make: (id, spec) => ({ id, monitor: spec === 'monitor', session: fakeSession(0) }) })
  const a = tabs.add('cli')
  const m = tabs.add('monitor')
  a.session.exit(4)
  await tick()
  assert.strictEqual(tabs.done, false)
  m.session.exit(0)
  assert.strictEqual(await tabs.ended, 4)
})

test('a successor takes the place and the focus of a tab that ended by itself, and the app goes on', async () => {
  const followed = []
  const { tabs } = make({ follow: (tab, code) => { followed.push([tab.id, code]); return tab.id === 1 ? '/next' : null } })
  const gone = []
  tabs.on('gone', (tab, code, next) => gone.push([tab.id, code, next ? next.id : null]))
  const a = tabs.add('/a')
  const b = tabs.add('/b')
  tabs.activate(a.id)
  a.session.exit(0)
  await tick()
  assert.deepStrictEqual(tabs.list.map(t => [t.id, t.cwd]), [[3, '/next'], [b.id, '/b']])
  assert.strictEqual(tabs.active.id, 3)
  assert.deepStrictEqual(gone, [[1, 0, 3]])
  assert.strictEqual(tabs.done, false)
  tabs.close(b.id)
  await tick()
  tabs.list[0].session.exit(4)
  assert.strictEqual(await tabs.ended, 4)
  assert.strictEqual(tabs.last.id, 3)
  assert.deepStrictEqual(followed, [[1, 0], [3, 4]], 'a closed tab is never followed')
})

test('a successor whose make throws is logged and the tab just ends', async () => {
  let n = 0
  const { tabs, logged } = make({ make: (id, cwd) => { if (n++) throw new Error('no'); return { id, cwd, session: fakeSession() } }, follow: () => '/next' })
  const a = tabs.add('/a')
  a.session.exit(0)
  assert.strictEqual(await tabs.ended, 0)
  assert.ok(logged.some(l => l.includes('follow: Error: no')), logged.join('\n'))
})
