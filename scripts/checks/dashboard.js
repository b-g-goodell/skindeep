'use strict'
// Live check of the sessions dashboard (decision 0028). Run under
// xvfb-run:
//   node scripts/checks/dashboard.js OUT
// The sessions started elsewhere are fake claudes this check spawns and
// ends by their recorded pids, with transcripts it writes where Claude
// Code keeps them. The dashboard also reads the user's real sessions,
// read only: the check opens none of them.
const { launch, probe, openMenu, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawn } = require('child_process')
const profiles = require('../../app/profiles')
const { slug } = require('../../app/sessions')

const out = path.resolve(process.argv[2])
const root = path.join(__dirname, '..', '..')
const fakes = path.join(root, 'scripts', 'fake')
const claudeFake = path.join(fakes, 'claude')
const keysFake = path.join(fakes, 'keys')
const state = path.join(out, 'state')
const lab = path.join(out, 'profiles', 'lab', '.claude')
const bytesDir = path.join(out, 'bytes')
for (const d of [state, lab, bytesDir]) fs.mkdirSync(d, { recursive: true })
profiles.record(profiles.dir({ XDG_STATE_HOME: state }), 'claude', lab)
const env = { SKINNED_GL: 'swiftshader', XDG_STATE_HOME: state, CLAUDE_CONFIG_DIR: lab, PATH: `${fakes}:${process.env.PATH}`, SKINNED_CHECK_OUT: bytesDir }
const history = fs.readFileSync(path.join(root, 'test', 'fixtures', 'claude', 'transcript-read.jsonl'))

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

const alive = pid => { try { process.kill(pid, 0); return true } catch (e) { return false } }
const foreign = []
let launched = null

// A fake claude started outside the app, and the transcript Claude Code
// would keep for it, written every second with growing usage.
function elsewhere (name) {
  const cwd = path.join(out, 'work', name)
  fs.mkdirSync(cwd, { recursive: true })
  const p = spawn(claudeFake, [], { cwd, env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: lab }), stdio: ['pipe', 'ignore', 'ignore'] })
  const dir = path.join(lab, 'projects', slug(cwd))
  fs.mkdirSync(dir, { recursive: true })
  const id = crypto.randomUUID()
  const file = path.join(dir, `${id}.jsonl`)
  fs.writeFileSync(file, history)
  fs.mkdirSync(path.join(lab, 'session-env', id), { recursive: true })
  let n = 0
  const timer = setInterval(() => {
    n++
    fs.appendFileSync(file, JSON.stringify({ type: 'assistant', isSidechain: false, message: { id: `msg_${name}_${n}`, model: 'claude-fake', usage: { input_tokens: 3, cache_creation_input_tokens: 100, cache_read_input_tokens: 20000 + n * 500, output_tokens: 50 } } }) + '\n')
  }, 1000)
  const s = { name, pid: p.pid, cwd, file, timer }
  foreign.push(s)
  return s
}

function stop (s) {
  clearInterval(s.timer)
  try { process.kill(s.pid, 'SIGTERM') } catch (e) {}
}

const keyFor = s => `${s.pid}:`
const dash = async win => {
  const p = (await win.evaluate(() => window.skinnedPage())).panes.find(x => x.dashboard)
  return p ? Object.assign({ shown: p.shown }, p.dashboard) : null
}
const rowOf = (d, s) => d && d.rows.find(r => r.key.startsWith(keyFor(s)))
const dashTab = async app => (await probe(app)).tabs.find(t => t.dashboard)

async function until (fn, ms, step = 500) {
  for (let t = 0; t < ms; t += step) {
    const v = await fn()
    if (v) return v
    await sleep(step)
  }
  return fn()
}

async function menu (win, re) {
  await openMenu(win)
  await win.locator('#menu .item').filter({ hasText: re }).click()
}

async function main () {
  const f1 = elsewhere('one')
  const f2 = elsewhere('two')
  await sleep(1500)
  const { app, win } = launched = await launch([keysFake], { appArgs: ['--skin', 'deck', '--no-viz'], env })
  const status = new Promise(resolve => app.process().once('exit', (code, sig) => resolve(sig ? `signal ${sig}` : code)))
  await sleep(2500)
  await menu(win, /^New tab\.\.\.$/)
  await sleep(600)
  await win.fill('#chooser .line', claudeFake)
  await win.keyboard.press('Enter')
  await sleep(3000)
  const claudeTab = (await probe(app)).tabs.find(t => t.label === 'claude')

  await menu(win, /^Sessions dashboard$/)
  await sleep(1500)
  let t = await dashTab(app)
  check(t && t.active && t.childPid === null && t.label === 'sessions', 'want an active sessions tab with no child of the app\'s')
  await win.keyboard.press('Control+Tab')
  await sleep(500)
  await menu(win, /^Sessions dashboard$/)
  await sleep(800)
  let pr = await probe(app)
  check(pr.tabs.filter(x => x.dashboard).length === 1 && pr.tabs.find(x => x.dashboard).active, 'want the one dashboard made active again, not a second')

  const d1 = await until(async () => { const d = await dash(win); return d && d.ticks >= 2 && rowOf(d, f1) && d }, 15000)
  await sleep(10500)
  const d2 = await dash(win)
  const r1 = rowOf(d2, f1)
  const own = d2.rows.find(r => r.label === 'claude' && r.key.startsWith(`${claudeTab.childPid}:`))
  t = await dashTab(app)
  console.log('rows', JSON.stringify(d2.rows.map(r => [r.label, r.state, r.points, r.last.tokens])), 'ticks', d1.ticks, '->', d2.ticks)
  console.log('watching', JSON.stringify(t.dashboard.watching), 'made', JSON.stringify(t.dashboard.made))
  await shot(win, path.join(out, 'dashboard.png'))
  check(own && r1 && r1.label === 'claude [lab]' && rowOf(d2, f2), 'want rows for the tab\'s session and the sessions elsewhere')
  check(d2.ticks > d1.ticks && r1.points > rowOf(d1, f1).points && r1.last.tokens > 0, 'want the history to grow and the meters of a session elsewhere from its transcript')
  const w1 = t.dashboard.made.find(w => w.key.startsWith(keyFor(f1)))
  check(w1 && !w1.closed && w1.tailing && !t.dashboard.made.some(w => w.key.startsWith(`${claudeTab.childPid}:`)), 'want a headless watcher on the session elsewhere, none on the tab\'s')

  stop(f1)
  const ended = await until(async () => { const r = rowOf(await dash(win), f1); return r && r.ended && r }, 12000)
  const shown = (await dash(win)).shownRows.find(x => x.key.startsWith(keyFor(f1)))
  t = await dashTab(app)
  const w1b = t.dashboard.made.find(w => w.key.startsWith(keyFor(f1)))
  console.log('ended', JSON.stringify({ ended: !!ended, shown, watcher: w1b }))
  check(ended && shown && shown.ended && Number(shown.opacity) < 1, 'want the ended session\'s row greyed')
  check(w1b.closed && !w1b.tailing && !t.dashboard.watching.some(k => k.startsWith(keyFor(f1))), 'want its watcher closed, its tail stopped')

  await win.locator(`#term .dashboard .d-row[data-key^="${keyFor(f2)}"]`).click()
  await sleep(2500)
  pr = await probe(app)
  const mon = pr.tabs.find(x => x.monitor === f2.pid)
  check(mon && mon.active, 'a click on a row must open the session as the menu does')
  await win.evaluate(id => window.skinned.activateTab(id), t.id)
  await sleep(6000)
  t = await dashTab(app)
  const w2 = t.dashboard.made.find(w => w.key.startsWith(keyFor(f2)))
  console.log('taken by a tab', JSON.stringify(w2))
  check(w2.closed && !w2.tailing && !t.dashboard.watching.some(k => k.startsWith(keyFor(f2))), 'want the watcher closed once a monitor tab shows the session')

  check(t.active, 'want the dashboard active before closing it')
  await win.keyboard.press('Control+Shift+W')
  await sleep(1500)
  pr = await probe(app)
  const last = pr.lastDashboard
  console.log('after close', JSON.stringify({ tabs: pr.tabs.map(x => x.label), watching: last.watching, open: last.made.filter(w => !w.closed || w.tailing) }))
  check(!pr.tabs.some(x => x.dashboard) && last.watching.length === 0 && last.made.every(w => w.closed && !w.tailing), 'closing the dashboard must close every watcher')
  check(alive(f2.pid) && alive(claudeTab.childPid), 'closing the dashboard must leave every session running')

  await menu(win, /^Sessions dashboard$/)
  await sleep(1500)
  await win.evaluate(id => window.skinned.closeTab(id), mon.id)
  await win.evaluate(id => window.skinned.closeTab(id), claudeTab.id)
  await sleep(2000)
  const keys = (await probe(app)).tabs.find(x => x.childPid)
  await win.evaluate(id => window.skinned.activateTab(id), keys.id)
  await sleep(500)
  await win.keyboard.type('#4')
  await sleep(2000)
  pr = await probe(app)
  console.log('left', JSON.stringify(pr.tabs.map(x => x.label)))
  check(pr.tabs.length === 1 && pr.tabs[0].dashboard, 'want the dashboard alone, the app running')
  await win.keyboard.press('Control+Shift+W').catch(() => {})
  const code = await Promise.race([status, sleep(8000).then(() => 'still running')])
  console.log('app exit', code)
  check(code === 4 && alive(f2.pid), 'want the app to exit 4, the last CLI tab\'s status, and the session to run on')
}

// On a failure the app is ended too, by its own tabs' pids and a close.
main().then(() => console.log('done'), async e => {
  console.error(e)
  process.exitCode = 1
  if (!launched) return
  for (const x of (await probe(launched.app).catch(() => ({ tabs: [] }))).tabs) if (x.childPid) try { process.kill(-x.childPid, 'SIGHUP') } catch (err) {}
  await launched.app.close().catch(() => {})
}).finally(() => {
  for (const s of foreign) stop(s)
})
