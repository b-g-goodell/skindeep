'use strict'
// Capture a frame sequence of one skin under xvfb-run:
//   node scripts/checks/look.js OUT SKIN FRAMES INTERVAL_MS -- CMD [ARGS]
const { launch, childPid, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const [outArg, skin, framesArg, intervalArg] = process.argv.slice(2)
const cmd = process.argv.slice(process.argv.indexOf('--') + 1)
const out = path.resolve(outArg)
fs.mkdirSync(out, { recursive: true })

;(async () => {
  const { app, win } = await launch(cmd, { appArgs: ['--skin', skin], env: { SKINNED_GL: 'swiftshader' } })
  await sleep(3500)
  for (let i = 0; i < Number(framesArg); i++) {
    await shot(win, path.join(out, `${path.basename(skin)}-${i}.png`))
    await sleep(Number(intervalArg))
  }
  const pid = await childPid(app)
  try { process.kill(-pid, 'SIGHUP') } catch (e) {}
  await sleep(1500)
  await app.close().catch(() => {})
  console.log('done')
})().catch(e => { console.error(e); process.exit(1) })
