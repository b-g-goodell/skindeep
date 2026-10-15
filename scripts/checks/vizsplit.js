'use strict'
/* global requestAnimationFrame */
// Live check of the viz window's panes (decision 0015) under xvfb-run:
//   node scripts/checks/vizsplit.js OUT
// One pane per tab, distinct modes, a click steps the pane under it
// alone, the menu's pick the active tab's, a closed tab's pane goes, and
// more butterchurn panes than the cap show the scope. Fakes only.
// Every read of the page waits, bounded, for the state it asserts: a
// pane that turns to butterchurn compiles its preset in software GL,
// which under host load takes seconds per pane.
const { launch, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const fake = path.join(__dirname, '..', 'fake', 'claude')
fs.mkdirSync(out, { recursive: true })

function check (ok, msg, seen) {
  if (!ok) throw new Error(seen === undefined ? msg : `${msg}, saw ${JSON.stringify(seen)}`)
}

// get() once ok(value) holds, else after ms the last value seen.
async function until (get, ok, ms, step = 250) {
  const t0 = Date.now()
  let v = await get()
  while (!ok(v) && Date.now() - t0 < ms) {
    await sleep(step)
    v = await get()
  }
  return v
}

const brief = s => s.panes.map(p => [p.tab, p.mode, p.milk, p.active ? 'active' : ''])

;(async () => {
  const { app, win } = await launch([fake], { appArgs: ['--skin', 'deck'], env: { SKINNED_GL: 'swiftshader' } })
  let viz = null
  for (let i = 0; i < 40 && !viz; i++) {
    await sleep(250)
    for (const w of app.windows()) if (w.url().includes('/viz/')) viz = w
  }
  check(viz, 'no viz window')
  await viz.waitForFunction(() => typeof window.vizState === 'function', null, { timeout: 30000 })
  const state = () => viz.evaluate(() => window.vizState())
  const tabs = () => win.evaluate(() => window.skinned.tabs())
  const panes = (ok, ms = 30000) => until(state, ok, ms)
  let s = await panes(s => s.panes.length === 1 && s.panes[0].mode)
  console.log('one', JSON.stringify(s.panes))
  check(s.panes.length === 1, 'want one pane', brief(s))

  for (let i = 0; i < 2; i++) await win.evaluate(() => window.skinned.newTab())
  s = await panes(s => s.panes.length === 3 && s.panes.every(p => p.mode) && s.panes[2].active)
  console.log('three', JSON.stringify(s.panes))
  check(s.panes.length === 3 && new Set(s.panes.map(p => p.mode)).size === 3, 'want three panes in three modes', brief(s))
  check(s.panes.map(p => p.place).join() === '1,2,3' && s.panes[2].active, 'want the panes in strip order, the third active', brief(s))
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
  const t = await panes(t => t.panes[1].mode !== p2.mode)
  console.log('after click', JSON.stringify(t.panes.map(p => p.mode)))
  check(t.panes[1].mode !== p2.mode && t.panes[0].mode === s.panes[0].mode && t.panes[2].mode === s.panes[2].mode, 'a click in pane 2 must step pane 2 alone', brief(t))

  const r = await win.evaluate(() => window.skinned.selectViz('scope'))
  const u = await panes(u => u.panes[2].mode === 'scope')
  check(r.ok && u.panes[2].mode === 'scope' && u.panes[1].mode === t.panes[1].mode, 'the menu\'s pick must change the active tab\'s pane alone', { r, panes: brief(u) })

  const first = (await tabs()).tabs[0].id
  await win.evaluate(id => window.skinned.closeTab(id), first)
  s = await panes(s => s.panes.length === 2)
  console.log('after close', JSON.stringify(s.panes))
  check(s.panes.length === 2 && !s.panes.some(p => p.tab === first) && s.panes.map(p => p.place).join() === '1,2', 'want the closed tab\'s pane gone', brief(s))

  // Ten panes, each picked to drift: eight butterchurns, two scopes. Each
  // tab's pick is waited for before the next, and the waits are logged.
  for (let n = 3; n <= 10; n++) {
    await win.evaluate(() => window.skinned.newTab())
    s = await panes(s => s.panes.length === n && s.panes.every(p => p.mode))
    check(s.panes.length === n, `want ${n} panes`, brief(s))
  }
  const waits = []
  for (const tab of (await tabs()).tabs) {
    let t0 = Date.now()
    await win.evaluate(id => window.skinned.activateTab(id), tab.id)
    const a = await until(tabs, t => t.active === tab.id, 10000)
    check(a.active === tab.id, `want tab ${tab.id} active`, { active: a.active, tabs: a.tabs.map(x => x.id) })
    const activated = Date.now() - t0
    t0 = Date.now()
    const r = await win.evaluate(() => window.skinned.selectViz('drift'))
    check(r.ok, `want drift picked for tab ${tab.id}`, r)
    const d = await panes(s => s.panes.some(p => p.tab === tab.id && p.mode === 'drift'))
    check(d.panes.some(p => p.tab === tab.id && p.mode === 'drift'), `want tab ${tab.id}'s pane on drift`, brief(d))
    waits.push([tab.id, activated, Date.now() - t0])
  }
  console.log('waits [tab, activate ms, drift ms]', JSON.stringify(waits))
  const ten = s => s.panes.length === 10 && s.panes.every(p => p.mode === 'drift') && s.panes.filter(p => p.milk).length === 8
  s = await panes(ten, 60000)
  console.log('ten', JSON.stringify(s.panes.map(p => [p.mode, p.milk])))
  check(ten(s), 'want ten drift panes, eight of them butterchurn', brief(s))
  await viz.screenshot({ path: path.join(out, 'ten.png') })

  for (const tab of (await tabs()).tabs) await win.evaluate(id => window.skinned.closeTab(id), tab.id)
  await sleep(2000)
  await app.close().catch(() => {})
  console.log('done')
})().catch(e => { console.error(e); process.exit(1) })
