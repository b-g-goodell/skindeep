'use strict'
// CLI-agnostic meters: /proc of the child tree, pty rates, idle, clock
// (decision 0014). Reads only stat, statm and children.

const fs = require('fs')
const { EVENT } = require('./bus')
const { tree } = require('./proc')

const TICKS = 100
const PAGE = 4096
const SILENCE_MS = 250

function read (p) {
  try { return fs.readFileSync(p, 'utf8') } catch (e) { return null }
}

function cpuTicks (pid) {
  const s = read(`/proc/${pid}/stat`)
  if (!s) return 0
  const f = s.slice(s.lastIndexOf(')') + 2).split(' ')
  return Number(f[11]) + Number(f[12])
}

function rssBytes (pid) {
  const s = read(`/proc/${pid}/statm`)
  return s ? Number(s.split(' ')[1]) * PAGE : 0
}

// The writer source: the pty rates are the writer's 1 s windows, and
// every name appears once the child exists.
const SOURCE = { defaults: { 'event.output': 0 }, rates: ['pty.out_bps', 'pty.in_kps'] }

// The /proc sample's cadence.
const SAMPLE_MS = 1000

class Generic {
  // clock: { now() }, the seam's (decision 0021).
  constructor (bus, clock) {
    this.src = bus.source(SOURCE)
    this.clock = clock
    this.start = clock.now()
    this.lastOut = null
    this.lastSample = -Infinity
    this.prevTicks = null
    this.prevAt = 0
    this.pid = null
  }

  async prepare () {
    return { args: [], notice: null }
  }

  attach (pid) {
    this.pid = pid
    this.src.begin()
    this.poll(this.clock.now())
  }

  report () {
    const state = this.pid ? 'live' : 'waiting'
    return {
      session: null,
      channels: [{ name: 'pty', state, target: null, how: null }, { name: 'proc', state, target: null, how: null }],
      notice: null
    }
  }

  close () {
    this.src.close()
  }

  onOutput (bytes) {
    const now = this.clock.now()
    if (this.lastOut === null || now - this.lastOut > SILENCE_MS) {
      this.src.pulse('event.output')
      this.src.event(EVENT.output)
    }
    this.lastOut = now
    this.src.sample('pty.out_bps', bytes)
  }

  onInput () {
    this.src.sample('pty.in_kps', 1)
  }

  // Each tick of the seam's clock: idle and the session clock, and /proc
  // once a second.
  poll (now) {
    if (!this.pid) return
    this.src.set('pty.idle_s', (now - (this.lastOut === null ? this.start : this.lastOut)) / 1000)
    this.src.set('session.clock_s', Math.floor((now - this.start) / 1000))
    if (now - this.lastSample < SAMPLE_MS) return
    this.lastSample = now
    this.sample(now)
  }

  sample (now) {
    const pids = tree(this.pid)
    const ticks = pids.reduce((a, p) => a + cpuTicks(p), 0)
    if (this.prevTicks !== null && now > this.prevAt) {
      const pct = ((ticks - this.prevTicks) / TICKS) / ((now - this.prevAt) / 1000) * 100
      this.src.set('proc.cpu_pct', Math.max(0, pct))
    }
    this.prevTicks = ticks
    this.prevAt = now
    this.src.set('proc.mem_mb', pids.reduce((a, p) => a + rssBytes(p), 0) / 1048576)
  }
}

function create (ctx) {
  return new Generic(ctx.bus, ctx.clock)
}

module.exports = { Generic, create }
