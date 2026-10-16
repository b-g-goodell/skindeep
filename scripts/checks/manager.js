'use strict'
// Live check of the agent sessions in the menu and the read-only monitor
// tab (decision 0027). Run under xvfb-run:
//   node scripts/checks/manager.js OUT
// The sessions started elsewhere are fake claudes this check spawns and
// ends by their recorded pids, with transcripts it writes where Claude
// Code keeps them. The menu also lists the user's real sessions: the
// check reads their rows and opens none of them.
const { launch, probe, openMenu, shot, sleep } = require('../drive.js')
const fs = require('fs')
const os = require('os')
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
const tilde = p => p.startsWith(os.homedir() + '/') ? '~' + p.slice(os.homedir().length) : p

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

const alive = pid => { try { process.kill(pid, 0); return true } catch (e) { return false } }
const foreign = []
let launched = null

// A fake claude started outside the app in its own folder, and the
// transcript Claude Code would keep for it, written every second.
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
  const s = { name, pid: p.pid, cwd, file, timer, child: p }
  foreign.push(s)
  return s
}

function stop (s) {
  clearInterval(s.timer)
  try { process.kill(s.pid, 'SIGTERM') } catch (e) {}
}

async function rows (win) {
  return win.evaluate(() => [...document.querySelectorAll('#menu .session')].map(e => ({
    key: e.dataset.key,
    label: e.querySelector('.s-label').textContent,
    folder: e.querySelector('.s-folder').textContent,
    state: e.querySelector('.s-state').textContent,
    where: e.querySelector('.s-where').textContent
  })))
}

const rowOf = (list, s) => list.find(r => r.folder === tilde(s.cwd))

async function until (fn, ms, step = 500) {
  for (let t = 0; t < ms; t += step) {
    const v = await fn()
    if (v) return v
    await sleep(step)
  }
  return fn()
}

async function main () {
  const f1 = elsewhere('one')
  await sleep(1500)
  const { app, win } = launched = await launch([keysFake], { appArgs: ['--skin', 'deck', '--no-viz'], env })
  const status = new Promise(resolve => app.process().once('exit', (code, sig) => resolve(sig ? `signal ${sig}` : code)))
  await sleep(2500)

  await openMenu(win)
  await win.locator('#menu .item').filter({ hasText: /^New tab\.\.\.$/ }).click()
  await sleep(600)
  await win.fill('#chooser .line', claudeFake)
  await win.keyboard.press('Enter')
  await sleep(3000)

  await openMenu(win, 'Agents')
  let list = await rows(win)
  console.log('rows', JSON.stringify(list.map(r => [r.label, r.folder, r.state, r.where])))
  const own = list.find(r => r.where === 'tab')
  const r1 = rowOf(list, f1)
  check(own && own.label === 'claude' && list.indexOf(own) === 0, 'want the window\'s claude tab, on the default profile, listed first as a tab')
  check(r1 && r1.label === 'claude [lab]' && r1.state === 'working' && r1.where === '', `want the session elsewhere listed with its profile and state, saw ${JSON.stringify(r1)}`)
  await shot(win, path.join(out, 'sessions.png'))

  const f2 = elsewhere('two')
  const appeared = await until(async () => rowOf(await rows(win), f2), 6000)
  stop(f2)
  const left = await until(async () => !rowOf(await rows(win), f2), 6000)
  console.log('while open', JSON.stringify({ appeared: !!appeared, left }))
  check(appeared && left, 'want a session that starts to appear and one that ends to leave while the menu is open')

  await win.locator(`#menu .session[data-key="${r1.key}"]`).click()
  await sleep(4000)
  let pr = await probe(app)
  let m = pr.tabs.find(t => t.monitor === f1.pid)
  const tchan = m && m.following.channels.find(c => c.name === 'transcript')
  const notice = await win.evaluate(() => document.getElementById('strip-notice').textContent)
  const page = await win.evaluate(() => window.skinnedPage())
  const pane = page.panes.find(p => p.id === (m && m.id))
  console.log('monitor', JSON.stringify({ tab: m && { id: m.id, childPid: m.childPid, label: m.label, active: m.active, transcript: tchan, out: m.snapshot['tokens.out'], mem: m.snapshot['proc.mem_mb'] }, notice, pane: pane && pane.lines.filter(Boolean).slice(0, 3) }))
  await shot(win, path.join(out, 'monitor.png'))
  check(m && m.active && m.childPid === null && m.label === 'claude [lab]', 'want an active monitor tab with no child of the app\'s')
  check(tchan && tchan.state === 'live' && tchan.target === fs.realpathSync(f1.file) && m.snapshot['tokens.out'] > 0 && m.snapshot['proc.mem_mb'] > 0, 'want its meters from its transcript and its pid')
  check(notice.includes('read-only monitor') && pane && pane.lines[0].startsWith('Read-only monitor of claude [lab]'), 'want the strip and the pane to say it is read only')

  await openMenu(win, 'Agents')
  list = await rows(win)
  check(rowOf(list, f1).where === 'monitor', 'want the watched session marked in the list')
  await win.keyboard.press('Escape')
  await win.keyboard.type('hello')
  await win.keyboard.press('Control+Shift+W')
  await sleep(1500)
  pr = await probe(app)
  check(!pr.tabs.some(t => t.monitor) && alive(f1.pid), 'closing the monitor tab must leave the session running')

  await openMenu(win, 'Agents')
  await win.locator(`#menu .session[data-key="${r1.key}"]`).click()
  await sleep(2500)
  check((await probe(app)).tabs.some(t => t.monitor === f1.pid), 'want the monitor tab again')
  stop(f1)
  const gone = await until(async () => !(await probe(app)).tabs.some(t => t.monitor), 6000)
  console.log('session ended, monitor gone', gone)
  check(gone, 'want the monitor tab to close when its session ends')

  const f3 = elsewhere('three')
  await sleep(1500)
  pr = await probe(app)
  const claudeTab = pr.tabs.find(t => t.label === 'claude' && t.childPid)
  await win.evaluate(id => window.skinned.closeTab(id), claudeTab.id)
  await sleep(2000)
  await openMenu(win, 'Agents')
  const r3 = rowOf(await rows(win), f3)
  await win.locator(`#menu .session[data-key="${r3.key}"]`).click()
  await sleep(2500)
  pr = await probe(app)
  const keys = pr.tabs.find(t => t.childPid)
  await win.evaluate(id => window.skinned.activateTab(id), keys.id)
  await sleep(500)
  await win.keyboard.type('#4')
  await sleep(2000)
  pr = await probe(app)
  console.log('after the CLI tab ended', JSON.stringify(pr.tabs.map(t => ({ id: t.id, monitor: t.monitor }))))
  check(pr.tabs.length === 1 && pr.tabs[0].monitor === f3.pid, 'want the monitor tab alone, the app running')
  // The last tab: the app exits under the key press.
  await win.keyboard.press('Control+Shift+W').catch(() => {})
  const code = await Promise.race([status, sleep(8000).then(() => 'still running')])
  console.log('app exit', code, 'session alive', alive(f3.pid))
  check(code === 4 && alive(f3.pid), 'want the app to exit 4, the last CLI tab\'s status, and the session to run on')
}

// On a failure the app is ended too, by its own tabs' pids and a close.
main().then(() => console.log('done'), async e => {
  console.error(e)
  process.exitCode = 1
  if (!launched) return
  for (const t of (await probe(launched.app).catch(() => ({ tabs: [] }))).tabs) if (t.childPid) try { process.kill(-t.childPid, 'SIGHUP') } catch (err) {}
  await launched.app.close().catch(() => {})
}).finally(() => {
  for (const s of foreign) stop(s)
})
