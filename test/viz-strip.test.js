'use strict'
// The tab strip's numbers from Viz.feed (decision 0015, 2026-10-15):
// one drain feeds the strip whether the window is open or not, and a tab
// with no terminal of its own or no busy state still tells its work
// from its rest.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

const state = fs.mkdtempSync(path.join(os.tmpdir(), 'viz-strip-test-'))
process.env.XDG_STATE_HOME = state
test.after(() => fs.rmSync(state, { recursive: true, force: true }))
const { Viz } = require('../app/viz')

// A bus with fixed values and a queue of events.
function bus (values) {
  const b = { values, events: [] }
  b.get = n => b.values[n]
  b.drainEvents = () => { const e = b.events; b.events = []; return e }
  return b
}

function setup (tabs) {
  const seen = []
  const viz = new Viz(() => tabs, 't', { bounds: () => null, focus () {} }, () => {}, list => seen.push(list))
  clearInterval(viz.timer)
  return { viz, seen }
}

test('the strip gets every pane tab, closed window or not, and events are drained once', () => {
  const a = bus({ 'pty.idle_s': 0.5, 'state.busy': 1, 'pty.out_bps': 800 })
  const d = bus({})
  const { viz, seen } = setup([{ id: 1, bus: a, active: true, pane: true }, { id: 2, bus: d, active: false, pane: false }])
  a.events.push(2, 3)
  d.events.push(1, 0)
  viz.feed(1000)
  assert.strictEqual(seen.length, 1)
  assert.deepStrictEqual(seen[0].map(x => x.k), [1], 'the dashboard has no pane')
  assert.deepStrictEqual(seen[0][0].e, [2, 3])
  assert.strictEqual(seen[0][0].n[4], 1)
  assert.strictEqual(seen[0][0].u, 0)
  assert.strictEqual(seen[0][0].q, 0)
  assert.deepStrictEqual(d.events, [], 'a tab with no pane is drained too')
  viz.feed(1033)
  assert.deepStrictEqual(seen[1][0].e, [], 'no event twice')
})

test('quiet seconds: the nearer of the terminal output and the last event', () => {
  const b = bus({ 'pty.idle_s': 30, 'state.busy': 0 })
  const { viz, seen } = setup([{ id: 1, bus: b, active: true, pane: true }])
  viz.feed(0)
  b.events.push(2, 1)
  viz.feed(5000)
  assert.strictEqual(seen[1][0].q, 0, 'a tool call with no output is not quiet')
  viz.feed(8000)
  assert.strictEqual(seen[2][0].q, 3)
  b.values['pty.idle_s'] = 1
  viz.feed(9000)
  assert.strictEqual(seen[3][0].q, 1)
})

test('a monitor tab with no busy state and no terminal output', () => {
  const b = bus({ 'pty.idle_s': 600, 'tokens.out_rate': 40 })
  const { viz, seen } = setup([{ id: 7, bus: b, active: true, pane: true }])
  viz.feed(0)
  viz.feed(4000)
  const x = seen[1][0]
  assert.strictEqual(x.u, 1, 'no busy state')
  assert.strictEqual(x.q, 4, 'quiet since its first frame, not since its start')
  assert.strictEqual(x.n[3], 40, 'the token rate goes along, which the strip counts as work')
})
