'use strict'
// The sessions dashboard (decision 0028), the session of its tab in the
// shape of app/session.js for app/tabs.js. It has no pty and no child,
// its pid is null and it ends with no status of its own (0). While it
// lives it samples every live session every intervalMs into a History
// and sends the page what to draw. A session in a tab is read from that
// tab's bus. Any other gets a headless watch agent (app/metrics/agent.js)
// on a bus of its own, closed when the session ends, when a tab takes
// it, or when the dashboard ends. Each row also carries the issue board
// of its session's project, from board(folder) (decision 0029).

const EventEmitter = require('events')
const { History, pick } = require('./history')


class Dashboard extends EventEmitter {
  // list(): [{ s, tab, row }], the menu's live sessions. watcher(s):
  // { agent, bus } for a session elsewhere. send(view): to the page.
  // board(folder): what app/board.js Boards.get gives, counts only.
  constructor ({ list, watcher, send, view, log, board = () => null, intervalMs = 5000, points = 720, keepEndedMs = 600000 }) {
    super()
    Object.assign(this, { list, watcher, send, view, log, board, intervalMs })
    this.history = new History({ points, keepEndedMs, intervalMs })
    this.pid = null
    this.state = 'idle'
    this.status = null
    this.cmdline = ''
    this.watchers = new Map()
    this.made = []
    this.timer = null
    this.ended = new Promise(resolve => { this.resolve = resolve })
    view.onLoad(() => this.sendStrip())
  }

  sendStrip () {
    this.view.send('strip', { label: 'sessions', cmdline: 'every live agent session, sampled every 5 s', cwd: '', notice: 'read-only dashboard' })
  }

  start () {
    if (this.state !== 'idle') return
    this.state = 'running'
    this.sendStrip()
    this.sample()
    this.timer = setInterval(() => this.sample(), this.intervalMs)
  }

  // A session elsewhere: its watcher, made once and attached once
  // prepared.
  watch (e) {
    const key = e.row.key
    if (this.watchers.has(key)) return this.watchers.get(key)
    const w = Object.assign(this.watcher(e.s), { key })
    this.watchers.set(key, w)
    this.made.push(w)
    w.agent.prepare().then(() => {
      if (this.watchers.get(key) === w) w.agent.attach(e.s.pid)
    }, err => this.log(`dashboard: watch ${key}: ${err.stack || err}`))
    return w
  }

  unwatch (key) {
    const w = this.watchers.get(key)
    if (!w) return
    this.watchers.delete(key)
    try { w.agent.close() } catch (e) { this.log(`dashboard: close ${key}: ${e.stack || e}`) }
  }

  sample () {
    if (this.state !== 'running') return
    let entries
    try { entries = this.list() } catch (e) {
      this.log(`dashboard: list: ${e.stack || e}`)
      return
    }
    const samples = new Map()
    for (const e of entries) {
      const key = e.row.key
      let from
      if (e.tab) {
        this.unwatch(key)
        from = e.tab
      } else {
        from = this.watch(e)
      }
      let board = null
      try { board = this.board(e.s.cwd) } catch (err) { this.log(`dashboard: board: ${err.stack || err}`) }
      // A session whose history is still being read has no values yet:
      // its part-read totals would make the rest of the history a rise.
      const r = from.agent ? from.agent.report() : {}
      const values = r.replaying ? {} : pick(from.bus.snapshot(), this.history.dials)
      samples.set(key, { values, session: r.session || null, meta: { label: e.row.label, folder: e.row.folder, state: e.row.state, where: e.row.where, tab: e.row.tab, board } })
    }
    for (const key of [...this.watchers.keys()]) if (!samples.has(key)) this.unwatch(key)
    this.history.tick(Date.now(), samples)
    this.send(this.history.view())
  }

  // The dials open (decision 0033): the page draws a column of each.
  setDials (names) {
    this.history.setDials(names)
    if (this.state === 'running') this.send(this.history.view())
  }

  // For the live checks: the watchers now and every one made.
  report () {
    const tailing = w => { const t = w.agent.adapter && w.agent.adapter.tail; return !!t && !t.stopped }
    return {
      ticks: this.history.ticks.length,
      rows: [...this.history.rows.keys()],
      dials: this.history.dials.slice(),
      watching: [...this.watchers.keys()],
      made: this.made.map(w => ({ key: w.key, closed: w.agent.closed, tailing: tailing(w) }))
    }
  }

  input () {}

  resize () {}

  hangup () {
    this.end(0)
  }

  end (code) {
    if (this.state === 'ended') return
    this.state = 'ended'
    clearInterval(this.timer)
    for (const key of [...this.watchers.keys()]) this.unwatch(key)
    this.status = code
    this.resolve(code)
  }
}

module.exports = { Dashboard }
