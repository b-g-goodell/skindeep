'use strict'
// The provider readings (decision 0038): the table, which provider a
// session runs on, the key its CLI sends, the balance read and its
// parse, the peak schedule, the seam's part and the vocabulary.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const http = require('http')
const path = require('path')
const table = require('../app/metrics/provider/table')
const detect = require('../app/metrics/provider/detect')
const peak = require('../app/metrics/provider/peak')
const balance = require('../app/metrics/provider/balance')
const provider = require('../app/metrics/provider')
const names = require('../app/metrics/names')
const { Bus } = require('../app/metrics/bus')
const { open } = require('../app/metrics/agent')

const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'provider', 'deepseek-balance.json'), 'utf8'))
const TABLE = table.load(table.FILE)
const DEEPSEEK = TABLE.find(p => p.id === 'deepseek')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function tempDir (t) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'provider-'))
  t.after(() => fs.rmSync(d, { recursive: true, force: true }))
  return d
}

// A Claude profile in d whose settings.json holds `settings`.
function claudeCtx (d, settings, env = {}, cmd = ['claude']) {
  const cfg = path.join(d, 'cfg')
  fs.mkdirSync(cfg, { recursive: true })
  fs.mkdirSync(path.join(d, 'work', '.git'), { recursive: true })
  if (settings) fs.writeFileSync(path.join(cfg, 'settings.json'), JSON.stringify(settings))
  return { cmd, cwd: path.join(d, 'work'), env: Object.assign({ PATH: process.env.PATH, CLAUDE_CONFIG_DIR: cfg }, env), managedDir: path.join(d, 'no-managed'), outside: p => p }
}

function codexCtx (d, config, env = {}, cmd = ['codex']) {
  const home = path.join(d, 'codex')
  fs.mkdirSync(home, { recursive: true })
  if (config !== null) fs.writeFileSync(path.join(home, 'config.toml'), config)
  return { cmd, cwd: d, env: Object.assign({ CODEX_HOME: home }, env), outside: p => p }
}

// --- the table ---

test('the shipped table: Anthropic and OpenAI the CLIs\' own, DeepSeek with a balance and a peak schedule', () => {
  const logged = []
  const t = table.load(table.FILE, m => logged.push(m))
  assert.deepStrictEqual(logged, [])
  assert.deepStrictEqual(t.map(p => [p.id, p.default || null, !!p.balance, !!p.peak]), [['anthropic', 'claude', false, false], ['openai', 'codex', false, false], ['deepseek', null, true, true]])
})

test('an unsound entry is left out and logged, the rest kept', t => {
  const d = tempDir(t)
  const f = path.join(d, 'p.json')
  fs.writeFileSync(f, JSON.stringify({ providers: [DEEPSEEK, { id: 'x', name: 'X', hosts: ['x.example'], balance: { path: 'no-slash', auth: 'bearer', list: 'a', currency: 'c', amount: 'm' } }, { id: 'y', name: 'Y', default: 'claude', hosts: ['y.example'], peak: DEEPSEEK.peak }] }))
  const logged = []
  assert.deepStrictEqual(table.load(f, m => logged.push(m)).map(p => p.id), ['deepseek'])
  assert.match(logged.join('\n'), /entry x left out: balance.path/)
  assert.match(logged.join('\n'), /entry y left out: a default provider reads nothing/)
  assert.deepStrictEqual(table.load(path.join(d, 'none.json'), () => {}), [])
})

test('match: no base URL or a default host is the CLI\'s own, a listed host its entry, any other host none', () => {
  assert.strictEqual(table.match(TABLE, null, 'claude').default, true)
  assert.strictEqual(table.match(TABLE, null, 'claude').entry.id, 'anthropic')
  assert.strictEqual(table.match(TABLE, 'https://api.anthropic.com', 'claude').default, true)
  const m = table.match(TABLE, 'https://api.deepseek.com/anthropic', 'claude')
  assert.deepStrictEqual([m.default, m.entry.id, m.origin], [false, 'deepseek', { scheme: 'https', host: 'api.deepseek.com', port: '' }])
  assert.strictEqual(table.match(TABLE, 'https://API.DeepSeek.com/', 'codex').entry.id, 'deepseek')
  assert.strictEqual(table.match(TABLE, 'https://gateway.example.com/v1', 'claude'), null)
  // Plain http only on loopback, no user in the URL, no other scheme.
  assert.strictEqual(table.match(TABLE, 'http://api.deepseek.com/anthropic', 'claude'), null)
  assert.strictEqual(table.match(TABLE, 'https://u:p@api.deepseek.com/', 'claude'), null)
  assert.strictEqual(table.match(TABLE, 'ftp://api.deepseek.com/', 'claude'), null)
  assert.strictEqual(table.match(TABLE, '', 'codex'), null)
  assert.deepStrictEqual(table.origin('http://127.0.0.1:8123/anthropic'), { scheme: 'http', host: '127.0.0.1', port: '8123' })
})

// --- Claude Code ---

test('claude: the base URL of the settings env, else the child\'s environment, else none', t => {
  const d = tempDir(t)
  assert.strictEqual(detect.claudeBase(claudeCtx(d, { env: { ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic' } }, { ANTHROPIC_BASE_URL: 'https://other.example' })), 'https://api.deepseek.com/anthropic')
  assert.strictEqual(detect.claudeBase(claudeCtx(d, { env: {} }, { ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic' })), 'https://api.deepseek.com/anthropic')
  assert.strictEqual(detect.claudeBase(claudeCtx(d, { env: {} })), null)
  // A project's local settings outrank the user's, and --settings both.
  const c = claudeCtx(d, { env: { ANTHROPIC_BASE_URL: 'https://a.example' } })
  fs.mkdirSync(path.join(c.cwd, '.claude'), { recursive: true })
  fs.writeFileSync(path.join(c.cwd, '.claude', 'settings.local.json'), JSON.stringify({ env: { ANTHROPIC_BASE_URL: 'https://b.example' } }))
  assert.strictEqual(detect.claudeBase(c), 'https://b.example')
  c.cmd = ['claude', '--settings', JSON.stringify({ env: { ANTHROPIC_BASE_URL: 'https://c.example' } })]
  assert.strictEqual(detect.claudeBase(c), 'https://c.example')
})

test('claude: the key in Claude Code\'s order, auth token, API key, then apiKeyHelper', async t => {
  const d = tempDir(t)
  assert.strictEqual(await detect.claudeKey(claudeCtx(d, { env: { ANTHROPIC_API_KEY: 'k-api', ANTHROPIC_AUTH_TOKEN: 'k-auth' } })), 'k-auth')
  assert.strictEqual(await detect.claudeKey(claudeCtx(d, { env: { ANTHROPIC_API_KEY: 'k-api' } }, { ANTHROPIC_AUTH_TOKEN: 'k-env' })), 'k-env')
  assert.strictEqual(await detect.claudeKey(claudeCtx(d, { env: {} }, { ANTHROPIC_API_KEY: 'k-env-api' })), 'k-env-api')
  const helper = path.join(d, 'helper.sh')
  fs.writeFileSync(helper, '#!/bin/sh\necho noise >&2\nprintf "k-helper\\n"\n', { mode: 0o755 })
  assert.strictEqual(await detect.claudeKey(claudeCtx(d, { apiKeyHelper: helper })), 'k-helper')
  const failing = path.join(d, 'fail.sh')
  fs.writeFileSync(failing, '#!/bin/sh\necho k-partial\nexit 1\n', { mode: 0o755 })
  assert.strictEqual(await detect.claudeKey(claudeCtx(d, { apiKeyHelper: failing })), null)
  assert.strictEqual(await detect.claudeKey(claudeCtx(d, {})), null)
})

// --- Codex ---

const CODEX_DEEPSEEK = `# DeepSeek's guide, with env_key
model = "deepseek-v4-pro"
model_provider = "deepseek"

[model_providers.deepseek]
name = "deepseek"
base_url = "https://api.deepseek.com/" # trailing comment
wire_api = "responses"
env_key = "DEEPSEEK_API_KEY"

[profiles.plain]
model_provider = "openai"
`

test('codex: the active model_providers entry\'s base_url, by config, profile and -c', t => {
  const d = tempDir(t)
  assert.strictEqual(detect.codexBase(codexCtx(d, CODEX_DEEPSEEK)), 'https://api.deepseek.com/')
  assert.strictEqual(detect.codexBase(codexCtx(d, CODEX_DEEPSEEK, {}, ['codex', '--profile', 'plain'])), null)
  assert.strictEqual(detect.codexBase(codexCtx(d, CODEX_DEEPSEEK, {}, ['codex', '-c', 'model_provider="openai"'])), null)
  assert.strictEqual(detect.codexBase(codexCtx(d, CODEX_DEEPSEEK, {}, ['codex', '-c', 'model_providers.deepseek.base_url=https://other.example/'])), 'https://other.example/')
  assert.strictEqual(detect.codexBase(codexCtx(tempDir(t), null)), null)
  assert.strictEqual(detect.codexBase(codexCtx(d, 'model_provider = "oss"\n')), '')
  assert.strictEqual(table.match(TABLE, detect.codexBase(codexCtx(d, 'model_provider = "oss"\n')), 'codex'), null)
})

test('codex: the key of env_key, else experimental_bearer_token', async t => {
  const d = tempDir(t)
  assert.strictEqual(await detect.codexKey(codexCtx(d, CODEX_DEEPSEEK, { DEEPSEEK_API_KEY: 'k-env' })), 'k-env')
  assert.strictEqual(await detect.codexKey(codexCtx(d, CODEX_DEEPSEEK)), null)
  const literal = 'model_provider = "deepseek"\n[model_providers.deepseek]\nbase_url = "https://api.deepseek.com/"\nexperimental_bearer_token = "k-literal"\n'
  assert.strictEqual(await detect.codexKey(codexCtx(d, literal)), 'k-literal')
})

test('toml: strings, quoted keys, dotted keys, comments', () => {
  const c = detect.toml('a = "x\\"y" # c\nb = \'lit\'\n[t."q.k"]\nn = 3\nf = true\nd.e = "z"\narr = [1, 2]\n')
  assert.deepStrictEqual(c, { a: 'x"y', b: 'lit', t: { 'q.k': { n: 3, f: true, d: { e: 'z' } } } })
})

// --- the balance ---

test('parse: DeepSeek\'s recorded /user/balance answer', () => {
  assert.deepStrictEqual(balance.parse(DEEPSEEK.balance, FIXTURE), { available: 1, items: [{ key: 'balance.CNY', label: 'balance', currency: 'CNY', amount: 110 }] })
  const two = { is_available: false, balance_infos: [{ currency: 'USD', total_balance: '0.00' }, { currency: 'CNY', total_balance: '3.5' }, { currency: 'X Y', total_balance: '1' }, { currency: 'EUR', total_balance: 'lots' }] }
  assert.deepStrictEqual(balance.parse(DEEPSEEK.balance, two), { available: 0, items: [{ key: 'balance.USD', label: 'balance', currency: 'USD', amount: 0 }, { key: 'balance.CNY', label: 'balance', currency: 'CNY', amount: 3.5 }] })
  // Nothing that reads: no items, never a zero.
  assert.deepStrictEqual(balance.parse(DEEPSEEK.balance, {}), { available: null, items: null })
})

function server (t, handler) {
  const seen = []
  const s = http.createServer((req, res) => { seen.push({ path: req.url, auth: req.headers.authorization, host: req.headers.host }); handler(req, res) })
  t.after(() => s.close())
  return new Promise(resolve => s.listen(0, '127.0.0.1', () => resolve({ seen, origin: { scheme: 'http', host: '127.0.0.1', port: String(s.address().port) } })))
}

test('get: one GET of the endpoint\'s path with the key as a bearer token, no redirect followed', async t => {
  const a = await server(t, (req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(FIXTURE)) })
  assert.deepStrictEqual(await balance.get(a.origin, DEEPSEEK.balance, 'k-1'), FIXTURE)
  assert.deepStrictEqual(a.seen, [{ path: '/user/balance', auth: 'Bearer k-1', host: `127.0.0.1:${a.origin.port}` }])
  const b = await server(t, (req, res) => { res.writeHead(302, { location: `http://127.0.0.1:${a.origin.port}/user/balance` }); res.end() })
  await assert.rejects(balance.get(b.origin, DEEPSEEK.balance, 'k-2'), /HTTP 302/)
  assert.strictEqual(a.seen.length, 1)
  const c = await server(t, (req, res) => { res.writeHead(401); res.end('{}') })
  await assert.rejects(balance.get(c.origin, DEEPSEEK.balance, 'k-3'), /HTTP 401/)
})

test('Balances: one read per account per refresh, absent again after a failed read', async () => {
  let t = 0
  let n = 0
  let fail = false
  const b = new balance.Balances({ now: () => t, refreshMs: 1000 })
  const read = async () => { n++; if (fail) throw new Error('HTTP 500'); return { available: 1, items: [] } }
  const a = b.get('acct', read)
  assert.strictEqual(a.value, null)
  await sleep(5)
  assert.strictEqual(a.version, 1)
  assert.ok(a.value)
  t = 500
  b.get('acct', read)
  await sleep(5)
  assert.strictEqual(n, 1)
  fail = true
  t = 1000
  b.get('acct', read)
  await sleep(5)
  assert.deepStrictEqual([n, a.value, a.error, a.version], [2, null, 'HTTP 500', 2])
})

// --- the peak schedule ---

const T = s => Date.parse(s)

test('peak: DeepSeek\'s hours, 01:00 to 04:00 and 06:00 to 10:00 UTC, Monday to Friday', () => {
  const s = DEEPSEEK.peak
  // Monday 2026-10-26.
  assert.deepStrictEqual(peak.state(s, T('2026-10-26T00:30:00Z')), { peak: 0, changes_at: T('2026-10-26T01:00:00Z') / 1000 })
  assert.deepStrictEqual(peak.state(s, T('2026-10-26T01:00:00Z')), { peak: 1, changes_at: T('2026-10-26T04:00:00Z') / 1000 })
  assert.deepStrictEqual(peak.state(s, T('2026-10-26T05:00:00Z')), { peak: 0, changes_at: T('2026-10-26T06:00:00Z') / 1000 })
  assert.deepStrictEqual(peak.state(s, T('2026-10-26T09:59:59Z')), { peak: 1, changes_at: T('2026-10-26T10:00:00Z') / 1000 })
  // Friday evening to Monday morning is off-peak.
  assert.deepStrictEqual(peak.state(s, T('2026-10-30T10:00:00Z')), { peak: 0, changes_at: T('2026-11-02T01:00:00Z') / 1000 })
  assert.deepStrictEqual(peak.state(s, T('2026-10-31T03:00:00Z')).peak, 0)
})

test('peak: a Chinese public holiday is off-peak, and past the holiday list there is no reading', () => {
  const s = DEEPSEEK.peak
  // Thursday 2026-10-01, National Day: off-peak until Thursday 10-08.
  assert.deepStrictEqual(peak.state(s, T('2026-10-01T02:00:00Z')), { peak: 0, changes_at: T('2026-10-08T01:00:00Z') / 1000 })
  // The list runs through 2026-12-31 in Beijing time, so Thursday
  // 2026-12-31 is read, and its last switch, 10:00 UTC, is known.
  assert.deepStrictEqual(peak.state(s, T('2026-12-31T08:00:00Z')), { peak: 1, changes_at: T('2026-12-31T10:00:00Z') / 1000 })
  // After it, the next switch falls past the list: none.
  assert.deepStrictEqual(peak.state(s, T('2026-12-31T12:00:00Z')), { peak: 0, changes_at: null })
  assert.strictEqual(peak.state(s, T('2026-12-31T16:00:00Z')), null)
  assert.strictEqual(peak.state(s, T('2027-01-04T02:00:00Z')), null)
  assert.strictEqual(peak.state(undefined, T('2026-10-26T02:00:00Z')), null)
})

// --- the part at the seam ---

const BAL = { 'limits.balances': undefined, 'limits.balance_available': undefined, 'limits.peak': undefined, 'limits.peak_changes_at': undefined }
const readings = bus => Object.fromEntries(Object.keys(BAL).map(k => [k, bus.get(k)]))

async function part (t, ctx, kind, providers) {
  const bus = new Bus()
  const p = provider.create(Object.assign({ bus, log: () => {} }, ctx), kind, { providers: () => providers, balances: new balance.Balances() })
  t.after(() => p.close())
  await p.prepare()
  return { bus, p }
}

function loopbackTable (port) {
  return [Object.assign({}, DEEPSEEK, { hosts: ['127.0.0.1'] })]
}

test('part: a DeepSeek Claude session gets its balance and peak state, the key sent to its host alone', async t => {
  const a = await server(t, (req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(FIXTURE)) })
  const d = tempDir(t)
  const ctx = claudeCtx(d, { env: { ANTHROPIC_BASE_URL: `http://127.0.0.1:${a.origin.port}/anthropic`, ANTHROPIC_AUTH_TOKEN: 'k-part' } })
  const { bus, p } = await part(t, ctx, 'claude', loopbackTable())
  assert.deepStrictEqual(readings(bus), BAL)
  assert.deepStrictEqual(p.report().channels.map(c => [c.name, c.state]), [['balance', 'waiting']])
  p.poll(Date.now())
  await sleep(100)
  p.poll(Date.now())
  const r = readings(bus)
  assert.deepStrictEqual(r['limits.balances'], [{ key: 'balance.CNY', label: 'balance', currency: 'CNY', amount: 110 }])
  assert.strictEqual(r['limits.balance_available'], 1)
  assert.ok([0, 1].includes(r['limits.peak']))
  assert.strictEqual(typeof r['limits.peak_changes_at'], 'number')
  assert.deepStrictEqual(a.seen, [{ path: '/user/balance', auth: 'Bearer k-part', host: `127.0.0.1:${a.origin.port}` }])
  assert.deepStrictEqual(p.report().channels.map(c => [c.name, c.state, c.target]), [['balance', 'live', `http://127.0.0.1:${a.origin.port}/user/balance`]])
})

test('part: with no key, the peak state alone and no request; a refused read leaves the balance absent', async t => {
  const a = await server(t, (req, res) => { res.writeHead(401); res.end('{}') })
  const d = tempDir(t)
  const none = await part(t, claudeCtx(d, { env: { ANTHROPIC_BASE_URL: `http://127.0.0.1:${a.origin.port}/anthropic` } }), 'claude', loopbackTable())
  none.p.poll(Date.now())
  await sleep(100)
  none.p.poll(Date.now())
  assert.deepStrictEqual([none.bus.get('limits.balances'), none.bus.get('limits.balance_available')], [null, null])
  assert.ok([0, 1].includes(none.bus.get('limits.peak')))
  assert.strictEqual(a.seen.length, 0)
  const d2 = tempDir(t)
  const bad = await part(t, claudeCtx(d2, { env: { ANTHROPIC_BASE_URL: `http://127.0.0.1:${a.origin.port}/anthropic`, ANTHROPIC_API_KEY: 'k-bad' } }), 'claude', loopbackTable())
  bad.p.poll(Date.now())
  await sleep(100)
  bad.p.poll(Date.now())
  assert.strictEqual(a.seen.length, 1)
  assert.strictEqual(bad.bus.get('limits.balances'), null)
})

test('part: an Anthropic, OpenAI or unlisted session writes nothing and reads no key', async t => {
  const d = tempDir(t)
  // A key helper that would leave a mark if it ran.
  const mark = path.join(d, 'ran')
  const helper = path.join(d, 'helper.sh')
  fs.writeFileSync(helper, `#!/bin/sh\ntouch ${mark}\necho k\n`, { mode: 0o755 })
  const cases = [
    ['claude', claudeCtx(d, { apiKeyHelper: helper, env: { ANTHROPIC_API_KEY: 'k' } })],
    ['claude', claudeCtx(d, { apiKeyHelper: helper, env: { ANTHROPIC_BASE_URL: 'https://api.anthropic.com' } })],
    ['claude', claudeCtx(d, { apiKeyHelper: helper, env: { ANTHROPIC_BASE_URL: 'https://gateway.example.com' } })],
    ['codex', codexCtx(tempDir(t), null)],
    ['codex', codexCtx(d, 'model_provider = "ollama"\n')]
  ]
  for (const [kind, ctx] of cases) {
    const { bus, p } = await part(t, ctx, kind, TABLE)
    p.poll(Date.now())
    await sleep(50)
    p.poll(Date.now())
    assert.deepStrictEqual(bus.snapshot(), {}, kind)
    assert.deepStrictEqual(p.report().channels, [])
  }
  assert.strictEqual(fs.existsSync(mark), false)
})

test('the seam: a Claude or Codex session has the provider part, a subcommand and plain have none', t => {
  const d = tempDir(t)
  const make = cmd => open({ cmd, cwd: d, env: { PATH: process.env.PATH, CLAUDE_CONFIG_DIR: d, CODEX_HOME: d }, runDir: d, root: d, store: d, options: { statusline: 'always' }, bus: new Bus(), log: () => {}, clock: { now: Date.now, every: () => () => {} } })
  const n = cmd => { const a = make(cmd); a.close(); return a.more.length }
  assert.deepStrictEqual([n(['claude']), n(['claude_work']), n(['codex']), n(['claude', 'attach', 'x']), n(['claude', 'mcp']), n(['bash'])], [1, 1, 1, 1, 0, 0])
})

// --- the vocabulary ---

test('the vocabulary: the provider readings are known, the balances a list, and survive a new session', () => {
  for (const k of Object.keys(BAL)) assert.ok(names.known(k), k)
  assert.ok(names.isList('limits.balances'))
  assert.ok(!names.isList('limits.peak'))
  const bus = new Bus()
  const s = bus.source({})
  s.set('limits.balances', [{ key: 'balance.CNY', label: 'balance', currency: 'CNY', amount: 1 }])
  s.set('limits.peak', 1)
  s.reset()
  assert.strictEqual(bus.get('limits.peak'), 1)
  assert.strictEqual(bus.get('limits.balances').length, 1)
})
