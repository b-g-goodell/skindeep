'use strict'
// Statusline relay (decisions 0010, 0030). Claude Code runs this as the
// injected statusLine command. It runs the profile's own statusline at
// once with the same stdin and prints only that command's output, while
// it posts the JSON to the window whose tab started this process tree,
// found by ancestry as app/relay/hook.py finds it. A session no window
// started posts nothing and keeps its own statusline. It never prints
// text of its own.
// argv: ROOT CHAIN, ROOT the app's runtime root, CHAIN the profile's
// statusline command in base64url, or - for none.

const http = require('http')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const [root, chain] = process.argv.slice(2)
const MAX_DEPTH = 64

function readStdin () {
  return new Promise(resolve => {
    const chunks = []
    process.stdin.on('data', c => chunks.push(c))
    process.stdin.on('end', () => resolve(Buffer.concat(chunks)))
    process.stdin.on('error', () => resolve(Buffer.concat(chunks)))
  })
}

function parent (pid) {
  try {
    const s = fs.readFileSync(`/proc/${pid}/stat`, 'latin1')
    return Number(s.slice(s.lastIndexOf(')') + 2).split(' ')[1]) || 0
  } catch (e) {
    return 0
  }
}

// The window's socket for the nearest ancestor with a link, else null.
function windowSocket () {
  if (!root) return null
  let pid = process.ppid
  for (let i = 0; i < MAX_DEPTH && pid > 1; i++) {
    const p = path.join(root, 'pids', String(pid))
    if (fs.existsSync(p)) return p
    pid = parent(pid)
  }
  return null
}

function post (body) {
  const socketPath = windowSocket()
  if (!socketPath) return Promise.resolve()
  return new Promise(resolve => {
    const req = http.request({ socketPath, path: '/statusline', method: 'POST', timeout: 200, headers: { 'content-type': 'application/json', 'content-length': body.length } }, res => {
      res.resume()
      res.on('end', resolve)
    })
    req.on('timeout', () => req.destroy())
    req.on('error', resolve)
    req.on('close', resolve)
    setTimeout(() => { req.destroy(); resolve() }, 500).unref()
    req.end(body)
  })
}

function runChain (body) {
  let command = null
  try { if (chain && chain !== '-') command = Buffer.from(chain, 'base64url').toString('utf8') || null } catch (e) {}
  if (!command) return Promise.resolve(0)
  return new Promise(resolve => {
    const child = spawn('/bin/sh', ['-c', command], { stdio: ['pipe', 'inherit', 'inherit'] })
    process.on('SIGTERM', () => { child.kill('SIGTERM'); process.exit(143) })
    child.on('error', () => resolve(1))
    child.on('exit', (code, sig) => resolve(sig ? 128 : code))
    child.stdin.on('error', () => {})
    child.stdin.end(body)
  })
}

readStdin().then(body => Promise.all([runChain(body), post(body)]))
  .then(([code]) => process.exit(code))
  .catch(() => process.exit(0))
