'use strict'
// The sound output input of the visualization (decision 0015): the next
// recorder when one fails before its first sample, the newest samples
// in order, and stop ends the recorder.
const test = require('node:test')
const assert = require('node:assert')
const path = require('path')
const { Sound, N } = require('../app/viz/sound')

const FAKE = path.join(__dirname, '..', 'scripts', 'fake', 'parec')
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

test('a missing or failing recorder falls through to the next, which goes live', async () => {
  const logs = []
  const s = new Sound({ recorders: [['no-such-recorder-x', []], ['sh', ['-c', 'echo refused >&2; exit 1']], [FAKE, []]], log: m => logs.push(m) })
  s.start()
  await wait(400)
  assert.strictEqual(s.status, 'live')
  const a = s.samples()
  assert.strictEqual(a.length, N)
  assert.ok(a.some(v => v !== 0) && a.every(v => v >= -1 && v <= 1))
  const child = s.child
  s.stop()
  assert.strictEqual(s.status, 'off')
  await wait(200)
  assert.ok(child.exitCode !== null || child.signalCode !== null, 'stop ended the recorder')
  assert.deepStrictEqual(logs, [])
})

test('every recorder failing is reported, with each one\'s reason', async () => {
  const logs = []
  const s = new Sound({ recorders: [['no-such-recorder-x', []], ['sh', ['-c', 'echo refused >&2; exit 1']]], log: m => logs.push(m) })
  s.start()
  await wait(300)
  assert.strictEqual(s.status, 'failed')
  assert.match(s.reason, /no-such-recorder-x: not found; sh: exited 1: refused/)
  assert.strictEqual(logs.length, 1)
})

test('samples come out oldest first, across a split sample', () => {
  const s = new Sound()
  const b = Buffer.alloc(6)
  b.writeInt16LE(16384, 0)
  b.writeInt16LE(-16384, 2)
  b.writeInt16LE(32767, 4)
  s.push(b.subarray(0, 3))
  s.push(b.subarray(3))
  const a = s.samples()
  assert.deepStrictEqual(Array.from(a.slice(N - 3)), [0.5, -0.5, 32767 / 32768])
})
