'use strict'
// What the sound output plays, for the visualization (decision 0015): the
// default sink's monitor, mono 16-bit at 44.1 kHz, read from a recorder
// the app starts and stops. Never a microphone, never written anywhere:
// the newest N samples are kept in memory for the viz page alone.

const { spawn } = require('child_process')

const N = 1024
const RATE = 44100

// The recorders tried in order: PulseAudio's, which PipeWire's pulse
// server also answers, then PipeWire's own.
const RECORDERS = [
  ['parec', ['--format=s16le', `--rate=${RATE}`, '--channels=1', '--latency-msec=20', '-d', '@DEFAULT_MONITOR@']],
  ['pw-record', ['--format', 's16', '--rate', String(RATE), '--channels', '1', '-P', '{ stream.capture.sink=true }', '-']]
]

class Sound {
  // recorders: [[cmd, args], ...], for tests. log: the app's log.
  constructor ({ recorders = RECORDERS, log = () => {} } = {}) {
    this.recorders = recorders
    this.log = log
    this.child = null
    this.ring = new Float32Array(N)
    this.at = 0
    this.odd = null
    // off, starting, live, or failed with this.reason.
    this.status = 'off'
    this.reason = ''
  }

  start () {
    if (this.child || this.status === 'live') return
    this.ring.fill(0)
    this.status = 'starting'
    this.reason = ''
    this.attempt(0, [])
  }

  // Recorder i, else the next once it fails before its first sample.
  attempt (i, why) {
    if (i >= this.recorders.length) {
      this.status = 'failed'
      this.reason = why.join('; ')
      this.log(`sound output: ${this.reason}`)
      return
    }
    const [cmd, args] = this.recorders[i]
    let heard = false
    let err = ''
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    this.child = child
    child.stdout.on('data', b => {
      heard = true
      if (this.child === child) {
        this.status = 'live'
        this.push(b)
      }
    })
    child.stderr.on('data', b => { err = (err + b).slice(-400) })
    const done = what => {
      if (this.child !== child) return
      this.child = null
      if (!heard) return this.attempt(i + 1, [...why, `${cmd}: ${what}`])
      this.status = 'failed'
      this.reason = `${cmd}: ${what}`
      this.log(`sound output: ${this.reason}`)
    }
    child.on('error', e => done(e.code === 'ENOENT' ? 'not found' : e.message))
    child.on('exit', (code, sig) => done(`exited ${sig || code}${err.trim() ? ': ' + err.trim().split('\n').pop() : ''}`))
  }

  push (b) {
    let k = 0
    if (this.odd !== null) {
      b = Buffer.concat([Buffer.from([this.odd]), b])
      this.odd = null
    }
    for (; k + 1 < b.length; k += 2) {
      this.ring[this.at] = b.readInt16LE(k) / 32768
      this.at = (this.at + 1) % N
    }
    if (k < b.length) this.odd = b[k]
  }

  // The newest N samples, oldest first.
  samples () {
    const out = new Float32Array(N)
    out.set(this.ring.subarray(this.at))
    out.set(this.ring.subarray(0, this.at), N - this.at)
    return out
  }

  // The recorder this object started, and no other process.
  stop () {
    const c = this.child
    this.child = null
    this.odd = null
    if (this.status !== 'failed') this.status = 'off'
    if (c && c.exitCode === null && c.signalCode === null) try { c.kill('SIGTERM') } catch (e) {}
  }
}

module.exports = { Sound, RECORDERS, N, RATE }
