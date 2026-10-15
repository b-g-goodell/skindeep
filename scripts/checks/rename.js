'use strict'
// Live check of a session's name in its tab (decision 0032). Run under
// xvfb-run:
//   node scripts/checks/rename.js OUT
// Part 1: /rename typed into the fake agent reaches the tab's title and
// the window title within a second. Part 2: a right click on a tab
// offers Rename, which edits the name in place, writes the CLI's record,
// and a later /rename wins over it. Escape cancels.
const { launch, probe, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
fs.mkdirSync(out, { recursive: true })
const root = path.join(__dirname, '..', '..')
const claudeFake = path.join(root, 'scripts', 'fake', 'claude')
const env = { SKINNED_GL: 'swiftshader' }

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

const title = app => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(x => !x.getTitle().startsWith('visualization')).getTitle())
const labels = win => win.evaluate(() => [...document.querySelectorAll('#tabs .tab .label')].map(e => e.textContent))

// Milliseconds until tab `index` shows `name` in the probe and in the
// strip, or null.
async function untilTitle (app, win, index, name, ms = 3000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const p = await probe(app)
    if (p.tabs[index] && p.tabs[index].title === name && (await labels(win))[index] === name) return Date.now() - t0
    await sleep(50)
  }
  return null
}

async function end (app) {
  for (const t of (await probe(app)).tabs) try { process.kill(-t.childPid, 'SIGHUP') } catch (e) {}
  await sleep(1500)
  await app.close().catch(() => {})
}

async function run () {
  const { app, win } = await launch([claudeFake], { appArgs: ['--skin', 'deck', '--no-viz'], env })
  await sleep(2500)
  await win.keyboard.press('Control+Shift+T')
  await sleep(3000)
  const seen = {}

  // Part 1: /rename in the active (second) tab.
  await win.keyboard.type('/rename math one')
  const t0 = Date.now()
  await win.keyboard.press('Enter')
  seen.cliMs = await untilTitle(app, win, 1, 'math one')
  seen.cliLabels = await labels(win)
  seen.cliTitle = await title(app)
  seen.cliTotalMs = Date.now() - t0
  await shot(win, path.join(out, 'rename-cli.png'))
  console.log('part 1', JSON.stringify(seen), 'since Enter', Date.now() - t0)
  check(seen.cliMs !== null && seen.cliMs < 1000, `want the tab titled "math one" within a second, took ${seen.cliMs}`)
  check(seen.cliLabels[1] === 'math one', `want the strip to show "math one", saw ${JSON.stringify(seen.cliLabels)}`)
  check(seen.cliTitle === 'math one in claude-skins', `want the window title to follow, saw ${seen.cliTitle}`)
  check(seen.cliTotalMs < 1000, `want the strip and the window title within a second of Enter, took ${seen.cliTotalMs}`)

  // Part 2: a right click on the first tab, Rename, a name typed in place.
  await win.locator('#tabs .tab').first().click({ button: 'right' })
  await sleep(300)
  seen.menu = await win.evaluate(() => [...document.querySelectorAll('#tab-menu .item')].map(e => e.textContent))
  await shot(win, path.join(out, 'rename-menu.png'))
  check(seen.menu.join() === 'Rename', `want a drop-down with Rename, saw ${JSON.stringify(seen.menu)}`)
  await win.locator('#tab-menu .item').click()
  await sleep(200)
  seen.editor = await win.evaluate(() => { const i = document.querySelector('#tabs .rename'); return i ? { value: i.value, focused: document.activeElement === i } : null })
  await shot(win, path.join(out, 'rename-edit.png'))
  const label = (await probe(app)).tabs[0].label
  check(seen.editor && seen.editor.focused && seen.editor.value === label, `want a focused input holding ${JSON.stringify(label)}, saw ${JSON.stringify(seen.editor)}`)
  await win.keyboard.type('zoo')
  const t1 = Date.now()
  await win.keyboard.press('Enter')
  seen.tabMs = await untilTitle(app, win, 0, 'zoo')
  seen.tabLabels = await labels(win)
  console.log('part 2', JSON.stringify({ tabMs: seen.tabMs, labels: seen.tabLabels }), 'since Enter', Date.now() - t1)
  check(seen.tabMs !== null && seen.tabMs < 1000, `want the first tab titled "zoo" within a second, took ${seen.tabMs}`)
  check(seen.tabLabels[0] === 'zoo' && seen.tabLabels[1] === 'math one', `want the strip zoo, math one, saw ${JSON.stringify(seen.tabLabels)}`)
  check(await win.evaluate(() => !document.querySelector('#tabs .rename') && !document.getElementById('tab-menu')), 'want the editor and the drop-down gone')

  // The CLI's record: the transcript line and custom-title.json.
  await sleep(1200)
  const first = (await probe(app)).tabs[0]
  const transcript = first.following.channels.find(c => c.name === 'transcript').target
  const last = fs.readFileSync(transcript, 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(o => o.type === 'custom-title').pop()
  const json = path.join(path.dirname(transcript), first.following.session, 'custom-title.json')
  seen.record = { line: last, json: fs.existsSync(json) ? JSON.parse(fs.readFileSync(json, 'utf8')) : null, recordTitle: first.following.title }
  console.log('record', JSON.stringify(seen.record))
  check(last && last.customTitle === 'zoo' && last.sessionId === first.following.session, 'want the custom-title line in the transcript')
  check(seen.record.json && seen.record.json.customTitle === 'zoo', 'want custom-title.json beside the transcript')
  check(first.following.title === 'zoo', 'want the adapter to read the name back from the record')

  // The window title follows the renamed tab once it is active, and a
  // later /rename in it wins over the name given in the tab.
  await win.locator('#tabs .tab').first().click()
  await sleep(300)
  seen.activeTitle = await title(app)
  check(seen.activeTitle === 'zoo in claude-skins', `want the window title zoo in claude-skins, saw ${seen.activeTitle}`)
  await win.keyboard.type('/rename later')
  await win.keyboard.press('Enter')
  seen.laterMs = await untilTitle(app, win, 0, 'later')
  check(seen.laterMs !== null && seen.laterMs < 1000, `want /rename to win over the tab's name within a second, took ${seen.laterMs}`)

  // Escape cancels.
  await win.locator('#tabs .tab').first().click({ button: 'right' })
  await sleep(200)
  await win.locator('#tab-menu .item').click()
  await sleep(200)
  await win.keyboard.type('nope')
  await win.keyboard.press('Escape')
  await sleep(300)
  seen.afterEscape = await labels(win)
  check(seen.afterEscape[0] === 'later' && (await probe(app)).tabs[0].title === 'later', `want Escape to keep "later", saw ${JSON.stringify(seen.afterEscape)}`)
  await shot(win, path.join(out, 'rename-final.png'))
  await end(app)
  console.log(JSON.stringify(seen))
}

run().then(() => console.log('done')).catch(e => { console.error(e); process.exit(1) })
