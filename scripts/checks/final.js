'use strict'
// Final look under scripts/clean-env xvfb-run: a real claude session on
// the caller's own config, in one skin, screenshots before and after a
// prompt, viz frames while it works, and the bus difference.
//   node scripts/checks/final.js OUT SKIN
const { launch, probe, childPid, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const skin = process.argv[3]
fs.mkdirSync(out, { recursive: true })
const env = { SKINNED_GL: 'swiftshader' }
const snap = async app => (await probe(app)).snapshot

;(async () => {
  const { app, win } = await launch(['claude', '--permission-mode', 'default'], { appArgs: ['--skin', skin], env })
  await sleep(10000)
  const viz = app.windows().find(w => w.url().includes('/viz/'))
  await shot(win, path.join(out, `${skin}-before.png`))
  const a = await snap(app)
  await win.keyboard.type('Use the Read tool on package.json, then the Glob tool for app/*.js, then reply with one short sentence.')
  await win.keyboard.press('Enter')
  for (let i = 0; i < 10; i++) {
    await sleep(1500)
    if (viz) await viz.screenshot({ path: path.join(out, `${skin}-viz-${i}.png`) })
    if (i === 3) await shot(win, path.join(out, `${skin}-working.png`))
  }
  await sleep(15000)
  await shot(win, path.join(out, `${skin}-after.png`))
  if (viz) await viz.screenshot({ path: path.join(out, `${skin}-viz-idle.png`) })
  const b = await snap(app)
  let changed = 0
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    const c = JSON.stringify(a[k]) !== JSON.stringify(b[k])
    if (c) changed++
    console.log(`${c ? '*' : ' '} ${k.padEnd(26)} ${JSON.stringify(a[k])} -> ${JSON.stringify(b[k])}`)
  }
  console.log('changed', changed)
  const pid = await childPid(app)
  try { process.kill(-pid, 'SIGHUP') } catch (e) { console.log('kill', e.code) }
  await sleep(3000)
  await app.close().catch(() => {})
  console.log('done')
})().catch(e => { console.error(e); process.exit(1) })
