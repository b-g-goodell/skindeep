'use strict'
// The live check suite (decision 0019): every check of scripts/checks
// that runs on the fakes alone, each mode of it, each under
// scripts/clean-env xvfb-run, with scripts/fake first on PATH so no
// real claude, codex or gh runs and no token is spent.
//   node scripts/checks/suite.js OUT [--jobs N] [--timeout S] [--only NAME,...] [--chunk K/N] [--rerun-passed] [--no-record]
// --jobs: checks run at once, default 3. --timeout: seconds a check may
// take, default 900. --only: the jobs named, as their OUT folder is
// named (tabs-keys, p5). --chunk K/N: the Kth of N equal runs of the
// job list, so a loaded host runs the suite a chunk at a time. Each
// check's log goes to OUT/<job>.log and its own OUT to OUT/<job>/. The
// summary names each failing job with its log's error line, and the
// exit is 1 on any failure, after each failed job has run once more
// alone, which a job that passes counts as its pass.
// On a clean tree each job's pass is recorded against HEAD's tree
// (scripts/checks/passrecord.js), and a job that passed on the tree
// is carried, not run again; --rerun-passed runs it all the same. Once
// every job has a pass on the tree, by one run or by chunks, the full
// record is written, which ops/publish.py requires. --no-record
// neither reads nor writes any pass record. Every outcome of every job,
// a failure too, is appended to the outcome log beside the records,
// which scripts/checks/flaky.js reads.
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')
const passrecord = require('./passrecord')

const root = path.join(__dirname, '..', '..')
const fakes = path.join(root, 'scripts', 'fake')

// [check, ...args]: every mode of every hermetic check.
const JOBS = [
  ['attach'], ['board'], ['checklist'], ['claude-bus'], ['claude-bus', '--continue'],
  ['dashboard'], ['dials'], ['effort'], ['foreign'], ['halfscreen'], ['limits'], ['listtoggle'],
  ['manager'], ['menufit'], ...['deck', 'phosphor', 'coffee', 'library'].map(m => ['menus', m]), ['newtab', 'profiles'], ['newtab', 'codex'], ['newtab', 'snapshot'], ['newtab', 'antigravity'], ['newtab', 'codemode'],
  ['p1', 'bash'],
  ...['widgets', 'hostile', 'menu', 'switching', 'reload', 'collision', 'button', 'openskin', 'keys', 'remember'].map(m => ['p3', m]),
  ['p5'], ['panels'], ['popout'], ['providers'], ['quarter'], ['rename'],
  ...['claude', 'plain', 'codex'].map(m => ['reopen', m]),
  ['settings'],
  ...['play', 'mute', 'start', 'skins', 'coffee'].map(m => ['sounds', m]),
  ...['keys', 'strip', 'exit', 'execfail', 'meters', 'closewin', 'carry'].map(m => ['tabs', m]),
  ...['deck', 'phosphor', 'coffee', 'library', 'viz'].map(m => ['textsize', m]),
  ['tabviz', 'look'], ['twoskins'], ['vizcaps'], ['vizcarbon'], ['vizfern'], ['vizflash'], ['vizlens'], ['vizmenu'], ['vizmodes'], ['vizpointer'], ['vizzeeman'],
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

// A job's folder and log name: the check and its mode, a flag cut to
// four letters (claude-bus-cont).
const name = job => [job[0], ...job.slice(1).map(a => a.startsWith('--') ? a.slice(2, 6) : a)].join('-')

function args (argv) {
  const o = { jobs: 3, timeout: 900, only: null, chunk: null, carry: true, record: true, out: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--jobs') o.jobs = Number(argv[++i])
    else if (a === '--timeout') o.timeout = Number(argv[++i])
    else if (a === '--only') o.only = argv[++i].split(',')
    else if (a === '--chunk') o.chunk = argv[++i].split('/').map(Number)
    else if (a === '--rerun-passed') o.carry = false
    else if (a === '--no-record') o.record = false
    else if (!a.startsWith('--') && !o.out) o.out = path.resolve(a)
    else throw new Error(`unknown argument ${a}`)
  }
  const badChunk = o.chunk && !(o.chunk.length === 2 && Number.isInteger(o.chunk[0]) && Number.isInteger(o.chunk[1]) && o.chunk[0] >= 1 && o.chunk[0] <= o.chunk[1])
  if (!o.out || !(o.jobs >= 1) || !(o.timeout > 0) || badChunk || (o.chunk && o.only)) throw new Error('usage: node scripts/checks/suite.js OUT [--jobs N] [--timeout S] [--only NAME,...] [--chunk K/N] [--rerun-passed] [--no-record]')
  return o
}

// Every file of scripts/checks is a job or excluded, so a new check is
// never left out unseen.
function unlisted () {
  const known = new Set(JOBS.map(j => j[0]).concat(Object.keys(EXCLUDED).map(k => k.split(' ')[0]), ['suite', 'passrecord', 'flaky']))
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
// Each outcome goes to the outcome log, pass or not, with the load and
// the jobs beside it at the start (ticket: flaky checks).
async function run (job, o) {
  const t0 = Date.now()
  const load = Math.round(os.loadavg()[0] * 10) / 10
  const beside = running.size
  let r = await runOnce(job, o.out, o.timeout)
  if (r.code !== 0 && /xvfb-run: error/.test(r.log)) r = await runOnce(job, o.out, o.timeout)
  const s = Math.round((Date.now() - t0) / 1000)
  const res = { job: name(job), ok: r.code === 0, s, why: r.code === 0 ? '' : r.code === 'timeout' ? `timeout after ${o.timeout} s` : `exit ${r.code}: ${errorLine(r.log)}` }
  console.log(`${res.ok ? 'PASS' : 'FAIL'} ${res.job} ${s} s${res.ok ? '' : ` ${res.why}`}`)
  try {
    passrecord.outcome(root, { job: res.job, outcome: res.ok ? 'pass' : r.code === 'timeout' ? 'timeout' : 'fail', s, load, beside, why: res.why })
  } catch (e) { console.log(`outcome not logged: ${e.message}`) }
  return res
}

// The Kth of N runs of the job list, as equal as whole jobs allow.
function chunkOf (list, [k, n]) {
  return list.slice(Math.round((k - 1) * list.length / n), Math.round(k * list.length / n))
}

async function main () {
  const o = args(process.argv.slice(2))
  const missing = unlisted()
  if (missing.length) throw new Error(`neither a job nor excluded in suite.js: ${missing.join(', ')}`)
  const picked = o.only ? JOBS.filter(j => o.only.includes(name(j))) : o.chunk ? chunkOf(JOBS, o.chunk) : JOBS
  if (o.only && picked.length !== o.only.length) throw new Error(`no such job among ${o.only.join(', ')}`)

  const tree = passrecord.tree(root)
  const changes = passrecord.dirty(root)
  // Why no record will be written, or '' if passes are recorded.
  let skip = !o.record ? '--no-record' : changes ? `tree dirty (${changes.split('\n')[0]})` : ''
  if (skip) console.log(`no pass record: ${skip}`)
  for (const [k, why] of Object.entries(EXCLUDED)) console.log(`excluded ${k}: ${why}`)
  fs.mkdirSync(o.out, { recursive: true })
  const before = skip ? {} : passrecord.jobs(root)
  const carried = o.carry ? picked.filter(j => before[name(j)]) : []
  for (const j of carried) console.log(`carried ${name(j)}: passed on this tree at ${before[name(j)].at}`)
  const jobs = picked.filter(j => !carried.includes(j))
  console.log(`${jobs.length} jobs${o.chunk ? `, chunk ${o.chunk.join('/')}` : ''}, ${o.jobs} at once, tree ${tree}`)

  // A pass is recorded at once, so a run stopped midway keeps it, and
  // only while the tree is the one the run started on.
  const same = () => passrecord.tree(root) === tree && !passrecord.dirty(root)
  const record = (r, alone) => {
    if (skip) return
    if (!same()) skip = 'the tree changed during the run'
    else passrecord.writeJob(root, r.job, { s: r.s, alone })
  }

  const t0 = Date.now()
  const queue = jobs.slice()
  const results = []
  // Starts are a second apart, so xvfb-run's display picks rarely race.
  await Promise.all(Array.from({ length: Math.min(o.jobs, queue.length) }, async (_, i) => {
    await sleep(i * 1000)
    while (queue.length) {
      const r = await run(queue.shift(), o)
      results.push(r)
      if (r.ok) record(r, false)
    }
  }))
  // A job that failed beside others runs once more, alone: a loaded
  // host fails the checks that time real frames, and a defect fails
  // twice (issue #217).
  const reran = []
  for (const r of results.filter(x => !x.ok)) {
    console.log(`rerun ${r.job} alone`)
    const again = await run(jobs.find(j => name(j) === r.job), o)
    if (again.ok) {
      reran.push(r.job)
      r.ok = true
      record(again, true)
    } else r.why = again.why
  }
  const wall = Math.round((Date.now() - t0) / 1000)
  const failed = results.filter(r => !r.ok)
  for (const r of failed) console.log(`failed ${r.job}: ${r.why}`)
  for (const j of reran) console.log(`passed on a rerun alone: ${j}`)

  // The full record, once every job of the suite has a pass on the tree.
  let note = `no pass record: ${skip}`
  if (!skip) {
    const all = passrecord.jobs(root)
    const left = JOBS.map(name).filter(n => !all[n])
    if (left.length) note = `${JOBS.length - left.length} of ${JOBS.length} jobs passed on this tree, not yet ${left.join(', ')}`
    else {
      const recs = JOBS.map(j => all[name(j)])
      note = `recorded ${passrecord.write(root, { jobs: JOBS.length, wall_s: recs.reduce((t, r) => t + (r.s || 0), 0), reran: JOBS.map(name).filter(n => all[n].alone) })}`
    }
  }
  console.log(`suite: ${results.length - failed.length} pass (${reran.length} on a rerun alone, ${carried.length} carried), ${failed.length} fail of ${jobs.length}, wall ${wall} s, tree ${tree}, ${note}`)
  process.exitCode = failed.length ? 1 : 0
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    for (const pid of running) try { process.kill(-pid, 'SIGTERM') } catch (e) {}
    process.exit(1)
  })
}

main().catch(e => { console.error(e.message); process.exit(2) })
