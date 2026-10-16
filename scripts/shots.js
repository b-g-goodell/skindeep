'use strict'
// The README's screenshots, taken from the app as it is. Run under
//   scripts/clean-env xvfb-run -a -s "-screen 0 1920x1080x24" node scripts/shots.js OUT [--cwd DIR] [--fake] [--no-sheet]
// One window runs a real Claude Code session in DIR (default: this
// checkout), in default permission mode, on the user's own login. It
// sends PROMPT, a read-only question about this repository, and once
// the turn is done shoots the window in each skin, at the skin's own
// size: OUT/<skin>.png. Back in deck, a second tab sends FOLLOW_UP, and
// while that turn works the window and the visualization window are shot
// on tab 1 and set side by side: OUT/screenshot.png. Two prompts in all.
// Then scripts/checks/vizmodes.js writes the procedural modes' sheet,
// copied to OUT/viz-modes.png. --fake runs the replay fake instead, for
// a dry run that spends no tokens, and --no-sheet skips the sheet.
// The images the README shows are copied by hand into docs/. The strip
// and the CLI's banner show the paths of DIR and OUT/state.
const { launch, probe, shot, sleep } = require('./drive.js')
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const args = process.argv.slice(2)
const flag = f => { const i = args.indexOf(f); if (i >= 0) args.splice(i, 1); return i >= 0 }
const option = f => { const i = args.indexOf(f); return i >= 0 ? args.splice(i, 2)[1] : null }
const fake = flag('--fake')
const sheet = !flag('--no-sheet')
const cwd = path.resolve(option('--cwd') || root)
if (args.length !== 1) {
  console.error('usage: node scripts/shots.js OUT [--cwd DIR] [--fake] [--no-sheet]')
  process.exit(2)
}
const out = path.resolve(args[0])
fs.mkdirSync(out, { recursive: true })

const PROMPT = 'Using only the Read tool, read app/metrics/claude/parse.js. Open your answer with your three steps as a markdown task list, one "- [x] step" line each, then say in three short bullet points how it finds a session\'s task list.'
const FOLLOW_UP = 'Using only the Read tool, say in two sentences how app/viz/layout.js lays out the visualization window\'s panes.'
const SKINS = ['deck', 'phosphor', 'library', 'coffee']
const MODES = ['fern', 'zoom']
const PAD = 24
const GAP = 8

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

async function until (fn, ms, msg, step = 250) {
  for (let t = 0; t < ms; t += step) {
    const v = await fn()
    if (v) return v
    await sleep(step)
  }
  const v = await fn()
  if (!v && msg) throw new Error(msg)
  return v
}

const main = app => app.evaluate(({ BrowserWindow }) => {
  return BrowserWindow.getAllWindows().find(x => !x.getTitle().startsWith('visualization')).getContentSize()
})
const resize = (app, w, h) => app.evaluate(({ BrowserWindow }, [w, h]) => {
  BrowserWindow.getAllWindows().find(x => !x.getTitle().startsWith('visualization')).setContentSize(w, h)
}, [w, h])
const resizeViz = (app, w, h) => app.evaluate(({ BrowserWindow }, [w, h]) => {
  BrowserWindow.getAllWindows().find(x => x.webContents.getURL().includes('/viz/')).setContentSize(w, h)
}, [w, h])
const page = win => win.evaluate(() => window.skinnedPage())
const tabOf = async (app, id) => (await probe(app)).tabs.find(t => t.id === id)

// A tab's CLI is ready once it has drawn its prompt and gone quiet.
async function ready (app, id) {
  await until(async () => {
    const t = await tabOf(app, id)
    return t && t.snapshot['event.output'] > 0 && t.snapshot['pty.idle_s'] >= 2
  }, 60000, `tab ${id}: the CLI never settled`)
}

// Type a prompt into the active tab and wait for its turn to start.
async function send (app, win, id, text) {
  const stops = (await tabOf(app, id)).snapshot['event.stop'] || 0
  await win.keyboard.type(text)
  await sleep(300)
  await win.keyboard.press('Enter')
  await until(async () => (await tabOf(app, id)).snapshot['state.busy'] === 1, 60000, `tab ${id}: the turn never started`)
  return stops
}

async function done (app, id, stops) {
  await until(async () => {
    const s = (await tabOf(app, id)).snapshot
    return s['state.busy'] === 0 && (s['event.stop'] || 0) > stops
  }, 600000, `tab ${id}: the turn never finished`, 1000)
}

// Show a skin at its own initial size, and wait for its stage to settle.
async function wear (app, win, skin) {
  check((await win.evaluate(s => window.skinned.selectSkin(s), skin)).ok, `the app refused the skin ${skin}`)
  const sw = JSON.parse(fs.readFileSync(path.join(root, 'skins', skin, 'skin.json'), 'utf8')).window
  await resize(app, sw.width, sw.height)
  await until(async () => {
    const [w, h] = await main(app)
    const p = await page(win)
    return w === sw.width && h === sw.height && p.widgets.length && innerOk(p)
  }, 10000, `${skin}: the window did not take its size`)
  await sleep(2500)
}
const innerOk = p => p.panes.some(x => x.shown && x.cols > 0)

;(async () => {
  const env = { SKINNED_GL: 'swiftshader', XDG_STATE_HOME: path.join(out, 'state') }
  if (fake) env.PATH = `${path.join(root, 'scripts', 'fake')}:${process.env.PATH}`
  const { app, win } = await launch(['claude', '--permission-mode', 'default'], { appArgs: ['--skin', 'deck'], cwd, env })
  const pids = []
  try {
    const viz = await until(() => app.windows().find(w => w.url().includes('/viz/')), 10000, 'no visualization window')
    const first = await until(async () => (await probe(app)).tabs[0], 10000, 'no tab')
    pids.push(first.childPid)
    await ready(app, first.id)

    // The question, and its answer in every skin.
    const stops = await send(app, win, first.id, PROMPT)
    await done(app, first.id, stops)
    const want = fake ? 0 : 1
    await until(async () => { const w = (await page(win)).widgets.find(w => w.type === 'limits'); return w && w.rows && w.rows.length >= want }, 30000, 'no usage limit arrived')
    await sleep(3000)
    const s = (await tabOf(app, first.id)).snapshot
    console.log('limits', JSON.stringify((s['limits.items'] || []).map(l => l.key)), 'tasks', JSON.stringify((s['checklist.items'] || []).map(i => i.state)))
    for (const skin of SKINS) {
      await wear(app, win, skin)
      const p = await page(win)
      const t = p.panes.find(x => x.shown)
      await shot(win, path.join(out, `${skin}.png`))
      console.log('skin', skin, 'scrolled', t.viewportY, 'lines', t.lines.filter(l => l.trim()).length, 'rows', t.rows)
    }

    // Deck again, with a second tab at work beside the first, done.
    await wear(app, win, 'deck')
    await win.keyboard.press('Control+Shift+T')
    const second = await until(async () => (await probe(app)).tabs[1], 10000, 'no second tab')
    pids.push(second.childPid)
    await ready(app, second.id)
    await resizeViz(app, 620, 820)
    const vstate = () => viz.evaluate(() => window.vizState())
    for (const [k, id] of [first.id, second.id].entries()) {
      await win.evaluate(t => window.skinned.activateTab(t), id)
      await until(async () => (await vstate()).panes.some(p => p.tab === id && p.active), 5000, `tab ${id} not active`)
      check((await win.evaluate(m => window.skinned.selectViz(m), MODES[k])).ok, `the menu refused ${MODES[k]}`)
    }
    await sleep(500)
    const stops2 = await send(app, win, second.id, FOLLOW_UP)
    await win.evaluate(t => window.skinned.activateTab(t), first.id)
    await sleep(5000)
    if ((await tabOf(app, second.id)).snapshot['state.busy'] !== 1) console.log('warning: the second tab finished before the shot')
    await shot(win, path.join(out, 'main.png'))
    await shot(viz, path.join(out, 'viz.png'))
    const hero = await win.evaluate(async ({ a, b, pad, gap }) => {
      const load = src => new Promise(resolve => { const i = new Image(); i.onload = () => resolve(i); i.src = src })
      const [m, v] = [await load(a), await load(b)]
      const c = document.createElement('canvas')
      c.width = pad * 2 + m.width + gap + v.width
      c.height = pad * 2 + Math.max(m.height, v.height)
      const g = c.getContext('2d')
      g.fillStyle = '#000'
      g.fillRect(0, 0, c.width, c.height)
      g.drawImage(m, pad, pad)
      g.drawImage(v, pad + m.width + gap, pad)
      return c.toDataURL('image/png')
    }, { a: 'data:image/png;base64,' + fs.readFileSync(path.join(out, 'main.png')).toString('base64'), b: 'data:image/png;base64,' + fs.readFileSync(path.join(out, 'viz.png')).toString('base64'), pad: PAD, gap: GAP })
    fs.writeFileSync(path.join(out, 'screenshot.png'), Buffer.from(hero.split(',')[1], 'base64'))
    console.log('hero', path.join(out, 'screenshot.png'))
    await done(app, second.id, stops2)
  } finally {
    for (const pid of pids) if (pid > 0) try { process.kill(-pid, 'SIGHUP') } catch (e) {}
    await sleep(2000)
    await app.close().catch(() => {})
  }

  if (sheet) {
    const dir = path.join(out, 'viz-modes')
    const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'checks', 'vizmodes.js'), dir], { stdio: 'inherit' })
    check(r.status === 0, `vizmodes.js exited ${r.status}`)
    fs.copyFileSync(path.join(dir, 'viz-modes.png'), path.join(out, 'viz-modes.png'))
    console.log('sheet', path.join(out, 'viz-modes.png'))
  }
  console.log('done')
})().catch(e => { console.error(e); process.exit(1) })
