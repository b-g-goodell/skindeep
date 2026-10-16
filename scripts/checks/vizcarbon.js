'use strict'
/* global requestAnimationFrame */
// Live check of the Carbon mode (decision 0015, issue #144) under
// xvfb-run:
//   node scripts/checks/vizcarbon.js OUT
// One pane in Carbon on a 1200 by 760 window, fed by the fake claude's
// turns, is watched by its probe and captured across cascades: a
// visible photon with its source region, its shell, its detection, a
// photon outside the visible, and the spectrum after the run. Then the
// frame rate of three panes of a 720 by 460 window all in Carbon, all in
// Gravity and all in Quantum, five rounds in turn, each set's median, as
// vizmodes.js counts its sets, and each of those modes' median cost of a
// draw on a canvas of its own. No page or console error. Frames go to
// OUT/carbon-<phase>.png. Fakes only.
const { launch, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const fake = path.join(__dirname, '..', 'fake', 'claude')
fs.mkdirSync(out, { recursive: true })
const errors = []

function check (ok, msg, seen) {
  if (!ok) throw new Error(seen === undefined ? msg : `${msg}, saw ${JSON.stringify(seen)}`)
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
  const state = () => viz.evaluate(() => window.vizState())
  const tabs = async () => (await win.evaluate(() => window.skinned.tabs())).tabs
  const size = (w, h) => app.evaluate(({ BrowserWindow }, [w, h]) => {
    BrowserWindow.getAllWindows().find(x => x.webContents.getURL().includes('/viz/')).setContentSize(w, h)
  }, [w, h])
  async function until (f, msg, n = 60) {
    for (let i = 0; i < n; i++) {
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
  // Pane j's canvas as a PNG file.
  async function save (j, name) {
    const png = await viz.evaluate(j => document.querySelectorAll('.pane')[j].querySelector('canvas:not([hidden])').toDataURL('image/png'), j)
    fs.writeFileSync(path.join(out, `carbon-${name}.png`), Buffer.from(png.split(',')[1], 'base64'))
  }

  await sleep(1500)
  await size(1200, 760)
  await assign((await tabs())[0].id, 'carbon')
  await sleep(1000)

  // Watch the probe and keep the first frame of each phase.
  const want = {
    source: f => f.some(p => p.band === 'visible' && p.source && p.age > 0.12 && p.age < 0.5),
    shell: f => f.some(p => p.band === 'visible' && p.age > 0.7 && p.age < 1.2),
    detected: f => f.some(p => p.band === 'visible' && p.detected && p.age < 1.9),
    invisible: f => f.some(p => p.band !== 'visible' && p.age > 0.4 && p.age < 1.1)
  }
  const got = {}
  const t0 = Date.now()
  let probe = null
  let clicks = 0
  while (Object.keys(got).length < Object.keys(want).length && Date.now() - t0 < 150000) {
    const p = (await state()).panes[0]
    probe = p.probe
    for (const [k, ok] of Object.entries(want)) {
      if (got[k] || !ok(probe.flying)) continue
      await save(0, k)
      got[k] = probe.flying
      console.log('frame', k, JSON.stringify(probe.flying))
    }
    // A click on the atom now and then: a photon absorbed.
    if (Date.now() - t0 > 6000 * (clicks + 1)) {
      clicks++
      await viz.mouse.click(p.x + p.w * 0.25, p.y + p.h * 0.45)
    }
    await sleep(60)
  }
  await sleep(2500)
  probe = (await state()).panes[0].probe
  await save(0, 'spectrum')
  console.log('after', Math.round((Date.now() - t0) / 1000), 's', JSON.stringify(Object.assign({}, probe, { flying: probe.flying.length })))
  for (const k of Object.keys(want)) check(got[k], `no ${k} frame`)
  check(probe.photons > 0 && probe.detected > 0 && probe.lit > 0, 'want photons emitted, detected and lit', probe)
  check(probe.clicks === clicks, 'want every click counted', probe)

  // Each mode drawn alone on a canvas of 400 by 380, its own signal
  // stepped, 240 frames after 60 of warm-up: the median cost of a draw.
  const cost = await viz.evaluate(() => {
    const out = {}
    for (const id of ['carbon', 'gravity', 'quantum']) {
      const c = document.createElement('canvas')
      c.width = 400
      c.height = 380
      const r = window.VizCanvas[id](c)
      const s = new window.Synth.Synth()
      const ms = []
      for (let i = 0; i < 300; i++) {
        if (i % 40 === 0) s.trigger(i % 80 ? 2 : 3, 0)
        s.step(1 / 60, null)
        const t0 = performance.now()
        r.draw(s, 1 / 60)
        if (i >= 60) ms.push(performance.now() - t0)
      }
      ms.sort((a, b) => a - b)
      out[id] = Math.round(ms[ms.length >> 1] * 100) / 100
    }
    return out
  })
  console.log('median ms a draw, alone at 400x380', JSON.stringify(cost))

  // Three panes, as vizmodes.js measures its sets.
  await size(720, 460)
  while ((await state()).panes.length < 3) {
    await win.evaluate(() => window.skinned.newTab())
    await sleep(900)
  }
  const sets = ['carbon', 'gravity', 'quantum']
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
      if (round === 0 && id === 'carbon') await save(0, 'split')
    }
  }
  sets.forEach((id, k) => console.log('fps with three panes', id, runs[k].join(' '), 'median', runs[k].slice().sort((a, b) => a - b)[2]))
  check(!errors.length, 'page errors', errors)

  for (const tab of await tabs()) await win.evaluate(id => window.skinned.closeTab(id), tab.id)
  await sleep(1500)
  await app.close().catch(() => {})
  console.log('done')
})().catch(e => { console.error(e); console.error(errors.join('\n')); process.exit(1) })
