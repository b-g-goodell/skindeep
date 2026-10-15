'use strict'
// Codex rollout discovery (decision 0013). The one reader of
// $CODEX_HOME/sessions: which rollout is this session's, and which
// rollouts are its subagents'. Routes, first hit wins: a thread id in
// argv, a rollout the child tree holds open, then a cwd-matched top-level
// rollout: without `resume` in argv the first one created after launch,
// with it the one created before launch and written after. `fork <id>`
// makes a new thread, so its id names the source, never ours, and a fork
// takes the first route of a new session.

const fs = require('fs')
const os = require('os')
const path = require('path')
const { tree } = require('../proc')

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const GRACE_MS = 2000
const ACTIVE_MS = 20000

// The first line, read to its newline (or to the end of the file), as
// { meta, complete }: meta parsed or null, complete once the newline is
// written.
function firstLine (file) {
  let fd
  const parts = []
  let complete = false
  try {
    fd = fs.openSync(file, 'r')
    const buf = Buffer.alloc(64 * 1024)
    let pos = 0
    let n
    while ((n = fs.readSync(fd, buf, 0, buf.length, pos)) > 0) {
      const chunk = buf.subarray(0, n)
      const nl = chunk.indexOf(10)
      parts.push(Buffer.from(nl >= 0 ? chunk.subarray(0, nl) : chunk))
      if (nl >= 0) { complete = true; break }
      pos += n
    }
  } catch (e) {
    return { meta: null, complete: false }
  } finally {
    if (fd !== undefined) fs.closeSync(fd)
  }
  try {
    return { meta: JSON.parse(Buffer.concat(parts).toString('utf8')), complete }
  } catch (e) {
    return { meta: null, complete }
  }
}

// A top-level thread, not a subagent's. The source string varies (cli,
// vscode when the TUI runs through the shared app-server daemon).
function topLevel (meta) {
  const s = meta && meta.payload && meta.payload.source
  return !!s && !(typeof s === 'object' && s.subagent)
}

// When the thread was created: the payload's stamp, which also names the
// file. The line's own timestamp is when it was written, which Codex
// 0.162 does at the thread's first prompt (measured 2026-10-12).
function created (meta) {
  const t = Date.parse(meta.payload.timestamp)
  return isNaN(t) ? Date.parse(meta.timestamp) : t
}

function parentOf (meta) {
  const s = meta && meta.payload && meta.payload.source
  const spawn = s && typeof s === 'object' && s.subagent && s.subagent.thread_spawn
  return (spawn && spawn.parent_thread_id) || null
}

function names (dir, re) {
  try {
    return fs.readdirSync(dir).filter(n => re.test(n))
  } catch (e) {
    return []
  }
}

// Every YYYY/MM/DD date dir under the sessions dir, with its mtime.
// Creating a rollout bumps its date dir's mtime, appending to one does not.
function dateDirs (root) {
  const out = []
  for (const y of names(root, /^\d{4}$/)) {
    for (const m of names(path.join(root, y), /^\d{2}$/)) {
      for (const d of names(path.join(root, y, m), /^\d{2}$/)) {
        const dir = path.join(root, y, m, d)
        try { out.push({ dir, mtime: fs.statSync(dir).mtimeMs }) } catch (e) {}
      }
    }
  }
  return out
}

function rollouts (dir) {
  try {
    return fs.readdirSync(dir).filter(n => n.startsWith('rollout-') && n.endsWith('.jsonl')).map(n => path.join(dir, n))
  } catch (e) {
    return []
  }
}

// A thread id named in argv, as in `codex resume <id>`.
function argvThread (argv) {
  const i = argv.indexOf('resume')
  if (i < 0) return null
  return argv.slice(i + 1).find(a => UUID.test(a)) || null
}

// The session's working root: `-C <dir>` or `--cd <dir>` resolved
// against the app's cwd, else the app's cwd. The last one given wins.
function sessionCwd (argv, cwd) {
  let dir = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') break
    if ((a === '-C' || a === '--cd') && i + 1 < argv.length) dir = argv[++i]
    else if (a.startsWith('--cd=')) dir = a.slice(5)
    else if (/^-C./.test(a)) dir = a.slice(2)
  }
  return dir === null ? cwd : path.resolve(cwd, dir)
}

class Discovery {
  // env: only CODEX_HOME is read. argv: the user's arguments after the
  // command. cwd: the app's cwd. launched: a time taken before spawn.
  constructor ({ env, argv, cwd, launched }) {
    this.given = path.join(env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'sessions')
    this.home = null
    this.resolved = false
    this.argv = argv
    this.cwd = sessionCwd(argv, cwd)
    this.launched = launched
    this.found = null
    this.lines = new Map()
    this.kids = new Map()
  }

  // The parsed first line of `file`, read once for the module's life
  // once its newline is written.
  meta (file) {
    if (this.lines.has(file)) return this.lines.get(file)
    const { meta, complete } = firstLine(file)
    if (complete) this.lines.set(file, meta)
    return meta
  }

  // The sessions dir, resolved once with realpath, since /proc fd links
  // name real paths. A dir that does not exist yet is taken as given and
  // resolved again on the next call.
  resolve () {
    if (this.resolved) return
    try {
      this.home = fs.realpathSync(this.given)
      this.resolved = true
    } catch (e) {
      this.home = path.resolve(this.given)
    }
  }

  // Found { file, thread, how, exact } or Miss { file: null, how: 'none',
  // tried }. how is argv, fd, new, forked or resumed, and only argv and fd
  // are exact. After a Found, the same Found without scanning.
  find (pid) {
    if (this.found) return this.found
    this.resolve()
    const tried = []
    const id = argvThread(this.argv)
    if (id) {
      tried.push('argv')
      const file = this.byId(id)
      if (file) return this.hit(file, id, 'argv', true)
    }
    if (pid) {
      tried.push('fd')
      const hit = this.held(pid)
      if (hit) return this.hit(hit.file, hit.meta.payload.id, 'fd', true)
    }
    const how = this.argv.includes('resume') ? 'resumed' : this.argv.includes('fork') ? 'forked' : 'new'
    tried.push(how)
    const best = how === 'resumed' ? this.resumed() : this.fresh()
    if (best) return this.hit(best.file, best.meta.payload.id, how, false)
    return { file: null, how: 'none', tried }
  }

  // The rollout of thread id, or null.
  byId (id) {
    this.resolve()
    if (typeof id !== 'string' || !UUID.test(id)) return null
    for (const d of dateDirs(this.home)) {
      const file = rollouts(d.dir).find(f => f.endsWith(`-${id}.jsonl`))
      if (file) return file
    }
    return null
  }

  // What file's history is read from first, oldest first, each { file,
  // end }: Codex 0.162.1 writes a fork's first line with history_base,
  // the source thread and the byte its history ends at, and copies none
  // of it. A source can be a fork in turn.
  bases (file) {
    const out = []
    const seen = new Set([file])
    for (let f = file; out.length < 16;) {
      const meta = this.meta(f)
      const b = meta && meta.payload && meta.payload.history_base
      if (!b || typeof b !== 'object' || !(Number.isInteger(b.end_byte_offset) && b.end_byte_offset >= 0)) break
      const from = this.byId(b.thread_id)
      if (!from || seen.has(from)) break
      seen.add(from)
      out.unshift({ file: from, end: b.end_byte_offset })
      f = from
    }
    return out
  }

  hit (file, thread, how, exact) {
    this.found = { file, thread, how, exact }
    return this.found
  }

  // A top-level rollout of the session's cwd.
  mine (meta) {
    return topLevel(meta) && meta.payload.cwd === this.cwd
  }

  // A top-level rollout under the sessions dir that the child tree holds open.
  held (pid) {
    for (const p of tree(pid)) {
      let fds = []
      try { fds = fs.readdirSync(`/proc/${p}/fd`) } catch (e) { continue }
      for (const fd of fds) {
        let target
        try { target = fs.readlinkSync(`/proc/${p}/fd/${fd}`) } catch (e) { continue }
        if (target.startsWith(this.home + path.sep) && /rollout-.*\.jsonl$/.test(target)) {
          const meta = this.meta(target)
          if (topLevel(meta)) return { file: target, meta }
        }
      }
    }
    return null
  }

  // A fresh session's rollout: the one of our cwd whose session_meta line
  // is stamped at or after the launch cut, the earliest such. Only date
  // dirs whose mtime is at or after the cut can hold it.
  fresh () {
    const cut = this.launched - GRACE_MS
    let best = null
    for (const d of dateDirs(this.home)) {
      if (d.mtime < cut) continue
      for (const f of rollouts(d.dir)) {
        const meta = this.meta(f)
        if (!this.mine(meta)) continue
        const stamp = created(meta)
        if (!(stamp >= cut)) continue
        if (!best || stamp < best.stamp) best = { file: f, meta, stamp }
      }
    }
    return best
  }

  // A resumed session's rollout: the one of our cwd stamped before the
  // launch cut and last written at or after it, the most recently written.
  // Every rollout of every date dir is stat'ed, since a resumed rollout is
  // appended in an old date dir.
  resumed () {
    const cut = this.launched - GRACE_MS
    let best = null
    for (const d of dateDirs(this.home)) {
      for (const f of rollouts(d.dir)) {
        let st
        try { st = fs.statSync(f) } catch (e) { continue }
        if (st.mtimeMs < cut) continue
        const meta = this.meta(f)
        if (!this.mine(meta) || !(created(meta) < cut)) continue
        if (!best || st.mtimeMs > best.mtime) best = { file: f, meta, mtime: st.mtimeMs }
      }
    }
    return best
  }

  // Subagent threads of `thread` last written at or after the launch cut,
  // in date dirs whose mtime is at or after it. spawned: those first seen
  // by this call. active: those written within the last 20 s.
  subagents (thread) {
    this.resolve()
    const now = Date.now()
    const cut = this.launched - GRACE_MS
    let spawned = 0
    for (const d of dateDirs(this.home)) {
      if (d.mtime < cut) continue
      for (const f of rollouts(d.dir)) {
        if (this.kids.has(f)) continue
        const meta = this.meta(f)
        if (!this.lines.has(f)) continue
        if (parentOf(meta) !== thread) {
          this.kids.set(f, false)
          continue
        }
        let st
        try { st = fs.statSync(f) } catch (e) { continue }
        if (st.mtimeMs < cut) continue
        this.kids.set(f, true)
        spawned++
      }
    }
    let active = 0
    for (const [f, ours] of this.kids) {
      if (!ours) continue
      try { if (now - fs.statSync(f).mtimeMs < ACTIVE_MS) active++ } catch (e) {}
    }
    return { spawned, active }
  }
}

module.exports = { Discovery }
