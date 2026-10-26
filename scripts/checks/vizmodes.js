'use strict'
/* global requestAnimationFrame, Image */
// Live check of the visualization's procedural modes (decision 0015)
// under xvfb-run:
//   node scripts/checks/vizmodes.js OUT
// The fakes of scripts/fake come first on PATH. The menu lists every
// mode, and the space bar steps a pane through all of them. Then Gravity
// and Gravity 3D each fill the one pane of a 1200 by 760 window: once
// their probe reports the seed's tight pair and it has turned three
// times, the sign of its wave at a point near it has changed four times
// a turn, twice its orbital frequency, and three frames 0.5 s apart go
// to OUT/<mode>-waves-full-<k>.png, a front leaving the pair from one
// to the next (decision 0015, issue #163). At every read of Gravity 3D,
// there and in its small pane below, its heaviest hole projects within
// a pixel of the pane's centre and lies on the trace's axis, while the
// companion turns and the bodies recentre (issue #171).
// It reports the frame rate of three panes in butterchurn modes and in
// the procedural modes, measured in turn, and asserts nothing of it,
// since the host's load moves it. Then one pane
// per procedural mode, each its own tab, is captured at work, idle (the
// fake claude holds its turns while OUT/pause exists), just after a
// prompt, during tool calls and on the sound output input: each draws
// something, its idle frame differs from its work frame and its prompt
// frame from its idle frame. The frames
// go to OUT/<mode>-<phase>.png and a contact sheet to OUT/viz-modes.png.
// Before the phases, Gravity's and Gravity 3D's small panes report their
// tight pair and three frames 0.5 s apart go to
// OUT/<mode>-waves-small-<k>.png.
// Gravity 3D's Doppler shift (issue #172), in its full pane and its
// small one: a staged hole of 900 with a disc of 420 grains seen 0.15
// rad above its plane, the frame to OUT/gravity3d-doppler-<size>.png.
// The side coming toward the camera is brighter and bluer, the side
// going away dimmer and redder.
// Gravity 3D's spin (issue #173), in the same panes: the same hole of
// own spin 0.35 before a lit plane, idle and spun up by a busy session,
// the frames to OUT/gravity3d-spin-<idle|busy>-<size>.png. The busy
// hole's shadow is flatter on the side coming toward the camera and
// shifted further toward the side going away.
// Gravity 3D's zoom and evaporation (issue #194), in the same panes:
// zoomed fully in and fully out by the wheel, and its holes aged by
// idle until they shrink and then until none is left, the frames to
// OUT/gravity3d-<zoom-in|zoom-out|shrunk|evaporated>-<size>.png.
const { launch, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')
const { MODES } = require('../../app/viz/modes')

const out = path.resolve(process.argv[2])
const fakes = path.join(__dirname, '..', 'fake')
const pause = path.join(out, 'pause')
fs.mkdirSync(out, { recursive: true })
const NEW = MODES.slice(MODES.findIndex(m => m.id === 'dotplane') + 1).map(m => m.id)
const PHASES = ['work', 'prompt', 'tool', 'idle', 'sound']

function check (ok, msg, detail) {
  if (!ok) throw new Error(detail === undefined ? msg : `${msg} ${JSON.stringify(detail)}`)
}

// Each pane's shown canvas: a PNG, and its mean colour over a 64 by 64
// grid, for comparing frames.
function grab () {
  return [...document.querySelectorAll('.pane')].map(p => {
    const c = p.querySelector('canvas:not([hidden])')
    const t = document.createElement('canvas')
    t.width = t.height = 64
    const g = t.getContext('2d')
    g.drawImage(c, 0, 0, 64, 64)
    return { png: c.toDataURL('image/png'), grid: Array.from(g.getImageData(0, 0, 64, 64).data) }
  })
}

// The fraction of two grids' cells that differ visibly, and a grid's
// brightest channel.
function changed (a, b) {
  let n = 0
  for (let i = 0; i < a.length; i += 4) if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > 24) n++
  return n / (a.length / 4)
}
const peak = a => a.reduce((m, v, i) => i % 4 === 3 ? m : Math.max(m, v), 0)

// Gravity 3D's spin (issue #173): pane k staged with the camera and the
// hole of the Doppler shift's, the hole's own spin the seed's 0.35, idle
// (busy 0) and busy (busy 1), and in place of the disc a square of
// grains 2.5 apart and 180 across at the hole's depth, which every ray
// the hole lets past reads where it passes, so the shadow shows black
// on it: the frame to OUT/gravity3d-spin-<phase>-<where>.png. The
// probe's rim reads the shadow as the trace draws it along the line
// through the hole across its axis: from the hole's point to the edge
// on the side going away and on the side coming toward the camera, in
// pixels, and the Schwarzschild radius R. Busy, the side coming toward
// the camera lies nearer the hole by a fifth of R or more and the
// shadow's centre, half their difference, further toward the side
// going away by a fifth of R or more. The scene is let go after.
const PLANE = []
for (let i = -36; i <= 36; i++) for (let j = -36; j <= 36; j++) PLANE.push({ kind: 'dust', Z: 0, X: 2.5 * i, Y: 2.5 * j })
async function spun (viz, k, where) {
  const read = async busy => {
    const ids = await viz.evaluate(([k, busy, items]) => window.vizStage(k, { yaw: 0.6, pitch: 0.15, m: 900, chi: 0.35, busy, items, judge: {} }), [k, busy, PLANE])
    check(ids, `${where}: the mode staged no scene`)
    // The probe reads the rim on frames drawn while it asks: the first
    // of the staged hole's spin, waited for, bounded, under load.
    let f = null
    for (let n = 0; n < 60 && !(f && f.rim && f.rim.chi === f.spin.chi[0][1]); n++) {
      await sleep(250)
      f = await viz.evaluate(k => {
        const p = window.vizState().panes[k]
        const c = [...document.querySelectorAll('.pane')][k].querySelector('canvas:not([hidden])')
        return p.probe ? { rim: p.probe.rim, spin: p.probe.spin, png: c.toDataURL('image/png') } : null
      }, k)
    }
    return f && f.rim && f.rim.chi === f.spin.chi[0][1] ? f : null
  }
  const r = {}
  for (const [phase, busy] of [['idle', 0], ['busy', 1]]) {
    const f = await read(busy)
    check(f && f.spin.up === busy && f.spin.chi.length === 1, `${where}: the ${phase} hole was not drawn`, f && f.spin)
    fs.writeFileSync(path.join(out, `gravity3d-spin-${phase}-${where}.png`), Buffer.from(f.png.split(',')[1], 'base64'))
    r[phase] = { ...f.rim, chi: f.spin.chi[0][1], centre: (f.rim.away - f.rim.toward) / 2 }
  }
  console.log('gravity3d spin', where, JSON.stringify(r, (k, v) => typeof v === 'number' ? Math.round(v * 100) / 100 : v))
  const R = r.idle.R
  check(r.idle.toward - r.busy.toward > 0.2 * R, `${where}: the busy hole's shadow is not flatter on the side coming toward the camera`, r)
  check(r.busy.centre - r.idle.centre > 0.2 * R, `${where}: the busy hole's shadow is not shifted further toward the side going away`, r)
  check(await viz.evaluate(k => window.vizUnstage(k), k), `${where}: the mode would not let the staged scene go`)
}

// Gravity 3D's Doppler shift (issue #172): pane k staged with a hole of
// 900 at the centre, its spin along the vertical, and a disc of 420
// grains, which turn counterclockwise seen from above, the camera 0.15
// rad above their plane. A grain right of the hole on screen, at R
// times the camera's right (-sin yaw, cos yaw, 0), moves along z x R,
// (-cos yaw, -sin yaw, 0) R, away from the camera: the left side comes
// toward it. In a box about the hole, 0.25 of the pane's shorter side
// across and 0.1 up and down, each side's light, the sum of R + G + B,
// and its colour, the sum of B over the sum of R, are read, less those
// of the same scene staged without the disc, the control: the sky and
// its lensed glow. The frame goes to OUT/gravity3d-doppler-<where>.png.
// The scene is let go after.
async function doppler (viz, k, where) {
  const read = async disc => {
    const ids = await viz.evaluate(([k, disc]) => window.vizStage(k, { yaw: 0.6, pitch: 0.15, m: 900, items: [], judge: {}, disc }), [k, disc])
    check(ids, `${where}: the mode staged no scene`)
    await sleep(1500)
    return viz.evaluate(k => {
      const p = window.vizState().panes[k]
      const c = [...document.querySelectorAll('.pane')][k].querySelector('canvas:not([hidden])')
      const held = p.probe && p.probe.held
      if (!held) return null
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
      const m = Math.min(c.width, c.height)
      const side = [{ light: 0, r: 0, b: 0 }, { light: 0, r: 0, b: 0 }]
      for (let y = Math.max(0, Math.floor(held.y - 0.1 * m)); y < Math.min(c.height, held.y + 0.1 * m); y++) {
        for (let x = Math.max(0, Math.floor(held.x - 0.25 * m)); x < Math.min(c.width, held.x + 0.25 * m); x++) {
          const o = 4 * (y * c.width + x)
          const s = side[x + 0.5 < held.x ? 0 : 1]
          s.light += d[o] + d[o + 1] + d[o + 2]
          s.r += d[o]
          s.b += d[o + 2]
        }
      }
      return { held, dust: p.probe.dust, side, png: c.toDataURL('image/png') }
    }, k)
  }
  const f = await read(420)
  check(f && f.dust === 420, `${where}: the staged disc was not drawn`, f && { dust: f.dust, held: f.held })
  fs.writeFileSync(path.join(out, `gravity3d-doppler-${where}.png`), Buffer.from(f.png.split(',')[1], 'base64'))
  const c = await read(0)
  check(c && c.dust === 0, `${where}: the control was not drawn`, c && { dust: c.dust, held: c.held })
  const [come, go] = f.side.map((s, i) => ({ light: s.light - c.side[i].light, r: s.r - c.side[i].r, b: s.b - c.side[i].b }))
  const r = { light: come.light / go.light, blue: (come.b / come.r) / (go.b / go.r), come, go }
  console.log('gravity3d doppler', where, JSON.stringify(r, (k, v) => typeof v === 'number' ? Math.round(v * 1000) / 1000 : v))
  check(go.light > 0 && r.light > 1.5, `${where}: the side coming toward the camera is not brighter`, r)
  check(go.r > 0 && come.r > 0 && r.blue > 1.2, `${where}: the side coming toward the camera is not bluer`, r)
  check(await viz.evaluate(k => window.vizUnstage(k), k), `${where}: the mode would not let the staged scene go`)
}

// Gravity 3D's zoom and its holes' evaporation (issue #194), in pane k,
// the mode seeded at the first zoom. The wheel at the pane's centre, 20
// notches toward the user, holds the camera at D_MIN, the hole still at
// the pane's centre, the frame to OUT/gravity3d-zoom-in-<where>.png, and
// 30 away holds it at D_MAX, OUT/gravity3d-zoom-out-<where>.png; the
// frames drawn in 2 s at each are logged. A pinch, the wheel with ctrl
// by -100 ln 2, from the first zoom halves the distance. Then, the
// session paused, the holes aged by 270 s of idle each keep exp(-270 /
// EVAP) of their mass or are gone below FLOOR,
// OUT/gravity3d-shrunk-<where>.png, and 10 notches in,
// OUT/gravity3d-shrunk-near-<where>.png, and by 1500 s more none is left and
// no body lies within its own r_s, the last holes' final flashes in
// OUT/gravity3d-evaporated-<where>.png. The mode is seeded again after.
const G3 = require('../../app/viz/gravity3d')
async function zoomed (viz, k, where, state) {
  const pane = async () => (await state()).panes[k]
  const p0 = await pane()
  check(p0.probe && p0.probe.cam.D === G3.DIST, `${where}: the zoom did not start at ${G3.DIST}`, p0.probe && p0.probe.cam)
  await viz.mouse.move(p0.x + p0.w / 2, p0.y + p0.h / 2)
  const fps = async () => {
    const d0 = (await state()).drawn
    await sleep(2000)
    return ((await state()).drawn - d0) / 2
  }
  const rate = { first: await fps() }
  const settle = async (want, msg) => {
    for (let n = 0; n < 50; n++) {
      const p = await pane()
      if (Math.abs(p.probe.cam.D / want - 1) < 1e-6) return p
      await sleep(100)
    }
    throw new Error(`${where}: ${msg}, at ${JSON.stringify((await pane()).probe.cam)}`)
  }
  const shot = async name => {
    await sleep(1500)
    const x = await viz.evaluate(k => {
      const p = window.vizState().panes[k]
      const c = [...document.querySelectorAll('.pane')][k].querySelector('canvas:not([hidden])')
      return { probe: p.probe, png: c.toDataURL('image/png') }
    }, k)
    fs.writeFileSync(path.join(out, `gravity3d-${name}-${where}.png`), Buffer.from(x.png.split(',')[1], 'base64'))
    return x.probe
  }
  for (let n = 0; n < 20; n++) await viz.mouse.wheel(0, -100)
  await settle(G3.D_MIN, 'twenty notches in did not hold the camera at D_MIN')
  const zin = await shot('zoom-in')
  centred(zin, `${where} zoomed in`)
  rate.in = await fps()
  for (let n = 0; n < 30; n++) await viz.mouse.wheel(0, 100)
  await settle(G3.D_MAX, 'thirty notches out did not hold the camera at D_MAX')
  const zout = await shot('zoom-out')
  rate.out = await fps()
  check(await viz.evaluate(k => window.vizUnstage(k), k), `${where}: the mode would not seed again`)
  await settle(G3.DIST, 'the mode seeded again away from the first zoom')
  await viz.keyboard.down('Control')
  await viz.mouse.wheel(0, -100 * Math.log(2))
  await viz.keyboard.up('Control')
  await settle(G3.DIST / 2, 'a pinch of 2 did not halve the distance')
  check(await viz.evaluate(k => window.vizUnstage(k), k), `${where}: the mode would not seed again`)
  console.log('gravity3d zoom', where, JSON.stringify({ in: zin.cam, out: zout.cam, rim: zin.rim, traced: [zin.trace.px, zout.trace.px], fps: rate }))

  fs.writeFileSync(pause, '')
  const age = s => viz.evaluate(([k, s]) => {
    const before = window.vizState().panes[k].probe
    window.vizAge(k, s)
    return { before, after: window.vizState().panes[k].probe }
  }, [k, s])
  const a = await age(270)
  const keep = Math.exp(-270 / G3.EVAP)
  const left = a.before.at.filter(h => h[3] * keep >= G3.FLOOR).map(h => h[3] * keep)
  check(a.after.holes === left.length && a.after.at.every((h, i) => Math.abs(h[3] / left[i] - 1) < 1e-9), `${where}: 270 s of idle did not shrink the holes`, { before: a.before.at, after: a.after.at })
  const shrunk = await shot('shrunk')
  await viz.mouse.wheel(0, -1000)
  await settle(G3.DIST / G3.ZOOM ** 10, 'ten notches in did not bring the camera in')
  const near = await shot('shrunk-near')
  await viz.mouse.wheel(0, 1000)
  await settle(G3.DIST, 'ten notches out did not take the camera back')
  const b = await age(1500)
  check(b.after.holes === 0 && b.after.compact === 0, `${where}: a hole is left after 1770 s of idle`, b.after.at)
  const gone = await shot('evaporated')
  fs.rmSync(pause)
  console.log('gravity3d evaporation', where, JSON.stringify({ before: a.before.at.map(h => h[3]), shrunk: shrunk.at.map(h => h[3]), near: near.rim, evaporated: gone.evaporated, holes: gone.holes, compact: gone.compact, bodies: gone.bodies }, (k, v) => typeof v === 'number' ? Math.round(v * 100) / 100 : v))
  check(await viz.evaluate(k => window.vizUnstage(k), k), `${where}: the mode would not seed again`)
}

// Gravity 3D's view's centre (issue #171): the heaviest hole within a
// pixel of the pane's centre, and on the trace's axis.
function centred (probe, where) {
  const c = probe && probe.held
  check(c, `${where}: no hole holds the view`, probe && probe.at)
  const off = Math.hypot(c.x - c.cx, c.y - c.cy)
  check(off < 1 && Math.hypot(c.X, c.Y) < 1e-6, `${where}: the hole is ${off} pixels from the pane's centre`, c)
  return { ...c, off, recentred: probe.recentred }
}

;(async () => {
  fs.rmSync(pause, { force: true })
  const env = { SKINNED_GL: 'swiftshader', PATH: `${fakes}:${process.env.PATH}`, FAKE_CLAUDE_PAUSE: pause }
  const { app, win } = await launch([path.join(fakes, 'claude')], { appArgs: ['--skin', 'deck'], env })
  let viz = null
  for (let i = 0; i < 40 && !viz; i++) {
    await sleep(250)
    for (const w of app.windows()) if (w.url().includes('/viz/')) viz = w
  }
  check(viz, 'no viz window')
  const state = () => viz.evaluate(() => window.vizState())
  const tabs = async () => (await win.evaluate(() => window.skinned.tabs())).tabs
  async function until (f, msg, n = 40) {
    for (let i = 0; i < n; i++) {
      if (await f()) return
      await sleep(100)
    }
    throw new Error(msg)
  }
  // Show mode id in tab's pane, by the menu, as the user picks it.
  async function assign (tab, id) {
    await win.evaluate(t => window.skinned.activateTab(t), tab)
    await until(async () => (await state()).panes.some(p => p.tab === tab && p.active), `tab ${tab} not active`)
    check((await win.evaluate(m => window.skinned.selectViz(m), id)).ok, `the menu refused ${id}`)
    await until(async () => (await state()).panes.find(p => p.tab === tab).mode === id, `tab ${tab} not in ${id}`)
  }
  // n panes, a tab each. Each new tab's pane is waited for, bounded: a
  // fixed wait under load opened a tab too many, whose pane kept a
  // butterchurn mode no frame of this check can read.
  async function panes (n) {
    for (let have = (await state()).panes.length; have < n; have++) {
      await win.evaluate(() => window.skinned.newTab())
      await until(async () => (await state()).panes.length > have, `no pane for tab ${have + 1}`, 150)
    }
    check((await state()).panes.length === n, `want ${n} panes`)
  }
  await sleep(2000)

  const menu = await win.evaluate(() => window.skinned.vizState())
  check(menu.modes.map(m => m.id).join() === MODES.map(m => m.id).join(), 'the menu does not list every mode')
  // The space bar steps the one pane through every mode and back.
  const start = (await state()).mode
  const seen = [start]
  for (let i = 0; i < MODES.length; i++) {
    await viz.keyboard.press('Space')
    await sleep(250)
    seen.push((await state()).mode)
  }
  const at = MODES.findIndex(m => m.id === start)
  const want = Array.from({ length: MODES.length + 1 }, (_, k) => MODES[(at + k) % MODES.length].id)
  console.log('space', seen.join(' '))
  check(seen.join() === want.join(), 'space does not step through every mode')

  // Gravity and Gravity 3D alone in a full pane: the seed's tight pair,
  // its waves at twice its orbital frequency, three frames.
  const vizWin = fn => app.evaluate(({ BrowserWindow }, f) => {
    const w = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/viz/'))
    return f ? w.setContentSize(f[0], f[1]) : w.getContentSize()
  }, fn)
  const size0 = await vizWin(null)
  await vizWin([1200, 760])
  const one = (await tabs())[0].id
  for (const id of ['gravity', 'gravity3d']) {
    await assign(one, id)
    let pair = null
    const held = []
    await until(async () => {
      const probe = (await state()).panes[0].probe
      pair = probe.pair
      // From its first traced frame.
      if (id === 'gravity3d' && probe.trace) held.push(centred(probe, 'gravity3d full pane'))
      return pair && pair.turns >= 3
    }, `${id}: no tight pair turned three times`, 900)
    console.log(id, 'full pane pair', JSON.stringify(pair))
    if (held.length) console.log(id, 'full pane centre', JSON.stringify({ reads: held.length, recentred: [held[0].recentred, held[held.length - 1].recentred], worst: Math.max(...held.map(c => c.off)), last: held[held.length - 1] }))
    check(Math.abs(pair.flips / pair.turns - 4) < 1, `${id}: ${pair.flips} sign changes of its wave in ${pair.turns} turns, not four a turn`)
    for (let k = 0; k < 3; k++) {
      if (k) await sleep(500)
      const [x] = await viz.evaluate(grab)
      check(peak(x.grid) > 40, `${id}: a blank full pane`)
      fs.writeFileSync(path.join(out, `${id}-waves-full-${k}.png`), Buffer.from(x.png.split(',')[1], 'base64'))
    }
    if (id === 'gravity3d') {
      await spun(viz, 0, 'full')
      await doppler(viz, 0, 'full')
      await zoomed(viz, 0, 'full', state)
    }
  }
  await vizWin(size0)
  await sleep(1000)

  // Three panes in butterchurn modes, as vizsplit.js measures them, and
  // in the procedural modes, five rounds in turn so each set sees the
  // same host load. Each set's median.
  await panes(3)
  const sets = [['drift', 'rings', 'plasma']]
  for (let k = 0; k < NEW.length; k += 3) sets.push([0, 1, 2].map(j => NEW[(k + j) % NEW.length]))
  const runs = sets.map(() => [])
  for (let round = 0; round < 5; round++) {
    for (const [k, set] of sets.entries()) {
      const ids = (await tabs()).map(t => t.id)
      for (let j = 0; j < 3; j++) await assign(ids[j], set[j])
      await sleep(1500)
      runs[k].push(await viz.evaluate(() => new Promise(resolve => {
        let n = 0
        const t0 = performance.now()
        const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else resolve(n / 2) }
        requestAnimationFrame(f)
      })))
    }
  }
  const fps = runs.map(r => r.slice().sort((a, b) => a - b)[2])
  sets.forEach((set, k) => console.log('fps with three panes', set.join(' '), runs[k].join(' '), 'median', fps[k]))

  // One pane per procedural mode, on a larger window.
  await panes(NEW.length)
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/viz/'))
    w.setContentSize(1200, 760)
  })
  const ids = (await tabs()).map(t => t.id)
  for (let j = 0; j < NEW.length; j++) await assign(ids[j], NEW[j])
  // The gravity modes' small panes: each its tight pair, three frames.
  await sleep(2000)
  const small = ['gravity', 'gravity3d'].map(id => NEW.indexOf(id))
  await until(async () => {
    const st = await state()
    return small.every(j => st.panes[j].probe && st.panes[j].probe.pair)
  }, 'a small gravity pane has no tight pair', 150)
  const g3 = NEW.indexOf('gravity3d')
  for (let k = 0; k < 3; k++) {
    if (k) await sleep(500)
    centred((await state()).panes[g3].probe, 'gravity3d small pane')
    const xs = await viz.evaluate(grab)
    for (const j of small) fs.writeFileSync(path.join(out, `${NEW[j]}-waves-small-${k}.png`), Buffer.from(xs[j].png.split(',')[1], 'base64'))
  }
  const st = await state()
  console.log('small panes', JSON.stringify(small.map(j => [NEW[j], st.panes[j].w, st.panes[j].h, st.panes[j].probe.pair])))
  await spun(viz, g3, 'small')
  await doppler(viz, g3, 'small')
  await zoomed(viz, g3, 'small', state)
  const shots = {}
  const take = async phase => {
    shots[phase] = await viz.evaluate(grab)
    for (let j = 0; j < NEW.length; j++) fs.writeFileSync(path.join(out, `${NEW[j]}-${phase}.png`), Buffer.from(shots[phase][j].png.split(',')[1], 'base64'))
  }
  // A resized canvas is clear until its mode draws again, which under
  // load can take longer than the wait: the work frame waits, bounded,
  // until every pane has drawn.
  await sleep(4000)
  await until(async () => (await viz.evaluate(grab)).every(x => peak(x.grid) > 40), 'a pane drew nothing after the resize', 150)
  await take('work')
  fs.writeFileSync(pause, '')
  // The longest fake turn, then the idle level's rise.
  await sleep(28000)
  await take('idle')
  // The prompt frame waits for the prompt itself, the first event after
  // the pause, in every pane, and for the idle level it ends to fall. A
  // fixed wait raced the fake under load, and a static mode such as go
  // still showed its idle frame.
  const before = (await state()).panes.map(p => p.beats)
  const lifted = Date.now()
  fs.rmSync(pause)
  await until(async () => (await state()).panes.every((p, j) => p.beats > before[j] && p.idle < 0.05), 'the prompt did not end the idle spell in every pane', 150)
  console.log('prompt reached every pane after', Date.now() - lifted, 'ms')
  await take('prompt')
  await sleep(2400)
  await take('tool')
  check((await win.evaluate(() => window.skinned.selectVizInput('sound'))).ok, 'the menu refused the sound output')
  await sleep(4000)
  await take('sound')
  // The fake recorder swells every 2 s, and each swell's rise is an
  // event every mode answers (decision 0015), Go by a stone. A fixed
  // 2.5 s could pass with no rise under load: the next frame waits,
  // bounded, for a rise in every pane and a second for its answer.
  const rises = (await state()).panes.map(p => p.rises)
  await until(async () => (await state()).panes.every((p, j) => p.rises > rises[j]), 'no rise of the sound output reached every pane', 100)
  await sleep(1000)
  const sound2 = await viz.evaluate(grab)
  check((await state()).sound.st === 1, 'want live sound output samples')

  for (let j = 0; j < NEW.length; j++) {
    const g = ph => shots[ph][j].grid
    const r = { idle: changed(g('work'), g('idle')), prompt: changed(g('idle'), g('prompt')), sound: changed(g('sound'), sound2[j].grid) }
    const peaks = PHASES.map(ph => peak(g(ph)))
    console.log(NEW[j], 'diff', JSON.stringify(r, (k, v) => typeof v === 'number' ? Math.round(v * 1000) / 1000 : v), 'peaks', peaks.join(' '))
    check(peaks.every(v => v > 40), `${NEW[j]}: a blank frame, ${PHASES.filter((ph, k) => peaks[k] <= 40).join(' ')}`)
    check(r.idle > 0.005, `${NEW[j]}: the idle frame is the work frame`)
    check(r.prompt > 0.005, `${NEW[j]}: the prompt frame is the idle frame`)
    check(r.sound > 0.002, `${NEW[j]}: still on the sound output`)
  }

  // The contact sheet: a row per mode, a column per phase.
  const sheet = await viz.evaluate(async ({ rows, cols, labels }) => {
    const load = src => new Promise(resolve => { const i = new Image(); i.onload = () => resolve(i); i.src = src })
    const W = 300
    const pad = 4
    const first = await load(rows[0][0])
    const H = Math.round(W * first.height / first.width)
    const c = document.createElement('canvas')
    c.width = 90 + cols.length * (W + pad)
    c.height = 22 + rows.length * (H + pad)
    const g = c.getContext('2d')
    g.fillStyle = '#111'
    g.fillRect(0, 0, c.width, c.height)
    g.fillStyle = '#cde'
    g.font = '14px "DejaVu Sans Mono", monospace'
    cols.forEach((t, k) => g.fillText(t, 90 + k * (W + pad) + 4, 16))
    for (let j = 0; j < rows.length; j++) {
      g.fillText(labels[j], 6, 22 + j * (H + pad) + H / 2)
      for (let k = 0; k < cols.length; k++) g.drawImage(await load(rows[j][k]), 90 + k * (W + pad), 22 + j * (H + pad), W, H)
    }
    return c.toDataURL('image/png')
  }, { rows: NEW.map((_, j) => PHASES.map(ph => shots[ph][j].png)), cols: PHASES, labels: NEW })
  fs.writeFileSync(path.join(out, 'viz-modes.png'), Buffer.from(sheet.split(',')[1], 'base64'))
  console.log('fps median, butterchurn', fps[0], 'procedural', fps.slice(1).join(' '))

  for (const tab of await tabs()) await win.evaluate(id => window.skinned.closeTab(id), tab.id)
  await sleep(2000)
  await app.close().catch(() => {})
  fs.rmSync(pause, { force: true })
  console.log('done')
})().catch(e => { console.error(e); fs.rmSync(pause, { force: true }); process.exit(1) })
