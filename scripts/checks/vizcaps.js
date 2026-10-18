'use strict'
// Live check of the visualization's two caps in File, Settings
// (decisions 0036 and 0015) under xvfb-run:
//   node scripts/checks/vizcaps.js OUT
// One pane, fed by the fake claude. Sharpness: in Gravity 3D, at the
// default, at 135000 and at 15000 px a pane, the traced frame is the
// size the formula of decision 0015 gives for that cap, from the pane's
// size and the window's, and grows with the cap. Frame rate: in Drift,
// uncapped, at 15 and uncapped again without a reopen, and in Scope at
// 15, the frames the page draws are counted over SPAN ms beside the
// display frames it is offered (raw). At 15 it draws at most 15 a
// second, one frame of slack, at every load, and butterchurn's clock
// keeps wall time within 15 percent. Where the host offers BIND times
// the cap or more, the cap is shown: uncapped draws more than BIND
// times 15 a second, at 15 at least 0.8 of 15, and the synthesiser's
// clock keeps wall time within 10 percent. Where it offers fewer, as
// on a loaded host, the run says the cap does not bind there, and the
// clock is held to the page's bound of 0.1 s a frame drawn: between
// 0.6 and 1.05 times min(1, 0.1 fps). Every setting goes through the
// main window's settings api, as the menu's pick does. No page or
// console error. Fakes only. Frames go to OUT/caps-<case>.png.
const { launch, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const fake = path.join(__dirname, '..', 'fake', 'claude')
fs.mkdirSync(out, { recursive: true })
const errors = []

function check (ok, msg, seen) {
  if (!ok) throw new Error(seen === undefined ? msg : `${msg}, saw ${JSON.stringify(seen)}`)
}

// The span each rate is read over, in ms, the cap, and the display
// frames a second, over the cap, at which the cap binds.
const SPAN = 4000
const CAP = 15
const BIND = 1.3

;(async () => {
  const { app, win } = await launch([fake], { appArgs: ['--skin', 'deck'], env: { SKINNED_GL: 'swiftshader', XDG_STATE_HOME: path.join(out, 'state') } })
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
  const set = async (id, v) => check((await win.evaluate(([id, v]) => window.skinned.setSetting(id, v), [id, v])).ok, `the settings refused ${id} ${v}`)
  async function mode (id) {
    check((await win.evaluate(m => window.skinned.selectViz(m), id)).ok, `the menu refused ${id}`)
    for (let i = 0; i < 300 && (await state()).panes[0].mode !== id; i++) await sleep(100)
    check((await state()).panes[0].mode === id, `want ${id} shown`)
  }

  // Over SPAN: the display frames a second the page is offered (raw),
  // the frames it draws a second, and the pane's clocks' seconds a
  // second of the page's own clock.
  async function rate () {
    return viz.evaluate(ms => new Promise(resolve => {
      const read = () => { const s = window.vizState(); return { t: performance.now(), drawn: s.drawn, cap: s.cap, clock: s.panes[0].clock, milk: s.panes[0].milkTime } }
      const a = read()
      let raw = 0
      const count = () => {
        raw++
        if (performance.now() - a.t < ms) return requestAnimationFrame(count)
        const b = read()
        const secs = (b.t - a.t) / 1000
        const r = x => Math.round(x * 1000) / 1000
        resolve({ cap: b.cap, secs: r(secs), raw: r(raw / secs), frames: b.drawn - a.drawn, fps: r((b.drawn - a.drawn) / secs), clock: r((b.clock - a.clock) / secs), milk: a.milk === null || b.milk === null ? null : r((b.milk - a.milk) / secs) })
      }
      requestAnimationFrame(count)
    }), SPAN)
  }
  const binds = q => q.raw >= BIND * CAP
  // The clock where the cap binds, at wall time, and elsewhere within
  // the page's bound of 0.1 s a frame drawn.
  function clocked (q, where) {
    if (binds(q)) return check(Math.abs(q.clock - 1) < 0.1, `${where}: want the clock at wall time`, q)
    const most = Math.min(1, 0.1 * q.fps)
    check(q.clock >= 0.6 * most && q.clock <= 1.05 * most, `${where}: want the clock between 0.6 and 1.05 of ${most}`, q)
  }

  await sleep(2000)

  // The traced frame at pane cap P: k = min(1, max(sqrt(P / wh),
  // sqrt(3P / max(A, wh)))), A the window in device pixels.
  await mode('gravity3d')
  await sleep(2000)
  async function traced (px, tag) {
    if (px !== undefined) await set('viz.trace', px)
    await sleep(1500)
    const s = await viz.evaluate(() => { const s = window.vizState(); const p = s.panes[0]; return { trace: s.trace, w: p.w, h: p.h, area: innerWidth * innerHeight * (devicePixelRatio || 1) ** 2, tw: p.probe.trace.w, th: p.probe.trace.h } })
    const P = px || 30000
    const k = Math.min(1, Math.max(Math.sqrt(P / (s.w * s.h)), Math.sqrt(3 * P / Math.max(s.area, s.w * s.h))))
    const want = [Math.ceil(s.w * k), Math.ceil(s.h * k)]
    console.log('gravity3d', tag, JSON.stringify(Object.assign(s, { k: Math.round(k * 1000) / 1000, want })))
    await shot(viz, path.join(out, `caps-gravity3d-${tag}.png`))
    check(s.trace === P, `want the page's trace at ${P}`, s)
    check(s.tw === want[0] && s.th === want[1], `want the trace at ${want.join(' by ')} at ${tag}`, s)
    return s.tw * s.th
  }
  const base = await traced(undefined, 'default')
  const sharp = await traced(135000, '135000')
  const soft = await traced(15000, '15000')
  await set('viz.trace', null)
  console.log('traced pixels', JSON.stringify({ soft, base, sharp }))
  check(soft < base && base < sharp, 'want the traced frame to grow with the cap', { soft, base, sharp })

  // The frame rate in Drift, whose butterchurn draws on the GPU and
  // leaves the page the display's frames, where Scope's Canvas2D under
  // software GL takes most of them. Butterchurn's clock follows its own
  // estimate of the frame rate, which settles over its first frames.
  async function measure (id, wait, tag) {
    await mode(id)
    await sleep(wait)
    const q = await rate()
    console.log(tag, JSON.stringify(q))
    await shot(viz, path.join(out, `caps-${tag.replace(/ /g, '-')}.png`))
    check(q.cap === (tag.includes('at 15') ? CAP : 0), `${tag}: want the page's cap`, q)
    clocked(q, tag)
    return q
  }
  const free = await measure('drift', 3000, 'drift uncapped')
  if (binds(free)) check(free.fps > BIND * CAP, `want more than ${BIND * CAP} frames a second uncapped`, free)

  await set('viz.fps', CAP)
  const capped = await measure('drift', 8000, 'drift at 15')
  check(capped.milk !== null, 'want Drift drawn by butterchurn', capped)
  check(capped.frames <= CAP * capped.secs + 1, 'want at most 15 frames a second at 15', capped)
  if (binds(capped)) check(capped.fps >= 0.8 * CAP, 'want 0.8 of 15 frames a second at least at 15', capped)
  check(Math.abs(capped.milk - 1) < 0.15, 'want butterchurn\'s clock at wall time at 15', capped)

  const flat = await measure('scope', 1500, 'scope at 15')
  check(flat.frames <= CAP * flat.secs + 1, 'want at most 15 frames a second at 15 in Scope', flat)

  await set('viz.fps', null)
  const back = await measure('drift', 3000, 'drift uncapped again')
  if (binds(back)) check(back.fps > BIND * CAP, `want more than ${BIND * CAP} frames a second uncapped again`, back)
  const all = [free, capped, back]
  console.log(all.every(binds) ? `cap shown: ${free.fps} frames a second uncapped, ${capped.fps} at 15, ${back.fps} uncapped again` : `host at ${Math.min(...all.map(q => q.raw))} display frames a second: the cap does not bind in every run`)

  console.log('errors', JSON.stringify(errors))
  check(errors.length === 0, 'want no page or console error', errors)
  for (const tab of (await win.evaluate(() => window.skinned.tabs())).tabs) await win.evaluate(id => window.skinned.closeTab(id), tab.id)
  await sleep(2000)
  await app.close().catch(() => {})
  console.log('done')
})().catch(e => { console.error(e, '\nerrors', JSON.stringify(errors)); process.exit(1) })
