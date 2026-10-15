'use strict'
// The contract every agent adapter keeps at the seam, run against Claude,
// Codex and plain, each with Generic beside it, on a fake clock.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { Bus } = require('../app/metrics/bus')
const relay = require('./helpers/relay')
const { open, watch } = require('../app/metrics/agent')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// A clock whose timers run only when the test advances it.
function fakeClock () {
  let t = Date.now()
  const timers = new Set()
  return {
    now: () => t,
    every (ms, fn) {
      const e = { ms, fn, next: t + ms }
      timers.add(e)
      return () => timers.delete(e)
    },
    advance (ms) {
      const end = t + ms
      for (;;) {
        let n = null
        for (const e of timers) if (e.next <= end && (!n || e.next < n.next)) n = e
        if (!n) break
        t = n.next
        n.next += n.ms
        n.fn()
      }
      t = end
    },
    live: () => timers.size
  }
}


// Real time, for what arrives over a socket.
async function until (fn, ms = 5000) {
  const end = Date.now() + ms
  while (!fn()) {
    if (Date.now() > end) throw new Error('timed out waiting')
    await sleep(10)
  }
}

function tempDir (t) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-contract-'))
  t.after(() => fs.rmSync(d, { recursive: true, force: true }))
  return d
}

const assistant = (id, out) => ({ type: 'assistant', message: { id, model: 'claude-test', usage: { input_tokens: 1, output_tokens: out, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } })
const CODEX_ID = '01a12c5b-c2a0-7221-b9e6-000000000888'
const ROLLOUT = fs.readFileSync(path.join(__dirname, 'fixtures', 'codex', 'rollout.jsonl'), 'utf8')
const lastTokenCount = ROLLOUT.split('\n').filter(l => l.includes('"token_count"') && l.includes('total_token_usage')).pop()

// Each adapter: how to build it, its first datum, a live output sample,
// the file it follows, and the defaults it declares.
const ADAPTERS = {
  claude: {
    defaults: ['tools.total', 'agents.active', 'state.busy', 'tools.rate', 'tokens.out_rate'],
    ctx (d) {
      fs.mkdirSync(path.join(d, '.git'))
      fs.mkdirSync(path.join(d, 'cfg'))
      return { cmd: ['claude'], env: { PATH: process.env.PATH, CLAUDE_CONFIG_DIR: path.join(d, 'cfg') } }
    },
    async ready (h, args) {
      assert.strictEqual(args[0], '--settings')
      h.agent.adapter.attach(process.pid)
      h.target = relay.link(path.join(h.dir, 'root'))
      h.file = path.join(h.dir, 'session.jsonl')
      fs.writeFileSync(h.file, '')
    },
    async first (h, session = 's1') {
      await relay.post(h.target, { hook_event_name: 'SessionStart', source: 'startup', session_id: session, transcript_path: h.file })
      await until(() => h.bus.get('tools.total') !== undefined && h.bus.get('tools.Read') === undefined)
    },
    live (h, n) { fs.appendFileSync(h.file, JSON.stringify(assistant(`msg_live_${n}`, 5000)) + '\n') },
    // A transcript of history first: the tail has read one chunk of it.
    async history (h, text) {
      fs.writeFileSync(h.file, text)
      await this.first(h)
    }
  },
  codex: {
    defaults: ['tools.total', 'agents.active', 'state.busy', 'tools.rate', 'tokens.out_rate'],
    ctx (d) {
      return { cmd: ['codex', 'resume', CODEX_ID], env: { PATH: process.env.PATH, CODEX_HOME: path.join(d, 'codex') } }
    },
    async ready () {},
    async first (h, extra = '', ms = 1000) {
      const dir = path.join(h.dir, 'codex', 'sessions', '2026', '10', '12')
      fs.mkdirSync(dir, { recursive: true })
      h.file = path.join(dir, `rollout-2026-10-12T10-00-00-${CODEX_ID}.jsonl`)
      fs.writeFileSync(h.file, ROLLOUT + extra)
      h.clock.advance(ms)
    },
    // The first tick finds the rollout, and its tail reads two chunks.
    async history (h, text) {
      await this.first(h, text, 250)
    },
    live (h, n) {
      const o = JSON.parse(lastTokenCount)
      o.payload.info.total_token_usage.output_tokens += 5000 * n
      fs.appendFileSync(h.file, JSON.stringify(o) + '\n')
    }
  },
  plain: { defaults: [], ctx: () => ({ cmd: ['bash'], env: { PATH: process.env.PATH } }), async ready () {} }
}

async function harness (t, kind) {
  const a = ADAPTERS[kind]
  const dir = tempDir(t)
  fs.mkdirSync(path.join(dir, 'run'))
  const clock = fakeClock()
  const bus = new Bus()
  const agent = open(Object.assign({ cwd: dir, runDir: path.join(dir, 'run'), root: path.join(dir, 'root'), store: path.join(dir, 'store'), options: { statusline: 'always' }, bus, log: () => {}, clock, managedDir: path.join(dir, 'no-managed') }, a.ctx(dir)))
  t.after(() => agent.close())
  const h = { a, dir, clock, bus, agent }
  const { args } = await agent.prepare()
  await a.ready(h, args)
  return h
}

const present = (bus, names) => names.filter(n => bus.get(n) !== undefined)

for (const kind of Object.keys(ADAPTERS)) {
  test(`${kind}: rows 1 and 2, defaults absent before the first datum, present with it`, async t => {
    const h = await harness(t, kind)
    h.clock.advance(1000)
    assert.deepStrictEqual(present(h.bus, h.a.defaults), [])
    if (!h.a.first) return
    await h.a.first(h)
    assert.deepStrictEqual(present(h.bus, h.a.defaults), h.a.defaults)
  })

  test(`${kind}: row 3, tokens.out_rate rises with a live sample and falls to 0 after 10 s`, async t => {
    const h = await harness(t, kind)
    if (!h.a.first) {
      h.clock.advance(11000)
      assert.strictEqual(h.bus.get('tokens.out_rate'), undefined)
      return
    }
    await h.a.first(h)
    h.clock.advance(500)
    h.a.live(h, 1)
    h.clock.advance(500)
    assert.ok(h.bus.get('tokens.out_rate') > 0, `tokens.out_rate ${h.bus.get('tokens.out_rate')}`)
    h.clock.advance(10000)
    assert.strictEqual(h.bus.get('tokens.out_rate'), 0)
  })

  test(`${kind}: row 5, close twice, no timer left, nothing reaches the bus after it`, async t => {
    const h = await harness(t, kind)
    if (h.a.first) await h.a.first(h)
    h.clock.advance(500)
    h.agent.close()
    h.agent.close()
    assert.strictEqual(h.clock.live(), 0)
    const before = JSON.stringify(h.bus.snapshot())
    if (h.a.live) h.a.live(h, 1)
    h.clock.advance(2000)
    await sleep(600)
    assert.strictEqual(JSON.stringify(h.bus.snapshot()), before)
    if (kind === 'claude') assert.ok(await relay.refused(h.target), 'the hook socket refuses connections')
  })

  test(`${kind}: row 6, nothing moves without the clock`, async t => {
    const h = await harness(t, kind)
    if (!h.a.first) return
    await h.a.first(h)
    h.clock.advance(1000)
    const before = h.bus.get('tokens.out')
    h.a.live(h, 1)
    await sleep(600)
    assert.strictEqual(h.bus.get('tokens.out'), before)
    h.clock.advance(500)
    assert.notStrictEqual(h.bus.get('tokens.out'), before)
  })

  test(`${kind}: row 7, a report from open to close`, async t => {
    const h = await harness(t, kind)
    const keys = r => Object.keys(r).sort()
    assert.deepStrictEqual(keys(h.agent.report()), ['agent', 'channels', 'notice', 'replaying', 'session', 'title'])
    assert.strictEqual(h.agent.report().agent, kind)
    if (h.a.first) await h.a.first(h)
    h.agent.close()
    assert.deepStrictEqual(keys(h.agent.report()), ['agent', 'channels', 'notice', 'replaying', 'session', 'title'])
  })
}

// About 18 MiB of lines no adapter counts: three chunks of the tail.
const FILLER = (() => {
  const line = JSON.stringify({ type: 'filler', pad: 'x'.repeat(1000) }) + '\n'
  return line.repeat(Math.ceil(18 * 1024 * 1024 / line.length))
})()

for (const kind of ['claude', 'codex']) {
  test(`${kind}: row 8, the report says replaying while the history is read, a chunk a tick`, async t => {
    const h = await harness(t, kind)
    assert.strictEqual(h.agent.report().replaying, false)
    await h.a.history(h, FILLER)
    assert.strictEqual(h.agent.report().replaying, true)
    h.clock.advance(500)
    assert.strictEqual(h.agent.report().replaying, false)
  })
}

test('claude watch: row 8, the report says replaying while the transcript history is read', async t => {
  const dir = tempDir(t)
  const file = path.join(dir, 'watched.jsonl')
  fs.writeFileSync(file, FILLER)
  const clock = fakeClock()
  const agent = watch({ kind: 'claude', argv: ['claude'], cwd: dir, started: clock.now(), env: {}, find: () => ({ file, session: 'w1' }), bus: new Bus(), log: () => {}, clock })
  t.after(() => agent.close())
  await agent.prepare()
  clock.advance(250)
  assert.strictEqual(agent.report().channels.find(c => c.name === 'transcript').target, file)
  assert.strictEqual(agent.report().replaying, true)
  clock.advance(500)
  assert.strictEqual(agent.report().replaying, false)
})

test('codex: row 9, a fork reads its source\'s history up to the fork first, as Codex 0.162.1 copies none of it', async t => {
  const dir = tempDir(t)
  fs.mkdirSync(path.join(dir, 'run'))
  const day = path.join(dir, 'codex', 'sessions', '2026', '10', '12')
  fs.mkdirSync(day, { recursive: true })
  fs.writeFileSync(path.join(day, `rollout-2026-10-12T10-00-00-${CODEX_ID}.jsonl`), ROLLOUT)
  const clock = fakeClock()
  const bus = new Bus()
  const agent = open({ cmd: ['codex', 'fork', CODEX_ID], cwd: dir, env: { PATH: process.env.PATH, CODEX_HOME: path.join(dir, 'codex') }, runDir: path.join(dir, 'run'), options: { statusline: 'always' }, bus, log: () => {}, clock })
  t.after(() => agent.close())
  await agent.prepare()
  const forkId = '01a12c5b-c2a0-7221-b9e6-000000000999'
  const at = new Date(clock.now() + 500).toISOString()
  const base = { thread_id: CODEX_ID, end_byte_offset: Buffer.byteLength(ROLLOUT), end_ordinal_exclusive: ROLLOUT.split('\n').filter(Boolean).length }
  const meta = { timestamp: at, type: 'session_meta', payload: { id: forkId, timestamp: at, cwd: dir, source: 'cli', originator: 'codex-tui', cli_version: '0.162.1', forked_from_id: CODEX_ID, history_mode: 'paginated', history_base: base } }
  const fork = path.join(day, `rollout-2026-10-12T10-05-00-${forkId}.jsonl`)
  fs.writeFileSync(fork, JSON.stringify(meta) + '\n')
  clock.advance(1000)
  const r = agent.report()
  assert.deepStrictEqual([r.channels.find(c => c.name === 'rollout').target, r.channels.find(c => c.name === 'rollout').how, r.replaying], [fork, 'forked', false])
  assert.strictEqual(bus.get('tokens.in'), JSON.parse(lastTokenCount).payload.info.total_token_usage.input_tokens)
})

test('claude: row 4, a new session resets its names and reseeds in the same call', async t => {
  const h = await harness(t, 'claude')
  await h.a.first(h)
  await relay.post(h.target, { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_use_id: 't1', session_id: 's1', transcript_path: h.file })
  await until(() => h.bus.get('tools.Read') === 1)
  h.clock.advance(250)
  assert.strictEqual(h.bus.get('tools.rate'), 1)
  await h.a.first(h, 's2')
  const m = h.bus.snapshot()
  assert.strictEqual(m['tools.Read'], undefined)
  for (const n of h.a.defaults) assert.strictEqual(m[n], 0, n)
  assert.strictEqual(m['event.tool'], 1)
})

// The channels of each adapter, by name: state, and the target once live.
const CHANNELS = {
  claude: { before: { hooks: 'waiting', statusline: 'waiting', transcript: 'waiting' }, after: { hooks: 'live', transcript: 'live' }, followed: 'transcript' },
  codex: { before: { rollout: 'waiting' }, after: { rollout: 'live' }, followed: 'rollout' },
  plain: { before: {}, after: {} }
}

const states = r => Object.fromEntries(r.channels.filter(c => !['pty', 'proc'].includes(c.name)).map(c => [c.name, c.state]))

for (const kind of Object.keys(ADAPTERS)) {
  test(`${kind}: rows 1 and 2, the report shows the channels waiting, then live with their target`, async t => {
    const h = await harness(t, kind)
    const c = CHANNELS[kind]
    h.clock.advance(1000)
    assert.deepStrictEqual(states(h.agent.report()), c.before)
    if (!h.a.first) return
    await h.a.first(h)
    h.clock.advance(1000)
    const r = h.agent.report()
    for (const [name, state] of Object.entries(c.after)) assert.strictEqual(states(r)[name], state, name)
    assert.strictEqual(r.channels.find(x => x.name === c.followed).target, h.file)
    assert.ok(r.session, 'the session is named')
  })
}

test('claude: with --settings given the hooks and statusline are off, and the notice says why', async t => {
  const h = await harness(t, 'claude')
  const agent = open({ cmd: ['claude', '--settings', '/x.json'], cwd: h.dir, env: { PATH: process.env.PATH, CLAUDE_CONFIG_DIR: path.join(h.dir, 'cfg') }, runDir: path.join(h.dir, 'run'), options: { statusline: 'always' }, bus: new Bus(), log: () => {}, clock: fakeClock() })
  t.after(() => agent.close())
  await agent.prepare()
  const r = agent.report()
  assert.deepStrictEqual(states(r), { hooks: 'off', statusline: 'off', transcript: 'waiting' })
  assert.strictEqual(r.notice, 'meters limited: --settings given')
})

test('codex: the notice says the meters wait while no rollout is followed, and clears once one is', async t => {
  const h = await harness(t, 'codex')
  h.clock.advance(1000)
  assert.strictEqual(h.agent.report().notice, 'meters waiting: no rollout found')
  await h.a.first(h)
  assert.strictEqual(h.agent.report().notice, null)
  assert.strictEqual(h.agent.report().channels.find(c => c.name === 'rollout').how, 'argv')
})

test('a failed prepare keeps its notice in the report', async t => {
  const dir = tempDir(t)
  const agent = open({ cmd: ['claude'], cwd: dir, env: { PATH: process.env.PATH, CLAUDE_CONFIG_DIR: dir }, runDir: path.join(dir, 'missing'), options: { statusline: 'always' }, bus: new Bus(), log: () => {}, clock: fakeClock() })
  t.after(() => agent.close())
  assert.strictEqual((await agent.prepare()).notice, 'meters limited: adapter failed')
  assert.strictEqual(agent.report().notice, 'meters limited: adapter failed')
})
