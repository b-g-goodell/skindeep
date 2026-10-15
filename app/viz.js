'use strict'
// The visualization window (decision 0015): never takes focus, gets a
// receive-only numeric feed at 30 Hz from the active tab's bus. The mode
// it shows is kept here: a left click or the space bar in the window
// steps it, the menu picks one, and each change is recorded as the last
// skin is (decision 0022), one file per window, the newest read at launch.

const { BrowserWindow, screen } = require('electron')
const path = require('path')
const last = require('./skins/last')
const { MODES } = require('./viz/modes')

// Beside last-skins under the app's state dir.
function modeDir (env = process.env) {
  return path.join(path.dirname(last.dir(env)), 'last-viz')
}

// The mode a launch starts in: the newest record that names a mode, else
// the first.
function startMode (records) {
  const r = records.find(r => MODES.some(m => m.id === r.spec))
  return r ? MODES.findIndex(m => m.id === r.spec) : 0
}

class Viz {
  // parent: the main window's view (app/view.js). log: the app's log.
  constructor (bus, title, parent, log = () => {}) {
    this.bus = bus
    this.title = title
    this.parent = parent
    this.log = log
    this.win = null
    this.dir = modeDir()
    const records = last.read(this.dir)
    try { last.prune(this.dir, records) } catch (e) { log(`last viz mode: ${e.message}`) }
    this.mode = startMode(records)
    this.timer = setInterval(() => this.feed(), 33)
    this.timer.unref()
  }

  // Another tab's bus. Its events from before the switch are dropped.
  follow (bus, title) {
    this.bus = bus
    this.title = title
    bus.drainEvents()
    if (this.isOpen()) this.win.setTitle(title)
  }

  isOpen () {
    return !!(this.win && !this.win.isDestroyed())
  }

  // Every mode, for the menu, the current one marked.
  modes () {
    return MODES.map((m, i) => ({ id: m.id, label: m.label, current: i === this.mode }))
  }

  // The menu's pick: shown, the window opened if it is closed. False for
  // an id that is no mode.
  select (id) {
    const i = MODES.findIndex(m => m.id === id)
    if (i < 0) return false
    this.set(i)
    this.open()
    return true
  }

  set (i) {
    if (i === this.mode) return
    this.mode = i
    try { last.record(this.dir, process.pid, MODES[i].id) } catch (e) { this.log(`last viz mode: ${e.message}`) }
  }

  open () {
    const b = this.parent.bounds()
    if (this.isOpen() || !b) return
    const area = screen.getDisplayMatching(b).workArea
    const w = 720
    const h = 460
    const opts = { width: w, height: h, minWidth: 320, minHeight: 200, title: this.title, show: false, backgroundColor: '#000000' }
    if (b.x + b.width + 8 + w <= area.x + area.width) Object.assign(opts, { x: b.x + b.width + 8, y: b.y })
    this.win = new BrowserWindow(Object.assign(opts, {
      webPreferences: {
        preload: path.join(__dirname, 'viz', 'preload.js'),
        contextIsolation: true,
        sandbox: true,
        spellcheck: false
      }
    }))
    this.win.on('page-title-updated', e => e.preventDefault())
    this.win.webContents.on('will-navigate', e => e.preventDefault())
    this.win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    // The page sends nothing, so its input is read here. A real key comes
    // as rawKeyDown, one from the DevTools protocol as keyDown.
    this.win.webContents.on('input-event', (_e, ie) => {
      const space = (ie.type === 'rawKeyDown' || ie.type === 'keyDown') && ie.code === 'Space' && !ie.isAutoRepeat
      if (space || (ie.type === 'mouseDown' && ie.button === 'left')) this.set((this.mode + 1) % MODES.length)
    })
    this.win.once('ready-to-show', () => {
      this.win.showInactive()
      this.parent.focus()
    })
    this.win.loadFile(path.join(__dirname, 'viz', 'index.html'))
  }

  close () {
    if (this.isOpen()) this.win.close()
  }

  toggle () {
    if (this.isOpen()) this.close()
    else this.open()
  }

  // Numbers only: rates, levels, event codes and the mode's index. No
  // session text.
  feed () {
    const events = this.bus.drainEvents()
    if (!this.isOpen()) return
    const g = n => {
      const v = this.bus.get(n)
      return typeof v === 'number' && isFinite(v) ? v : 0
    }
    const frame = [g('pty.out_bps'), g('pty.in_kps'), g('pty.idle_s'), g('tokens.out_rate'), g('state.busy'), g('proc.cpu_pct'), g('context.used_pct')]
    this.win.webContents.send('frame', { n: frame, e: events.map(Number), m: this.mode })
  }
}

module.exports = { Viz, modeDir, startMode }
