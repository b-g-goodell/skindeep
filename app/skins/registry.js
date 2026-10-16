'use strict'
// Skin lookup and the skin:// protocol (decisions 0005, 0008).

const fs = require('fs')
const path = require('path')
const { validate } = require('./validate')
const textscale = require('./textscale')

const MIME = {
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'
}

// shippedDir holds the shipped skins, one directory each. The registry
// reads no environment variable: the caller chooses the directory. It
// owns which skin is current, the view the renderer gets, the refusal
// that keeps the current skin (decision 0008) and skin:// serving of the
// current skin only (decision 0005).
//
// Identity (decision 0008): a skin's id is its name. A shipped skin's
// name is its directory's. A skin opened by path takes the id of its
// manifest name, and when a shipped skin has that name the path skin
// replaces it for the run: the list shows the id with the path's folder.
function createRegistry ({ shippedDir, defaultName = 'deck' }) {
  if (!shippedDir) throw new Error('createRegistry: shippedDir is required')

  // id -> realpath of each skin opened by path this run.
  const paths = new Map()
  // { id, skin }: skin as validated, its dir a realpath.
  let cur = null

  function shipped () {
    try {
      return fs.readdirSync(shippedDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort()
    } catch (e) {
      return []
    }
  }

  function dirOf (id) {
    return paths.get(id) || (shipped().includes(id) ? path.join(shippedDir, id) : null)
  }

  function realOf (dir) {
    try { return fs.realpathSync(dir) } catch (e) { return null }
  }

  function view () {
    if (!cur) return null
    const v = Object.assign({}, cur.skin, { id: cur.id, label: cur.id, base: `skin://${cur.id}/` })
    delete v.dir
    return v
  }

  // Validate from disk on every call, so selecting the current skin
  // reloads it. A refusal changes nothing.
  function use (id, dir) {
    const r = validate(dir)
    if (!r.skin) return { errors: r.errors }
    cur = { id, skin: r.skin }
    return { view: view() }
  }

  // Once, at launch. spec: null, a NAME under shippedDir, or a PATH (it
  // contains a slash).
  function start (spec) {
    if (!spec) {
      const all = shipped()
      if (!all.length) return { view: null }
      const id = all.includes(defaultName) ? defaultName : all[0]
      return use(id, path.join(shippedDir, id))
    }
    if (spec.includes('/')) {
      const r = open(spec)
      return r.errors ? r : { view: r.view }
    }
    return use(spec, path.join(shippedDir, spec))
  }

  // Shipped skins in directory order, then skins opened by path. location:
  // the folder of a skin opened by path, null for a shipped one.
  function list () {
    const ids = [...new Set([...shipped(), ...paths.keys()])]
    return ids.map(id => ({
      id,
      label: id,
      location: paths.get(id) || null,
      current: !!cur && realOf(dirOf(id)) === cur.skin.dir
    }))
  }

  function select (id) {
    const dir = dirOf(id)
    if (!dir) return { errors: [`no skin with id ${id}`] }
    return use(id, dir)
  }

  // A directory already listed is selected. Otherwise it is validated, and
  // a valid skin becomes current under its name.
  function open (dir) {
    const real = realOf(dir)
    const known = real && list().find(e => realOf(dirOf(e.id)) === real)
    if (known) {
      const r = select(known.id)
      return r.errors ? r : { id: known.id, view: r.view }
    }
    const r = validate(path.resolve(dir))
    if (!r.skin) return { errors: r.errors }
    const id = r.skin.name
    const shippedDirOf = shipped().includes(id) ? realOf(path.join(shippedDir, id)) : null
    // The shipped folder itself, opened after a copy replaced it, restores it.
    if (r.skin.dir === shippedDirOf) paths.delete(id)
    else paths.set(id, r.skin.dir)
    cur = { id, skin: r.skin }
    return { id, view: view() }
  }

  function current () {
    return view()
  }

  // What start() takes to open the current skin again: its name, or the
  // folder of a skin opened by path (decision 0022).
  function spec () {
    if (!cur) return null
    return paths.get(cur.id) === cur.skin.dir ? cur.skin.dir : cur.id
  }

  // Serve skin://<id>/<path> from the current skin's directory only, by
  // realpath, and only file types a skin may use in the page. Never
  // rejects: a malformed escape is a 404. no-store, so a reselected skin
  // is read from disk again instead of the page's cache. A byte range is
  // served as asked, so a skin's sound can loop and seek (decision 0024).
  // A stylesheet is served with its text sizes scaled by the user's skin
  // text size (decision 0036).
  async function handle (request) {
    try {
      const u = new URL(request.url)
      if (!cur || u.hostname !== cur.id) return new Response('', { status: 404 })
      const dir = cur.skin.dir
      const full = path.join(dir, decodeURIComponent(u.pathname))
      const type = MIME[path.extname(full).toLowerCase()]
      const real = fs.realpathSync(full)
      if (!type || !real.startsWith(dir + path.sep)) return new Response('', { status: 404 })
      let data = fs.readFileSync(real)
      if (type.startsWith('text/css')) data = Buffer.from(textscale.rewrite(data.toString('utf8')))
      const headers = { 'content-type': type, 'cache-control': 'no-store', 'access-control-allow-origin': '*', 'accept-ranges': 'bytes' }
      const asked = request.headers && request.headers.get ? request.headers.get('range') : null
      const m = /^bytes=(\d*)-(\d*)$/.exec(asked || '')
      if (!m || (!m[1] && !m[2])) return new Response(data, { headers: Object.assign(headers, { 'content-length': String(data.length) }) })
      const start = m[1] ? Number(m[1]) : Math.max(0, data.length - Number(m[2]))
      const end = m[1] && m[2] ? Math.min(Number(m[2]), data.length - 1) : data.length - 1
      if (start >= data.length || start > end) return new Response('', { status: 416, headers: { 'content-range': `bytes */${data.length}` } })
      return new Response(data.subarray(start, end + 1), {
        status: 206,
        headers: Object.assign(headers, { 'content-range': `bytes ${start}-${end}/${data.length}`, 'content-length': String(end - start + 1) })
      })
    } catch (e) {
      return new Response('', { status: 404 })
    }
  }

  return { start, list, select, open, current, spec, handle }
}

module.exports = { createRegistry }
