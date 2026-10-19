'use strict'
// The agent adapter seam (decision 0021). kindOf picks the adapter from
// the command's basename. open builds it beside Generic and returns one
// object at the Session's adapter seam: prepare, attach, onOutput,
// onInput, report, close. The seam owns the one timer: each tick polls
// every part, then recomputes the bus's rates.

const path = require('path')
const claude = require('./claude')
const codex = require('./codex')
const plain = require('./plain')
const generic = require('./generic')
const claudeWatch = require('./claude/watch')

// Dispatch, first match wins, else plain. A provider is a row here and a
// module exporting { kind, matches(basename), create(ctx), carry(argv) }.
const TABLE = [claude, codex]

const FAILED = 'meters limited: adapter failed'
const TICK_MS = 250

// The real clock: an unref'd interval, so it never holds the process.
const REAL_CLOCK = {
  now: () => Date.now(),
  every (ms, fn) {
    const t = setInterval(fn, ms)
    t.unref()
    return () => clearInterval(t)
  }
}

function provider (cmd) {
  const base = path.basename(cmd[0])
  return TABLE.find(m => m.matches(base)) || plain
}

function kindOf (cmd) {
  return provider(cmd).kind
}

// The arguments of cmd a new tab carries, and those it drops, by the
// dispatched provider's options (decision 0023).
function carry (cmd) {
  return provider(cmd).carry(cmd.slice(1))
}

class Agent {
  constructor (kind, adapter, gen, { bus, log, clock }) {
    Object.assign(this, { kind, adapter, generic: gen, bus, log, clock })
    this.parts = [adapter, gen]
    this.prepared = false
    this.attached = false
    this.closed = false
    this.failed = null
    this.failures = new Set()
    this.cancel = clock.every(TICK_MS, () => this.tick())
  }

  // A part's error is logged once per message and reaches no one else.
  tick () {
    const now = this.clock.now()
    for (const p of this.parts) {
      try { p.poll(now) } catch (e) {
        const msg = `${this.kind} adapter poll: ${e.stack || e}`
        if (!this.failures.has(msg)) this.log(msg)
        this.failures.add(msg)
      }
    }
    this.bus.tick(now)
  }

  // Once, before the spawn. Never rejects: a part whose prepare throws is
  // closed, and the session runs without its arguments.
  async prepare () {
    if (this.prepared) throw new Error('agent: prepare twice')
    this.prepared = true
    const args = []
    let notice = null
    for (const p of this.parts) {
      try {
        const r = await p.prepare()
        args.push(...((r && r.args) || []))
        notice = notice || (r && r.notice) || null
      } catch (e) {
        this.log(`${this.kind} adapter failed: ${e.stack || e}`)
        p.close()
        this.failed = notice = FAILED
      }
    }
    return { args, notice }
  }

  // Once, after the spawn, with the child's pid.
  attach (pid) {
    if (!this.prepared) throw new Error('agent: attach before prepare')
    if (this.attached) throw new Error('agent: attach twice')
    this.attached = true
    for (const p of this.parts) p.attach(pid)
  }

  onOutput (bytes) {
    this.generic.onOutput(bytes)
  }

  onInput () {
    this.generic.onInput()
  }

  // The following report: what the session follows and by which
  // channels, for the strip's notice and the live checks. replaying: the
  // history of the file followed is still being read, so its totals are
  // not yet whole. title: the session's name in the CLI's own record,
  // else null (decision 0032).
  report () {
    const r = this.adapter.report()
    return { agent: this.kind, session: r.session, title: r.title || null, channels: [...r.channels, ...this.generic.report().channels], notice: this.failed || r.notice, replaying: !!r.replaying }
  }

  // A rename made in the tab, into the CLI's record where the adapter
  // keeps one (decision 0032). True when recorded.
  rename (name) {
    if (this.closed || typeof this.adapter.rename !== 'function') return false
    return this.adapter.rename(name)
  }

  // Idempotent, valid at any point: no part is left running.
  close () {
    if (this.closed) return
    this.closed = true
    this.cancel()
    for (const p of this.parts) {
      try { p.close() } catch (e) { this.log(`${this.kind} adapter close failed: ${e.stack || e}`) }
    }
  }
}

// ctx: { cmd, cwd, env, runDir, options, bus, log, clock, managedDir,
// outside }, clock { now(), every(ms, fn) -> cancel } defaulting to the
// real one, managedDir the managed settings' directory (tests only),
// outside the function of a path the CLI names that gives the path the
// app reads it at, the identity unless the tab runs in a snapshot
// (decision 0037). Writes nothing to the bus and starts no channel:
// prepare does.
function open (ctx) {
  ctx = Object.assign({ clock: REAL_CLOCK, outside: p => p }, ctx)
  const mod = provider(ctx.cmd)
  return new Agent(mod.kind, mod.create(ctx), generic.create(ctx), ctx)
}

// A session the app did not start (decision 0027), read only: Claude's
// transcript as ctx.find names it, or Codex's rollout found by
// discovery from the session's start, beside Generic on its pid. ctx:
// { kind, argv, cwd, started, env, find, bus, log, clock }, env holding
// CODEX_HOME alone. Its prepare injects nothing.
function watch (ctx) {
  ctx = Object.assign({ clock: REAL_CLOCK }, ctx)
  const adapter = ctx.kind === 'claude'
    ? claudeWatch.create(ctx)
    : codex.create(Object.assign({}, ctx, { cmd: ctx.argv, launched: ctx.started }))
  const gen = generic.create(ctx)
  gen.start = ctx.started
  return new Agent(ctx.kind, adapter, gen, ctx)
}

module.exports = { open, watch, kindOf, carry }
