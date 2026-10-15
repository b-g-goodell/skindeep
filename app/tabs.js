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
// Events: 'change' when the list, the order or the active tab changes,
// 'active' (tab) when another tab becomes active, 'gone' (tab, code,
// next) when a tab's session has ended, next its successor or null.

const EventEmitter = require('events')
const cli = require('./cli')

class Tabs extends EventEmitter {
  constructor ({ make, tell, log, follow = null }) {
    super()
    Object.assign(this, { make, tell, log, follow })
    this.last = null
    this.list = []
    this.active = null
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

  // A new tab at the end, made active. Null once the app is ending.
  // make's error reaches the caller.
  add (spec) {
    if (this.ending) return null
    const tab = this.make(this.nextId++, spec)
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
      this.watch(next)
      return next
    } catch (e) {
      this.log(`follow: ${e.stack || e}`)
      return null
    }
  }

  select (tab) {
    if (!tab || tab === this.active || !this.list.includes(tab)) return
    this.active = tab
    tab.unseen = false
    this.emit('active', tab)
    this.emit('change')
  }

  activate (id) {
    this.select(this.get(id))
  }

  // d = 1 the next tab, -1 the previous, wrapping at either end.
  step (d) {
    const n = this.list.length
    if (n < 2) return
    const i = this.list.indexOf(this.active)
    this.select(this.list[(i + d + n) % n])
  }

  move (id, index) {
    const tab = this.get(id)
    if (!tab) return
    const to = Math.max(0, Math.min(this.list.length - 1, index))
    const from = this.list.indexOf(tab)
    if (from === to) return
    this.list.splice(from, 1)
    this.list.splice(to, 0, tab)
    this.emit('change')
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
  // one to its left.
  gone (tab, code) {
    const i = this.list.indexOf(tab)
    if (i < 0) return
    const next = this.successor(tab, code)
    if (next) {
      this.list.splice(i, 1, next)
      this.emit('gone', tab, code, next)
      if (tab === this.active) {
        this.active = null
        this.select(next)
      } else {
        this.emit('change')
      }
      return
    }
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
    if (tab === this.active) {
      this.active = null
      this.select(this.list[Math.min(i, this.list.length - 1)])
    } else {
      this.emit('change')
    }
  }
}

module.exports = { Tabs }
