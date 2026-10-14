'use strict'
// Per-instance runtime dir (generated settings, userData) and log rotation.

const fs = require('fs')
const os = require('os')
const path = require('path')

const KEEP_LOGS = 10

function base () {
  if (process.env.XDG_RUNTIME_DIR) return path.join(process.env.XDG_RUNTIME_DIR, 'claude-skins')
  return path.join(process.env.TMPDIR || os.tmpdir(), `claude-skins-${process.getuid()}`)
}

function alive (pid) {
  try { process.kill(pid, 0); return true } catch (e) { return e.code === 'EPERM' }
}

function create () {
  const root = base()
  fs.mkdirSync(root, { recursive: true, mode: 0o700 })
  for (const name of fs.readdirSync(root)) {
    if (/^\d+$/.test(name) && Number(name) !== process.pid && !alive(Number(name))) {
      fs.rmSync(path.join(root, name), { recursive: true, force: true })
    }
  }
  sweepLinks(root)
  const given = process.env.SKINNED_RUNTIME_DIR
  const dir = given && path.dirname(given) === root ? given : path.join(root, String(process.pid))
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  return dir
}

// root/pids holds one link per tab's CLI to that tab's hook socket
// (decision 0030). A link whose socket went with its window is removed.
function sweepLinks (root) {
  let names = []
  try { names = fs.readdirSync(path.join(root, 'pids')) } catch (e) { return }
  for (const n of names) {
    const p = path.join(root, 'pids', n)
    if (!fs.existsSync(p)) try { fs.unlinkSync(p) } catch (e) {}
  }
}

// The generated Claude settings (decision 0030): they outlive the
// window, so they live beside the logs, not in the runtime dir.
function settingsDir () {
  return path.join(logDir(), 'settings')
}

function remove (dir) {
  if (dir) fs.rmSync(dir, { recursive: true, force: true })
}

// bin/skinned writes one log per launch here, named for its own pid.
function logDir () {
  return path.join(process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state'), 'claude-skins')
}

function logNames () {
  try { return fs.readdirSync(logDir()).filter(n => n.endsWith('.log')).sort() } catch (e) { return [] }
}

function rotateLogs () {
  const names = logNames()
  for (const n of names.slice(0, Math.max(0, names.length - KEEP_LOGS))) {
    fs.rmSync(path.join(logDir(), n), { force: true })
  }
}

// The logs of windows that have ended (decision 0022). A live window's
// launcher still runs, so its log stays. Returns the count removed.
function clearLogs () {
  let n = 0
  for (const name of logNames()) {
    const m = name.match(/-(\d+)\.log$/)
    if (m && !alive(Number(m[1]))) {
      fs.rmSync(path.join(logDir(), name), { force: true })
      n++
    }
  }
  return n
}

module.exports = { base, create, remove, logDir, settingsDir, rotateLogs, clearLogs }
