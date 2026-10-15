'use strict'
// Phase 6 live check under scripts/clean-env xvfb-run:
//   node scripts/checks/p6.js OUT [codex args...]
// Runs codex in a non-bypass sandbox and approval mode, one small
// tool-free prompt, and prints the bus before and after.
const { launch, probe, childPid, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const extra = process.argv.slice(3)
fs.mkdirSync(out, { recursive: true })
const snap = async app => (await probe(app)).snapshot

;(async () => {
  const args = extra.length ? extra : ['-s', 'read-only', '-a', 'on-request']
  const { app, win } = await launch(['codex', ...args], { appArgs: ['--skin', 'phosphor'], env: { SKINNED_GL: 'swiftshader' } })
  await sleep(10000)
  await shot(win, path.join(out, 'codex-start.png'))
  // Codex asks once per folder whether to trust it. Accept, as a user would.
  const screen = await win.evaluate(() => window.skinnedPage().panes.find(p => p.shown).lines.join('\n'))
  if (screen.includes('Trust this folder?')) {
    console.log('trust prompt: accepting')
    await win.keyboard.press('Enter')
    await sleep(8000)
    await shot(win, path.join(out, 'codex-trusted.png'))
  }
  const a = await snap(app)
  if (!extra.length || process.env.P6_TYPE) {
    await win.keyboard.type('Reply with the single word pong and nothing else.')
    await sleep(500)
    await win.keyboard.press('Enter')
  }
  await sleep(35000)
  await shot(win, path.join(out, 'codex-after.png'))
  const b = await snap(app)
  console.log('rollout', JSON.stringify((await probe(app)).following.channels.find(c => c.name === 'rollout')))
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    console.log(`${JSON.stringify(a[k]) !== JSON.stringify(b[k]) ? '*' : ' '} ${k.padEnd(24)} ${JSON.stringify(a[k])} -> ${JSON.stringify(b[k])}`)
  }
  const pid = await childPid(app)
  console.log('codex pid', pid)
  try { process.kill(-pid, 'SIGHUP') } catch (e) { console.log('kill', e.code) }
  await sleep(3000)
  await app.close().catch(() => {})
  console.log('done')
})().catch(e => { console.error(e); process.exit(1) })
