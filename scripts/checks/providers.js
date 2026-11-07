'use strict'
// Live check of the provider readings (decision 0038, issue #211) in
// every shipped skin, on the replay fakes. Run under
// scripts/clean-env xvfb-run -a -s "-screen 0 1920x1080x24":
//   node scripts/checks/providers.js OUT [skin ...]
// Hermetic: DeepSeek's balance endpoint is a fake on 127.0.0.1 this
// check runs, named to the app by a provider table (SKINNED_PROVIDERS)
// whose DeepSeek entry lists that host, and no real provider is asked.
// Three sessions a skin:
// - claude-deepseek: a Claude Code profile whose settings env points
//   ANTHROPIC_BASE_URL at the fake, with a key that reads 110.00 CNY.
// - codex-deepseek: a Codex config.toml whose model_providers entry
//   does, with a key in its env_key that reads 0.40 USD, too low.
// - claude-anthropic: a profile with no base URL.
// Each DeepSeek session draws its balance and the peak state the
// schedule gives now, and no limit, and the fake got one read with
// that session's key alone. The Anthropic session draws its 5h and 7d
// limits, no balance and no peak, and the fake got nothing from it.
// No key reaches the log, the page or the runtime dir. Writes
// OUT/<skin>-<session>.png and OUT/<skin>-<session>-quarter.png. The
// peak state wanted is worked out just before each reading of the
// page, so only a run that reads the page across a switch (01:00,
// 04:00, 06:00 or 10:00 UTC on a weekday) can fail on it.
const { launch, probe, childPid, shot, sleep } = require('../drive.js')
const fs = require('fs')
const http = require('http')
const path = require('path')

const out = path.resolve(process.argv[2])
fs.mkdirSync(out, { recursive: true })
const root = path.join(__dirname, '..', '..')
const fakes = path.join(__dirname, '..', 'fake')
const SKINS = process.argv.length > 3 ? process.argv.slice(3) : ['deck', 'phosphor', 'coffee', 'library']
const TILE = [960, 1048 / 2 - 37]
const KEY_CLAUDE = 'test-key-claude-5d1e88'
const KEY_CODEX = 'test-key-codex-9b03c4'
const ANSWERS = {
  [KEY_CLAUDE]: JSON.parse(fs.readFileSync(path.join(root, 'test', 'fixtures', 'provider', 'deepseek-balance.json'), 'utf8')),
  [KEY_CODEX]: { is_available: false, balance_infos: [{ currency: 'USD', total_balance: '0.40', granted_balance: '0.00', topped_up_balance: '0.40' }] }
}

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

// The fake balance endpoint, and every request it got.
const seen = []
const server = http.createServer((req, res) => {
  seen.push({ path: req.url, auth: req.headers.authorization || null, host: req.headers.host })
  const key = (req.headers.authorization || '').replace(/^Bearer /, '')
  if (req.url !== '/user/balance' || !ANSWERS[key]) {
    res.writeHead(req.url === '/user/balance' ? 401 : 404)
    return res.end('{}')
  }
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify(ANSWERS[key]))
})

// DeepSeek's peak state now, from its published hours, worked out here.
function peakNow (entry) {
  const d = new Date()
  const m = d.getUTCHours() * 60 + d.getUTCMinutes()
  const beijing = new Date(d.getTime() + entry.peak.holidays.offset_minutes * 60000).toISOString().slice(0, 10)
  const hours = entry.peak.hours.map(([a, b]) => [a, b].map(s => Number(s.slice(0, 2)) * 60 + Number(s.slice(3))))
  return entry.peak.days.includes(d.getUTCDay()) && hours.some(([a, b]) => m >= a && m < b) && !entry.peak.holidays.dates.includes(beijing)
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

// The rows of the limits widget against those wanted, in order, each
// inside the widget, together spanning it.
function judge (w, want, at) {
  check(w, `${at}: no limits widget`)
  check(w.visible, `${at}: the limits widget is hidden`)
  const rows = w.rows
  check(rows.map(r => r.key).join() === want.map(x => x.key).join(), `${at}: rows ${rows.map(r => r.key)}, want ${want.map(x => x.key)}`)
  const b = { width: rows[0].within.width, height: rows[0].within.height }
  rows.forEach((r, i) => {
    const x = want[i]
    check(r.kind === x.kind, `${at}: ${r.key} is a ${r.kind}, want a ${x.kind}`)
    if (x.label) check(r.label === x.label, `${at}: ${r.key} labelled "${r.label}", want "${x.label}"`)
    if (x.value) check(r.value === x.value, `${at}: ${r.key} reads "${r.value}", want "${x.value}"`)
    if (x.resets) check(/\d/.test(r.resets), `${at}: ${r.key} shows no time: "${r.resets}"`)
    for (const c of x.classes || []) check(r.classes.includes(c), `${at}: ${r.key} lacks class ${c}`)
    for (const c of x.without || []) check(!r.classes.includes(c), `${at}: ${r.key} has class ${c}`)
    check(r.box.width > 4 && r.box.height > 4, `${at}: ${r.key} has no size`)
    check(r.box.x >= -1 && r.box.y >= -1 && r.box.x + r.box.width <= b.width + 1 && r.box.y + r.box.height <= b.height + 1, `${at}: ${r.key} runs outside the widget`)
  })
  const x0 = Math.min(...rows.map(r => r.box.x))
  const y0 = Math.min(...rows.map(r => r.box.y))
  const x1 = Math.max(...rows.map(r => r.box.x + r.box.width))
  const y1 = Math.max(...rows.map(r => r.box.y + r.box.height))
  const fill = [(x1 - x0) / b.width, (y1 - y0) / b.height]
  check(fill[0] > 0.85 && fill[1] > 0.85, `${at}: the rows span ${fill.map(f => f.toFixed(2))} of the widget, a hole`)
  return fill.map(f => Number(f.toFixed(2)))
}

async function one (skin, name, s, base, entry) {
  const before = seen.length
  const { app, win } = await launch([s.cmd], { appArgs: ['--skin', skin, '--no-viz'], env: Object.assign({}, base, s.env) })
  let stderr = ''
  app.process().stderr.on('data', x => { stderr += x })
  try {
    await sleep(2500)
    const keys = s.want(false).map(x => x.key).join()
    const ready = await until(async () => { const q = await page(win); const w = limitsOf(q); return w && w.rows && w.rows.map(r => r.key).join() === keys && q }, s.cmd === 'codex' ? 90000 : 30000)
    await sleep(1500)
    await shot(win, path.join(out, `${skin}-${name}.png`))
    let peak = peakNow(entry)
    const p = await page(win)
    const full = judge(limitsOf(p), s.want(peak), `${skin} ${name}`)
    check(ready, `${skin} ${name}: the rows never settled`)
    const following = (await probe(app)).following
    const ch = following.channels.find(c => c.name === 'balance')
    await resize(app, ...TILE)
    await sleep(1500)
    await shot(win, path.join(out, `${skin}-${name}-quarter.png`))
    peak = peakNow(entry)
    const q = await page(win)
    const quarter = judge(limitsOf(q), s.want(peak), `${skin} ${name} quarter`)
    const mine = seen.slice(before)
    if (s.key) {
      check(ch && ch.state === 'live', `${skin} ${name}: the balance channel is ${ch ? ch.state : 'absent'}`)
      check(mine.length === 1 && mine[0].path === '/user/balance' && mine[0].auth === `Bearer ${s.key}` && mine[0].host === `127.0.0.1:${server.address().port}`, `${skin} ${name}: the fake saw ${JSON.stringify(mine)}`)
    } else {
      check(!ch, `${skin} ${name}: a balance channel on an Anthropic session`)
      check(mine.length === 0, `${skin} ${name}: the fake saw ${mine.length} requests`)
    }
    const text = JSON.stringify(p) + JSON.stringify(q)
    for (const k of [KEY_CLAUDE, KEY_CODEX]) {
      check(!stderr.includes(k), `${skin} ${name}: a key in the log`)
      check(!text.includes(k), `${skin} ${name}: a key in the page`)
    }
    const lines = stderr.split('\n').filter(l => /provider/.test(l)).map(l => l.trim())
    console.log(skin, name, JSON.stringify({ peak, rows: p.widgets.find(w => w.type === 'limits').rows.map(r => `${r.key}: ${r.label} ${r.value} ${r.resets}`.trim()), fill: full, quarterFill: quarter, requests: mine.length, channel: ch ? ch.state : null, log: lines }))
  } finally {
    const pid = await childPid(app).catch(() => null)
    if (pid > 0) try { process.kill(-pid, 'SIGHUP') } catch (e) {}
    await sleep(1000)
    await app.close().catch(() => {})
  }
}

// Every file under dir that holds a key's bytes.
function holders (dir) {
  const hits = []
  const walk = d => {
    let es = []
    try { es = fs.readdirSync(d, { withFileTypes: true }) } catch (e) { return }
    for (const e of es) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.isFile()) try { const b = fs.readFileSync(p); if (b.includes(KEY_CLAUDE) || b.includes(KEY_CODEX)) hits.push(p) } catch (err) {}
    }
  }
  walk(dir)
  return hits
}

;(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const shipped = JSON.parse(fs.readFileSync(path.join(root, 'app', 'metrics', 'provider', 'providers.json'), 'utf8'))
  const entry = shipped.providers.find(p => p.id === 'deepseek')
  entry.hosts = ['127.0.0.1']
  const table = path.join(out, 'providers.json')
  fs.writeFileSync(table, JSON.stringify(shipped))
  const base = { SKINNED_GL: 'swiftshader', PATH: `${fakes}:${process.env.PATH}`, SKINNED_PROVIDERS: table }
  for (const [k, d] of [['XDG_RUNTIME_DIR', 'run'], ['HOME', 'home']]) {
    base[k] = path.join(out, d)
    fs.mkdirSync(base[k], { recursive: true, mode: 0o700 })
  }
  const dir = n => { const d = path.join(out, n); fs.mkdirSync(d, { recursive: true, mode: 0o700 }); return d }
  const dsClaude = dir('claude-deepseek')
  fs.writeFileSync(path.join(dsClaude, 'settings.json'), JSON.stringify({ env: { ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}/anthropic`, ANTHROPIC_AUTH_TOKEN: KEY_CLAUDE, ANTHROPIC_MODEL: 'deepseek-flash' } }))
  const dsCodex = dir('codex-deepseek')
  fs.writeFileSync(path.join(dsCodex, 'config.toml'), `model = "deepseek-v4-pro"\nmodel_provider = "deepseek"\n\n[model_providers.deepseek]\nname = "deepseek"\nbase_url = "http://127.0.0.1:${port}/"\nwire_api = "responses"\nenv_key = "DEEPSEEK_API_KEY"\n`)
  const anthropic = dir('claude-anthropic')
  const peakRow = peak => ({ key: 'peak', kind: 'peak', label: peak ? 'peak price' : 'off-peak', resets: true, [peak ? 'classes' : 'without']: ['on'] })
  const SESSIONS = {
    'claude-deepseek': { cmd: 'claude', key: KEY_CLAUDE, env: { CLAUDE_CONFIG_DIR: dsClaude, FAKE_CLAUDE_MODELS: '0' }, want: peak => [{ key: 'balance.CNY', kind: 'balance', label: 'balance', value: '110.00 CNY', without: ['unavailable'] }, peakRow(peak)] },
    'codex-deepseek': { cmd: 'codex', key: KEY_CODEX, env: { CODEX_HOME: dsCodex, CLAUDE_CONFIG_DIR: anthropic, DEEPSEEK_API_KEY: KEY_CODEX }, want: peak => [{ key: 'balance.USD', kind: 'balance', label: 'balance', value: '0.40 USD', classes: ['unavailable'] }, peakRow(peak)] },
    'claude-anthropic': { cmd: 'claude', key: null, env: { CLAUDE_CONFIG_DIR: anthropic, FAKE_CLAUDE_MODELS: '0' }, want: () => [{ key: 'five_hour', kind: 'limit', resets: true }, { key: 'seven_day', kind: 'limit', resets: true }] }
  }
  try {
    for (const skin of SKINS) for (const [name, s] of Object.entries(SESSIONS)) await one(skin, name, s, base, entry)
    const files = holders(base.XDG_RUNTIME_DIR)
    check(!files.length, `a key on disk in the runtime dir: ${files.join(', ')}`)
  } finally {
    server.close()
  }
  console.log('done')
})().catch(e => { console.error(e); process.exit(1) })
