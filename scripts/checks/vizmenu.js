'use strict'
// Live check of each pane's mode drop-down (decision 0015) under
// xvfb-run:
//   node scripts/checks/vizmenu.js OUT
// In a window of three panes, a click on pane 2's button opens its
// drop-down, every mode in the order of modes.js with pane 2's marked. A
// click on a row shows that mode in pane 2 alone, closes the drop-down,
// is recorded as the menu's pick is, and reaches no mode: the quantum
// pane it lands on holds no barrier. A click in the pane then goes to
// the mode, which stays. A press outside an open drop-down closes it and
// changes no mode, and the button closes its own. No page or console
// error. Frames go to OUT/menu-*.png. Fakes only.
const { launch, sleep } = require('../drive.js')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { MODES } = require('../../app/viz/modes')

const out = path.resolve(process.argv[2])
const fake = path.join(__dirname, '..', 'fake', 'claude')
fs.mkdirSync(out, { recursive: true })
const state = fs.mkdtempSync(path.join(os.tmpdir(), 'skinned-vizmenu-'))
const errors = []

function check (ok, msg, seen) {
  if (!ok) throw new Error(seen === undefined ? msg : `${msg}, saw ${JSON.stringify(seen)}`)
}

// get() once ok(value) holds, else after ms the last value seen.
async function until (get, ok, ms, step = 100) {
  const t0 = Date.now()
  let v = await get()
  while (!ok(v) && Date.now() - t0 < ms) {
    await sleep(step)
    v = await get()
  }
  return v
}

// The newest viz mode record (decision 0022).
function record () {
  const dir = path.join(state, 'claude-skins', 'last-viz')
  const all = fs.existsSync(dir) ? fs.readdirSync(dir).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) : []
  all.sort((a, b) => b.t - a.t)
  return all[0] ? all[0].spec : null
}

;(async () => {
  const { app, win } = await launch([fake], { appArgs: ['--skin', 'deck'], env: { SKINNED_GL: 'swiftshader', XDG_STATE_HOME: state } })
  let viz = null
  for (let i = 0; i < 40 && !viz; i++) {
    await sleep(250)
    for (const w of app.windows()) if (w.url().includes('/viz/')) viz = w
  }
  check(viz, 'no viz window')
  viz.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  viz.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
  await viz.waitForFunction(() => typeof window.vizState === 'function', null, { timeout: 30000 })
  const look = () => viz.evaluate(() => window.vizState())
  const modes = s => s.panes.map(p => p.mode)
  const centre = b => [b.x + b.w / 2, b.y + b.h / 2]

  for (let i = 0; i < 2; i++) await win.evaluate(() => window.skinned.newTab())
  let s = await until(look, s => s.panes.length === 3 && s.panes.every(p => p.mode && p.button), 30000)
  check(s.panes.length === 3, 'want three panes', s.panes)
  await sleep(1500)
  s = await look()
  await viz.screenshot({ path: path.join(out, 'menu-closed.png') })

  // Pane 2's button opens its drop-down.
  const p2 = s.panes[1]
  await viz.mouse.click(...centre(p2.button))
  let t = await until(look, t => t.panes[1].open && t.menu.length === MODES.length, 5000)
  console.log('open', JSON.stringify({ open: t.panes.map(p => p.open), rows: t.menu.map(r => r.label), current: t.menu.filter(r => r.current).map(r => r.label) }))
  check(t.panes[1].open && t.panes.filter(p => p.open).length === 1, 'want pane 2\'s drop-down open, and no other', t.panes.map(p => p.open))
  check(t.menu.map(r => r.label.replace(/^\W+/, '')).join() === MODES.map(m => m.label).join(), 'want a row per mode in the order of modes.js', t.menu.map(r => r.label))
  const mark = t.menu.filter(r => r.current).map(r => r.label.replace(/^\W+/, ''))
  check(mark.length === 1 && mark[0] === MODES.find(m => m.id === p2.mode).label, 'want pane 2\'s mode marked', mark)
  const [W, H] = await viz.evaluate(() => [window.innerWidth, window.innerHeight])
  check(t.menu.every(r => r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H), 'want every row inside the window', t.menu)
  check(modes(t).join() === modes(s).join(), 'the button changed a mode', modes(t))
  await sleep(300)
  await viz.screenshot({ path: path.join(out, 'menu-open.png') })

  // A row: quantum, unless a pane shows it, else the first mode none shows.
  const target = MODES.find(m => m.id === 'quantum' && !modes(s).includes('quantum')) || MODES.find(m => !modes(s).includes(m.id))
  const row = t.menu[MODES.indexOf(target)]
  // Read at the press, within a tone's 0.5 s: a mode that heard the
  // press would hold a tone, or a quantum barrier.
  await viz.mouse.move(...centre(row))
  await viz.mouse.down()
  const pressed = await look()
  await viz.mouse.up()
  console.log('at the row\'s press', JSON.stringify(pressed.panes.map(p => ({ mode: p.mode, touches: p.touches, probe: p.probe }))))
  check(pressed.panes.every(p => p.touches === 0 && !(p.probe && p.probe.strokes)), 'the row\'s press reached a mode', pressed.panes)
  t = await until(look, t => t.panes[1].mode === target.id && t.menu.length === 0, 5000)
  console.log('picked', JSON.stringify({ target: target.id, before: modes(s), after: modes(t), open: t.panes.map(p => p.open), record: record() }))
  check(t.panes[1].mode === target.id, `want pane 2 in ${target.id}`, modes(t))
  check(t.panes[0].mode === s.panes[0].mode && t.panes[2].mode === s.panes[2].mode, 'the pick changed another pane', modes(t))
  check(t.menu.length === 0 && !t.panes.some(p => p.open), 'want the drop-down closed after the pick', t.panes.map(p => p.open))
  check(record() === target.id, `want ${target.id} recorded`, record())
  const menuState = await win.evaluate(() => window.skinned.vizState())
  check(menuState.modes.find(m => m.current).id === s.panes[2].mode, 'want the menu\'s flyout still marking the active tab\'s pane', menuState.modes.filter(m => m.current))
  await sleep(1200)
  t = await look()
  const probe = t.panes[1].probe
  if (target.id === 'quantum') check(probe && probe.strokes === 0, 'the row\'s click reached the quantum mode', probe)
  await viz.screenshot({ path: path.join(out, 'menu-picked.png') })

  // A click in pane 2's body goes to its mode, which stays.
  const q = t.panes[1]
  await viz.mouse.click(q.x + q.w / 2, q.y + q.h * 0.6)
  await sleep(600)
  const u = await look()
  console.log('body click', JSON.stringify({ modes: modes(u), probe: u.panes[1].probe, touches: u.panes[1].touches }))
  check(modes(u).join() === modes(t).join(), 'a click in a pane changed a mode', modes(u))
  if (target.id === 'quantum') check(u.panes[1].probe.strokes === 1, 'want the click to reach the quantum mode', u.panes[1].probe)
  check(!u.panes.some(p => p.open), 'a click in a pane opened a drop-down', u.panes.map(p => p.open))

  // A press outside an open drop-down closes it and changes no mode.
  await viz.mouse.click(...centre(u.panes[0].button))
  await until(look, v => v.panes[0].open, 5000)
  const r = u.panes[2]
  await viz.mouse.click(r.x + r.w * 0.9, r.y + r.h * 0.9)
  let v = await until(look, v => !v.panes.some(p => p.open) && v.menu.length === 0, 5000)
  console.log('outside', JSON.stringify({ modes: modes(v), open: v.panes.map(p => p.open), touches: v.panes[2].touches }))
  check(!v.panes.some(p => p.open) && v.menu.length === 0, 'want the drop-down closed by a press outside it', v.panes.map(p => p.open))
  check(modes(v).join() === modes(u).join(), 'a press outside the drop-down changed a mode', modes(v))

  // The button closes its own drop-down.
  await viz.mouse.click(...centre(v.panes[2].button))
  await until(look, v => v.panes[2].open, 5000)
  await viz.mouse.click(...centre(v.panes[2].button))
  v = await until(look, v => !v.panes.some(p => p.open), 5000)
  check(!v.panes.some(p => p.open), 'want the button to close its drop-down', v.panes.map(p => p.open))

  console.log('errors', JSON.stringify(errors))
  check(errors.length === 0, 'want no page or console error', errors)
  for (const tab of (await win.evaluate(() => window.skinned.tabs())).tabs) await win.evaluate(id => window.skinned.closeTab(id), tab.id)
  await sleep(2000)
  await app.close().catch(() => {})
  fs.rmSync(state, { recursive: true, force: true })
  console.log('done')
})().catch(e => {
  console.error(e, '\nerrors', JSON.stringify(errors))
  fs.rmSync(state, { recursive: true, force: true })
  process.exit(1)
})
