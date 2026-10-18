'use strict'
// Live check of the Carbon mode's flashes (issues #164 and #166,
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
// Scenes, each after a warm-up of three of the field's slowest times:
// full activity (every level held at 1, as vizcarbon.js holds it, and a
// tool call every 2 s), moderate (levels 0.5, a tool call every 4 s),
// idle, and a single prompt on a quiet session, in a full pane of 1200
// by 760 at 60 frames a second, and full activity and a prompt in small
// panes, 240 by 460 (a split of three) and 360 by 230 (four), at 20,
// the split's frame rate. A busy session must show more fronts and
// photons than a moderate one, and that more than an idle one, and its
// frames must be brighter than an idle one's. A single prompt must read
// as one burst: nine tenths of its photons within BURST seconds, 0.8 s
// at an event clock of 1e6 scaled with it, and no quarter second after
// that holding a tenth of them. --event and
// --light replace the mode's two clock factors, --set NAME=V any other
// constant, --window S the concurrency window of the second count: a
// measurement, which asserts nothing. Frames go to
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
  { name: 'moderate', w: 1200, h: 760, fps: 60, level: HALF, events: SOME, s: 12, shots: [] },
  { name: 'idle', w: 1200, h: 760, fps: 60, level: IDLE, events: [], s: 6, shots: [3] },
  { name: 'prompt', w: 1200, h: 760, fps: 60, level: QUIET, events: [], prompt: 0.5, s: 8, shots: [0.8, 2] },
  { name: 'split-full', w: 240, h: 460, fps: 20, level: FULL, events: BUSY, s: 8, shots: [4] },
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
      const c = document.createElement('canvas')
      c.width = sc.w
      c.height = sc.h
      const g = c.getContext('2d', { willReadFrequently: true })
      window.flashRun = { sc, c, g, r: window.VizCanvas.carbon(c, { text: () => 1 }), s: new window.Synth.Synth(), t: -sc.warm, counter: window.Flash.Counter(sc.w, sc.h, sc.fps, sc.win), fronts: [], rates: [], born: [], lum: [], last: null, shots: [] }
    }, Object.assign({ warm: 3 * fieldT, win }, sc))
    // Frames in chunks, so no one evaluate runs for long.
    for (;;) {
      const done = await viz.evaluate(() => {
        const R = window.flashRun
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
          s.input({ n: [0, 0, 0, 0, 0, 0, 0], e })
          s.step(dt, null)
          Object.assign(s.level, sc.level)
          r.draw(s, dt)
          R.t += dt
          if (R.t < 0) continue
          const p = r.probe()
          const d = R.g.getImageData(0, 0, sc.w, sc.h).data
          R.counter.push(d, R.t)
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
      return { rep, fronts: { mean: Math.round(mean(R.fronts)), max: Math.max(...R.fronts) }, rate: { mean: Math.round(mean(R.rates)), max: Math.max(...R.rates) }, lum: Math.round(mean(R.lum) * 1e4) / 1e4, born: R.born, shots: R.shots, fps: R.sc.fps }
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
    const r = { scene: sc.name, pane: `${sc.w}x${sc.h}`, fps: sc.fps, frame: res.rep.frame, window: res.rep.window, cell: res.rep.cell, fields: res.rep.fields, frames: res.rep.frames, fronts: res.fronts, rate: res.rate, lum: res.lum, burst }
    results[sc.name] = r
    const said = q => `${q.general.n} general and ${q.red.n} red, largest share of a quarter field ${q.share}`
    console.log(`scene ${sc.name} ${r.pane} at ${sc.fps} fps: the most flashes in any second of any of ${r.fields} fields, concurrent within a frame ${said(r.frame)}, within ${win} s ${said(r.window)}, a cell at most ${r.cell.n} a second at ${r.cell.x},${r.cell.y}, ${r.cell.over} cells over 3, fronts mean ${r.fronts.mean} max ${r.fronts.max}, photons/s mean ${r.rate.mean} max ${r.rate.max}, light ${r.lum}${burst ? `, prompt burst ${burst.photons} photons, nine tenths in ${burst.t90} s, at most ${burst.late} of them in a quarter second after, by quarter second ${burst.bins.join(' ')}` : ''}, ${Math.round((Date.now() - t0) / 1000)} s`)
  }
  fs.writeFileSync(path.join(out, 'flash.json'), JSON.stringify({ event: E, light: Number(light || C.LIGHT), results }, null, 1))
  check(!errors.length, 'page errors', errors)
  await app.close().catch(() => {})
  if (measuring) return console.log('done, a measurement')

  for (const r of Object.values(results)) {
    check(r.frame.general.n <= 3 && r.frame.red.n <= 3, `want no field flashing more than 3 times a second in ${r.scene}`, r.frame)
    if (r.burst) check(r.burst.photons > 0 && r.burst.late <= 0.1 && r.burst.t90 <= BURST, `want a single prompt to read as one burst in ${r.scene}`, r.burst)
  }
  const { full, moderate, idle } = results
  if (full && moderate && idle) {
    check(full.fronts.mean > moderate.fronts.mean && moderate.fronts.mean > idle.fronts.mean, 'want more fronts the busier the session', [full.fronts, moderate.fronts, idle.fronts])
    check(full.rate.mean > moderate.rate.mean && moderate.rate.mean > idle.rate.mean, 'want more photons the busier the session', [full.rate, moderate.rate, idle.rate])
    check(full.lum > idle.lum, 'want a busy frame brighter than an idle one', [full.lum, idle.lum])
  }
  console.log('done')
})().catch(e => { console.error(e); console.error(errors.join('\n')); process.exit(1) })
