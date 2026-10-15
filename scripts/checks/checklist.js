'use strict'
// Live check of the agent's task list (decision 0034) on the deck
// skin with the replay fake, which writes a TodoWrite call of three
// items at its first turn, marks one more done each turn, and clears
// the list at its fifth. Run under
// scripts/clean-env xvfb-run -a -s "-screen 0 1920x1080x24":
//   node scripts/checks/checklist.js OUT
// Three rows show in the playlist area and the counters hide, the
// first row changes to done, and the counters return once the list is
// cleared. The fake is ended by its recorded pid.
const { launch, probe, childPid, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const fakes = path.join(__dirname, '..', 'fake')
const env = { SKINNED_GL: 'swiftshader', PATH: `${fakes}:${process.env.PATH}` }
for (const [k, d] of [['XDG_RUNTIME_DIR', 'run'], ['XDG_STATE_HOME', 'state'], ['HOME', 'home'], ['CLAUDE_CONFIG_DIR', 'config']]) {
  env[k] = path.join(out, d)
  fs.mkdirSync(env[k], { recursive: true, mode: 0o700 })
}

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

const page = win => win.evaluate(() => window.skinnedPage())
const widget = (p, id) => p.widgets.find(w => w.id === id)
const states = p => widget(p, 'todo').rows.map(r => r.state)

async function until (fn, ms, step = 500) {
  for (let t = 0; t < ms; t += step) {
    const v = await fn()
    if (v) return v
    await sleep(step)
  }
  return fn()
}

let launched = null
async function main () {
  const { app, win } = launched = await launch(['claude'], { appArgs: ['--skin', 'deck', '--no-viz'], env })
  await sleep(3000)
  const pid = await childPid(app)
  let p = await until(async () => { const q = await page(win); const l = widget(q, 'todo'); return l && l.rows.length === 3 && q }, 20000)
  check(p, 'want three rows in the list within 20 s of the launch')
  const snap = (await probe(app)).snapshot
  const list = widget(p, 'todo')
  console.log('three items', JSON.stringify({ rows: list.rows, count: snap['checklist.count'], done: snap['checklist.done'], stage: p.stage, visible: [list.visible, widget(p, 'pl-0').visible, widget(p, 'pl-17').visible], cursor: list.cursor }))
  await shot(win, path.join(out, 'checklist-3.png'))
  check(list.rows.length === 3 && Array.isArray(snap['checklist.items']) && snap['checklist.items'].length === 3 && snap['checklist.count'] === 3 && snap['checklist.done'] === 0, 'want three items on the bus and three rows in the list')
  check(list.rows.map(r => r.text).join('|') === 'read the manifest|wire the list widget|run the checks', 'want the fake\'s three items in order')
  check(states(p).join() === 'doing,todo,todo', 'want the first item doing, the rest to do')
  check(list.visible && p.stage.includes('checklist') && !widget(p, 'pl-0').visible && !widget(p, 'pl-17').visible, 'want the list shown over hidden counters')
  check(list.cursor === 'default', 'want the arrow over the list, which takes no click')

  p = await until(async () => { const q = await page(win); return states(q)[0] === 'done' && q }, 25000)
  check(p, 'want the first row done within 25 s')
  console.log('one done', JSON.stringify(states(p)))
  await shot(win, path.join(out, 'checklist-done.png'))
  check(states(p).join() === 'done,doing,todo', 'want the first row done and the second doing after the next turn')
  check((await probe(app)).snapshot['checklist.done'] === 1, 'want checklist.done at 1')

  p = await until(async () => { const q = await page(win); return widget(q, 'todo').rows.length === 0 && q }, 60000)
  check(p, 'want the list cleared within 60 s')
  const after = (await probe(app)).snapshot
  console.log('cleared', JSON.stringify({ rows: widget(p, 'todo').rows, count: after['checklist.count'], stage: p.stage, visible: [widget(p, 'todo').visible, widget(p, 'pl-0').visible] }))
  await shot(win, path.join(out, 'checklist-cleared.png'))
  check(widget(p, 'todo').rows.length === 0 && after['checklist.count'] === 0 && !widget(p, 'todo').visible && widget(p, 'pl-0').visible && !p.stage.includes('checklist'), 'want the counters back once the list is cleared')

  console.log('child', pid)
  try { process.kill(-pid, 'SIGHUP') } catch (e) { console.log('kill', e.code) }
  await sleep(2000)
  await app.close().catch(() => {})
}

main().then(() => console.log('done'), async e => {
  console.error(e)
  process.exitCode = 1
  if (!launched) return
  for (const x of (await probe(launched.app).catch(() => ({ tabs: [] }))).tabs) if (x.childPid) try { process.kill(-x.childPid, 'SIGHUP') } catch (err) {}
  await launched.app.close().catch(() => {})
})
