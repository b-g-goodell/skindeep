'use strict'
// Live check of the task list's toggle (decision 0034) in the deck and
// coffee skins with the replay fake. Run under
// scripts/clean-env xvfb-run -a -s "-screen 0 1920x1080x24":
//   node scripts/checks/listtoggle.js OUT
// Once the fake's three items show, the fake is paused. The toggle
// shows with the list's option on. A click on the other option shows
// the readouts the list replaces, and a readout's click opens its dial
// on the sessions dashboard. Back on the session's tab the readouts
// still show. In deck the fake then runs on: the choice holds while
// the list changes, through its clear and the next list. A click on
// the list's option shows the list again. At a quarter tile (decision
// 0006) the toggle overlaps no widget shown, either way. Writes
// OUT/<skin>-*.png. The fake is ended by its recorded pid.
const { launch, probe, childPid, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const fakes = path.join(__dirname, '..', 'fake')
const TILE = [960, 1048 / 2 - 37]
// The readout each skin's list replaces, clicked for its dial.
const SKINS = [['deck', 'pl-0', true], ['coffee', 'tools', false]]

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

const page = win => win.evaluate(() => window.skinnedPage())
const widget = (p, id) => p.widgets.find(w => w.id === id)
const center = b => [b.x + b.width / 2, b.y + b.height / 2]
const resize = (app, w, h) => app.evaluate(({ BrowserWindow }, [w, h]) => {
  BrowserWindow.getAllWindows().find(x => !x.getTitle().startsWith('visualization')).setContentSize(w, h)
}, [w, h])

async function until (fn, ms, step = 500) {
  for (let t = 0; t < ms; t += step) {
    const v = await fn()
    if (v) return v
    await sleep(step)
  }
  return fn()
}

// Which region shows: the list over hidden readouts, or the readouts.
function region (p, readout) {
  const list = widget(p, 'todo')
  const r = widget(p, readout)
  const t = widget(p, 'todo:toggle')
  return {
    stage: p.stage.filter(c => c !== 'skin'),
    list: list.visible,
    readout: r.visible,
    toggle: t.visible,
    on: t.options.filter(o => o.on).map(o => o.text)
  }
}

async function pick (win, which) {
  const t = widget(await page(win), 'todo:toggle')
  await win.mouse.click(...center(t.options[which === 'list' ? 0 : 1].box))
  await sleep(800)
}

// The toggle's box against every other widget shown.
function clear (p) {
  const t = widget(p, 'todo:toggle')
  const b = t.box
  const hit = p.widgets.filter(w => w !== t && w.visible && w.box.width && b.x < w.box.x + w.box.width && w.box.x < b.x + b.width && b.y < w.box.y + w.box.height && w.box.y < b.y + b.height)
  return hit.map(w => w.id)
}

let launched = null
async function one (skin, readout, cycle) {
  const dir = path.join(out, skin)
  const pause = path.join(dir, 'pause')
  const env = { SKINNED_GL: 'swiftshader', FAKE_CLAUDE_PAUSE: pause, PATH: `${fakes}:${process.env.PATH}` }
  for (const [k, d] of [['XDG_RUNTIME_DIR', path.join(dir, 'run')], ['XDG_STATE_HOME', path.join(dir, 'state')], ['HOME', path.join(dir, 'home')], ['CLAUDE_CONFIG_DIR', path.join(dir, 'config')]]) {
    env[k] = d
    fs.mkdirSync(d, { recursive: true, mode: 0o700 })
  }
  const { app, win } = launched = await launch(['claude'], { appArgs: ['--skin', skin, '--no-viz'], env })
  await sleep(3000)
  const pid = await childPid(app)
  let p = await until(async () => { const q = await page(win); const l = widget(q, 'todo'); return l && l.rows.length === 3 && q }, 20000)
  check(p, `${skin}: want three rows in the list within 20 s of the launch`)
  fs.writeFileSync(pause, '')
  await sleep(1000)
  p = await page(win)
  let r = region(p, readout)
  console.log(skin, 'list', JSON.stringify(r))
  await shot(win, path.join(out, `${skin}-list.png`))
  check(r.stage.includes('checklist') && r.list && !r.readout && r.toggle && r.on.join() === widget(p, 'todo:toggle').options[0].text, `${skin}: want the list shown, the readouts hidden, the toggle on the list`)
  check(widget(p, 'todo').cursor === 'default', `${skin}: want the arrow over the list, which takes no click`)

  await pick(win, 'other')
  p = await page(win)
  r = region(p, readout)
  console.log(skin, 'readouts', JSON.stringify(r))
  await shot(win, path.join(out, `${skin}-readouts.png`))
  check(r.stage.includes('checklist-off') && !r.stage.includes('checklist') && !r.list && r.readout && r.toggle && r.on.join() === widget(p, 'todo:toggle').options[1].text, `${skin}: want the readouts shown, the list hidden, the toggle on the readouts`)

  const bind = widget(p, readout).bind
  await win.mouse.click(...center(widget(p, readout).box))
  await sleep(1500)
  const pr = await probe(app)
  const tab = pr.tabs.find(t => !t.dashboard)
  console.log(skin, 'dial', JSON.stringify({ dials: pr.dials, tabs: pr.tabs.map(t => [t.label, t.active]) }))
  check(pr.dials.includes(bind) && pr.tabs.some(t => t.dashboard && t.active), `${skin}: want the ${bind} dial open on the sessions dashboard`)
  await win.evaluate(id => window.skinned.activateTab(id), tab.id)
  await sleep(1000)
  p = await page(win)
  r = region(p, readout)
  console.log(skin, 'back on the session', JSON.stringify({ ...r, open: widget(p, readout).classes.includes('open') }))
  check(r.stage.includes('checklist-off') && r.readout && !r.list && widget(p, readout).classes.includes('open'), `${skin}: want the readouts still shown on the session's tab, the ${readout} readout open`)

  if (cycle) {
    fs.rmSync(pause)
    const seen = new Set()
    const watch = async want => {
      const q = await page(win)
      seen.add(q.stage.filter(c => c !== 'skin').join(' ') || '-')
      return want(widget(q, 'todo').rows.map(x => x.state).join()) && q
    }
    check(await until(() => watch(s => s.startsWith('done')), 30000, 250), `${skin}: want the list to change within 30 s`)
    check(await until(() => watch(s => s === ''), 60000, 250), `${skin}: want the list cleared within 60 s`)
    p = await until(() => watch(s => s.split(',').length === 3), 30000, 250)
    check(p, `${skin}: want the next list within 30 s`)
    fs.writeFileSync(pause, '')
    r = region(p, readout)
    console.log(skin, 'next list', JSON.stringify({ ...r, stages: [...seen] }))
    check(![...seen].some(s => s.split(' ').includes('checklist')) && r.readout && !r.list, `${skin}: want the readouts held through the change, the clear and the next list`)
  }

  await pick(win, 'list')
  p = await page(win)
  r = region(p, readout)
  console.log(skin, 'list again', JSON.stringify(r))
  await shot(win, path.join(out, `${skin}-back.png`))
  check(r.stage.includes('checklist') && r.list && !r.readout && r.on.join() === widget(p, 'todo:toggle').options[0].text, `${skin}: want the list shown again`)

  await resize(app, ...TILE)
  await sleep(1500)
  p = await page(win)
  console.log(skin, 'quarter list', JSON.stringify({ scale: p.scale, toggle: widget(p, 'todo:toggle').box, hits: clear(p) }))
  await shot(win, path.join(out, `${skin}-quarter-list.png`))
  check(p.scale < 1 && widget(p, 'todo').visible && clear(p).length === 0, `${skin}: want the list and a clear toggle at the quarter tile`)
  await pick(win, 'other')
  p = await page(win)
  r = region(p, readout)
  console.log(skin, 'quarter readouts', JSON.stringify({ ...r, hits: clear(p) }))
  await shot(win, path.join(out, `${skin}-quarter-readouts.png`))
  check(r.readout && !r.list && clear(p).length === 0, `${skin}: want the readouts and a clear toggle at the quarter tile`)

  console.log(skin, 'child', pid)
  try { process.kill(-pid, 'SIGHUP') } catch (e) { console.log('kill', e.code) }
  await sleep(2000)
  await app.close().catch(() => {})
  launched = null
}

;(async () => {
  for (const [skin, readout, cycle] of SKINS) await one(skin, readout, cycle)
})().then(() => console.log('done'), async e => {
  console.error(e)
  process.exitCode = 1
  if (!launched) return
  for (const x of (await probe(launched.app).catch(() => ({ tabs: [] }))).tabs) if (x.childPid) try { process.kill(-x.childPid, 'SIGHUP') } catch (err) {}
  await launched.app.close().catch(() => {})
})
