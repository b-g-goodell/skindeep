'use strict'
// The issue board of a session's project, for the sessions dashboard
// (decision 0029). The project is the git remote origin of the session's
// folder. Its issues are read with the access the user's own Claude Code
// session has, through the same tools: gh for github.com, which keeps
// its login to itself, and for any other host, taken as Gitea, its API
// with the password git's credential helper gives for that host, sent as
// a header to that host alone and dropped after the request. The app
// keeps no token or store of its own. Only counts leave this module.

const { spawn } = require('child_process')
const http = require('http')
const https = require('https')

const DAY_COUNT = 14
const REFRESH_MS = 300000
const PAGE = 50
const PAGES = 10
const LOOPBACK = ['127.0.0.1', 'localhost', '[::1]']

// A host whose last label is a number, decimal or 0x hex, is an IPv4
// address to a resolver: it passes only as canonical dotted decimal.
// Node 24.22.0's checkServerIdentity misjudges the other spellings
// (CVE-2026-106069, CVE-2026-106072, issue #210), and the scp-like form
// and ssh:// and git:// URLs pass them through unchanged.
const OCTET = '(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])'
const IPV4 = new RegExp(`^${OCTET}(\\.${OCTET}){3}$`)
function canonicalHost (host) {
  const last = host.replace(/\.$/, '').split('.').pop()
  return !/^([0-9]+|0x[0-9a-f]*)$/i.test(last) || IPV4.test(host)
}

// A remote URL as { forge, scheme, host, port, owner, repo, key }, or
// null: an https remote, an ssh or scp-like one (its forge on https), or
// an http one on the loopback host alone. Any user or password in the
// URL is dropped.
function parseRemote (url) {
  if (typeof url !== 'string' || !url.trim()) return null
  const u = url.trim()
  let scheme, host, port, path
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) {
    let p
    try { p = new URL(u) } catch (e) { return null }
    const proto = p.protocol.slice(0, -1).toLowerCase()
    host = p.hostname.toLowerCase()
    path = decodeURIComponent(p.pathname)
    if (proto === 'https') {
      scheme = 'https'
      port = p.port
    } else if (proto === 'http') {
      if (!LOOPBACK.includes(host)) return null
      scheme = 'http'
      port = p.port
    } else if (proto === 'ssh' || proto === 'git') {
      scheme = 'https'
      port = ''
    } else {
      return null
    }
  } else {
    const m = /^(?:[^@/\s]+@)?([A-Za-z0-9.-]+):(?!\/)(\S+)$/.exec(u)
    if (!m) return null
    scheme = 'https'
    host = m[1].toLowerCase()
    port = ''
    path = m[2]
  }
  if (!canonicalHost(host)) return null
  const parts = path.replace(/^\/+|\/+$/g, '').replace(/\.git$/, '').split('/')
  if (parts.length !== 2 || !parts.every(s => /^[A-Za-z0-9._-]+$/.test(s))) return null
  const [owner, repo] = parts
  const at = host + (port ? ':' + port : '')
  return { forge: host === 'github.com' ? 'github' : 'gitea', scheme, host, port, owner, repo, key: `${scheme}://${at}/${owner}/${repo}` }
}

// The local midnight that starts the day `d` days after the day of t.
function midnight (t, d = 0) {
  const x = new Date(t)
  return new Date(x.getFullYear(), x.getMonth(), x.getDate() + d).getTime()
}

// issues: [{ created, closed }] in ms, closed null while open. For each
// of the last `days` local days, today last: the issues open at its end
// (now, for today) and the issues closed in it.
function series (issues, now, days = DAY_COUNT) {
  const open = []
  const closed = []
  for (let k = 0; k < days; k++) {
    const start = midnight(now, k - days + 1)
    const end = k === days - 1 ? now + 1 : midnight(now, k - days + 2)
    open.push(issues.filter(i => i.created < end && (i.closed === null || i.closed >= end)).length)
    closed.push(issues.filter(i => i.closed !== null && i.closed >= start && i.closed < end).length)
  }
  return { open, closed, openNow: open[days - 1], closed14: closed.reduce((a, b) => a + b, 0) }
}

// A stamp in ms, null for none: gh gives "" or a zero year for open.
function stamp (s) {
  if (typeof s !== 'string' || !s) return null
  const t = Date.parse(s)
  return isNaN(t) || t < 86400000 ? null : t
}

// git and gh never prompt: no terminal, no askpass program.
function quietEnv (env = process.env) {
  const out = Object.assign({}, env, { GIT_TERMINAL_PROMPT: '0', GH_PROMPT_DISABLED: '1' })
  delete out.GIT_ASKPASS
  delete out.SSH_ASKPASS
  return out
}

// A command's stdout, or an error naming only its exit: stderr is
// dropped unread, since a tool may echo what it was given.
function run (cmd, args, { input = null, timeoutMs = 15000, cwd } = {}) {
  return new Promise((resolve, reject) => {
    let p
    try { p = spawn(cmd, args, { cwd, env: quietEnv(), stdio: ['pipe', 'pipe', 'ignore'] }) } catch (e) { return reject(new Error(`${cmd}: cannot start`)) }
    const chunks = []
    let size = 0
    const timer = setTimeout(() => { try { p.kill('SIGKILL') } catch (e) {} }, timeoutMs)
    p.stdout.on('data', d => {
      size += d.length
      if (size <= 16 * 1048576) chunks.push(d)
    })
    p.on('error', () => { clearTimeout(timer); reject(new Error(`${cmd}: cannot start`)) })
    p.on('close', (code, sig) => {
      clearTimeout(timer)
      if (code === 0) resolve(Buffer.concat(chunks).toString('utf8'))
      else reject(new Error(`${cmd}: ${sig ? 'killed' : 'exit ' + code}`))
    })
    p.stdin.on('error', () => {})
    p.stdin.end(input === null ? '' : input)
  })
}

// The remote origin of a folder, as git itself reads it, or null.
async function remoteOf (folder) {
  try {
    return (await run('git', ['-C', folder, 'remote', 'get-url', 'origin'], { timeoutMs: 5000 })).trim() || null
  } catch (e) {
    return null
  }
}

// The password git's credential helper gives for the remote's host, or
// null. Never logged, never kept.
async function password (r) {
  const host = r.host + (r.port ? ':' + r.port : '')
  let out
  try {
    out = await run('git', ['-c', 'core.askPass=', '-c', 'credential.interactive=never', 'credential', 'fill'], { input: `protocol=${r.scheme}\nhost=${host}\n\n`, timeoutMs: 10000 })
  } catch (e) {
    return null
  }
  const m = /^password=(.*)$/m.exec(out)
  return m && m[1] ? m[1] : null
}

// One GET of a JSON array from the remote's own host, the header given.
// No redirect is followed, so the header reaches no other host.
function getJson (r, path, headers) {
  const mod = r.scheme === 'http' ? http : https
  return new Promise((resolve, reject) => {
    const req = mod.request({ host: r.host === '[::1]' ? '::1' : r.host, port: r.port || undefined, path, method: 'GET', headers: Object.assign({ Accept: 'application/json', 'User-Agent': 'claude-skins' }, headers), timeout: 15000 }, res => {
      const chunks = []
      let size = 0
      res.on('data', d => {
        size += d.length
        if (size > 8 * 1048576) req.destroy()
        else chunks.push(d)
      })
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode > 299) return reject(new Error(`HTTP ${res.statusCode}`))
        try {
          const v = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          if (!Array.isArray(v)) return reject(new Error('not a list'))
          resolve(v)
        } catch (e) {
          reject(new Error('not JSON'))
        }
      })
    })
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', e => reject(new Error(e.message === 'timeout' ? 'timeout' : 'request failed')))
    req.end()
  })
}

// Gitea's issues API, pages of 50 up to 10 pages, with git's password.
async function gitea (r) {
  let token = await password(r)
  if (!token) throw new Error('no login')
  const issues = []
  try {
    for (let page = 1; page <= PAGES; page++) {
      const path = `/api/v1/repos/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.repo)}/issues?state=all&type=issues&limit=${PAGE}&page=${page}`
      const list = await getJson(r, path, { Authorization: `token ${token}` })
      for (const i of list) issues.push({ created: stamp(i.created_at), closed: stamp(i.closed_at) })
      if (list.length < PAGE) break
    }
  } finally {
    token = null
  }
  return issues
}

// gh with the user's login, which gh keeps to itself.
async function github (r) {
  const out = await run('gh', ['issue', 'list', '--repo', `${r.owner}/${r.repo}`, '--state', 'all', '--json', 'createdAt,closedAt', '--limit', '500'], { timeoutMs: 30000 })
  let list
  try { list = JSON.parse(out) } catch (e) { throw new Error('gh: not JSON') }
  if (!Array.isArray(list)) throw new Error('gh: not a list')
  return list.map(i => ({ created: stamp(i.createdAt), closed: stamp(i.closedAt) }))
}

function fetchIssues (r) {
  return r.forge === 'github' ? github(r) : gitea(r)
}

// The boards of a window's sessions, each remote read at most once per
// refreshMs, and only while something asks: get() answers from what is
// known and starts what is due. Every session of one remote shares it.
class Boards {
  constructor ({ log = () => {}, now = Date.now, refreshMs = REFRESH_MS, remote = remoteOf, fetch = fetchIssues } = {}) {
    Object.assign(this, { log, now, refreshMs, remote, fetch })
    this.folders = new Map()
    this.remotes = new Map()
  }

  // What the page draws for a folder: null for no project (no remote, or
  // one no board is read from), { state: 'loading' }, { state: 'no access' },
  // or { state: 'ok', openNow, closed14, open, closed }.
  get (folder) {
    const now = this.now()
    let f = this.folders.get(folder)
    if (!f || (!f.pending && now - f.at >= this.refreshMs)) {
      f = f || { at: now, pending: null, remote: undefined }
      f.at = now
      f.pending = this.remote(folder).then(url => {
        f.remote = parseRemote(url)
        f.pending = null
      }, () => { f.remote = null; f.pending = null })
      this.folders.set(folder, f)
    }
    if (f.remote === undefined) return { state: 'loading' }
    if (!f.remote) return null
    return this.board(f.remote, now)
  }

  board (r, now) {
    let b = this.remotes.get(r.key)
    if (!b || (!b.pending && now - b.at >= this.refreshMs)) {
      b = b || { at: now, pending: null, issues: undefined, error: null, fetches: 0 }
      b.at = now
      b.fetches++
      b.pending = this.fetch(r).then(issues => {
        b.issues = issues.filter(i => i.created !== null)
        b.error = null
        b.pending = null
        this.log(`board: ${r.key}: ${b.issues.length} issues`)
      }, e => {
        b.issues = null
        b.error = e.message
        b.pending = null
        this.log(`board: ${r.key}: no access (${e.message})`)
      })
      this.remotes.set(r.key, b)
    }
    if (b.issues === undefined) return { state: 'loading' }
    if (b.issues === null) return { state: 'no access' }
    return Object.assign({ state: 'ok' }, series(b.issues, now))
  }

  // For the live checks: each remote and how often it was read.
  report () {
    return [...this.remotes].map(([key, b]) => ({ key, fetches: b.fetches, error: b.error }))
  }
}

module.exports = { Boards, parseRemote, series, stamp, DAY_COUNT, REFRESH_MS }
