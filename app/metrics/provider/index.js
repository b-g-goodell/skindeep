'use strict'
// The provider part of a Claude or Codex session (decision 0038), a
// part at the adapter seam beside the CLI's adapter and Generic
// (decision 0021). On a provider the table lists and that is not the
// CLI's own, it writes the provider's readings: its peak price state,
// computed here, and its balance, read from its account endpoint at
// most once per 5 minutes. On the CLI's own provider, or a host the
// table does not list, it writes nothing and reads nothing.

const table = require('./table')
const detect = require('./detect')
const peak = require('./peak')
const balance = require('./balance')

const PEAK_MS = 60000

// One cache of reads for the app: tabs of one account share a read.
const shared = new balance.Balances()

class ProviderPart {
  constructor (ctx, kind, { providers, balances }) {
    Object.assign(this, { ctx, kind, providers, balances })
    this.log = ctx.log || (() => {})
    this.entry = null
    this.origin = null
    this.src = null
    this.closed = false
    this.peakAt = -Infinity
    this.peakUntil = null
    this.version = 0
    this.reading = false
  }

  async prepare () {
    const d = detect.of(this.kind, this.ctx)
    if (!d || this.closed) return { args: [], notice: null }
    const base = d.base()
    const m = table.match(this.providers(), base, this.kind)
    if (!m || m.default) {
      if (!m) this.log(`provider: ${this.kind} session on a host no provider lists: no provider readings`)
      return { args: [], notice: null }
    }
    this.entry = m.entry
    this.origin = m.origin
    this.detect = d
    this.account = `${m.entry.id} ${m.origin.scheme}://${m.origin.host}${m.origin.port ? ':' + m.origin.port : ''} ${d.profile}`
    this.src = this.ctx.bus.source({})
    this.log(`provider: ${this.kind} session on ${m.entry.name} (${m.origin.host}): peak ${m.entry.peak ? 'on' : 'off'}, balance ${m.entry.balance ? 'on' : 'off'}`)
    return { args: [], notice: null }
  }

  attach () {}

  // One read of the balance. The key lives in this call alone.
  async read () {
    let key = await this.detect.key()
    if (!key) throw new Error('no key')
    try {
      return balance.parse(this.entry.balance, await balance.get(this.origin, this.entry.balance, key))
    } finally {
      key = null
    }
  }

  poll (now) {
    if (!this.entry || this.closed) return
    const e = this.entry
    if (e.peak && (now - this.peakAt >= PEAK_MS || (this.peakUntil !== null && now >= this.peakUntil * 1000))) {
      this.peakAt = now
      const s = peak.state(e.peak, now)
      this.peakUntil = s ? s.changes_at : null
      this.src.set('limits.peak', s ? s.peak : null)
      this.src.set('limits.peak_changes_at', s ? s.changes_at : null)
    }
    if (e.balance) {
      const a = this.balances.get(this.account, () => this.read(), this.log)
      if (a.version !== this.version) {
        this.version = a.version
        this.reading = !!a.value
        this.src.set('limits.balances', a.value ? a.value.items : null)
        this.src.set('limits.balance_available', a.value ? a.value.available : null)
      }
    }
  }

  // A balance channel, live once a read gave a reading.
  report () {
    const e = this.entry
    if (!e || !e.balance) return { channels: [] }
    const o = this.origin
    return { channels: [{ name: 'balance', state: this.reading ? 'live' : 'waiting', target: `${o.scheme}://${o.host}${o.port ? ':' + o.port : ''}${e.balance.path}`, how: e.id }] }
  }

  close () {
    this.closed = true
    if (this.src) this.src.close()
  }
}

// ctx as the seam's open takes it. kind: claude or codex. providers: a
// function giving the table, balances: the cache, for the tests.
function create (ctx, kind, { providers = () => table.load(undefined, ctx.log), balances = shared } = {}) {
  return new ProviderPart(ctx, kind, { providers, balances })
}

module.exports = { create, ProviderPart }
