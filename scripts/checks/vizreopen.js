'use strict'
// The visualization window closed and opened again, and its modes
// stepped, on the current build and across a change on disk.
// Run under xvfb-run:
//   node scripts/checks/vizreopen.js OUT rounds|build
// rounds: three rounds of Hide and Show from the menu, each reopened
// window showing the panes and modes it showed before, and a mode step
// by click, space and menu shown at once, with no page or console error.
// build: a copy of the app tree, whose viz page is made to throw on disk
// after launch. The reopened window must still draw, from the launch's
// build. The copy is removed on exit.
const { launch, openMenu, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const what = process.argv[3]
fs.mkdirSync(out, { recursive: true })
const root = path.join(__dirname, '..', '..')
const fake = path.join(root, 'scripts', 'fake', 'claude')
const env = { SKINNED_GL: 'swiftshader' }

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

// The viz window, its errors collected from its first load.
async function vizWindow (app, errors) {
  for (let i = 0; i < 40; i++) {
    for (const w of app.windows()) {
      if (!w.url().includes('/viz/') || w.isClosed()) continue
      if (!w.__watched) {
        w.__watched = true
        w.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
        w.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
      }
      return w
    }
    await sleep(250)
  }
  return null
}

async function menuPick (win, text) {
  await openMenu(win)
  await win.locator('#menu .item').filter({ hasText: new RegExp(`^${text}$`) }).click()
  await sleep(1500)
}

const modes = viz => viz.evaluate(() => window.vizState().panes.map(p => p.mode))

async function rounds () {
  const errors = []
  const { app, win } = await launch([fake], { appArgs: ['--skin', 'deck'], env })
  let viz = await vizWindow(app, errors)
  check(viz, 'no viz window at launch')
  await win.evaluate(() => window.skinned.newTab())
  await sleep(2500)
  let before = await modes(viz)
  check(before.length === 2 && before.every(Boolean), `want two drawn panes, saw ${JSON.stringify(before)}`)
  for (let r = 1; r <= 3; r++) {
    await menuPick(win, 'Hide visualization')
    check(!app.windows().some(w => w.url().includes('/viz/') && !w.isClosed()), `round ${r}: the viz window did not close`)
    await menuPick(win, 'Show visualization')
    viz = await vizWindow(app, errors)
    check(viz, `round ${r}: no viz window after Show`)
    await sleep(1500)
    const again = await modes(viz)
    console.log(`round ${r}`, JSON.stringify(before), '->', JSON.stringify(again))
    check(again.join() === before.join(), `round ${r}: want the panes and modes of before the close`)
    const s = await viz.evaluate(() => window.vizState())
    const p = s.panes[0]
    await viz.mouse.click(p.x + p.w / 2, p.y + p.h / 2)
    await sleep(400)
    const clicked = await modes(viz)
    check(clicked[0] !== again[0] && clicked[1] === again[1], `round ${r}: a click must step the first pane at once`)
    await viz.keyboard.press('Space')
    await sleep(400)
    const spaced = await modes(viz)
    check(spaced[1] !== clicked[1], `round ${r}: space must step the active pane at once`)
    await openMenu(win)
    await win.locator('#menu .submenu', { hasText: 'Visualization mode' }).hover()
    await sleep(200)
    const target = await win.evaluate(r => [...document.querySelectorAll('#menu .submenu')].find(e => e.firstChild.textContent === 'Visualization mode').querySelectorAll('.sub .item:not(.current)')[r].textContent.trim(), r)
    await win.locator('#menu .submenu .sub .item', { hasText: target }).first().click()
    await sleep(400)
    const picked = await viz.evaluate(() => window.vizState())
    const label = await viz.evaluate(() => [...document.querySelectorAll('.pane.active .mode')].map(e => e.textContent).join())
    console.log(`round ${r} steps`, JSON.stringify({ clicked, spaced, picked: picked.mode, target, label }))
    check(picked.mode !== spaced[1], `round ${r}: the menu's pick must show at once`)
    before = await modes(viz)
  }
  await viz.screenshot({ path: path.join(out, 'rounds.png') })
  for (const t of (await win.evaluate(() => window.skinned.tabs())).tabs) await win.evaluate(id => window.skinned.closeTab(id), t.id)
  await sleep(2000)
  await app.close().catch(() => {})
  console.log('errors', JSON.stringify(errors))
  check(!errors.length, 'want no page or console error in any viz window')
}

async function build () {
  const tree = path.join(out, 'tree')
  fs.rmSync(tree, { recursive: true, force: true })
  try {
    fs.mkdirSync(tree, { recursive: true })
    fs.cpSync(path.join(root, 'app'), path.join(tree, 'app'), { recursive: true })
    fs.copyFileSync(path.join(root, 'package.json'), path.join(tree, 'package.json'))
    for (const d of ['node_modules', 'skins']) fs.symlinkSync(path.join(root, d), path.join(tree, d))
    const errors = []
    const { app, win } = await launch([fake], { appArgs: ['--skin', 'deck'], env, root: tree })
    let viz = await vizWindow(app, errors)
    check(viz, 'no viz window at launch')
    await sleep(2000)
    const first = await modes(viz)
    // A newer build lands on disk: its page and its preload throw before
    // they set anything up.
    for (const f of ['viz.js', 'preload.js']) {
      const file = path.join(tree, 'app', 'viz', f)
      fs.writeFileSync(file, `throw new Error('${f} of a later build')\n` + fs.readFileSync(file, 'utf8'))
    }
    await menuPick(win, 'Hide visualization')
    await menuPick(win, 'Show visualization')
    viz = await vizWindow(app, errors)
    check(viz, 'no viz window after Show')
    await sleep(2000)
    const again = await viz.evaluate(() => window.vizState ? window.vizState().panes.map(p => p.mode) : ['no vizState'])
    console.log('build', JSON.stringify({ url: viz.url(), first, again, errors }))
    await viz.screenshot({ path: path.join(out, 'build.png') })
    for (const t of (await win.evaluate(() => window.skinned.tabs())).tabs) await win.evaluate(id => window.skinned.closeTab(id), t.id)
    await sleep(2000)
    await app.close().catch(() => {})
    check(again.join() === first.join() && again.every(Boolean), 'want the reopened window drawing as before')
    check(!errors.length, 'want no error from the files changed on disk')
  } finally {
    fs.rmSync(tree, { recursive: true, force: true })
  }
}

;({ rounds, build })[what]().then(() => console.log('done')).catch(e => { console.error(e); process.exit(1) })
