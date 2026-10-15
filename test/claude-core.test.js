'use strict'
// The Claude session core on a Bus and a fake clock: no I/O.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { Bus } = require('../app/metrics/bus')
const { ClaudeCore, source } = require('../app/metrics/claude/core')
const compact = require('../app/metrics/claude/compact')

const fx = p => path.join(__dirname, 'fixtures', 'claude', p)
const lines = p => fs.readFileSync(fx(p), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
const STATUS = JSON.parse(fs.readFileSync(fx('statusline.json'), 'utf8'))
const HOOKS = lines('hooks.jsonl')
const TRANSCRIPT = lines('transcript-read.jsonl')

function make (given = {}) {
  const bus = new Bus()
  const facts = Object.assign({ hooks: true, compaction: compact.inputs({}) }, given)
  const core = new ClaudeCore(bus.source(source(facts)), facts)
  return { bus, core }
}

const at = (j, extra) => Object.assign(JSON.parse(JSON.stringify(j)), extra)
const pick = (m, pre) => Object.fromEntries(Object.entries(m).filter(([k]) => k.startsWith(pre)))
const SETTINGS_600K = compact.inputs({ sources: [{ autoCompactWindow: 600000 }] })

test('C1 the statusline fixture gives context, cost, limits, model and cache', () => {
  const { bus, core } = make({ compaction: SETTINGS_600K })
  core.statusline(STATUS)
  const m = bus.snapshot()
  assert.strictEqual(m['context.window'], 1000000)
  assert.strictEqual(m['context.window_inferred'], 0)
  assert.strictEqual(m['context.used_tokens'], 4 + 15443 + 40263)
  assert.ok(Math.abs(m['context.used_pct'] - 5.571) < 0.001)
  assert.strictEqual(m['context.compact_threshold'], 567000)
  assert.ok(Math.abs(m['context.compact_left_pct'] - (1 - 55710 / 567000) * 100) < 1e-9)
  assert.strictEqual(m['context.cache_read'], 40263)
  assert.strictEqual(m['context.cache_write'], 15443)
  assert.strictEqual(m['context.uncached'], 4)
  assert.strictEqual(m['cost.usd'], 0.3751829)
  assert.strictEqual(m['limits.five_hour_pct'], 1)
  assert.strictEqual(m['model.name'], 'Opus 5.5')
  assert.strictEqual(m['cache.hit_ratio'], 0.6009763039151228)
})

test('C2 a null current_usage reads as no data, never zero', () => {
  const { bus, core } = make()
  core.statusline({ session_id: 's', context_window: { context_window_size: 200000, current_usage: null } })
  const m = bus.snapshot()
  assert.strictEqual(m['context.window'], 200000)
  assert.strictEqual(m['context.used_tokens'], null)
  assert.strictEqual(m['context.used_pct'], null)
})

test('C3 the hooks fixture counts tools by type and tracks busy state', () => {
  const { bus, core } = make()
  for (const h of HOOKS) core.hook(h)
  assert.deepStrictEqual(bus.snapshot(), {
    'event.prompt': 4,
    'event.stop': 4,
    'event.tool': 1,
    'agents.active': 0,
    'state.busy': 0,
    'tools.total': 1,
    'tools.Read': 1,
    'tools.rate': 0,
    'tokens.out_rate': 0
  })
  core.hook({ session_id: HOOKS[11].session_id, hook_event_name: 'PreToolUse', tool_name: 'mcp__srv__do-it' })
  assert.strictEqual(bus.get('tools.mcp__srv__do_it'), 1)
})

test('C4 the transcript counts each message id once, model from the transcript', () => {
  const { bus, core } = make()
  core.hook({ session_id: 's', transcript_path: 'T', hook_event_name: 'SessionStart' })
  for (const o of TRANSCRIPT) core.line('T', o, true)
  const per = new Map()
  for (const o of TRANSCRIPT) if (o.type === 'assistant' && o.message && o.message.usage && !o.isSidechain) per.set(o.message.id, o.message.usage.output_tokens)
  let out = 0
  for (const v of per.values()) out += v
  assert.ok(per.size > 1)
  assert.strictEqual(bus.get('tokens.out'), out)
  assert.ok(bus.get('model.name').startsWith('claude-'))
  const before = JSON.stringify(bus.snapshot())
  core.line('T', TRANSCRIPT.filter(o => o.type === 'assistant' && o.message && o.message.usage && !o.isSidechain).pop(), false)
  assert.strictEqual(JSON.stringify(bus.snapshot()), before)
})

test('C5 a session change resets the session family, keeps events, seeds at once', () => {
  const { bus, core } = make()
  core.hook({ session_id: 'a', transcript_path: 'A', hook_event_name: 'SessionStart' })
  core.hook({ session_id: 'a', transcript_path: 'A', hook_event_name: 'UserPromptSubmit' })
  core.hook({ session_id: 'a', transcript_path: 'A', hook_event_name: 'PreToolUse', tool_name: 'Read' })
  core.hook({ session_id: 'a', transcript_path: 'A', hook_event_name: 'SubagentStart' })
  core.hook({ session_id: 'a', transcript_path: 'A', hook_event_name: 'PostCompact' })
  for (const o of TRANSCRIPT) core.line('A', o, true)
  core.statusline(at(STATUS, { session_id: 'a', transcript_path: 'A' }))
  assert.strictEqual(bus.get('tools.total'), 1)
  assert.ok(bus.get('tokens.out') > 0)
  core.hook({ session_id: 'b', transcript_path: 'B', hook_event_name: 'SessionStart' })
  assert.strictEqual(core.transcript, 'B')
  assert.deepStrictEqual(bus.snapshot(), {
    'event.prompt': 1,
    'event.tool': 1,
    'event.agent': 1,
    'event.compact': 1,
    'model.name': 'Opus 5.5',
    'limits.five_hour_pct': 1,
    'limits.five_hour_resets_at': 1791787200,
    'limits.seven_day_pct': 0,
    'limits.seven_day_resets_at': 1792357200,
    'tools.total': 0,
    'agents.active': 0,
    'state.busy': 0,
    'tools.rate': 0,
    'tokens.out_rate': 0
  })
})

test('C6 a stray SubagentStop leaves agents.active at 0', () => {
  const { bus, core } = make()
  core.hook({ session_id: 's', hook_event_name: 'SubagentStop' })
  assert.strictEqual(bus.get('agents.active'), 0)
  core.hook({ session_id: 's', hook_event_name: 'SubagentStart' })
  assert.strictEqual(bus.get('agents.active'), 1)
})

test('C7 replayed lines never feed the output rate, live lines do', () => {
  const { bus, core } = make()
  core.hook({ session_id: 's', transcript_path: 'T', hook_event_name: 'SessionStart' })
  for (const o of TRANSCRIPT) core.line('T', o, true)
  bus.tick(1000)
  assert.strictEqual(bus.get('tokens.out_rate'), 0)
  core.line('T', { type: 'assistant', message: { id: 'msg_live', usage: { input_tokens: 1, output_tokens: 5000 } } }, false)
  bus.tick(2000)
  assert.strictEqual(bus.get('tokens.out_rate'), 500)
})

test('C13 a payload of the wrong shape throws nothing and writes nothing', () => {
  const bad = [null, [], 'x', { session_id: {} }]
  const { bus, core } = make()
  for (const v of bad) {
    core.hook(v)
    core.statusline(v)
    core.line(null, v, false)
  }
  assert.deepStrictEqual(bus.snapshot(), {})
  core.hook({ session_id: 's', transcript_path: 'T', hook_event_name: 'SessionStart' })
  const before = JSON.stringify(bus.snapshot())
  for (const v of bad) {
    core.hook(v)
    core.statusline(v)
    core.line('T', v, false)
  }
  assert.strictEqual(JSON.stringify(bus.snapshot()), before)
  assert.strictEqual(core.transcript, 'T')
})

test('C14 after a transcript switch, lines of the old file write nothing', () => {
  const { bus, core } = make()
  core.hook({ session_id: 's', transcript_path: 'A', hook_event_name: 'SessionStart' })
  core.hook({ session_id: 's', transcript_path: 'B', hook_event_name: 'UserPromptSubmit' })
  assert.strictEqual(core.transcript, 'B')
  for (const o of TRANSCRIPT) core.line('A', o, true)
  assert.deepStrictEqual(pick(bus.snapshot(), 'tokens.'), { 'tokens.out_rate': 0 })
  assert.deepStrictEqual(pick(bus.snapshot(), 'context.'), {})
})

// Feed the core as the shell does: a payload, then, when it names a new
// transcript, that transcript's history as replayed lines.
function feeder (core, files) {
  return (kind, payload) => {
    const before = core.transcript
    core[kind](payload)
    if (core.transcript !== before && files[core.transcript]) for (const o of files[core.transcript]) core.line(core.transcript, o, true)
  }
}
const CLAIMED = m => Object.fromEntries(Object.entries(m).filter(([k]) => k.startsWith('context.') || k === 'model.name' || k === 'cache.hit_ratio'))

test('C8 statusline and transcript in any order give one context family, read not inferred', () => {
  const files = { T1: TRANSCRIPT, T2: TRANSCRIPT }
  const status = at(STATUS, { session_id: 's1', transcript_path: 'T1' })
  const orders = {
    A: feed => feed('statusline', status),
    B: feed => {
      feed('hook', { session_id: 's1', transcript_path: 'T1', hook_event_name: 'SessionStart', source: 'resume' })
      feed('statusline', status)
    },
    H: feed => {
      feed('statusline', status)
      feed('statusline', at(STATUS, { session_id: 's2', transcript_path: 'T2' }))
    }
  }
  const got = {}
  for (const [name, run] of Object.entries(orders)) {
    const { bus, core } = make({ compaction: SETTINGS_600K })
    run(feeder(core, files))
    got[name] = CLAIMED(bus.snapshot())
  }
  const inferred = Object.fromEntries(Object.entries(got).map(([k, m]) => [k, m['context.window_inferred']]))
  assert.deepStrictEqual(inferred, { A: 0, B: 0, H: 0 })
  assert.strictEqual(got.A['context.window'], 1000000)
  assert.strictEqual(got.A['model.name'], 'Opus 5.5')
  assert.deepStrictEqual(got.B, got.A, 'order B')
  assert.deepStrictEqual(got.H, got.A, 'order H')
})

test('C9 a statusline without prompt_cache leaves the cache ratio to the transcript', () => {
  const { bus, core } = make()
  const feed = feeder(core, { T: TRANSCRIPT })
  feed('hook', { session_id: 's', transcript_path: 'T', hook_event_name: 'SessionStart', source: 'resume' })
  const replayed = bus.get('cache.hit_ratio')
  const status = at(STATUS, { session_id: 's', transcript_path: 'T' })
  delete status.prompt_cache
  feed('statusline', status)
  assert.strictEqual(bus.get('cache.hit_ratio'), replayed)
  core.line('T', { type: 'assistant', message: { id: 'msg_live', usage: { input_tokens: 1000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 10 } } }, false)
  assert.ok(bus.get('cache.hit_ratio') < replayed, 'a live line moves the ratio')
})

test('C10 statusline off, the inferred window follows compactWindow', () => {
  const rows = [
    ['env', { env: { CLAUDE_CODE_AUTO_COMPACT_WINDOW: '400000' } }, 400000, 367000],
    ['--autocompact', { argv: ['--autocompact', '300000'] }, 300000, 267000],
    ['settings', { sources: [{ autoCompactWindow: 600000 }] }, 600000, 567000],
    ['none', {}, 200000, 167000]
  ]
  for (const [name, given, window, threshold] of rows) {
    const { bus, core } = make({ compaction: compact.inputs(given) })
    feeder(core, { T: TRANSCRIPT })('hook', { session_id: 's', transcript_path: 'T', hook_event_name: 'SessionStart' })
    const m = bus.snapshot()
    assert.deepStrictEqual([m['context.window'], m['context.compact_threshold'], m['context.window_inferred']], [window, threshold, 1], name)
  }
})

test('C11 one usage reads the same through the transcript and the statusline', () => {
  const u = { input_tokens: 7, cache_creation_input_tokens: 1500, cache_read_input_tokens: 42000, output_tokens: 321 }
  const a = make()
  a.core.statusline({ session_id: 's', context_window: { context_window_size: 200000, current_usage: u } })
  const b = make()
  b.core.hook({ session_id: 's', transcript_path: 'T', hook_event_name: 'SessionStart' })
  b.core.line('T', { type: 'assistant', message: { id: 'msg_1', usage: u } }, false)
  const keys = ['context.used_tokens', 'context.uncached', 'context.cache_read', 'context.cache_write', 'context.output']
  const read = bus => keys.map(k => bus.get(k))
  assert.deepStrictEqual(read(b.bus), read(a.bus))
  assert.deepStrictEqual(read(a.bus), [43507, 7, 42000, 1500, 321])
})

test('C12 without injected hooks no hook meter is written', () => {
  const FIVE = ['tools.total', 'agents.active', 'state.busy', 'tools.rate', 'tokens.out_rate']
  const read = bus => Object.fromEntries(FIVE.map(k => [k, bus.get(k) === undefined ? null : bus.get(k)]))
  const a = make({ hooks: false })
  for (const h of HOOKS) a.core.hook(h)
  a.bus.tick(1000)
  assert.deepStrictEqual(read(a.bus), { 'tools.total': null, 'agents.active': null, 'state.busy': null, 'tools.rate': null, 'tokens.out_rate': null }, 'hook payloads')
  const b = make({ hooks: false })
  b.core.statusline(at(STATUS, { session_id: 's', transcript_path: 'T' }))
  b.bus.tick(1000)
  assert.deepStrictEqual(read(b.bus), { 'tools.total': null, 'agents.active': null, 'state.busy': null, 'tools.rate': null, 'tokens.out_rate': 0 }, 'a statusline payload')
})

test('C15 an injected statusline silent through two Stop hooks is logged once per session', () => {
  const stop = s => ({ hook_event_name: 'Stop', session_id: s })
  const run = (facts, feed) => {
    const logged = []
    const { core } = make(Object.assign({ log: m => logged.push(m) }, facts))
    feed(core)
    return logged
  }
  const silent = run({ statusline: true }, c => { for (let i = 0; i < 4; i++) c.hook(stop('s1')) })
  assert.strictEqual(silent.length, 1)
  assert.match(silent[0], /statusline/)
  assert.strictEqual(run({ statusline: true }, c => { c.hook(stop('s1')); c.hook(stop('s1')); c.hook(stop('s2')); c.hook(stop('s2')) }).length, 2)
  assert.deepStrictEqual(run({ statusline: true }, c => { c.statusline(at(STATUS, { session_id: 's1' })); c.hook(stop('s1')); c.hook(stop('s1')) }), [])
  assert.deepStrictEqual(run({ statusline: false }, c => { c.hook(stop('s1')); c.hook(stop('s1')) }), [])
})
