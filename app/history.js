'use strict'
// The sessions dashboard's history (decision 0028): one sample of each
// session's meters per tick, a ring of `points` ticks, in memory only.
// Every session's series is aligned to the ticks, null where it had no
// data or did not run. A session that ends keeps its row, marked ended,
// for keepEndedMs. A row's breaks mark the ticks where the agent began
// another session (/clear, /resume), whose totals are not a rise.

// The meters a row draws, by bus name (decision 0011). tokens is the
// output: input counts every request's whole context again. The dials
// (decision 0033) are more series, keyed by their bus name.
const METRICS = { tools: 'tools.total', tokens: 'tokens.out', cost: 'cost.usd', context: 'context.used_pct', compactions: 'session.compactions' }

const num = v => typeof v === 'number' && isFinite(v) ? v : null

// What a bus snapshot gives each metric, and each dial.
function pick (snapshot, dials = []) {
  const out = {}
  for (const [k, name] of Object.entries(METRICS)) out[k] = num(snapshot[name])
  for (const name of dials) out[name] = num(snapshot[name])
  return out
}

class History {
  // intervalMs: the time between ticks, for the per-minute rates.
  constructor ({ points = 720, keepEndedMs = 600000, intervalMs = 5000 } = {}) {
    Object.assign(this, { points, keepEndedMs, intervalMs })
    this.ticks = []
    this.rows = new Map()
    this.dials = []
  }

  // The series every row keeps.
  keys () {
    return [...Object.keys(METRICS), ...this.dials]
  }

  // The dials open now (decision 0033). A new one starts as no data over
  // the ticks so far, a closed one is dropped.
  setDials (names) {
    const next = [...new Set(names)].filter(n => !(n in METRICS))
    for (const r of this.rows.values()) {
      for (const n of this.dials) if (!next.includes(n)) delete r.series[n]
      for (const n of next) if (!r.series[n]) r.series[n] = new Array(this.ticks.length).fill(null)
    }
    this.dials = next
  }

  // samples: Map key -> { values, meta, session }, session the agent's
  // session id or null. A known key absent from it has ended.
  tick (now, samples) {
    this.ticks.push(now)
    for (const [key, { values, meta, session = null }] of samples) {
      let r = this.rows.get(key)
      if (!r || r.ended !== null) {
        r = { meta, ended: null, session: null, breaks: new Array(this.ticks.length - 1).fill(false), series: {} }
        for (const k of this.keys()) r.series[k] = new Array(this.ticks.length - 1).fill(null)
        this.rows.set(key, r)
      }
      r.meta = meta
      r.breaks.push(!!(session && r.session && session !== r.session))
      if (session) r.session = session
      for (const k of this.keys()) r.series[k].push(num(values[k]))
    }
    for (const [key, r] of this.rows) {
      if (samples.has(key)) continue
      if (r.ended === null) r.ended = now
      if (now - r.ended > this.keepEndedMs) {
        this.rows.delete(key)
        continue
      }
      r.breaks.push(false)
      for (const k of this.keys()) r.series[k].push(null)
    }
    if (this.ticks.length > this.points) {
      const cut = this.ticks.length - this.points
      this.ticks.splice(0, cut)
      for (const r of this.rows.values()) {
        r.breaks.splice(0, cut)
        for (const s of Object.values(r.series)) s.splice(0, cut)
      }
    }
  }

  // Each tick's rise of a counting series over the last minute, never
  // scaled: before a minute of samples exists, the time before the first
  // counts as no rise (maintainer, 2026-10-12). 0 where the series fell or had
  // no data. The minute never reaches back past a break.
  perMinute (s, breaks = []) {
    const n = Math.max(1, Math.round(60000 / this.intervalMs))
    let from = 0
    return s.map((v, i) => {
      if (breaks[i]) from = i
      if (v === null) return 0
      let j = Math.max(from, i - n)
      while (j < i && s[j] === null) j++
      if (j === i) return 0
      return Math.max(0, v - s[j])
    })
  }

  // What the page draws: the ticks, the sums across the sessions that
  // ran, the dials open, and each row. Numbers, metric names and the
  // menu's own strings only.
  view () {
    const n = this.ticks.length
    const across = { tokensPerMin: new Array(n).fill(0), toolsPerMin: new Array(n).fill(0), cost: new Array(n).fill(0) }
    const rows = []
    for (const [key, r] of this.rows) {
      const tok = this.perMinute(r.series.tokens, r.breaks)
      const tools = this.perMinute(r.series.tools, r.breaks)
      for (let i = 0; i < n; i++) {
        across.tokensPerMin[i] += tok[i]
        across.toolsPerMin[i] += tools[i]
        across.cost[i] += r.series.cost[i] || 0
      }
      rows.push(Object.assign({ key, ended: r.ended !== null, series: r.series }, r.meta))
    }
    return { ticks: this.ticks.slice(), intervalMs: this.intervalMs, across, dials: this.dials.slice(), rows }
  }
}

module.exports = { History, METRICS, pick }
