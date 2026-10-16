'use strict'
// Each skin in a quarter of a 1920 x 1080 screen, with one tab and two,
// and at its minimum size (decision 0006). Run under xvfb-run:
//   node scripts/checks/quarter.js OUT
// Writes OUT/<skin>-quarter.png, OUT/<skin>-tabs.png and
// OUT/<skin>-floor.png to look at. Xvfb has no window manager, so the
// tile's content size is the one GNOME leaves: half the 1048 px work
// area less the 37 px title bar, beside test/skin-scale.test.js.
const { launch, childPid, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
fs.mkdirSync(out, { recursive: true })
const root = path.join(__dirname, '..', '..')
const claudeFake = path.join(root, 'scripts', 'fake', 'claude')
const SKINS = ['deck', 'phosphor', 'coffee', 'library']
const TILE = [960, 1048 / 2 - 37]

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
  const stage = document.getElementById('stage').getBoundingClientRect()
  const term = document.getElementById('term').getBoundingClientRect()
  const menu = document.getElementById('menu-button').getBoundingClientRect()
  return { scale: p.scale, cols: t.cols, rows: t.rows, stage: [stage.width, stage.height], term: term.bottom, menu: menu.bottom, height: innerHeight, tabs: !document.getElementById('tabs').hidden }
})

async function one (skin) {
  const sw = JSON.parse(fs.readFileSync(path.join(root, 'skins', skin, 'skin.json'), 'utf8')).window
  const { app, win } = await launch([claudeFake], { appArgs: ['--skin', skin, '--no-viz'], env: { SKINNED_GL: 'swiftshader' } })
  await sleep(2500)
  const seen = {}
  const want = s => Math.min(1, s.stage[0] / sw.minWidth, s.stage[1] / (sw.minHeight - 22))
  // The page rescales after the window and its stage take their new
  // size, later under load: wait up to 10 s for the size asked and the
  // scale its stage asks, so a fixed wait never reads the size before.
  const look = async tag => {
    for (let i = 0; i < 100; i++) {
      await sleep(100)
      seen[tag] = { ...(await size(app)), ...(await page(win)) }
      const v = seen[tag]
      const to = tag === 'floor' ? v.min : TILE
      v.waited = (i + 1) * 100
      if (v.content[0] === to[0] && v.content[1] === to[1] && v.height === v.content[1] && (tag === 'quarter' || v.tabs) && Math.abs(v.scale - want(v)) < 1e-6) break
    }
    await shot(win, path.join(out, `${skin}-${tag}.png`))
  }
  await resize(app, ...TILE)
  await look('quarter')
  await win.keyboard.press('Control+Shift+T')
  await sleep(1500)
  await look('tabs')
  await resize(app, 0, 0)
  await look('floor')
  try { process.kill(-(await childPid(app)), 'SIGHUP') } catch (e) {}
  await sleep(1500)
  await app.close().catch(() => {})
  console.log(skin, JSON.stringify(seen))
  for (const [tag, s] of Object.entries(seen)) {
    const at = `${skin} ${tag}`
    if (tag !== 'floor') {
      check(s.min[0] <= TILE[0] && s.min[1] <= TILE[1], `${at}: minimum ${s.min} exceeds the tile ${TILE}`)
      check(s.content[0] === TILE[0] && s.content[1] === TILE[1], `${at}: the window did not take the tile, ${s.content}`)
    } else {
      check(s.content[0] === s.min[0] && s.content[1] === s.min[1], `${at}: the window is not at its minimum, ${s.content} for ${s.min}`)
    }
    const k = want(s)
    check(Math.abs(s.scale - k) < 1e-6, `${at}: scale ${s.scale}, want ${k}`)
    check(s.term <= s.height && s.menu <= s.height, `${at}: the terminal or menu runs past the window's bottom`)
    check(s.cols >= 40 && s.rows >= 10, `${at}: ${s.cols} x ${s.rows} cells, want 40 x 10`)
  }
  check(seen.tabs.tabs && seen.floor.tabs, `${skin}: want the tab strip with two tabs`)
  check(seen.quarter.scale < 1 && seen.tabs.scale < seen.quarter.scale, `${skin}: want the tile scaled, and further with the tab strip`)
}

;(async () => {
  for (const s of SKINS) await one(s)
  console.log('done')
})().catch(e => { console.error(e); process.exit(1) })
