'use strict'
// Live check of the usage limits (decision 0011, issue #142) in every
// shipped skin, with the replay fakes. Run under
// scripts/clean-env xvfb-run -a -s "-screen 0 1920x1080x24":
//   node scripts/checks/limits.js OUT [skin ...]
// Four sessions a skin: Claude with four limits (5h, 7d and two models'
// 7d, in the shape the parser takes for a per-model window), Claude
// with no model's limit (as Claude Code 2.1.301 sends), a gateway
// session's spend limit alone, and Codex with its account's 7d and
// GPT-5.3-Codex-Spark's 5h and 7d. In each, every limit sent has one
// labelled meter with its reset, no other meter is drawn, and the
// meters fill the widget's rect, so an absent limit leaves no hole.
// Writes OUT/<skin>-<session>.png at the initial size and
// OUT/<skin>-<session>-quarter.png in a quarter tile.
const { launch, childPid, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
fs.mkdirSync(out, { recursive: true })
const fakes = path.join(__dirname, '..', 'fake')
const SKINS = process.argv.length > 3 ? process.argv.slice(3) : ['deck', 'phosphor', 'coffee', 'library']
const TILE = [960, 1048 / 2 - 37]
const base = { SKINNED_GL: 'swiftshader', PATH: `${fakes}:${process.env.PATH}` }
for (const [k, d] of [['XDG_RUNTIME_DIR', 'run'], ['HOME', 'home'], ['CLAUDE_CONFIG_DIR', 'config'], ['CODEX_HOME', 'codex']]) {
  base[k] = path.join(out, d)
  fs.mkdirSync(base[k], { recursive: true, mode: 0o700 })
}

const SESSIONS = {
  models: { cmd: 'claude', env: { FAKE_CLAUDE_MODELS: '1' }, keys: ['five_hour', 'seven_day', 'seven_day_opus', 'seven_day_sonnet'] },
  plain: { cmd: 'claude', env: { FAKE_CLAUDE_MODELS: '0' }, keys: ['five_hour', 'seven_day'] },
  gateway: { cmd: 'claude', env: { FAKE_CLAUDE_GATEWAY: '1' }, keys: ['spend_limit'] },
  codex: { cmd: 'codex', env: {}, keys: ['codex.7d', 'codex_bengalfox.5h', 'codex_bengalfox.7d'] }
}

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

const page = win => win.evaluate(() => window.skinnedPage())
const limitsOf = p => p.widgets.find(w => w.type === 'limits')
const resize = (app, w, h) => app.evaluate(({ BrowserWindow }, [w, h]) => {
  BrowserWindow.getAllWindows().find(x => !x.getTitle().startsWith('visualization')).setContentSize(w, h)
}, [w, h])

async function until (fn, ms, step = 500) {
  for (let t = 0; t < ms; t += step) {
    const v = await fn()
    if (v) return v
    await sleep(step)
  }
  return fn()
}

// The meters of the limits widget against the keys sent: one each, in
// order, labelled, with a reset, inside the widget, and spanning it.
function judge (w, keys, at) {
  check(w, `${at}: no limits widget`)
  check(w.visible, `${at}: the limits widget is hidden`)
  const rows = w.rows
  check(rows.map(r => r.key).join() === keys.join(), `${at}: meters ${rows.map(r => r.key)}, want ${keys}`)
  // Layout boxes in the widget's own pixels (app/renderer/widgets.js),
  // so the skin's scale and a meter's own transform do not count.
  const b = { x: 0, y: 0, width: rows[0].within.width, height: rows[0].within.height }
  for (const r of rows) {
    check(r.label.trim() && /\d|now/.test(r.resets), `${at}: ${r.key} lacks its label or reset: "${r.label}" "${r.resets}"`)
    check(r.box.width > 4 && r.box.height > 4, `${at}: ${r.key} has no size`)
    check(r.box.x >= b.x - 1 && r.box.y >= b.y - 1 && r.box.x + r.box.width <= b.x + b.width + 1 && r.box.y + r.box.height <= b.y + b.height + 1, `${at}: ${r.key} runs outside the widget`)
  }
  const x0 = Math.min(...rows.map(r => r.box.x))
  const y0 = Math.min(...rows.map(r => r.box.y))
  const x1 = Math.max(...rows.map(r => r.box.x + r.box.width))
  const y1 = Math.max(...rows.map(r => r.box.y + r.box.height))
  const fill = [(x1 - x0) / b.width, (y1 - y0) / b.height]
  check(fill[0] > 0.85 && fill[1] > 0.85, `${at}: the meters span ${fill.map(f => f.toFixed(2))} of the widget, a hole`)
  // An empty cell of a grid: the meters cover too little of their span.
  const cover = rows.reduce((a, r) => a + r.box.width * r.box.height, 0) / ((x1 - x0) * (y1 - y0))
  check(cover > 0.8, `${at}: the meters cover ${cover.toFixed(2)} of their span, an empty cell`)
  fill.push(cover)
  check(!rows.some(r => r.classes.includes('model')) === !keys.some(k => /opus|sonnet|bengalfox/.test(k)), `${at}: a model's meter where none was sent, or none where one was`)
  return fill
}

async function one (skin, name) {
  const s = SESSIONS[name]
  const { app, win } = await launch([s.cmd], { appArgs: ['--skin', skin, '--no-viz'], env: Object.assign({}, base, s.env) })
  try {
    await sleep(2500)
    const want = s.keys.join()
    const p = await until(async () => { const q = await page(win); const w = limitsOf(q); return w && w.rows && w.rows.map(r => r.key).join() === want && q }, name === 'codex' ? 90000 : 20000)
    const w = limitsOf(p || await page(win))
    await sleep(1500)
    await shot(win, path.join(out, `${skin}-${name}.png`))
    const full = judge(limitsOf(await page(win)), s.keys, `${skin} ${name}`)
    await resize(app, ...TILE)
    await sleep(1500)
    await shot(win, path.join(out, `${skin}-${name}-quarter.png`))
    const q = await page(win)
    const quarter = judge(limitsOf(q), s.keys, `${skin} ${name} quarter`)
    console.log(skin, name, JSON.stringify({ labels: w.rows.map(r => `${r.label} ${r.resets}`), fill: full, quarterFill: quarter, scale: q.scale }))
  } finally {
    const pid = await childPid(app).catch(() => null)
    if (pid > 0) try { process.kill(-pid, 'SIGHUP') } catch (e) {}
    await sleep(1000)
    await app.close().catch(() => {})
  }
}

;(async () => {
  for (const skin of SKINS) for (const name of Object.keys(SESSIONS)) await one(skin, name)
  console.log('done')
})().catch(e => { console.error(e); process.exit(1) })
