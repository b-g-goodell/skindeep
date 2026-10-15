'use strict'
// A view (app/view.js's interface) that records what reaches it. load()
// fires the onLoad functions, destroy() makes it drop every later send.

class RecordingView {
  constructor () {
    this.sent = []
    this.loadFns = []
    this.destroyed = false
  }

  send (channel, payload) {
    if (!this.destroyed) this.sent.push([channel, payload])
  }

  onLoad (fn) {
    this.loadFns.push(fn)
  }

  load () {
    if (!this.destroyed) for (const fn of this.loadFns) fn()
  }

  destroy () {
    this.destroyed = true
  }

  // The pty bytes received so far, as one Buffer.
  bytes () {
    return Buffer.concat(this.sent.filter(([c]) => c === 'pty:data').map(([, d]) => d))
  }

  text () {
    return this.bytes().toString('utf8')
  }

  strips () {
    return this.sent.filter(([c]) => c === 'strip').map(([, s]) => s)
  }
}

module.exports = { RecordingView }
