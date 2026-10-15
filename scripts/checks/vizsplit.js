'use strict'
/* global requestAnimationFrame */
// Live check of the viz window's panes (decision 0015) under xvfb-run:
//   node scripts/checks/vizsplit.js OUT
// One pane per tab, distinct modes, a click steps the pane under it
// alone, the menu's pick the active tab's, a closed tab's pane goes, and
// more butterchurn panes than the cap show the scope. Fakes only.
const { launch, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const fake = path.join(__dirname, '..', 'fake', 'claude')
fs.mkdirSync(out, { recursive: true })

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

;(async () => {
  const { app, win } = await launch([fake], { appArgs: ['--skin', 'deck'], env: { SKINNED_GL: 'swiftshader' } })
  let viz = null
  for (let i = 0; i < 40 && !viz; i++) {
    await sleep(250)
    for (const w of app.windows()) if (w.url().includes('/viz/')) viz = w
  }
  check(viz, 'no viz window')
  const state = () => viz.evaluate(() => window.vizState())
  const tabs = () => win.evaluate(() => window.skinned.tabs())
  await sleep(2000)
  let s = await state()
  console.log('one', JSON.stringify(s.panes))
  check(s.panes.length === 1, 'want one pane')

  for (let i = 0; i < 2; i++) {
    await win.evaluate(() => window.skinned.newTab())
    await sleep(1500)
  }
  s = await state()
  console.log('three', JSON.stringify(s.panes))
  check(s.panes.length === 3 && new Set(s.panes.map(p => p.mode)).size === 3, 'want three panes in three modes')
  check(s.panes.map(p => p.place).join() === '1,2,3' && s.panes[2].active, 'want the panes in strip order, the third active')
  await sleep(2000)
  await viz.screenshot({ path: path.join(out, 'three.png') })

  const fps = await viz.evaluate(() => new Promise(resolve => {
    let n = 0
    const t0 = performance.now()
    const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else resolve(n / 2) }
    requestAnimationFrame(f)
  }))
  console.log('fps with three panes', fps)

  const p2 = s.panes[1]
  await viz.mouse.click(p2.x + p2.w / 2, p2.y + p2.h / 2)
  await sleep(800)
  const t = await state()
  console.log('after click', JSON.stringify(t.panes.map(p => p.mode)))
  check(t.panes[1].mode !== p2.mode && t.panes[0].mode === s.panes[0].mode && t.panes[2].mode === s.panes[2].mode, 'a click in pane 2 must step pane 2 alone')

  const r = await win.evaluate(() => window.skinned.selectViz('scope'))
  await sleep(800)
  const u = await state()
  check(r.ok && u.panes[2].mode === 'scope' && u.panes[1].mode === t.panes[1].mode, 'the menu\'s pick must change the active tab\'s pane alone')

  const first = (await tabs()).tabs[0].id
  await win.evaluate(id => window.skinned.closeTab(id), first)
  await sleep(1500)
  s = await state()
  console.log('after close', JSON.stringify(s.panes))
  check(s.panes.length === 2 && !s.panes.some(p => p.tab === first) && s.panes.map(p => p.place).join() === '1,2', 'want the closed tab\'s pane gone')

  // Ten panes, each picked to drift: eight butterchurns, two scopes.
  while ((await state()).panes.length < 10) {
    await win.evaluate(() => window.skinned.newTab())
    await sleep(900)
  }
  for (const tab of (await tabs()).tabs) {
    await win.evaluate(id => window.skinned.activateTab(id), tab.id)
    await sleep(200)
    await win.evaluate(() => window.skinned.selectViz('drift'))
    await sleep(300)
  }
  await sleep(2000)
  s = await state()
  console.log('ten', JSON.stringify(s.panes.map(p => [p.mode, p.milk])))
  check(s.panes.length === 10 && s.panes.every(p => p.mode === 'drift') && s.panes.filter(p => p.milk).length === 8, 'want ten drift panes, eight of them butterchurn')
  await viz.screenshot({ path: path.join(out, 'ten.png') })

  for (const tab of (await tabs()).tabs) await win.evaluate(id => window.skinned.closeTab(id), tab.id)
  await sleep(2000)
  await app.close().catch(() => {})
  console.log('done')
})().catch(e => { console.error(e); process.exit(1) })
