'use strict'
// Live check of stepping the visualization's modes (decision 0015) under
// xvfb-run:
//   node scripts/checks/vizstep.js OUT
// The space bar steps one pane MODES.length + 1 times, and each frame
// shows the next mode of modes.js, its caption naming it and its pixels
// not blank, so every mode shows once and the first again. Then the
// GPU process, whose pid the check reads from the app it launched, is
// killed, as Chromium's GPU process exits on the owner's host, and the
// same steps again: every butterchurn mode draws on a new context, or
// on the scope with its reason, never on the lost one. No page or
// console error. Each frame goes to OUT/step-<round>-<n>-<mode>.png.
const { launch, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')
const { MODES } = require('../../app/viz/modes')

const out = path.resolve(process.argv[2])
const fake = path.join(__dirname, '..', 'fake', 'claude')
fs.mkdirSync(out, { recursive: true })
const errors = []

function check (ok, msg, seen) {
  if (!ok) throw new Error(seen === undefined ? msg : `${msg}, saw ${JSON.stringify(seen)}`)
}

// get() once ok(value) holds, else after ms the last value seen.
async function until (get, ok, ms, step = 100) {
  const t0 = Date.now()
  let v = await get()
  while (!ok(v) && Date.now() - t0 < ms) {
    await sleep(step)
    v = await get()
  }
  return v
}

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
  const pane = async () => (await viz.evaluate(() => window.vizState())).panes[0]
  const caption = () => viz.evaluate(() => document.querySelector('.pane .mode').textContent)

  // The window as it is composited, the pane's caption row left out: a
  // PNG, and the share of pixels near white and of pixels not near black.
  async function look (p) {
    return app.evaluate(async ({ BrowserWindow }, r) => {
      const w = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/viz/'))
      const img = await w.webContents.capturePage(r)
      const b = img.toBitmap()
      let white = 0
      let lit = 0
      for (let i = 0; i < b.length; i += 4) {
        const lo = Math.min(b[i], b[i + 1], b[i + 2])
        const hi = Math.max(b[i], b[i + 1], b[i + 2])
        if (lo > 230) white++
        if (hi > 40) lit++
      }
      const n = b.length / 4
      return { png: img.toPNG().toString('base64'), white: white / n, lit: lit / n }
    }, { x: p.x, y: p.y, width: p.w, height: p.h - 24 })
  }

  // One round: MODES.length + 1 presses, the frame after each read.
  async function round (name) {
    const start = await pane()
    const at = MODES.findIndex(m => m.id === start.mode)
    const seen = []
    for (let k = 0; k <= MODES.length + 1; k++) {
      const want = MODES[(at + k) % MODES.length]
      if (k > 0) await viz.keyboard.press('Space')
      const p = await until(pane, p => p.mode === want.id && !p.lost, 5000)
      // A butterchurn preset compiles and blends in for about 1.5 s, in
      // software GL longer under load: the frame is read until it draws,
      // bounded, so a mode that never draws still fails.
      await sleep(want.kind === 'milk' ? 2500 : 900)
      const q = await pane()
      const c = await caption()
      const drawn = l => l.white < 0.5 && l.lit > 0.002
      const l = await until(() => look(q), drawn, 15000, 500)
      fs.writeFileSync(path.join(out, `step-${name}-${String(k).padStart(2, '0')}-${want.id}.png`), Buffer.from(l.png, 'base64'))
      const row = { k, want: want.id, mode: q.mode, milk: q.milk, lost: q.lost, caption: c, white: Math.round(l.white * 1000) / 1000, lit: Math.round(l.lit * 1000) / 1000 }
      console.log(name, JSON.stringify(row))
      seen.push(q.mode)
      check(p.mode === want.id && q.mode === want.id, `${name}: step ${k} want ${want.id}`, row)
      check(c.includes(want.label), `${name}: step ${k} caption does not name ${want.label}`, row)
      check(!q.lost, `${name}: step ${k} draws on a lost WebGL context`, row)
      check(drawn(l), `${name}: step ${k} ${want.id} is blank`, row)
    }
    console.log(name, 'seen', seen.join(' '))
    const ids = seen.slice(0, MODES.length)
    check(new Set(ids).size === MODES.length && seen[MODES.length] === seen[0], `${name}: want every mode once, then the first again`, seen)
  }

  await sleep(2000)
  await round('a')

  // The GPU process, killed: the app's own child, its pid read here.
  const gpu = await app.evaluate(({ app }) => app.getAppMetrics().filter(m => m.type === 'GPU').map(m => m.pid))
  check(gpu.length === 1, 'want one GPU process', gpu)
  console.log('killing the GPU process', gpu[0])
  process.kill(gpu[0], 'SIGKILL')
  const again = await until(() => app.evaluate(({ app }) => app.getAppMetrics().filter(m => m.type === 'GPU').map(m => m.pid)), g => g.length === 1 && g[0] !== gpu[0], 15000, 250)
  check(again.length === 1 && again[0] !== gpu[0], 'want a new GPU process', again)
  console.log('new GPU process', again[0])
  await sleep(2000)
  await round('b')

  console.log('errors', JSON.stringify(errors))
  check(errors.length === 0, 'want no page or console error', errors)
  for (const tab of (await win.evaluate(() => window.skinned.tabs())).tabs) await win.evaluate(id => window.skinned.closeTab(id), tab.id)
  await sleep(2000)
  await app.close().catch(() => {})
  console.log('done')
})().catch(e => { console.error(e, '\nerrors', JSON.stringify(errors)); process.exit(1) })
