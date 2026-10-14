'use strict'
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const parse = require('../app/metrics/claude/parse')
const compact = require('../app/metrics/claude/compact')

const fx = p => path.join(__dirname, 'fixtures', 'claude', p)
const lines = p => fs.readFileSync(fx(p), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))

test('compact threshold follows the binary rule', () => {
  const t = (window, given) => compact.threshold(window, compact.inputs(given))
  assert.strictEqual(t(1000000, {}), 967000)
  assert.strictEqual(t(200000, {}), 167000)
  assert.strictEqual(t(1000000, { sources: [{ autoCompactWindow: 600000 }] }), 567000)
  assert.strictEqual(t(1000000, { sources: [{ autoCompactWindow: 600000 }], env: { CLAUDE_CODE_AUTO_COMPACT_WINDOW: '400k' } }), 367000)
  assert.strictEqual(t(1000000, { argv: ['--autocompact', '300000'] }), 267000)
  assert.strictEqual(t(1000000, { argv: ['--autocompact=300000'] }), 267000)
  assert.strictEqual(t(200000, { sources: [{ autoCompactWindow: 600000 }] }), 167000)
  assert.strictEqual(t(1000000, { env: { DISABLE_AUTO_COMPACT: '1' } }), null)
  assert.strictEqual(t(1000000, { sources: [{ env: { DISABLE_COMPACT: 'true' } }] }), null)
})

test('hook metadata drops content fields', () => {
  for (const h of lines('hooks.jsonl')) {
    const m = parse.hookMeta(Object.assign({}, h, { prompt: 'secret', tool_input: { a: 1 }, tool_response: 'x', last_assistant_message: 'y' }))
    for (const k of ['prompt', 'tool_input', 'tool_response', 'last_assistant_message']) assert.ok(!(k in m))
    assert.ok(m.hook_event_name)
  }
})
