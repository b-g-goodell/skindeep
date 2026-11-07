'use strict'
// The provider table (decision 0038): providers.json, one entry per
// provider, so a provider added later is a data change. A session's
// provider is the entry whose hosts hold its base URL's host.
// SKINNED_PROVIDERS names another table, for the live checks.

const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, 'providers.json')
const LOOPBACK = ['127.0.0.1', 'localhost', '[::1]', '::1']
const CLOCK = /^([01][0-9]|2[0-3]):([0-5][0-9])$|^24:00$/

const isStr = v => typeof v === 'string' && v.length > 0

// The entry's faults, an empty list when it is sound.
function faults (p) {
  const out = []
  if (!p || typeof p !== 'object') return ['not an object']
  if (!isStr(p.id) || !/^[a-z0-9_-]+$/.test(p.id)) out.push('id')
  if (!isStr(p.name)) out.push('name')
  if (!Array.isArray(p.hosts) || !p.hosts.length || !p.hosts.every(h => isStr(h) && h === h.toLowerCase())) out.push('hosts')
  if (p.default !== undefined && !['claude', 'codex'].includes(p.default)) out.push('default')
  const b = p.balance
  if (b !== undefined) {
    if (!b || typeof b !== 'object' || !isStr(b.path) || !b.path.startsWith('/')) out.push('balance.path')
    else {
      if (b.auth !== 'bearer') out.push('balance.auth')
      for (const k of ['list', 'currency', 'amount']) if (!isStr(b[k])) out.push(`balance.${k}`)
      if (b.available !== undefined && !isStr(b.available)) out.push('balance.available')
    }
  }
  const s = p.peak
  if (s !== undefined) {
    if (!s || typeof s !== 'object') out.push('peak')
    else {
      if (!Array.isArray(s.days) || !s.days.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) out.push('peak.days')
      if (!Array.isArray(s.hours) || !s.hours.length || !s.hours.every(h => Array.isArray(h) && h.length === 2 && h.every(x => CLOCK.test(x)) && h[0] < h[1])) out.push('peak.hours')
      const hol = s.holidays
      if (hol !== undefined && (!hol || !Number.isInteger(hol.offset_minutes) || !/^\d{4}-\d{2}-\d{2}$/.test(hol.through) || !Array.isArray(hol.dates) || !hol.dates.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d)))) out.push('peak.holidays')
    }
  }
  if (p.default && (p.balance || p.peak)) out.push('a default provider reads nothing')
  return out
}

// The table at file, its unsound entries left out and logged.
function load (file = process.env.SKINNED_PROVIDERS || FILE, log = () => {}) {
  let d
  try { d = JSON.parse(fs.readFileSync(file, 'utf8')) } catch (e) {
    log(`providers: ${file}: ${e.message}`)
    return []
  }
  const list = d && Array.isArray(d.providers) ? d.providers : []
  return list.filter(p => {
    const f = faults(p)
    if (f.length) log(`providers: entry ${p && p.id} left out: ${f.join(', ')}`)
    return !f.length
  })
}

// A base URL's origin { scheme, host, port }, or null: https, or http
// on the loopback host alone.
function origin (url) {
  if (!isStr(url)) return null
  let u
  try { u = new URL(url.trim()) } catch (e) { return null }
  const scheme = u.protocol.slice(0, -1).toLowerCase()
  const host = u.hostname.toLowerCase()
  if (scheme !== 'https' && !(scheme === 'http' && LOOPBACK.includes(host))) return null
  if (u.username || u.password) return null
  return { scheme, host, port: u.port }
}

// The session's provider for a base URL, given the CLI's kind:
// { default: true } for the CLI's own provider (no base URL, or one of a
// default entry's hosts), { default: false, entry, origin } for another
// listed provider, null for a host the table does not list.
function match (table, url, kind) {
  if (url === undefined || url === null) return { default: true, entry: table.find(p => p.default === kind) || null, origin: null }
  const o = origin(url)
  if (!o) return null
  const entry = table.find(p => p.hosts.includes(o.host))
  if (!entry) return null
  if (entry.default) return { default: true, entry, origin: o }
  return { default: false, entry, origin: o }
}

module.exports = { FILE, load, faults, origin, match }
