'use strict'
// The main window as the app's modules use it. Every call checks once
// that the window exists: it is made only when Electron is ready, and a
// CLI that exits fast can close it before the page has loaded.

class View {
  constructor (win = null) {
    this.win = null
    this.loaded = false
    this.loadFns = []
    this.firstFns = []
    if (win) this.attach(win)
  }

  attach (win) {
    this.win = win
    this.wc = win.webContents
    this.wc.on('did-finish-load', () => {
      if (this.gone()) return
      this.loaded = true
      for (const fn of this.loadFns) fn()
      for (const fn of this.firstFns.splice(0)) fn()
    })
  }

  gone () {
    return !this.win || this.win.isDestroyed()
  }

  // No load gate: the CLI's first bytes can precede the page load, and
  // the renderer listens before it asks for the pty.
  send (channel, ...args) {
    if (!this.gone()) this.wc.send(channel, ...args)
  }

  // fn after every page load.
  onLoad (fn) {
    this.loadFns.push(fn)
  }

  // fn once, after the first page load.
  whenLoaded (fn) {
    if (!this.loaded) this.firstFns.push(fn)
    else if (!this.gone()) fn()
  }

  bounds () {
    return this.gone() ? null : this.win.getBounds()
  }

  focus () {
    if (!this.gone()) this.win.focus()
  }

  setMinimumSize (w, h) {
    if (!this.gone()) this.win.setMinimumSize(w, h)
  }

  // The content grows to at least w x h, never shrinks.
  growTo (w, h) {
    if (this.gone()) return
    const [cw, ch] = this.win.getContentSize()
    if (cw < w || ch < h) this.win.setContentSize(Math.max(cw, w), Math.max(ch, h))
  }

  setTitle (title) {
    if (!this.gone()) this.win.setTitle(title)
  }
}

module.exports = { View }
