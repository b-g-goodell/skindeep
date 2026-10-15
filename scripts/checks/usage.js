'use strict'
// The usage limits on a real Claude Code session. Spends one short
// prompt of the profile's quota. Run under xvfb-run:
//   CLAUDE_CONFIG_DIR=<profile> node scripts/checks/usage.js OUT
// After the reply, the bus's limits and their resets, and a screenshot
// of each shipped skin, switched from the menu.
const { launch, openMenu, probe, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
fs.mkdirSync(out, { recursive: true })
const SKINS = ['deck', 'phosphor', 'coffee', 'library']

;(async () => {
  const { app, win } = await launch(['claude', '--permission-mode', 'default'], { appArgs: ['--skin', 'deck', '--no-viz'], env: { SKINNED_GL: 'swiftshader' } })
  try {
    await sleep(9000)
    await win.keyboard.type('Reply with the single word pong and nothing else.')
    await win.keyboard.press('Enter')
    await sleep(30000)
    const snap = (await probe(app)).snapshot
    const limits = Object.fromEntries(Object.entries(snap).filter(([k]) => k.startsWith('limits.')))
    console.log('limits', JSON.stringify(limits))
    fs.writeFileSync(path.join(out, 'limits.json'), JSON.stringify(limits, null, 1) + '\n')
    for (const s of SKINS) {
      await openMenu(win)
      await win.locator('#menu .item').filter({ hasText: new RegExp(`^[* ]\\s*${s}$`) }).first().click({ timeout: 5000 })
      await sleep(2500)
      await shot(win, path.join(out, `${s}.png`))
    }
  } finally {
    try { process.kill(-(await probe(app)).childPid, 'SIGHUP') } catch (e) {}
    await sleep(3000)
    await app.close().catch(() => {})
  }
  console.log('done')
})().catch(e => { console.error(e); process.exit(1) })
