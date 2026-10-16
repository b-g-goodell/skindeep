'use strict'
// The live check suite (decision 0019): every check of scripts/checks
// that runs on the fakes alone, each mode of it, each under
// scripts/clean-env xvfb-run, with scripts/fake first on PATH so no
// real claude, codex or gh runs and no token is spent.
//   node scripts/checks/suite.js OUT [--jobs N] [--timeout S] [--only NAME,...] [--no-record]
// --jobs: checks run at once, default 3. --timeout: seconds a check may
// take, default 900. --only: the jobs named, as their OUT folder is
// named (tabs-keys, p5), and no pass record. Each check's log goes to
// OUT/<job>.log and its own OUT to OUT/<job>/. The summary names each
// failing job with its log's error line, and the exit is 1 on any
// failure. A full pass on a clean tree records HEAD's tree
// (scripts/checks/passrecord.js), which ops/publish.py requires;
// --no-record skips it.
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const passrecord = require('./passrecord')

const root = path.join(__dirname, '..', '..')
const fakes = path.join(root, 'scripts', 'fake')

// [check, ...args]: every mode of every hermetic check.
const JOBS = [
  ['attach'], ['board'], ['checklist'], ['claude-bus'], ['claude-bus', '--continue'],
  ['dashboard'], ['dials'], ['foreign'], ['halfscreen'], ['limits'], ['listtoggle'],
  ['manager'], ['menufit'], ['menus'], ['newtab', 'profiles'], ['newtab', 'codex'],
  ['p1', 'bash'],
  ...['widgets', 'hostile', 'menu', 'switching', 'reload', 'collision', 'button', 'openskin', 'keys', 'remember'].map(m => ['p3', m]),
  ['p5'], ['panels'], ['popout'], ['quarter'], ['rename'],
  ...['claude', 'plain', 'codex'].map(m => ['reopen', m]),
  ['settings'],
  ...['play', 'mute', 'start', 'skins', 'coffee'].map(m => ['sounds', m]),
  ...['keys', 'strip', 'exit', 'execfail', 'meters', 'closewin', 'carry'].map(m => ['tabs', m]),
  ['tabviz', 'look'], ['twoskins'], ['vizcarbon'], ['vizfern'], ['vizmenu'], ['vizmodes'], ['vizpointer'],
  ['vizreopen', 'rounds'], ['vizreopen', 'build'], ['vizsound'], ['vizsplit'], ['vizstep']
]

// What the suite leaves out, and why.
const EXCLUDED = {
  final: 'a real claude session on the caller\'s own config',
  look: 'a frame capture of a given command: asserts nothing',
  'p1 claude': 'a real claude, only xdg-open faked',
  p2: 'real claude sessions',
  p6: 'a real codex session',
  usage: 'a real claude session: spends a prompt of the profile\'s quota',
  'stub-dialog': 'not a check: the launch dialog\'s stub twoskins loads',
  'tabviz cost': 'a measurement under the host\'s load: asserts nothing'
}

// sun_path holds 107 bytes. claude-bus puts the runtime dir in its
// OUT, where a tab's socket is <job OUT>/run/claude-skins/<pid>/tab-<n>/hooks.sock.
const SOCKET_TAIL = '/run/claude-skins/4194304/tab-99/hooks.sock'.length

// A job's folder and log name: the check and its mode, a flag cut to
// four letters (claude-bus-cont), so a socket path under OUT has room.
const name = job => [job[0], ...job.slice(1).map(a => a.startsWith('--') ? a.slice(2, 6) : a)].join('-')

function args (argv) {
  const o = { jobs: 3, timeout: 900, only: null, record: true, out: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--jobs') o.jobs = Number(argv[++i])
    else if (a === '--timeout') o.timeout = Number(argv[++i])
    else if (a === '--only') o.only = argv[++i].split(',')
    else if (a === '--no-record') o.record = false
    else if (!a.startsWith('--') && !o.out) o.out = path.resolve(a)
    else throw new Error(`unknown argument ${a}`)
  }
  if (!o.out || !(o.jobs >= 1) || !(o.timeout > 0)) throw new Error('usage: node scripts/checks/suite.js OUT [--jobs N] [--timeout S] [--only NAME,...] [--no-record]')
  return o
}

// Every file of scripts/checks is a job or excluded, so a new check is
// never left out unseen.
function unlisted () {
  const known = new Set(JOBS.map(j => j[0]).concat(Object.keys(EXCLUDED).map(k => k.split(' ')[0]), ['suite', 'passrecord']))
  return fs.readdirSync(__dirname).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3)).filter(n => !known.has(n))
}

// The first line of a log that says what failed.
function errorLine (log) {
  const lines = log.split('\n').map(l => l.trim()).filter(Boolean)
  return lines.find(l => /^(\w+)?Error\b|^\w*Error:|xvfb-run: error/.test(l)) || lines[lines.length - 1] || '(empty log)'
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const running = new Set()

// One run of a job: its exit, or 'timeout'. The process group is
// killed on a timeout: xvfb-run, Xvfb and node are in it, and
// Playwright ends the Electron it launched when node ends.
function runOnce (job, out, timeout) {
  const dir = path.join(out, name(job))
  const logFile = `${dir}.log`
  fs.rmSync(dir, { recursive: true, force: true })
  const fd = fs.openSync(logFile, 'w')
  const env = Object.assign({}, process.env, { PATH: `${fakes}:${process.env.PATH}` })
  const p = spawn(path.join(root, 'scripts', 'clean-env'), ['xvfb-run', '-a', '-s', '-screen 0 1920x1080x24', 'node', path.join(__dirname, `${job[0]}.js`), dir, ...job.slice(1)], { cwd: root, env, detached: true, stdio: ['ignore', fd, fd] })
  fs.closeSync(fd)
  running.add(p.pid)
  return new Promise(resolve => {
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      try { process.kill(-p.pid, 'SIGTERM') } catch (e) {}
      setTimeout(() => { try { process.kill(-p.pid, 'SIGKILL') } catch (e) {} }, 5000).unref()
    }, timeout * 1000)
    p.on('exit', code => {
      clearTimeout(timer)
      running.delete(p.pid)
      resolve({ code: timedOut ? 'timeout' : code, log: fs.readFileSync(logFile, 'utf8') })
    })
  })
}

// xvfb-run -a can lose a display number to a launch beside it: one
// retry, for that alone.
async function run (job, o) {
  const t0 = Date.now()
  let r = await runOnce(job, o.out, o.timeout)
  if (r.code !== 0 && /xvfb-run: error/.test(r.log)) r = await runOnce(job, o.out, o.timeout)
  const s = Math.round((Date.now() - t0) / 1000)
  const res = { job: name(job), ok: r.code === 0, s, why: r.code === 0 ? '' : r.code === 'timeout' ? `timeout after ${o.timeout} s` : `exit ${r.code}: ${errorLine(r.log)}` }
  console.log(`${res.ok ? 'PASS' : 'FAIL'} ${res.job} ${s} s${res.ok ? '' : ` ${res.why}`}`)
  return res
}

async function main () {
  const o = args(process.argv.slice(2))
  const missing = unlisted()
  if (missing.length) throw new Error(`neither a job nor excluded in suite.js: ${missing.join(', ')}`)
  const jobs = o.only ? JOBS.filter(j => o.only.includes(name(j))) : JOBS
  if (o.only && jobs.length !== o.only.length) throw new Error(`no such job among ${o.only.join(', ')}`)
  const longest = Math.max(...jobs.map(j => name(j).length))
  if (o.out.length + 1 + longest + SOCKET_TAIL > 107) throw new Error(`OUT ${o.out} is too long for a socket path under it: keep it to ${107 - 1 - longest - SOCKET_TAIL} bytes or fewer`)

  const tree = passrecord.tree(root)
  const changes = passrecord.dirty(root)
  // Why no record will be written, or '' if a full pass writes one.
  let skip = !o.record ? '--no-record' : o.only ? '--only' : changes ? `tree dirty (${changes.split('\n')[0]})` : ''
  if (skip) console.log(`no pass record: ${skip}`)
  for (const [k, why] of Object.entries(EXCLUDED)) console.log(`excluded ${k}: ${why}`)
  fs.mkdirSync(o.out, { recursive: true })
  console.log(`${jobs.length} jobs, ${o.jobs} at once, tree ${tree}`)

  const t0 = Date.now()
  const queue = jobs.slice()
  const results = []
  // Starts are a second apart, so xvfb-run's display picks rarely race.
  await Promise.all(Array.from({ length: Math.min(o.jobs, queue.length) }, async (_, i) => {
    await sleep(i * 1000)
    while (queue.length) results.push(await run(queue.shift(), o))
  }))
  const wall = Math.round((Date.now() - t0) / 1000)
  const failed = results.filter(r => !r.ok)
  for (const r of failed) console.log(`failed ${r.job}: ${r.why}`)

  if (!skip && failed.length) skip = 'a job failed'
  if (!skip && (passrecord.tree(root) !== tree || passrecord.dirty(root))) skip = 'the tree changed during the run'
  const note = skip ? `no pass record: ${skip}` : `recorded ${passrecord.write(root, { jobs: jobs.length, wall_s: wall })}`
  console.log(`suite: ${results.length - failed.length} pass, ${failed.length} fail of ${jobs.length}, wall ${wall} s, tree ${tree}, ${note}`)
  process.exitCode = failed.length ? 1 : 0
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    for (const pid of running) try { process.kill(-pid, 'SIGTERM') } catch (e) {}
    process.exit(1)
  })
}

main().catch(e => { console.error(e.message); process.exit(2) })
