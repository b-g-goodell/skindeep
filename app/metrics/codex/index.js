'use strict'
// Codex adapter (decision 0013): follow this session's rollout JSONL,
// which ./discovery finds, and count its subagent threads. Reads no
// other file and no environment of other processes. Dispatched for
// `codex` and `codex_<suffix>` (decision 0021).

const { Tail } = require('../tail')
const { CodexState } = require('./parse')
const { Discovery } = require('./discovery')
const { ThreadNames } = require('./thread-name')
const { EVENT } = require('../bus')

// The writer source: the defaults appear once a rollout is followed.
const SOURCE = {
  defaults: { 'tools.total': 0, 'agents.active': 0, 'state.busy': 0 },
  rates: ['tokens.out_rate', 'tools.rate']
}

// Discovery and the subagent count run at most once a second, the
// thread's name every 5 s.
const POLL_MS = 1000
const NAME_MS = 5000

class CodexAdapter {
  // clock: { now() }, the seam's (decision 0021). launched: the session's
  // start, for a session the app did not start (decision 0027), else the
  // time of prepare.
  constructor (bus, { cmd, cwd, env, log, clock = { now: Date.now }, launched = null }) {
    Object.assign(this, { cmd, cwd, log, clock, launched })
    this.discovery = new Discovery({ env, argv: cmd.slice(1), cwd, launched: clock.now() })
    this.names = new ThreadNames(env)
    this.title = null
    this.lastName = -Infinity
    this.file = null
    this.thread = null
    this.how = null
    this.missed = false
    this.state = new CodexState()
    this.src = bus.source(SOURCE)
    this.pid = null
    this.tail = null
    // The rollouts still to follow, { file, end }, after this.tail.
    this.pending = []
    this.prepared = false
    this.closed = false
    this.lastPoll = -Infinity
  }

  // Just before the spawn: the launch time discovery cuts at.
  async prepare () {
    this.discovery.launched = this.launched === null ? this.clock.now() : this.launched
    this.prepared = true
    return { args: [], notice: null }
  }

  attach (pid) {
    this.pid = pid
  }

  // The rollout waiting or live. A new session has none until its first
  // prompt (decision 0013), and the strip says so.
  report () {
    return {
      session: this.thread,
      title: this.title,
      channels: [{ name: 'rollout', state: this.file ? 'live' : 'waiting', target: this.file, how: this.how }],
      notice: this.prepared && !this.file ? 'meters waiting: no rollout found' : null,
      replaying: !!(this.tail && (this.tail.replaying || this.pending.length))
    }
  }

  close () {
    this.closed = true
    if (this.tail) this.tail.stop()
    this.src.close()
  }

  // Follow the rollout once discovery finds it. The first miss is logged.
  follow () {
    if (this.closed) return
    const r = this.discovery.find(this.pid)
    if (!r.file) {
      if (!this.missed) this.log(`codex adapter: no rollout found yet (tried ${r.tried.join(', ')})`)
      this.missed = true
      return
    }
    this.file = r.file
    this.thread = r.thread
    this.how = r.how
    this.log(`codex adapter: following ${r.file} (found by ${r.how}, ${r.exact ? 'exact' : 'inexact'})`)
    this.src.begin()
    this.pending = [...this.discovery.bases(this.file), { file: this.file, end: null }]
    if (this.pending.length > 1) this.log(`codex adapter: ${r.file} continues ${this.pending.length - 1} rollout(s), read first as history`)
    this.next()
  }

  // The next rollout of the chain: a source's referenced history, then
  // the session's own rollout.
  next () {
    const { file, end } = this.pending.shift()
    this.tail = new Tail(file, (obj, history) => this.onLine(obj, history), { end })
  }

  onLine (obj, history) {
    const r = this.state.add(obj)
    for (const [k, v] of r.set) this.src.set(k, v)
    for (const [k, n] of r.add) this.src.add(k, n)
    for (const [kind, cls] of r.events) this.src.event(kind, cls, { history })
    for (const [k, n] of r.samples) this.src.sample(k, n, { history })
  }

  // Subagent threads of this session: a pulse per new one, and the count
  // written in the last 20 s.
  countSubagents () {
    if (!this.thread) return
    const { spawned, active } = this.discovery.subagents(this.thread)
    for (let i = 0; i < spawned; i++) {
      this.src.pulse('event.agent')
      this.src.event(EVENT.agent, 0)
    }
    this.src.set('agents.active', active)
  }

  // Each tick of the seam's clock, from prepare on.
  poll (now) {
    if (!this.prepared || this.closed) return
    if (now - this.lastPoll >= POLL_MS) {
      this.lastPoll = now
      if (!this.file) this.follow()
      this.countSubagents()
    }
    if (now - this.lastName >= NAME_MS) {
      this.lastName = now
      this.title = this.names.of(this.thread)
    }
    if (this.tail) {
      this.tail.poll(now)
      while (this.pending.length && !this.tail.replaying) this.next()
    }
  }
}

const kind = 'codex'

function matches (base) {
  return /^codex(_.+)?$/.test(base)
}

function create (ctx) {
  return new CodexAdapter(ctx.bus, { cmd: ctx.cmd, cwd: ctx.cwd, env: ctx.env, log: ctx.log, clock: ctx.clock, launched: ctx.launched === undefined ? null : ctx.launched })
}

module.exports = { kind, matches, create, carry: require('./carry').carry, CodexAdapter }
