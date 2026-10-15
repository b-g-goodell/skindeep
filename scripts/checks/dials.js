'use strict'
// Live check of the dials (decision 0033) on the deck skin with the
// replay fake. Run under scripts/clean-env xvfb-run -a -s "-screen 0 1920x1080x24":
//   node scripts/checks/dials.js OUT
// A playlist row shows the hand and no row the I-beam. A click on the
// row bound to tools.total opens its dial: the sessions dashboard opens
// with a tools.total column and the row is marked open. A second click,
// made while the dashboard is the active tab and the row reads --,
// closes it. The fake is ended by its recorded pid.
const { launch, probe, childPid, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const fakes = path.join(__dirname, '..', 'fake')
// No task list from the fake: it would hide the rows (decision 0034).
const env = { SKINNED_GL: 'swiftshader', FAKE_CLAUDE_TODO: '0', PATH: `${fakes}:${process.env.PATH}` }
for (const [k, d] of [['XDG_RUNTIME_DIR', 'run'], ['XDG_STATE_HOME', 'state'], ['HOME', 'home'], ['CLAUDE_CONFIG_DIR', 'config']]) {
  env[k] = path.join(out, d)
  fs.mkdirSync(env[k], { recursive: true, mode: 0o700 })
}

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

const page = win => win.evaluate(() => window.skinnedPage())
const widget = (p, id) => p.widgets.find(w => w.id === id)
const click = async (win, w) => { await win.mouse.click(w.box.x + w.box.width / 2, w.box.y + w.box.height / 2); await sleep(1500) }
const dash = async win => { const p = (await page(win)).panes.find(x => x.dashboard); return p ? p.dashboard : null }

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
  await sleep(4000)
  const pid = await childPid(app)
  let p = await page(win)
  const row = widget(p, 'pl-0')
  const text = widget(p, 'model')
  const cursors = p.widgets.map(w => [w.id, w.cursor])
  console.log('cursors', JSON.stringify(cursors))
  check(row && row.bind === 'tools.total' && row.cursor === 'pointer' && row.classes.includes('click'), 'want the hand on the tools.total row')
  check(text && text.cursor === 'default' && !text.classes.includes('click'), 'want the arrow on the model readout, a text')
  check(p.widgets.every(w => w.cursor === 'pointer' || w.cursor === 'default'), 'want no widget with the I-beam')
  check(!row.classes.includes('open') && (await probe(app)).dials.length === 0, 'want no dial open at the start')

  await click(win, row)
  let pr = await probe(app)
  const d = pr.tabs.find(t => t.dashboard)
  console.log('after the first click', JSON.stringify({ dials: pr.dials, tabs: pr.tabs.map(t => [t.label, t.active]) }))
  check(pr.dials.length === 1 && pr.dials[0] === 'tools.total', 'want the tools.total dial open')
  check(d && d.active && d.dashboard.dials[0] === 'tools.total', 'want the sessions dashboard opened, active, with the dial')
  const shown = await until(async () => { const s = await dash(win); return s && s.dials.includes('tools.total') && s.ticks >= 2 && s.rows.length && s }, 15000)
  const series = (await win.evaluate(() => {
    const row = document.querySelector('#term .dashboard .d-row:not(.d-header)')
    return row ? [...row.querySelectorAll('.d-dial .d-num')].map(e => e.textContent) : []
  }))
  console.log('dashboard', JSON.stringify({ dials: shown && shown.dials, ticks: shown && shown.ticks, column: series }))
  await shot(win, path.join(out, 'dial-open.png'))
  check(shown && series.length === 1 && series[0] !== '--', 'want a tools.total column with a value on the session\'s row')
  p = await page(win)
  const open = widget(p, 'pl-0')
  check(open.classes.includes('open') && open.classes.includes('nodata'), 'want the row marked open while the dashboard tab shows it as --')

  await click(win, open)
  pr = await probe(app)
  p = await page(win)
  console.log('after the second click', JSON.stringify({ dials: pr.dials, dash: (await dash(win)).dials, classes: widget(p, 'pl-0').classes }))
  check(pr.dials.length === 0 && !widget(p, 'pl-0').classes.includes('open'), 'want the dial closed and the row unmarked')
  check((await dash(win)).dials.length === 0 && pr.tabs.some(t => t.dashboard), 'want the dashboard without the column, still open')

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
