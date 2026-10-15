'use strict'
// Codex thread names from session_index.jsonl (decision 0032).
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { threadName, ThreadNames } = require('../app/metrics/codex/thread-name')

const line = (id, name) => JSON.stringify({ id, thread_name: name, updated_at: '2026-10-14T00:00:00Z' })

test('the last line of a thread names it, other threads and bad lines are passed over', () => {
  const text = [line('A', 'first'), 'not json', line('B', 'bee'), line('A', ' second '), '{"id":"A"}'].join('\n') + '\n'
  assert.strictEqual(threadName(text, 'A'), 'second')
  assert.strictEqual(threadName(text, 'B'), 'bee')
  assert.strictEqual(threadName(text, 'C'), null)
  assert.strictEqual(threadName('', 'A'), null)
})

test('ThreadNames reads the index of CODEX_HOME, follows a change, and gives null without one', t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-names-'))
  t.after(() => fs.rmSync(home, { recursive: true, force: true }))
  const names = new ThreadNames({ CODEX_HOME: home })
  assert.strictEqual(names.of('A'), null)
  assert.strictEqual(names.of(null), null)
  const file = path.join(home, 'session_index.jsonl')
  fs.writeFileSync(file, line('A', 'one') + '\n')
  assert.strictEqual(names.of('A'), 'one')
  fs.appendFileSync(file, line('A', 'two') + '\n')
  assert.strictEqual(names.of('A'), 'two')
})
