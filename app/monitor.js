'use strict'
// A read-only tab of an agent session the app did not start (decision
// 0027), in the shape of a Session (app/session.js) for app/tabs.js. Its
// meters come from the session's own side channels through the watch
// adapter of app/metrics/agent.js. It has no pty and no child: it never
// types into the session and never signals it. Its pane says what it
// watches. It ends when the session ends or the tab closes, with no
// status of its own (0), and its pid is null, so nothing that ends the
// app's children ever reaches the watched process.

const EventEmitter = require('events')
const identity = require('./identity')
const sessions = require('./sessions')

class Monitor extends EventEmitter {
  // watched: { pid, started, argv, cwd }. adapters: [the watch agent].
  constructor ({ watched, label, adapters, view, log, pollMs = 2000 }) {
    super()
    Object.assign(this, { watched, label, adapters, view, log, pollMs })
    this.pid = null
    this.state = 'idle'
    this.status = null
    this.cmdline = watched.argv.map(identity.quote).join(' ')
    this.cwd = watched.cwd
    this.notice = null
    this.timer = null
    this.ended = new Promise(resolve => { this.resolve = resolve })
    view.onLoad(() => this.sendStrip())
  }

  sendStrip () {
    const notice = [this.notice, 'read-only monitor'].filter(Boolean).join('  ')
    this.view.send('strip', { label: this.label, cmdline: this.cmdline, cwd: identity.tildify(this.cwd), notice })
  }

  alive () {
    return sessions.same(this.watched.pid, this.watched.started)
  }

  async start () {
    if (this.state !== 'idle') return
    this.state = 'preparing'
    for (const a of this.adapters) {
      try { await a.prepare() } catch (e) { this.log(`monitor: adapter failed: ${e.stack || e}`) }
      if (this.state !== 'preparing') return
    }
    if (!this.alive()) return this.end(0)
    this.state = 'running'
    for (const a of this.adapters) a.attach(this.watched.pid)
    const { pid } = this.watched
    this.view.send('pty:data', Buffer.from(
      `\x1b[1mRead-only monitor\x1b[0m of ${this.label}, pid ${pid}, in ${identity.tildify(this.cwd)}.\r\n` +
      'The session runs in another terminal. This tab shows its meters and\r\n' +
      'never types into it. Closing this tab ends the monitor, not the session.\r\n'))
    this.sendStrip()
    this.timer = setInterval(() => this.poll(), this.pollMs)
    this.log(`monitor: watching ${pid}: ${identity.logged(this.watched.argv)}`)
  }

  // The session's end ends the tab. The notice follows the reports.
  poll () {
    if (!this.alive()) return this.end(0)
    const notice = this.adapters.map(a => a.report().notice).find(Boolean) || null
    if (notice !== this.notice) {
      this.notice = notice
      this.sendStrip()
    }
  }

  input () {}

  resize () {}

  hangup () {
    this.end(0)
  }

  end (code) {
    if (this.state === 'ended') return
    this.status = code
    clearInterval(this.timer)
    for (const a of this.adapters) {
      try { a.close() } catch (e) { this.log(`monitor: adapter close failed: ${e.stack || e}`) }
    }
    this.state = 'ended'
    this.resolve(code)
  }
}

module.exports = { Monitor }
