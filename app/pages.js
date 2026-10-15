'use strict'
// The pages a launch opens come from the launch's build. At launch
// every file of app/renderer and app/viz, and every node_modules file
// their pages name, is read into memory and served as shell://launch/<path>.
// The preloads are copied into the launch's runtime dir. A window opened
// later, such as a reopened visualization, then runs the code its main
// process was started with, even after a pull or ./install.sh.

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DIRS = ['app/renderer', 'app/viz']
const PRELOADS = { main: 'app/preload.js', viz: 'app/viz/preload.js' }
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }
const SCHEME = 'shell'

const files = new Map()
const preloads = {}

function add (rel) {
  const type = TYPES[path.extname(rel)]
  if (type) files.set('/' + rel, { data: fs.readFileSync(path.join(ROOT, rel)), type })
}

// Each page's ../../node_modules/<file> resolves to /node_modules/<file>.
function snapshot () {
  for (const d of DIRS) {
    for (const n of fs.readdirSync(path.join(ROOT, d))) add(`${d}/${n}`)
  }
  for (const [rel, f] of [...files]) {
    if (f.type !== 'text/html') continue
    for (const m of f.data.toString('utf8').matchAll(/["'](?:\.\.\/)+(node_modules\/[^"']+)["']/g)) add(m[1])
  }
}

// dir: the launch's runtime dir, removed with it.
function init (dir) {
  snapshot()
  const to = path.join(dir, 'preload')
  fs.mkdirSync(to, { recursive: true })
  for (const [name, rel] of Object.entries(PRELOADS)) {
    preloads[name] = path.join(to, `${name}.js`)
    fs.copyFileSync(path.join(ROOT, rel), preloads[name])
  }
}

const url = rel => `${SCHEME}://launch/${rel}`
const preload = name => preloads[name]

async function handle (request) {
  const f = files.get(new URL(request.url).pathname)
  if (!f) return new Response('', { status: 404 })
  return new Response(f.data, { headers: { 'content-type': f.type, 'cache-control': 'no-store' } })
}

module.exports = { SCHEME, init, url, preload, handle, files }
