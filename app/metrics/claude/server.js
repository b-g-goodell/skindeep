'use strict'
// Receiver for the hook and statusline relays of one tab (decisions
// 0009, 0030), on a Unix socket in the tab's own directory. The relays
// find it by ancestry through ROOT/pids/<pid>, a link the tab makes to
// it once its CLI has a pid. Every request is answered 204 with an empty
// body before anything else, so a hook never has an effect on the
// session.

const http = require('http')
const fs = require('fs')
const path = require('path')

const MAX_BODY = 64 * 1024

// The directory of the links, ROOT/pids, mode 0700.
function pidsDir (root) {
  const d = path.join(root, 'pids')
  fs.mkdirSync(d, { recursive: true, mode: 0o700 })
  return d
}

// dir: the tab's directory. Resolves { server, socket, link(pid),
// close() }: link(pid) points ROOT/pids/<pid> at the socket, close()
// removes the link and the socket and stops the server.
function start (dir, root, onHook, onStatusline) {
  const socket = path.join(dir, 'hooks.sock')
  const server = http.createServer((req, res) => {
    res.writeHead(204)
    res.end()
    const route = req.method === 'POST' ? req.url.slice(1) : null
    const chunks = []
    let size = 0
    req.on('data', c => {
      size += c.length
      if (size <= MAX_BODY) chunks.push(c)
    })
    req.on('end', () => {
      if (!route || size > MAX_BODY) return
      let body
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch (e) { return }
      chunks.length = 0
      try {
        if (route === 'hook') onHook(body)
        else if (route === 'statusline') onStatusline(body)
      } catch (e) {
        // A malformed payload never reaches the session or the user.
      }
    })
  })
  let linked = null
  const r = {
    server,
    socket,
    link (pid) {
      const p = path.join(pidsDir(root), String(pid))
      try { fs.unlinkSync(p) } catch (e) {}
      fs.symlinkSync(socket, p)
      linked = p
    },
    close () {
      if (linked) {
        try { if (fs.readlinkSync(linked) === socket) fs.unlinkSync(linked) } catch (e) {}
        linked = null
      }
      server.close()
      try { fs.unlinkSync(socket) } catch (e) {}
    }
  }
  return new Promise((resolve, reject) => {
    server.on('error', reject)
    try { fs.unlinkSync(socket) } catch (e) {}
    server.listen(socket, () => resolve(r))
  })
}

module.exports = { start }
