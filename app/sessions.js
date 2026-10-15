'use strict'
// The live agent sessions of this user on the machine (decision 0027),
// from /proc: every process named claude or codex, or a node running a
// script of that name as an npm install does, but Codex's daemons and
// the CLI an npm wrapper runs, with its folder, its start and its
// command line.
// A process's environment is never read, nor any record a CLI keeps of
// its login: those can hold a key. Of Claude Code's record of a running
// session, three fields are kept (claudeRecord). A session's transcript
// or rollout is found among the profiles this user chose (decision
// 0025), by that record, else by name, folder and time.

const fs = require('fs')
const path = require('path')
const { Discovery } = require('./metrics/codex/discovery')

const KINDS = ['claude', 'codex']
const DAEMONS = ['app-server', 'mcp-server']
const TICKS = 100
const GRACE_MS = 2000

function read (p) {
  try { return fs.readFileSync(p, 'utf8') } catch (e) { return null }
}

let boot = null
function bootMs () {
  if (boot === null) {
    const m = /^btime (\d+)$/m.exec(read('/proc/stat') || '')
    boot = m ? Number(m[1]) * 1000 : 0
  }
  return boot
}

// comm, parent and start time of pid, in ms and in clock ticks since
// boot, null when it is gone.
function stat (pid) {
  const s = read(`/proc/${pid}/stat`)
  if (!s) return null
  const close = s.lastIndexOf(')')
  const f = s.slice(close + 2).split(' ')
  return { comm: s.slice(s.indexOf('(') + 1, close), ppid: Number(f[1]), started: bootMs() + Number(f[19]) * 1000 / TICKS, ticks: f[19] }
}

function argvOf (pid) {
  const raw = read(`/proc/${pid}/cmdline`)
  return raw ? raw.split('\0').filter((s, i, a) => i < a.length - 1 || s) : []
}

// pid's ancestors, its parent first.
function ancestors (pid) {
  const out = []
  for (let p = pid; out.length < 256;) {
    const s = stat(p)
    if (!s || s.ppid <= 1) break
    out.push(p = s.ppid)
  }
  return out
}

// The same process: alive, and started when it was seen.
function same (pid, started) {
  const s = stat(pid)
  return !!s && Math.abs(s.started - started) < 1000
}

// The agent a process runs, or null.
function kindOf (comm, argv) {
  if (KINDS.includes(comm)) return comm
  const script = comm === 'node' && argv[1] ? path.basename(argv[1]) : null
  return KINDS.includes(script) ? script : null
}

// Every live session of uid, the newest first: { pid, kind, started,
// cwd, argv }. A process whose parent is a session of its own agent is
// that session, as the native codex an npm codex runs, and is left out.
function scan (uid = process.getuid()) {
  let names
  try { names = fs.readdirSync('/proc') } catch (e) { return [] }
  const out = []
  for (const n of names) {
    if (!/^\d+$/.test(n)) continue
    try { if (fs.statSync(`/proc/${n}`).uid !== uid) continue } catch (e) { continue }
    const pid = Number(n)
    const s = stat(pid)
    if (!s || (s.comm !== 'node' && !KINDS.includes(s.comm))) continue
    const argv = argvOf(pid)
    const kind = kindOf(s.comm, argv)
    if (!kind || (kind === 'codex' && argv.some(a => DAEMONS.includes(a)))) continue
    let cwd
    try { cwd = fs.readlinkSync(`/proc/${n}/cwd`) } catch (e) { continue }
    out.push({ pid, ppid: s.ppid, kind, started: s.started, cwd, argv })
  }
  const kinds = new Map(out.map(s => [s.pid, s.kind]))
  return out.filter(s => kinds.get(s.ppid) !== s.kind).sort((a, b) => b.started - a.started)
}

// Claude Code keeps a session's transcript in <config dir>/projects/<its
// folder with each character but a letter or a digit a dash>/<id>.jsonl.
const slug = cwd => cwd.replace(/[^A-Za-z0-9]/g, '-')

// Profiles grouped by the real folder they keep their sessions in:
// profiles that link one folder cannot be told apart.
function byRealDir (profiles, sub) {
  const m = new Map()
  for (const p of profiles) {
    let real
    try { real = fs.realpathSync(path.join(p, sub)) } catch (e) { continue }
    if (!m.has(real)) m.set(real, [])
    m.get(real).push(p)
  }
  return m
}

// The one profile of ps that holds session-env/<session>, a folder
// Claude Code makes in the profile itself even when its projects folder
// is linked from another, tested by name alone. Null when none or
// several do.
function holder (ps, session) {
  const holds = ps.filter(p => { try { return fs.statSync(path.join(p, 'session-env', session)).isDirectory() } catch (e) { return false } })
  return holds.length === 1 ? holds[0] : null
}

// Claude Code 2.1.296 keeps <profile>/sessions/<pid>.json while a session
// runs, naming its session id, a /clear's included. Of it only pid,
// sessionId and procStart are kept, every other field is dropped at
// once, and the .key file beside it is never opened (maintainer, 2026-10-12).
// It counts only when it names this process: its pid, and procStart the
// start in /proc/<pid>/stat. { session, profiles } with the profiles
// that share the folder it is in, or null.
function claudeRecord (pid, profiles) {
  const s = stat(pid)
  if (!s) return null
  for (const [real, ps] of byRealDir(profiles, 'sessions')) {
    let r
    try {
      const d = JSON.parse(fs.readFileSync(path.join(real, `${pid}.json`), 'utf8'))
      r = { pid: d.pid, session: d.sessionId, procStart: d.procStart }
    } catch (e) { continue }
    if (r.pid !== pid || String(r.procStart) !== s.ticks) continue
    if (typeof r.session !== 'string' || !/^[A-Za-z0-9-]+$/.test(r.session)) continue
    return { session: r.session, profiles: ps }
  }
  return null
}

// A Claude session's transcript, { file, session, mtime, profile } or
// null. By its record when it has one: that session's transcript in the
// record's profile, file null until Claude Code writes it. Else the one
// of its folder written last since it started, among the profiles, so
// two sessions of one profile in one folder may show each other's. The
// profile is the record's, else the one that holder() names.
function claudeTranscript ({ pid, cwd, started }, profiles) {
  const rec = pid ? claudeRecord(pid, profiles) : null
  if (rec) {
    const profile = rec.profiles.length === 1 ? rec.profiles[0] : holder(rec.profiles, rec.session)
    for (const [real] of byRealDir(rec.profiles, 'projects')) {
      const file = path.join(real, slug(cwd), `${rec.session}.jsonl`)
      try { return { file, session: rec.session, mtime: fs.statSync(file).mtimeMs, profile } } catch (e) {}
    }
    return { file: null, session: rec.session, mtime: 0, profile }
  }
  let best = null
  for (const [real, ps] of byRealDir(profiles, 'projects')) {
    const d = path.join(real, slug(cwd))
    let names = []
    try { names = fs.readdirSync(d) } catch (e) { continue }
    for (const n of names) {
      if (!n.endsWith('.jsonl')) continue
      let m
      try { m = fs.statSync(path.join(d, n)).mtimeMs } catch (e) { continue }
      if (m < started - GRACE_MS || (best && m <= best.mtime)) continue
      best = { file: path.join(d, n), session: n.slice(0, -6), mtime: m }
    }
  }
  if (!best) return null
  return Object.assign(best, { profile: holder(profiles, best.session) })
}

// A Codex session's rollout by the routes of decision 0013, its start as
// the launch, among the homes. { file, session, mtime, profile, how }.
function codexRollout ({ pid, cwd, started, argv }, homes) {
  for (const [, ps] of byRealDir(homes, 'sessions')) {
    const r = new Discovery({ env: { CODEX_HOME: ps[0] }, argv: argv.slice(1), cwd, launched: started }).find(pid)
    if (!r.file) continue
    let m = 0
    try { m = fs.statSync(r.file).mtimeMs } catch (e) {}
    return { file: r.file, session: r.thread, mtime: m, profile: ps.length === 1 ? ps[0] : null, home: ps[0], how: r.how }
  }
  return null
}

// What a session does, from when its channel was written: working
// within 10 s, waiting within 10 min, else idle. Unknown with no channel.
function stateOf (mtime, now) {
  if (!mtime) return 'unknown'
  const ago = now - mtime
  return ago < 10000 ? 'working' : ago < 600000 ? 'waiting' : 'idle'
}

module.exports = { scan, ancestors, same, claudeRecord, claudeTranscript, codexRollout, stateOf, slug }
