'use strict'
// A provider's account balance (decision 0038): one GET of the
// endpoint its table entry names, on the host of the session's own base
// URL, with the key the session's CLI already uses, sent as a header to
// that host alone. No redirect is followed, so the key reaches no other
// host. The key is never logged and never kept: it lives in the request.

const http = require('http')
const https = require('https')

const REFRESH_MS = 300000
const MAX_BYTES = 1048576

// The value at a dotted path of an object, or undefined.
function at (o, p) {
  return p.split('.').reduce((v, k) => v && typeof v === 'object' ? v[k] : undefined, o)
}

function amount (v) {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(v) ? Number(v) : NaN
  return isFinite(n) ? n : null
}

// The endpoint's answer as { available, items }: available 1 when the
// provider says the balance pays for calls, 0 when not, null when it
// does not say. items, one per currency, { key, label, currency,
// amount }, null when none reads.
function parse (spec, body) {
  const list = at(body, spec.list)
  const items = []
  for (const e of Array.isArray(list) ? list : []) {
    const c = at(e, spec.currency)
    const a = amount(at(e, spec.amount))
    if (typeof c !== 'string' || !/^[A-Za-z0-9]{1,8}$/.test(c) || a === null) continue
    const currency = c.toUpperCase()
    if (items.some(i => i.currency === currency)) continue
    items.push({ key: `balance.${currency}`, label: 'balance', currency, amount: a })
  }
  const av = spec.available ? at(body, spec.available) : undefined
  return { available: typeof av === 'boolean' ? (av ? 1 : 0) : null, items: items.length ? items : null }
}

// One GET of a JSON object from origin, the key sent as spec.auth says.
function get (origin, spec, key, timeoutMs = 15000) {
  const mod = origin.scheme === 'http' ? http : https
  const headers = { Accept: 'application/json', 'User-Agent': 'claude-skins', Authorization: `Bearer ${key}` }
  return new Promise((resolve, reject) => {
    const req = mod.request({ host: origin.host === '[::1]' ? '::1' : origin.host, port: origin.port || undefined, path: spec.path, method: 'GET', headers, timeout: timeoutMs }, res => {
      const chunks = []
      let size = 0
      res.on('data', d => {
        size += d.length
        if (size > MAX_BYTES) req.destroy(new Error('too large'))
        else chunks.push(d)
      })
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode > 299) return reject(new Error(`HTTP ${res.statusCode}`))
        try {
          const v = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          if (!v || typeof v !== 'object' || Array.isArray(v)) return reject(new Error('not an object'))
          resolve(v)
        } catch (e) {
          reject(new Error('not JSON'))
        }
      })
    })
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', e => reject(new Error(['timeout', 'too large'].includes(e.message) ? e.message : 'request failed')))
    req.end()
  })
}

// The readings of every session, one read per account at most once per
// refreshMs, while a session asks. An account is the provider, the
// origin and the profile that holds the key, so two tabs of one profile
// share a read. read(): { available, items } or a rejection.
class Balances {
  constructor ({ now = Date.now, refreshMs = REFRESH_MS, log = () => {} } = {}) {
    Object.assign(this, { now, refreshMs, log })
    this.accounts = new Map()
  }

  // The account's entry { value, version, error, reads }: value null
  // until a read succeeds, and null again after one fails.
  get (id, read, log = this.log) {
    const now = this.now()
    let a = this.accounts.get(id)
    if (!a || (!a.pending && now - a.at >= this.refreshMs)) {
      a = a || { at: now, pending: null, value: null, version: 0, error: null, reads: 0 }
      a.at = now
      a.reads++
      a.pending = Promise.resolve().then(read).then(v => {
        a.value = v
        a.error = null
        log(`provider balance: ${id}: read`)
      }, e => {
        a.value = null
        a.error = e.message
        log(`provider balance: ${id}: no reading (${e.message})`)
      }).then(() => { a.pending = null; a.version++ })
      this.accounts.set(id, a)
    }
    return a
  }
}

module.exports = { parse, get, at, Balances, REFRESH_MS }
