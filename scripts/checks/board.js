'use strict'
// Live check of the issue board in the sessions dashboard (decision
// 0029). Run under xvfb-run:
//   node scripts/checks/board.js OUT
// Hermetic: the forges are fake Gitea servers on 127.0.0.1 this check
// runs and scripts/fake/gh, git's credential helper is a test helper
// named by a test GIT_CONFIG_GLOBAL, and the sessions are fake claudes
// this check spawns in its own repositories and ends by their recorded
// pids. The dashboard also lists the user's real sessions, read only.
const { launch, probe, openMenu, shot, sleep } = require('../drive.js')
const fs = require('fs')
const http = require('http')
const path = require('path')
const { spawn, execFileSync } = require('child_process')

const out = path.resolve(process.argv[2])
const root = path.join(__dirname, '..', '..')
const fakes = path.join(root, 'scripts', 'fake')
const claudeFake = path.join(fakes, 'claude')
const keysFake = path.join(fakes, 'keys')
const state = path.join(out, 'state')
const lab = path.join(out, 'profiles', 'lab', '.claude')
const bytesDir = path.join(out, 'bytes')
const repos = path.join(out, 'repos')
for (const d of [state, lab, bytesDir, repos]) fs.mkdirSync(d, { recursive: true })
const TOKEN = 'test-token-7f3a91c0'
const DAY = 86400000
const now = Date.now()
const iso = t => new Date(t).toISOString()

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

// The fake Gitea of repo a: 60 issues over 20 days, in pages of 50, and
// every request it got. That of repo c has no login and must get none.
const giteaIssues = Array.from({ length: 60 }, (_, i) => ({ number: i + 1, created_at: iso(now - (20 - i / 3) * DAY), closed_at: i % 3 === 0 ? iso(now - (12 - i / 5) * DAY) : null }))
const seen = { a: [], c: [] }
function gitea (name) {
  return http.createServer((req, res) => {
    seen[name].push({ path: req.url, auth: req.headers.authorization || null, host: req.headers.host })
    const u = new URL(req.url, 'http://x')
    if (u.pathname !== '/api/v1/repos/o/r/issues' || u.searchParams.get('state') !== 'all') {
      res.writeHead(404)
      return res.end('[]')
    }
    if (req.headers.authorization !== `token ${TOKEN}`) {
      res.writeHead(401)
      return res.end('{}')
    }
    const page = Number(u.searchParams.get('page'))
    const limit = Number(u.searchParams.get('limit'))
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(giteaIssues.slice((page - 1) * limit, page * limit)))
  })
}
const listen = s => new Promise(resolve => s.listen(0, '127.0.0.1', () => resolve(s.address().port)))

const ghIssues = { 'gho/ghr': [
  { createdAt: iso(now - 30 * DAY), closedAt: '' },
  { createdAt: iso(now - 5 * DAY), closedAt: null },
  { createdAt: iso(now - 9 * DAY), closedAt: iso(now - 2 * DAY) }
] }
const ghFile = path.join(out, 'gh-issues.json')
fs.writeFileSync(ghFile, JSON.stringify(ghIssues))

// The counts the board column must show, worked out here from the
// fixtures: open now, closed in the last 14 local days.
const since = (() => { const d = new Date(now); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 13).getTime() })()
const want = list => `${list.filter(i => !i.closed).length} / ${list.filter(i => i.closed && i.closed >= since).length}`
const wantA = want(giteaIssues.map(i => ({ closed: i.closed_at && Date.parse(i.closed_at) })))
const wantB = want(ghIssues['gho/ghr'].map(i => ({ closed: i.closedAt && Date.parse(i.closedAt) })))

const foreign = []
let launched = null
const alive = pid => { try { process.kill(pid, 0); return true } catch (e) { return false } }

// A fake claude started outside the app in folder.
function elsewhere (folder) {
  const p = spawn(claudeFake, [], { cwd: folder, env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: lab }), stdio: ['pipe', 'ignore', 'ignore'] })
  const s = { folder, pid: p.pid }
  foreign.push(s)
  return s
}

function stop (s) {
  try { process.kill(s.pid, 'SIGTERM') } catch (e) {}
}

// Every file under dir that holds the bytes of TOKEN.
function holders (dir) {
  const hits = []
  const walk = d => {
    let es = []
    try { es = fs.readdirSync(d, { withFileTypes: true }) } catch (e) { return }
    for (const e of es) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.isFile()) try { if (fs.readFileSync(p).includes(TOKEN)) hits.push(p) } catch (err) {}
    }
  }
  walk(dir)
  return hits
}

async function until (fn, ms, step = 500) {
  for (let t = 0; t < ms; t += step) {
    const v = await fn()
    if (v) return v
    await sleep(step)
  }
  return fn()
}

async function menu (win, re) {
  await openMenu(win, 'Agents')
  await win.locator('#menu .item').filter({ hasText: re }).click()
}

const dash = async win => {
  const p = (await win.evaluate(() => window.skinnedPage())).panes.find(x => x.dashboard)
  return p ? p.dashboard : null
}
const rowOf = (d, s) => d && d.rows.find(r => r.key.startsWith(`${s.pid}:`))
const ghCalls = () => { try { return fs.readFileSync(path.join(bytesDir, 'gh-calls.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse) } catch (e) { return [] } }

async function main () {
  const sa = gitea('a')
  const sc = gitea('c')
  const pa = await listen(sa)
  const pc = await listen(sc)
  const helper = path.join(out, 'cred-helper')
  fs.writeFileSync(helper, `#!/bin/sh\n[ "$1" = get ] || exit 0\nwhile read -r l && [ -n "$l" ]; do :; done\necho username=check\necho password=${TOKEN}\n`, { mode: 0o755 })
  const gitconfig = path.join(out, 'gitconfig')
  fs.writeFileSync(gitconfig, `[credential "http://127.0.0.1:${pa}"]\n\thelper = ${helper}\n[user]\n\tname = check\n\temail = check@example.invalid\n`)
  const gitEnv = Object.assign({}, process.env, { GIT_CONFIG_GLOBAL: gitconfig, GIT_CONFIG_NOSYSTEM: '1' })
  const repo = (name, remote) => {
    const d = path.join(repos, name)
    fs.mkdirSync(d, { recursive: true })
    execFileSync('git', ['init', '-q', d], { env: gitEnv })
    if (remote) execFileSync('git', ['-C', d, 'remote', 'add', 'origin', remote], { env: gitEnv })
    return d
  }
  const a = repo('a', `http://127.0.0.1:${pa}/o/r.git`)
  const aSub = path.join(a, 'sub')
  fs.mkdirSync(aSub)
  const b = repo('b', 'https://github.com/gho/ghr.git')
  const c = repo('c', `http://127.0.0.1:${pc}/o/r.git`)
  const d = repo('d', null)
  const fa = elsewhere(a)
  const fs2 = elsewhere(aSub)
  const fb = elsewhere(b)
  const fc = elsewhere(c)
  const fd = elsewhere(d)
  await sleep(1500)

  const env = { SKINNED_GL: 'swiftshader', XDG_STATE_HOME: state, CLAUDE_CONFIG_DIR: lab, PATH: `${fakes}:${process.env.PATH}`, SKINNED_CHECK_OUT: bytesDir, GIT_CONFIG_GLOBAL: gitconfig, GIT_CONFIG_NOSYSTEM: '1', SKINNED_FAKE_GH_ISSUES: ghFile }
  const { app, win } = launched = await launch([keysFake], { appArgs: ['--skin', 'deck', '--no-viz'], env })
  let stderr = ''
  app.process().stderr.on('data', x => { stderr += x })
  const electron = app.process().pid
  await sleep(2500)
  await menu(win, /^Sessions dashboard$/)

  const ready = await until(async () => {
    const x = await dash(win)
    const rs = [fa, fs2, fb, fc, fd].map(s => rowOf(x, s))
    return rs.every(r => r && r.board !== undefined) && [rs[0], rs[2], rs[3]].every(r => r.board && r.board.state !== 'loading') && x
  }, 30000)
  check(ready, 'want every row with its board settled')
  await sleep(1000)
  let x = await dash(win)
  const cell = s => rowOf(x, s).boardText
  const cells = { a: cell(fa), aSub: cell(fs2), b: cell(fb), c: cell(fc), d: cell(fd) }
  console.log('board cells', JSON.stringify(cells), 'want', JSON.stringify({ a: wantA, b: wantB }))
  await shot(win, path.join(out, 'board.png'))
  check(cells.a === wantA && cells.aSub === wantA, `want repo a's board, shared by its subfolder, ${wantA}`)
  check(cells.b === wantB, `want the github.com board through gh, ${wantB}`)
  check(cells.c === 'no access' && cells.d === '', 'want no access without a login and nothing without a remote')
  const open = rowOf(x, fa).board.open
  check(open.length === 14 && open[13] === giteaIssues.filter(i => !i.closed_at).length, 'want 14 days of open issues, today last')

  console.log('gitea a saw', JSON.stringify(seen.a.map(r => [r.path, r.auth, r.host])), 'gitea c saw', seen.c.length, 'gh calls', JSON.stringify(ghCalls()))
  check(seen.a.length === 2 && seen.a.every(r => r.auth === `token ${TOKEN}` && r.host === `127.0.0.1:${pa}`), 'want two pages from repo a\'s host, each with the token')
  check(seen.c.length === 0, 'want no request to a host with no login')
  check(ghCalls().length === 1 && ghCalls()[0].includes('gho/ghr'), 'want one gh call for the github.com remote')

  // Nowhere else: not the page, not the log, not the runtime dir.
  const page = await win.evaluate(() => JSON.stringify(window.skinnedPage()) + document.documentElement.outerHTML)
  const runDir = path.join(process.env.XDG_RUNTIME_DIR, 'claude-skins', String(electron))
  const files = holders(runDir).concat(holders(state))
  console.log('token in page', page.includes(TOKEN), 'in log', stderr.includes(TOKEN), 'files', JSON.stringify(files), 'log lines', JSON.stringify(stderr.split('\n').filter(l => l.includes('board:'))))
  check(!page.includes(TOKEN) && !stderr.includes(TOKEN) && !files.length, 'the token must reach neither the page, the log nor the disk')
  check(/board: http:\/\/127\.0\.0\.1:\d+\/o\/r: 60 issues/.test(stderr), 'want the read logged by its remote alone')

  // At most one read per remote per 5 minutes, across a reopen.
  await sleep(15000)
  const t = (await probe(app)).tabs.find(y => y.dashboard)
  await win.evaluate(id => window.skinned.closeTab(id), t.id)
  await sleep(1500)
  await menu(win, /^Sessions dashboard$/)
  await sleep(11000)
  x = await dash(win)
  const pr = await probe(app)
  console.log('after 25 s and a reopen', JSON.stringify({ gitea: seen.a.length, gh: ghCalls().length, boards: pr.boards, a: rowOf(x, fa).boardText }))
  check(seen.a.length === 2 && ghCalls().length === 1 && pr.boards.every(r => r.fetches === 1), 'want no second read within 5 minutes')
  check(rowOf(x, fa).boardText === wantA, 'want the reopened dashboard to show the kept board')
  check([fa, fs2, fb, fc, fd].every(s => alive(s.pid)), 'want every session left running')

  for (const y of pr.tabs) if (y.childPid) try { process.kill(-y.childPid, 'SIGHUP') } catch (e) {}
  await sleep(1500)
  await app.close().catch(() => {})
  sa.close()
  sc.close()
}

main().then(() => console.log('done'), async e => {
  console.error(e)
  process.exitCode = 1
  if (!launched) return
  for (const y of (await probe(launched.app).catch(() => ({ tabs: [] }))).tabs) if (y.childPid) try { process.kill(-y.childPid, 'SIGHUP') } catch (err) {}
  await launched.app.close().catch(() => {})
}).finally(() => {
  for (const s of foreign) stop(s)
  setTimeout(() => process.exit(), 500).unref()
})
