'use strict'
// The snapshots New tab... offers (decision 0037): the agent
// configurations select-agent-config keeps, each a tree bound over the
// canonical paths by bwrap. A tab in a snapshot runs its command line
// through the tool's own shell form, `select-agent-config shell ID --
// WORDS`, which joins the words and hands them to the snapshot's
// interactive bash, so each word is quoted first. The host sees the
// live tree where the snapshot's processes see the snapshot's, so a path
// a payload names is mapped back through the binds before it is read.

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { split } = require('./argv')
const { quote } = require('./identity')
const cli = require('./cli')

const TOOL = 'select-agent-config'
const TIMEOUT_MS = 15000
const BIND_FLAGS = new Set(['--bind', '--ro-bind', '--dev-bind'])
const MAX_LINKS = 40

// The tool on PATH, else null.
function tool (env = process.env) {
  return cli.resolveCommand(TOOL, env.PATH)
}

function run (file, args, env) {
  return execFileSync(file, args, { env, encoding: 'utf8', timeout: TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'] })
}

// The rows of `select-agent-config list`: id, lineage, accounts axis,
// creation time and name, tab separated. A malformed row is skipped.
function parseList (text) {
  const out = []
  for (const line of String(text).split('\n')) {
    const f = line.split('\t')
    if (f.length < 5 || !f[0]) continue
    out.push({ id: f[0], lineage: f[1], accounts: f[2], created: f[3], name: f.slice(4).join('\t') })
  }
  return out
}

// The binds of the tool's `argv ID` line, in bwrap's order: each
// { src, dst }, where dst is the path inside the snapshot and src the
// host's. Null when the line is not a bwrap command.
function parseBinds (text) {
  const r = split(String(text).trim())
  if (r.error || path.basename(r.argv[0]) !== 'bwrap') return null
  const out = []
  for (let i = 1; i + 2 < r.argv.length; i++) {
    if (BIND_FLAGS.has(r.argv[i])) out.push({ src: r.argv[i + 1], dst: r.argv[i + 2] })
  }
  return out
}

// Every snapshot the tool lists, oldest first, or [] when the tool is
// missing or fails. log takes the failure.
function list (env = process.env, log = () => {}) {
  const t = tool(env)
  if (!t) return []
  try {
    return parseList(run(t, ['list'], env))
  } catch (e) {
    log(`${TOOL} list: ${e.message}`)
    return []
  }
}

// The binds of snapshot id, or null when the tool refuses or its line
// is not bwrap's.
function binds (id, env = process.env, log = () => {}) {
  const t = tool(env)
  if (!t) return null
  try {
    return parseBinds(run(t, ['argv', id], env))
  } catch (e) {
    log(`${TOOL} argv ${id}: ${e.message}`)
    return null
  }
}

// The words a tab in snapshot id runs: the shell form, each word of the
// command quoted so the joined line splits back into the same words.
function wrap (id, cmd) {
  return [TOOL, 'shell', id, '--', ...cmd.map(quote)]
}

// The variables the tool scrubs from what it launches, every CLAUDE*
// one and CODEX_HOME, so a tab's own view of its environment, its label
// and the settings it chains, is the snapshot's and not the window's.
const SCRUBBED = /^(CLAUDE|CODEX_HOME)/

function scrub (env) {
  const out = {}
  for (const [k, v] of Object.entries(env)) if (!SCRUBBED.test(k)) out[k] = v
  return out
}

// The host's path of p, a path under the binds alone: the last bind
// whose dst holds p wins, as bwrap mounts in order.
function mapOnly (p, binds) {
  let best = null
  for (const b of binds) {
    const dst = b.dst.replace(/\/+$/, '') || '/'
    if (p === dst || dst === '/' || p.startsWith(dst + '/')) best = { src: b.src, dst }
  }
  if (!best) return p
  const rel = best.dst === '/' ? p.slice(1) : p.slice(best.dst.length + 1)
  return rel ? path.join(best.src, rel) : best.src
}

// The host's path of p, an absolute path as a process inside the
// snapshot names it: each component is mapped through the binds, and a
// symlink met on the way is followed as the snapshot resolves it, its
// target mapped in turn. An unreadable component is mapped as it is.
function outside (p, binds, depth = 0) {
  if (!binds || !binds.length) return p
  const parts = path.resolve(p).split('/').filter(Boolean)
  let inside = '/'
  for (let i = 0; i < parts.length; i++) {
    const next = path.join(inside, parts[i])
    let link = null
    try {
      const host = mapOnly(next, binds)
      if (fs.lstatSync(host).isSymbolicLink()) link = fs.readlinkSync(host)
    } catch (e) {}
    if (link !== null && depth < MAX_LINKS) {
      return outside(path.join(path.resolve(inside, link), ...parts.slice(i + 1)), binds, depth + 1)
    }
    inside = next
  }
  return mapOnly(inside, binds)
}

// What the chooser shows for a row.
function describe (s) {
  const origin = s.lineage === 'fresh' ? 'fresh install' : s.lineage === 'current' ? 'fork of the live configuration' : s.lineage
  return `${s.name}  (${origin}, ${s.accounts} accounts)`
}

module.exports = { TOOL, tool, parseList, parseBinds, list, binds, wrap, scrub, outside, describe }
