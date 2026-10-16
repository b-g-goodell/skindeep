'use strict'
/* global requestAnimationFrame */
// Live check of the Carbon mode (decision 0015, issue #144) under
// xvfb-run:
//   node scripts/checks/vizcarbon.js OUT
// One pane in Carbon on a 1200 by 760 window, fed by the fake claude's
// turns, is watched by its probe and captured: the drawn atom's jump
// with its source flashing, visible fronts, ultraviolet and infrared
// fronts, and the spectrum after the run. Then every pane's signal is
// held at full activity, by an override of Synth's step in the page,
// and a frame with hundreds of fronts is captured. Then each of Carbon,
// Gravity and Quantum drawn alone on a 400 by 380 canvas at full
// activity, fed through Synth's input: the median cost of a draw. Then
// three panes of a 720 by 460 window all in one of those modes, five
// rounds in turn, each set's median frame rate, as vizmodes.js counts
// its sets, first on the fake session's own activity, then at full
// activity. Then four panes of 360 by 230, all in Carbon. At every
// frame captured, in the one pane of 1200 by 760, in each Carbon pane
// of the split and of the four, no two texts overlap: the ink box of
// every text the probe reports and the box of the pane's drop-down.
// No page or console error. Frames go to OUT/carbon-<phase>.png. Fakes
// only.
const { launch, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
// The event clock's slowing from 1e6 (issue #166): the field fills the
// ensemble that many times slower.
const SLOW = require('../../app/viz/carbon').EVENT / 1e6
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
  // Pane j's canvas as a PNG file, and every Carbon pane's texts
  // measured.
  async function save (j, name) {
    const png = await viz.evaluate(j => document.querySelectorAll('.pane')[j].querySelector('canvas:not([hidden])').toDataURL('image/png'), j)
    fs.writeFileSync(path.join(out, `carbon-${name}.png`), Buffer.from(png.split(',')[1], 'base64'))
    await overlap(name)
  }
  // Two texts overlap where their boxes share more than half a pixel
  // each way, below which ink boxes only touch.
  const overlaps = []
  const sizes = new Set()
  async function overlap (name) {
    const picks = await viz.evaluate(() => [...document.querySelectorAll('.pane')].map(e => {
      const r = e.getBoundingClientRect()
      const b = e.querySelector('.pick').getBoundingClientRect()
      return { x: r.x, y: r.y, pick: { t: '(drop-down) ' + e.querySelector('.pick').textContent, x: b.x - r.x, y: b.y - r.y, w: b.width, h: b.height } }
    }))
    for (const p of (await state()).panes) {
      if (p.mode !== 'carbon' || !p.probe || !p.probe.texts) continue
      const pick = picks.find(q => q.x === p.x && q.y === p.y)
      const boxes = p.probe.texts.filter(b => b.w > 0 && b.h > 0).concat(pick ? [pick.pick] : [])
      sizes.add(`${p.w}x${p.h}`)
      for (let i = 0; i < boxes.length; i++) {
        for (let k = i + 1; k < boxes.length; k++) {
          const a = boxes[i]
          const b = boxes[k]
          const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
          const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
          if (ox > 0.5 && oy > 0.5) {
            const o = { frame: name, pane: `${p.w}x${p.h}`, a, b }
            overlaps.push(o)
            console.log('overlap', JSON.stringify(o))
          }
        }
      }
    }
  }

  await sleep(1500)
  await size(1200, 760)
  await assign((await tabs())[0].id, 'carbon')
  await sleep(1000)

  // Watch the probe and keep the first frame of each phase.
  const want = {
    source: p => p.source,
    visible: p => p.visible >= 2,
    uv: p => p.uv >= 6,
    ir: p => p.ir >= 6
  }
  const got = {}
  const t0 = Date.now()
  let probe = null
  let clicks = 0
  while (Object.keys(got).length < Object.keys(want).length && Date.now() - t0 < 150000) {
    const p = (await state()).panes[0]
    probe = p.probe
    for (const [k, ok] of Object.entries(want)) {
      if (got[k] || !ok(probe)) continue
      await save(0, k)
      got[k] = true
      console.log('frame', k, JSON.stringify(probe))
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
  console.log('after', Math.round((Date.now() - t0) / 1000), 's', JSON.stringify(probe))
  for (const k of Object.keys(want)) check(got[k], `no ${k} frame`)
  check(probe.photons > 0 && probe.detected > 0 && probe.lit > 0, 'want photons emitted, detected and lit', probe)
  check(probe.clicks === clicks, 'want every click counted', probe)

  // Full activity in every pane, then a frame with hundreds of fronts.
  await viz.evaluate(() => {
    const S = window.Synth.Synth.prototype
    if (S.held) return
    S.held = S.step
    S.step = function (dt, sound) {
      S.held.call(this, dt, sound)
      Object.assign(this.level, { bass: 1, treble: 1, busy: 1, idle: 0 })
    }
  })
  let busy = null
  for (let i = 0; i < 100 * SLOW && !busy; i++) {
    await sleep(100)
    const p = (await state()).panes[0].probe
    if (p.fronts >= 60) busy = p
  }
  check(busy, 'want 60 fronts at once at full activity')
  await save(0, 'busy')
  console.log('frame busy', JSON.stringify(busy))

  // Each mode drawn alone on a canvas of 400 by 380, its own signal at
  // full activity, 240 frames after 300 of warm-up: the median cost of a
  // draw, and Carbon's fronts at the end.
  const cost = await viz.evaluate(() => {
    const out = {}
    for (const id of ['carbon', 'gravity', 'quantum']) {
      const c = document.createElement('canvas')
      c.width = 400
      c.height = 380
      const r = window.VizCanvas[id](c)
      const s = new window.Synth.Synth()
      const ms = []
      for (let i = 0; i < 540; i++) {
        s.input({ n: [5000, 0, 0, 200, 1, 0, 0], e: i % 40 === 0 ? [i % 80 ? 2 : 3, 0] : [] })
        s.step(1 / 60, null)
        const t0 = performance.now()
        r.draw(s, 1 / 60)
        if (i >= 300) ms.push(performance.now() - t0)
      }
      ms.sort((a, b) => a - b)
      out[id] = Math.round(ms[ms.length >> 1] * 100) / 100
      if (r.probe && id === 'carbon') out.fronts = r.probe().fronts
    }
    return out
  })
  console.log('median ms a draw at full activity, alone at 400x380', JSON.stringify(cost))

  // Three panes, as vizmodes.js measures its sets.
  await size(720, 460)
  while ((await state()).panes.length < 3) {
    await win.evaluate(() => window.skinned.newTab())
    await sleep(900)
  }
  const sets = ['carbon', 'gravity', 'quantum']
  // The fake session's own activity first, then full activity.
  await viz.evaluate(() => {
    const S = window.Synth.Synth.prototype
    if (S.held) S.step = S.held
    delete S.held
  })
  for (const full of [false, true]) {
    if (full) {
      await viz.evaluate(() => {
        const S = window.Synth.Synth.prototype
        S.held = S.step
        S.step = function (dt, sound) {
          S.held.call(this, dt, sound)
          Object.assign(this.level, { bass: 1, treble: 1, busy: 1, idle: 0 })
        }
      })
    }
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
        if (round === 0 && id === 'carbon') {
          await save(0, full ? 'split-full' : 'split')
          if (full) console.log('split pane at full activity', JSON.stringify((await state()).panes[0].probe))
        }
      }
    }
    sets.forEach((id, k) => console.log('fps with three panes', full ? 'full activity' : 'session', id, runs[k].join(' '), 'median', runs[k].slice().sort((a, b) => a - b)[2]))
  }
  // Four panes of 360 by 230, all in Carbon at full activity.
  while ((await state()).panes.length < 4) {
    await win.evaluate(() => window.skinned.newTab())
    await sleep(900)
  }
  while ((await tabs()).length > 4) {
    await win.evaluate(id => window.skinned.closeTab(id), (await tabs()).pop().id)
    await sleep(900)
  }
  for (const id of (await tabs()).map(t => t.id)) await assign(id, 'carbon')
  await sleep(2500)
  await save(0, 'quarter')
  console.log('texts measured in panes of', [...sizes].join(' '), 'overlaps', overlaps.length)
  for (const s of ['1200x760', '360x230']) check(sizes.has(s), `want texts measured at ${s}`, [...sizes])
  check(!overlaps.length, `${overlaps.length} overlapping pairs of texts, the first`, overlaps[0])
  check(!errors.length, 'page errors', errors)

  for (const tab of await tabs()) await win.evaluate(id => window.skinned.closeTab(id), tab.id)
  await sleep(1500)
  await app.close().catch(() => {})
  console.log('done')
})().catch(e => { console.error(e); console.error(errors.join('\n')); process.exit(1) })
