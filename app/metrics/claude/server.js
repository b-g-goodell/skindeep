'use strict'
// Receiver for the hook and statusline relays of one tab (decisions
// 0009, 0030), on a Unix socket in the tab's own directory. The relays
// find it by ancestry through ROOT/pids/<pid>, a link the tab makes to
// it once its CLI has a pid. Every request is answered 204 with an empty
// body before anything else, so a hook never has an effect on the
// session.
//
// A socket's path holds at most SUN_PATH bytes, and Node binds a longer
// one cut short without an error. The socket is bound through a
// descriptor of its directory, /proc/self/fd/<fd>/hooks.sock, so the
// runtime dir may be of any length (decision 0016).

const http = require('http')
const fs = require('fs')
const path = require('path')
const { owned } = require('../../runtime')

const MAX_BODY = 64 * 1024
// sun_path is 108 bytes on Linux, its last the terminating NUL.
const SUN_PATH = 107

// The directory of the links, ROOT/pids, mode 0700 and this uid's.
function pidsDir (root) {
  const d = path.join(root, 'pids')
  fs.mkdirSync(d, { recursive: true, mode: 0o700 })
  return owned(d)
}

// dir: the tab's directory. Resolves { server, socket, link(pid),
// close() }: link(pid) points ROOT/pids/<pid> at the socket, close()
// removes the link and the socket and stops the server. Rejects with
// the socket's path when it cannot bind, and with ROOT/pids's when it is
// not this uid's alone.
function start (dir, root, onHook, onStatusline) {
  const socket = path.join(dir, 'hooks.sock')
  let pids
  try {
    pids = pidsDir(root)
  } catch (e) {
    return Promise.reject(new Error(`hooks links: ${e.message}`))
  }
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
      const p = path.join(pids, String(pid))
      try { fs.unlinkSync(p) } catch (e) {}
      fs.symlinkSync(socket, p)
      linked = p
    },
    close () {
      if (linked) {
        try { if (fs.readlinkSync(linked) === socket) fs.unlinkSync(linked) } catch (e) {}
        linked = null
      }
      // libuv unlinks the bound name on close: the descriptor it names
      // stays open until then.
      server.close()
      release()
      try { fs.unlinkSync(socket) } catch (e) {}
    }
  }
  let fd = null
  const release = () => {
    if (fd !== null) try { fs.closeSync(fd) } catch (e) {}
    fd = null
  }
  return new Promise((resolve, reject) => {
    let listening = false
    // An error once listening leaves the descriptor to close().
    const fail = e => {
      if (listening) return
      release()
      reject(new Error(`hooks socket ${socket}: cannot bind: ${e.message}`))
    }
    server.on('error', fail)
    try {
      fd = fs.openSync(dir, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY)
      const bound = `/proc/self/fd/${fd}/hooks.sock`
      if (Buffer.byteLength(bound) > SUN_PATH) throw new Error(`${bound} is longer than a Unix socket path's ${SUN_PATH} bytes`)
      try { fs.unlinkSync(socket) } catch (e) {}
      server.listen(bound, () => { listening = true; resolve(r) })
    } catch (e) {
      fail(e)
    }
  })
}

module.exports = { start }
