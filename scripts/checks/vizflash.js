'use strict'
// Live check of the Carbon mode's flashes (issues #164, #166 and #169,
// decision 0015) under xvfb-run:
//   node scripts/checks/vizflash.js OUT [--only SCENE,...]
//   node scripts/checks/vizflash.js OUT --event E --light L [--set NAME=V] [--window S]
// In the viz window's page, Carbon is drawn alone on a canvas of its
// own, frame by frame at a fixed step, fed through Synth's input, its
// levels held after each step. Each frame's pixels go to the flash
// counter of scripts/flash.js, after WCAG 2.2 SC 2.3.1: no field of 341
// by 256 pixels may flash more than three times in any one second,
// general or red, its flashes concurrent within one frame. The count
// with flashes concurrent within 0.1 s, a cell's most, and where the
// cells flashed are reported beside it and asserted nothing.
// The drawn atom's axis, a line 1.5 pixels wide that no field's area
// can see, is counted alone: each frame its segment as the probe
// reports it, drawn in its stroke on black on a canvas of its own, goes
// to a counter of its own, whose cells flash as the line passes. At the
// dial's start, in the scenes with no stream of session events, each of
// which sets the drawn atom's axis anew, no cell of it may flash more
// than three times in any one second, and those scenes must hold the
// drawn atom at J > 0 for 2 s in all, so the bound is not met by an
// axis that stands still. Where events come every few seconds, and at
// B_MAX, whose range is the owner's (#169), the count is reported.
// Beside it: the repeat the probe states, twice the Larmor rate, as a
// mean over the frames, how often the axis is set anew, how far it then
// jumps on the pane, and how often a jump changes its rate.
// Scenes, each after a warm-up of three of the field's slowest times:
// full activity (every level held at 1, as vizcarbon.js holds it, and a
// tool call every 2 s), moderate (levels 0.5, a tool call every 4 s),
// idle, a single prompt on a quiet session, and a single subagent's
// start, which must leave the drawn atom in 2s2p3 5So2, of g_J 2, at
// rest for good, in a full pane of 1200 by 760 at 60 frames a second,
// and full activity and a prompt in small panes, 240 by 460 (a split of
// three) and 360 by 230 (four), at 20, the split's frame rate. Full
// activity in the full pane and the split of three again at B_MAX, at
// the start's 60 degrees to z, and a pulse on a quiet session at the
// start and at B_MAX, which must lift the drawn atom, so its beat shows
// and its cloud turns at the pulsed level's rate, the field set and the
// pulse fired by the renderer's pointer as a press. A busy session must
// show more fronts and photons than a moderate one, and that more than
// an idle one, and its frames must be brighter than an idle one's. A
// single prompt must read as one burst: nine tenths of its photons
// within BURST seconds, 0.8 s at an event clock of 1e6 scaled with it,
// and no quarter second after that holding a tenth of them. --event
// and --light replace the mode's two clock factors, --set NAME=V any
// other constant, --window S the concurrency window of the second
// count: a measurement, which asserts nothing. Frames go to
// OUT/flash-<scene>.png, where the cells flashed to
// OUT/flash-<scene>-heat.png, the counts to OUT/flash.json. Fakes only.
const { launch, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..', '..')
const out = path.resolve(process.argv[2])
const argv = process.argv.slice(3)
const opt = name => {
  const i = argv.indexOf(name)
  return i < 0 ? null : argv[i + 1]
}
const event = opt('--event')
const light = opt('--light')
const only = opt('--only')
// Flashes within this many seconds of each other are concurrent: see
// scripts/flash.js.
const win = Number(opt('--window') || 0.1)
// --set NAME=V, repeated: any other constant of the mode, for a
// measurement.
const sets = argv.map((a, i) => a === '--set' ? argv[i + 1].split('=') : null).filter(Boolean)
const measuring = !!(event || light || sets.length || win !== 0.1)
fs.mkdirSync(out, { recursive: true })
const errors = []

function check (ok, msg, seen) {
  if (!ok) throw new Error(seen === undefined ? msg : `${msg}, saw ${JSON.stringify(seen)}`)
}

// The mode's source, its clock factors replaced for a measurement.
function carbonSource () {
  let src = fs.readFileSync(path.join(root, 'app', 'viz', 'carbon.js'), 'utf8')
  const set = (name, v) => {
    const re = new RegExp(`const ${name} = [^\\n]+`)
    check(re.test(src), `no ${name} in carbon.js`)
    src = src.replace(re, `const ${name} = ${Number(v)}`)
  }
  if (event) set('EVENT', event)
  if (light) set('LIGHT', light)
  for (const [k, v] of sets) set(k, v)
  return src
}

const C = require('../../app/viz/carbon')
const E = Number(event || C.EVENT)
// A burst's nine tenths of photons within this many seconds: its
// cascades run on the event clock, 0.3 to 0.73 s at 1e6 (d18161f).
const BURST = 0.8 * E / 1e6
// The field's slowest time, seconds: one collision a FIELD_MAX.
const fieldT = 1 / (1.2e6 / E)

const FULL = { bass: 1, treble: 1, busy: 1, idle: 0 }
const HALF = { bass: 0.5, treble: 0.5, busy: 0.5, idle: 0 }
const IDLE = { bass: 0, treble: 0, busy: 0, idle: 1 }
const QUIET = { bass: 0, treble: 0, busy: 0, idle: 0 }
// Events as [period s, offset s, kind, cls]: kind 2 a tool call, 3 a
// prompt.
const BUSY = [[2, 0, 2, 0]]
const SOME = [[4, 0, 2, 1]]
const scenes = [
  { name: 'full', w: 1200, h: 760, fps: 60, level: FULL, events: BUSY, s: 12, shots: [6] },
  { name: 'full-max', w: 1200, h: 760, fps: 60, level: FULL, events: BUSY, s: 12, shots: [6], max: true },
  { name: 'beat', w: 1200, h: 760, fps: 60, level: QUIET, events: [], pulse: 0.5, s: 8, shots: [1, 4] },
  { name: 'beat-max', w: 1200, h: 760, fps: 60, level: QUIET, events: [], pulse: 0.5, s: 8, shots: [1, 4], max: true },
  { name: 'moderate', w: 1200, h: 760, fps: 60, level: HALF, events: SOME, s: 12, shots: [] },
  { name: 'idle', w: 1200, h: 760, fps: 60, level: IDLE, events: [], s: 6, shots: [3] },
  { name: 'prompt', w: 1200, h: 760, fps: 60, level: QUIET, events: [], prompt: 0.5, s: 8, shots: [0.8, 2] },
  { name: 'subagent', w: 1200, h: 760, fps: 60, level: QUIET, events: [], subagent: 0.5, s: 8, shots: [] },
  { name: 'split-full', w: 240, h: 460, fps: 20, level: FULL, events: BUSY, s: 8, shots: [4] },
  { name: 'split-max', w: 240, h: 460, fps: 20, level: FULL, events: BUSY, s: 8, shots: [4], max: true },
  { name: 'small-full', w: 360, h: 230, fps: 20, level: FULL, events: BUSY, s: 8, shots: [4] },
  { name: 'small-prompt', w: 360, h: 230, fps: 20, level: QUIET, events: [], prompt: 0.5, s: 8, shots: [0.8] }
].filter(s => !only || only.split(',').includes(s.name))

;(async () => {
  const { app } = await launch([path.join(__dirname, '..', 'fake', 'claude')], { appArgs: ['--skin', 'deck'], env: { SKINNED_GL: 'swiftshader' } })
  let viz = null
  for (let i = 0; i < 40 && !viz; i++) {
    await sleep(250)
    for (const w of app.windows()) if (w.url().includes('/viz/')) viz = w
  }
  check(viz, 'no viz window')
  viz.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  viz.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
  await viz.waitForFunction(() => typeof window.vizState === 'function' && window.VizCanvas && window.VizCanvas.carbon, null, { timeout: 30000 })
  // The counter, and for a measurement the mode with its factors
  // replaced, evaluated in the page as its scripts are.
  await viz.evaluate(src => (0, eval)(src), fs.readFileSync(path.join(root, 'scripts', 'flash.js'), 'utf8'))
  if (measuring) await viz.evaluate(src => (0, eval)(src), carbonSource())
  console.log(`clocks: events NIST / ${E}, light c / ${Number(light || C.LIGHT)}, warm-up ${(3 * fieldT).toFixed(1)} s${measuring ? ', a measurement: nothing asserted' : ''}`)

  const results = {}
  for (const sc of scenes) {
    const t0 = Date.now()
    await viz.evaluate(sc => {
      // The scene's chance draws are seeded by its name, so a scene
      // reads the same on every run: a burst of some 70 photons put 8
      // in a late quarter second by chance alone (0.114 against 0.1).
      // Math.random is the scene's own only inside these evaluates,
      // which no other pane's frame interrupts.
      let a = [...sc.name].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261)
      const rng = () => {
        a = (a + 0x6D2B79F5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
      const real = Math.random
      Math.random = rng
      try {
      const c = document.createElement('canvas')
      c.width = sc.w
      c.height = sc.h
      const g = c.getContext('2d', { willReadFrequently: true })
      // The axis alone, on a canvas of its own.
      const ac = document.createElement('canvas')
      ac.width = sc.w
      ac.height = sc.h
      const R = window.flashRun = { sc, c, g, r: window.VizCanvas.carbon(c, { text: () => 1 }), s: new window.Synth.Synth(), t: -sc.warm, counter: window.Flash.Counter(sc.w, sc.h, sc.fps, sc.win), ag: ac.getContext('2d', { willReadFrequently: true }), axis: window.Flash.Counter(sc.w, sc.h, sc.fps, sc.win), turn: window.Flash.Counter(sc.w, sc.h, sc.fps, sc.win), turned: { n: 0, x: null, y: null }, f2: 0, turning: 0, f2top: 0, pulsed: null, prev: null, resets: [], changes: 0, fronts: [], rates: [], born: [], lum: [], last: null, shots: [] }
      // B_MAX at the start's angle: a press at the dial's centre dragged
      // past its rim at 60 degrees from up.
      if (sc.max) {
        R.r.draw(R.s, 0)
        const d = R.r.probe().dial
        R.r.pointer('down', d.x, d.y, true)
        R.r.pointer('move', d.x + 2 * d.r * Math.sin(Math.PI / 3), d.y - 2 * d.r * Math.cos(Math.PI / 3), true)
        R.r.pointer('up', d.x + 2 * d.r * Math.sin(Math.PI / 3), d.y - 2 * d.r * Math.cos(Math.PI / 3), false)
      }
      R.rng = rng
      } finally {
        Math.random = real
      }
    }, Object.assign({ warm: 3 * fieldT, win }, sc))
    // Frames in chunks, so no one evaluate runs for long.
    for (;;) {
      const done = await viz.evaluate(() => {
        const R = window.flashRun
        const real = Math.random
        Math.random = R.rng
        try {
        const { sc, s, r } = R
        const dt = 1 / sc.fps
        for (let k = 0; k < 30; k++) {
          if (R.t >= sc.s) return true
          const e = []
          for (const [per, off, kind, cls] of sc.events) {
            const a = Math.floor((R.t - off) / per)
            const b = Math.floor((R.t + dt - off) / per)
            if (b > a) e.push(kind, cls)
          }
          if (sc.prompt !== undefined && R.t < sc.prompt && R.t + dt >= sc.prompt) e.push(3, 0)
          if (sc.subagent !== undefined && R.t < sc.subagent && R.t + dt >= sc.subagent) e.push(5, 0)
          if (sc.pulse !== undefined && R.t < sc.pulse && R.t + dt >= sc.pulse) {
            const b = r.probe().pulseButton
            r.pointer('down', b.x + b.w / 2, b.y + b.h / 2, true)
            r.pointer('up', b.x + b.w / 2, b.y + b.h / 2, false)
            const q = r.probe()
            R.pulsed = { pulses: q.pulses, level: q.level, n: q.beat && q.beat.n }
          }
          s.input({ n: [0, 0, 0, 0, 0, 0, 0], e })
          s.step(dt, null)
          Object.assign(s.level, sc.level)
          r.draw(s, dt)
          R.t += dt
          if (R.t < 0) continue
          const p = r.probe()
          const d = R.g.getImageData(0, 0, sc.w, sc.h).data
          R.counter.push(d, R.t)
          const ag = R.ag
          ag.fillStyle = '#000000'
          ag.fillRect(0, 0, sc.w, sc.h)
          if (p.axisLine) {
            ag.strokeStyle = 'rgba(111, 227, 255, 0.8)'
            ag.lineWidth = 1.5
            ag.beginPath()
            ag.moveTo(p.axisLine[0], p.axisLine[1])
            ag.lineTo(p.axisLine[2], p.axisLine[3])
            ag.stroke()
          }
          // The axis's turning alone: a counter of its own between two
          // settings of the axis anew, its most kept, so a reset's leap
          // counts in R.axis and not here.
          const reset = R.prev && p.lifted !== R.prev.lifted
          if (reset) {
            const c = R.turn.report().cell
            if (c.n > R.turned.n) R.turned = { n: c.n, x: c.x, y: c.y }
            R.turn = window.Flash.Counter(sc.w, sc.h, sc.fps, sc.win)
          }
          const px = ag.getImageData(0, 0, sc.w, sc.h).data
          R.axis.push(px, R.t)
          R.turn.push(px, R.t)
          // The repeat the probe states, 2 f_L, about the axis's own
          // turn: none with B along z, where it stands.
          const f2 = p.B.deg === 0 || p.B.deg === 180 ? 0 : 2 * p.larmor
          R.f2 += f2 * dt
          if (f2 > 0) R.turning += dt
          R.f2top = Math.max(R.f2top, f2)
          // The axis set anew since the last frame: the angle between
          // its line on the pane then and now, degrees, 0 to 90. Its rate
          // changed with no reset: a jump.
          const q = R.prev
          if (q && p.axisLine && q.line) {
            if (p.lifted !== q.lifted) {
              const at = l => Math.atan2(l[3] - l[1], l[2] - l[0])
              let d = Math.abs(at(p.axisLine) - at(q.line)) % Math.PI
              if (d > Math.PI / 2) d = Math.PI - d
              R.resets.push(Math.round(d * 180 / Math.PI))
            } else if (p.larmor !== q.larmor) R.changes++
          }
          R.prev = { lifted: p.lifted, larmor: p.larmor, line: p.axisLine && p.axisLine.slice() }
          // The frame's mean of R + G + B over 765, every 7th pixel.
          let sum = 0
          for (let i = 0; i < d.length; i += 28) sum += d[i] + d[i + 1] + d[i + 2]
          R.lum.push(sum / 765 / (d.length / 28))
          R.fronts.push(p.fronts)
          R.rates.push(p.rate)
          R.born.push(p.photons - (R.last === null ? p.photons : R.last))
          R.last = p.photons
          for (const at of sc.shots) {
            if (R.t >= at && R.t - dt < at) R.shots.push([at, R.c.toDataURL('image/png')])
          }
        }
        return false
        } finally {
          Math.random = real
        }
      })
      if (done) break
    }
    const res = await viz.evaluate(() => {
      const R = window.flashRun
      const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)
      const rep = R.counter.report()
      // Where the cells flashed: each cell's flashes a second, 0 black
      // to 6 and over white, red past 3, at the pane's size.
      const hm = R.counter.heat(R.sc.s)
      const hc = document.createElement('canvas')
      hc.width = R.sc.w
      hc.height = R.sc.h
      const hg = hc.getContext('2d')
      hg.drawImage(R.c, 0, 0)
      hg.fillStyle = 'rgba(0, 0, 0, 0.6)'
      hg.fillRect(0, 0, hc.width, hc.height)
      hm.v.forEach((v, i) => {
        if (!v) return
        const a = Math.min(1, v / 6)
        hg.fillStyle = v > 3 ? `rgba(255, 60, 40, ${a})` : `rgba(255, 255, 255, ${a})`
        hg.fillRect((i % hm.w) * window.Flash.CELL, Math.floor(i / hm.w) * window.Flash.CELL, window.Flash.CELL, window.Flash.CELL)
      })
      R.shots.push(['heat', hc.toDataURL('image/png')])
      const ax = R.axis.report().cell
      const tc = R.turn.report().cell
      if (tc.n > R.turned.n) R.turned = { n: tc.n, x: tc.x, y: tc.y }
      const q = R.r.probe()
      const med = a => a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : null
      const axis = { n: ax.n, x: ax.x, y: ax.y, over: ax.over, turned: R.turned, f2: Math.round(R.f2 / R.sc.s * 100) / 100, f2top: Math.round(R.f2top * 100) / 100, turning: Math.round(R.turning * 10) / 10, B: q.B, level: q.level, resets: R.resets.length, jump: med(R.resets), changes: R.changes }
      return { rep, axis, pulsed: R.pulsed, fronts: { mean: Math.round(mean(R.fronts)), max: Math.max(...R.fronts) }, rate: { mean: Math.round(mean(R.rates)), max: Math.max(...R.rates) }, lum: Math.round(mean(R.lum) * 1e4) / 1e4, born: R.born, shots: R.shots, fps: R.sc.fps }
    })
    for (const [at, png] of res.shots) fs.writeFileSync(path.join(out, `flash-${sc.name}${at === 'heat' ? '-heat' : sc.shots.length > 1 ? '-' + at : ''}.png`), Buffer.from(png.split(',')[1], 'base64'))
    // A prompt's burst: photons by time after it, and the time within
    // which nine tenths of them came.
    let burst = null
    if (sc.prompt !== undefined) {
      const dt = 1 / sc.fps
      const total = res.born.reduce((a, b) => a + b, 0)
      let acc = 0
      let t90 = null
      const bins = []
      res.born.forEach((n, i) => {
        const t = (i + 1) * dt - sc.prompt
        acc += n
        if (t90 === null && acc >= 0.9 * total) t90 = t
        const b = Math.max(0, Math.floor(t / 0.25))
        bins[b] = (bins[b] || 0) + n
      })
      // The most photons in a quarter second after t90, a share of all:
      // a second burst would show there.
      let late = 0
      for (let b = Math.ceil(t90 / 0.25); b < bins.length; b++) late = Math.max(late, (bins[b] || 0) / Math.max(1, total))
      burst = { photons: total, t90: t90 === null ? null : Math.round(t90 * 100) / 100, late: Math.round(late * 1000) / 1000, bins: bins.map(v => v || 0) }
    }
    const r = { scene: sc.name, pane: `${sc.w}x${sc.h}`, fps: sc.fps, max: !!sc.max, frame: res.rep.frame, window: res.rep.window, cell: res.rep.cell, axis: res.axis, pulsed: res.pulsed, fields: res.rep.fields, frames: res.rep.frames, fronts: res.fronts, rate: res.rate, lum: res.lum, burst }
    results[sc.name] = r
    const said = q => `${q.general.n} general and ${q.red.n} red, largest share of a quarter field ${q.share}`
    console.log(`scene ${sc.name} ${r.pane} at ${sc.fps} fps: the most flashes in any second of any of ${r.fields} fields, concurrent within a frame ${said(r.frame)}, within ${win} s ${said(r.window)}, a cell at most ${r.cell.n} a second at ${r.cell.x},${r.cell.y}, ${r.cell.over} cells over 3, B ${Math.round(r.axis.B.mT * 1000) / 1000} mT at ${r.axis.B.deg} deg, the axis alone a cell at most ${r.axis.n} a second at ${r.axis.x},${r.axis.y}, ${r.axis.over} cells over 3, its turning between resets at most ${r.axis.turned.n} at ${r.axis.turned.x},${r.axis.turned.y}, against a stated repeat 2 f_L of ${r.axis.f2} a second in the mean, ${r.axis.f2top} at most, turning ${r.axis.turning} s, ending in ${r.axis.level}, set anew ${r.axis.resets} times, by ${r.axis.jump} deg on the pane in the median, its rate changed by ${r.axis.changes} jumps${r.pulsed ? `, pulse ${r.pulsed.pulses} lifting ${r.pulsed.n} atoms, the drawn one to ${r.pulsed.level}` : ''}, fronts mean ${r.fronts.mean} max ${r.fronts.max}, photons/s mean ${r.rate.mean} max ${r.rate.max}, light ${r.lum}${burst ? `, prompt burst ${burst.photons} photons, nine tenths in ${burst.t90} s, at most ${burst.late} of them in a quarter second after, by quarter second ${burst.bins.join(' ')}` : ''}, ${Math.round((Date.now() - t0) / 1000)} s`)
  }
  fs.writeFileSync(path.join(out, 'flash.json'), JSON.stringify({ event: E, light: Number(light || C.LIGHT), results }, null, 1))
  check(!errors.length, 'page errors', errors)
  await app.close().catch(() => {})
  if (measuring) return console.log('done, a measurement')

  let turning = 0
  for (const r of Object.values(results)) {
    check(r.frame.general.n <= 3 && r.frame.red.n <= 3, `want no field flashing more than 3 times a second in ${r.scene}`, r.frame)
    if (!r.max) {
      check(r.axis.turned.n <= 3, `want no cell of the axis's turning flashing more than 3 times a second at the dial's start in ${r.scene}`, r.axis)
      turning += r.axis.turning
    }
    if (r.max) check(Math.abs(r.axis.B.mT - C.B_MAX * 1e3) < 1e-9 && r.axis.B.deg === 60, `want B_MAX at 60 degrees from the press in ${r.scene}`, r.axis.B)
    if (r.scene === 'subagent') check(r.axis.level === '2s2p3_5So_2', 'want the drawn atom left in 5So2 by a subagent', r.axis.level)
    if (r.pulsed) check(r.pulsed.pulses === 1 && r.pulsed.level === '2p4p_3P_2', `want the pulse to lift the drawn atom in ${r.scene}`, r.pulsed)
    if (r.burst) check(r.burst.photons > 0 && r.burst.late <= 0.1 && r.burst.t90 <= BURST, `want a single prompt to read as one burst in ${r.scene}`, r.burst)
  }
  if (Object.values(results).some(r => !r.max)) check(turning >= 2, 'want the drawn atom turning for 2 s in all at the dial\'s start', turning)
  const { full, moderate, idle } = results
  if (full && moderate && idle) {
    check(full.fronts.mean > moderate.fronts.mean && moderate.fronts.mean > idle.fronts.mean, 'want more fronts the busier the session', [full.fronts, moderate.fronts, idle.fronts])
    check(full.rate.mean > moderate.rate.mean && moderate.rate.mean > idle.rate.mean, 'want more photons the busier the session', [full.rate, moderate.rate, idle.rate])
    check(full.lum > idle.lum, 'want a busy frame brighter than an idle one', [full.lum, idle.lum])
  }
  console.log('done')
})().catch(e => { console.error(e); console.error(errors.join('\n')); process.exit(1) })
