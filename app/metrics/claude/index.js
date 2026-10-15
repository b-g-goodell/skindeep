'use strict'
// Claude Code adapter: statusline JSON, command hooks, transcript tail
// (decisions 0009, 0030). Dispatched for `claude` and `claude_<suffix>`
// (decision 0021). The shell starts the receiver, runs the settings
// writer, feeds the session core and follows the transcript the core
// names. A Claude Code subcommand gets nothing injected (decision 0030):
// `attach` follows the attached session's transcript, the others run on
// Generic alone.

const fs = require('fs')
const path = require('path')
const server = require('./server')
const { resolveCommand } = require('../../cli')
const settings = require('./settings')
const { ClaudeCore, source } = require('./core')
const { Tail } = require('../tail')
const { carry } = require('./carry')
const claudeWatch = require('./watch')
const plain = require('../plain')
const { slug } = require('../../sessions')

class ClaudeAdapter {
  constructor (bus, { cmd, env, cwd, runDir, root, store, mode, node, python, log, managedDir }) {
    Object.assign(this, { bus, cmd, env, cwd, runDir, root, store, mode, node, python, log, managedDir })
    this.src = null
    this.core = null
    this.tail = null
    this.server = null
    this.closed = false
    // Which channels were injected, which have delivered, and why
    // nothing was injected.
    this.armed = { hooks: false, statusline: false }
    this.seen = { hooks: false, statusline: false }
    this.notice = null
  }

  // Start the receiver and write the settings file. Resolves { args,
  // notice }: the argv to inject and the strip notice, else null. A close
  // while the receiver starts releases it as soon as it listens.
  async prepare () {
    const s = await server.start(this.runDir, this.root, b => this.receive('hooks', c => c.hook(b)), b => this.receive('statusline', c => c.statusline(b)))
    this.server = s
    if (this.closed) {
      s.close()
      return { args: [], notice: null }
    }
    const r = settings.prepare({ cmd: this.cmd, env: this.env, cwd: this.cwd, root: this.root, store: this.store, mode: this.mode, node: this.node, python: this.python, managedDir: this.managedDir })
    // Managed settings silence what is injected: hooks that never fire
    // give no hook meters, as with nothing injected (decision 0010).
    const hooksOff = r.managed.includes('disableAllHooks') || r.managed.includes('allowManagedHooksOnly')
    this.armed = { hooks: !r.reason && !hooksOff, statusline: !!r.statusline && !r.managed.includes('statusLine') }
    this.notice = r.reason ? 'meters limited: ' + r.reason : r.managed.length ? 'meters limited: managed settings' : null
    const facts = Object.freeze({ hooks: this.armed.hooks, statusline: this.armed.statusline, compaction: r.compaction, log: this.log })
    this.src = this.bus.source(source(facts))
    this.core = new ClaudeCore(this.src, facts)
    this.log(`claude adapter: injected=${!r.reason} statusline=${!!r.statusline} chain=${!!r.chain}`)
    if (r.managed.length) this.log(`claude adapter: managed settings: ${r.managed.join(', ')} override what the app injects`)
    return { args: r.args, notice: this.notice }
  }

  // A payload on one of the injected channels.
  receive (channel, fn) {
    if (this.closed || !this.core) return
    this.seen[channel] = true
    this.feed(fn)
  }

  // One payload to the core. The tail is swapped only after the core has
  // processed it, so a history replay never runs inside a payload.
  feed (fn) {
    if (this.closed || !this.core) return
    fn(this.core)
    const file = this.core.transcript
    if (!file || (this.tail && this.tail.file === file)) return
    if (this.tail) this.tail.stop()
    this.tail = new Tail(file, (obj, replayed) => this.core.line(file, obj, replayed))
  }

  // The relays find this tab by its CLI's pid (decision 0030).
  attach (pid) {
    if (this.server && !this.closed) this.server.link(pid)
  }

  // Each tick of the seam's clock: the transcript's appended lines.
  poll (now) {
    if (this.tail && !this.closed) this.tail.poll(now)
  }

  // Each channel off (not injected), waiting or live.
  report () {
    const state = name => !this.armed[name] ? 'off' : this.seen[name] ? 'live' : 'waiting'
    const transcript = (this.core && this.core.transcript) || null
    return {
      session: (this.core && this.core.session) || null,
      channels: [
        { name: 'hooks', state: state('hooks'), target: null, how: null },
        { name: 'statusline', state: state('statusline'), target: null, how: null },
        { name: 'transcript', state: this.tail ? 'live' : 'waiting', target: transcript, how: transcript ? 'payload' : null }
      ],
      notice: this.notice,
      replaying: !!(this.tail && this.tail.replaying)
    }
  }

  // Idempotent, valid before, during and after prepare.
  close () {
    this.closed = true
    if (this.tail) this.tail.stop()
    if (this.server) this.server.close()
    if (this.src) this.src.close()
  }
}

// The system node runs the statusline relay, else Electron as node.
function nodeForRelay (env) {
  const n = resolveCommand('node', env.PATH)
  return n ? { path: n, asElectron: false } : { path: process.execPath, asElectron: true }
}

// The top-level commands of Claude Code 2.1.296: those `claude --help`
// lists, their aliases, and the hidden daemon, design-login, project,
// remote-control and sandbox. Claude Code takes a subcommand only as
// the first argument (measured 2026-10-12: `claude --settings F attach
// X` ran the prompt "attach"), so an injected option in front would turn
// it into a prompt.
const SUBCOMMANDS = new Set([
  'agents', 'attach', 'auth', 'auto-mode', 'daemon', 'design-login', 'doctor', 'gateway',
  'import', 'install', 'kill', 'logs', 'mcp', 'plugin', 'plugins', 'project', 'purge', 'rc',
  'remote-control', 'respawn', 'rm', 'sandbox', 'setup-token', 'stop', 'ultrareview',
  'update', 'upgrade'
])

// The subcommand cmd runs, or null.
function subcommand (cmd) {
  return cmd.length > 1 && SUBCOMMANDS.has(cmd[1]) ? cmd[1] : null
}

// The transcript of the background session `claude attach ID` opens:
// the session id and folder of <profile>/jobs/ID/state.json, every other
// field dropped at once. Null when ID names no job, such as a name.
function attachedTranscript (env, id) {
  if (!/^[A-Za-z0-9-]+$/.test(id || '')) return null
  const dir = settings.configDir(env)
  let session, cwd
  try {
    const d = JSON.parse(fs.readFileSync(path.join(dir, 'jobs', id, 'state.json'), 'utf8'))
    session = d.sessionId
    cwd = d.cwd
  } catch (e) {
    return null
  }
  if (typeof session !== 'string' || !/^[A-Za-z0-9-]+$/.test(session) || typeof cwd !== 'string') return null
  return { file: path.join(dir, 'projects', slug(cwd), `${session}.jsonl`), session }
}

const kind = 'claude'

function matches (base) {
  return /^claude(_.+)?$/.test(base)
}

// ctx.root: the runtime root the relays search. ctx.store: where the
// generated settings go.
function create (ctx) {
  const sub = subcommand(ctx.cmd)
  if (sub === 'attach') {
    const id = ctx.cmd[2]
    const find = () => {
      const t = attachedTranscript(ctx.env, id)
      return t && fs.existsSync(t.file) ? t : null
    }
    return claudeWatch.create({ bus: ctx.bus, find, argv: ctx.cmd, log: ctx.log })
  }
  if (sub) return plain.create(ctx)
  const python = resolveCommand('python3', ctx.env.PATH) || 'python3'
  return new ClaudeAdapter(ctx.bus, { cmd: ctx.cmd, env: ctx.env, cwd: ctx.cwd, runDir: ctx.runDir, root: ctx.root, store: ctx.store, mode: ctx.options.statusline, node: nodeForRelay(ctx.env), python, log: ctx.log, managedDir: ctx.managedDir })
}

module.exports = { kind, matches, create, carry, subcommand, attachedTranscript, ClaudeAdapter }
