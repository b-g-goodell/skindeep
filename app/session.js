'use strict'
// One tab's CLI child, from adapter preparation to reaping: the argv it
// execs, spawn, input, one kill policy, its exit status (decisions 0003
// and 0016), and its identity strip (decision 0004). An app error is the
// window's, app/tabs.js.

const EventEmitter = require('events')
const fs = require('fs')
const path = require('path')
const pty = require('node-pty')
const cli = require('./cli')
const identity = require('./identity')

const DROPPED_ENV = ['CHROME_DESKTOP', 'FC_FONTATIONS', 'SKINNED_RUNTIME_DIR', 'SKINNED_SKIN', 'SKINNED_MUTE']

// A close of the window, or a signal to the app, before the CLI started:
// the status a hung-up child usually reports.
const EXIT_BEFORE_SPAWN = 129

// The longest wait for the final screen of a CLI that exited by itself.
const SCREEN_MS = 1000

// 128+n for death by signal n, as a shell reports it.
function exitCode ({ exitCode, signal }) {
  return signal ? 128 + signal : exitCode
}

// The caller's environment, minus what Chromium added to ours at startup,
// plus the terminal type.
function childEnv (env) {
  const out = Object.assign({}, env, { TERM: 'xterm-256color', COLORTERM: 'truecolor' })
  for (const k of DROPPED_ENV) delete out[k]
  return out
}

// adapters: each may have prepare() resolving { args, notice },
// attach(pid), onOutput(bytes), onInput() and close(), all optional.
// view: send(channel, payload) and onLoad(fn), as app/view.js. note: a
// fixed text shown after the adapters' notice. execError: a file of the
// tab's own directory where exec-clean.py writes why the exec failed.
// screen: resolves the text of the terminal's last screen, or null;
// asked when the CLI exits by itself, its answer kept as lastScreen
// before the end (decision 0030).
class Session extends EventEmitter {
  constructor ({ file, argv, cwd, env, label, note = null, adapters = [], view, tell, log, execError = null, screen = null, graceMs = 2000, pollMs = 2000 }) {
    super()
    Object.assign(this, { file, argv, cwd, env, label, note, adapters, view, tell, log, execError, screen, graceMs, pollMs })
    this.lastScreen = null
    this.state = 'idle'
    this.pid = null
    this.status = null
    this.cmdline = ''
    this.notice = null
    this.child = null
    // Why the exec failed, read from execError when the child exits.
    this.failure = null
    this.killTimer = null
    this.pollTimer = null
    this.ended = new Promise(resolve => { this.resolve = resolve })
    view.onLoad(() => this.sendStrip())
  }

  sendStrip () {
    const notice = [this.notice, this.note].filter(Boolean).join('  ') || null
    this.view.send('strip', { label: this.label, cmdline: identity.shownCmdline(this.cmdline), cwd: identity.tildify(this.cwd), notice })
  }

  // The live command line follows any exec in a wrapper script, and the
  // notice follows the adapters' reports.
  pollStrip () {
    let changed = false
    const now = identity.liveCmdline(this.pid)
    if (now && now !== this.cmdline) {
      this.cmdline = now
      changed = true
    }
    const reports = this.adapters.filter(a => a.report).map(a => a.report())
    const notice = reports.length ? reports.map(r => r.notice).find(Boolean) || null : this.notice
    if (notice !== this.notice) {
      this.notice = notice
      changed = true
    }
    if (changed) this.sendStrip()
  }

  // Never throws or rejects. An end asked for during a prepare discards
  // its result: nothing spawns.
  async start (cols, rows) {
    if (this.state !== 'idle') return
    this.state = 'preparing'
    const args = []
    for (const a of this.adapters) {
      if (!a.prepare) continue
      try {
        const r = await a.prepare()
        if (r && r.args) args.push(...r.args)
        if (r && r.notice) this.notice = r.notice
      } catch (e) {
        this.log(`adapter failed: ${e.stack || e}`)
        this.notice = 'meters limited: adapter failed'
      }
      if (this.state !== 'preparing') return
    }
    try {
      this.spawn([this.argv[0], ...args, ...this.argv.slice(1)], cols, rows)
    } catch (e) {
      this.log(`spawn failed: ${e.stack || e}`)
      this.tell(`cannot start ${this.argv[0]}: ${e.message}`)
      this.end(cli.EXIT_APP)
    }
  }

  // Always through exec-clean.py, so the child holds only fds 0 to 2 and
  // a failed exec ends as decision 0003 says. node-pty's own exec ends
  // any failure with status 1.
  spawn (cmd, cols, rows) {
    const py = cli.resolveCommand('python3', this.env.PATH)
    if (!py) throw new Error('python3 not found on PATH, the app needs it to start a command')
    const args = ['-I', '-S', path.join(__dirname, 'exec-clean.py'), this.execError || '', this.file, ...cmd]
    this.child = pty.spawn(py, args, { name: 'xterm-256color', cols, rows, cwd: this.cwd, env: childEnv(this.env), encoding: null })
    this.pid = this.child.pid
    this.state = 'running'
    // The argv exec'd. /proc shows it once the exec has happened.
    this.cmdline = cmd.map(identity.quote).join(' ')
    this.log(`spawn ${this.pid}: ${this.label}: ${this.file}: ${this.cmdline}`)
    this.sendStrip()
    this.pollTimer = setInterval(() => this.pollStrip(), this.pollMs)
    for (const a of this.adapters) if (a.attach) a.attach(this.pid)
    this.child.onData(d => {
      for (const a of this.adapters) if (a.onOutput) a.onOutput(d.length)
      this.view.send('pty:data', d)
    })
    this.child.onExit(e => {
      const code = exitCode(e)
      this.log(`child ${this.pid} exited: ${code}`)
      if (this.execError) {
        try { this.failure = fs.readFileSync(this.execError, 'utf8') } catch (err) {}
      }
      if (this.failure) this.tell(`cannot start ${this.argv[0]}: ${this.failure}`)
      this.child = null
      clearTimeout(this.killTimer)
      this.finalScreen(() => this.end(code))
    })
    this.emit('spawn', this.pid)
  }

  // A CLI that exited by itself leaves its last screen, as in a terminal:
  // it is read before the end, at most SCREEN_MS. A hung-up one is not.
  finalScreen (then) {
    if (!this.screen || this.state === 'ending') return then()
    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      then()
    }
    const timer = setTimeout(finish, SCREEN_MS)
    Promise.resolve().then(() => this.screen()).then(s => {
      if (!done && typeof s === 'string') this.lastScreen = s
    }, () => {}).then(finish)
  }

  input (data) {
    if (!this.child) return
    for (const a of this.adapters) if (a.onInput) a.onInput()
    this.child.write(data)
  }

  resize (cols, rows) {
    if (this.child) this.child.resize(cols, rows)
  }

  // As closing a terminal does: SIGHUP to the child's process group,
  // SIGKILL after the grace. The end follows the child's exit.
  hangup () {
    if (this.state === 'ended' || this.killTimer) return
    if (!this.child) return this.end(EXIT_BEFORE_SPAWN)
    this.state = 'ending'
    this.signal('SIGHUP')
    this.killTimer = setTimeout(() => this.signal('SIGKILL'), this.graceMs)
  }

  // node-pty's child calls setsid after the fork has returned here, so
  // until then its group does not exist and the child itself is signalled.
  // It holds signals blocked until it has reset their dispositions.
  signal (sig) {
    if (!this.child) return
    try {
      process.kill(-this.pid, sig)
    } catch (e) {
      if (e.code === 'ESRCH') try { process.kill(this.pid, sig) } catch (_) {}
    }
  }

  // The first end stands.
  end (code) {
    if (this.state === 'ended') return
    this.status = code
    clearInterval(this.pollTimer)
    for (const a of this.adapters) {
      if (!a.close) continue
      try { a.close() } catch (e) { this.log(`adapter close failed: ${e.stack || e}`) }
    }
    this.state = 'ended'
    this.resolve(this.status)
  }
}

module.exports = { Session, exitCode, childEnv }
