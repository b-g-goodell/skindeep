'use strict'
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { CodexState, toolClass } = require('../app/metrics/codex/parse')

const lines = fs.readFileSync(path.join(__dirname, 'fixtures', 'codex', 'rollout.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))

function run () {
  const s = new CodexState()
  const vals = {}
  const counts = {}
  const events = []
  for (const o of lines) {
    const r = s.add(o)
    for (const [k, v] of r.set) vals[k] = v
    for (const [k, n] of r.add) counts[k] = (counts[k] || 0) + n
    events.push(...r.events)
  }
  return { s, vals, counts, events }
}

test('token counts follow the last token_count event', () => {
  const { vals } = run()
  const last = lines.filter(o => o.payload.type === 'token_count' && o.payload.info).pop().payload.info
  assert.strictEqual(vals['tokens.in'], last.total_token_usage.input_tokens)
  assert.strictEqual(vals['tokens.out'], last.total_token_usage.output_tokens)
  assert.strictEqual(vals['tokens.cache_read'], last.total_token_usage.cached_input_tokens)
  assert.strictEqual(vals['context.window'], last.model_context_window)
  assert.strictEqual(vals['context.used_tokens'], last.last_token_usage.input_tokens)
  assert.ok(Math.abs(vals['context.used_pct'] - last.last_token_usage.input_tokens / last.model_context_window * 100) < 1e-9)
  const rl = lines.filter(o => o.payload.type === 'token_count' && o.payload.rate_limits.primary).pop().payload.rate_limits.primary
  assert.strictEqual(rl.window_minutes, 10080)
  assert.strictEqual(vals['limits.seven_day_pct'], rl.used_percent)
  assert.strictEqual(vals['model.name'], 'gpt-6-astra')
})

test('tool calls are counted by name and classed', () => {
  const { counts, events } = run()
  const tools = lines.filter(o => o.type === 'response_item')
  assert.strictEqual(counts['tools.total'], tools.length)
  assert.strictEqual(counts['tools.exec'], tools.filter(o => o.payload.name === 'exec').length)
  assert.strictEqual(events.filter(e => e[0] === 2 && e[1] === 3).length, counts['tools.exec'])
  assert.strictEqual(toolClass('apply_patch'), 2)
  assert.strictEqual(toolClass('spawn_agent'), 5)
})

test('turns set busy and session meta is kept', () => {
  const { s, counts } = run()
  assert.strictEqual(s.meta.source, 'cli')
  assert.strictEqual(counts['event.prompt'], lines.filter(o => o.payload.type === 'task_started').length)
})

// An adapter on a temp CODEX_HOME, launched as `codex resume <id>` so
// discovery takes the argv route to the rollout written there.
function adapterFor (t, { rollout = true } = {}) {
  const os = require('os')
  const { Bus } = require('../app/metrics/bus')
  const { CodexAdapter } = require('../app/metrics/codex')
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-adapter-'))
  const id = '01a12c5b-c2a0-7221-b9e6-000000000777'
  if (rollout) {
    const d = path.join(home, 'sessions', '2026', '10', '12')
    fs.mkdirSync(d, { recursive: true })
    fs.writeFileSync(path.join(d, `rollout-2026-10-12T10-00-00-${id}.jsonl`), JSON.stringify(lines[0]) + '\n')
  }
  const bus = new Bus()
  const a = new CodexAdapter(bus, { cmd: ['codex', 'resume', id], cwd: '/work/project', env: { CODEX_HOME: home }, log: () => {} })
  t.after(() => {
    a.close()
    fs.rmSync(home, { recursive: true, force: true })
  })
  return { a, bus }
}

const toolLine = { timestamp: '2026-10-12T16:00:00.000Z', type: 'response_item', payload: { type: 'function_call', name: 'exec', arguments: '{}', call_id: 'c1' } }

test('the Codex adapter has no defaults before it follows a rollout', async t => {
  const { a, bus } = adapterFor(t, { rollout: false })
  await a.prepare()
  a.poll(Date.now())
  assert.strictEqual(a.file, null)
  for (const k of ['tools.total', 'tools.rate', 'agents.active', 'state.busy', 'tokens.out_rate']) assert.strictEqual(bus.get(k), undefined, k)
})

test('a live tool call raises tools.rate once the bus ticks', async t => {
  const { a, bus } = adapterFor(t)
  await a.prepare()
  a.poll(Date.now())
  assert.ok(a.file, 'follows the rollout')
  assert.strictEqual(bus.get('tools.total'), 0)
  a.onLine(toolLine, false)
  bus.tick(Date.now())
  assert.strictEqual(bus.get('tools.rate'), 1)
  assert.strictEqual(bus.get('tools.total'), 1)
  a.onLine(toolLine, true)
  bus.tick(Date.now() + 1)
  assert.strictEqual(bus.get('tools.rate'), 1, 'a replayed call is no rate sample')
})
