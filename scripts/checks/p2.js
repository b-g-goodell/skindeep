'use strict'
// Phase 2 live checks. Run under scripts/clean-env xvfb-run.
//   node scripts/checks/p2.js OUT rule    claude's own project-dir rule
//   node scripts/checks/p2.js OUT chain   chained statusline shows, bus fills
//   node scripts/checks/p2.js OUT live [always|chain-only]  bus before/after a prompt
const { launch, probe, childPid, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const what = process.argv[3]
const mode = process.argv[4] || 'always'
const root = path.join(__dirname, '..', '..')
fs.mkdirSync(out, { recursive: true })
const env = { SKINNED_GL: 'swiftshader' }

const snap = async app => (await probe(app)).snapshot

async function end (app) {
  const pid = await childPid(app)
  try { process.kill(-pid, 'SIGHUP') } catch (e) { console.log('kill', e.code) }
  await sleep(3000)
  await app.close().catch(() => {})
}

async function rule () {
  const { app, win } = await launch(['claude', '--permission-mode', 'default', '--settings', '{}'], { env, cwd: path.join(root, 'docs') })
  await sleep(10000)
  await shot(win, path.join(out, 'rule-subdir.png'))
  await end(app)
}

async function chain () {
  const { app, win } = await launch(['claude', '--permission-mode', 'default'], { env, cwd: root })
  await sleep(10000)
  await shot(win, path.join(out, 'chain-root.png'))
  console.log('settings', fs.readdirSync(`${process.env.XDG_RUNTIME_DIR}/claude-skins`).join(' '))
  console.log('bus', JSON.stringify(await snap(app)))
  await end(app)
}

async function live () {
  const appArgs = mode === 'chain-only' ? ['--statusline=chain-only'] : []
  const { app, win } = await launch(['claude', '--permission-mode', 'default'], { env, cwd: root, appArgs })
  await sleep(10000)
  const a = await snap(app)
  await shot(win, path.join(out, `live-${mode}-before.png`))
  await win.keyboard.type('Use the Read tool on package.json and reply with only its name field.')
  await win.keyboard.press('Enter')
  await sleep(30000)
  const b = await snap(app)
  await shot(win, path.join(out, `live-${mode}-after.png`))
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
  for (const k of keys) {
    const changed = JSON.stringify(a[k]) !== JSON.stringify(b[k])
    console.log(`${changed ? '*' : ' '} ${k.padEnd(28)} ${JSON.stringify(a[k])} -> ${JSON.stringify(b[k])}`)
  }
  await end(app)
}

;({ rule, chain, live })[what]().then(() => console.log('done')).catch(e => { console.error(e); process.exit(1) })
