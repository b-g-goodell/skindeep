'use strict'
// Live check of the viz's sound output input (decision 0015) under
// xvfb-run:
//   node scripts/checks/vizsound.js OUT
// The fake parec of scripts/fake comes first on PATH, so no real sound
// is recorded. Sound output: every pane takes the samples and its
// caption says so, the recorder runs as the app's child. Session: the
// recorder ends. Both recorders failing: the caption says none.
const { launch, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const fakes = path.join(__dirname, '..', 'fake')
fs.mkdirSync(out, { recursive: true })

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

// The recorders among the app's children, by /proc.
function recorders (pid) {
  const out = []
  for (const d of fs.readdirSync('/proc').filter(d => /^\d+$/.test(d))) {
    try {
      const stat = fs.readFileSync(`/proc/${d}/stat`, 'utf8')
      const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1])
      const cmd = fs.readFileSync(`/proc/${d}/cmdline`, 'utf8').split('\0')
      if (ppid === pid && cmd.some(w => /\/fake\/(parec|pw-record)$/.test(w))) out.push(Number(d))
    } catch (e) {}
  }
  return out
}

async function run (fail) {
  const env = { SKINNED_GL: 'swiftshader', PATH: `${fakes}:${process.env.PATH}` }
  if (fail) env.SKINNED_FAKE_PAREC = 'fail'
  const { app, win, pids } = await launch([path.join(fakes, 'claude')], { appArgs: ['--skin', 'deck'], env })
  let viz = null
  for (let i = 0; i < 40 && !viz; i++) {
    await sleep(250)
    for (const w of app.windows()) if (w.url().includes('/viz/')) viz = w
  }
  check(viz, 'no viz window')
  const state = () => viz.evaluate(() => window.vizState())
  const caption = () => viz.evaluate(() => [...document.querySelectorAll('.pane .mode')].map(e => e.textContent))
  await win.evaluate(() => window.skinned.newTab())
  await sleep(1500)
  const r = await win.evaluate(() => window.skinned.selectVizInput('sound'))
  check(r.ok, 'the menu refused the sound output')
  await sleep(1500)
  const s = await state()
  const c = await caption()
  console.log(fail ? 'failing' : 'sound', JSON.stringify(s.sound), JSON.stringify(c))
  const menu = await win.evaluate(() => window.skinned.vizState())
  check(menu.inputs.find(m => m.current).id === 'sound', 'the menu does not mark the sound output')
  if (fail) {
    check(s.sound.st === 2 && c.every(t => /\[sound output: none/.test(t)), 'want every caption to say no sound output')
  } else {
    const kids = recorders(pids.electron)
    console.log('recorders', JSON.stringify(kids))
    check(s.sound.src === 1 && s.sound.st === 1 && s.sound.peak > 0.05, 'want live samples')
    check(c.length === 2 && c.every(t => /\[sound output\]/.test(t)), 'want both captions to name the sound output')
    check(kids.length === 1, 'want one recorder, the app\'s child')
    await viz.screenshot({ path: path.join(out, 'sound.png') })
    await win.evaluate(() => window.skinned.selectVizInput('both'))
    await sleep(1000)
    check((await state()).sound.src === 2 && recorders(pids.electron).length === 1, 'want both inputs on one recorder')
    await viz.screenshot({ path: path.join(out, 'both.png') })
    await win.evaluate(() => window.skinned.selectVizInput('session'))
    await sleep(1000)
    check((await state()).sound.src === 0 && recorders(pids.electron).length === 0, 'want the recorder ended on the sessions input')
    check((await caption()).every(t => !/\[/.test(t)), 'want plain captions on the sessions input')
    await win.evaluate(() => window.skinned.selectVizInput('sound'))
    await sleep(1000)
    check(recorders(pids.electron).length === 1, 'want a recorder again')
    await win.evaluate(() => window.skinned.toggleViz())
    await sleep(1000)
    check(recorders(pids.electron).length === 0, 'want the recorder ended with the window')
  }
  for (const tab of (await win.evaluate(() => window.skinned.tabs())).tabs) await win.evaluate(id => window.skinned.closeTab(id), tab.id)
  await sleep(2000)
  await app.close().catch(() => {})
}

;(async () => {
  await run(false)
  await run(true)
  console.log('done')
})().catch(e => { console.error(e); process.exit(1) })
