'use strict'
// Live check of Gravity 3D's optics on its bodies and holes (issue #170,
// decision 0015) under xvfb-run:
//   node scripts/checks/vizlens.js OUT
// One pane in Gravity 3D, fed by the fake claude, in a 1200 by 760
// window and then a 360 by 230 one. A drag levels the camera with the
// central hole's equator, and a click throws a moon on an orbit about
// the hole in that plane, so it passes behind the hole once a turn. At a
// frame where the probe reports a body behind a hole within u = 0.5 of
// its line, its unlensed disc and glow wholly inside the hole's shadow,
// so that a straight ray would hide it, pixels of the frame outside
// the shadow show it: the mode drew that frame again without the body,
// the control, and chose up to 8 points where the two whole frames
// differ most, after everything nearer was drawn. Here the pane's
// canvas is read at those points against the control's colours: at
// three quarters of them at least, one at least, it differs by 16 in a
// channel or more, which only the body's light gives. A small pane's
// image of a moon may span only a few degrees about the hole, and so
// give fewer than 8 points. In the full pane its outer
// image is also an arc: its pixels spread across the line to the hole
// more than 1.5 times as far as along it. Then, in
// the full pane, once a hole of 100 or more joins the central one (a
// subagent adds one of 150 to 300), drags turn the camera until that
// hole lies behind the central one, its unlensed shadow wholly inside
// the central shadow, and the frame is read in the same way against a
// control traced without that hole: its image, the light it takes from
// what lies behind it, shows outside the central shadow. Three frames
// of each go to OUT/lens-<size>-<k>.png and OUT/lens-hole-full-<k>.png.
// At every frame read, the probe's audit shows each class of matter,
// dust, bodies, trails and flares, drawn whole on the slices of its
// depths, the planes the trace bends, and each was drawn in the run.
// No page or console error. Fakes only.
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

// In the page: the pane's record of a body, or with hole of a hole of
// 100 or more, and when it lies within u = 0.5 of a hole's line, hidden
// from straight rays, the frame, as a PNG, and the frame's colour at
// each of the record's points.
function frame (hole) {
  const p = window.vizState().panes[0]
  const l = p.probe && p.probe[hole ? 'hole' : 'lens']
  if (!l || l.u >= 0.5 || !l.hidden || (hole && l.m < 100)) return { lens: l || null, probe: p.probe }
  const c = [...document.querySelectorAll('.pane canvas:not([hidden])')][0]
  const g = c.getContext('2d')
  const seen = l.pts.map(([x, y]) => Array.from(g.getImageData(x, y, 1, 1).data.slice(0, 3)))
  return { lens: l, seen, png: c.toDataURL('image/png'), w: c.width, h: c.height, probe: p.probe }
}

// The points where the drawn frame differs from the control frame, drawn
// without the body or the hole, by 16 in a channel at least: the least
// step that shows on a dark ground.
function shown (f) {
  return f.lens.pts.filter((p, k) => Math.max(...f.lens.alt[k].map((v, i) => Math.abs(f.seen[k][i] - v))) >= 16).length
}

// Every frame the check reads: each class of matter, the dust, the
// bodies, the trails' pieces and the flares, drew all it had, each piece
// on the slice of its depth, so the trace bends each as it bends the
// others at that depth. A class drawn on any other slice, or not at
// all, is caught here. drew counts each class's pieces over the run.
const drew = { dust: 0, bodies: 0, trails: 0, flares: 0 }
function slices (probe, where) {
  const a = probe && probe.trace && probe.trace.slices
  check(a, `${where}: no slice audit`)
  for (const k of Object.keys(drew)) {
    const [n, off, want] = a[k]
    check(off === 0 && n === want, `${where}: ${k} off the slices of their depths`, a)
    drew[k] += n
  }
}

// The camera's turn and height that put hole b behind hole a, the camera
// 620 from the centre of mass on the line through them.
function behind (a, b) {
  const v = [0, 1, 2].map(i => a[i] - b[i])
  const A = v[0] ** 2 + v[1] ** 2 + v[2] ** 2
  const B = 2 * (b[0] * v[0] + b[1] * v[1] + b[2] * v[2])
  const C = b[0] ** 2 + b[1] ** 2 + b[2] ** 2 - 620 * 620
  const t = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A)
  const p = [0, 1, 2].map(i => b[i] + t * v[i])
  return { yaw: Math.atan2(p[1], p[0]), pitch: Math.asin(p[2] / 620) }
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
  const size = s => app.evaluate(({ BrowserWindow }, s) => {
    BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/viz/')).setContentSize(s[0], s[1])
  }, s)
  check((await win.evaluate(() => window.skinned.selectViz('gravity3d'))).ok, 'the menu refused gravity3d')
  for (let i = 0; i < 300 && (await pane()).mode !== 'gravity3d'; i++) await sleep(100)

  for (const [name, W, H] of [['full', 1200, 760], ['small', 360, 230]]) {
    await size([W, H])
    await sleep(1500)
    const p = await pane()
    check(p.mode === 'gravity3d', 'want gravity3d shown', p.mode)
    const cx = p.x + p.w / 2
    const cy = p.y + p.h / 2
    // A drag moves the camera's height 0.008 rad a pixel: drags level it.
    for (let i = 0; i < 6; i++) {
      const lift = Math.max(-0.4 * p.h, Math.min(0.4 * p.h, -(await pane()).probe.cam.pitch / 0.008))
      if (Math.abs(lift) < 6) break
      await viz.mouse.move(cx, cy)
      await viz.mouse.down()
      await viz.mouse.move(cx, cy + lift, { steps: 9 })
      await viz.mouse.up()
    }
    // A moon about 110 from the centre: the pane's scale is its focal
    // length, min(w, h) / 2 / tan(0.42), over the camera's distance 620.
    const k = Math.min(p.w, p.h) / 2 / Math.tan(0.42) / 620
    const thrown = (await pane()).probe.thrown
    await viz.mouse.click(cx + 110 * k, cy)
    check((await pane()).probe.thrown === thrown + 1, `${name}: no moon thrown`)

    const t0 = Date.now()
    const kept = []
    let last = null
    while (kept.length < 3 && Date.now() - t0 < 240000) {
      const f = await viz.evaluate(frame, false)
      slices(f.probe, name)
      last = f.lens
      if (f.png) {
        kept.push(f)
        fs.writeFileSync(path.join(out, `lens-${name}-${kept.length - 1}.png`), Buffer.from(f.png.split(',')[1], 'base64'))
        await sleep(300)
      } else await sleep(40)
    }
    check(kept.length === 3, `${name}: no body passed behind a hole within u 0.5 in 240 s`, last)
    for (const f of kept) {
      const l = f.lens
      const o = l.outer
      const aspect = o.pixels ? o.across / Math.max(0.5, o.radial) : 0
      const n = shown(f)
      console.log(name, `${f.w}x${f.h}`, JSON.stringify({ u: l.u, te: l.te, R: l.R, r: l.r, star: l.star, hidden: l.hidden, pixels: l.pixels, outer: o, aspect, shown: `${n} of ${l.pts.length}`, pts: l.pts, seen: f.seen, alt: l.alt }))
      check(l.pixels > 0, `${name}: the body behind the hole is hidden`, { ...l, pts: undefined, alt: undefined })
      check(l.pts.length && n >= 0.75 * l.pts.length, `${name}: the frame does not show the body's image`, { pts: l.pts, seen: f.seen, alt: l.alt })
      if (name === 'full') check(o.pixels > 0 && aspect > 1.5, `${name}: the outer image is not an arc`, { outer: o, aspect })
    }
    if (name !== 'full') continue

    // A hole behind the central one: wait for a second hole of 100 or
    // more, then turn the camera onto the line through the two, again
    // and again as they move, until three frames show it lensed.
    let st = null
    for (let i = 0; i < 1200; i++) {
      st = (await pane()).probe
      if (st.at.filter(h => h[3] >= 100).length >= 2) break
      await sleep(100)
    }
    const big = () => st.at.slice().sort((a, b) => b[3] - a[3])
    check(big().length >= 2 && big()[1][3] >= 100, 'full: no second hole of 100 or more in 120 s', st.at)
    const holes = []
    const t1 = Date.now()
    let lastHole = null
    while (holes.length < 3 && Date.now() - t1 < 180000) {
      const f = await viz.evaluate(frame, true)
      slices(f.probe, 'hole full')
      lastHole = f.lens
      if (f.png) {
        holes.push(f)
        fs.writeFileSync(path.join(out, `lens-hole-full-${holes.length - 1}.png`), Buffer.from(f.png.split(',')[1], 'base64'))
        await sleep(300)
        continue
      }
      st = f.probe
      const [a, b] = big()
      if (!b || b[3] < 100) {
        await sleep(100)
        continue
      }
      const want = behind(a, b)
      let dyaw = want.yaw - st.cam.yaw
      dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw))
      const dx = Math.max(-0.4 * p.w, Math.min(0.4 * p.w, -dyaw / 0.008))
      const dy = Math.max(-0.4 * p.h, Math.min(0.4 * p.h, (want.pitch - st.cam.pitch) / 0.008))
      if (Math.hypot(dx, dy) >= 6) {
        await viz.mouse.move(cx, cy)
        await viz.mouse.down()
        await viz.mouse.move(cx + dx, cy + dy, { steps: 4 })
        await viz.mouse.up()
      }
      await sleep(60)
    }
    check(holes.length === 3, 'full: no hole passed behind the central one within u 0.5 in 180 s', lastHole)
    for (const f of holes) {
      const l = f.lens
      const n = shown(f)
      console.log('hole full', JSON.stringify({ m: l.m, u: l.u, te: l.te, R: l.R, r: l.r, hidden: l.hidden, pixels: l.pixels, outer: l.outer, shown: `${n} of ${l.pts.length}`, pts: l.pts, seen: f.seen, alt: l.alt }))
      check(l.pixels > 0, 'full: the hole behind the hole is hidden', { ...l, pts: undefined, alt: undefined })
      check(l.pts.length && n >= 0.75 * l.pts.length, 'full: the frame does not show the hole\'s image', { pts: l.pts, seen: f.seen, alt: l.alt })
    }
  }

  console.log('drawn on their slices', JSON.stringify(drew))
  for (const k of Object.keys(drew)) check(drew[k] > 0, `no ${k} drawn in the run`, drew)
  console.log('errors', JSON.stringify(errors))
  check(errors.length === 0, 'want no page or console error', errors)
  for (const tab of (await win.evaluate(() => window.skinned.tabs())).tabs) await win.evaluate(id => window.skinned.closeTab(id), tab.id)
  await sleep(2000)
  await app.close().catch(() => {})
  console.log('done')
})().catch(e => { console.error(e, '\nerrors', JSON.stringify(errors)); process.exit(1) })
