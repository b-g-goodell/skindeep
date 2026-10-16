'use strict'
// Live check of the Claude adapter on the replay fake. Run under
// scripts/clean-env xvfb-run -a -s "-screen 0 1920x1080x24":
//   node scripts/checks/claude-bus.js OUT [--continue]
// The app's runtime, state, home and Claude config dirs are put in OUT.
// --continue makes the fake start on a transcript with history.
// Prints the context family and the hook meters at 4 s and once the
// fake's first turn has finished, then ends the child by its recorded
// pid. A finished turn of the fake is one UserPromptSubmit, a TodoWrite
// and at least one more tool call, and a Stop, all through the hook
// relay: fewer within DEADLINE_MS of the launch prints a FAIL line
// naming each meter short, and exits 1.
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
// The hook meters of one finished turn, at least.
const TURN = { 'event.prompt': 1, 'event.tool': 2, 'event.stop': 1 }
const DEADLINE_MS = 30000
const short = m => Object.entries(TURN).filter(([k, n]) => !(m[k] >= n)).map(([k, n]) => `${k} ${m[k] || 0} of ${n}`)
const pick = m => Object.fromEntries(Object.keys(m).filter(k => k.startsWith('context.') || HOOK_METERS.includes(k)).sort().map(k => [k, m[k]]))

;(async () => {
  const { app } = await launch([fake, ...process.argv.slice(3)], { env })
  const t0 = Date.now()
  await sleep(4000)
  const pid = await childPid(app)
  console.log(`t=4s ${JSON.stringify(pick((await probe(app)).snapshot))}`)
  let m = {}
  while (Date.now() - t0 < DEADLINE_MS) {
    m = (await probe(app)).snapshot
    if (!short(m).length) break
    await sleep(500)
  }
  console.log(`t=${Math.round((Date.now() - t0) / 1000)}s ${JSON.stringify(pick(m))}`)
  console.log('child', pid)
  try { process.kill(-pid, 'SIGHUP') } catch (e) { console.log('kill', e.code) }
  await sleep(3000)
  await app.close().catch(() => {})
  const missing = short(m)
  if (missing.length) {
    console.log(`FAIL hook meters short of one finished turn within ${DEADLINE_MS / 1000} s: ${missing.join(', ')}`)
    process.exit(1)
  }
  console.log('done')
})().catch(e => { console.error(e); process.exit(1) })
