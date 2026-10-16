'use strict'
// Live check of a foreign session on a profile never opened here
// (decision 0027). Run under xvfb-run:
//   node scripts/checks/foreign.js OUT
// The app runs with OUT/home as its home, so the home scan it takes is
// over this check's tree and the real home is not written. The session
// elsewhere is a fake claude on a profile under that home that no tab
// of the launch opened and no record names: the home scan alone can
// find it, and the menu's row must carry its label, never [?].
const { launch, openMenu, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawn } = require('child_process')
const { slug } = require('../../app/sessions')

const out = path.resolve(process.argv[2])
const root = path.join(__dirname, '..', '..')
const fakes = path.join(root, 'scripts', 'fake')
const claudeFake = path.join(fakes, 'claude')
const home = path.join(out, 'home')
const state = path.join(out, 'state')
const lab = path.join(home, 'profiles', 'lab', '.claude')
for (const d of [home, state]) fs.rmSync(d, { recursive: true, force: true })
for (const d of [state, path.join(lab, 'projects')]) fs.mkdirSync(d, { recursive: true })
// What tells the scan a Claude Code config dir: .claude.json beside projects.
fs.writeFileSync(path.join(lab, '.claude.json'), '{}\n')
const env = { SKINNED_GL: 'swiftshader', HOME: home, XDG_STATE_HOME: state, CLAUDE_CONFIG_DIR: '', PATH: `${fakes}:${process.env.PATH}` }
const history = fs.readFileSync(path.join(root, 'test', 'fixtures', 'claude', 'transcript-read.jsonl'))

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

let foreign = null
let launched = null

// A fake claude started outside the app on the lab profile, and the
// transcript Claude Code would keep for it, written every second.
function elsewhere () {
  const cwd = path.join(out, 'work')
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
    fs.appendFileSync(file, JSON.stringify({ type: 'assistant', isSidechain: false, message: { id: `msg_${n}`, model: 'claude-fake', usage: { input_tokens: 3, cache_creation_input_tokens: 100, cache_read_input_tokens: 20000 + n * 500, output_tokens: 50 } } }) + '\n')
  }, 1000)
  return { pid: p.pid, cwd, timer }
}

function stop (s) {
  clearInterval(s.timer)
  try { process.kill(s.pid, 'SIGTERM') } catch (e) {}
}

async function rows (win) {
  return win.evaluate(() => [...document.querySelectorAll('#menu .session')].map(e => ({
    label: e.querySelector('.s-label').textContent,
    folder: e.querySelector('.s-folder').textContent,
    state: e.querySelector('.s-state').textContent,
    where: e.querySelector('.s-where').textContent
  })))
}

async function main () {
  foreign = elsewhere()
  await sleep(1500)
  const { app, win } = launched = await launch([claudeFake], { appArgs: ['--skin', 'deck', '--no-viz'], env })
  await sleep(2500)
  await openMenu(win, 'Agents')
  const list = await rows(win)
  const row = list.find(r => r.folder === foreign.cwd)
  console.log('row', JSON.stringify(row), 'recorded profiles', JSON.stringify(fs.readdirSync(path.join(state, 'claude-skins')).filter(n => n === 'profiles')))
  await shot(win, path.join(out, 'foreign.png'))
  check(!fs.existsSync(path.join(state, 'claude-skins', 'profiles')), 'want no profile record: the scan alone must find the profile')
  check(row, 'want the session elsewhere listed')
  check(row.label === 'claude [lab]' && row.where === '', `want the session on its profile's label, saw ${JSON.stringify(row)}`)
  check(row.state === 'working', `want its transcript followed, saw state ${row.state}`)
}

main().then(() => console.log('done'), async e => {
  console.error(e)
  process.exitCode = 1
}).finally(async () => {
  if (foreign) stop(foreign)
  if (!launched) return
  const pr = await launched.app.evaluate(() => global.skinnedProbe()).catch(() => ({ tabs: [] }))
  for (const t of pr.tabs) if (t.childPid) try { process.kill(-t.childPid, 'SIGHUP') } catch (err) {}
  await launched.app.close().catch(() => {})
})
