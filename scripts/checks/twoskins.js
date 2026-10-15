'use strict'
// Several launches share one skin at once, each its own process and
// window (decision 0022). Run under xvfb-run:
//   node scripts/checks/twoskins.js OUT
// Every launch here shares one state home, as the maintainer's launches do,
// so the last-skin records, the settings and the logs of all of them
// land in one place, and the runtime root is the real one. The launch
// dialog of decision 0022 is stubbed: a launch that asks fails the check.
const { launch, childPid, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')
const last = require('../../app/skins/last')
const runtime = require('../../app/runtime')

const out = path.resolve(process.argv[2])
const root = path.join(__dirname, '..', '..')
const fake = path.join(root, 'scripts', 'fake', 'claude')
const state = path.join(out, 'state')
const recs = path.join(state, 'claude-skins', 'last-skins')
const asked = path.join(out, 'dialog.json')
fs.rmSync(state, { recursive: true, force: true })
fs.rmSync(asked, { force: true })
fs.mkdirSync(state, { recursive: true })
const env = { SKINNED_GL: 'swiftshader', XDG_STATE_HOME: state, SKINNED_SKIN: '', SKINNED_CHECK_DIALOG: asked, SKINNED_CHECK_ANSWER: '0' }

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

const open = []

async function start (name, appArgs) {
  const l = await launch([fake], { appArgs, env, require: path.join(__dirname, 'stub-dialog.js') })
  l.name = name
  l.exit = new Promise(resolve => l.app.process().once('exit', (code, sig) => resolve(sig ? `signal ${sig}` : code)))
  open.push(l)
  return l
}

async function end (l) {
  const pid = await childPid(l.app).catch(() => null)
  if (pid) try { process.kill(-pid, 'SIGHUP') } catch (e) {}
  await sleep(1500)
  await l.app.close().catch(() => {})
  open.splice(open.indexOf(l), 1)
  return l.exit
}

// What a launch shows: its skin, its own runtime dir, its windows.
async function seen (l) {
  const current = await l.win.evaluate(async () => (await window.skinned.listSkins()).filter(s => s.current).map(s => s.id))
  const pid = await l.app.evaluate(() => process.pid)
  const runDir = path.join(runtime.base(), String(pid))
  return { name: l.name, skin: current[0], pid, runDir: fs.existsSync(runDir), windows: l.app.windows().length, child: await childPid(l.app) }
}

async function main () {
  // Two launches given one skin, at once.
  const [a, b] = await Promise.all([start('a', ['--skin', 'deck']), start('b', ['--skin', 'deck'])])
  await sleep(3000)
  let s = await Promise.all([seen(a), seen(b)])
  console.log('given', JSON.stringify(s), 'records', JSON.stringify(last.read(recs).map(r => r.spec)))
  check(s.every(x => x.skin === 'deck' && x.runDir && x.windows === 2 && x.child), 'want both launches given deck on deck, each with its runtime dir, its viz window and its CLI')
  check(s[0].pid !== s[1].pid && s[0].child !== s[1].child, 'want two processes and two CLIs')
  check(!fs.existsSync(asked), 'want no launch dialog')
  check(last.read(recs).map(r => r.spec).join() === 'deck,deck', 'want one deck record per launch')
  const [ca, cb] = await Promise.all([end(a), end(b)])
  console.log('exit', ca, cb)

  // Two bare launches, at once, with the records above in place.
  const [c, d] = await Promise.all([start('c', []), start('d', [])])
  await sleep(3000)
  s = await Promise.all([seen(c), seen(d)])
  console.log('bare', JSON.stringify(s), 'records', JSON.stringify(last.read(recs).map(r => r.spec)))
  check(s.every(x => x.skin === 'deck' && x.runDir && x.windows === 2 && x.child), 'want both bare launches on deck, the last skin used')
  check(!fs.existsSync(asked), 'want no launch dialog')
  const [cc, cd] = await Promise.all([end(c), end(d)])
  console.log('exit', cc, cd)

  // A bare launch beside a running given one takes its skin, and a
  // launch given another skin beside them takes neither's away. The
  // records of the launches above are forgotten first: a bare launch
  // within 5 s of records of two skins asks (decision 0022), and the
  // launches that made them have ended.
  last.forget(recs)
  const e = await start('e', ['--skin', 'phosphor'])
  await sleep(2000)
  const f = await start('f', [])
  await sleep(2000)
  const g = await start('g', ['--skin', 'deck'])
  await sleep(3000)
  s = await Promise.all([seen(e), seen(f), seen(g)])
  console.log('beside', JSON.stringify(s), 'records', JSON.stringify(last.read(recs).map(r => r.spec)))
  check(s[0].skin === 'phosphor' && s[1].skin === 'phosphor' && s[2].skin === 'deck', 'want e and f on phosphor and g on deck')
  check(!fs.existsSync(asked), 'want no launch dialog')
  const codes = await Promise.all([end(e), end(f), end(g)])
  console.log('exit', codes.join(' '))
  check([ca, cb, cc, cd, ...codes].every(x => x !== 125), 'want no launch refused')
}

main().then(() => console.log('done'), async err => {
  console.error(err)
  process.exitCode = 1
  for (const l of [...open]) await end(l)
})
