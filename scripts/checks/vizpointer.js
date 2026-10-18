'use strict'
// Live check of the visualization's pointer (decision 0015) under
// xvfb-run:
//   node scripts/checks/vizpointer.js OUT
// One pane is shown in each mode in turn and clicked: the mode stays,
// and the mode answers, by its probe or by a tone in the pane's signal.
// A press held still on the quantum pane paints a barrier along the
// drag that follows, which fades, an immediate drag throws a packet and
// a click measures, a release throws a moon in gravity, a drag turns gravity3d's
// camera and throws nothing, and a click in a pane of a split window
// leaves every pane's mode as it was. No page or console error. Frames
// go to OUT/quantum-*.png. Fakes only.
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
  const state = () => viz.evaluate(() => window.vizState())
  const pane = async () => (await state()).panes[0]
  async function show (id) {
    check((await win.evaluate(m => window.skinned.selectViz(m), id)).ok, `the menu refused ${id}`)
    const p = await until(pane, p => p && p.mode === id, 30000)
    check(p.mode === id, `want ${id} shown`, p)
    await sleep(600)
    return p
  }

  // Every mode: a click at the pane's centre, then near a corner, for
  // go, whose centre may hold a stone. The gravity modes' waves and
  // Gravity 3D's trace, lens records, camera and holes' places, which
  // change every frame, are not the click's answer.
  const answer = q => {
    const { pair, sources, trace, lens, hole, cam, at, ...rest } = q || {}
    return JSON.stringify(rest)
  }
  for (const m of MODES) {
    const p = await show(m.id)
    const before = p.probe
    const spots = [[0.5, 0.5], [0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]]
    let after = null
    let tones = 0
    for (const [u, v] of spots) {
      await viz.mouse.click(p.x + p.w * u, p.y + p.h * v)
      after = await pane()
      tones = Math.max(tones, after.touches)
      if (before ? answer(after.probe) !== answer(before) : tones > 0) break
    }
    console.log(m.id, JSON.stringify({ before, after: after.probe, tones }))
    check(after.mode === m.id, `${m.id}: a click stepped the mode`, after.mode)
    if (before) check(answer(after.probe) !== answer(before), `${m.id}: the probe did not change`, after.probe)
    else check(tones > 0, `${m.id}: no tone for the click`)
  }

  // Quantum: a press held still arms the brush, and the drag then paints
  // across the middle third, along the grid's long side.
  let p = await show('quantum')
  const turn = p.h > p.w
  const at = k => turn ? [p.x + p.w / 2, p.y + p.h * (0.35 + 0.3 * k)] : [p.x + p.w * (0.35 + 0.3 * k), p.y + p.h / 2]
  const drawn = p.probe
  await viz.mouse.move(...at(0))
  await viz.mouse.down()
  await sleep(400)
  const armed = (await pane()).probe
  await viz.mouse.move(...at(1), { steps: 12 })
  const mid = (await pane()).probe
  await viz.mouse.up()
  const done = (await pane()).probe
  await viz.screenshot({ path: path.join(out, 'quantum-barrier.png') })
  console.log('quantum held drag', JSON.stringify({ drawn, armed, mid, done }))
  check(armed.strokes === drawn.strokes + 1 && armed.barrier > 2, 'want the brush armed by the hold', armed)
  check(done.strokes === drawn.strokes + 1 && done.throws === drawn.throws && done.pokes === drawn.pokes, 'want one stroke and nothing else for the held drag', done)
  check(mid.cells > 0 && mid.barrier > 2, 'want a barrier while dragging', mid)
  // The middle third of the long side is about 40 of 128 points, and the
  // ridge is about two points wide.
  check(done.cells >= 40, 'want a barrier along the drag', done)
  // An immediate drag throws a packet and paints nothing.
  await viz.mouse.move(...at(0.2))
  await viz.mouse.down()
  await viz.mouse.move(...at(0.7), { steps: 6 })
  await viz.screenshot({ path: path.join(out, 'quantum-aim.png') })
  await viz.mouse.up()
  const thrown = (await pane()).probe
  console.log('quantum drag', JSON.stringify(thrown))
  check(thrown.throws === done.throws + 1 && thrown.strokes === done.strokes && thrown.pokes === done.pokes, 'want a throw for the drag', thrown)
  // A click measures.
  await viz.mouse.click(...at(0.5))
  const poked = (await pane()).probe
  console.log('quantum click', JSON.stringify(poked))
  check(poked.pokes === thrown.pokes + 1 && poked.strokes === thrown.strokes && poked.throws === thrown.throws, 'want a measurement for the click', poked)
  await viz.screenshot({ path: path.join(out, 'quantum-poked.png') })
  await sleep(4000)
  const later = (await pane()).probe
  console.log('quantum after 5 s', JSON.stringify(later))
  check(later.barrier > 0 && later.barrier < 0.5 * done.barrier, 'want the barrier fading', later)
  await viz.screenshot({ path: path.join(out, 'quantum-fading.png') })
  const gone = await until(async () => (await pane()).probe, q => q.barrier === 0, 20000, 500)
  console.log('quantum later', JSON.stringify(gone))
  check(gone.barrier === 0 && gone.cells === 0, 'want the barrier gone', gone)

  // Gravity: a drag throws a moon at its release.
  p = await show('gravity')
  const g0 = p.probe
  await viz.mouse.move(p.x + p.w * 0.2, p.y + p.h * 0.2)
  await viz.mouse.down()
  await viz.mouse.move(p.x + p.w * 0.35, p.y + p.h * 0.2, { steps: 6 })
  check((await pane()).probe.thrown === g0.thrown, 'gravity threw before the release')
  await viz.mouse.up()
  const g1 = (await pane()).probe
  console.log('gravity drag', JSON.stringify({ g0, g1 }))
  check(g1.thrown === g0.thrown + 1, 'want a moon thrown at the release', g1)

  // Gravity 3D: a drag turns the camera and throws nothing.
  p = await show('gravity3d')
  const c0 = p.probe
  await viz.mouse.move(p.x + p.w * 0.3, p.y + p.h * 0.5)
  await viz.mouse.down()
  await viz.mouse.move(p.x + p.w * 0.6, p.y + p.h * 0.4, { steps: 8 })
  await viz.mouse.up()
  const c1 = (await pane()).probe
  console.log('gravity3d drag', JSON.stringify({ c0, c1 }))
  check(c1.turns === c0.turns + 1 && c1.thrown === c0.thrown, 'want the camera turned and no moon thrown', c1)

  // A split window: a click in pane 2 steps no pane.
  for (let i = 0; i < 2; i++) await win.evaluate(() => window.skinned.newTab())
  let s = await until(state, s => s.panes.length === 3 && s.panes.every(q => q.mode), 30000)
  check(s.panes.length === 3, 'want three panes', s.panes)
  await sleep(1000)
  s = await state()
  const q = s.panes[1]
  await viz.mouse.click(q.x + q.w / 2, q.y + q.h / 2)
  await sleep(600)
  const t = await state()
  console.log('split click', JSON.stringify({ before: s.panes.map(x => x.mode), after: t.panes.map(x => x.mode) }))
  check(t.panes.map(x => x.mode).join() === s.panes.map(x => x.mode).join(), 'a click in a split window stepped a pane', t.panes.map(x => x.mode))

  console.log('errors', JSON.stringify(errors))
  check(errors.length === 0, 'want no page or console error', errors)
  for (const tab of (await win.evaluate(() => window.skinned.tabs())).tabs) await win.evaluate(id => window.skinned.closeTab(id), tab.id)
  await sleep(2000)
  await app.close().catch(() => {})
  console.log('done')
})().catch(e => { console.error(e, '\nerrors', JSON.stringify(errors)); process.exit(1) })
