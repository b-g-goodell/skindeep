'use strict'
// The Claude adapter's receiver as the relays reach it (decision 0030):
// a Unix socket, linked from ROOT/pids/<pid> once the tab's CLI has a
// pid. A test links its own pid and posts as a relay would.

const http = require('http')
const net = require('net')
const path = require('path')
const { spawn } = require('child_process')

const link = (root, pid = process.pid) => path.join(root, 'pids', String(pid))

// POST body to target, a socket or a link to one. Resolves the status.
function post (target, body, route = 'hook') {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))
    const req = http.request({ socketPath: target, path: '/' + route, method: 'POST', agent: false, headers: { 'content-type': 'application/json', 'content-length': data.length } }, res => {
      res.resume()
      res.on('end', () => resolve(res.statusCode))
    })
    req.on('error', reject)
    req.end(data)
  })
}

// True when nothing listens at target any more.
function refused (target) {
  return new Promise(resolve => {
    const s = net.connect(target)
    s.on('connect', () => { s.destroy(); resolve(false) })
    s.on('error', e => resolve(e.code === 'ECONNREFUSED' || e.code === 'ENOENT'))
  })
}

// Runs a relay command as Claude Code runs it: /bin/sh -c, the JSON on
// stdin. Resolves { code, stdout, stderr }.
function run (command, body) {
  return new Promise(resolve => {
    const p = spawn('/bin/sh', ['-c', command], { stdio: ['pipe', 'pipe', 'pipe'] })
    const out = []
    const err = []
    p.stdout.on('data', c => out.push(c))
    p.stderr.on('data', c => err.push(c))
    p.on('close', code => resolve({ code, stdout: Buffer.concat(out).toString(), stderr: Buffer.concat(err).toString() }))
    p.stdin.on('error', () => {})
    p.stdin.end(typeof body === 'string' ? body : JSON.stringify(body))
  })
}

module.exports = { link, post, refused, run }
