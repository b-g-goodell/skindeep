'use strict'
// The text sizes of decision 0036 (issue #146) in each shipped skin, at
// its initial size and in a quarter of a 1920 x 1080 screen. Run under
// xvfb-run:
//   node scripts/checks/textsize.js OUT [deck|phosphor|coffee|library|viz]
// The fake claude runs until its task list and its usage limits show,
// then idles, and a dashboard tab opens beside it. At each size the
// skin, window and terminal text sizes go to their default, to 150
// percent (the terminal to 20 px) and to 70 (10 px), the first through
// the menu, the rest by the page's api. At each, every text of the
// skin, the identity strip, the tab strip, the File menu and a
// flyout, the New tab dialog and the dashboard is read: its font size
// and the box of its ink. Below 100 every text is at 70 percent of its
// default size. Above, every window text is at 150, every skin text
// between 100 and 150, and each part of a skin, its labels, values,
// task list, limits, toggle and CSS-drawn words, grows. No two texts
// overlap that did not at the default, no skin text whole at the
// default is cut, nor more of one, but a list's rows, no skin text
// meets the terminal or the menu button, the CSS-drawn words stay in
// their boxes, and the menu and its flyout stay in the window. Then the visualization
// window in Carbon, one pane and two, at each visualization text size:
// no two of its texts overlap, its drop-down's rows stay in the window,
// and its texts grow and shrink. The settings are read back after a
// relaunch. A part named runs alone. Frames go to OUT/<skin>-<size>-<pct>[-<part>].png and
// OUT/viz-<panes>-<pct>.png.
const { launch, probe, openMenu, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
// One skin's name or viz: that part alone. None: every part.
const mode = process.argv[3] || null
fs.mkdirSync(out, { recursive: true })
const root = path.join(__dirname, '..', '..')
const fake = path.join(root, 'scripts', 'fake', 'claude')
const SKINS = ['deck', 'phosphor', 'coffee', 'library']
const TILE = [960, 1048 / 2 - 37]
const PCTS = [null, 150, 70]
const TERM = { 150: 20, 70: 10 }
const bad = []

function check (ok, msg) {
  if (!ok) {
    bad.push(msg)
    console.log('FAIL', msg)
  }
}

// Two boxes overlap where they share more than half a pixel each way.
const meet = (a, b) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0.5
const inside = (b, w, h) => b.x >= -0.5 && b.y >= -0.5 && b.x + b.width <= w + 0.5 && b.y + b.height <= h + 0.5

// Each text keyed by its owner and its place among the owner's texts.
function keyed (list) {
  const n = new Map()
  return list.map(t => {
    const i = n.get(t.owner) || 0
    n.set(t.owner, i + 1)
    return Object.assign({ key: `${t.owner}#${i}` }, t)
  })
}

// The pairs of texts that overlap, by key.
function overlaps (list) {
  const o = new Set()
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (meet(list[i].box, list[j].box)) o.add(`${list[i].key} x ${list[j].key}`)
    }
  }
  return o
}

// The page's texts under each selector, as TextFit reads the skin's,
// each cut by the clips from its element up to the one the selector
// names: the dashboard's by its cells' own, not by the pane that
// scrolls.
const D = '#term .pane.dashboard.active'
const PARTS = { strip: '#strip', tabs: '#tabs', menu: '#menu', chooser: '#chooser .dialog', dashboard: `${D} .d-head, ${D} .d-chart > *, ${D} .d-row > *` }
const windowTexts = (win, parts) => win.evaluate(parts => {
  const out = {}
  for (const [name, sel] of Object.entries(parts)) {
    out[name] = []
    for (const el of document.querySelectorAll(sel)) {
      if (el.hidden || el.closest('[hidden]')) continue
      for (const t of window.TextFit.texts(el)) out[name].push({ owner: name + ':' + (t.el.className || t.el.tagName), text: t.text, fontSize: t.fontSize, cutX: t.cutX, elided: t.el.title === t.text && getComputedStyle(t.el).textOverflow === 'ellipsis', shownY: t.shownY, box: { x: t.box.x0, y: t.box.y0, width: t.box.x1 - t.box.x0, height: t.box.y1 - t.box.y0 } })
    }
  }
  return out
}, parts)

const page = win => win.evaluate(() => {
  const p = window.skinnedPage()
  const t = p.panes.find(x => x.shown && !x.dashboard)
  const m = document.getElementById('menu-button').getBoundingClientRect()
  return { scale: p.scale, texts: p.texts, term: p.term, button: { x: m.x, y: m.y, width: m.width, height: m.height }, fontSize: t ? t.fontSize : null, win: [innerWidth, innerHeight] }
})

const set = (win, id, v) => win.evaluate(([id, v]) => window.skinned.setSetting(id, v), [id, v])

// One size of one skin: the default, then each size, compared with it.
// has: whether the skin has a task list.
async function sizes (app, win, skin, tag, tabs, own, has) {
  let base = null
  for (const pct of PCTS) {
    const at = `${skin} ${tag} ${pct || 100}`
    if (pct === 150 && skin === SKINS[0] && tag === 'initial') {
      await openMenu(win)
      await win.locator('#menu .submenu', { hasText: 'Skin text size' }).hover()
      await sleep(200)
      await win.locator('#menu .submenu', { hasText: 'Skin text size' }).locator('.sub .item', { hasText: '150%' }).click()
      await sleep(300)
    } else await set(win, 'text.skin', pct)
    await set(win, 'text.window', pct)
    await set(win, 'terminal.fontSize', pct ? TERM[pct] : null)
    await sleep(1500)
    const v = await page(win)
    const w = await windowTexts(win, { strip: PARTS.strip, tabs: PARTS.tabs })
    await shot(win, path.join(out, `${skin}-${tag}-${pct || 100}.png`))
    // The File menu, and a flyout of it.
    await openMenu(win)
    const menu = await windowTexts(win, { menu: PARTS.menu })
    const mbox = await win.evaluate(() => { const r = document.getElementById('menu').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } })
    await win.locator('#menu .submenu', { hasText: 'Window text size' }).hover()
    await sleep(300)
    const fly = await win.evaluate(() => {
      const s = [...document.querySelectorAll('#menu .submenu')].find(e => e.firstChild.textContent === 'Window text size').querySelector('.sub')
      const r = s.getBoundingClientRect()
      return { box: { x: r.x, y: r.y, width: r.width, height: r.height }, texts: window.TextFit.texts(s).map(t => ({ owner: 'flyout', text: t.text, fontSize: t.fontSize, cutX: t.cutX, shownY: t.shownY, box: { x: t.box.x0, y: t.box.y0, width: t.box.x1 - t.box.x0, height: t.box.y1 - t.box.y0 } })) }
    })
    await shot(win, path.join(out, `${skin}-${tag}-${pct || 100}-menu.png`))
    await win.keyboard.press('Escape')
    await sleep(200)
    // The New tab dialog.
    await win.evaluate(() => window.Chooser.open())
    await sleep(600)
    const chooser = await windowTexts(win, { chooser: PARTS.chooser })
    await shot(win, path.join(out, `${skin}-${tag}-${pct || 100}-chooser.png`))
    await win.evaluate(() => window.Chooser.close())
    await sleep(200)
    // The dashboard's tab.
    await win.evaluate(id => window.skinned.activateTab(id), tabs.dash)
    await sleep(1200)
    const dash = await windowTexts(win, { dashboard: PARTS.dashboard })
    await shot(win, path.join(out, `${skin}-${tag}-${pct || 100}-dashboard.png`))
    await win.evaluate(id => window.skinned.activateTab(id), tabs.term)
    await sleep(800)

    const skinTexts = keyed(v.texts.filter(t => t.part !== 'words'))
    const words = v.texts.filter(t => t.part === 'words')
    const win2 = {
      strip: keyed(w.strip),
      tabs: keyed(w.tabs),
      menu: keyed(menu.menu),
      flyout: keyed(fly.texts),
      chooser: keyed(chooser.chooser),
      dashboard: keyed(dash.dashboard)
    }
    const now = { skin: skinTexts, words, win: win2, pairs: overlaps(skinTexts), winPairs: Object.fromEntries(Object.entries(win2).map(([k, l]) => [k, overlaps(k === 'strip' ? l.concat(win2.tabs) : l)])) }
    console.log(at, 'scale', v.scale.toFixed(3), 'terminal', v.fontSize, 'skin texts', skinTexts.length, 'words', words.length,
      'window texts', Object.entries(win2).map(([k, l]) => `${k} ${l.length}`).join(', '))

    // The terminal at the size asked, or the skin's own.
    check(v.fontSize === (pct ? TERM[pct] : own), `${at}: terminal at ${v.fontSize} px`)
    // Every text in the window, the menu and its flyout too.
    check(inside(mbox, ...v.win), `${at}: the File menu ${JSON.stringify(mbox)} leaves the window ${v.win}`)
    check(inside(fly.box, ...v.win), `${at}: the flyout ${JSON.stringify(fly.box)} leaves the window ${v.win}`)
    for (const t of skinTexts) {
      check(!meet(t.box, v.term), `${at}: skin text ${t.key} "${t.text}" meets the terminal`)
      check(!meet(t.box, v.button), `${at}: skin text ${t.key} "${t.text}" meets the menu button`)
    }
    // Every window text in the window, but the dashboard's, which
    // scrolls.
    for (const [k, l] of Object.entries(win2)) if (k !== 'dashboard') for (const t of l) check(inside(t.box, ...v.win), `${at}: ${k} text "${t.text}" leaves the window`)
    check((!has.list || skinTexts.some(t => t.part === 'item')) && skinTexts.some(t => t.limit) && win2.dashboard.length && win2.chooser.length && win2.tabs.length, `${at}: want the task list, the limits, the dashboard, the dialog and the tab strip drawn`)

    if (!base) {
      base = now
      continue
    }
    // Nothing overlaps that did not at the default.
    for (const p of now.pairs) check(base.pairs.has(p), `${at}: skin texts overlap: ${p}`)
    for (const [k, ps] of Object.entries(now.winPairs)) for (const p of ps) check(base.winPairs[k].has(p), `${at}: ${k} texts overlap: ${p}`)
    // No text cut in its width that was whole, nor more of its height
    // cut, save a list's rows and a moving text, deck's marquee.
    for (const t of skinTexts) {
      const b = base.skin.find(x => x.key === t.key && x.part === t.part)
      if (b && !t.row && !t.moving) check(!(t.cutX && !b.cutX) && t.shownY >= b.shownY - 0.05, `${at}: skin text ${t.key} "${t.text}" is cut: ${t.shownY.toFixed(2)} of its height shown, ${b.shownY.toFixed(2)} at the default`)
    }
    // The CSS-drawn words stay in their boxes as at the default.
    for (const wd of words) {
      const b = base.words.find(x => x.owner === wd.owner && x.text === wd.text)
      check(b && wd.scroll[0] <= b.scroll[0] + 1 && wd.scroll[1] <= b.scroll[1] + 1, `${at}: "${wd.text}" leaves its box: ${wd.scroll} beside ${b && b.scroll}`)
    }
    // Every text at its size.
    const f = pct / 100
    const ratios = {}
    for (const t of skinTexts.concat(words.map(x => Object.assign({ key: x.owner + ':' + x.text }, x)))) {
      const b = (t.part === 'words' ? base.words.map(x => Object.assign({ key: x.owner + ':' + x.text }, x)) : base.skin).find(x => x.key === t.key && x.part === t.part)
      if (!b) continue
      const r = t.fontSize / b.fontSize
      const part = t.limit ? 'limits' : t.part === 'text' ? 'label' : t.part === 'resets' ? 'limits' : t.part
      ratios[part] = Math.max(ratios[part] || 0, r)
      if (f < 1) check(Math.abs(r - f) < 0.01, `${at}: skin text ${t.key} "${t.text}" at ${r.toFixed(3)} of its size, want ${f}`)
      else check(r > 0.99 && r < f + 0.01, `${at}: skin text ${t.key} "${t.text}" at ${r.toFixed(3)} of its size, want 1 to ${f}`)
    }
    console.log(at, 'largest ratio by part', JSON.stringify(Object.fromEntries(Object.entries(ratios).map(([k, r]) => [k, Math.round(r * 1000) / 1000]))))
    if (f > 1) {
      for (const part of ['label', 'value'].concat(has.list ? ['item'] : [])) check((ratios[part] || 0) >= 1.25, `${at}: the skin's ${part}s grow to ${ratios[part]}, want 1.25 at least`)
      for (const part of ['limits', 'option', 'words']) if (part in ratios) check(ratios[part] >= 1.01, `${at}: the skin's ${part} grow to ${ratios[part]}, want them to grow`)
    }
    for (const [k, l] of Object.entries(win2)) {
      for (const t of l) {
        const b = base.win[k].find(x => x.key === t.key)
        if (b) check(Math.abs(t.fontSize / b.fontSize - f) < 0.01, `${at}: ${k} text "${t.text}" at ${(t.fontSize / b.fontSize).toFixed(3)} of its size, want ${f}`)
        // Whole in its width at the default, whole at every size, and
        // no more of its height cut, but in the menu, which scrolls, and
        // a dashboard chart's title, which gives its value the room. A
        // text drawn with an ellipsis and whole in its tooltip, such as a
        // dashboard folder, may be cut in its width.
        if (b && k !== 'menu' && !/d-title/.test(t.owner)) check(!(t.cutX && !b.cutX && !t.elided) && t.shownY >= b.shownY - 0.05, `${at}: ${k} text ${t.key} "${t.text}" is cut: ${t.shownY.toFixed(2)} of its height shown, ${b.shownY.toFixed(2)} at the default`)
      }
      check(l.some(t => base.win[k].some(x => x.key === t.key)), `${at}: no ${k} text to compare`)
    }
  }
}

const resize = (app, w, h) => app.evaluate(({ BrowserWindow }, [w, h]) => {
  BrowserWindow.getAllWindows().find(x => !x.getTitle().startsWith('visualization')).setContentSize(w, h)
}, [w, h])

// Each tab's command, by the process group the app started it in.
async function end (app) {
  try {
    for (const t of (await probe(app)).tabs) if (t.childPid > 0) process.kill(-t.childPid, 'SIGHUP')
  } catch (e) {}
  await sleep(1500)
  await app.close().catch(() => {})
}

async function one (skin, state) {
  const sw = JSON.parse(fs.readFileSync(path.join(root, 'skins', skin, 'skin.json'), 'utf8'))
  const pause = path.join(out, `pause-${skin}`)
  fs.rmSync(pause, { force: true })
  const { app, win } = await launch([fake], { appArgs: ['--skin', skin, '--no-viz'], env: { SKINNED_GL: 'swiftshader', XDG_STATE_HOME: state, FAKE_CLAUDE_PAUSE: pause } })
  try {
    // The task list and the limits drawn, then the fake idles.
    await win.waitForFunction(() => typeof window.skinnedPage === 'function', null, { timeout: 30000 })
    let m = {}
    for (let i = 0; i < 300; i++) {
      await sleep(100)
      m = await win.evaluate(() => window.skinnedPage().metrics)
      if ((m['checklist.items'] || []).length && (m['limits.items'] || []).length >= 2) break
    }
    fs.writeFileSync(pause, '')
    await sleep(1000)
    const term = (await win.evaluate(() => window.skinned.tabs())).tabs[0].id
    await win.evaluate(() => window.skinned.openDashboard())
    await sleep(1500)
    const dash = (await win.evaluate(() => window.skinned.tabs())).tabs.find(t => t.id !== term).id
    await win.evaluate(id => window.skinned.activateTab(id), term)
    await sleep(800)
    const tabs = { term, dash }
    const has = { list: sw.widgets.some(x => x.type === 'list') }
    await resize(app, sw.window.width, sw.window.height)
    await sleep(1000)
    await sizes(app, win, skin, 'initial', tabs, sw.terminal.fontSize || 14, has)
    await resize(app, ...TILE)
    for (let i = 0; i < 100; i++) {
      await sleep(100)
      const s = await win.evaluate(() => [innerWidth, innerHeight])
      if (s[0] === TILE[0] && s[1] === TILE[1]) break
    }
    await sleep(1000)
    await sizes(app, win, skin, 'tile', tabs, sw.terminal.fontSize || 14, has)
  } finally {
    fs.rmSync(pause, { force: true })
    await end(app)
  }
}

// The visualization window in Carbon: one pane, then two, at each text
// size.
async function viz (state) {
  const { app, win } = await launch([fake], { appArgs: ['--skin', 'deck'], env: { SKINNED_GL: 'swiftshader', XDG_STATE_HOME: state } })
  try {
    let vw = null
    for (let i = 0; i < 40 && !vw; i++) {
      await sleep(250)
      for (const w of app.windows()) if (w.url().includes('/viz/')) vw = w
    }
    check(vw, 'no viz window')
    if (!vw) return
    await vw.waitForFunction(() => typeof window.vizState === 'function', null, { timeout: 30000 })
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(x => x.webContents.getURL().includes('/viz/')).setContentSize(720, 460))
    const state = () => vw.evaluate(() => window.vizState())
    async function until (f, msg) {
      for (let i = 0; i < 100; i++) {
        if (await f()) return true
        await sleep(100)
      }
      check(false, msg)
      return false
    }
    // Every tab's pane in Carbon.
    const carbon = async () => {
      for (const t of (await win.evaluate(() => window.skinned.tabs())).tabs) {
        await win.evaluate(id => window.skinned.activateTab(id), t.id)
        await until(async () => (await state()).panes.some(p => p.tab === t.id && p.active), `tab ${t.id} not active`)
        await win.evaluate(() => window.skinned.selectViz('carbon'))
        await until(async () => (await state()).panes.some(p => p.tab === t.id && p.mode === 'carbon'), `tab ${t.id} not in Carbon`)
      }
    }
    await sleep(1500)
    await carbon()
    for (const panes of [1, 2]) {
      if (panes === 2) {
        await win.keyboard.press('Control+Shift+T')
        await sleep(2000)
        await carbon()
      }
      let base = null
      for (const pct of PCTS) {
        const at = `viz ${panes} ${pct || 100}`
        await set(win, 'text.viz', pct)
        await until(() => vw.evaluate(f => [...document.querySelectorAll('.pick')].every(e => Math.abs(parseFloat(getComputedStyle(e).fontSize) - 11 * f) < 0.01), (pct || 100) / 100), `${at}: the drop-downs' text not at its size`)
        await sleep(1500)
        const s = await state()
        const dom = await vw.evaluate(() => [...document.querySelectorAll('.pane')].map(e => {
          const r = e.getBoundingClientRect()
          const b = e.querySelector('.pick').getBoundingClientRect()
          return { x: r.x, y: r.y, pick: { t: 'pick', x: b.x - r.x, y: b.y - r.y, w: b.width, h: b.height }, fonts: [e.querySelector('.pick'), e.querySelector('.mode')].map(x => parseFloat(getComputedStyle(x).fontSize)) }
        }))
        // The first pane's drop-down, opened by a press on its button.
        const b = s.panes[0].button
        await vw.mouse.click(b.x + b.w / 2, b.y + b.h / 2)
        await sleep(600)
        const rows = (await state()).menu
        const rowFont = await vw.evaluate(() => { const r = document.querySelector('#menu .item'); return r ? parseFloat(getComputedStyle(r).fontSize) : 0 })
        await shot(vw, path.join(out, `viz-${panes}-${pct || 100}-dropdown.png`))
        await vw.mouse.click(b.x + b.w / 2, b.y + b.h / 2)
        await sleep(600)
        await shot(vw, path.join(out, `viz-${panes}-${pct || 100}.png`))
        const W = 720
        const H = 460
        check(rows.length > 0 && rows.every(r => r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H), `${at}: a drop-down row leaves the window`)
        let texts = 0
        const widths = {}
        for (const p of s.panes) {
          check(p.mode === 'carbon' && p.probe && p.probe.texts, `${at}: pane ${p.tab} not in Carbon`)
          if (!p.probe || !p.probe.texts) continue
          const d = dom.find(q => q.x === p.x && q.y === p.y)
          const boxes = p.probe.texts.filter(t => t.w > 0 && t.h > 0).concat(d ? [d.pick] : [])
          texts += boxes.length
          for (const t of p.probe.texts) widths[t.t] = t.w
          for (let i = 0; i < boxes.length; i++) {
            for (let k = i + 1; k < boxes.length; k++) {
              const a = { x: boxes[i].x, y: boxes[i].y, width: boxes[i].w, height: boxes[i].h }
              const c = { x: boxes[k].x, y: boxes[k].y, width: boxes[k].w, height: boxes[k].h }
              check(!meet(a, c), `${at}: pane ${p.w}x${p.h}: "${boxes[i].t}" overlaps "${boxes[k].t}"`)
            }
          }
        }
        const now = { fonts: dom[0].fonts, rowFont, row: rows[0] ? rows[0].h : 0, widths }
        console.log(at, 'panes', s.panes.length, 'texts', texts, JSON.stringify(Object.assign({}, now, { widths: undefined })))
        check(s.panes.length === panes, `${at}: ${s.panes.length} panes`)
        if (!base) {
          base = now
          continue
        }
        const f = pct / 100
        check(now.fonts.every((x, i) => Math.abs(x / base.fonts[i] - f) < 0.01) && Math.abs(now.rowFont / base.rowFont - f) < 0.01, `${at}: the drop-down's and the caption's fonts ${now.fonts} ${now.rowFont}, want ${f} of ${base.fonts} ${base.rowFont}`)
        check(Math.abs(now.row / base.row - f) < 0.06, `${at}: drop-down rows ${now.row} px high, want ${f} of ${base.row}`)
        // Carbon's texts drawn at both sizes, the axes' among them: the
        // median ratio of their widths.
        const ratios = Object.keys(now.widths).filter(t => t.length >= 3 && base.widths[t] > 0).map(t => now.widths[t] / base.widths[t]).sort((x, y) => x - y)
        const mid = ratios[ratios.length >> 1]
        console.log(at, 'Carbon texts at both sizes', ratios.length, 'median width ratio', mid && mid.toFixed(3))
        check(ratios.length >= 2 && Math.abs(mid - f) < 0.1, `${at}: Carbon's texts at ${mid} of their width, want ${f}`)
      }
    }
  } finally {
    await end(app)
  }
}

;(async () => {
  const state = path.join(out, 'state')
  fs.mkdirSync(state, { recursive: true })
  const settingsOf = () => JSON.parse(fs.readFileSync(path.join(state, 'claude-skins', 'settings.json'), 'utf8'))
  if (mode === 'viz') {
    await viz(state)
    check(settingsOf()['text.viz'] === 70, 'want the last visualization size saved')
  }
  for (const s of SKINS.filter(s => !mode || s === mode)) {
    await one(s, state)
    // Kept across a relaunch: the last sizes set.
    const saved = settingsOf()
    console.log('saved', JSON.stringify(saved))
    check(saved['text.skin'] === 70 && saved['text.window'] === 70 && saved['terminal.fontSize'] === 10, 'want the last sizes saved')
    const { app, win } = await launch([fake], { appArgs: ['--skin', s, '--no-viz'], env: { SKINNED_GL: 'swiftshader', XDG_STATE_HOME: state } })
    await win.waitForFunction(() => typeof window.skinnedPage === 'function', null, { timeout: 30000 })
    await sleep(3000)
    const again = await win.evaluate(() => ({ root: getComputedStyle(document.documentElement).getPropertyValue('--window-text').trim(), strip: parseFloat(getComputedStyle(document.getElementById('strip')).fontSize), skin: window.skinnedPage().texts.map(t => t.fontSize) }))
    await end(app)
    console.log('relaunched', JSON.stringify({ root: again.root, strip: again.strip }))
    check(again.root === '0.7' && Math.abs(again.strip - 8.4) < 0.01, 'want the window text at 70 percent after a relaunch')
  }
  if (!mode) await viz(state)
  if (bad.length) {
    console.log(`${bad.length} failures, the first:`, bad[0])
    process.exit(1)
  }
  console.log('done')
})().catch(e => { console.error(e); process.exit(1) })
