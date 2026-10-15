'use strict'
// The sessions dashboard's history (decision 0028): series aligned to
// the ticks, the ring, ended rows kept then dropped, the sums across
// sessions and the per-minute rates.
const test = require('node:test')
const assert = require('node:assert')
const { History, pick } = require('../app/history')

const sample = (entries) => new Map(entries.map(([key, values]) => [key, { values, meta: { label: key } }]))

test('a session that starts later is padded, one that ends is marked and padded', () => {
  const h = new History({ intervalMs: 5000 })
  h.tick(0, sample([['a', { tools: 1 }]]))
  h.tick(5000, sample([['a', { tools: 2 }], ['b', { tools: 7 }]]))
  h.tick(10000, sample([['b', { tools: 8 }]]))
  const v = h.view()
  const a = v.rows.find(r => r.key === 'a')
  const b = v.rows.find(r => r.key === 'b')
  assert.deepStrictEqual(v.ticks, [0, 5000, 10000])
  assert.deepStrictEqual(a.series.tools, [1, 2, null])
  assert.deepStrictEqual(b.series.tools, [null, 7, 8])
  assert.deepStrictEqual([a.ended, b.ended, a.label], [true, false, 'a'])
  assert.deepStrictEqual(a.series.cost, [null, null, null])
})

test('the ring keeps the last points ticks, an ended row goes after keepEndedMs', () => {
  const h = new History({ points: 3, keepEndedMs: 10000, intervalMs: 5000 })
  for (let i = 0; i < 5; i++) h.tick(i * 5000, sample([['a', { tools: i }]]))
  assert.deepStrictEqual(h.view().ticks, [10000, 15000, 20000])
  assert.deepStrictEqual(h.view().rows[0].series.tools, [2, 3, 4])
  h.tick(25000, sample([]))
  h.tick(35000, sample([]))
  assert.strictEqual(h.view().rows.length, 1)
  h.tick(40000, sample([]))
  assert.strictEqual(h.view().rows.length, 0)
})

test('across sessions: per-minute rises summed, never scaled before a minute, a fall counts 0, cost summed', () => {
  const h = new History({ intervalMs: 30000 })
  const steps = [[{ tokens: 100, tools: 1, cost: 0.5 }, { tokens: 10, cost: 1 }], [{ tokens: 160, tools: 3, cost: 0.6 }, { tokens: 40, cost: 1 }], [{ tokens: 20, tools: 4, cost: 0.7 }, { tokens: 90, cost: 2 }]]
  steps.forEach(([a, b], i) => h.tick(i * 30000, sample([['a', a], ['b', b]])))
  const v = h.view()
  assert.deepStrictEqual(v.across.tokensPerMin, [0, 60 + 30, 0 + 80])
  assert.deepStrictEqual(v.across.toolsPerMin, [0, 2, 3])
  assert.deepStrictEqual(v.across.cost.map(c => Math.round(c * 10) / 10), [1.5, 1.6, 2.7])
})

test('a burst 5 s after the dashboard opens reads its own size for a minute, then leaves', () => {
  const h = new History({ intervalMs: 5000 })
  const tokens = [0, 2083]
  for (let i = 2; i <= 24; i++) tokens.push(2083 + Math.round((i - 1) * 1000 / 12))
  tokens.forEach((t, i) => h.tick(i * 5000, sample([['a', { tokens: t }]])))
  const rate = h.view().across.tokensPerMin
  assert.strictEqual(rate[1], 2083)
  assert.strictEqual(rate[12], tokens[12])
  assert.strictEqual(rate[13], tokens[13] - tokens[1])
  assert.strictEqual(rate[24], 1000)
})

test('a new session in the same row starts the minute again: its totals are no rise', () => {
  const h = new History({ intervalMs: 5000 })
  const steps = [['s1', 100], ['s1', 150], ['s2', 900000], ['s2', 900040]]
  steps.forEach(([session, tokens], i) => h.tick(i * 5000, new Map([['a', { values: { tokens }, meta: { label: 'a' }, session }]])))
  assert.deepStrictEqual(h.view().across.tokensPerMin, [0, 50, 0, 40])
})

test('pick takes the dashboard\'s meters from a bus snapshot, numbers only', () => {
  assert.deepStrictEqual(pick({ 'tools.total': 3, 'tokens.out': 'x', 'cost.usd': null, 'context.used_pct': 41.5, 'model.name': 'm' }), { tools: 3, tokens: null, cost: null, context: 41.5, compactions: null })
})
