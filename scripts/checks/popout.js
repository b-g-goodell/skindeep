'use strict'
// A tab dragged out of its window pops out into a new window.
// Run under xvfb-run:
//   node scripts/checks/popout.js OUT
// scripts/fake/keys prints 300 numbered lines and records each tab's
// bytes to OUT/bytes/<pid>.bin. The popped tab keeps its pid, its whole
// scrollback and its viz pane, takes typing in its new window, and the
// app exits with the status of the last tab to end, in any window.
const { launch, probe, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const root = path.join(__dirname, '..', '..')
const keysFake = path.join(root, 'scripts', 'fake', 'keys')
const bytesDir = path.join(out, 'bytes')
fs.mkdirSync(bytesDir, { recursive: true })
const env = { SKINNED_GL: 'swiftshader', SKINNED_CHECK_OUT: bytesDir }

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

const alive = pid => { try { process.kill(pid, 0); return true } catch (e) { return false } }
const bytes = pid => { const f = path.join(bytesDir, `${pid}.bin`); return fs.existsSync(f) ? fs.readFileSync(f, 'latin1') : '' }
const page = w => w.evaluate(() => window.skinnedPage())
const trim = lines => { const l = lines.slice(); while (l.length && !l[l.length - 1].trim()) l.pop(); return l }
const mains = app => app.windows().filter(w => w.url().includes('/renderer/') && !w.isClosed())

function exited (app) {
  return new Promise(resolve => app.process().once('exit', (code, sig) => resolve(sig ? `signal ${sig}` : code)))
}

;(async () => {
  const { app, win } = await launch([keysFake], { appArgs: ['--skin', 'deck'], env })
  const exit = exited(app)
  await sleep(2500)
  await win.keyboard.press('Control+Shift+T')
  await sleep(2000)
  let pr = await probe(app)
  const [a, b] = pr.tabs
  // The scrollback before the move, once the fake's last line is drawn:
  // under load the terminal can still be writing its 300 lines 2 s on,
  // and a copy taken then is shorter than the popped tab's.
  let before = null
  for (let i = 0; i < 100; i++) {
    before = (await page(win)).panes.find(p => p.id === b.id)
    if (before && trim(before.lines).includes(`pid ${b.childPid} line 300`)) break
    await sleep(200)
  }
  const vizBefore = app.windows().find(w => w.url().includes('/viz/'))
  const panesBefore = vizBefore ? (await vizBefore.evaluate(() => window.vizState().panes.map(p => p.tab))) : null
  check(pr.tabs.length === 2 && b.active, 'want a second, active tab')
  check(trim(before.lines).includes(`pid ${b.childPid} line 1`), 'want the second tab\'s first line in its scrollback before the move')

  const box = await win.locator(`#tabs .tab[data-id="${b.id}"]`).boundingBox()
  const W = await win.evaluate(() => innerWidth)
  await win.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await win.mouse.down()
  await win.mouse.move(W + 200, box.y + 300, { steps: 10 })
  await win.mouse.up()
  await sleep(3000)

  const ws = mains(app)
  check(ws.length === 2, `want two main windows, saw ${ws.length}`)
  const popped = ws.find(w => w !== win)
  pr = await probe(app)
  const src = await page(win)
  // The popped window restores the scrollback after it loads: read it
  // once its last line is drawn, or as it stands after 20 s.
  let dst = null
  let after = null
  for (let i = 0; i < 100; i++) {
    dst = await page(popped)
    after = dst.panes.find(p => p.id === b.id)
    if (after && trim(after.lines).includes(`pid ${b.childPid} line 300`)) break
    await sleep(200)
  }
  const moved = pr.tabs.find(t => t.id === b.id)
  const seen = {
    windows: pr.windows,
    tabs: pr.tabs.map(t => ({ id: t.id, win: t.win, pid: t.childPid })),
    src: src.panes.map(p => p.id),
    dst: dst.panes.map(p => p.id),
    linesBefore: trim(before.lines).length,
    linesAfter: after && trim(after.lines).length,
    srcStrip: await win.evaluate(() => !document.getElementById('tabs').hidden)
  }
  console.log('after pop', JSON.stringify(seen))
  check(pr.tabs.length === 2 && moved.childPid === b.childPid && alive(b.childPid), 'want the popped tab on its own pid, still running')
  check(moved.win !== a.win && pr.windows.length === 2, 'want the popped tab in a window of its own')
  check(src.panes.length === 1 && src.panes[0].id === a.id && !seen.srcStrip, 'want the source window left with its other tab and no strip')
  check(after && trim(after.lines).join('\n') === trim(before.lines).join('\n'), 'want the popped tab\'s scrollback whole')
  const wb = pr.windows.find(w => w.id === moved.win).bounds
  console.log('popped bounds', JSON.stringify(wb))
  const sb = pr.windows.find(w => w.id === a.win).bounds
  check(wb.x >= sb.x + W - 60 && wb.x <= sb.x + W + 260, 'want the new window at the drop point, right of the source')
  if (panesBefore) {
    const vizNow = app.windows().find(w => w.url().includes('/viz/'))
    const panesAfter = await vizNow.evaluate(() => window.vizState().panes.map(p => p.tab))
    console.log('viz panes', JSON.stringify(panesBefore), JSON.stringify(panesAfter))
    check(panesAfter.slice().sort().join() === panesBefore.slice().sort().join(), 'want the viz to keep a pane for each tab')
  }
  await shot(win, path.join(out, 'source.png'))
  await shot(popped, path.join(out, 'popped.png'))

  await popped.bringToFront()
  await popped.locator('#term').click()
  await popped.keyboard.type('xyz')
  await sleep(500)
  check(bytes(b.childPid).includes('xyz') && !bytes(a.childPid).includes('xyz'), 'want typing in the popped window to reach the popped tab alone')

  // The source window's tab ends: its window closes, the app runs on.
  process.kill(-a.childPid, 'SIGHUP')
  await sleep(2500)
  check(mains(app).length === 1 && (await probe(app)).tabs.length === 1, 'want the empty source window gone and the app running')
  // The last tab, in the popped window, ends with status 3.
  await popped.keyboard.type('#3')
  const code = await Promise.race([exit, sleep(8000).then(() => 'timeout')])
  console.log('exit', code)
  check(code === 3, `want the app's status from the last tab, 3, saw ${code}`)
  console.log('done')
})().catch(e => { console.error(e); process.exit(1) })
