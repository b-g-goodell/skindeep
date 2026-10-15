'use strict'
// The menu with many live agent sessions. Run under xvfb-run:
//   node scripts/checks/menufit.js OUT
// Thirty idle processes named claude stand for live sessions. In a
// window at the skin's minimum size every entry is in reach, and while
// the menu is open, sessions that start and end move no entry below the
// list. The processes are killed by their recorded pids.
const { launch, openMenu, shot, sleep } = require('../drive.js')
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const idle = path.join(out, 'idle')
fs.mkdirSync(idle, { recursive: true })
fs.writeFileSync(path.join(idle, 'claude'), 'setInterval(() => {}, 1e9)\n')
const root = path.join(__dirname, '..', '..')
const fake = path.join(root, 'scripts', 'fake', 'claude')
const pids = []

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

function start (n) {
  for (let i = 0; i < n; i++) {
    const p = spawn(process.execPath, [path.join(idle, 'claude')], { cwd: idle, stdio: 'ignore', detached: true })
    p.unref()
    pids.push(p.pid)
  }
}

const boxes = win => win.evaluate(() => {
  const list = document.querySelector('#menu .sessions')
  const after = [...document.querySelectorAll('#menu > .item, #menu > hr')].filter(e => list.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING)
  return after.map(e => { const r = e.getBoundingClientRect(); return [e.textContent.slice(0, 24), Math.round(r.top)] })
})

;(async () => {
  start(30)
  const { app, win } = await launch([fake], { appArgs: ['--skin', 'deck', '--no-viz'], env: { SKINNED_GL: 'swiftshader' } })
  try {
    await sleep(3000)
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setContentSize(1200, 640) })
    await sleep(800)
    await openMenu(win)
    const fit = await win.evaluate(() => {
      const m = document.getElementById('menu').getBoundingClientRect()
      const list = document.querySelector('#menu .sessions')
      return { menuBottom: Math.round(m.bottom), height: innerHeight, rows: list.querySelectorAll('.session').length, scrolls: list.scrollHeight > list.clientHeight }
    })
    console.log('fit', JSON.stringify(fit))
    await shot(win, path.join(out, 'menu-640.png'))
    check(fit.menuBottom <= fit.height && fit.rows >= 30 && fit.scrolls, 'want the menu inside the window and the sessions list scrolling')

    // Sessions start and end under the open menu.
    const before = await boxes(win)
    start(3)
    const gone = pids.splice(0, 2)
    for (const pid of gone) process.kill(pid, 'SIGTERM')
    await sleep(4500)
    const after = await boxes(win)
    const ended = await win.evaluate(g => g.map(pid => { const el = [...document.querySelectorAll('#menu .session')].find(e => e.dataset.key.startsWith(pid + ':')); return el ? el.classList.contains('ended') : null }), gone)
    console.log('entries before', JSON.stringify(before.slice(0, 3)), 'after', JSON.stringify(after.slice(0, 3)), 'ended', JSON.stringify(ended))
    check(JSON.stringify(before) === JSON.stringify(after), 'an entry below the sessions list moved')
    check(ended.every(x => x === true), 'want the two ended sessions marked ended in their places')

    // The last entries: Housekeeping's last, and the font size flyout's last.
    await win.locator('#menu .item').filter({ hasText: /^Forget remembered skin$/ }).click({ timeout: 5000 })
    await sleep(500)
    const note = await win.evaluate(() => { const n = document.querySelector('#menu .note'); return n && n.textContent })
    check(note && note.startsWith('Forgotten'), 'want Forget remembered skin reached')
    await win.keyboard.press('Escape')
    await openMenu(win)
    await win.locator('#menu .submenu', { hasText: 'Terminal font size' }).hover({ timeout: 5000 })
    await sleep(300)
    await win.locator('#menu .submenu .sub .item').filter({ hasText: /32 px$/ }).click({ timeout: 5000 })
    await sleep(800)
    const size = await win.evaluate(() => window.skinnedPage().panes[0].fontSize)
    console.log('font after the last size', size)
    check(size === 32, 'want the last font size reached')
    console.log('done')
  } finally {
    for (const pid of pids) try { process.kill(pid, 'SIGTERM') } catch (e) {}
    try { process.kill(-(await app.evaluate(() => global.skinnedProbe().childPid)), 'SIGHUP') } catch (e) {}
    await sleep(1500)
    await app.close().catch(() => {})
  }
})().catch(e => { console.error(e); process.exit(1) })
