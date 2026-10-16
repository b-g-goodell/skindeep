'use strict'
// The visualization window (decision 0015): never takes focus, gets a
// receive-only numeric feed at 30 Hz, one pane per tab from that tab's
// bus. Each pane's mode is kept here: the space bar and the menu act on
// the active tab's pane, a pane's own drop-down on that pane, and each
// pick is recorded as the last skin is (decision 0022), one file per window,
// the newest read at launch. The input, the sessions, the sound output or
// both, is recorded the same way, and the sound output is recorded only
// while the window is open on an input that takes it. The pointer belongs
// to the page, whose modes answer it, save a press on a drop-down, which
// is read here. The same numbers go each frame to the tab strip, open
// window or not, which draws each tab's own small visualization.

const { BrowserWindow, screen } = require('electron')
const path = require('path')
const last = require('./skins/last')
const { MODES } = require('./viz/modes')
const layout = require('./viz/layout')
const { Sound } = require('./viz/sound')
const pages = require('./pages')

// What drives the panes, in the order of the menu. The index is sent.
const INPUTS = [
  { id: 'session', label: 'Session' },
  { id: 'sound', label: 'Sound output' },
  { id: 'both', label: 'Session and sound output' }
]
const SOUND_STATUS = { off: 0, starting: 0, live: 1, failed: 2 }

// Beside last-skins under the app's state dir.
function modeDir (env = process.env) {
  return path.join(path.dirname(last.dir(env)), 'last-viz')
}

function inputDir (env = process.env) {
  return path.join(path.dirname(last.dir(env)), 'last-viz-input')
}

// The mode a launch starts in: the newest record that names a mode, else
// the first.
function startMode (records) {
  const r = records.find(r => MODES.some(m => m.id === r.spec))
  return r ? MODES.findIndex(m => m.id === r.spec) : 0
}

// The input a launch starts on: the newest record's, else the sessions.
function startInput (records) {
  const r = records.find(r => INPUTS.some(m => m.id === r.spec))
  return r ? INPUTS.findIndex(m => m.id === r.spec) : 0
}

class Viz {
  // tabs(): every tab in strip order, { id, bus, active, pane }, pane
  // false for a tab drawn by no pane, whose events are dropped. parent:
  // the main window's view (app/view.js). log: the app's log. strip:
  // called each frame, open or not, with every pane's tab's numbers,
  // [{ k, n, e }], for the tab strip's own drawing of each.
  constructor (tabs, title, parent, log = () => {}, strip = () => {}) {
    this.tabs = tabs
    this.title = title
    this.parent = parent
    this.log = log
    this.strip = strip
    this.win = null
    this.dir = modeDir()
    const records = last.read(this.dir)
    try { last.prune(this.dir, records) } catch (e) { log(`last viz mode: ${e.message}`) }
    // Tab id -> mode index. A new pane starts at the first mode no other
    // pane shows, counting from the last one picked.
    this.modeOf = new Map()
    // The tab whose pane's drop-down is open, or null.
    this.menu = null
    this.base = startMode(records)
    this.inputs = inputDir()
    const inputs = last.read(this.inputs)
    try { last.prune(this.inputs, inputs) } catch (e) { log(`last viz input: ${e.message}`) }
    this.input = startInput(inputs)
    this.sound = new Sound({ log })
    process.on('exit', () => this.sound.stop())
    this.timer = setInterval(() => this.feed(), 33)
    this.timer.unref()
  }

  setTitle (title) {
    this.title = title
    if (this.isOpen()) this.win.setTitle(title)
  }

  // The tabs with a pane, each with its mode. Modes of tabs gone are
  // dropped.
  panes () {
    const out = this.tabs().filter(t => t.pane)
    for (const id of this.modeOf.keys()) if (!out.some(t => t.id === id)) this.modeOf.delete(id)
    if (!out.some(t => t.id === this.menu)) this.menu = null
    for (const t of out) {
      if (this.modeOf.has(t.id)) continue
      const used = new Set(this.modeOf.values())
      const free = MODES.map((_, k) => (this.base + k) % MODES.length).find(m => !used.has(m))
      this.modeOf.set(t.id, free === undefined ? this.base : free)
    }
    return out.map(t => Object.assign({}, t, { mode: this.modeOf.get(t.id) }))
  }

  // The active tab's pane, or null.
  activePane () {
    return this.panes().find(t => t.active) || null
  }

  isOpen () {
    return !!(this.win && !this.win.isDestroyed())
  }

  // Every mode, for the menu, the active tab's pane's marked.
  modes () {
    const a = this.activePane()
    return MODES.map((m, i) => ({ id: m.id, label: m.label, current: !!a && i === a.mode }))
  }

  // The menu's pick, for the active tab's pane: shown, the window opened
  // if it is closed. False for an id that is no mode.
  select (id) {
    const i = MODES.findIndex(m => m.id === id)
    if (i < 0) return false
    const a = this.activePane()
    if (a) this.set(a.id, i)
    this.open()
    return true
  }

  // Every input, for the menu, the current one marked.
  inputList () {
    return INPUTS.map((m, i) => ({ id: m.id, label: m.label, current: i === this.input }))
  }

  // The menu's pick of input, the window opened if it is closed. False
  // for an id that is no input.
  selectInput (id) {
    const i = INPUTS.findIndex(m => m.id === id)
    if (i < 0) return false
    if (i !== this.input) {
      this.input = i
      try { last.record(this.inputs, process.pid, id) } catch (e) { this.log(`last viz input: ${e.message}`) }
      if (this.sound.status === 'failed') this.sound.status = 'off'
    }
    this.open()
    this.syncSound()
    return true
  }

  // Record the sound output while the window is open on an input that
  // takes it, else stop.
  syncSound () {
    if (this.input > 0 && this.isOpen()) this.sound.start()
    else this.sound.stop()
  }

  set (tab, i) {
    if (this.modeOf.get(tab) === i) return
    this.modeOf.set(tab, i)
    this.base = i
    try { last.record(this.dir, process.pid, MODES[i].id) } catch (e) { this.log(`last viz mode: ${e.message}`) }
  }

  step (pane) {
    if (pane) this.set(pane.id, (pane.mode + 1) % MODES.length)
  }

  // A left press at (x, y) in the window: a pane's button opens its
  // drop-down, or closes it, a row of the open drop-down shows that mode
  // in that pane alone, and any other press closes the drop-down.
  press (x, y) {
    const list = this.panes()
    const [w, h] = this.win.getContentSize()
    const hit = layout.press(x, y, list.length, MODES.length, w, h, list.findIndex(t => t.id === this.menu))
    const was = this.menu
    this.menu = null
    if (!hit) return
    const tab = list[hit.pane].id
    if (hit.button) this.menu = was === tab ? null : tab
    else this.set(tab, hit.item)
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
        preload: pages.preload('viz'),
        contextIsolation: true,
        sandbox: true,
        spellcheck: false
      }
    }))
    this.win.on('page-title-updated', e => e.preventDefault())
    this.win.webContents.on('will-navigate', e => e.preventDefault())
    this.win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    // The page sends nothing, so the space bar and the drop-downs'
    // presses are read here: space steps the active tab's pane. A real
    // key comes as rawKeyDown, one from the DevTools protocol as keyDown.
    // A press's x and y are in CSS pixels, as the page lays out.
    this.win.webContents.on('input-event', (_e, ie) => {
      const space = (ie.type === 'rawKeyDown' || ie.type === 'keyDown') && ie.code === 'Space' && !ie.isAutoRepeat
      if (space) this.step(this.activePane())
      else if (ie.type === 'mouseDown' && ie.button === 'left') this.press(ie.x, ie.y)
    })
    this.win.once('ready-to-show', () => {
      this.win.showInactive()
      this.parent.focus()
    })
    this.win.on('closed', () => {
      this.win = null
      this.menu = null
      this.syncSound()
    })
    this.win.loadURL(pages.url('app/viz/index.html'))
    this.syncSound()
  }

  close () {
    if (this.isOpen()) this.win.close()
  }

  toggle () {
    if (this.isOpen()) this.close()
    else this.open()
  }

  // Numbers only, per pane in strip order: the tab's id, its place in
  // the strip from 1, whether it is active, the mode's index, whether its
  // drop-down is open, rates, levels and event codes. No session text.
  // Every tab's events are drained here alone, and the same numbers go
  // to the tab strip, so none piles up while the window is closed and
  // the strip and the pane see the same events.
  feed () {
    const all = this.tabs()
    const events = new Map(all.map(t => [t.id, t.bus.drainEvents()]))
    const nums = new Map(all.filter(t => t.pane).map(t => {
      const g = n => {
        const v = t.bus.get(n)
        return typeof v === 'number' && isFinite(v) ? v : 0
      }
      const n = [g('pty.out_bps'), g('pty.in_kps'), g('pty.idle_s'), g('tokens.out_rate'), g('state.busy'), g('proc.cpu_pct'), g('context.used_pct')]
      return [t.id, { k: t.id, n, e: (events.get(t.id) || []).map(Number) }]
    }))
    this.strip([...nums.values()])
    if (!this.isOpen()) return
    const p = this.panes().map(t => {
      const { n, e } = nums.get(t.id)
      return { k: t.id, i: all.findIndex(x => x.id === t.id) + 1, a: t.active ? 1 : 0, m: t.mode, o: t.id === this.menu ? 1 : 0, n, e }
    })
    // src: the input's index. st: the sound output's state, 0 none yet,
    // 1 live, 2 failed. s: its newest samples, while it takes them.
    const st = SOUND_STATUS[this.sound.status]
    this.win.webContents.send('frame', { p, src: this.input, st, s: this.input > 0 && st === 1 ? this.sound.samples() : new Float32Array(0) })
  }
}

module.exports = { Viz, modeDir, startMode, startInput, INPUTS }
