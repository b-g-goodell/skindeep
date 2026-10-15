'use strict'
// Live check of the Claude adapter on the replay fake. Run under
// scripts/clean-env xvfb-run -a -s "-screen 0 1920x1080x24":
//   node scripts/checks/claude-bus.js OUT [--continue]
// The app's runtime, state, home and Claude config dirs are put in OUT.
// --continue makes the fake start on a transcript with history.
// Prints the context family and the hook meters at 4 s and 13 s, then
// ends the child by its recorded pid.
const { launch, probe, childPid, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const fake = path.join(__dirname, '..', 'fake', 'claude')
const env = { SKINNED_GL: 'swiftshader' }
for (const [k, d] of [['XDG_RUNTIME_DIR', 'run'], ['XDG_STATE_HOME', 'state'], ['HOME', 'home'], ['CLAUDE_CONFIG_DIR', 'config']]) {
  env[k] = path.join(out, d)
  fs.mkdirSync(env[k], { recursive: true, mode: 0o700 })
}

const HOOK_METERS = ['tools.total', 'tools.rate', 'agents.active', 'state.busy', 'event.tool', 'event.prompt', 'event.stop', 'event.agent']
const pick = m => Object.fromEntries(Object.keys(m).filter(k => k.startsWith('context.') || HOOK_METERS.includes(k)).sort().map(k => [k, m[k]]))

;(async () => {
  const { app } = await launch([fake, ...process.argv.slice(3)], { env })
  let pid = null
  let last = 0
  for (const at of [4000, 13000]) {
    await sleep(at - last)
    last = at
    if (!pid) pid = await childPid(app)
    console.log(`t=${at / 1000}s ${JSON.stringify(pick((await probe(app)).snapshot))}`)
  }
  console.log('child', pid)
  try { process.kill(-pid, 'SIGHUP') } catch (e) { console.log('kill', e.code) }
  await sleep(3000)
  await app.close().catch(() => {})
  console.log('done')
})().catch(e => { console.error(e); process.exit(1) })
