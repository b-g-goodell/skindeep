'use strict'
// Live checks of Reopen closed tab and Duplicate tab (decision 0026). Run
// under xvfb-run:
//   node scripts/checks/reopen.js OUT claude|plain|codex
// Fakes only: scripts/fake comes first on PATH.
const { launch, probe, openMenu, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const what = process.argv[3]
const root = path.join(__dirname, '..', '..')
const fakes = path.join(root, 'scripts', 'fake')
const claudeFake = path.join(fakes, 'claude')
const codexFake = path.join(fakes, 'codex')
const keysFake = path.join(fakes, 'keys')
const codexHome = path.join(out, 'codex-home')
const bytesDir = path.join(out, 'bytes')
for (const d of [codexHome, bytesDir]) fs.mkdirSync(d, { recursive: true })
const env = { SKINNED_GL: 'swiftshader', PATH: `${fakes}:${process.env.PATH}`, CODEX_HOME: codexHome, SKINNED_CHECK_OUT: bytesDir }

function check (ok, msg, seen) {
  if (!ok) throw new Error(seen === undefined ? msg : `${msg}, saw ${JSON.stringify(seen)}`)
}

// get() once ok(value) holds, else after ms the last value seen.
async function until (get, ok, ms, step = 500) {
  const t0 = Date.now()
  let v = await get()
  while (!ok(v) && Date.now() - t0 < ms) {
    await sleep(step)
    v = await get()
  }
  return v
}

const alive = pid => { try { process.kill(pid, 0); return true } catch (e) { return false } }

async function start (cmd) {
  const r = await launch(cmd, { appArgs: ['--skin', 'deck', '--no-viz'], env })
  await sleep(3000)
  return r
}

async function end (app) {
  for (const t of (await probe(app)).tabs) try { process.kill(-t.childPid, 'SIGHUP') } catch (e) {}
  await sleep(1500)
  await app.close().catch(() => {})
}

const entries = async win => {
  await openMenu(win)
  const items = await win.evaluate(() => [...document.querySelectorAll('#menu .item')].map(e => ({ text: e.textContent, disabled: e.classList.contains('disabled') })))
  await win.keyboard.press('Escape')
  await sleep(200)
  return items.filter(i => /^(Reopen|Duplicate)/.test(i.text))
}

async function menu (win, re) {
  await openMenu(win)
  await win.locator('#menu .item').filter({ hasText: re }).click()
}

const tabs = async app => (await probe(app)).tabs
const session = t => t.following.session

// A closed tab resumes its session, the meters start from its
// transcript, a duplicate forks the session beside the original, and a
// closed session another tab runs is not resumed again.
async function claude () {
  const { app, win } = await start([claudeFake])
  const first = await entries(win)
  console.log('at launch', JSON.stringify(first))
  check(first[0].text === 'Reopen closed tab' && first[0].disabled && first[1].text === 'Duplicate tab' && !first[1].disabled, 'want Reopen disabled and Duplicate offered at launch')
  await win.keyboard.press('Control+Shift+T')
  await sleep(9000)
  let [a, b] = await tabs(app)
  const before = b.snapshot['tokens.out']
  check(session(a) && session(b) && session(a) !== session(b) && before > 0, 'want two sessions, the second with output')
  await win.keyboard.press('Control+Shift+W')
  await sleep(2000)
  check((await entries(win))[0].text === 'Reopen closed tab', 'want Reopen offered for a closed session')
  await menu(win, /^Reopen closed tab$/)
  await sleep(1500)
  let t = await tabs(app)
  const c = t[1]
  console.log('reopened', JSON.stringify({ argv: c.argv.slice(1), label: c.label, cwd: c.cwd, session: session(c), out: c.snapshot['tokens.out'], before }))
  check(t.length === 2 && c.active && c.argv.slice(1).join(' ') === `--resume ${session(b)}` && c.label === b.label && c.cwd === b.cwd, 'want the closed tab back, resuming its session in its folder')
  check(session(c) === session(b) && c.snapshot['tokens.out'] >= before, 'want the meters to start from the session\'s transcript')

  await win.keyboard.press('Control+Tab')
  await sleep(500)
  await menu(win, /^Duplicate tab$/)
  await sleep(2500)
  t = await tabs(app)
  const d = t[1]
  console.log('duplicate', JSON.stringify({ order: t.map(x => x.id), argv: d.argv.slice(1), session: session(d), original: session(a) }))
  check(t.length === 3 && d.id !== a.id && d.id !== c.id && t[0].id === a.id && t[2].id === c.id, 'want the duplicate beside the original')
  check(d.argv.slice(1).join(' ') === `--resume ${session(a)} --fork-session` && session(d) && session(d) !== session(a), 'want a fork of the original\'s session')
  check(alive(a.childPid) && session((await tabs(app))[0]) === session(a), 'the original must keep running its session')

  await win.locator(`#tabs .tab[data-id="${c.id}"] .close`).click()
  await sleep(2000)
  await menu(win, /^New tab\.\.\.$/)
  await sleep(600)
  await win.fill('#chooser .line', `${claudeFake} --resume ${session(b)}`)
  await win.keyboard.press('Enter')
  await sleep(2500)
  const e = (await tabs(app)).find(x => session(x) === session(b))
  await win.keyboard.press('Control+Tab')
  await sleep(400)
  await menu(win, /^Reopen closed tab$/)
  await sleep(1500)
  const pr = await probe(app)
  console.log('guard', JSON.stringify({ tabs: pr.tabs.map(x => [x.id, session(x)]), active: pr.tabs.find(x => x.active).id, live: e && e.id }))
  check(e && pr.tabs.length === 3 && pr.tabs.find(x => x.active).id === e.id, 'want the tab that runs the closed session made active, no second writer')
  await end(app)
}

// A plain command has no session: Reopen and Duplicate start a new one.
async function plain () {
  const { app, win } = await start([keysFake])
  await win.keyboard.press('Control+Shift+T')
  await sleep(1500)
  await win.keyboard.press('Control+Shift+W')
  await sleep(1500)
  const items = await entries(win)
  console.log(JSON.stringify(items))
  check(items.map(i => i.text).join() === 'Reopen closed tab (new session),Duplicate tab (new session)', 'want both entries to say new session')
  await menu(win, /^Reopen closed tab/)
  await sleep(1500)
  await menu(win, /^Duplicate tab/)
  await sleep(1500)
  const t = await tabs(app)
  console.log(JSON.stringify(t.map(x => x.argv)))
  check(t.length === 3 && t.every(x => x.argv.join(' ') === keysFake && alive(x.childPid)), 'want two new sessions of the same command')
  check((await entries(win))[0].disabled, 'want Reopen disabled once the closed tab is reopened')
  await end(app)
}

// Codex: resume <id> follows the same rollout, fork <id> a new thread.
// Each read waits, bounded, for the state it asserts, and a failed
// check quotes the tabs it saw. The fake replays the fixture from
// its start on resume and on fork, so a tab's cumulative token meter
// drops from the history's last total to the fixture's first within one
// tail poll: the meters are compared once both replays have ended, at
// the fixture's last total, where the fork's tool count carries the
// history it references and its own replay.
async function codex () {
  const fixture = fs.readFileSync(path.join(root, 'test', 'fixtures', 'codex', 'rollout.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  const totals = fixture.filter(o => o.type === 'event_msg' && o.payload.type === 'token_count' && o.payload.info && o.payload.info.total_token_usage)
  const FINAL = totals[totals.length - 1].payload.info.total_token_usage.input_tokens
  const TOOLS = fixture.filter(o => o.type === 'response_item' && ['function_call', 'custom_tool_call', 'local_shell_call', 'web_search_call'].includes(o.payload.type)).length
  const roll = t => t.following.channels.find(x => x.name === 'rollout')
  const live = t => !!(t && session(t) && roll(t).state === 'live')
  const seen = t => t && { argv: t.argv.slice(1), session: session(t), rollout: roll(t), replaying: t.following.replaying, in: t.snapshot['tokens.in'], tools: t.snapshot['tools.total'], alive: alive(t.childPid) }
  const { app, win } = await start([codexFake])
  await win.keyboard.press('Control+Shift+T')
  let t = await until(() => tabs(app), t => t.length === 2 && live(t[1]), 30000)
  const b = t[1]
  check(t.length === 2 && live(b), 'want the second codex tab following its rollout', t.map(seen))
  await win.keyboard.press('Control+Shift+W')
  t = await until(() => tabs(app), t => t.length === 1, 10000)
  check(t.length === 1, 'want the second tab closed', t.map(seen))
  await menu(win, /^Reopen closed tab$/)
  t = await until(() => tabs(app), t => t.length === 2 && live(t[1]) && !t[1].following.replaying, 30000)
  check(t.length === 2 && live(t[1]), 'want the closed tab back, following its rollout', t.map(seen))
  const c = t[1]
  console.log('reopened', JSON.stringify({ argv: c.argv.slice(1), rollout: roll(c), was: roll(b).target }))
  check(c.argv.slice(1).join(' ') === `resume ${session(b)}` && session(c) === session(b) && roll(c).how === 'argv' && roll(c).target === roll(b).target, 'want codex resume <id> on the same rollout', t.map(seen))
  const cFork = (await tabs(app))[1]
  await menu(win, /^Duplicate tab$/)
  t = await until(() => tabs(app), t => t.length === 3 && live(t[2]) && !t[2].following.replaying, 30000)
  check(t.length === 3 && live(t[2]), 'want the duplicate beside the reopened tab, following its rollout', t.map(seen))
  const d = t[2]
  console.log('duplicate', JSON.stringify({ argv: d.argv.slice(1), rollout: roll(d), session: session(d) }))
  check(d.argv.slice(1).join(' ') === `fork ${session(b)}` && roll(d).how === 'forked' && session(d) !== session(b) && roll(d).target !== roll(b).target, 'want codex fork <id> on a new thread\'s rollout', t.map(seen))
  const ended = t => t.length === 3 && t[1].snapshot['tokens.in'] === FINAL && t[2].snapshot['tokens.in'] === FINAL
  t = await until(() => tabs(app), ended, 90000)
  console.log('replays ended', JSON.stringify({ final: FINAL, tools: TOOLS, before: seen(cFork).tools, original: seen(t[1]), fork: seen(t[2]) }))
  check(ended(t), `want both replays ended at the fixture's last total ${FINAL}`, t.map(seen))
  check(t[2].snapshot['tools.total'] >= cFork.snapshot['tools.total'] + TOOLS && alive(c.childPid), `want the fork's tools to count the history it references plus its own ${TOOLS}, the original running`, { before: seen(cFork), original: seen(t[1]), fork: seen(t[2]) })
  await end(app)
}

;({ claude, plain, codex })[what]().then(() => console.log('done')).catch(e => { console.error(e); process.exit(1) })
