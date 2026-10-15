'use strict'
// The Settings section of the menu. Run under xvfb-run:
//   node scripts/checks/settings.js OUT
// A font size picked from the menu reaches every tab at once, survives
// a skin switch and a relaunch, and Skin default returns to the
// manifest's size.
const { launch, childPid, openMenu, probe, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const state = path.join(out, 'state')
fs.mkdirSync(state, { recursive: true })
const root = path.join(__dirname, '..', '..')
const claudeFake = path.join(root, 'scripts', 'fake', 'claude')
const env = { SKINNED_GL: 'swiftshader', XDG_STATE_HOME: state }

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

const terms = win => win.evaluate(() => window.skinnedPage().panes.filter(p => !p.dashboard).map(p => ({ fontSize: p.fontSize, cols: p.cols })))
const manifest = name => JSON.parse(fs.readFileSync(path.join(root, 'skins', name, 'skin.json'), 'utf8')).terminal.fontSize

async function pick (win, label) {
  await openMenu(win)
  await win.locator('#menu .submenu', { hasText: 'Terminal font size' }).hover()
  await sleep(200)
  await win.locator('#menu .submenu .sub .item', { hasText: label }).click()
  await sleep(800)
}

async function end (app) {
  try { process.kill(-(await childPid(app)), 'SIGHUP') } catch (e) {}
  for (const t of (await probe(app)).tabs) try { process.kill(-t.childPid, 'SIGHUP') } catch (e) {}
  await sleep(1500)
  await app.close().catch(() => {})
}

;(async () => {
  let { app, win } = await launch([claudeFake], { appArgs: ['--skin', 'deck', '--no-viz'], env })
  await sleep(2500)
  await win.keyboard.press('Control+Shift+T')
  await sleep(1500)
  const before = await terms(win)
  await openMenu(win)
  const rows = await win.evaluate(() => [...document.querySelectorAll('#menu .submenu')].map(e => e.firstChild.textContent))
  const choices = await win.evaluate(() => [...document.querySelectorAll('#menu .submenu')].find(e => e.firstChild.textContent === 'Terminal font size').querySelectorAll('.sub .item').length)
  await win.keyboard.press('Escape')
  await pick(win, '20 px')
  const after = await terms(win)
  await shot(win, path.join(out, 'deck-20.png'))
  console.log('rows', JSON.stringify(rows), 'choices', choices, 'before', JSON.stringify(before), 'after 20', JSON.stringify(after))
  check(rows.includes('Terminal font size') && choices === 19, 'want a Terminal font size flyout of the skin default and 18 sizes')
  check(before.length === 2 && before.every(t => t.fontSize === manifest('deck')), 'want both tabs at deck\'s own size first')
  check(after.length === 2 && after.every((t, i) => t.fontSize === 20 && t.cols < before[i].cols), 'want both tabs at 20 px with fewer columns')

  await openMenu(win)
  await win.locator('#menu .item', { hasText: 'phosphor' }).click()
  await sleep(1500)
  const switched = await terms(win)
  console.log('after phosphor', JSON.stringify(switched))
  check(switched.every(t => t.fontSize === 20), 'want 20 px to survive the switch to phosphor')
  await end(app)

  const saved = JSON.parse(fs.readFileSync(path.join(state, 'claude-skins', 'settings.json'), 'utf8'))
  console.log('saved', JSON.stringify(saved))
  check(saved['terminal.fontSize'] === 20, 'want 20 saved')

  ;({ app, win } = await launch([claudeFake], { appArgs: ['--skin', 'phosphor', '--no-viz'], env }))
  await sleep(2500)
  const relaunched = await terms(win)
  await pick(win, 'Skin default')
  const reset = await terms(win)
  await shot(win, path.join(out, 'phosphor-default.png'))
  console.log('relaunched', JSON.stringify(relaunched), 'skin default', JSON.stringify(reset))
  check(relaunched.every(t => t.fontSize === 20), 'want 20 px after a relaunch')
  check(reset.every(t => t.fontSize === manifest('phosphor')), 'want phosphor\'s own size after Skin default')
  await end(app)
  const cleared = JSON.parse(fs.readFileSync(path.join(state, 'claude-skins', 'settings.json'), 'utf8'))
  check(cleared['terminal.fontSize'] === null, 'want the skin default saved as null')
  console.log('done')
})().catch(e => { console.error(e); process.exit(1) })
