'use strict'
// The metric writer: sources, the rate table on a fake clock, history,
// defaults, reset, the name check, close.
const test = require('node:test')
const assert = require('node:assert')
const { Bus, EVENT } = require('../app/metrics/bus')

const CLAUDE = { defaults: { 'tools.total': 0, 'agents.active': 0, 'state.busy': 0 }, rates: ['tokens.out_rate', 'tools.rate'] }

test('tokens.out_rate is the sum over 10 s per second', () => {
  const bus = new Bus()
  const src = bus.source({ rates: ['tokens.out_rate'] })
  src.begin()
  src.sample('tokens.out_rate', 5000)
  bus.tick(1000)
  assert.strictEqual(bus.get('tokens.out_rate'), 500)
  bus.tick(10999)
  assert.strictEqual(bus.get('tokens.out_rate'), 500)
  bus.tick(11000)
  assert.strictEqual(bus.get('tokens.out_rate'), 0)
})

test('tools.rate counts calls in the last 60 s', () => {
  const bus = new Bus()
  const src = bus.source({ rates: ['tools.rate'] })
  src.begin()
  for (let i = 0; i < 3; i++) src.sample('tools.rate', 1)
  bus.tick(0)
  assert.strictEqual(bus.get('tools.rate'), 3)
  src.sample('tools.rate', 1)
  bus.tick(30000)
  assert.strictEqual(bus.get('tools.rate'), 4)
  bus.tick(60000)
  assert.strictEqual(bus.get('tools.rate'), 1)
  bus.tick(90000)
  assert.strictEqual(bus.get('tools.rate'), 0)
})

test('pty windows are 1 s', () => {
  const bus = new Bus()
  const src = bus.source({ rates: ['pty.out_bps', 'pty.in_kps'] })
  src.begin()
  src.sample('pty.out_bps', 1000)
  src.sample('pty.out_bps', 2000)
  src.sample('pty.in_kps', 1)
  src.sample('pty.in_kps', 1)
  bus.tick(5000)
  assert.strictEqual(bus.get('pty.out_bps'), 3000)
  assert.strictEqual(bus.get('pty.in_kps'), 2)
  bus.tick(6000)
  assert.strictEqual(bus.get('pty.out_bps'), 0)
  assert.strictEqual(bus.get('pty.in_kps'), 0)
})

test('history samples and events are dropped, counters still apply', () => {
  const bus = new Bus()
  const src = bus.source(CLAUDE)
  src.begin()
  src.sample('tokens.out_rate', 5000, { history: true })
  src.event(EVENT.tool, 1, { history: true })
  src.add('tokens.out', 5000)
  src.pulse('event.tool')
  bus.tick(1000)
  assert.strictEqual(bus.get('tokens.out_rate'), 0)
  assert.deepStrictEqual(bus.drainEvents(), [])
  assert.strictEqual(bus.get('tokens.out'), 5000)
  assert.strictEqual(bus.get('event.tool'), 1)
  src.event(EVENT.tool, 1)
  assert.deepStrictEqual(bus.drainEvents(), [EVENT.tool, 1])
})

test('defaults and rates are absent before begin, present at begin with no tick', () => {
  const bus = new Bus()
  const src = bus.source(CLAUDE)
  bus.tick(1000)
  assert.deepStrictEqual(bus.snapshot(), {})
  src.begin()
  assert.deepStrictEqual(bus.snapshot(), { 'tools.total': 0, 'agents.active': 0, 'state.busy': 0, 'tokens.out_rate': 0, 'tools.rate': 0 })
  src.add('tools.total', 2)
  src.begin()
  assert.strictEqual(bus.get('tools.total'), 2)
})

test('reset forgets the session, reseeds in the same call, keeps events, model and limits', () => {
  const bus = new Bus()
  const src = bus.source(CLAUDE)
  src.begin()
  src.add('tools.total', 3)
  src.add('tools.Read', 3)
  src.set('tokens.in', 10)
  src.set('context.window', 200000)
  src.set('session.compactions', 1)
  src.pulse('event.tool')
  src.set('model.name', 'Opus 5.5')
  src.set('limits.five_hour_pct', 7)
  src.sample('tools.rate', 1)
  src.sample('tokens.out_rate', 5000)
  bus.tick(1000)
  assert.strictEqual(bus.get('tools.rate'), 1)
  src.reset()
  assert.deepStrictEqual(bus.snapshot(), {
    'tools.total': 0,
    'agents.active': 0,
    'state.busy': 0,
    'tokens.out_rate': 0,
    'tools.rate': 0,
    'event.tool': 1,
    'model.name': 'Opus 5.5',
    'limits.five_hour_pct': 7
  })
  bus.tick(2000)
  assert.strictEqual(bus.get('tools.rate'), 0)
  assert.strictEqual(bus.get('tokens.out_rate'), 0)
})

test('a name outside the vocabulary is dropped and logged once', () => {
  const logged = []
  const bus = new Bus({ log: m => logged.push(m) })
  const src = bus.source({})
  src.set('tools.typo-name!', 1)
  src.add('tools.typo-name!', 1)
  src.set('tools.Read', 1)
  assert.strictEqual(bus.get('tools.typo-name!'), undefined)
  assert.strictEqual(bus.get('tools.Read'), 1)
  assert.strictEqual(logged.length, 1)
  assert.ok(logged[0].includes('tools.typo-name!'))
})

test('writes after close are dropped and the tick leaves the source alone', () => {
  const bus = new Bus()
  const src = bus.source(CLAUDE)
  src.begin()
  src.sample('tokens.out_rate', 5000)
  bus.tick(1000)
  src.close()
  src.set('tokens.in', 1)
  src.add('tools.total', 1)
  src.pulse('event.tool')
  src.sample('tokens.out_rate', 5000)
  src.event(EVENT.tool, 1)
  src.reset()
  bus.tick(20000)
  assert.deepStrictEqual(bus.snapshot(), { 'tools.total': 0, 'agents.active': 0, 'state.busy': 0, 'tokens.out_rate': 500, 'tools.rate': 0 })
  assert.deepStrictEqual(bus.drainEvents(), [])
})

test('Generic: no pty name before attach, output bytes per second after it', t => {
  const { Generic } = require('../app/metrics/generic')
  const bus = new Bus()
  const g = new Generic(bus, { now: () => 0 })
  t.after(() => g.close())
  g.poll(0)
  bus.tick(0)
  assert.deepStrictEqual(Object.keys(bus.snapshot()).filter(k => k.startsWith('pty.') || k === 'event.output'), [])
  g.attach(process.pid)
  g.onOutput(1000)
  g.onOutput(2000)
  g.onInput()
  bus.tick(1000)
  assert.strictEqual(bus.get('pty.out_bps'), 3000)
  assert.strictEqual(bus.get('pty.in_kps'), 1)
  assert.strictEqual(bus.get('event.output'), 1)
  bus.tick(2000)
  assert.strictEqual(bus.get('pty.out_bps'), 0)
  assert.strictEqual(bus.get('pty.in_kps'), 0)
})

test('the bus exports no raw write', () => {
  const bus = new Bus()
  for (const m of ['set', 'add', 'pulse', 'reset', 'event']) assert.strictEqual(typeof bus[m], 'undefined', m)
})
