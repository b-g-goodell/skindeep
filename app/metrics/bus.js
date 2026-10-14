'use strict'
// Named metrics. A value is a number, a string, or null for no data.
// Event metrics are counters that only increase (decision 0011).
// The bus is read through get, snapshot and drainEvents. The only way
// to write is a source (the writer), which owns the rate windows,
// default seeding, the session reset and the name check.

const { known } = require('./names')

// Rate name -> window and unit, both in ms: value = sum of the samples
// in the window * per / window.
const RATES = {
  'tokens.out_rate': { window: 10000, per: 1000 },
  'tools.rate': { window: 60000, per: 60000 },
  'pty.out_bps': { window: 1000, per: 1000 },
  'pty.in_kps': { window: 1000, per: 1000 }
}

// What a new session forgets. event.*, model.name and limits.* survive.
const SESSION_PREFIXES = ['context.', 'tokens.', 'cost.', 'lines.', 'tools.', 'agents.', 'cache.', 'state.', 'session.compactions']

class Bus {
  constructor ({ log } = {}) {
    this.values = new Map()
    this.events = []
    this.sources = []
    this.log = log || (() => {})
    this.refused = new Set()
  }

  drainEvents () {
    const e = this.events
    this.events = []
    return e
  }

  get (name) {
    return this.values.get(name)
  }

  snapshot () {
    return Object.fromEntries(this.values)
  }

  // A write handle for one channel. defaults: { name: value } seeded at
  // begin() and reset(). rates: names of RATES this source samples.
  source ({ defaults = {}, rates = [] } = {}) {
    const s = new Source(this, defaults, rates)
    this.sources.push(s)
    return s
  }

  // Recompute every rate of every live source at time now (ms).
  tick (now) {
    for (const s of this.sources) s.tick(now)
  }

  // True when name may be written. A refused name is logged once.
  accepts (name) {
    if (known(name)) return true
    if (!this.refused.has(name)) {
      this.refused.add(name)
      this.log(`metric name refused: ${name}`)
    }
    return false
  }
}

// The raw writes, for sources alone.
function put (bus, name, value) {
  bus.values.set(name, value === undefined ? null : value)
}

function bump (bus, name, delta) {
  const v = bus.values.get(name)
  bus.values.set(name, (typeof v === 'number' ? v : 0) + delta)
}

// Forget every metric whose name starts with one of the prefixes.
function forget (bus, prefixes) {
  for (const k of [...bus.values.keys()]) {
    if (prefixes.some(p => k.startsWith(p))) bus.values.delete(k)
  }
}

// Session events for the visualization: numeric kind and class only.
function emit (bus, kind, cls) {
  bus.events.push(kind, cls)
  if (bus.events.length > 512) bus.events.splice(0, bus.events.length - 512)
}

class Source {
  constructor (bus, defaults, rates) {
    this.bus = bus
    this.defaults = defaults
    this.rates = rates.filter(r => RATES[r] && bus.accepts(r))
    this.windows = new Map()
    this.pending = new Map()
    this.begun = false
    this.closed = false
    this.clear()
  }

  clear () {
    for (const r of this.rates) {
      this.windows.set(r, [])
      this.pending.set(r, 0)
    }
  }

  // Unset defaults take their value, unset rates read 0.
  seed () {
    for (const [k, v] of Object.entries(this.defaults)) {
      if (this.bus.get(k) === undefined && this.bus.accepts(k)) put(this.bus, k, v)
    }
    for (const r of this.rates) if (this.bus.get(r) === undefined) put(this.bus, r, 0)
  }

  // The channel is live.
  begin () {
    if (this.begun || this.closed) return
    this.begun = true
    this.seed()
  }

  set (name, value) {
    if (!this.closed && this.bus.accepts(name)) put(this.bus, name, value)
  }

  add (name, n) {
    if (!this.closed && this.bus.accepts(name)) bump(this.bus, name, n)
  }

  pulse (name) {
    this.add(name, 1)
  }

  event (kind, cls = 0, { history = false } = {}) {
    if (!this.closed && !history) emit(this.bus, kind, cls)
  }

  // amount counts in the name's window from the next tick on.
  sample (name, amount, { history = false } = {}) {
    if (this.closed || history || !this.pending.has(name)) return
    this.pending.set(name, this.pending.get(name) + amount)
  }

  // A new session: forget its names, empty the windows, and reseed now.
  reset () {
    if (this.closed) return
    forget(this.bus, SESSION_PREFIXES)
    this.clear()
    if (this.begun) this.seed()
  }

  close () {
    this.closed = true
  }

  tick (now) {
    if (!this.begun || this.closed) return
    for (const r of this.rates) {
      const { window, per } = RATES[r]
      const w = this.windows.get(r)
      const p = this.pending.get(r)
      if (p) w.push([now, p])
      this.pending.set(r, 0)
      while (w.length && w[0][0] <= now - window) w.shift()
      put(this.bus, r, w.reduce((a, [, n]) => a + n, 0) * per / window)
    }
  }
}

// Event kinds and tool classes of the visualization feed (decision 0015).
const EVENT = { output: 1, tool: 2, prompt: 3, stop: 4, agent: 5, compact: 6 }

module.exports = { Bus, EVENT, RATES, SESSION_PREFIXES }
