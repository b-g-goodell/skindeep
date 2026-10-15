'use strict'
/* global requestAnimationFrame */
// Live check of the Fern mode (decision 0015) under xvfb-run:
//   node scripts/checks/vizfern.js OUT
// The frame rate of three panes all in fern, against three all in
// gravity and three all in quantum, five rounds in turn so each set sees
// the same host load, each set's median reported. Then one fern pane on
// a 1200 by 760 window is captured every 0.5 s for 30 s, through more
// than one octave of the zoom, the frames to OUT/fern-NN.png: no frame
// is blank, the zoom advances, and no step between two neighbouring
// frames changes the picture much more than the steps around it, so
// the zoom's loop shows no jump. No page or console error. Fakes only.
const { launch, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const fake = path.join(__dirname, '..', 'fake', 'claude')
fs.mkdirSync(out, { recursive: true })
const errors = []
const FRAMES = 60

function check (ok, msg, seen) {
  if (!ok) throw new Error(seen === undefined ? msg : `${msg}, saw ${JSON.stringify(seen)}`)
}

// The first pane's shown canvas: a PNG, and its colour over a 64 by 64
// grid.
function grab () {
  const c = document.querySelector('.pane canvas:not([hidden])')
  const t = document.createElement('canvas')
  t.width = t.height = 64
  const g = t.getContext('2d')
  g.drawImage(c, 0, 0, 64, 64)
  return { png: c.toDataURL('image/png'), grid: Array.from(g.getImageData(0, 0, 64, 64).data) }
}

// The fraction of two grids' cells that differ visibly, and a grid's
// brightest channel, as vizmodes.js has them.
function changed (a, b) {
  let n = 0
  for (let i = 0; i < a.length; i += 4) if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > 24) n++
  return n / (a.length / 4)
}
const peak = a => a.reduce((m, v, i) => i % 4 === 3 ? m : Math.max(m, v), 0)
const median = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)]

;(async () => {
  const { app, win } = await launch([fake], { appArgs: ['--skin', 'deck'], env: { SKINNED_GL: 'swiftshader' } })
  let viz = null
  for (let i = 0; i < 40 && !viz; i++) {
    await sleep(250)
    for (const w of app.windows()) if (w.url().includes('/viz/')) viz = w
  }
  check(viz, 'no viz window')
  viz.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  viz.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
  await viz.waitForFunction(() => typeof window.vizState === 'function', null, { timeout: 30000 })
  const state = () => viz.evaluate(() => window.vizState())
  const tabs = async () => (await win.evaluate(() => window.skinned.tabs())).tabs
  async function until (f, msg) {
    for (let i = 0; i < 100; i++) {
      if (await f()) return
      await sleep(100)
    }
    throw new Error(msg)
  }
  async function assign (tab, id) {
    await win.evaluate(t => window.skinned.activateTab(t), tab)
    await until(async () => (await state()).panes.some(p => p.tab === tab && p.active), `tab ${tab} not active`)
    check((await win.evaluate(m => window.skinned.selectViz(m), id)).ok, `the menu refused ${id}`)
    await until(async () => (await state()).panes.find(p => p.tab === tab).mode === id, `tab ${tab} not in ${id}`)
  }
  while ((await state()).panes.length < 3) {
    await win.evaluate(() => window.skinned.newTab())
    await sleep(900)
  }
  await sleep(1000)

  const sets = ['fern', 'gravity', 'quantum']
  const runs = sets.map(() => [])
  for (let round = 0; round < 5; round++) {
    for (const [k, id] of sets.entries()) {
      const ids = (await tabs()).map(t => t.id)
      for (let j = 0; j < 3; j++) await assign(ids[j], id)
      await sleep(1500)
      runs[k].push(await viz.evaluate(() => new Promise(resolve => {
        let n = 0
        const t0 = performance.now()
        const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else resolve(n / 2) }
        requestAnimationFrame(f)
      })))
    }
  }
  const fps = runs.map(median)
  sets.forEach((id, k) => console.log('fps with three panes in', id, runs[k].join(' '), 'median', fps[k]))

  // One pane, larger.
  const all = await tabs()
  for (const t of all.slice(1)) await win.evaluate(id => window.skinned.closeTab(id), t.id)
  await until(async () => (await state()).panes.length === 1, 'want one pane')
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/viz/'))
    w.setContentSize(1200, 760)
  })
  await assign(all[0].id, 'fern')
  await sleep(3000)
  const shots = []
  for (let i = 0; i < FRAMES; i++) {
    const t0 = Date.now()
    const s = await viz.evaluate(grab)
    s.probe = (await state()).panes[0].probe
    fs.writeFileSync(path.join(out, `fern-${String(i).padStart(2, '0')}.png`), Buffer.from(s.png.split(',')[1], 'base64'))
    shots.push(s)
    await sleep(Math.max(0, 500 - (Date.now() - t0)))
  }
  const steps = shots.slice(1).map((s, i) => changed(shots[i].grid, s.grid))
  const peaks = shots.map(s => peak(s.grid))
  const zoom = shots.map(s => s.probe.zoom)
  console.log('zoom', zoom.map(z => z.toFixed(2)).join(' '))
  console.log('steps', steps.map(v => v.toFixed(3)).join(' '))
  console.log('step median', median(steps).toFixed(3), 'max', Math.max(...steps).toFixed(3), 'peak min', Math.min(...peaks))
  check(peaks.every(v => v > 40), 'a blank frame', peaks)
  check(zoom[FRAMES - 1] - zoom[0] > 1, 'want more than one octave of zoom', zoom)
  check(Math.max(...steps) < 2.5 * median(steps) + 0.05, 'a step stands out of its neighbours: a jump', steps)

  console.log('errors', JSON.stringify(errors))
  check(errors.length === 0, 'want no page or console error', errors)
  for (const tab of await tabs()) await win.evaluate(id => window.skinned.closeTab(id), tab.id)
  await sleep(2000)
  await app.close().catch(() => {})
  console.log('fps median, fern', fps[0], 'gravity', fps[1], 'quantum', fps[2])
  console.log('done')
})().catch(e => { console.error(e, '\nerrors', JSON.stringify(errors)); process.exit(1) })
