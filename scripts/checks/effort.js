'use strict'
// Live check of the effort widget with the replay fake. Run under
// scripts/clean-env xvfb-run -a -s "-screen 0 1920x1080x24":
//   node scripts/checks/effort.js OUT
// In every shipped skin the widget names the fake's effort level, a
// click on its raise button raises the level by one, as Shift+Up does
// in Claude Code, and a click on its lower button lowers it back, as
// Shift+Down does. Each button shows the hand, and the widget lies
// clear of the terminal and of every other widget shown. Writes
// OUT/<skin>-effort.png. The fake is ended by its recorded pid.
const { launch, probe, childPid, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const fakes = path.join(__dirname, '..', 'fake')
const SKINS = fs.readdirSync(path.join(__dirname, '..', '..', 'skins')).filter(d => fs.existsSync(path.join(__dirname, '..', '..', 'skins', d, 'skin.json'))).sort()
const LEVELS = ['low', 'medium', 'high', 'xhigh', 'max']

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

const page = win => win.evaluate(() => window.skinnedPage())
const widget = p => p.widgets.find(w => w.type === 'effort')
const center = b => [b.x + b.width / 2, b.y + b.height / 2]
const meets = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

async function until (fn, ms, step = 250) {
  for (let t = 0; t < ms; t += step) {
    const v = await fn()
    if (v) return v
    await sleep(step)
  }
  return fn()
}

async function shown (win, want) {
  return until(async () => {
    const p = await page(win)
    const w = widget(p)
    return w && w.text === want && !w.classes.includes('nodata') && p.metrics['effort.name'] === want && p
  }, 10000)
}

let launched = null
;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const env = { SKINNED_GL: 'swiftshader', FAKE_CLAUDE_PAUSE: path.join(out, 'pause'), PATH: `${fakes}:${process.env.PATH}` }
  fs.writeFileSync(env.FAKE_CLAUDE_PAUSE, '')
  for (const [k, d] of [['XDG_RUNTIME_DIR', path.join(out, 'run')], ['XDG_STATE_HOME', path.join(out, 'state')], ['HOME', path.join(out, 'home')], ['CLAUDE_CONFIG_DIR', path.join(out, 'config')]]) {
    env[k] = d
    fs.mkdirSync(d, { recursive: true, mode: 0o700 })
  }
  const { app, win } = launched = await launch(['claude'], { appArgs: ['--skin', SKINS[0], '--no-viz'], env })
  await sleep(3000)
  const pid = await childPid(app)
  for (const skin of SKINS) {
    await win.evaluate(id => window.skinned.selectSkin(id), skin)
    let p = await until(async () => { const q = await page(win); const w = widget(q); return w && w.text !== '--' && q }, 15000)
    check(p, `${skin}: want an effort widget naming a level within 15 s`)
    let w = widget(p)
    const at = LEVELS.indexOf(w.text)
    check(at >= 0 && at < LEVELS.length - 1, `${skin}: want a level below max, got ${w.text}`)
    const hits = p.widgets.filter(o => o !== w && o.visible && o.box.width && meets(w.box, o.box)).map(o => o.id)
    console.log(skin, 'widget', JSON.stringify({ text: w.text, box: w.box, buttons: w.buttons, term: p.term, hits }))
    await shot(win, path.join(out, `${skin}-effort.png`))
    check(w.visible && !meets(w.box, p.term) && hits.length === 0, `${skin}: want the widget shown clear of the terminal and of ${hits.join(', ')}`)
    const btn = dir => w.buttons.find(b => b.dir === dir)
    check(btn('up') && btn('down') && w.buttons.every(b => b.cursor === 'pointer' && b.box.width > 0), `${skin}: want two buttons that show the hand`)

    await win.mouse.click(...center(btn('up').box))
    p = await shown(win, LEVELS[at + 1])
    check(p, `${skin}: want ${LEVELS[at + 1]} after a click on the raise button, as Shift+Up`)
    w = widget(p)
    console.log(skin, 'raised', w.text, p.metrics['effort.level'])
    await win.mouse.click(...center(btn('down').box))
    p = await shown(win, LEVELS[at])
    check(p, `${skin}: want ${LEVELS[at]} again after a click on the lower button, as Shift+Down`)
    console.log(skin, 'lowered', widget(p).text, p.metrics['effort.level'])
  }
  console.log('child', pid)
  try { process.kill(-pid, 'SIGHUP') } catch (e) { console.log('kill', e.code) }
  await sleep(2000)
  await app.close().catch(() => {})
  launched = null
})().then(() => console.log('done'), async e => {
  console.error(e)
  process.exitCode = 1
  if (!launched) return
  for (const x of (await probe(launched.app).catch(() => ({ tabs: [] }))).tabs) if (x.childPid) try { process.kill(-x.childPid, 'SIGHUP') } catch (err) {}
  await launched.app.close().catch(() => {})
})
