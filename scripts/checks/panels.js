'use strict'
// Live check of the skins' resizable panels (decision 0035). Run under
// scripts/clean-env xvfb-run -a -s "-screen 0 1920x1080x24":
//   node scripts/checks/panels.js OUT [SKIN...]
// For each skin, at its initial window: each split's handle is dragged.
// The split takes the size the pointer gives, the terminal's edge moves
// by the drag and nothing else of it, the terminal reflows, and no box
// apart from another, the terminal's among them, meets it. A relaunch
// on the same state shows the dragged sizes. At a quarter tile (decision
// 0006) a drag as far as it goes keeps the terminal at 40 x 10 or more
// and meets nothing, and a split the tile leaves no room shows no
// handle. Reset panel sizes in the menu brings every split
// back to the skin's own. Writes OUT/<skin>-*.png. The fake is ended by
// its recorded pid.
const { launch, probe, childPid, openMenu, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const fakes = path.join(__dirname, '..', 'fake')
const SKINS = process.argv.length > 3 ? process.argv.slice(3) : ['deck', 'phosphor', 'coffee', 'library']
const TILE = [960, 1048 / 2 - 37]

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

const page = win => win.evaluate(() => window.skinnedPage())
const resize = (app, w, h) => app.evaluate(({ BrowserWindow }, [w, h]) => {
  BrowserWindow.getAllWindows().find(x => !x.getTitle().startsWith('visualization')).setContentSize(w, h)
}, [w, h])
const over = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
const pane = p => p.panes.find(x => x.shown) || p.panes[0]

// The boxes shown: widgets, panels and the terminal, by a name.
function boxes (p) {
  const out = new Map()
  for (const w of p.widgets) if (w.visible && w.box.width && w.box.height) out.set(w.id, w.box)
  p.panels.forEach((x, i) => { if (x.box.width && x.box.height) out.set(`panel ${i} ${x.class}`, x.box) })
  out.set('terminal', p.term)
  return out
}

// Pairs that meet in after but were apart in before.
function met (before, after) {
  const a = boxes(before)
  const b = boxes(after)
  const names = [...b.keys()].filter(n => a.has(n))
  const hits = []
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const [x, y] = [names[i], names[j]]
      if (!over(a.get(x), a.get(y)) && over(b.get(x), b.get(y))) hits.push(`${x} / ${y}`)
    }
  }
  return hits
}

// Drag a split's handle by d px of the screen along its axis.
async function drag (win, s, d) {
  const across = s.edge === 'left' || s.edge === 'right'
  const x = s.box.x + s.box.width / 2
  const y = s.box.y + s.box.height / 2
  await win.mouse.move(x, y)
  await win.mouse.down()
  await win.mouse.move(across ? x + d : x, across ? y : y + d, { steps: 12 })
  await win.mouse.up()
  await sleep(800)
}

// The screen px that grow a split by n px of the layout, at scale k.
const toward = (s, n, k) => (s.edge === 'left' || s.edge === 'top' ? 1 : -1) * n * k

let launched = null
async function start (skin, dir) {
  const env = { SKINNED_GL: 'swiftshader', PATH: `${fakes}:${process.env.PATH}` }
  for (const [k, d] of [['XDG_RUNTIME_DIR', path.join(dir, 'run')], ['XDG_STATE_HOME', path.join(dir, 'state')], ['HOME', path.join(dir, 'home')], ['CLAUDE_CONFIG_DIR', path.join(dir, 'config')]]) {
    env[k] = d
    fs.mkdirSync(d, { recursive: true, mode: 0o700 })
  }
  launched = await launch(['claude'], { appArgs: ['--skin', skin, '--no-viz'], env })
  await sleep(3500)
  return launched
}

async function stop (app) {
  const pid = await childPid(app)
  try { process.kill(-pid, 'SIGHUP') } catch (e) { console.log('kill', e.code) }
  await sleep(1500)
  await app.close().catch(() => {})
  launched = null
}

async function one (skin) {
  const dir = path.join(out, skin)
  let { app, win } = await start(skin, dir)
  let p = await page(win)
  check(p.splits.length > 0, `${skin}: want at least one split`)
  await shot(win, path.join(out, `${skin}-before.png`))
  const dragged = {}
  for (const s0 of p.splits) {
    const before = await page(win)
    const s = before.splits.find(x => x.id === s0.id)
    check(s.shown, `${skin} ${s.id}: want the handle shown at the initial window`)
    check(s.cursor === (s.edge === 'left' || s.edge === 'right' ? 'col-resize' : 'row-resize'), `${skin} ${s.id}: want the resize cursor on the handle, got ${s.cursor}`)
    // Grow where the split can, else shrink.
    const n = s.max - s.size >= 20 ? Math.min(120, s.max - s.size) : Math.max(-120, s.min - s.size)
    check(Math.abs(n) >= 20, `${skin} ${s.id}: want room to drag at the initial window, range ${s.min} to ${s.max} at ${s.size}`)
    const d = toward(s, n, before.scale)
    await drag(win, s, d)
    const after = await page(win)
    const t = after.splits.find(x => x.id === s.id)
    const [a, b] = [before.term, after.term]
    const edges = { left: [a.x, b.x], right: [a.x + a.width, b.x + b.width], top: [a.y, b.y], bottom: [a.y + a.height, b.y + b.height] }
    const moved = Object.fromEntries(Object.entries(edges).map(([e, [x, y]]) => [e, Math.round(y - x)]))
    const want = Object.fromEntries(Object.keys(edges).map(e => [e, e === s.edge ? Math.round(d) : 0]))
    const cells = [pane(before), pane(after)].map(x => [x.cols, x.rows])
    const hits = met(before, after)
    console.log(skin, s.id, JSON.stringify({ size: [s.size, t.size], n, moved, cells, hits }))
    await shot(win, path.join(out, `${skin}-${s.id}.png`))
    check(Math.abs(t.size - s.size - n) <= 1, `${skin} ${s.id}: want the size ${s.size + n}, got ${t.size}`)
    for (const e of Object.keys(edges)) check(Math.abs(moved[e] - want[e]) <= 1, `${skin} ${s.id}: want the terminal's edges moved by ${JSON.stringify(want)}, got ${JSON.stringify(moved)}`)
    const axis = s.edge === 'left' || s.edge === 'right' ? 0 : 1
    check((cells[1][axis] - cells[0][axis]) * n < 0 && cells[1][1 - axis] === cells[0][1 - axis], `${skin} ${s.id}: want the terminal reflowed on its axis alone, ${JSON.stringify(cells)}`)
    check(hits.length === 0, `${skin} ${s.id}: boxes meet after the drag: ${hits.join(', ')}`)
    dragged[s.id] = t.size
  }
  const kept = JSON.parse(fs.readFileSync(path.join(dir, 'state', 'claude-skins', 'settings.json'), 'utf8')).panels
  console.log(skin, 'kept', JSON.stringify(kept))
  check(JSON.stringify(kept[skin]) === JSON.stringify(dragged), `${skin}: want the settings to keep ${JSON.stringify(dragged)}`)

  await stop(app)
  ;({ app, win } = await start(skin, dir))
  p = await page(win)
  const again = Object.fromEntries(p.splits.map(s => [s.id, s.size]))
  console.log(skin, 'relaunched', JSON.stringify(again))
  await shot(win, path.join(out, `${skin}-relaunched.png`))
  check(JSON.stringify(again) === JSON.stringify(dragged), `${skin}: want the relaunch at ${JSON.stringify(dragged)}, got ${JSON.stringify(again)}`)

  await resize(app, ...TILE)
  await sleep(2000)
  const tile = await page(win)
  await shot(win, path.join(out, `${skin}-quarter.png`))
  for (const s0 of tile.splits) {
    const before = await page(win)
    const s = before.splits.find(x => x.id === s0.id)
    // A split the tile leaves no room has no handle.
    if (s.min >= s.max) {
      console.log(skin, 'quarter', s.id, JSON.stringify({ scale: before.scale, size: s.size, range: [s.min, s.max], shown: s.shown }))
      check(!s.shown && s.size === s.def, `${skin} ${s.id}: want no handle and the skin's own size where the tile leaves no room`)
      continue
    }
    check(s.shown, `${skin} ${s.id}: want the handle shown at the quarter tile`)
    await drag(win, s, toward(s, 2000, before.scale))
    const after = await page(win)
    const t = after.splits.find(x => x.id === s.id)
    const c = pane(after)
    const hits = met(before, after)
    console.log(skin, 'quarter', s.id, JSON.stringify({ scale: after.scale, size: [s.size, t.size], range: [t.min, t.max], cells: [c.cols, c.rows], hits }))
    await shot(win, path.join(out, `${skin}-quarter-${s.id}.png`))
    check(Math.abs(t.size - t.max) <= 1, `${skin} ${s.id}: want the quarter tile's drag held at ${t.max}, got ${t.size}`)
    check(c.cols >= 40 && c.rows >= 10, `${skin} ${s.id}: ${c.cols} x ${c.rows} cells at the quarter tile, want 40 x 10`)
    check(hits.length === 0, `${skin} ${s.id}: boxes meet at the quarter tile: ${hits.join(', ')}`)
  }

  await openMenu(win)
  await win.locator('#menu .item', { hasText: 'Reset panel sizes' }).click()
  await sleep(1000)
  p = await page(win)
  const reset = p.splits.map(s => [s.id, s.size, s.def])
  const file = JSON.parse(fs.readFileSync(path.join(dir, 'state', 'claude-skins', 'settings.json'), 'utf8')).panels
  console.log(skin, 'reset', JSON.stringify({ reset, kept: file }))
  await shot(win, path.join(out, `${skin}-reset.png`))
  check(p.splits.every(s => s.size === s.def) && !(skin in file), `${skin}: want every split back at the skin's own and none kept`)
  await stop(app)
}

;(async () => {
  for (const skin of SKINS) await one(skin)
})().then(() => console.log('done'), async e => {
  console.error(e)
  process.exitCode = 1
  if (!launched) return
  for (const x of (await probe(launched.app).catch(() => ({ tabs: [] }))).tabs) if (x.childPid) try { process.kill(-x.childPid, 'SIGHUP') } catch (err) {}
  await launched.app.close().catch(() => {})
})
