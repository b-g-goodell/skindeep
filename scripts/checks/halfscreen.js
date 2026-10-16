'use strict'
// Each skin in half a 1920 px screen and at its minimum width (decision 0006),
// every widget inside the window at both. Run under xvfb-run:
//   node scripts/checks/halfscreen.js OUT
// Writes OUT/<skin>-960.png and OUT/<skin>-floor.png to look at.
const { launch, childPid, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
fs.mkdirSync(out, { recursive: true })
const root = path.join(__dirname, '..', '..')
const claudeFake = path.join(root, 'scripts', 'fake', 'claude')
const SKINS = ['deck', 'phosphor', 'coffee', 'library']

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

const resize = (app, w, h) => app.evaluate(({ BrowserWindow }, [w, h]) => {
  BrowserWindow.getAllWindows().find(x => !x.getTitle().startsWith('visualization')).setContentSize(w, h)
}, [w, h])
const size = app => app.evaluate(({ BrowserWindow }) => {
  const x = BrowserWindow.getAllWindows().find(x => !x.getTitle().startsWith('visualization'))
  return { content: x.getContentSize(), min: x.getMinimumSize() }
})
const page = win => win.evaluate(() => {
  const p = window.skinnedPage()
  const t = p.panes.find(x => x.shown) || p.panes[0]
  const term = document.getElementById('term').getBoundingClientRect()
  const menu = document.getElementById('menu-button').getBoundingClientRect()
  // The widgets whose box leaves the window, by id.
  const out = p.widgets.filter(w => w.visible && w.box.width > 0 && (w.box.x < -0.5 || w.box.y < -0.5 || w.box.x + w.box.width > innerWidth + 0.5 || w.box.y + w.box.height > innerHeight + 0.5)).map(w => w.id)
  return { scale: p.scale, area: p.area, laid: p.laid, cols: t.cols, rows: t.rows, term: [term.left, term.right], menu: [menu.left, menu.right, menu.width, menu.height], width: innerWidth, out }
})

async function one (skin) {
  const { app, win } = await launch([claudeFake], { appArgs: ['--skin', skin, '--no-viz'], env: { SKINNED_GL: 'swiftshader' } })
  await sleep(2500)
  const seen = {}
  for (const [tag, w] of [['960', 960], ['floor', 0]]) {
    await resize(app, w, 1016)
    // The renderer takes the new size, and the skin is laid out at it,
    // bounded: under load a fixed wait read the layout of the old size.
    let s, p
    for (const t0 = Date.now(); Date.now() - t0 < 15000; await sleep(200)) {
      s = await size(app)
      p = await page(win)
      if (p.width === s.content[0] && p.laid && p.laid.join() === p.area.join()) break
    }
    await sleep(300)
    p = await page(win)
    seen[tag] = { ...s, ...p }
    await shot(win, path.join(out, `${skin}-${tag}.png`))
  }
  try { process.kill(-(await childPid(app)), 'SIGHUP') } catch (e) {}
  await sleep(1500)
  await app.close().catch(() => {})
  console.log(skin, JSON.stringify(seen))
  const a = seen['960']
  const b = seen.floor
  check(a.min[0] <= 960, `${skin}: minimum width ${a.min[0]} exceeds half a 1920 px screen`)
  check(a.content[0] === 960, `${skin}: the window did not take 960 px, ${a.content[0]}`)
  check(a.term[1] <= a.width && a.menu[1] <= a.width, `${skin}: the terminal or menu runs past the window at 960`)
  check(!a.out.length && !b.out.length, `${skin}: widgets leave the window: ${a.out} at 960, ${b.out} at the floor`)
  check(a.cols >= 40 && b.cols >= 40, `${skin}: want 40 columns at 960 and at the floor, saw ${a.cols} and ${b.cols}`)
  check(b.content[0] === b.min[0] && b.scale < a.scale && a.scale < 1, `${skin}: want the floor smaller and scaled further than 960`)
}

;(async () => {
  for (const s of SKINS) await one(s)
  console.log('done')
})().catch(e => { console.error(e); process.exit(1) })
