'use strict'
// Phase 5 live check under xvfb-run: node scripts/checks/p5.js OUT [skin] [-- CMD]
// Frame sequences of the viz window in each mode while CMD (default the
// replay fake) produces events.
const { launch, childPid, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const skin = process.argv[3] || 'deck'
const sep = process.argv.indexOf('--')
const cmd = sep > 0 ? process.argv.slice(sep + 1) : [path.join(__dirname, '..', 'fake', 'claude')]
fs.mkdirSync(out, { recursive: true })

;(async () => {
  const { app, win } = await launch(cmd, { appArgs: ['--skin', skin], env: { SKINNED_GL: 'swiftshader' } })
  let viz = null
  for (let i = 0; i < 40 && !viz; i++) {
    await sleep(250)
    for (const w of app.windows()) if (w.url().includes('/viz/')) viz = w
  }
  if (!viz) throw new Error('no viz window')
  await sleep(3000)
  const focused = await app.evaluate(({ BrowserWindow }) => { const f = BrowserWindow.getFocusedWindow(); return f ? f.getTitle() : null })
  const titles = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(w => w.getTitle()))
  console.log('titles', JSON.stringify(titles), 'focused', JSON.stringify(focused))
  console.log('state', JSON.stringify(await viz.evaluate(() => window.vizState())))
  const count = (await viz.evaluate(() => window.vizState())).modes.length
  for (let m = 0; m < count; m++) {
    const st = await viz.evaluate(() => window.vizState())
    for (let i = 0; i < 6; i++) {
      await viz.screenshot({ path: path.join(out, `${st.mode}-${i}.png`) })
      await sleep(400)
    }
    await viz.mouse.click(100, 100)
    await sleep(1600)
  }
  const pid = await childPid(app)
  try { process.kill(-pid, 'SIGHUP') } catch (e) {}
  await sleep(1500)
  await app.close().catch(() => {})
  console.log('done')
})().catch(e => { console.error(e); process.exit(1) })
