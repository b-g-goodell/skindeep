'use strict'
// The four menus (decision 0022) in each shipped skin, at the skin's
// initial size and in a quarter of a 1920 x 1080 screen (decision 0006).
// Run under xvfb-run:
//   node scripts/checks/menus.js OUT
// Each menu is opened from the skin's button and the bar, its entries
// read and compared with the list it must hold, its drop-down and its
// flyouts kept inside the window. Writes OUT/<skin>-<size>-<menu>.png
// and OUT/<skin>-<size>-flyout.png to look at.
const { launch, childPid, openMenu, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
fs.mkdirSync(out, { recursive: true })
const root = path.join(__dirname, '..', '..')
const fake = path.join(root, 'scripts', 'fake', 'claude')
const SKINS = ['deck', 'phosphor', 'coffee', 'library']
const TILE = [960, 1048 / 2 - 37]
const MENUS = ['File', 'Agents', 'Skins', 'Visualization']

// The entries each menu holds, headings and flyout rows included, in
// order. Skins lists the shipped skins after its heading.
const WANT = {
  File: ['New tab', 'New tab...', 'Close tab', 'Reopen closed tab', 'Duplicate tab', 'Next tab', 'Previous tab',
    'Settings', 'Terminal font size', 'Skin text size', 'Window text size', 'Visualization text size', 'Visualization frame rate', 'Gravity 3D sharpness', 'Reset panel sizes', 'Housekeeping', 'Forget remembered skin', 'Open log folder', 'Clear logs'],
  Agents: ['Agent sessions', 'Sessions dashboard'],
  Skins: ['Open skin...', 'Skins', ...fs.readdirSync(path.join(root, 'skins')).filter(n => fs.existsSync(path.join(root, 'skins', n, 'skin.json'))).sort()],
  Visualization: ['Hide visualization', 'Visualization mode', 'Visualization input', 'Mute skin sounds']
}

const bad = []
function check (ok, msg) {
  if (!ok) bad.push(msg)
}

// What the drop-down shows: the bar, its entries' own text without
// marks, shortcuts, the reopen note or a skin's folder, and its box.
const look = win => win.evaluate(() => {
  const m = document.getElementById('menu')
  const r = m.getBoundingClientRect()
  return {
    open: !m.hidden,
    bar: [...m.querySelectorAll('.bar .title')].map(e => e.textContent),
    current: [...m.querySelectorAll('.bar .title.current')].map(e => e.textContent),
    entries: [...m.children].filter(e => e.classList.contains('item') && !e.classList.contains('problem'))
      .map(e => e.firstChild.textContent.replace(/^[* ] /, '').replace(/ \(new session\)$/, '')),
    sessions: !!m.querySelector('.sessions'),
    box: [r.left, r.top, r.right, r.bottom].map(Math.round),
    win: [innerWidth, innerHeight]
  }
})

const inside = (b, w) => b[0] >= 0 && b[1] >= 0 && b[2] <= w[0] && b[3] <= w[1]

async function sizeTo (app, win, w, h) {
  await app.evaluate(({ BrowserWindow }, [w, h]) => {
    BrowserWindow.getAllWindows().find(x => !x.getTitle().startsWith('visualization')).setContentSize(w, h)
  }, [w, h])
  for (let i = 0; i < 100 && (await win.evaluate(() => [innerWidth, innerHeight])).join() !== [w, h].join(); i++) await sleep(100)
  await sleep(800)
}

async function pass (win, skin, tag) {
  for (const name of MENUS) {
    await openMenu(win, name)
    const v = await look(win)
    const at = `${skin} ${tag} ${name}`
    console.log(at, JSON.stringify({ current: v.current, entries: v.entries, box: v.box, win: v.win }))
    check(v.open, `${at}: the menu did not open`)
    check(v.bar.join() === MENUS.join(), `${at}: bar ${JSON.stringify(v.bar)}`)
    check(v.current.join() === name, `${at}: the bar marks ${JSON.stringify(v.current)}`)
    check(v.entries.join('|') === WANT[name].join('|'), `${at}: entries ${JSON.stringify(v.entries)}, want ${JSON.stringify(WANT[name])}`)
    check(v.sessions === (name === 'Agents'), `${at}: the sessions list belongs to Agents alone`)
    check(inside(v.box, v.win), `${at}: the drop-down ${v.box} leaves the window ${v.win}`)
    await shot(win, path.join(out, `${skin}-${tag}-${name.toLowerCase()}.png`))
    await win.keyboard.press('Escape')
    await sleep(200)
  }
  // The flyout of the visualization's modes stays inside the window.
  await openMenu(win, 'Visualization')
  await win.locator('#menu .submenu', { hasText: 'Visualization mode' }).hover()
  await sleep(300)
  const sub = await win.evaluate(() => {
    const s = [...document.querySelectorAll('#menu .submenu')].find(e => e.firstChild.textContent === 'Visualization mode').querySelector('.sub')
    const r = s.getBoundingClientRect()
    return { box: [r.left, r.top, r.right, r.bottom].map(Math.round), win: [innerWidth, innerHeight], shown: r.width > 0 }
  })
  check(sub.shown && inside(sub.box, sub.win), `${skin} ${tag}: the modes flyout ${sub.box} leaves the window ${sub.win}`)
  await shot(win, path.join(out, `${skin}-${tag}-flyout.png`))
  await win.keyboard.press('Escape')
  // Left and Right step through the bar, wrapping.
  await openMenu(win)
  const seen = []
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowRight']) {
    await win.keyboard.press(key)
    await sleep(300)
    seen.push((await look(win)).current.join())
  }
  check(seen.join() === 'Visualization,File,Agents', `${skin} ${tag}: arrows gave ${seen}`)
  await win.keyboard.press('Escape')
  await sleep(200)
}

async function one (skin) {
  const { app, win } = await launch([fake], { appArgs: ['--skin', skin], env: { SKINNED_GL: 'swiftshader' } })
  try {
    await sleep(3000)
    const sw = JSON.parse(fs.readFileSync(path.join(root, 'skins', skin, 'skin.json'), 'utf8')).window
    await sizeTo(app, win, sw.width, sw.height)
    await pass(win, skin, 'full')
    await sizeTo(app, win, ...TILE)
    await pass(win, skin, 'quarter')
  } finally {
    try { process.kill(-(await childPid(app)), 'SIGHUP') } catch (e) {}
    await sleep(1500)
    await app.close().catch(() => {})
  }
}

;(async () => {
  for (const skin of SKINS) await one(skin)
  if (bad.length) {
    for (const b of bad) console.error('FAIL', b)
    process.exit(1)
  }
  console.log('done: four menus in', SKINS.length, 'skins at two sizes')
})().catch(e => { console.error(e); process.exit(1) })
