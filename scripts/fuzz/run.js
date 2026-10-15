'use strict'
// The fuzz harness. Run under xvfb-run:
//   node scripts/fuzz/run.js OUT [--seed N] [--steps N] [--skin NAME]
//                                [--agent claude|codex] [--until K]
//                                [--break NAME]
// Writes OUT/predictions.md and .json from the seed before the app
// starts, then drives the app on the fake agent, step by step, recording
// OUT/steps/<k>-main.png, <k>-viz.png and <k>.json, and compares each
// step's claims with what the app shows. Mismatches, and any page or
// console error, go to OUT/findings.md and .json, each classed
// 'unreviewed' until a reviewer looks at its screenshots and classes it a
// defect, a harness flaw or a wrong prediction. --until K replays a seed to
// step K. --break NAME runs a copy of the app with a known defect, to
// show the harness finds it: next-tab wires the menu's Next tab to the
// previous tab.
const { launch, probe, openMenu, sleep } = require('../drive.js')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { generate } = require('./model')
const { MODES } = require('../../app/viz/modes')

const root = path.join(__dirname, '..', '..')
const fake = path.join(root, 'scripts', 'fake')

function args (argv) {
  const o = { out: path.resolve(argv[0]), seed: Date.now() % 1000000, steps: 30, skin: 'deck', agent: 'claude', until: null, brk: null }
  for (let i = 1; i < argv.length; i += 2) {
    const v = argv[i + 1]
    if (argv[i] === '--seed') o.seed = Number(v)
    else if (argv[i] === '--steps') o.steps = Number(v)
    else if (argv[i] === '--skin') o.skin = v
    else if (argv[i] === '--agent') o.agent = v
    else if (argv[i] === '--until') o.until = Number(v)
    else if (argv[i] === '--break') o.brk = v
    else throw new Error(`unknown option ${argv[i]}`)
  }
  return o
}

const BREAKS = {
  'next-tab': ['app/renderer/menu.js', "item('Next tab', then(() => api.stepTab(1))", "item('Next tab', then(() => api.stepTab(-1))"]
}

// A copy of the app tree with one known defect, removed by the caller.
function brokenTree (name, dir) {
  const [file, from, to] = BREAKS[name] || []
  if (!file) throw new Error(`no break ${name}: ${Object.keys(BREAKS).join(', ')}`)
  fs.cpSync(path.join(root, 'app'), path.join(dir, 'app'), { recursive: true })
  fs.copyFileSync(path.join(root, 'package.json'), path.join(dir, 'package.json'))
  for (const d of ['node_modules', 'skins']) fs.symlinkSync(path.join(root, d), path.join(dir, d))
  const f = path.join(dir, file)
  const s = fs.readFileSync(f, 'utf8')
  if (!s.includes(from)) throw new Error(`break ${name}: ${file} no longer holds its line`)
  fs.writeFileSync(f, s.replace(from, to))
}

function predictionsMd (o, steps) {
  const lines = [`# Predictions, seed ${o.seed}`, '', `Written before the run, from scripts/fuzz/model.js. Skin ${o.skin} at launch, ${steps.length} steps.`, '']
  for (const s of steps) {
    lines.push(`${s.k}. ${s.action}${Object.keys(s.arg).length ? ' ' + JSON.stringify(s.arg) : ''}: ${s.says}`)
    lines.push(`   Claims: ${JSON.stringify(s.claims)}`)
  }
  return lines.join('\n') + '\n'
}

const isMain = w => !w.isClosed() && w.url().includes('/renderer/')
const isViz = w => !w.isClosed() && w.url().includes('/viz/')

async function menuItem (win, re) {
  await openMenu(win)
  await win.locator('#menu .item').filter({ hasText: re }).first().click({ timeout: 5000 })
}

async function flyout (win, title, re) {
  await openMenu(win)
  await win.locator('#menu .submenu', { hasText: title }).hover({ timeout: 5000 })
  await sleep(200)
  await win.locator('#menu .submenu .sub .item').filter({ hasText: re }).first().click({ timeout: 5000 })
}

const exact = text => new RegExp(`^[* ]\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)

// A menu an action left open is a finding of that step, closed before
// the next one so the run goes on.
const menuOpen = win => win.evaluate(() => !document.getElementById('menu').hidden)

async function act (app, win, s) {
  if (await menuOpen(win)) await win.keyboard.press('Escape')
  const viz = app.windows().find(isViz)
  const a = s.arg
  switch (s.action) {
    case 'chordNew': return win.keyboard.press('Control+Shift+T')
    case 'menuNew': return menuItem(win, /^New tabCtrl/)
    case 'chordClose': return win.keyboard.press('Control+Shift+W')
    case 'menuClose': return menuItem(win, /^Close tabCtrl/)
    case 'chordNext': return win.keyboard.press('Control+Tab')
    case 'chordPrev': return win.keyboard.press('Control+Shift+Tab')
    case 'menuNext': return menuItem(win, /^Next tabCtrl/)
    case 'menuPrev': return menuItem(win, /^Previous tabCtrl/)
    case 'reopen': return menuItem(win, /^Reopen closed tab/)
    case 'duplicate': return menuItem(win, /^Duplicate tab/)
    case 'drag': {
      const ids = await win.evaluate(() => [...document.querySelectorAll('#tabs .tab')].map(e => Number(e.dataset.id)))
      const box = async id => {
        for (let i = 0; i < 10; i++) {
          const b = await win.locator(`#tabs .tab[data-id="${id}"]`).boundingBox()
          if (b) return b
          await sleep(200)
        }
        const dom = await win.evaluate(() => document.getElementById('tabs').outerHTML.slice(0, 600))
        throw new Error(`drag: no box for tab ${id} of ${JSON.stringify(ids)}, strip ${dom}`)
      }
      const from = await box(ids[a.from])
      const to = await box(ids[a.to])
      await win.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
      await win.mouse.down()
      await win.mouse.move(to.x + 4, to.y + to.height / 2, { steps: 8 })
      return win.mouse.up()
    }
    case 'skin': return menuItem(win, exact(a.skin))
    case 'vizToggle': return menuItem(win, /^(Hide|Show) visualization$/)
    case 'vizMode': return flyout(win, 'Visualization mode', exact(MODES.find(m => m.id === a.mode).label))
    case 'vizClick': {
      if (!viz) return
      const st = await viz.evaluate(() => window.vizState())
      const p = st.panes.find(x => x.active) || st.panes[0]
      return viz.mouse.click(p.x + p.w / 2, p.y + p.h / 2)
    }
    case 'vizSpace': return viz && viz.keyboard.press('Space')
    case 'mute': return menuItem(win, /^(Mute|Unmute) skin sounds$/)
    case 'font': return flyout(win, 'Terminal font size', a.size === null ? /^[* ]\s*Skin default/ : exact(`${a.size} px`))
    case 'type': return win.keyboard.type(a.text)
    case 'resize': return app.evaluate(({ BrowserWindow }, w) => BrowserWindow.getAllWindows().find(x => !x.getTitle().startsWith('visualization')).setContentSize(w, 900), a.width)
    case 'wait': return sleep(a.ms)
  }
}

async function observe (app, win) {
  const pr = await probe(app)
  const page = await win.evaluate(() => window.skinnedPage())
  const viz = app.windows().find(isViz)
  const vs = viz ? await viz.evaluate(() => window.vizState ? window.vizState() : null).catch(() => null) : null
  const size = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(x => !x.getTitle().startsWith('visualization')).getContentSize())
  const active = pr.tabs.find(t => t.active)
  const pane = vs && active ? vs.panes.find(p => p.tab === active.id) : null
  const fonts = page.panes.filter(p => !p.dashboard).map(p => p.fontSize)
  return {
    tabs: pr.tabs.map(t => t.id),
    active: active ? active.id : null,
    windows: app.windows().filter(isMain).length,
    skin: page.sounds.skin,
    viz: !!vs,
    panes: vs ? vs.panes.length : null,
    mode: pane ? pane.mode : null,
    muted: page.sounds.muted,
    fontSize: fonts.every(f => f === fonts[0]) ? fonts[0] : fonts,
    width: size[0],
    scale: page.scale,
    menu: await menuOpen(win)
  }
}

function compare (c, seen, prev) {
  const bad = []
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  for (const k of ['tabs', 'active', 'windows', 'skin', 'viz', 'panes', 'muted', 'fontSize']) {
    if (c[k] !== null && !eq(c[k], seen[k])) bad.push({ claim: k, predicted: c[k], observed: seen[k] })
  }
  if (c.width !== null && seen.width !== c.width) bad.push({ claim: 'width', predicted: c.width, observed: seen.width })
  if (c.scale !== null && Math.abs(seen.scale - c.scale) > 0.01) bad.push({ claim: 'scale', predicted: c.scale, observed: seen.scale })
  if (c.mode !== undefined && seen.mode !== c.mode) bad.push({ claim: 'mode', predicted: c.mode, observed: seen.mode })
  if (c.modeChanged && prev && prev.active === seen.active && seen.mode === prev.mode) bad.push({ claim: 'modeChanged', predicted: `a mode other than ${prev.mode}`, observed: seen.mode })
  if (seen.menu) bad.push({ claim: 'menu', predicted: 'closed', observed: 'open' })
  if (seen.errors.length) bad.push({ claim: 'errors', predicted: 0, observed: seen.errors })
  return bad
}

function findingsMd (o, head, findings, ran) {
  const lines = [`# Findings, seed ${o.seed}`, '', `Skin ${o.skin}, agent ${o.agent}. Build ${head}${o.brk ? `, broken by --break ${o.brk}` : ''}. ${ran} of ${o.steps} steps run, ${findings.length} finding${findings.length === 1 ? '' : 's'}.`,
    `Replay a finding: node scripts/fuzz/run.js OUT --seed ${o.seed} --steps ${o.steps} --skin ${o.skin} --agent ${o.agent} --until <step>${o.brk ? ` --break ${o.brk}` : ''}`, '',
    'Each finding is unreviewed until a reviewer opens its screenshots and classes it a defect of the app, a harness flaw, or a wrong prediction.', '']
  for (const f of findings) {
    lines.push(`## Step ${f.step}: ${f.action} ${JSON.stringify(f.arg)}, claim ${f.claim}`, '')
    lines.push(`- Predicted: ${JSON.stringify(f.predicted)}`, `- Observed: ${JSON.stringify(f.observed)}`, `- Prediction: ${f.says}`, `- Screenshots: ${f.shots.join(', ')}`, `- Class: ${f.class}`)
    if (f.after) lines.push(`- After the mismatch of step ${f.after}: may repeat it`)
    lines.push('')
  }
  return lines.join('\n') + '\n'
}

async function run (o) {
  const steps = generate(o.seed, o.steps, o.skin)
  fs.mkdirSync(path.join(o.out, 'steps'), { recursive: true })
  const md = predictionsMd(o, steps)
  fs.writeFileSync(path.join(o.out, 'predictions.md'), md)
  fs.writeFileSync(path.join(o.out, 'predictions.json'), JSON.stringify({ seed: o.seed, skin: o.skin, steps }, null, 1) + '\n')
  let head = 'unknown'
  try { head = execFileSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim() } catch (e) {}
  fs.writeFileSync(path.join(o.out, 'run.json'), JSON.stringify({ seed: o.seed, steps: o.steps, skin: o.skin, agent: o.agent, until: o.until, break: o.brk, head, predictions: crypto.createHash('sha256').update(md).digest('hex') }, null, 1) + '\n')

  const tree = o.brk ? path.join(o.out, 'tree') : null
  const findings = []
  let ran = 0
  try {
    if (tree) brokenTree(o.brk, tree)
    const env = { SKINNED_GL: 'swiftshader', PATH: `${fake}:${process.env.PATH}` }
    if (!['claude', 'codex'].includes(o.agent)) throw new Error(`no fake agent ${o.agent}`)
    const { app, win } = await launch([path.join(fake, o.agent)], { appArgs: ['--skin', o.skin], env, root: tree || undefined })
    const log = fs.createWriteStream(path.join(o.out, 'app.log'))
    app.process().stderr.on('data', d => log.write(d))
    let errors = []
    const watch = w => {
      w.on('pageerror', e => errors.push(`${w.url()}: pageerror: ${e.message}`))
      w.on('console', m => { if (m.type() === 'error') errors.push(`${w.url()}: console: ${m.text()}`) })
    }
    for (const w of app.windows()) watch(w)
    app.on('window', watch)
    await sleep(3000)
    let prev = null
    const last = o.until ? Math.min(o.until, steps.length) : steps.length
    for (const s of steps.slice(0, last)) {
      // An action the app does not let the user take is a finding.
      let failed = null
      try { await act(app, win, s) } catch (e) { failed = String(e.message) }
      await sleep(900)
      const seen = Object.assign(await observe(app, win), { errors })
      if (failed) seen.errors = seen.errors.concat(`action: ${failed.split('\n')[0]}`)
      if (failed) seen.actionLog = failed
      errors = []
      const pad = String(s.k).padStart(3, '0')
      const shots = [path.join('steps', `${pad}-main.png`)]
      await win.screenshot({ path: path.join(o.out, shots[0]) })
      const viz = app.windows().find(isViz)
      if (viz) {
        shots.push(path.join('steps', `${pad}-viz.png`))
        await viz.screenshot({ path: path.join(o.out, shots[1]) }).catch(() => shots.pop())
      }
      fs.writeFileSync(path.join(o.out, 'steps', `${pad}.json`), JSON.stringify({ step: s, seen }, null, 1) + '\n')
      // The model does not follow the app after a mismatch, so a later
      // finding may only repeat an earlier one: it names the first.
      const first = findings.length ? findings[0].step : null
      for (const b of compare(s.claims, seen, prev)) findings.push(Object.assign({ seed: o.seed, step: s.k, action: s.action, arg: s.arg, says: s.says, shots, class: 'unreviewed', after: first }, b))
      console.log(`step ${s.k} ${s.action} ${JSON.stringify(s.arg)}: ${findings.filter(f => f.step === s.k).map(f => f.claim).join(', ') || 'as predicted'}`)
      prev = seen
      ran = s.k
    }
    for (const t of (await probe(app)).tabs) try { process.kill(-t.childPid, 'SIGHUP') } catch (e) {}
    await sleep(2000)
    await app.close().catch(() => {})
    log.end()
  } finally {
    if (tree) fs.rmSync(tree, { recursive: true, force: true })
    fs.writeFileSync(path.join(o.out, 'findings.json'), JSON.stringify(findings, null, 1) + '\n')
    fs.writeFileSync(path.join(o.out, 'findings.md'), findingsMd(o, head, findings, ran))
  }
  console.log(`seed ${o.seed}: ${ran} steps, ${findings.length} findings, ${path.join(o.out, 'findings.md')}`)
}

run(args(process.argv.slice(2))).catch(e => { console.error(e); process.exit(1) })
