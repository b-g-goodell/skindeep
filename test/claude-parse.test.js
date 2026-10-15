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

// Every usage figure the statusline carries, as Claude Code 2.1.299
// builds rate_limits: five_hour and seven_day with their resets, and a
// gateway session's spend_limit.
test('the statusline\'s limits, their resets and a gateway spend limit become metrics', () => {
  const j = JSON.parse(fs.readFileSync(fx('statusline.json'), 'utf8'))
  j.rate_limits.spend_limit = { used_percentage: 42.5, resets_at: 1792400000, used_usd: 85, limit_usd: 200, period: 'month' }
  const m = Object.fromEntries(parse.fromStatusline(j, compact.inputs({})))
  assert.deepStrictEqual([m['limits.five_hour_pct'], m['limits.five_hour_resets_at']], [1, 1791787200])
  assert.deepStrictEqual([m['limits.seven_day_pct'], m['limits.seven_day_resets_at']], [0, 1792357200])
  assert.deepStrictEqual([m['limits.spend_pct'], m['limits.spend_resets_at'], m['limits.spend_usd'], m['limits.spend_limit_usd']], [42.5, 1792400000, 85, 200])
  delete j.rate_limits
  const none = Object.fromEntries(parse.fromStatusline(j, compact.inputs({})))
  assert.strictEqual(none['limits.five_hour_resets_at'], null)
  assert.ok(!('limits.spend_pct' in none))
})

// Decision 0034: the agent's task list from the transcript. The
// TaskCreate and TaskUpdate shapes are Claude Code 2.1.284's, the
// TodoWrite shape the older tool's, the markdown list the fallback.
const use = (name, input, id = 'toolu_' + name) => ({ type: 'assistant', isSidechain: false, message: { content: [{ type: 'tool_use', id, name, input }] } })
const result = (id, task) => ({ type: 'user', isSidechain: false, message: { content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] }, toolUseResult: task ? { task } : { success: true } })
const items = c => c.metrics()[0][1]

test('TodoWrite replaces the list whole, an empty one clears it', () => {
  const c = new parse.Checklist()
  assert.strictEqual(c.add(use('TodoWrite', { todos: [{ content: 'read', status: 'in_progress', activeForm: 'reading' }, { content: 'wire', status: 'pending' }, { content: 'check', status: 'completed' }] })), true)
  assert.deepStrictEqual(items(c), [{ text: 'read', state: 'doing' }, { text: 'wire', state: 'todo' }, { text: 'check', state: 'done' }])
  assert.deepStrictEqual(c.metrics().slice(1), [['checklist.count', 3], ['checklist.done', 1]])
  assert.strictEqual(c.add(use('TodoWrite', { todos: [{ content: 'only', status: 'pending' }] })), true)
  assert.deepStrictEqual(items(c), [{ text: 'only', state: 'todo' }])
  assert.strictEqual(c.add(use('TodoWrite', { todos: [] })), true)
  assert.deepStrictEqual(c.metrics(), [['checklist.items', []], ['checklist.count', 0], ['checklist.done', 0]])
})

test('TaskCreate adds an item under the id its result names, TaskUpdate moves, renames and deletes it', () => {
  const c = new parse.Checklist()
  assert.strictEqual(c.add(use('TaskCreate', { subject: 'Map the orders', description: 'd' }, 'a')), true)
  assert.strictEqual(c.add(use('TaskCreate', { subject: 'Cut them', description: 'd' }, 'b')), true)
  assert.strictEqual(c.add(result('a', { id: '7', subject: 'Map the orders' })), false)
  assert.strictEqual(c.add(result('b', { id: '8', subject: 'Cut them' })), false)
  assert.strictEqual(c.add(use('TaskUpdate', { taskId: '7', status: 'in_progress' })), true)
  assert.deepStrictEqual(items(c), [{ text: 'Map the orders', state: 'doing' }, { text: 'Cut them', state: 'todo' }])
  assert.strictEqual(c.add(use('TaskUpdate', { taskId: '7', status: 'in_progress' })), false)
  assert.strictEqual(c.add(use('TaskUpdate', { taskId: '9', status: 'completed' })), false)
  assert.strictEqual(c.add(use('TaskUpdate', { taskId: '8', subject: 'Cut the three' })), true)
  assert.strictEqual(c.add(use('TaskUpdate', { taskId: '7', status: 'completed' })), true)
  assert.strictEqual(c.add(use('TaskUpdate', { taskId: '8', status: 'deleted' })), true)
  assert.deepStrictEqual(items(c), [{ text: 'Map the orders', state: 'done' }])
})

test('TaskCreate without a result yet is numbered in order, so an update by that number lands', () => {
  const c = new parse.Checklist()
  c.add(use('TaskCreate', { subject: 'one', description: 'd' }, 'a'))
  c.add(use('TaskCreate', { subject: 'two', description: 'd' }, 'b'))
  assert.strictEqual(c.add(use('TaskUpdate', { taskId: '2', status: 'completed' })), true)
  assert.deepStrictEqual(items(c), [{ text: 'one', state: 'todo' }, { text: 'two', state: 'done' }])
})

test('a markdown task list in an assistant text replaces the list, other text and sidechain lines change nothing', () => {
  const c = new parse.Checklist()
  const text = t => ({ type: 'assistant', isSidechain: false, message: { content: [{ type: 'text', text: t }] } })
  assert.strictEqual(c.add(text('The plan:\n\n- [ ] read the manifest\n* [x] wire the widget\n  - [X] run the checks\n- not a task\n')), true)
  assert.deepStrictEqual(items(c), [{ text: 'read the manifest', state: 'todo' }, { text: 'wire the widget', state: 'done' }, { text: 'run the checks', state: 'done' }])
  assert.strictEqual(c.add(text('No list here, [x] inline.')), false)
  assert.strictEqual(c.add(Object.assign(use('TodoWrite', { todos: [] }), { isSidechain: true })), false)
  assert.strictEqual(c.add({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'TodoWrite', input: null }] } }), false)
  assert.strictEqual(c.add(null), false)
  assert.strictEqual(items(c).length, 3)
  assert.strictEqual(c.add(text('- [ ] ' + 'x'.repeat(300))), true)
  assert.strictEqual(items(c)[0].text.length, 200)
})
