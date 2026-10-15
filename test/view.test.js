'use strict'
const test = require('node:test')
const assert = require('node:assert')
const EventEmitter = require('events')
const { View } = require('../app/view')

// A BrowserWindow as far as the view uses it. Once destroyed its methods
// throw, as Electron's do.
class FakeWindow extends EventEmitter {
  constructor () {
    super()
    this.destroyed = false
    this.calls = []
    const win = this
    this.webContents = Object.assign(new EventEmitter(), {
      send (channel, payload) { win.check(); win.calls.push(['send', channel, payload]) }
    })
  }

  check () { if (this.destroyed) throw new TypeError('Object has been destroyed') }
  isDestroyed () { return this.destroyed }
  destroy () { this.destroyed = true }
  getBounds () { this.check(); return { x: 10, y: 20, width: 800, height: 600 } }
  focus () { this.check(); this.calls.push(['focus']) }
  setMinimumSize (w, h) { this.check(); this.calls.push(['min', w, h]) }
  load () { this.webContents.emit('did-finish-load') }
}

test('V1 a send after the window is destroyed is dropped', () => {
  const win = new FakeWindow()
  const view = new View(win)
  win.destroy()
  view.send('pty:data', Buffer.from('x'))
  view.setMinimumSize(600, 400)
  assert.deepStrictEqual(win.calls, [])
})

test('V2 whenLoaded does not run when the load fires after the window was destroyed', () => {
  const win = new FakeWindow()
  const view = new View(win)
  let ran = 0
  view.whenLoaded(() => ran++)
  win.destroy()
  win.load()
  assert.strictEqual(ran, 0)
})

test('V2 whenLoaded runs once, after the first load', () => {
  const win = new FakeWindow()
  const view = new View(win)
  let ran = 0
  view.whenLoaded(() => ran++)
  assert.strictEqual(ran, 0)
  win.load()
  win.load()
  assert.strictEqual(ran, 1)
  view.whenLoaded(() => ran++)
  assert.strictEqual(ran, 2)
})

test('V3 onLoad functions run after every load, in registration order', () => {
  const win = new FakeWindow()
  const view = new View(win)
  const seen = []
  view.onLoad(() => seen.push('a'))
  view.onLoad(() => seen.push('b'))
  win.load()
  win.load()
  assert.deepStrictEqual(seen, ['a', 'b', 'a', 'b'])
})

test('V4 bounds is null and focus does nothing once destroyed', () => {
  const win = new FakeWindow()
  const view = new View(win)
  assert.deepStrictEqual(view.bounds(), { x: 10, y: 20, width: 800, height: 600 })
  win.destroy()
  assert.strictEqual(view.bounds(), null)
  view.focus()
  assert.deepStrictEqual(win.calls, [])
})

test('V5 a send before the first load is delivered', () => {
  const win = new FakeWindow()
  const view = new View(win)
  view.send('pty:data', 'early')
  assert.deepStrictEqual(win.calls, [['send', 'pty:data', 'early']])
})

test('a view with no window yet drops sends and runs onLoad once one loads', () => {
  const view = new View()
  view.send('strip', {})
  assert.strictEqual(view.bounds(), null)
  const seen = []
  view.onLoad(() => seen.push('load'))
  const win = new FakeWindow()
  view.attach(win)
  win.load()
  assert.deepStrictEqual(seen, ['load'])
  assert.deepStrictEqual(win.calls, [])
})
