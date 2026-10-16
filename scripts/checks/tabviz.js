'use strict'
// Live check of each tab's visualization in the tab strip (decision
// 0015, 2026-10-15) under xvfb-run:
//   node scripts/checks/tabviz.js OUT cost [ROOT ...]
//   node scripts/checks/tabviz.js OUT look
// cost: six tabs of the fake claude, all at work, with the visualization
// window open and with none. Measured at once, three times a launch:
// the main renderer's frame rate, its median and 95th percentile frame
// time and the 95th percentile lag of a 20 ms timer, the visualization
// window's frame rate, and the CPU of the main renderer, the viz
// renderer, the GPU process and the main process, read from /proc.
// Each ROOT, an app tree such as a checkout of an earlier commit, is
// launched in turn, three rounds, so each sees the same host load. It
// asserts nothing, since the host's load moves it.
// look: in each of two skins, four tabs of the fake claude, the second
// and fourth held idle (the fake starts no turn while OUT/pause.<its
// pid> exists), the others at work. Each held tab's visualization must
// read done and show its flat line alone, each working tab's a band, the
// strip keeps its height, and the held tab works again once let go.
// Then the window at a quarter tile of 1920 x 1080, as quarter.js sets
// it, and at eight tabs. The window goes to OUT/<skin>-<tag>.png, the
// strip to OUT/<skin>-<tag>-strip.png and three times as large to
// OUT/<skin>-<tag>-strip3.png, to look at.
const { launch, probe, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const what = process.argv[3]
const here = path.join(__dirname, '..', '..')
fs.mkdirSync(out, { recursive: true })

const median = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)]
const round1 = v => Math.round(v * 10) / 10

async function vizOf (app) {
  for (let i = 0; i < 40; i++) {
    for (const w of app.windows()) if (w.url().includes('/viz/')) return w
    await sleep(250)
  }
  throw new Error('no viz window')
}

async function end (app) {
  for (const t of (await probe(app)).tabs) try { process.kill(-t.childPid, 'SIGHUP') } catch (e) {}
  await sleep(1500)
  await app.close().catch(() => {})
}

// The main renderer's frames and timer lag, and the viz window's frames,
// over the same ms.
function mainFrames (ms) {
  return new Promise(resolve => {
    const gaps = []
    const lags = []
    const t0 = performance.now()
    let last = t0
    let tick = t0
    const timer = setInterval(() => {
      const now = performance.now()
      lags.push(Math.max(0, now - tick - 20))
      tick = now
    }, 20)
    const f = now => {
      gaps.push(now - last)
      last = now
      if (now - t0 < ms) requestAnimationFrame(f)
      else {
        clearInterval(timer)
        resolve({ gaps, lags })
      }
    }
    requestAnimationFrame(f)
  })
}
function vizFrames (ms) {
  return new Promise(resolve => {
    let n = 0
    const t0 = performance.now()
    const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else resolve(n * 1000 / ms) }
    requestAnimationFrame(f)
  })
}

// The pids of the main renderer, the viz renderer, the GPU process and
// the main process.
const pidsOf = app => app.evaluate(({ app, BrowserWindow }) => {
  const all = app.getAppMetrics()
  const wins = BrowserWindow.getAllWindows()
  const v = wins.find(w => w.webContents.getURL().includes('/viz/'))
  const m = wins.find(w => w !== v)
  const of = type => (all.find(x => x.type === type) || {}).pid || 0
  return { main: m.webContents.getOSProcessId(), viz: v ? v.webContents.getOSProcessId() : 0, gpu: of('GPU'), browser: of('Browser') }
})

// Each pid's user and system time so far, in clock ticks of 10 ms.
function ticks (pids) {
  const out = {}
  for (const [k, pid] of Object.entries(pids)) {
    try {
      const f = fs.readFileSync(`/proc/${pid}/stat`, 'utf8')
      const v = f.slice(f.lastIndexOf(')') + 2).split(' ')
      out[k] = Number(v[11]) + Number(v[12])
    } catch (e) { out[k] = 0 }
  }
  return out
}

// open: the visualization window open, in the modes a fresh launch gives
// six panes, else --no-viz.
async function costOf (root, open) {
  const fake = path.join(root, 'scripts', 'fake', 'claude')
  const { app, win } = await launch([fake], { root, appArgs: ['--skin', 'deck', ...(open ? [] : ['--no-viz'])], env: { SKINNED_GL: 'swiftshader' } })
  const viz = open ? await vizOf(app) : null
  await sleep(2000)
  for (let k = 1; k < 6; k++) {
    await win.evaluate(() => window.skinned.newTab())
    await sleep(900)
  }
  await sleep(5000)
  const runs = []
  for (let k = 0; k < 3; k++) {
    const pids = await pidsOf(app)
    const t0 = ticks(pids)
    const w0 = Date.now()
    const [m, v] = await Promise.all([win.evaluate(mainFrames, 4000), viz ? viz.evaluate(vizFrames, 4000) : 0])
    const t1 = ticks(pids)
    const c = {}
    for (const k of Object.keys(pids)) c[k] = (t1[k] - t0[k]) * 10 * 100 / (Date.now() - w0)
    const g = m.gaps.slice(1).sort((a, b) => a - b)
    const l = m.lags.slice().sort((a, b) => a - b)
    runs.push({ fps: g.length * 1000 / g.reduce((s, x) => s + x, 0), med: g[Math.floor(g.length / 2)], p95: g[Math.floor(g.length * 0.95)], lag: l[Math.floor(l.length * 0.95)], viz: v, cpuMain: c.main, cpuViz: c.viz, cpuGpu: c.gpu, cpuBrowser: c.browser })
    await sleep(500)
  }
  const tabs = (await probe(app)).tabs.length
  await end(app)
  const r = {}
  for (const key of Object.keys(runs[0])) r[key] = round1(median(runs.map(x => x[key])))
  r.tabs = tabs
  return r
}

const line = r => `main ${r.fps} fps, frame median ${r.med} ms, p95 ${r.p95} ms, timer lag p95 ${r.lag} ms, viz ${r.viz} fps, cpu % of a core: main renderer ${r.cpuMain}, viz renderer ${r.cpuViz}, gpu ${r.cpuGpu}, main process ${r.cpuBrowser}`

async function cost (roots) {
  const all = new Map()
  for (let round = 0; round < 3; round++) {
    for (const open of [true, false]) {
      for (const root of roots) {
        const key = `${root} ${open ? 'viz open' : 'no viz'}`
        const r = await costOf(root, open)
        if (!all.has(key)) all.set(key, [])
        all.get(key).push(r)
        console.log(`round ${round} ${key}: ${r.tabs} tabs, ${line(r)}`)
      }
    }
  }
  for (const [key, rs] of all) {
    const m = {}
    for (const k of Object.keys(rs[0])) m[k] = round1(median(rs.map(x => x[k])))
    console.log(`median ${key}: ${line(m)}`)
  }
}

const TILE = [960, 1048 / 2 - 37]

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

// Each tab canvas's share of lit pixels off its middle rows, where the
// done line runs, and on them.
function ink () {
  return [...document.querySelectorAll('#tabs .tab')].map(el => {
    const c = el.querySelector('canvas.viz')
    if (!c) return { id: Number(el.dataset.id), band: null, line: null }
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    const mid = c.height / 2
    let band = 0
    let line = 0
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4
        const lit = d[i + 3] > 40 && Math.max(d[i], d[i + 1], d[i + 2]) > 60
        if (!lit) continue
        if (y >= mid - 1 && y < mid + 1) line++
        else band++
      }
    }
    return { id: Number(el.dataset.id), band: band / (c.width * (c.height - 2)), line: line / (c.width * 2) }
  })
}

// The strip as drawn, and three times as large, pixel for pixel.
async function strip (win, file) {
  const r = await win.evaluate(() => document.getElementById('tabs').getBoundingClientRect().toJSON())
  const clip = { x: 0, y: r.y, width: r.width, height: r.height }
  const png = await win.screenshot({ clip })
  fs.writeFileSync(file, png)
  const big = await win.evaluate(async b64 => {
    const img = new Image()
    await new Promise(resolve => { img.onload = resolve; img.src = 'data:image/png;base64,' + b64 })
    const c = document.createElement('canvas')
    c.width = img.width * 3
    c.height = img.height * 3
    const g = c.getContext('2d')
    g.imageSmoothingEnabled = false
    g.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/png').split(',')[1]
  }, png.toString('base64'))
  fs.writeFileSync(file.replace(/\.png$/, '3.png'), Buffer.from(big, 'base64'))
}

async function lookAt (skin) {
  const fake = path.join(here, 'scripts', 'fake', 'claude')
  const pause = path.join(out, 'pause')
  const { app, win } = await launch([fake], { appArgs: ['--skin', skin, '--no-viz'], env: { SKINNED_GL: 'swiftshader', FAKE_CLAUDE_PAUSE: pause } })
  const held = []
  try {
    await sleep(2000)
    for (let k = 1; k < 4; k++) {
      await win.evaluate(() => window.skinned.newTab())
      await sleep(900)
    }
    const tabs = (await probe(app)).tabs
    check(tabs.length === 4, `${skin}: want four tabs, have ${tabs.length}`)
    for (const t of [tabs[1], tabs[3]]) {
      const f = `${pause}.${t.childPid}`
      fs.writeFileSync(f, '')
      held.push({ id: t.id, f })
    }
    const isHeld = id => held.some(h => h.id === id)
    const state = () => win.evaluate(() => window.TabViz.state())
    // A held tab is done once its last turn ends and its terminal has
    // been quiet DONE_S, its band gone once it has scrolled out. A
    // working tab is caught inside a turn.
    const since = new Map()
    let ready = false
    for (let i = 0; i < 160 && !ready; i++) {
      await sleep(250)
      const st = await state()
      for (const x of st) {
        if (!isHeld(x.id)) continue
        if (x.done < 0.95) since.delete(x.id)
        else if (!since.has(x.id)) since.set(x.id, Date.now())
      }
      ready = st.every(x => isHeld(x.id) ? since.has(x.id) && Date.now() - since.get(x.id) > 6500 : x.busy > 0.9 && x.done < 0.05)
    }
    check(ready, `${skin}: the held tabs never read done while the others worked`)
    const shots = async tag => {
      await shot(win, path.join(out, `${skin}-${tag}.png`))
      await strip(win, path.join(out, `${skin}-${tag}-strip.png`))
    }
    await shots('tabs')
    const seen = await win.evaluate(ink)
    console.log(skin, 'ink', JSON.stringify(seen, (k, v) => typeof v === 'number' && k !== 'id' ? Math.round(v * 1000) / 1000 : v))
    for (const s of seen) {
      if (isHeld(s.id)) check(s.band < 0.05 && s.line > 0.9, `${skin}: held tab ${s.id} shows more than its flat line`)
      else check(s.band > 0.12, `${skin}: working tab ${s.id} shows no band`)
    }
    const box = await win.evaluate(() => ({ strip: document.getElementById('tabs').getBoundingClientRect().height, stage: document.getElementById('stage').getBoundingClientRect().top }))
    check(box.strip === 24 && box.stage === 46, `${skin}: the strip is ${box.strip} px and the stage starts at ${box.stage}`)

    // At a quarter tile, with the four tabs and with eight.
    await app.evaluate(({ BrowserWindow }, [w, h]) => {
      BrowserWindow.getAllWindows().find(x => !x.getTitle().startsWith('visualization')).setContentSize(w, h)
    }, TILE)
    await sleep(1200)
    await shots('quarter')
    for (let k = 4; k < 8; k++) {
      await win.evaluate(() => window.skinned.newTab())
      await sleep(700)
    }
    await sleep(3000)
    await shots('quarter8')
    const fit = await win.evaluate(() => [...document.querySelectorAll('#tabs .tab')].map(el => {
      const c = el.querySelector('canvas.viz').getBoundingClientRect()
      const t = el.getBoundingClientRect()
      return c.width >= 22 && c.left >= t.left && c.right <= t.right
    }))
    check(fit.length === 8 && fit.every(Boolean), `${skin}: a tab's visualization is cut at eight tabs in a quarter tile`)

    // Let the first held tab go: it works again.
    fs.rmSync(held[0].f, { force: true })
    let back = false
    for (let i = 0; i < 80 && !back; i++) {
      await sleep(250)
      back = (await state()).some(s => s.id === held[0].id && s.done < 0.05 && s.busy > 0.9)
    }
    check(back, `${skin}: tab ${held[0].id} did not work again once let go`)
    console.log(skin, 'ok')
  } finally {
    for (const h of held) fs.rmSync(h.f, { force: true })
    await end(app)
  }
}

;(async () => {
  if (what === 'cost') await cost(process.argv.length > 4 ? process.argv.slice(4).map(r => path.resolve(r)) : [here])
  else if (what === 'look') for (const skin of ['deck', 'phosphor']) await lookAt(skin)
  else throw new Error(`unknown check ${what}`)
  console.log('done')
})().catch(e => { console.error(e); process.exit(1) })
