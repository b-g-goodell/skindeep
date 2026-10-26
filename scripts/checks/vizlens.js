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
// Trail frames, in the full pane (issue #182): a planet alone with the
// hole, its trail of 64 places on a line from X -220, Z 40 to X 220,
// Z 360, at a height Y of each of TRAILS above the hole's line, so its
// pieces lie on several slices of depth and pass behind the hole, near
// it. The pixels where that frame differs from a control without the
// trail by 4 in a channel or more are the trail's images. At 28 and 14:
// above the hole's row, its outer image, one 8-connected piece, one run
// of pixels down each column, so no gap and no doubled piece where two
// pieces meet, and below it its inner image, one piece, unbroken into
// dashes. At 3 and 1, near the hole's line, where the images run round
// the hole and the inner one's ends meet the hole's row beside the
// straight arms, so a cut at the row splits whole curves: over the
// frame, one or two pieces, the outer and the inner image, apart or
// touching, a pixel in every bin of 5 degrees about the hole, so the
// two arcs close round it with no gap, and one run down each column
// above the row 8 pixels over the hole's, so no doubled arc. At 14, 6
// and 1 with a second hole of 300 at X 70, Y 8, Z 80, as a subagent
// adds one, whose shear turns the hole's point caustic into a small
// astroid, so images are born and lost in pairs at folds: a pixel in
// every bin of 5 degrees about the hole, and no more pieces than the
// images drawn apart there: at 14 and 6 three, the outer arc, the inner
// one, and the second hole's own image of the trail beside it, which
// begins and ends faint, and at 1, where the arcs meet, two. That image
// lies in the columns of the outer arc, and a fold turns one image back
// under another, so runs are not counted there.
// Frames go to OUT/lens-<size>-<k>.png, OUT/lens-hole-full-<k>.png and
// OUT/trail-<k>.png.
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
// The trail frames: each height, how it is judged, far from the hole's
// line, near it, where its images run round the hole, or with a second
// hole, the matter staged beside the trail, and with it the most pieces.
const HOLE2 = { kind: 'hole', m: 300, X: 70, Y: 8, Z: 80 }
const TRAILS = [[28, 'far', []], [14, 'far', []], [3, 'near', []], [1, 'near', []], [14, 'two', [HOLE2], 3], [6, 'two', [HOLE2], 3], [1, 'two', [HOLE2], 2]]

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

// In the page: the pane's frame, kept (keep) or, against the frame kept,
// the trail's images, where the two differ by 4 in a channel or more.
// On each side of the hole's row at (hx, hy): their pixels, the
// 8-connected pieces of 3 pixels or more, and the most runs of pixels
// down a column. Over the whole frame: the pieces, the bins of 5 degrees
// about the hole holding no pixel, and the most runs down a column above
// the row hy - 8.
function trailImages ([keep, hx, hy]) {
  const c = [...document.querySelectorAll('.pane canvas:not([hidden])')][0]
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  if (keep) {
    window.trailFrame = d
    return { png: c.toDataURL('image/png') }
  }
  const a = window.trailFrame
  const w = c.width
  const h = c.height
  const lit = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    if (Math.max(Math.abs(a[4 * i] - d[4 * i]), Math.abs(a[4 * i + 1] - d[4 * i + 1]), Math.abs(a[4 * i + 2] - d[4 * i + 2])) >= 4) lit[i] = 1
  }
  const pieces = on => {
    const seen = new Uint8Array(w * h)
    const list = []
    let pixels = 0
    for (let s = 0; s < w * h; s++) {
      if (!on(s) || seen[s]) continue
      const st = [s]
      seen[s] = 1
      let n = 0
      while (st.length) {
        const k = st.pop()
        n++
        const x = k % w
        const y = k / w | 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const X = x + dx
            const Y = y + dy
            if (X < 0 || Y < 0 || X >= w || Y >= h) continue
            const q = Y * w + X
            if (on(q) && !seen[q]) {
              seen[q] = 1
              st.push(q)
            }
          }
        }
      }
      pixels += n
      if (n >= 3) list.push(n)
    }
    return { pixels, pieces: list.sort((p, q) => q - p) }
  }
  const runs = (on, y1) => {
    let most = 0
    for (let x = 0; x < w; x++) {
      let r = 0
      for (let y = 0; y < y1; y++) if (on(y * w + x) && (y === 0 || !on((y - 1) * w + x))) r++
      most = Math.max(most, r)
    }
    return most
  }
  const side = up => {
    const on = i => lit[i] && ((i / w | 0) + 0.5 < hy) === up
    return { ...pieces(on), runs: runs(on, h) }
  }
  const on = i => lit[i]
  const bins = new Uint8Array(72)
  for (let i = 0; i < w * h; i++) {
    if (lit[i]) bins[Math.floor((Math.atan2(hy - (i / w | 0) - 0.5, i % w + 0.5 - hx) * 180 / Math.PI + 360) % 360 / 5) % 72] = 1
  }
  const empty = []
  for (let b = 0; b < 72; b++) if (!bins[b]) empty.push(5 * b)
  return { outer: side(true), inner: side(false), whole: { ...pieces(on), empty, runs: runs(on, Math.floor(hy - 8)) } }
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
  // The trail frames, in the full pane.
  await size([1200, 760])
  await sleep(1500)
  for (const [k, [Y, judge, extra, most]] of TRAILS.entries()) {
    const where = `trail ${k}`
    const places = Array.from({ length: 64 }, (_, i) => [-220 + 440 * i / 63, Y, 40 + 320 * i / 63])
    const read = async (trail, keep) => {
      const ids = await viz.evaluate(s => window.vizStage(0, s), { yaw: YAW, pitch: 0, m: M, items: [{ kind: 'planet', m: 2, X: 220, Y, Z: 360, trail }, ...extra], judge: {} })
      check(ids && ids[0] > 0, `${where}: the mode staged no scene`, ids)
      await sleep(1500)
      const p = await pane()
      slices(p.probe, where)
      check(p.probe.trace.slices.trails[2] === (trail.length ? 6 : 0), `${where}: the trail's pieces were not drawn`, p.probe.trace.slices)
      check(p.probe.held, `${where}: no view's centre`, p.probe)
      return viz.evaluate(trailImages, [keep, p.probe.held.x, p.probe.held.y])
    }
    const f = await read(places, true)
    fs.writeFileSync(path.join(out, `trail-${k}.png`), Buffer.from(f.png.split(',')[1], 'base64'))
    const r = await read([], false)
    console.log(where, `Y ${Y}`, judge, JSON.stringify(r))
    if (judge === 'two') {
      check(r.whole.pixels > 400 && r.whole.pieces.length >= 1 && r.whole.pieces.length <= most, `${where}: the trail's images behind two holes are broken`, r.whole)
      check(r.whole.empty.length === 0, `${where}: the trail's images behind two holes leave a gap round the hole`, r.whole)
    } else if (judge === 'near') {
      check(r.whole.pixels > 400 && r.whole.pieces.length >= 1 && r.whole.pieces.length <= 2, `${where}: the trail's images are broken`, r.whole)
      check(r.whole.empty.length === 0, `${where}: the trail's images leave a gap round the hole`, r.whole)
      check(r.whole.runs === 1, `${where}: the trail's outer image is doubled`, r.whole)
    } else {
      check(r.outer.pixels > 200 && r.outer.pieces.length === 1 && r.outer.runs === 1, `${where}: the trail's outer image is broken or doubled`, r.outer)
      check(r.inner.pixels > 50 && r.inner.pieces.length === 1, `${where}: the trail's inner image is broken`, r.inner)
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
