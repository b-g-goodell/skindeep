'use strict'
// Live checks of New tab... (decision 0025). Run under xvfb-run:
//   node scripts/checks/newtab.js OUT profiles|codex
// Fakes only: scripts/fake comes first on PATH, so a bare claude or
// codex in the chooser runs a fake, never a real CLI.
const { launch, probe, openMenu, shot, sleep } = require('../drive.js')
const fs = require('fs')
const os = require('os')
const path = require('path')

const out = path.resolve(process.argv[2])
const what = process.argv[3]
const root = path.join(__dirname, '..', '..')
const fakes = path.join(root, 'scripts', 'fake')
const claudeFake = path.join(fakes, 'claude')
const codexFake = path.join(fakes, 'codex')
const state = path.join(out, 'state')
const lab = path.join(out, 'profiles', 'lab', '.claude')
const work = path.join(out, 'profiles', 'work', '.claude')
const codexLab = path.join(out, 'codex', 'lab')
for (const d of [state, lab, work, codexLab]) fs.mkdirSync(d, { recursive: true })
fs.writeFileSync(path.join(work, 'settings.json'), JSON.stringify({ statusLine: { type: 'command', command: 'echo work-line' } }))
const env = { SKINNED_GL: 'swiftshader', XDG_STATE_HOME: state, CLAUDE_CONFIG_DIR: lab, PATH: `${fakes}:${process.env.PATH}` }

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

// A child's own variables, from /proc: this check's children only.
function environ (pid) {
  const e = {}
  for (const kv of fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)) {
    const i = kv.indexOf('=')
    e[kv.slice(0, i)] = kv.slice(i + 1)
  }
  return e
}

async function start () {
  const r = await launch([claudeFake], { appArgs: ['--skin', 'deck', '--no-viz'], env })
  await sleep(2500)
  return r
}

async function end (app) {
  for (const t of (await probe(app)).tabs) try { process.kill(-t.childPid, 'SIGHUP') } catch (e) {}
  await sleep(1500)
  await app.close().catch(() => {})
}

// The next folder dialog answers dir.
const answer = (app, dir) => app.evaluate(({ dialog }, d) => {
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [d] })
}, dir)

async function chooser (win) {
  await openMenu(win)
  await win.locator('#menu .item').filter({ hasText: /^New tab\.\.\.$/ }).click()
  await sleep(600)
  return read(win)
}

const read = win => win.evaluate(() => {
  const c = document.getElementById('chooser')
  if (c.hidden) return null
  return {
    agent: (c.querySelector('input[name=agent]:checked') || {}).value,
    profile: c.querySelector('.profile').value,
    profiles: [...c.querySelectorAll('.profile option')].map(o => o.value),
    forget: !c.querySelector('.forget').disabled,
    env: c.querySelector('.env').textContent,
    folder: c.querySelector('.folder').value,
    line: c.querySelector('.line').value,
    error: c.querySelector('.error').hidden ? null : c.querySelector('.error').textContent
  }
})

const click = (win, text) => win.locator('#chooser button', { hasText: text }).click()

// Two tabs of the fake claude on two profiles beside the window's, the
// default profile with the variable unset, each tab's statusline chain
// from its own profile, a refused command line, and the record of a
// profile chosen, kept across launches until forgotten.
async function profiles () {
  const dflt = path.join(os.homedir(), '.claude')
  let { app, win } = await start()
  let c = await chooser(win)
  console.log('chooser', JSON.stringify(c))
  check(c && c.agent === 'claude' && c.profile === lab && c.line === claudeFake && c.env.endsWith('/lab/.claude'), 'want the active tab\'s agent, profile and command line')
  await answer(app, work)
  await click(win, 'Other profile...')
  await sleep(300)
  c = await read(win)
  check(c.profile === work && /^CLAUDE_CONFIG_DIR=/.test(c.env), 'Other profile... did not select the folder')
  await shot(win, path.join(out, 'chooser.png'))
  await click(win, 'Open')
  await sleep(3000)
  let pr = await probe(app)
  const t2 = pr.tabs[1]
  check(pr.tabs.length === 2 && t2.label === 'claude [work]' && t2.active, `want an active tab claude [work], saw ${JSON.stringify(pr.tabs.map(t => t.label))}`)
  check(environ(t2.childPid).CLAUDE_CONFIG_DIR === work, 'the work tab\'s child lacks its CLAUDE_CONFIG_DIR')
  // The relay carries the chained statusline inline, last on its command
  // (decision 0030).
  const argv = fs.readFileSync(`/proc/${t2.childPid}/cmdline`, 'utf8').split('\0')
  const line = JSON.parse(fs.readFileSync(argv[argv.indexOf('--settings') + 1], 'utf8')).statusLine.command
  const chain = Buffer.from(line.split(' ').pop(), 'base64url').toString('utf8')
  check(chain === 'echo work-line', `want the work tab's relay chained to its profile's statusline, saw ${JSON.stringify(chain)}`)

  // From the second tab on, + opens the same chooser.
  await win.locator('#tabs .new').click()
  await sleep(600)
  c = await read(win)
  console.log('chooser again, from +', JSON.stringify(c))
  check(c.profile === work && c.profiles.slice(0, 3).join() === [dflt, lab, work].join() && c.forget, 'want the default, the open tabs\' profiles, work remembered, then the scan\'s')
  await win.selectOption('#chooser .profile', dflt)
  await sleep(200)
  c = await read(win)
  check(c.env === 'CLAUDE_CONFIG_DIR unset, the default profile' && !c.forget, `want the default profile unset, saw ${c.env}`)
  await click(win, 'Open')
  await sleep(3000)
  pr = await probe(app)
  const t3 = pr.tabs[2]
  check(t3 && t3.label === 'claude' && !('CLAUDE_CONFIG_DIR' in environ(t3.childPid)), 'want a tab claude with CLAUDE_CONFIG_DIR unset')
  check(environ(pr.tabs[0].childPid).CLAUDE_CONFIG_DIR === lab, 'the first tab lost its profile')

  c = await chooser(win)
  await win.fill('#chooser .line', 'no-such-command-here --model x')
  await click(win, 'Open')
  await sleep(500)
  c = await read(win)
  console.log('refused', JSON.stringify(c && c.error))
  check(c && c.error === 'no-such-command-here: command not found', 'want the chooser to stay open and say the command is missing')
  await win.fill('#chooser .line', "claude 'open")
  await win.keyboard.press('Enter')
  await sleep(400)
  check((await read(win)).error === 'command line: unclosed single quote', 'want Enter to try to open and refuse the quote')
  await win.keyboard.press('Control+Shift+T')
  await sleep(800)
  check((await probe(app)).tabs.length === 3, 'a tab chord must do nothing while the chooser is open')
  await win.keyboard.press('Escape')
  await sleep(300)
  check(!(await read(win)) && (await probe(app)).tabs.length === 3, 'Escape must close the chooser and open nothing')
  await end(app)

  ;({ app, win } = await start())
  c = await chooser(win)
  console.log('next launch', JSON.stringify(c.profiles))
  check(c.profiles.includes(work), 'want work listed in a later launch')
  await win.selectOption('#chooser .profile', work)
  await sleep(200)
  check((await read(win)).forget, 'want Forget enabled for work')
  await click(win, 'Forget')
  await sleep(400)
  c = await read(win)
  check(!c.profiles.includes(work), 'Forget did not remove work')
  await win.keyboard.press('Escape')
  await end(app)
  ;({ app, win } = await start())
  c = await chooser(win)
  console.log('after forget', JSON.stringify(c.profiles))
  check(!c.profiles.includes(work), 'want work gone in a later launch')
  await win.keyboard.press('Escape')
  await end(app)
}

// A Codex tab beside a Claude tab, each tab's meters from its own channel.
async function codex () {
  const { app, win } = await start()
  let c = await chooser(win)
  await win.locator('#chooser input[value=codex]').check()
  await sleep(200)
  c = await read(win)
  console.log('codex chooser', JSON.stringify(c))
  check(c.agent === 'codex' && c.line === 'codex' && c.env.startsWith('CODEX_HOME unset'), 'want the bare codex on the default profile')
  await win.fill('#chooser .line', codexFake)
  await answer(app, codexLab)
  await click(win, 'Other profile...')
  await sleep(300)
  await click(win, 'Open')
  await sleep(8000)
  const pr = await probe(app)
  const [a, b] = pr.tabs
  const roll = b.following.channels.find(x => x.name === 'rollout')
  const seen = { labels: pr.tabs.map(t => t.label), rollout: roll, codexHome: environ(b.childPid).CODEX_HOME, models: [a.snapshot['model.name'], b.snapshot['model.name']], tokens: [a.snapshot['tokens.in'], b.snapshot['tokens.in']], claude: a.following.channels.map(x => `${x.name}:${x.state}`) }
  console.log(JSON.stringify(seen))
  await shot(win, path.join(out, 'codex-tab.png'))
  await end(app)
  check(seen.labels.join() === 'claude [lab],codex [lab]', 'want claude [lab] and codex [lab]')
  check(seen.codexHome === codexLab, 'the codex child lacks its CODEX_HOME')
  check(roll && roll.state === 'live' && roll.target.startsWith(fs.realpathSync(codexLab) + '/sessions/'), 'want the codex tab following a rollout under its own CODEX_HOME')
  check(seen.models[1] === 'gpt-6-astra' && seen.models[0] !== seen.models[1] && seen.tokens[1] > 0, 'want the codex tab\'s meters from its rollout')
  check(seen.claude.includes('statusline:live') && seen.claude.includes('hooks:live'), 'want the claude tab\'s own channels live')
}

// The process at the end of a tab's wrapper chain, as the strip finds it.
const leafOf = pid => require('../../app/metrics/proc').leaf(pid)

// A tab in a select-agent-config snapshot (decision 0037), on the fake
// tool and the real bwrap: the Config row lists the store's snapshot,
// the Profile row is disabled under it, the CLI runs with the tool's
// environment and none of the window's profile, its channels go live
// through the sandbox, the transcript it writes inside the snapshot is
// found in the store through the binds, the statusline chains to the
// snapshot's own settings, and a closed tab reopens in the snapshot.
async function snapshot () {
  const store = path.join(out, 'sac-store')
  const snap = path.join(store, 'snapshots', 'snap1')
  fs.mkdirSync(path.join(snap, 'claude'), { recursive: true })
  fs.mkdirSync(path.join(snap, 'tmp'), { recursive: true })
  fs.writeFileSync(path.join(snap, 'meta.json'), JSON.stringify({ name: 'Empty', lineage: 'fresh', accounts: 'sandbox', created: '2026-10-18T00:00:00-0600' }))
  fs.writeFileSync(path.join(snap, 'claude', 'settings.json'), JSON.stringify({ statusLine: { type: 'command', command: 'echo snap-line' } }))
  const { app, win } = await launch([claudeFake], { appArgs: ['--skin', 'deck', '--no-viz'], env: Object.assign({}, env, { FAKE_SAC_STORE: store }) })
  await sleep(2500)
  let c = await chooser(win)
  const rows = await win.evaluate(() => [...document.querySelectorAll('#chooser .snapshot option')].map(o => [o.value, o.textContent]))
  console.log('config row', JSON.stringify(rows))
  check(rows.length === 2 && rows[0][0] === '' && rows[1][0] === 'snap1' && rows[1][1] === 'Empty  (fresh install, sandbox accounts)', 'want Live and the store\'s one snapshot in the Config row')
  check(c.profile === lab && !(await win.evaluate(() => document.querySelector('#chooser .profile').disabled)), 'want the Profile row live under the live configuration')
  await win.selectOption('#chooser .snapshot', 'snap1')
  await sleep(200)
  const under = await win.evaluate(() => ({ off: document.querySelector('#chooser .profile').disabled, env: document.querySelector('#chooser .env').textContent }))
  console.log('under the snapshot', JSON.stringify(under))
  check(under.off && under.env.startsWith('In the snapshot Empty:'), 'want the Profile row disabled under a snapshot and the hint naming it')
  await shot(win, path.join(out, 'chooser-snapshot.png'))
  await click(win, 'Open')
  await sleep(6000)
  let pr = await probe(app)
  let t = pr.tabs[1]
  check(pr.tabs.length === 2 && t.label === 'claude {Empty}' && t.active, `want an active tab claude {Empty}, saw ${JSON.stringify(pr.tabs.map(t => t.label))}`)
  const leaf = leafOf(t.childPid)
  const e = environ(leaf)
  const argv = fs.readFileSync(`/proc/${leaf}/cmdline`, 'utf8').split('\0')
  console.log('leaf', leaf, JSON.stringify(argv.slice(0, 2)), 'SELECT_AGENT_CONFIG', e.SELECT_AGENT_CONFIG, 'TMPDIR', e.TMPDIR)
  check(path.basename(argv[0]) === 'claude' || path.basename(argv[1] || '') === 'claude', `want the fake claude at the end of the wrapper chain, saw ${JSON.stringify(argv.slice(0, 3))}`)
  check(!('CLAUDE_CONFIG_DIR' in e) && e.SELECT_AGENT_CONFIG === 'Empty' && e.TMPDIR === path.join(snap, 'tmp'), 'want the tool\'s environment on the CLI and none of the window\'s profile')
  const states = Object.fromEntries(t.following.channels.map(x => [x.name, x]))
  console.log('channels', JSON.stringify(t.following.channels))
  check(states.hooks.state === 'live' && states.statusline.state === 'live', 'want hooks and statusline live through the sandbox')
  check(states.transcript.state === 'live' && states.transcript.target.startsWith(path.join(snap, 'claude', 'run', 'claude-skins-fake') + '/') && fs.existsSync(states.transcript.target), `want the transcript followed in the store through the binds, saw ${JSON.stringify(states.transcript)}`)
  const line = JSON.parse(fs.readFileSync(argv[argv.indexOf('--settings') + 1], 'utf8')).statusLine.command
  const chain = Buffer.from(line.split(' ').pop(), 'base64url').toString('utf8')
  check(chain === 'echo snap-line', `want the relay chained to the snapshot's own statusline, saw ${JSON.stringify(chain)}`)
  const strip = await win.evaluate(() => document.querySelector('#strip') ? document.querySelector('#strip').textContent : null)
  console.log('strip', JSON.stringify(strip))
  await shot(win, path.join(out, 'snapshot-tab.png'))

  // The tab closes by a hangup to the CLI, and reopens in the snapshot.
  await win.keyboard.press('Control+Shift+W')
  await sleep(3000)
  pr = await probe(app)
  check(pr.tabs.length === 1, `want the snapshot tab closed, saw ${pr.tabs.length} tabs`)
  check(!fs.existsSync(`/proc/${leaf}`) && !fs.existsSync(`/proc/${t.childPid}`), 'want the CLI and its wrappers gone after the close')
  await openMenu(win)
  await win.locator('#menu .item').filter({ hasText: /^Reopen closed tab/ }).click()
  await sleep(6000)
  pr = await probe(app)
  t = pr.tabs[1]
  check(t && t.label === 'claude {Empty}' && t.argv.includes('--resume'), `want the session reopened in the snapshot, saw ${JSON.stringify(t && [t.label, t.argv])}`)
  check(environ(leafOf(t.childPid)).SELECT_AGENT_CONFIG === 'Empty', 'want the reopened CLI inside the snapshot')
  await end(app)
}

;({ profiles, codex, snapshot })[what]().then(() => console.log('done')).catch(e => { console.error(e); process.exit(1) })
