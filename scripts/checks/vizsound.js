'use strict'
// Live check of the viz's sound output input (decision 0015) under
// xvfb-run:
//   node scripts/checks/vizsound.js OUT
// The fake parec of scripts/fake comes first on PATH, so no real sound
// is recorded. Sound output: every pane takes the samples and its
// caption says so, the recorder runs as the app's child. Session: the
// recorder ends. Both recorders failing: the caption says none.
// Every read waits, bounded, for the state it asserts: the recorder is
// a node process that starts late under host load, and the fake's tone
// fades to silence every 2 s, so one read at a fixed time can land
// before the first sample or in the fade.
const { launch, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const fakes = path.join(__dirname, '..', 'fake')
fs.mkdirSync(out, { recursive: true })

function check (ok, msg, seen) {
  if (!ok) throw new Error(seen === undefined ? msg : `${msg}, saw ${JSON.stringify(seen)}`)
}

// get() once ok(value) holds, else after ms the last value seen, with
// the time waited.
async function until (get, ok, ms, step = 100) {
  const t0 = Date.now()
  let v = await get()
  while (!ok(v) && Date.now() - t0 < ms) {
    await sleep(step)
    v = await get()
  }
  return [v, Date.now() - t0]
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

const NONE = t => /\[sound output: none/.test(t)
const SOUND = t => /\[sound output\]/.test(t)
const PLAIN = t => !/\[/.test(t)

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
  await viz.waitForFunction(() => typeof window.vizState === 'function', null, { timeout: 30000 })
  const state = () => viz.evaluate(() => window.vizState())
  const caption = () => viz.evaluate(() => [...document.querySelectorAll('.pane .mode')].map(e => e.textContent))
  const kids = () => recorders(pids.electron)
  // The page's sound state, its captions and the recorders, at once.
  const look = async () => ({ s: (await state()).sound, c: await caption(), k: kids() })
  await win.evaluate(() => window.skinned.newTab())
  const [two, t2] = await until(caption, c => c.length === 2, 30000)
  console.log('panes', JSON.stringify(two), `${t2} ms`)
  const r = await win.evaluate(() => window.skinned.selectVizInput('sound'))
  check(r.ok, 'the menu refused the sound output')
  const want = fail
    ? v => v.s.st === 2 && v.c.every(NONE)
    : v => v.s.src === 1 && v.s.st === 1 && v.s.peak > 0.05 && v.c.length === 2 && v.c.every(SOUND) && v.k.length === 1
  const [v, t] = await until(look, want, 30000)
  console.log(fail ? 'failing' : 'sound', JSON.stringify(v.s), JSON.stringify(v.c), `${t} ms`)
  const menu = await win.evaluate(() => window.skinned.vizState())
  check(menu.inputs.find(m => m.current).id === 'sound', 'the menu does not mark the sound output')
  if (fail) {
    check(v.s.st === 2 && v.c.every(NONE), 'want every caption to say no sound output', v)
  } else {
    console.log('recorders', JSON.stringify(v.k))
    check(v.s.src === 1 && v.s.st === 1 && v.s.peak > 0.05, 'want live samples', v)
    check(v.c.length === 2 && v.c.every(SOUND), 'want both captions to name the sound output', v)
    check(v.k.length === 1, 'want one recorder, the app\'s child', v)
    await viz.screenshot({ path: path.join(out, 'sound.png') })
    await win.evaluate(() => window.skinned.selectVizInput('both'))
    const [b] = await until(look, b => b.s.src === 2 && b.k.length === 1, 30000)
    check(b.s.src === 2 && b.k.length === 1, 'want both inputs on one recorder', b)
    await viz.screenshot({ path: path.join(out, 'both.png') })
    await win.evaluate(() => window.skinned.selectVizInput('session'))
    const [p] = await until(look, p => p.s.src === 0 && p.k.length === 0 && p.c.every(PLAIN), 30000)
    check(p.s.src === 0 && p.k.length === 0, 'want the recorder ended on the sessions input', p)
    check(p.c.every(PLAIN), 'want plain captions on the sessions input', p)
    await win.evaluate(() => window.skinned.selectVizInput('sound'))
    const [again] = await until(kids, k => k.length === 1, 30000)
    check(again.length === 1, 'want a recorder again', again)
    await win.evaluate(() => window.skinned.toggleViz())
    const [gone] = await until(kids, k => k.length === 0, 30000)
    check(gone.length === 0, 'want the recorder ended with the window', gone)
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
