'use strict'
// The profiles New tab... offers (decision 0025). A profile is a config
// dir: CLAUDE_CONFIG_DIR of Claude Code, CODEX_HOME of Codex (decision
// 0003). Each profile a tab was opened on is recorded in a file of its
// own, <dir>/<agent>-<hash>, by write and rename, as the last skins are
// (decision 0022), so no two windows write one file. The scan of the
// home directory reads directory listings, never a file's contents.

const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')

const AGENTS = {
  claude: { name: 'Claude Code', cmd: 'claude', variable: 'CLAUDE_CONFIG_DIR', dflt: '.claude' },
  codex: { name: 'Codex', cmd: 'codex', variable: 'CODEX_HOME', dflt: '.codex' }
}

const NAME = /^(claude|codex)-[0-9a-f]{16}$/

function dir (env = process.env) {
  return path.join(env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state'), 'claude-skins', 'profiles')
}

function defaultDir (agent) {
  return path.join(os.homedir(), AGENTS[agent].dflt)
}

// The profile a tab of `agent` runs on under env.
function of (env, agent) {
  const v = env[AGENTS[agent].variable]
  return v ? path.resolve(v) : defaultDir(agent)
}

// The environment of a tab of `agent` on profile p: the variable set,
// or unset for the default profile even when env sets it.
function envFor (env, agent, p) {
  const out = Object.assign({}, env)
  const v = AGENTS[agent].variable
  if (path.resolve(p) === defaultDir(agent)) delete out[v]
  else out[v] = path.resolve(p)
  return out
}

function file (d, agent, p) {
  return path.join(d, `${agent}-${crypto.createHash('sha256').update(p).digest('hex').slice(0, 16)}`)
}

function record (d, agent, p, now = Date.now()) {
  fs.mkdirSync(d, { recursive: true })
  const f = file(d, agent, p)
  const tmp = path.join(d, `.${path.basename(f)}.${process.pid}.tmp`)
  fs.writeFileSync(tmp, JSON.stringify({ t: now, agent, dir: p }) + '\n')
  fs.renameSync(tmp, f)
}

// Every record, newest first. A file that is not a record is skipped.
function read (d) {
  let names
  try { names = fs.readdirSync(d) } catch (e) { return [] }
  const out = []
  for (const n of names.filter(n => NAME.test(n))) {
    try {
      const r = JSON.parse(fs.readFileSync(path.join(d, n), 'utf8'))
      if (typeof r.t === 'number' && AGENTS[r.agent] && typeof r.dir === 'string' && path.isAbsolute(r.dir)) out.push({ t: r.t, agent: r.agent, dir: r.dir })
    } catch (e) {}
  }
  return out.sort((a, b) => b.t - a.t)
}

function forget (d, agent, p) {
  fs.rmSync(file(d, agent, p), { force: true })
}

// A config dir is told by the names it holds. Claude Code: its
// .credentials.json, or a .claude.json beside its projects, sessions or
// settings.json. Codex: its auth.json beside its config.toml, sessions or
// history.jsonl.
function kindOfDir (names) {
  if (names.has('.credentials.json') || (names.has('.claude.json') && ['projects', 'sessions', 'settings.json'].some(n => names.has(n)))) return 'claude'
  if (names.has('auth.json') && ['config.toml', 'sessions', 'history.jsonl'].some(n => names.has(n))) return 'codex'
  return null
}

const SKIP = new Set(['.git', 'node_modules', '.cache'])

// Every config dir under root, at most `depth` levels below it, root
// itself excepted. Breadth first, symlinks not followed, a config dir not
// entered, at most `cap` dirs listed. Sorted by path.
function scan (root, { depth = 4, cap = 20000 } = {}) {
  const out = []
  let level = [root]
  let listed = 0
  for (let d = 0; d <= depth && level.length; d++) {
    const next = []
    for (const p of level) {
      if (listed++ >= cap) return out.sort((a, b) => a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0)
      let ents
      try { ents = fs.readdirSync(p, { withFileTypes: true }) } catch (e) { continue }
      const agent = d > 0 && kindOfDir(new Set(ents.map(e => e.name)))
      if (agent) { out.push({ agent, dir: p }); continue }
      if (d < depth) for (const e of ents) if (e.isDirectory() && !SKIP.has(e.name)) next.push(path.join(p, e.name))
    }
    level = next
  }
  return out.sort((a, b) => a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0)
}

// What New tab... lists for `agent`, each profile once: the default, the
// profiles of the open tabs in tab order, those recorded, newest first,
// then those the scan found. open: profile dirs. remembered: a record
// exists, so it can be forgotten.
function list (agent, records, open, found = []) {
  const mine = records.filter(r => r.agent === agent).map(r => r.dir)
  const seen = found.filter(r => r.agent === agent).map(r => r.dir)
  const out = []
  for (const p of [defaultDir(agent), ...open, ...mine, ...seen]) {
    if (out.some(e => e.dir === p)) continue
    out.push({ dir: p, isDefault: p === defaultDir(agent), remembered: mine.includes(p) })
  }
  return out
}

module.exports = { AGENTS, dir, defaultDir, of, envFor, record, read, forget, scan, list }
