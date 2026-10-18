'use strict'
// Live check of Gravity 3D's optics on its bodies and holes (issue #170,
// decision 0015) under xvfb-run:
//   node scripts/checks/vizlens.js OUT
// One pane in Gravity 3D, fed by the fake claude, in a 1200 by 760
// window and then a 360 by 230 one. First, in the full pane, a smoke
// pass of the running mode for SMOKE ms judges no lensing: it reads the
// slice audit of each frame and wants no page error. Every judged frame
// is of a scene the check stages and the mode holds still
// (window.vizStage, gravity3d stage): no event, step or turn of the
// camera moves it, and no other body, grain, flare or wave is in it.
// The camera is level, a hole of M at the centre, and with it EXTRA,
// matter of every class: grains before and behind the hole, a planet
// with a trail and a flare behind it, all far from the line of sight.
// Moon frames, in both panes: a moon of 4, MOON_Z beyond the hole, at
// each u and angle of MOONS, its unlensed disc and glow wholly inside
// the hole's shadow, so that a straight ray would hide it, and its disc
// a radius of MIN_DISC = 1 pixel of the trace or more (its disc in the
// pane's pixels times the trace's scale k), the moon judged. The mode
// draws that frame again without the moon, the control, and picks up
// to 8 points where the two whole frames differ, by 16 in a channel or
// more, outside the shadow and nearer the hole than any other, after
// everything nearer is drawn. Here the pane's canvas is read at those
// points against the control's colours: at three quarters of them at
// least, one at least, it differs by 16 in a channel or more, which
// only the moon's light gives. In the full pane the outer image is also
// an arc: its pixels spread across the line to the hole more than 1.5
// times as far as along it. Hole frames, in the full pane: a hole of
// 200, HOLE_Z beyond the central one, at each u and angle of HOLES, its
// unlensed shadow wholly inside the central shadow, judged the same way
// against a control traced without it: its image, the light it takes
// from what lies behind it, shows outside the central shadow. A staged
// frame the mode does not judge within 5 s fails with the probe's state.
// Frames go to OUT/lens-<size>-<k>.png and OUT/lens-hole-full-<k>.png.
// At every frame read, the probe's audit shows each class of matter,
// dust, bodies, trails and flares, painted whole, each piece on the
// slice that holds its depth, counted where it is painted, and the
// staged frames paint each class. No page or console error. Fakes only.
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

// The smoke pass's length, in ms.
const SMOKE = 8000
// The least radius of the judged moon's disc, in pixels of the trace.
const MIN_DISC = 1
// The staged scene: the camera's turn, the central hole's mass, and the
// matter of every class about it, X right, Y up and Z beyond the hole.
const YAW = 0.6
const M = 900
const EXTRA = [
  { kind: 'dust', Z: -150, X: -120, Y: 60 },
  { kind: 'dust', Z: 200, X: 150, Y: -80 },
  { kind: 'dust', Z: 400, X: -160, Y: -90 },
  { kind: 'planet', m: 2, Z: 300, X: 200, Y: 100, trail: 12 },
  { kind: 'flare', Z: 150, X: -190, Y: 110, r: 8 }
]
// The moon frames, [u, degrees], and the hole frames.
const MOON_Z = 250
const MOONS = [[0.12, 30], [0.25, 150], [0.36, 270]]
const HOLE_Z = 280
const HOLES = [[0.06, 0], [0.12, 120], [0.18, 240]]

// The probe's state when a staged frame is not judged.
function state (probe, rec) {
  if (!probe) return { probe: null }
  return { judged: probe.judged, at: probe.at, cam: probe.cam, record: rec && { ...rec, pts: undefined, alt: undefined } }
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
  const reach = l.te * (l.u + Math.sqrt(l.u * l.u + 4)) / 2
  const ix = l.hx + reach * (l.x - l.hx) / d
  const iy = l.hy + reach * (l.y - l.hy) / d
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
// bodies, the trails' pieces and the flares, painted all it had, each
// piece on the slice of its depth, so the trace bends each as it bends
// the others at that depth. A class painted on any other slice, or not
// at all, is caught here. drew counts each class's pieces over the run.
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

  // The smoke pass: the running mode, its audit read, nothing judged.
  await size([1200, 760])
  await sleep(1500)
  const t0 = Date.now()
  let reads = 0
  while (Date.now() - t0 < SMOKE) {
    slices((await pane()).probe, 'smoke')
    reads++
    await sleep(250)
  }
  console.log('smoke', `${reads} frames read`)

  // A staged scene with item it judged, and its first judged frame.
  async function judge (where, item, hole, least) {
    const spec = { yaw: YAW, pitch: 0, m: M, items: [item, ...EXTRA], judge: hole ? { hole: 0 } : { body: 0 } }
    const ids = await viz.evaluate(s => window.vizStage(0, s), spec)
    check(ids && ids[0] > 0, `${where}: the mode staged no scene`, ids)
    const t = Date.now()
    let f = null
    while (Date.now() - t < 5000) {
      f = await viz.evaluate(frame, [hole, least])
      slices(f.probe, where)
      if (f.png) break
      await sleep(100)
    }
    check(f && f.png, `${where}: the staged frame was not judged`, state(f && f.probe, f && f.lens))
    check(f.lens.id === ids[0], `${where}: the record judged another body than the one staged`, state(f.probe, f.lens))
    return f
  }

  for (const [name, W, H] of [['full', 1200, 760], ['small', 360, 230]]) {
    await size([W, H])
    await sleep(1500)
    check((await pane()).mode === 'gravity3d', 'want gravity3d shown')
    for (const [k, [u, a]] of MOONS.entries()) {
      const f = await judge(`${name} moon ${k}`, { kind: 'planet', m: 4, Z: MOON_Z, u, a }, false, MIN_DISC)
      fs.writeFileSync(path.join(out, `lens-${name}-${k}.png`), Buffer.from(f.png.split(',')[1], 'base64'))
      const l = f.lens
      const o = l.outer
      const aspect = o.pixels ? o.across / Math.max(0.5, o.radial) : 0
      const n = shown(f)
      console.log(name, `${f.w}x${f.h}`, JSON.stringify({ u: l.u, te: l.te, R: l.R, r: l.r, disc: l.disc, k: l.k, hidden: l.hidden, pixels: l.pixels, outer: o, aspect, shown: `${n} of ${l.pts.length}`, pts: l.pts, seen: f.seen, alt: l.alt }))
      check(l.kind === 'planet', `${name}: the record judged another kind than the moon`, state(f.probe, l))
      check(l.pixels > 0, `${name}: the body behind the hole is hidden`, { ...l, pts: undefined, alt: undefined })
      check(l.pts.length && n >= 0.75 * l.pts.length, `${name}: the frame does not show the body's image`, { pts: l.pts, seen: f.seen, alt: l.alt })
      if (name === 'full') check(o.pixels > 0 && aspect > 1.5, `${name}: the outer image is not an arc`, { outer: o, aspect })
    }
    if (name !== 'full') continue
    for (const [k, [u, a]] of HOLES.entries()) {
      const f = await judge(`hole ${k}`, { kind: 'hole', m: 200, Z: HOLE_Z, u, a }, true, 0)
      fs.writeFileSync(path.join(out, `lens-hole-full-${k}.png`), Buffer.from(f.png.split(',')[1], 'base64'))
      const l = f.lens
      const n = shown(f)
      console.log('hole full', JSON.stringify({ m: l.m, u: l.u, te: l.te, R: l.R, r: l.r, hidden: l.hidden, pixels: l.pixels, outer: l.outer, shown: `${n} of ${l.pts.length}`, pts: l.pts, seen: f.seen, alt: l.alt }))
      check(l.kind === 'hole', 'full: the record judged another kind than the hole', state(f.probe, l))
      check(l.pixels > 0, 'full: the hole behind the hole is hidden', { ...l, pts: undefined, alt: undefined })
      check(l.pts.length && n >= 0.75 * l.pts.length, 'full: the frame does not show the hole\'s image', { pts: l.pts, seen: f.seen, alt: l.alt })
    }
  }
  check(await viz.evaluate(() => window.vizUnstage(0)), 'the mode would not let the staged scene go')

  console.log('drawn on their slices', JSON.stringify(drew))
  for (const k of Object.keys(drew)) check(drew[k] > 0, `no ${k} drawn in the run`, drew)
  console.log('errors', JSON.stringify(errors))
  check(errors.length === 0, 'want no page or console error', errors)
  for (const tab of (await win.evaluate(() => window.skinned.tabs())).tabs) await win.evaluate(id => window.skinned.closeTab(id), tab.id)
  await sleep(2000)
  await app.close().catch(() => {})
  console.log('done')
})().catch(e => { console.error(e, '\nerrors', JSON.stringify(errors)); process.exit(1) })
