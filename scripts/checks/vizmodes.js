'use strict'
/* global requestAnimationFrame, Image */
// Live check of the visualization's procedural modes (decision 0015)
// under xvfb-run:
//   node scripts/checks/vizmodes.js OUT
// The fakes of scripts/fake come first on PATH. The menu lists every
// mode, and the space bar steps a pane through all of them.
// It reports the frame rate of three panes in butterchurn modes and in
// the procedural modes, measured in turn, and asserts nothing of it,
// since the host's load moves it. Then one pane
// per procedural mode, each its own tab, is captured at work, idle (the
// fake claude holds its turns while OUT/pause exists), just after a
// prompt, during tool calls and on the sound output input: each draws
// something, its idle frame differs from its work frame and its prompt
// frame from its idle frame. The frames
// go to OUT/<mode>-<phase>.png and a contact sheet to OUT/viz-modes.png.
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

function check (ok, msg) {
  if (!ok) throw new Error(msg)
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
  async function panes (n) {
    while ((await state()).panes.length < n) {
      await win.evaluate(() => window.skinned.newTab())
      await sleep(900)
    }
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
  const shots = {}
  const take = async phase => {
    shots[phase] = await viz.evaluate(grab)
    for (let j = 0; j < NEW.length; j++) fs.writeFileSync(path.join(out, `${NEW[j]}-${phase}.png`), Buffer.from(shots[phase][j].png.split(',')[1], 'base64'))
  }
  await sleep(4000)
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
  // The fake recorder swells every 2 s.
  await sleep(2500)
  const sound2 = await viz.evaluate(grab)
  check((await state()).sound.st === 1, 'want live sound output samples')

  for (let j = 0; j < NEW.length; j++) {
    const g = ph => shots[ph][j].grid
    const r = { idle: changed(g('work'), g('idle')), prompt: changed(g('idle'), g('prompt')), sound: changed(g('sound'), sound2[j].grid) }
    const peaks = PHASES.map(ph => peak(g(ph)))
    console.log(NEW[j], 'diff', JSON.stringify(r, (k, v) => typeof v === 'number' ? Math.round(v * 1000) / 1000 : v), 'peaks', peaks.join(' '))
    check(peaks.every(v => v > 40), `${NEW[j]}: a blank frame`)
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
