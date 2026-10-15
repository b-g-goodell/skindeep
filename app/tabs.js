'use strict'
// The tabs of the window (decision 0023): their order, the active one,
// and the app's end. make(id, spec) returns a tab { id, session, ... }
// whose session is a Session (app/session.js). A tab leaves the list
// when its session ends. The app ends with the last tab: with the status
// of the last tab with a CLI to end, unless an app error decided 125
// first (decision 0003). A monitor tab (tab.monitor, decision 0027) and
// the sessions dashboard (tab.dashboard, decision 0028) have no CLI of
// the app's and no status of their own.
//
// follow(tab, code): a spec for a tab that takes the place of a tab
// whose CLI ended by itself, or null (decision 0030). last: the last tab
// gone, once the list is empty.
//
// Windows: each tab has tab.win, the id of its window, and each
// window its own active tab. The list's order holds every window's
// tabs, each window's in its strip's order. current is the window the
// user last acted in, and active is its active tab. A window argument
// left out is current.
//
// Events: 'change' when the list, the order or an active tab changes,
// 'active' (tab) when another tab becomes active in its window, 'gone'
// (tab, code, next) when a tab's session has ended, next its successor
// or null, 'empty' (win) when a window's last tab left while tabs remain
// in other windows.

const EventEmitter = require('events')
const cli = require('./cli')

class Tabs extends EventEmitter {
  constructor ({ make, tell, log, follow = null }) {
    super()
    Object.assign(this, { make, tell, log, follow })
    this.last = null
    this.list = []
    this.actives = new Map()
    this.current = 0
    this.nextId = 1
    this.status = null
    this.lastCli = 0
    this.ending = false
    this.done = false
    this.ended = new Promise(resolve => { this.resolve = resolve })
  }

  get (id) {
    return this.list.find(t => t.id === id) || null
  }

  get active () {
    return this.actives.get(this.current) || null
  }

  activeOf (win) {
    return this.actives.get(win) || null
  }

  inWin (win) {
    return this.list.filter(t => t.win === win)
  }

  wins () {
    return [...new Set(this.list.map(t => t.win))]
  }

  // A new tab at the end of win's strip, made active. Null once the app
  // is ending. make's error reaches the caller.
  add (spec, win = this.current) {
    if (this.ending) return null
    const tab = this.make(this.nextId++, spec)
    tab.win = win
    this.list.push(tab)
    this.watch(tab)
    this.select(tab)
    return tab
  }

  watch (tab) {
    tab.closed = false
    tab.unseen = false
    tab.session.ended.then(code => this.gone(tab, code))
  }

  // The successor of a tab whose CLI ended by itself, in its place, or
  // null. make's error is logged and leaves no successor.
  successor (tab, code) {
    if (!this.follow || tab.closed || this.ending) return null
    let spec = null
    try { spec = this.follow(tab, code) } catch (e) { this.log(`follow: ${e.stack || e}`) }
    if (!spec) return null
    try {
      const next = this.make(this.nextId++, spec)
      next.win = tab.win
      this.watch(next)
      return next
    } catch (e) {
      this.log(`follow: ${e.stack || e}`)
      return null
    }
  }

  select (tab) {
    if (!tab || tab === this.activeOf(tab.win) || !this.list.includes(tab)) return
    this.actives.set(tab.win, tab)
    tab.unseen = false
    this.emit('active', tab)
    this.emit('change')
  }

  activate (id) {
    this.select(this.get(id))
  }

  // d = 1 the next tab of win, -1 the previous, wrapping at either end.
  step (d, win = this.current) {
    const mine = this.inWin(win)
    const n = mine.length
    if (n < 2) return
    const i = mine.indexOf(this.activeOf(win))
    this.select(mine[(i + d + n) % n])
  }

  // index: the place among the tab's own window's tabs.
  move (id, index) {
    const tab = this.get(id)
    if (!tab) return
    const mine = this.inWin(tab.win)
    const to = Math.max(0, Math.min(mine.length - 1, index))
    const from = mine.indexOf(tab)
    if (from === to) return
    mine.splice(from, 1)
    mine.splice(to, 0, tab)
    let k = 0
    this.list = this.list.map(t => t.win === tab.win ? mine[k++] : t)
    this.emit('change')
  }

  // The tab leaves its window for win, last in its strip and active
  // there. Its old window activates the neighbour a close would, or is
  // empty.
  detach (id, win) {
    const tab = this.get(id)
    if (!tab || tab.win === win) return
    const from = tab.win
    const mine = this.inWin(from)
    const i = mine.indexOf(tab)
    this.list.splice(this.list.indexOf(tab), 1)
    this.list.push(tab)
    tab.win = win
    if (this.activeOf(from) === tab) {
      this.actives.delete(from)
      const left = this.inWin(from)
      if (left.length) this.select(left[Math.min(i, left.length - 1)])
    }
    this.select(tab)
    if (!this.inWin(from).length) this.emit('empty', from)
    this.emit('change')
  }

  // Hangs up every tab of win.
  closeWin (win) {
    for (const t of this.inWin(win)) this.close(t.id)
  }

  // Hangs up the tab's CLI by the kill policy of decision 0016. The tab
  // leaves when its session has ended.
  close (id) {
    const tab = this.get(id)
    if (!tab) return
    tab.closed = true
    tab.session.hangup()
  }

  hangupAll () {
    this.ending = true
    for (const t of this.list) {
      t.closed = true
      t.session.hangup()
    }
  }

  // An app error: told once, 125 decided, every tab hung up. After the
  // decision, or after the last tab, it is only logged.
  fail (err) {
    const msg = `internal error: ${(err && err.stack) || err}`
    if (this.done || this.status !== null) return this.log(msg)
    this.status = cli.EXIT_APP
    this.tell(msg)
    this.hangupAll()
  }

  // The tab to the right of a closed active tab becomes active, else the
  // one to its left, in its own window.
  gone (tab, code) {
    const i = this.list.indexOf(tab)
    if (i < 0) return
    const next = this.successor(tab, code)
    const win = tab.win
    const wasActive = this.activeOf(win) === tab
    if (next) {
      this.list.splice(i, 1, next)
      this.emit('gone', tab, code, next)
      if (wasActive) {
        this.actives.delete(win)
        this.select(next)
      } else {
        this.emit('change')
      }
      return
    }
    const j = this.inWin(win).indexOf(tab)
    this.list.splice(i, 1)
    if (!tab.monitor && !tab.dashboard) this.lastCli = code
    this.emit('gone', tab, code, null)
    if (!this.list.length) {
      this.done = true
      this.ending = true
      this.last = tab
      this.resolve(this.status !== null ? this.status : this.lastCli)
      return
    }
    const left = this.inWin(win)
    if (wasActive) {
      this.actives.delete(win)
      if (left.length) this.select(left[Math.min(j, left.length - 1)])
    }
    if (!left.length) this.emit('empty', win)
    this.emit('change')
  }
}

module.exports = { Tabs }
