'use strict'
// Options, command resolution, user-facing errors on fd 3, exit codes.

const fs = require('fs')
const path = require('path')

const EXIT_APP = 125
const EXIT_NOT_FOUND = 127

let userFd = 2

// fd 3 is the caller's stderr (bin/skinned). Reopen it close-on-exec and
// close the original, so the CLI child does not inherit it.
function adoptUserFd () {
  try {
    fs.fstatSync(3)
    userFd = fs.openSync('/proc/self/fd/3', 'a')
    fs.closeSync(3)
  } catch (e) {
    userFd = 2
  }
}

function tell (msg) {
  try { fs.writeSync(userFd, 'skinned: ' + msg + '\n') } catch (e) {}
}

// argv: process.argv. Electron and Chromium switches before `--` are
// ignored, bin/skinned has already rejected unknown options of ours.
function parse (argv) {
  const sep = argv.indexOf('--')
  if (sep < 0 || sep === argv.length - 1) {
    return { error: 'usage: skinned [--skin NAME|PATH] [--statusline=always|chain-only] [--no-viz] [--mute] [--unsafe-no-sandbox] -- CMD [ARGS...]\n  SKINNED_SKIN=NAME sets the default skin, SKINNED_MUTE=1 starts with skin sounds muted, SKINNED_UNSAFE_NO_SANDBOX=1 runs without Chromium\'s sandbox' }
  }
  const own = argv.slice(0, sep)
  const opts = { skin: process.env.SKINNED_SKIN || null, statusline: 'always', viz: true, mute: process.env.SKINNED_MUTE === '1', cmd: argv.slice(sep + 1) }
  for (let i = 0; i < own.length; i++) {
    const a = own[i]
    if (a === '--skin' && i + 1 < own.length) opts.skin = own[++i]
    else if (a.startsWith('--skin=')) opts.skin = a.slice(7)
    else if (a === '--statusline=always' || a === '--statusline=chain-only') opts.statusline = a.slice(13)
    else if (a === '--no-viz') opts.viz = false
    else if (a === '--mute') opts.mute = true
  }
  return opts
}

function resolveCommand (cmd, envPath) {
  const isExec = p => {
    try { fs.accessSync(p, fs.constants.X_OK); return fs.statSync(p).isFile() } catch (e) { return false }
  }
  if (cmd.includes('/')) return isExec(cmd) ? path.resolve(cmd) : null
  for (const dir of (envPath || '').split(':')) {
    if (!dir) continue
    const p = path.join(dir, cmd)
    if (isExec(p)) return p
  }
  return null
}

module.exports = { EXIT_APP, EXIT_NOT_FOUND, adoptUserFd, tell, parse, resolveCommand }
