'use strict'
// Live check of Gravity 3D's optics on its bodies and holes (issue #170,
// decision 0015) under xvfb-run:
//   node scripts/checks/vizlens.js OUT
// One pane in Gravity 3D, fed by the fake claude, in a 1200 by 760
// window and then a 360 by 230 one. A drag levels the camera with the
// central hole's equator, and a click throws a moon on an orbit about
// the hole in that plane, so it passes behind the hole once a turn. The
// moon is the one body judged: the mode records it alone, by its number
// (gravity3d judged), and a moon lost to a hole, a merger or the cap on
// bodies is thrown again. A frame is judged where the record puts the
// moon behind the heaviest hole, the one it orbits, within u = 0.5 of
// its line, its unlensed disc and glow wholly inside the hole's shadow,
// so that a straight ray would hide it, and its disc spans a radius of
// MIN_DISC = 1 pixel of the trace or more (its disc in the pane's
// pixels times the trace's scale k), and where its outer image falls 10
// pixels or more inside the pane. There, pixels of the frame outside
// the shadow show it. The mode drew that frame again without the body,
// the control, and chose up to 8 points where the two whole frames
// differ most, after everything nearer was drawn. Here the pane's
// canvas is read at those points against the control's colours: at
// three quarters of them at least, one at least, it differs by 16 in a
// channel or more, which only the body's light gives. A small pane's
// image of a moon may span only a few degrees about the hole, and so
// give fewer than 8 points. In the full pane its outer image is also an
// arc: its pixels spread across the line to the hole more than 1.5
// times as far as along it. Then, in the full pane, a drag that ends
// where it began holds the camera still for 4 s, and the check places a
// hole of 200 at rest with the central one, HOLE_Z beyond it and HOLE_X
// across the line of sight (gravity3d place), its unlensed shadow
// wholly inside the central shadow, the hole judged, and the frame is
// read in the same way against a control traced without that hole: its
// image, the light it takes from what lies behind it, shows outside the
// central shadow. A placed hole that drifts off the line or is lost is
// placed again. When an arm times out, the failure carries the probe's
// state: the bodies judged, the holes, what they have swallowed and the
// last record. Three frames of each go to OUT/lens-<size>-<k>.png and
// OUT/lens-hole-full-<k>.png. At every frame read, the probe's audit
// shows each class of matter, dust, bodies, trails and flares, painted
// whole, each piece on the slice that holds its depth, counted where it
// is painted, and each was painted in the run. No page or console
// error. Fakes only.
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

// The least radius of the judged body's disc, in pixels of the trace.
const MIN_DISC = 1
// The hole the check places: its mass, and how far beyond the central
// hole and across the line of sight.
const HOLE_M = 200
const HOLE_Z = 280
const HOLE_X = 10

// The probe's state when an arm times out.
function state (probe, rec) {
  if (!probe) return { probe: null }
  return { judged: probe.judged, thrown: probe.thrown, swallowed: probe.swallowed, at: probe.at, record: rec && { ...rec, pts: undefined, alt: undefined } }
}

// In the page: the pane's record of the body or the hole judged, and
// when it is the one judged, lies within u = 0.5 of the line of the
// heaviest hole, in front of it, hidden from straight rays, spans
// enough of the trace, and its outer image, te (u + sqrt(u^2 + 4)) / 2
// from the hole toward it, falls 10 pixels or more inside the pane, the
// frame, as a PNG, and the frame's colour at each of the record's
// points.
function frame ([hole, least]) {
  const p = window.vizState().panes[0]
  const l = p.probe && p.probe[hole ? 'hole' : 'lens']
  const id = p.probe && p.probe.judged[hole ? 'hole' : 'body']
  const heaviest = p.probe ? Math.max(...p.probe.at.map(h => h[3])) : 0
  if (!l || l.id !== id || l.by.m !== heaviest || l.u >= 0.5 || !l.hidden || l.disc * l.k < least) return { lens: l || null, probe: p.probe }
  const c = [...document.querySelectorAll('.pane canvas:not([hidden])')][0]
  const d = Math.hypot(l.x - l.hx, l.y - l.hy) || 1
  const out = l.te * (l.u + Math.sqrt(l.u * l.u + 4)) / 2
  const ix = l.hx + out * (l.x - l.hx) / d
  const iy = l.hy + out * (l.y - l.hy) / d
  if (ix < 10 || iy < 10 || ix > c.width - 10 || iy > c.height - 10) return { lens: l, probe: p.probe }
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
    const throwMoon = async () => {
      const thrown = (await pane()).probe.thrown
      await viz.mouse.click(cx + 110 * k, cy)
      const st = (await pane()).probe
      check(st.thrown === thrown + 1, `${name}: no moon thrown`)
      return st.judged.body
    }
    let moon = await throwMoon()

    const t0 = Date.now()
    const kept = []
    let last = null
    let probe = null
    let small = 0
    while (kept.length < 3 && Date.now() - t0 < 240000) {
      const f = await viz.evaluate(frame, [false, MIN_DISC])
      slices(f.probe, name)
      probe = f.probe
      last = f.lens
      if (f.png) {
        check(f.lens.id === moon && f.lens.kind === 'planet', `${name}: the record judged another body than the moon thrown`, state(probe, last))
        kept.push(f)
        fs.writeFileSync(path.join(out, `lens-${name}-${kept.length - 1}.png`), Buffer.from(f.png.split(',')[1], 'base64'))
        await sleep(300)
        continue
      }
      if (last && last.id === moon && last.hidden && last.u < 0.5 && last.disc * last.k < MIN_DISC) small++
      if (!probe.judged.live[0]) {
        console.log(name, 'the moon was lost, another thrown', JSON.stringify(state(probe, last)))
        moon = await throwMoon()
      }
      await sleep(40)
    }
    if (small) console.log(name, `frames of the moon hidden but under ${MIN_DISC} traced pixel, not judged: ${small}`)
    check(kept.length === 3, `${name}: the moon did not pass behind a hole within u 0.5 in 240 s`, state(probe, last))
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

    // A hole behind the central one: the camera held by a drag that
    // ends where it began, a hole placed beyond the central one, and its
    // frames read, the hole placed again if it is lost or leaves the
    // line before three frames show it.
    const hold = async () => {
      await viz.mouse.move(cx, cy)
      await viz.mouse.down()
      await viz.mouse.move(cx + 8, cy, { steps: 2 })
      await viz.mouse.move(cx, cy, { steps: 2 })
      await viz.mouse.up()
    }
    const placeHole = async () => {
      await hold()
      return viz.evaluate(([m, x, z]) => window.vizFlat(0).place('hole', m, x, 0, z), [HOLE_M, HOLE_X, HOLE_Z])
    }
    let hole = await placeHole()
    let placed = Date.now()
    let places = 1
    const holes = []
    const t1 = Date.now()
    let lastHole = null
    let probe2 = null
    while (holes.length < 3 && Date.now() - t1 < 60000) {
      const f = await viz.evaluate(frame, [true, 0])
      slices(f.probe, 'hole full')
      probe2 = f.probe
      lastHole = f.lens
      if (f.png) {
        check(f.lens.id === hole && f.lens.kind === 'hole', 'full: the record judged another hole than the one placed', state(probe2, lastHole))
        holes.push(f)
        fs.writeFileSync(path.join(out, `lens-hole-full-${holes.length - 1}.png`), Buffer.from(f.png.split(',')[1], 'base64'))
        await sleep(300)
        continue
      }
      if (!probe2.judged.live[1] || Date.now() - placed > 3000) {
        console.log('hole full', 'placed again', JSON.stringify(state(probe2, lastHole)))
        hole = await placeHole()
        placed = Date.now()
        places++
      }
      await sleep(40)
    }
    console.log('hole full', `holes placed: ${places}`)
    check(holes.length === 3, 'full: no placed hole showed behind the central one within u 0.5 in 60 s', state(probe2, lastHole))
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
