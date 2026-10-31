'use strict'
// Which provider a session runs on, and the key its CLI sends there
// (decision 0038). Claude Code: ANTHROPIC_BASE_URL of the profile's
// settings env, else of the child's environment. Codex: the base_url of
// the model_providers entry its config.toml makes active. A key is read
// only when a listed provider with a balance endpoint matched, at each
// read, and is never kept.

const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')
const settings = require('../claude/settings')

// --- Claude Code ---

const KEYS = ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY']

function claudeOpts (ctx) {
  return { env: ctx.env, cwd: ctx.cwd, argv: ctx.cmd.slice(1), outside: ctx.outside, managedDir: ctx.managedDir }
}

// The session's base URL, or null for Anthropic's own.
function claudeBase (ctx) {
  const s = settings.envOf(claudeOpts(ctx), ['ANTHROPIC_BASE_URL']).env.ANTHROPIC_BASE_URL
  const v = s !== undefined ? s : ctx.env.ANTHROPIC_BASE_URL
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

// The key Claude Code sends, in its order: ANTHROPIC_AUTH_TOKEN, then
// ANTHROPIC_API_KEY, each from the settings env, then the child's
// environment, then the output of the settings' apiKeyHelper, run as
// Claude Code runs it. Resolves null when there is none.
async function claudeKey (ctx) {
  const s = settings.envOf(claudeOpts(ctx), KEYS)
  for (const k of KEYS) {
    const v = s.env[k] !== undefined ? s.env[k] : ctx.env[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  if (!s.apiKeyHelper) return null
  return helper(s.apiKeyHelper, ctx)
}

// The helper's first line of output, or null. No terminal and no
// askpass program, so it cannot prompt in the app. stderr is dropped
// unread.
function helper (command, ctx, timeoutMs = 10000) {
  const env = Object.assign({}, ctx.env, { GIT_TERMINAL_PROMPT: '0' })
  delete env.SSH_ASKPASS
  delete env.GIT_ASKPASS
  return new Promise(resolve => {
    let p
    try { p = spawn('/bin/sh', ['-c', command], { cwd: ctx.cwd, env, stdio: ['ignore', 'pipe', 'ignore'] }) } catch (e) { return resolve(null) }
    const chunks = []
    let size = 0
    const timer = setTimeout(() => { try { p.kill('SIGKILL') } catch (e) {} }, timeoutMs)
    p.stdout.on('data', d => { size += d.length; if (size <= 65536) chunks.push(d) })
    p.on('error', () => { clearTimeout(timer); resolve(null) })
    p.on('close', code => {
      clearTimeout(timer)
      const line = code === 0 ? Buffer.concat(chunks).toString('utf8').split('\n').map(l => l.trim()).find(Boolean) : null
      resolve(line || null)
    })
  })
}

// --- Codex ---

// A TOML value of a config line: a basic or literal string, true or
// false, a number, else undefined (arrays and inline tables are not
// read).
function tomlValue (raw) {
  const s = raw.trim()
  let m
  if ((m = /^"((?:[^"\\]|\\.)*)"/.exec(s))) {
    return m[1].replace(/\\(u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|.)/g, (_, e) => {
      if (e[0] === 'u' || e[0] === 'U') return String.fromCodePoint(parseInt(e.slice(1), 16))
      return { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '"': '"', '\\': '\\' }[e] || e
    })
  }
  if ((m = /^'([^']*)'/.exec(s))) return m[1]
  if ((m = /^(true|false)\b/.exec(s))) return m[1] === 'true'
  if ((m = /^[+-]?\d[\d_]*(\.\d+)?\b/.exec(s))) return Number(m[0].replace(/_/g, ''))
  return undefined
}

// A dotted key's parts, quoted parts unquoted.
function keyParts (k) {
  const out = []
  const re = /\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|([A-Za-z0-9_-]+))\s*(\.|$)/y
  let m
  while (re.lastIndex < k.length && (m = re.exec(k))) {
    out.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3])
    if (!m[4]) break
  }
  return out
}

function put (o, parts, v) {
  let t = o
  for (const p of parts.slice(0, -1)) {
    if (!Object.hasOwn(t, p) || !t[p] || typeof t[p] !== 'object') Object.defineProperty(t, p, { value: {}, writable: true, enumerable: true, configurable: true })
    t = t[p]
  }
  Object.defineProperty(t, parts[parts.length - 1], { value: v, writable: true, enumerable: true, configurable: true })
}

// The tables and string, boolean and number keys of a config.toml, as
// an object. Enough of TOML for model_provider, profile, profiles and
// model_providers.
function toml (text) {
  const out = {}
  let table = []
  for (const line of String(text).split('\n')) {
    const l = line.trim()
    if (!l || l.startsWith('#')) continue
    let m
    if ((m = /^\[\[?\s*([^\]]+?)\s*\]\]?\s*(#.*)?$/.exec(l))) {
      table = keyParts(m[1])
      continue
    }
    if (!(m = /^((?:"(?:[^"\\]|\\.)*"|'[^']*'|[A-Za-z0-9_.\s-])+?)\s*=\s*(.*)$/.exec(l))) continue
    const v = tomlValue(m[2])
    const k = keyParts(m[1])
    if (v !== undefined && k.length) put(out, table.concat(k), v)
  }
  return out
}

// Codex's -c key=value overrides and its --profile, from argv.
function codexArgs (argv) {
  const sets = []
  let profile = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    let v = null
    if (a === '-c' || a === '--config') v = argv[++i]
    else if (a.startsWith('--config=')) v = a.slice(9)
    else if (a === '-p' || a === '--profile') profile = argv[++i] || null
    else if (a.startsWith('--profile=')) profile = a.slice(10)
    if (typeof v !== 'string') continue
    const eq = v.indexOf('=')
    if (eq < 1) continue
    const raw = v.slice(eq + 1)
    const parsed = tomlValue(raw)
    sets.push([keyParts(v.slice(0, eq)), parsed === undefined ? raw.trim() : parsed])
  }
  return { sets, profile }
}

function codexHome (ctx) {
  const h = ctx.env.CODEX_HOME || path.join(os.homedir(), '.codex')
  return (ctx.outside || (p => p))(h)
}

// The active provider block { id, base_url, env_key,
// experimental_bearer_token }, or null for OpenAI's own (no
// model_provider, or openai) and a built-in one with no block.
function codexProvider (ctx) {
  let text = ''
  try { text = fs.readFileSync(path.join(codexHome(ctx), 'config.toml'), 'utf8') } catch (e) {}
  const c = toml(text)
  const { sets, profile } = codexArgs(ctx.cmd.slice(1))
  const prof = profile || (typeof c.profile === 'string' ? c.profile : null)
  const p = prof && c.profiles && c.profiles[prof] && typeof c.profiles[prof] === 'object' ? c.profiles[prof] : {}
  function layer (values, prefix = []) {
    for (const [k, v] of Object.entries(values)) {
      if (v && typeof v === 'object') layer(v, prefix.concat(k))
      else put(c, prefix.concat(k), v)
    }
  }
  layer(p)
  // Current Codex profiles layer a named config file over config.toml.
  if (prof && path.basename(prof) === prof) {
    try { layer(toml(fs.readFileSync(path.join(codexHome(ctx), `${prof}.config.toml`), 'utf8'))) } catch (e) {}
  }
  for (const [k, v] of sets) if (k.length) put(c, k, v)
  const id = typeof c.model_provider === 'string' ? c.model_provider : 'openai'
  const block = c.model_providers && c.model_providers[id]
  if (!block || typeof block !== 'object') return id === 'openai' ? null : { id, base_url: undefined }
  return { id, base_url: typeof block.base_url === 'string' ? block.base_url : undefined, env_key: block.env_key, experimental_bearer_token: block.experimental_bearer_token }
}

// The session's base URL: null for OpenAI's own, '' for a provider
// with no base URL the table can match.
function codexBase (ctx) {
  const p = codexProvider(ctx)
  if (!p) return null
  return typeof p.base_url === 'string' && p.base_url.trim() ? p.base_url.trim() : ''
}

// The key Codex sends: the variable env_key names, else the block's
// experimental_bearer_token.
async function codexKey (ctx) {
  const p = codexProvider(ctx)
  if (!p) return null
  if (typeof p.env_key === 'string' && typeof ctx.env[p.env_key] === 'string' && ctx.env[p.env_key].trim()) return ctx.env[p.env_key].trim()
  if (typeof p.experimental_bearer_token === 'string' && p.experimental_bearer_token.trim()) return p.experimental_bearer_token.trim()
  return null
}

// The base URL and key reader of a session of `kind`, and the profile
// that holds the key, which names the account.
function of (kind, ctx) {
  if (kind === 'claude') return { base: () => claudeBase(ctx), key: () => claudeKey(ctx), profile: settings.configDir(ctx.env) }
  if (kind === 'codex') return { base: () => codexBase(ctx), key: () => codexKey(ctx), profile: codexHome(ctx) }
  return null
}

module.exports = { of, claudeBase, claudeKey, codexBase, codexKey, codexProvider, toml, tomlValue, codexArgs, helper }
