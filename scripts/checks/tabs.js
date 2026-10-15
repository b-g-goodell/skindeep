'use strict'
// Live checks of tabs in one window (decision 0023). Run under xvfb-run:
//   node scripts/checks/tabs.js OUT keys|strip|exit|execfail|meters|closewin|carry
// scripts/fake/keys records each tab's bytes to OUT/bytes/<pid>.bin.
const { launch, probe, openMenu, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const what = process.argv[3]
const root = path.join(__dirname, '..', '..')
const keysFake = path.join(root, 'scripts', 'fake', 'keys')
const claudeFake = path.join(root, 'scripts', 'fake', 'claude')
const bytesDir = path.join(out, 'bytes')
fs.mkdirSync(bytesDir, { recursive: true })
const env = { SKINNED_GL: 'swiftshader', SKINNED_CHECK_OUT: bytesDir }

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

const hex = pid => {
  const f = path.join(bytesDir, `${pid}.bin`)
  return fs.existsSync(f) ? [...fs.readFileSync(f)].map(b => b.toString(16).padStart(2, '0')).join(' ') : null
}
const alive = pid => { try { process.kill(pid, 0); return true } catch (e) { return false } }
const page = win => win.evaluate(() => window.skinnedPage())
const size = app => app.evaluate(({ BrowserWindow }) => {
  const w = BrowserWindow.getAllWindows().find(x => !x.getTitle().startsWith('visualization'))
  return { content: w.getContentSize(), min: w.getMinimumSize(), title: w.getTitle() }
})
const stripShown = win => win.evaluate(() => !document.getElementById('tabs').hidden)

// The app's exit status, once it has exited.
function exited (app) {
  return new Promise(resolve => app.process().once('exit', (code, sig) => resolve(sig ? `signal ${sig}` : code)))
}

async function start (cmd, appArgs = []) {
  const r = await launch(cmd, { appArgs: ['--skin', 'deck', '--no-viz', ...appArgs], env })
  r.exit = exited(r.app)
  await sleep(2500)
  return r
}

async function end (app) {
  for (const t of (await probe(app)).tabs) try { process.kill(-t.childPid, 'SIGHUP') } catch (e) {}
  await sleep(1500)
  await app.close().catch(() => {})
}

// New tab, typing reaches only the active tab, the chords take no byte
// from the CLI, every other key still reaches it, each tab's scrollback
// is whole.
async function keys () {
  const { app, win } = await start([keysFake])
  const one = await probe(app)
  check(one.tabs.length === 1 && !(await stripShown(win)), 'want one tab and no strip at launch')
  await win.keyboard.press('Control+Shift+T')
  await sleep(1500)
  const two = await probe(app)
  const [a, b] = two.tabs
  console.log('tabs', JSON.stringify(two.tabs.map(t => ({ id: t.id, pid: t.childPid, active: t.active, label: t.label, cwd: t.cwd }))))
  check(two.tabs.length === 2 && a.childPid && b.childPid && a.childPid !== b.childPid && b.active, 'want a second, active tab with its own CLI')
  check(alive(a.childPid) && alive(b.childPid), 'want both CLIs running')
  await win.keyboard.type('abc')
  await sleep(300)
  await win.keyboard.press('Control+Tab')
  await sleep(500)
  check((await probe(app)).childPid === a.childPid, 'Ctrl+Tab did not activate the first tab')
  await win.keyboard.type('def')
  for (const k of ['Control+t', 'Control+w', 'Alt+f', 'Alt+b']) await win.keyboard.press(k)
  await sleep(300)
  await shot(win, path.join(out, 'keys-tab1.png'))
  await win.keyboard.press('Control+Shift+Tab')
  await sleep(500)
  check((await probe(app)).childPid === b.childPid, 'Ctrl+Shift+Tab did not wrap to the second tab')
  await shot(win, path.join(out, 'keys-tab2.png'))
  const p = await page(win)
  const whole = p.panes.map(x => {
    const pid = two.tabs.find(t => t.id === x.id).childPid
    const want = Array.from({ length: 300 }, (_, i) => `pid ${pid} line ${i + 1}`)
    return { id: x.id, shown: x.shown, cols: x.cols, rows: x.rows, whole: want.every(l => x.lines.includes(l)) }
  })
  const bytes = { a: hex(a.childPid), b: hex(b.childPid) }
  console.log(JSON.stringify({ bytes, whole }))
  await end(app)
  check(bytes.a === '64 65 66 14 17 1b 66 1b 62', `tab 1 got ${bytes.a}, want 64 65 66 14 17 1b 66 1b 62`)
  check(bytes.b === '61 62 63', `tab 2 got ${bytes.b}, want 61 62 63`)
  check(whole.every(w => w.whole), 'a scrollback is not whole')
  check(whole.filter(w => w.shown).length === 1 && whole.find(w => w.shown).id === b.id, 'want only the active pane shown')
  check(whole[0].cols === whole[1].cols && whole[0].rows === whole[1].rows, 'want both panes at one size')
}

// The strip shows from the second tab, the minimum size grows by its
// height, the menu's tab entries, +, drag, middle click and the close
// button, each closing hanging up one CLI alone.
async function strip () {
  const { app, win } = await start([keysFake])
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find(x => !x.getTitle().startsWith('visualization'))
    w.setContentSize(...w.getMinimumSize())
  })
  await sleep(500)
  const s1 = await size(app)
  await openMenu(win)
  const items = await win.evaluate(() => [...document.querySelectorAll('#menu .item')].map(e => e.textContent))
  console.log('menu', JSON.stringify(items))
  for (const t of ['New tabCtrl+Shift+T', 'Close tabCtrl+Shift+W', 'Next tabCtrl+Tab', 'Previous tabCtrl+Shift+Tab']) check(items.includes(t), `menu lacks ${t}`)
  await win.locator('#menu .item').filter({ hasText: /^New tabCtrl\+Shift\+T$/ }).click()
  await sleep(1500)
  const s2 = await size(app)
  console.log('size one tab', JSON.stringify(s1), 'two tabs', JSON.stringify(s2))
  check(await stripShown(win), 'want the strip with two tabs')
  check(s1.content[1] === s1.min[1], 'want the window at its minimum before the second tab')
  check(s2.min[1] === s1.min[1] + 24 && s2.content[1] === s2.min[1], 'want the minimum height and the window 24 px more')
  await win.locator('#tabs .new').click()
  await sleep(1500)
  let t = (await probe(app)).tabs
  check(t.length === 3, 'want three tabs after +')
  await shot(win, path.join(out, 'strip-three.png'))
  const ids = t.map(x => x.id)
  const box = async id => win.locator(`#tabs .tab[data-id="${id}"]`).boundingBox()
  const from = await box(ids[2])
  const to = await box(ids[0])
  await win.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await win.mouse.down()
  await win.mouse.move(to.x + 4, to.y + to.height / 2, { steps: 8 })
  await win.mouse.up()
  await sleep(600)
  t = (await probe(app)).tabs
  console.log('order after drag', JSON.stringify(t.map(x => x.id)))
  check(t.map(x => x.id).join() === [ids[2], ids[0], ids[1]].join(), 'drag did not move the third tab first')
  const pids = Object.fromEntries(t.map(x => [x.id, x.childPid]))
  const mid = await box(ids[2])
  await win.mouse.click(mid.x + mid.width / 2, mid.y + mid.height / 2, { button: 'middle' })
  await sleep(1500)
  check(!alive(pids[ids[2]]) && alive(pids[ids[0]]) && alive(pids[ids[1]]), 'middle click must hang up that tab alone')
  await win.locator(`#tabs .tab[data-id="${ids[1]}"] .close`).click()
  await sleep(1500)
  check(!alive(pids[ids[1]]) && alive(pids[ids[0]]), 'the close button must hang up that tab alone')
  const s3 = await size(app)
  const left = await probe(app)
  console.log('left', JSON.stringify(left.tabs.map(x => x.id)), 'size', JSON.stringify(s3))
  check(left.tabs.length === 1 && !(await stripShown(win)) && s3.min[1] === s1.min[1], 'want one tab, no strip, the first minimum')
  const first = left.tabs[0].childPid
  const closing = async how => {
    await win.keyboard.press('Control+Shift+T')
    await sleep(1500)
    const pid = (await probe(app)).childPid
    await how()
    await sleep(1500)
    const now = await probe(app)
    console.log('close by', how.name, JSON.stringify({ pid, alive: alive(pid), first: alive(first), tabs: now.tabs.length }))
    check(pid !== first && !alive(pid) && alive(first) && now.tabs.length === 1, `${how.name} must hang up the active tab alone`)
  }
  await closing(async function menuEntry () {
    await openMenu(win)
    await win.locator('#menu .item').filter({ hasText: /^Close tabCtrl\+Shift\+W$/ }).click()
  })
  await closing(async function chord () { await win.keyboard.press('Control+Shift+W') })
  await end(app)
}

// A tab whose CLI exits closes, a status other than 0 goes under
// Housekeeping with the dot, and the app exits with the last tab's status.
async function exit () {
  const { app, win, exit: status } = await start([keysFake])
  await win.keyboard.press('Control+Shift+T')
  await sleep(1500)
  const [a, b] = (await probe(app)).tabs
  await win.keyboard.type('#3')
  await sleep(1500)
  const after = await probe(app)
  const dot = await win.evaluate(() => !document.querySelector('#menu-button .dot').hidden)
  await openMenu(win)
  const problems = await win.evaluate(() => [...document.querySelectorAll('#menu .problem')].map(e => e.textContent))
  await win.keyboard.press('Escape')
  console.log(JSON.stringify({ left: after.tabs.map(t => t.id), active: after.childPid, dot, problems }))
  check(after.tabs.length === 1 && after.childPid === a.childPid && !alive(b.childPid), 'want the exited tab closed and the first one active')
  check(dot && problems.some(p => /exited with status 3/.test(p)), 'want the status under Housekeeping with the dot')
  await win.keyboard.type('#5')
  const code = await Promise.race([status, sleep(8000).then(() => 'still running')])
  console.log('app exit', code)
  check(code === 5, `want the app to exit 5, the last tab's status, saw ${code}`)
}

// A tab whose exec fails while another remains: the problem under
// Housekeeping names the status and the reason (decision 0003). The
// window's command is a script, given a missing interpreter before New
// tab runs it again.
async function execfail () {
  const cmd = path.join(out, 'execfail-cmd')
  fs.writeFileSync(cmd, `#!/bin/sh\nexec ${keysFake} "$@"\n`, { mode: 0o755 })
  const { app, win } = await start([cmd])
  const [a] = (await probe(app)).tabs
  fs.writeFileSync(cmd, '#!/nonexistent/interp\n')
  await win.keyboard.press('Control+Shift+T')
  await sleep(2000)
  const after = await probe(app)
  await openMenu(win)
  const problem = win.locator('#menu .problem', { hasText: 'exited with status 127' })
  const titles = await win.evaluate(() => [...document.querySelectorAll('#menu .problem')].map(e => e.textContent))
  let detail = null
  if (await problem.count()) {
    await problem.first().click()
    await sleep(300)
    detail = await win.evaluate(() => { const e = document.querySelector('#menu pre.error'); return e && e.textContent })
  }
  await win.keyboard.press('Escape')
  console.log(JSON.stringify({ left: after.tabs.map(t => t.id), titles, detail }))
  check(after.tabs.length === 1 && after.childPid === a.childPid, 'want the failed tab closed and the first one active')
  check(detail && detail.startsWith(`cannot start ${cmd}: required file not found\n`), `want the reason first in the problem, saw ${JSON.stringify(detail)}`)
  await end(app)
}

// The skin's meters show the active tab's values, and change with it.
async function meters () {
  const { app, win } = await start([claudeFake])
  await win.keyboard.press('Control+Shift+T')
  await sleep(9000)
  const seen = []
  for (const key of ['Control+Tab', 'Control+Tab']) {
    await win.keyboard.press(key)
    await sleep(400)
    const pr = await probe(app)
    const pg = await page(win)
    const act = pr.tabs.find(t => t.active)
    const other = pr.tabs.find(t => !t.active)
    seen.push({ active: act.id, page: pg.metrics['context.used_tokens'], own: act.snapshot['context.used_tokens'], other: other.snapshot['context.used_tokens'], session: pr.following.session })
  }
  await shot(win, path.join(out, 'meters.png'))
  console.log(JSON.stringify(seen))
  await end(app)
  check(seen[0].active !== seen[1].active, 'Ctrl+Tab did not switch')
  check(seen.every(s => s.page === s.own), 'want the page given the active tab\'s values')
  check(seen[0].session && seen[1].session && seen[0].session !== seen[1].session, 'want each tab its own session')
}

// Several live tabs ask before the window closes, one tab does not, and
// a signal asks nothing.
async function closewin () {
  const stub = async (app, answer) => app.evaluate(({ dialog }, n) => {
    global.asked = []
    dialog.showMessageBox = async (...args) => {
      global.asked.push(args.find(a => a && Array.isArray(a.buttons)))
      return { response: n }
    }
  }, answer)
  const close = app => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => !w.getTitle().startsWith('visualization')).close())
  const asked = app => app.evaluate(() => global.asked)
  const seen = {}

  let r = await start([keysFake])
  await r.win.keyboard.press('Control+Shift+T')
  await sleep(1500)
  await stub(r.app, 1)
  await close(r.app)
  await sleep(800)
  const kept = await probe(r.app)
  seen.cancel = { asked: (await asked(r.app)).map(o => o.message), tabs: kept.tabs.length, alive: kept.tabs.every(t => alive(t.childPid)) }
  await stub(r.app, 0)
  await close(r.app)
  seen.confirm = { exit: await Promise.race([r.exit, sleep(8000).then(() => 'still running')]), alive: kept.tabs.filter(t => alive(t.childPid)).length }

  r = await start([keysFake])
  await stub(r.app, 1)
  await close(r.app)
  seen.one = { exit: await Promise.race([r.exit, sleep(8000).then(() => 'still running')]) }

  r = await start([keysFake])
  await r.win.keyboard.press('Control+Shift+T')
  await sleep(1500)
  await stub(r.app, 1)
  const pids = (await probe(r.app)).tabs.map(t => t.childPid)
  const elec = r.app.process().pid
  process.kill(elec, 'SIGTERM')
  seen.signal = { exit: await Promise.race([r.exit, sleep(8000).then(() => 'still running')]), alive: pids.filter(alive).length }
  console.log(JSON.stringify(seen))
  check(seen.cancel.asked.join() === 'Close 2 tabs?' && seen.cancel.tabs === 2 && seen.cancel.alive, 'Cancel must keep both tabs')
  check(seen.confirm.exit === 0 && seen.confirm.alive === 0, 'Close tabs must end both CLIs and the app')
  check(seen.one.exit === 0, 'one tab must close with no dialog')
  check(seen.signal.exit === 0 && seen.signal.alive === 0, 'a signal must end every tab with no dialog')
}

// A new tab carries the options that set up a session and drops those
// of one session, and its strip names what it dropped.
async function carry () {
  const { app, win } = await start([claudeFake, '--model', 'opus', '--permission-mode', 'plan', '--resume', 'abc', 'hello'])
  await win.keyboard.press('Control+Shift+T')
  await sleep(3000)
  const pr = await probe(app)
  const t = pr.tabs[1]
  const cmdline = fs.readFileSync(`/proc/${t.childPid}/cmdline`, 'utf8').split('\0').filter(Boolean)
  const notice = await win.evaluate(() => document.getElementById('strip-notice').textContent)
  const strip = await win.evaluate(() => document.getElementById('strip-cmd').textContent)
  console.log(JSON.stringify({ argv: t.argv.slice(1), cmdline: cmdline.slice(1), strip, notice }))
  await shot(win, path.join(out, 'carry.png'))
  await end(app)
  check(t.argv.slice(1).join(' ') === '--model opus --permission-mode plan', 'want --model and --permission-mode carried, alone')
  check(cmdline.includes('--model') && cmdline.includes('plan') && !cmdline.includes('--resume') && !cmdline.includes('hello'), 'the running CLI must have the carried options and not the dropped ones')
  check(notice.includes('not carried: --resume abc hello'), `want the strip to name what was dropped, saw ${notice}`)
}

;({ keys, strip, exit, execfail, meters, closewin, carry })[what]().then(() => console.log('done')).catch(e => { console.error(e); process.exit(1) })
