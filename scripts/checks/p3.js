'use strict'
// Phase 3 live checks. Run under xvfb-run:
//   node scripts/checks/p3.js OUT widgets|hostile|menu|switching|reload|collision|button|openskin|keys|remember
const { launch, childPid, openMenu, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const what = process.argv[3]
const root = path.join(__dirname, '..', '..')
const fixtures = path.join(root, 'test', 'fixtures', 'skins')
const fake = path.join(root, 'scripts', 'fake', 'claude')
fs.mkdirSync(out, { recursive: true })

async function end (app) {
  const pid = await childPid(app)
  try { process.kill(-pid, 'SIGHUP') } catch (e) {}
  await sleep(1500)
  await app.close().catch(() => {})
}

async function widgets () {
  const { app, win } = await launch([fake], { appArgs: ['--skin', path.join(fixtures, 'all-widgets')], env: { SKINNED_GL: 'swiftshader' } })
  await sleep(3000)
  for (let i = 0; i < 8; i++) {
    await shot(win, path.join(out, `widgets-${i}.png`))
    await sleep(500)
  }
  await end(app)
}

async function hostile () {
  const { app, win } = await launch(['bash', '--norc', '--noprofile', '-i'], { appArgs: ['--skin', path.join(fixtures, 'hostile')] })
  await sleep(2000)
  await win.keyboard.type('echo VISIBLE-TEXT-ABOVE-THE-SKIN')
  await win.keyboard.press('Enter')
  await sleep(800)
  await shot(win, path.join(out, 'hostile.png'))
  await end(app)
}

async function menu () {
  const env = { SKINNED_SKINS_DIR: fixtures, SKINNED_GL: 'swiftshader' }
  const { app, win } = await launch([fake], { appArgs: ['--skin', 'all-widgets'], env })
  await sleep(3000)
  await openMenu(win, 'Skins')
  await shot(win, path.join(out, 'menu-open.png'))
  await win.locator('#menu .item', { hasText: 'hostile' }).click()
  await sleep(1500)
  await shot(win, path.join(out, 'menu-switched.png'))
  await openMenu(win, 'Skins')
  await win.locator('#menu .item', { hasText: 'broken-metric' }).click()
  await sleep(800)
  await shot(win, path.join(out, 'menu-broken.png'))
  const pid = await childPid(app)
  let alive = true
  try { process.kill(pid, 0) } catch (e) { alive = false }
  console.log('session alive after switches', alive)
  await end(app)
}

// Switch between the shipped skins through the menu, live.
async function switching () {
  const { app, win } = await launch([fake], { appArgs: ['--skin', 'deck'], env: { SKINNED_GL: 'swiftshader' } })
  await sleep(3000)
  await shot(win, path.join(out, 'switch-0-deck.png'))
  await openMenu(win, 'Skins')
  await win.locator('#menu .item', { hasText: 'phosphor' }).click()
  await sleep(2000)
  await shot(win, path.join(out, 'switch-1-phosphor.png'))
  await openMenu(win, 'Skins')
  await win.locator('#menu .item', { hasText: 'deck' }).click()
  await sleep(2000)
  await shot(win, path.join(out, 'switch-2-deck.png'))
  await end(app)
}

// One pixel of the main window, as rgb(r, g, b). The bitmap is BGRA.
async function pixel (app, win, x, y) {
  const bw = await app.browserWindow(win)
  return bw.evaluate(async (w, [x, y]) => {
    const b = (await w.webContents.capturePage({ x, y, width: 1, height: 1 })).toBitmap()
    return `rgb(${b[2]}, ${b[1]}, ${b[0]})`
  }, [x, y])
}

// Reselecting a skin shows its files as they are on disk now. A copy of
// deck under its own name paints its body magenta, the CSS turns it green
// on disk, the menu reselects it, and the body must turn green.
async function reload () {
  const dir = path.join(out, 'reload')
  const deck = path.join(root, 'skins', 'deck')
  fs.cpSync(deck, dir, { recursive: true })
  const manifest = JSON.parse(fs.readFileSync(path.join(deck, 'skin.json'), 'utf8'))
  fs.writeFileSync(path.join(dir, 'skin.json'), JSON.stringify(Object.assign(manifest, { name: 'reload' }), null, 1) + '\n')
  const css = path.join(dir, 'skin.css')
  fs.writeFileSync(css, fs.readFileSync(path.join(deck, 'skin.css'), 'utf8') + '\n/* RELOAD-MARKER */\n.body { background: #a000a0 !important; }\n')
  const { app, win } = await launch([fake], { appArgs: ['--skin', dir], env: { SKINNED_GL: 'swiftshader' } })
  await sleep(3000)
  const before = await pixel(app, win, 1235, 400)
  console.log('before edit: body pixel', before)
  fs.writeFileSync(css, fs.readFileSync(css, 'utf8').replace('#a000a0', '#00a000'))
  await openMenu(win, 'Skins')
  await win.locator('#menu .item', { hasText: 'reload' }).click()
  await sleep(2000)
  const after = await pixel(app, win, 1235, 400)
  console.log('after edit and reselect: body pixel', after)
  await shot(win, path.join(out, 'reload.png'))
  await end(app)
  if (before !== 'rgb(160, 0, 160)' || after !== 'rgb(0, 160, 0)') throw new Error(`want rgb(160, 0, 160) then rgb(0, 160, 0), saw ${before} then ${after}`)
}

// Decision 0008's identity rule: a copy of deck opened by path that keeps
// the name deck replaces the shipped deck for the run, and the menu shows
// the copy's folder beside the name, tildified, whole on hover. Its
// terminal background is #300030.
async function collision () {
  const dir = path.join(out, 'mydeck')
  const deck = path.join(root, 'skins', 'deck')
  fs.cpSync(deck, dir, { recursive: true })
  const manifest = JSON.parse(fs.readFileSync(path.join(deck, 'skin.json'), 'utf8'))
  manifest.terminal.theme.background = '#300030'
  fs.writeFileSync(path.join(dir, 'skin.json'), JSON.stringify(manifest, null, 1) + '\n')
  const { app, win } = await launch([fake], { appArgs: ['--skin', dir], env: { SKINNED_GL: 'swiftshader' } })
  await sleep(3000)
  const termBg = () => win.evaluate(() => document.getElementById('term').style.background)
  const items = async () => {
    await openMenu(win, 'Skins')
    return win.evaluate(() => [...document.querySelectorAll('#menu .item')].map(e => ({ text: e.firstChild ? e.firstChild.textContent : '', location: (e.querySelector('.location') || {}).title || null })))
  }
  const pick = async text => {
    await items()
    await win.locator('#menu .item', { hasText: text }).first().click()
    await sleep(1500)
    return termBg()
  }
  const listed = await items()
  await win.keyboard.press('Escape')
  console.log('menu', JSON.stringify(listed))
  const seen = [await termBg(), await pick('phosphor'), await pick('deck')]
  console.log('term background at start, after phosphor, after deck', JSON.stringify(seen))
  await shot(win, path.join(out, 'collision.png'))
  await end(app)
  const decks = listed.filter(r => /^[* ] deck$/.test(r.text))
  const shown = require('../../app/identity').tildify(dir)
  if (decks.length !== 1 || decks[0].location !== shown) throw new Error(`want one deck entry showing ${shown}, saw ${JSON.stringify(decks)}`)
  if (seen[0] !== seen[2] || seen[0] !== 'rgb(48, 0, 48)') throw new Error(`want the copy's background at start and after deck, saw ${JSON.stringify(seen)}`)
}

// Decision 0022: in each shipped skin and the hostile fixture the menu
// button is the topmost element at its centre, and one click opens the
// drop-down on File.
async function button () {
  const results = []
  for (const skin of ['deck', 'phosphor', 'library', 'coffee', path.join(fixtures, 'hostile')]) {
    const { app, win } = await launch([fake], { appArgs: ['--skin', skin], env: { SKINNED_GL: 'swiftshader' } })
    await sleep(3000)
    const top = await win.evaluate(() => {
      const b = document.getElementById('menu-button')
      const r = b.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return { visible: !b.hidden && r.width >= 16 && r.height >= 16, top: b.contains(hit) }
    })
    await win.locator('#menu-button').click()
    await sleep(500)
    const opened = await win.evaluate(() => !document.getElementById('menu').hidden && [...document.querySelectorAll('#menu .item')].map(e => e.textContent))
    const name = path.basename(skin)
    await shot(win, path.join(out, `button-${name}.png`))
    results.push(Object.assign({ name, opened }, top))
    await end(app)
  }
  console.log(JSON.stringify(results))
  for (const r of results) if (!r.visible || !r.top || !r.opened || !r.opened.includes('New tab...')) throw new Error(`button: ${JSON.stringify(r)}`)
}

const current = win => win.evaluate(async () => (await window.skinned.listSkins()).filter(s => s.current).map(s => s.id))

// Open skin... switches to a valid folder, and on a broken one keeps the
// current skin and shows the validator's error.
async function openskin () {
  const { app, win } = await launch([fake], { appArgs: ['--skin', 'deck'], env: { SKINNED_GL: 'swiftshader' } })
  await sleep(3000)
  const choose = async dir => {
    await app.evaluate(({ dialog }, d) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [d] }) }, dir)
    await openMenu(win, 'Skins')
    await win.locator('#menu .item', { hasText: 'Open skin...' }).click()
    await sleep(1500)
  }
  await choose(path.join(fixtures, 'all-widgets'))
  const good = { current: await current(win), closed: await win.evaluate(() => document.getElementById('menu').hidden) }
  await shot(win, path.join(out, 'open-good.png'))
  await choose(path.join(fixtures, 'broken-metric'))
  const bad = { current: await current(win), error: await win.evaluate(() => (document.querySelector('#menu .error') || {}).textContent || null) }
  await shot(win, path.join(out, 'open-broken.png'))
  await end(app)
  console.log(JSON.stringify({ good, bad }))
  if (good.current[0] !== 'all-widgets' || !good.closed) throw new Error('Open skin... did not switch to all-widgets')
  if (bad.current[0] !== 'all-widgets' || !/widgets\[0\]\.bind: unknown metric "foo.bar"/.test(bad.error || '')) throw new Error('a broken skin was not refused with its error')
}

// Keys: the open menu swallows them, Right steps to Agents and Escape
// closes it, then Alt+F and Alt+B reach the CLI as ESC f and ESC b, and
// nothing else did.
async function keys () {
  const file = path.join(out, 'keys.bin')
  fs.rmSync(file, { force: true })
  const { app, win } = await launch(['bash', '-c', `stty raw -echo; head -c 4 > '${file}'; sleep 60`], { appArgs: ['--skin', 'deck'], env: { SKINNED_GL: 'swiftshader' } })
  await sleep(2500)
  await openMenu(win)
  await win.keyboard.press('x')
  await win.keyboard.press('ArrowRight')
  await sleep(300)
  const stepped = await win.evaluate(() => (document.querySelector('#menu .bar .title.current') || {}).textContent || null)
  await win.keyboard.press('Escape')
  await sleep(300)
  const closed = await win.evaluate(() => document.getElementById('menu').hidden)
  await win.keyboard.press('Alt+f')
  await win.keyboard.press('Alt+b')
  await sleep(1000)
  const bytes = fs.existsSync(file) ? [...fs.readFileSync(file)].map(b => b.toString(16).padStart(2, '0')).join(' ') : null
  await end(app)
  console.log(JSON.stringify({ stepped, closed, bytes }))
  if (stepped !== 'Agents' || !closed || bytes !== '1b 66 1b 62') throw new Error(`want Agents after Right, the menu closed and 1b 66 1b 62, saw ${stepped}, ${closed} and ${bytes}`)
}

// The last skin used (decision 0022), under a scratch XDG_STATE_HOME.
async function remember () {
  const last = require('../../app/skins/last')
  const st = path.join(out, 'state')
  const recs = path.join(st, 'claude-skins', 'last-skins')
  fs.rmSync(st, { recursive: true, force: true })
  const env = { SKINNED_GL: 'swiftshader', XDG_STATE_HOME: st, SKINNED_SKIN: '' }
  const seen = {}
  const run = async (key, opts, fn) => {
    const { app, win } = await launch([fake], Object.assign({ env }, opts))
    await sleep(3000)
    seen[key] = Object.assign({ current: (await current(win))[0] }, fn ? await fn(app, win) : {})
    await end(app)
    seen[key].records = last.read(recs).map(r => r.spec)
  }
  await run('bare', {}, async (app, win) => {
    await openMenu(win, 'Skins')
    await win.locator('#menu .item', { hasText: 'phosphor' }).click()
    await sleep(1500)
    return { after: (await current(win))[0] }
  })
  await run('again', {})
  last.forget(recs)
  last.record(recs, 999999, '/nonexistent/skin')
  await run('stale', {}, async (app, win) => {
    const dot = await win.evaluate(() => !document.querySelector('#menu-button .dot').hidden)
    await openMenu(win)
    await win.locator('#menu .item.problem').click()
    await sleep(300)
    await shot(win, path.join(out, 'remember-stale.png'))
    return { dot, error: await win.evaluate(() => (document.querySelector('#menu .error') || {}).textContent || null) }
  })
  last.forget(recs)
  const now = Date.now()
  last.record(recs, 11, 'phosphor', now)
  last.record(recs, 12, 'deck', now - 1000)
  const asked = path.join(out, 'dialog.json')
  env.SKINNED_CHECK_DIALOG = asked
  env.SKINNED_CHECK_ANSWER = '1'
  await run('race', { require: path.join(__dirname, 'stub-dialog.js') }, async (app, win) => {
    return { buttons: JSON.parse(fs.readFileSync(asked, 'utf8')).buttons }
  })
  await run('forget', {}, async (app, win) => {
    await openMenu(win)
    await win.locator('#menu .item', { hasText: 'Forget remembered skin' }).click()
    await sleep(300)
    return { note: await win.evaluate(() => (document.querySelector('#menu .note') || {}).textContent || null), left: last.read(recs).length }
  })
  await run('given', { appArgs: ['--skin', 'phosphor'] })
  console.log(JSON.stringify(seen))
  const want = {
    bare: s => s.current === 'deck' && s.after === 'phosphor',
    again: s => s.current === 'phosphor',
    stale: s => s.current === 'deck' && s.dot && /directory not found/.test(s.error || '') && s.records.join() === '/nonexistent/skin',
    race: s => s.buttons.join() === 'phosphor,deck' && s.current === 'deck' && s.records.join() === 'deck',
    forget: s => s.current === 'deck' && /Forgotten/.test(s.note || '') && s.left === 0,
    given: s => s.current === 'phosphor' && s.records.join() === 'phosphor'
  }
  const failed = Object.keys(want).filter(k => !want[k](seen[k]))
  if (failed.length) throw new Error(`remember: ${failed.join(', ')}`)
}

;({ widgets, hostile, menu, switching, reload, collision, button, openskin, keys, remember })[what]().then(() => console.log('done')).catch(e => { console.error(e); process.exit(1) })
