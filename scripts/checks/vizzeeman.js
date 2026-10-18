'use strict'
// Live check of the Carbon mode's magnetic field (issue #158, decision
// 0015) under xvfb-run:
//   node scripts/checks/vizzeeman.js OUT
// One pane in Carbon on a 1200 by 760 window, fed by the fake claude's
// turns. The field is set by drags on the pane's dial, as a user sets it.
// Precession: with B at 90 degrees to z, the drawn atom's axis is read
// from the probe over time, and the angle it turns about B between two
// readings at one level is held against 2 pi g_J mu_B B / h / E times
// the time between them, g_J from the data file, mu_B / h from CODATA
// 2022, E the event clock's factor from carbon.js. With B along z the
// axis stays on z and the pane says why. Beat: a click on the pulse
// button, then the rate at the detector over the trace's window after
// it, whose spectrum, its decay taken out, peaks at twice the pulsed
// level's Larmor rate, far above the same spectrum in the window before
// the pulse. Frames of the full pane and
// of a small one, 360 by 230, and no two texts overlap in any.
// No page or console error. Frames go to OUT/zeeman-<phase>.png. Fakes
// only.
const { launch, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')
const D = require('../../app/viz/carbon-data')

const out = path.resolve(process.argv[2])
const fake = path.join(__dirname, '..', 'fake', 'claude')
fs.mkdirSync(out, { recursive: true })
const errors = []
const MU_B_H = 1.39962449171e10
// The event clock's factor, and its slowing from 1e6 (issue #166), by
// which the trace's window and the beat's frequency scale.
const { EVENT, TRACE_T } = require('../../app/viz/carbon')
const SLOW = EVENT / 1e6

function check (ok, msg, seen) {
  if (!ok) throw new Error(seen === undefined ? msg : `${msg}, saw ${JSON.stringify(seen)}`)
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const toward = deg => [Math.sin(deg * Math.PI / 180), 0, Math.cos(deg * Math.PI / 180)]
// The Larmor rate on the event clock from the data file, turns a second.
const larmor = (id, mT) => {
  const lv = D.levels.find(l => l.id === id)
  return lv.gJ ? lv.gJ * MU_B_H * mT * 1e-3 / EVENT : 0
}
// The signed angle from a to b about the unit vector u.
function turned (a, b, u) {
  const pa = a.map((v, i) => v - dot(a, u) * u[i])
  const pb = b.map((v, i) => v - dot(b, u) * u[i])
  return Math.atan2(dot(cross(pa, pb), u), dot(pa, pb))
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
  // Two texts overlap where their boxes share more than half a pixel
  // each way, as vizcarbon.js counts them.
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
  async function save (j, name) {
    const png = await viz.evaluate(j => document.querySelectorAll('.pane')[j].querySelector('canvas:not([hidden])').toDataURL('image/png'), j)
    fs.writeFileSync(path.join(out, `zeeman-${name}.png`), Buffer.from(png.split(',')[1], 'base64'))
    await overlap(name)
  }
  // A drag on pane 0's dial to s of its radius at deg from up: the
  // field it sets.
  async function dial (s, deg) {
    const p = await pane()
    const d = p.probe.dial
    const x = p.x + d.x + s * d.r * Math.sin(deg * Math.PI / 180)
    const y = p.y + d.y - s * d.r * Math.cos(deg * Math.PI / 180)
    await viz.mouse.move(p.x + d.x, p.y + d.y)
    await viz.mouse.down()
    await viz.mouse.move(x, y, { steps: 4 })
    await viz.mouse.up()
    await sleep(200)
    return (await pane()).probe.B
  }

  await sleep(1500)
  await size(1200, 760)
  await assign((await tabs())[0].id, 'carbon')
  await sleep(2500)
  let p = (await pane()).probe
  check(p.dial && p.pulseButton && p.trace, 'want the dial, the pulse button and the trace in a full pane', { dial: p.dial, pulse: p.pulseButton, trace: p.trace })
  check(p.B.mT === 0.3 && p.B.deg === 60, 'want B 0.30 mT at 60 degrees at start', p.B)
  await save(0, 'start')

  // Precession: B at 90 degrees, small enough that a reading 0.15 s
  // after the last has turned under half a turn.
  const B1 = await dial(0.28, 90)
  console.log('field for the precession', JSON.stringify(B1))
  check(B1.deg === 90 && B1.mT > 0.1 && B1.mT < 0.2, 'want B near 0.16 mT at 90 degrees from the drag', B1)
  const u = toward(B1.deg)
  let measured = 0
  let expected = 0
  let pairs = 0
  let still = 0
  let worst = 0
  const levelsSeen = new Set()
  let prev = null
  const t0 = Date.now()
  while (Date.now() - t0 < 30000 + 1000 * SLOW && (pairs < 40 || expected < 4 * Math.PI)) {
    const q = (await pane()).probe
    if (prev && q.level === prev.level && q.t0 === prev.t0 && q.now > prev.now) {
      const f = larmor(q.level, q.B.mT)
      check(Math.abs(q.larmor - f) <= 1e-9 * Math.max(1, f), 'want the stated Larmor rate g_J mu_B B / h / E', { level: q.level, stated: q.larmor, f })
      const want = 2 * Math.PI * f * (q.now - prev.now)
      if (Math.abs(want) < 0.8 * Math.PI) {
        const got = turned(prev.axis, q.axis, u)
        worst = Math.max(worst, Math.abs(got - want))
        if (f) {
          measured += got
          expected += want
          pairs++
          levelsSeen.add(`${q.level} ${q.gJsrc}`)
        } else still++
      }
    }
    prev = q
    await sleep(40)
  }
  console.log(`precession: ${pairs} pairs over ${(expected / 2 / Math.PI).toFixed(2)} turns expected, ${(measured / 2 / Math.PI).toFixed(4)} measured, ${still} pairs at J = 0, worst pair off by ${worst.toExponential(2)} rad, levels ${[...levelsSeen].join(', ')}`)
  check(pairs >= 40 && expected >= 4 * Math.PI, 'want 40 pairs and two turns at J > 0', { pairs, expected })
  check(Math.abs(measured / expected - 1) < 0.002 && worst < 0.01, 'want the axis to turn at the Larmor rate', { measured, expected, worst })

  // B along z: an atom lifted since stands on z, and the pane says why.
  // An atom tilted before B was set turns about z until a collision: a
  // click on the atom lifts the drawn one by a photon.
  const B2 = await dial(0.6, 0)
  check(B2.deg === 0 && B2.mT > 0, 'want B along z from the drag', B2)
  const set = (await pane()).probe.now
  for (let i = 0; i < 5 && (await pane()).probe.lifted <= set; i++) {
    p = await pane()
    await viz.mouse.click(p.x + p.probe.dial.x - 0.4 * p.w * 0.5, p.y + p.h * 0.45)
    await sleep(300)
  }
  check((await pane()).probe.lifted > set, 'want the drawn atom lifted after B was set along z')
  let off = 0
  let n = 0
  let why = false
  const t1 = Date.now()
  while (Date.now() - t1 < 3000) {
    const q = (await pane()).probe
    off = Math.max(off, 1 - Math.abs(q.axis[2]))
    n++
    if (q.texts.some(b => b.t.includes('along z')) && q.texts.some(b => b.t.includes('nothing turns') || b.t.startsWith('J = 0'))) why = true
    await sleep(60)
  }
  console.log(`B along z: ${n} readings after a lift, the axis off z by at most ${off.toExponential(2)}, the pane says why: ${why}`)
  check(off < 1e-9, 'want the axis on z with B along z', off)
  check(why, 'want the pane to say B is along z and nothing turns')
  await save(0, 'along')

  // Beat: B at 90 degrees, a pulse, the rate at the detector after it.
  const B3 = await dial(0.5, 90)
  check(B3.deg === 90 && B3.mT > 0.3, 'want B near 0.5 mT at 90 degrees', B3)
  const f2 = 2 * larmor('2p4p_3P_2', B3.mT)
  const tau = D.levels.find(l => l.id === '2p4p_3P_2').tau * EVENT
  p = await pane()
  const pb = p.probe.pulseButton
  const pulses = p.probe.pulses
  await viz.mouse.click(p.x + pb.x + pb.w / 2, p.y + pb.y + pb.h / 2)
  // The window after the pulse is TRACE_T of the mode's clock, which
  // falls behind wall time when frames are slow.
  const t2 = Date.now()
  let beat = (await pane()).probe
  while (Date.now() - t2 < 4000 * SLOW && !(beat.beat && beat.now >= beat.beat.t + TRACE_T)) {
    await sleep(200)
    beat = (await pane()).probe
  }
  await save(0, 'beat')
  fs.writeFileSync(path.join(out, 'zeeman-beat.json'), JSON.stringify(beat.beat))
  check(beat.pulses === pulses + 1 && beat.beat, 'want the click to fire a pulse', { pulses: beat.pulses, beat: !!beat.beat })
  check(Math.abs(beat.beat.f2 - f2) < 1e-9 * f2, 'want the stated beat 2 f_L of 2p4p 3P2', { stated: beat.beat.f2, f2 })
  // The spectrum of the rate with its decay, A e^(-t / tau) + C fitted
  // by least squares, taken out.
  function spectrum (s, freqs) {
    const t = s.map(e => e[0])
    const r = s.map(e => e[1])
    const e = t.map(x => Math.exp(-(x - t[0]) / tau))
    const n = t.length
    let se = 0
    let see = 0
    let sr = 0
    let ser = 0
    for (let i = 0; i < n; i++) {
      se += e[i]
      see += e[i] * e[i]
      sr += r[i]
      ser += e[i] * r[i]
    }
    const A = (n * ser - se * sr) / (n * see - se * se)
    const C = (sr - A * se) / n
    const res = r.map((v, i) => v - A * e[i] - C)
    return freqs.map(f => {
      let re = 0
      let im = 0
      for (let i = 0; i < n; i++) {
        re += res[i] * Math.cos(2 * Math.PI * f * t[i])
        im += res[i] * Math.sin(2 * Math.PI * f * t[i])
      }
      return Math.hypot(re, im) / n
    })
  }
  const grid = []
  for (let f = 3 / SLOW; f <= 80 / SLOW; f += 0.05 / SLOW) grid.push(f)
  const after = spectrum(beat.beat.after, grid)
  let k = 0
  for (let i = 1; i < grid.length; i++) if (after[i] > after[k]) k = i
  const before = beat.beat.before.length > 100 ? spectrum(beat.beat.before, [f2])[0] : 0
  const atF2 = spectrum(beat.beat.after, [f2])[0]
  console.log(`beat: ${beat.beat.n} atoms pulsed at B ${B3.mT} mT, ${beat.dots} detections drawn, ${beat.beat.after.length} samples, spectrum peaks at ${grid[k].toFixed(2)} Hz against 2 f_L ${f2.toFixed(2)} Hz, amplitude there ${atF2.toPrecision(3)}, ${before.toPrecision(3)} in the window before`)
  check(beat.beat.n >= 40, 'want 40 atoms pulsed', beat.beat.n)
  check(beat.dots > 0, 'want detections drawn on the circle', beat.dots)
  check(Math.abs(grid[k] / f2 - 1) < 0.05, 'want the beat at 2 f_L', { peak: grid[k], f2 })
  check(atF2 > 5 * before, 'want the beat far above the rate before the pulse', { atF2, before })

  // A full pane again at the start's field, then a small one: four
  // panes of 360 by 230, all in Carbon.
  await dial(Math.sqrt(0.3 / 2), 60)
  await sleep(1500)
  await save(0, 'full')
  await size(720, 460)
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
  p = await pane()
  check(p.w === 360 && p.h === 230 && p.probe.dial, 'want a small pane with its dial', { w: p.w, h: p.h, dial: p.probe.dial })
  check(p.probe.texts.some(b => b.t.includes(' mT')), 'want the field stated in a small pane', p.probe.texts.map(b => b.t))
  await save(0, 'small')

  console.log('texts measured in panes of', [...sizes].join(' '), 'overlaps', overlaps.length)
  for (const s of ['1200x760', '360x230']) check(sizes.has(s), `want texts measured at ${s}`, [...sizes])
  check(!overlaps.length, `${overlaps.length} overlapping pairs of texts, the first`, overlaps[0])
  check(!errors.length, 'page errors', errors)

  for (const tab of await tabs()) await win.evaluate(id => window.skinned.closeTab(id), tab.id)
  await sleep(1500)
  await app.close().catch(() => {})
  console.log('done')
})().catch(e => { console.error(e); console.error(errors.join('\n')); process.exit(1) })
