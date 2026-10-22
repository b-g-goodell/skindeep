'use strict'
// Derived label, window title, and the child's live command line.

const fs = require('fs')
const os = require('os')
const path = require('path')

const APP = 'claude-skins'

// The name of a config dir other than the default: work for
// ~/.claude-work or for ~/profiles/work/.claude.
function configName (dir, dflt) {
  if (!dir) return null
  const d = path.resolve(dir)
  if (d === dflt) return null
  let name = path.basename(d)
  if (name === path.basename(dflt)) name = path.basename(path.dirname(d))
  return name.replace(/^\.?(claude|codex)-/, '').replace(/^\./, '') || null
}

// The command's name, with the config dir's name when the session runs
// on a non-default one: claude [work]. kind: the dispatched adapter
// (app/metrics/agent.js), whose config dir variable is read. snapshot:
// the name of the select-agent-config snapshot the tab runs in, in
// braces (decision 0037): claude {empty}.
function label (cmd, env, kind, snapshot = null) {
  const base = path.basename(cmd[0])
  const home = os.homedir()
  let name = null
  if (kind === 'claude') name = configName(env.CLAUDE_CONFIG_DIR, path.join(home, '.claude'))
  if (kind === 'codex') name = configName(env.CODEX_HOME, path.join(home, '.codex'))
  return [base, name && `[${name}]`, snapshot && `{${snapshot}}`].filter(Boolean).join(' ')
}

function title (lbl) {
  return `${lbl} in ${APP}`
}

function quote (arg) {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(arg) ? arg : "'" + arg.replace(/'/g, "'\\''") + "'"
}

// A command line as the log keeps it: the program, each option's name,
// and each value's length, never a value, since an argument may carry a
// password, a key or a prompt and logs get attached to bug reports. own:
// the indices of the words the app put there itself, kept whole, such as
// its injected --settings FILE. A long option keeps its name and an
// attached value's length (--key=<6>), a short one its letter (-p<6>).
// Every word after -- is a value.
const OPTION = /^--[A-Za-z0-9][A-Za-z0-9_.-]*$/
function logged (cmd, own = []) {
  const keep = new Set(own)
  let operands = false
  return cmd.map((w, i) => {
    if (i === 0 || keep.has(i)) return quote(w)
    if (operands) return `<${w.length}>`
    if (w === '--') { operands = true; return w }
    const eq = w.indexOf('=')
    if (eq > 0 && OPTION.test(w.slice(0, eq))) return `${w.slice(0, eq)}=<${w.length - eq - 1}>`
    if (OPTION.test(w)) return w
    if (/^-[A-Za-z0-9]/.test(w)) return w.length === 2 ? w : `${w.slice(0, 2)}<${w.length - 2}>`
    return `<${w.length}>`
  }).join(' ')
}

// The child's argv as the kernel sees it, after any exec in a wrapper.
function liveCmdline (pid) {
  try {
    const raw = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8')
    return raw.split('\0').filter((s, i, a) => i < a.length - 1 || s).map(quote).join(' ')
  } catch (e) {
    return null
  }
}

function tildify (p) {
  const home = os.homedir()
  return p === home || p.startsWith(home + path.sep) ? '~' + p.slice(home.length) : p
}

// A command line as the strip shows it: each unquoted word under the home
// directory written with ~, as a shell would read it back.
function shownCmdline (cmdline) {
  const home = os.homedir()
  if (!cmdline || home === '/') return cmdline
  return cmdline.split(' ').map(w => w === home || w.startsWith(home + '/') ? '~' + w.slice(home.length) : w).join(' ')
}

module.exports = { APP, label, title, liveCmdline, tildify, shownCmdline, quote, logged }
