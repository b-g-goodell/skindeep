'use strict'
// The generated --settings file: command hooks and the statusline relay,
// injected on the child only (decisions 0009, 0010, 0030). Settings
// files are read, never written. .claude.json is never read (it can hold
// a key).

const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { COMPACT_KEYS, inputs } = require('./compact')

// Claude Code's managed settings, the highest source (decision 0010).
const MANAGED_DIR = '/etc/claude-code'
// Managed keys that silence what the app injects.
const MANAGED_KEYS = ['statusLine', 'disableAllHooks', 'allowManagedHooksOnly']

const HOOK_EVENTS = [
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'SubagentStart', 'SubagentStop',
  'UserPromptSubmit', 'Stop', 'PreCompact', 'PostCompact', 'SessionStart', 'Notification'
]

function readJson (p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch (e) { return null }
}

function configDir (env) {
  return env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')
}

// Value of `--name V` or `--name=V` in argv, else undefined.
function argValue (argv, name) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === name) return argv[i + 1]
    if (argv[i].startsWith(name + '=')) return argv[i].slice(name.length + 1)
  }
  return undefined
}

// Claude Code reads project and local settings from the git root when
// the cwd is inside a repository (measured 2026-10-11: a statusLine in
// the root's .claude/settings.local.json shows when launched from a
// subdirectory), else from the cwd.
function projectDir (cwd) {
  for (let d = path.resolve(cwd); ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, '.git'))) return d
    if (d === path.dirname(d)) return cwd
  }
}

// The only settings fields the app keeps. A settings env block can hold
// credentials, so only the compaction keys of it are kept.
function keep (d) {
  const env = {}
  const e = d.env && typeof d.env === 'object' ? d.env : {}
  for (const k of COMPACT_KEYS) if (typeof e[k] === 'string') env[k] = e[k]
  return { statusLine: d.statusLine, autoCompactWindow: d.autoCompactWindow, env }
}

// Settings layers, lowest priority first, honouring --setting-sources.
// outside: the app's path of the user layer the CLI reads (decision 0037).
function layers ({ env, cwd, argv, outside = p => p }) {
  const allowed = (argValue(argv, '--setting-sources') || 'user,project,local').split(',').map(s => s.trim())
  const proj = projectDir(cwd)
  const all = [
    ['user', outside(path.join(configDir(env), 'settings.json'))],
    ['project', path.join(proj, '.claude', 'settings.json')],
    ['local', path.join(proj, '.claude', 'settings.local.json')]
  ]
  return all.filter(([name]) => allowed.includes(name)).map(([name, file]) => ({ name, file, data: keep(readJson(file) || {}) }))
}

// managed-settings.json, then managed-settings.d/*.json in name order,
// lowest priority first. Only the kept fields and the two hook keys.
function managedLayers (dir) {
  let drop = []
  try { drop = fs.readdirSync(path.join(dir, 'managed-settings.d')).filter(n => n.endsWith('.json')).sort() } catch (e) {}
  const files = [path.join(dir, 'managed-settings.json'), ...drop.map(n => path.join(dir, 'managed-settings.d', n))]
  return files.map(file => [file, readJson(file)]).filter(([, d]) => d && typeof d === 'object').map(([file, d]) => ({
    name: 'managed',
    file,
    data: Object.assign(keep(d), { disableAllHooks: d.disableAllHooks === true, allowManagedHooksOnly: d.allowManagedHooksOnly === true })
  }))
}

// The managed keys set, of MANAGED_KEYS.
function managedKeys (ms) {
  return MANAGED_KEYS.filter(k => ms.some(l => k === 'statusLine' ? l.data.statusLine && typeof l.data.statusLine === 'object' : l.data[k]))
}

function effectiveStatusLine (ls) {
  let eff = null
  for (const l of ls) {
    const s = l.data.statusLine
    if (s && typeof s === 'object') eff = Object.assign({}, eff || {}, s)
  }
  return eff && eff.command ? eff : null
}

function quote (s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'"
}

// The file's text names no window, tab or port: the relays find their
// window by ancestry (decision 0030). So one text serves every window
// with the same chain and mode, and the file outlives the window: a
// session sent to the background keeps --settings FILE on its command
// line, and Claude Code exits when that file is missing. Named for the
// hash of its text in store and never removed.
function write (store, settings) {
  const text = JSON.stringify(settings, null, 1)
  const file = path.join(store, crypto.createHash('sha256').update(text).digest('hex').slice(0, 16) + '.json')
  try {
    if (fs.readFileSync(file, 'utf8') === text) return file
  } catch (e) {}
  fs.mkdirSync(store, { recursive: true, mode: 0o700 })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, text, { mode: 0o600 })
  fs.renameSync(tmp, file)
  return file
}

// opts: { cmd, env, cwd, root, store, mode, node, python, managedDir }
// root: the runtime root the relays search. store: where the file goes.
// node: { path, asElectron } for running the statusline relay. python:
// the python3 that runs the hook relay. managedDir: where the managed
// settings live, /etc/claude-code unless a test says.
// compaction: the frozen compaction inputs of the child (compact.js).
// managed: the managed keys that silence what is injected.
function prepare (opts) {
  const argv = opts.cmd.slice(1)
  const ls = layers({ env: opts.env, cwd: opts.cwd, argv, outside: opts.outside })
  const ms = managedLayers(opts.managedDir || MANAGED_DIR)
  const compaction = inputs({ sources: [...ls, ...ms].map(l => l.data), argv, env: opts.env })
  const managed = managedKeys(ms)
  if (argValue(argv, '--settings') !== undefined) {
    return { args: [], reason: '--settings given', compaction, managed }
  }
  const chain = effectiveStatusLine(ls)
  const relays = path.join(__dirname, '..', '..', 'relay')
  const hook = `${quote(opts.python)} -I -S ${quote(path.join(relays, 'hook.py'))} ${quote(opts.root)}`
  const hooks = {}
  for (const ev of HOOK_EVENTS) hooks[ev] = [{ hooks: [{ type: 'command', command: hook, timeout: 1 }] }]
  const settings = { hooks }
  if (opts.mode === 'always' || chain) {
    const prefix = opts.node.asElectron ? 'ELECTRON_RUN_AS_NODE=1 ' : ''
    const encoded = chain ? Buffer.from(chain.command, 'utf8').toString('base64url') : '-'
    const line = {
      type: 'command',
      command: `${prefix}${quote(opts.node.path)} ${quote(path.join(relays, 'statusline.js'))} ${quote(opts.root)} ${encoded}`,
      padding: chain && chain.padding !== undefined ? chain.padding : 0
    }
    for (const k of ['refreshInterval', 'hideVimModeIndicator']) if (chain && chain[k] !== undefined) line[k] = chain[k]
    settings.statusLine = line
  }
  const file = write(opts.store, settings)
  return { args: ['--settings', file], reason: null, compaction, managed, statusline: !!settings.statusLine, chain: !!chain }
}

module.exports = { HOOK_EVENTS, prepare, layers, effectiveStatusLine, argValue, configDir }
