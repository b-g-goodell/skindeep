'use strict'
// Live check of a background session picked in the --resume picker
// (decision 0030), on the replay fake. Run under
// scripts/clean-env xvfb-run -a -s "-screen 0 1920x1080x24":
//   node scripts/checks/attach.js OUT
// 1. `claude --resume`: the fake refuses as Claude Code does, and the tab
//    goes on as `claude attach ID`.
// 2. `claude --resume --model x`: the refusal is the user's own, so the
//    window ends with the CLI's status.
// 3. The same through bin/skinned on a terminal (script(1)): the last
//    screen, the refusal, is left in that terminal.
const { launch, probe, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const out = path.resolve(process.argv[2])
const root = path.join(__dirname, '..', '..')
const fake = path.join(__dirname, '..', 'fake', 'claude')
const JOB = '5e3a91c0'
const env = { SKINNED_GL: 'swiftshader', FAKE_CLAUDE_BACKGROUND: JOB }
for (const [k, d] of [['XDG_RUNTIME_DIR', 'run'], ['XDG_STATE_HOME', 'state'], ['HOME', 'home'], ['CLAUDE_CONFIG_DIR', 'config']]) {
  env[k] = path.join(out, d)
  fs.mkdirSync(env[k], { recursive: true, mode: 0o700 })
}

let failed = 0
function check (ok, msg) {
  if (!ok) {
    failed++
    console.log('FAIL', msg)
  }
}

;(async () => {
  const a = await launch([fake, '--resume'], { env })
  await sleep(4000)
  const pr = await probe(a.app)
  const tabs = pr.tabs.map(t => ({ id: t.id, argv: t.argv, active: t.active }))
  console.log('1 tabs', JSON.stringify(tabs))
  check(tabs.length === 1 && tabs[0].active && JSON.stringify(tabs[0].argv) === JSON.stringify([fake, 'attach', JOB]), `want one active tab running ${fake} attach ${JOB}`)
  await a.app.close()

  const b = await launch([fake, '--resume', '--model', 'x'], { env })
  const code = await new Promise(resolve => {
    const t = setTimeout(() => resolve('still open'), 8000)
    b.app.process().on('exit', c => { clearTimeout(t); resolve(c) })
  })
  console.log('2 exit', code)
  check(code === 0, 'want the window to end with the CLI\'s status 0 when the user\'s arguments carry settings')

  const log = path.join(out, 'script.log')
  const cmd = `${root}/bin/skinned --mute --no-viz -- ${fake} --resume --model x`
  const r = spawnSync('script', ['-qec', cmd, log], { env: Object.assign({}, process.env, env), timeout: 30000 })
  const text = fs.readFileSync(log, 'utf8').replace(/\r/g, '')
  console.log('3 status', r.status, 'terminal', JSON.stringify(text.slice(-300)))
  check(r.status === 0 && text.includes(`is running in the background (${JOB}). Run`) && text.includes(`\`claude attach ${JOB}\` to open it`), 'want the refusal left in the launching terminal')

  console.log(failed ? `${failed} FAILED` : 'done')
  process.exit(failed ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
