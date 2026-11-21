'use strict'
// The live suite's pass record (scripts/checks/passrecord.js) on a
// temp repository and a worktree of it.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const passrecord = require('../scripts/checks/passrecord')

const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], { cwd, encoding: 'utf8' }).trim()

test('a record is keyed by tree, refused on a dirty tree and shared by worktrees', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'passrecord-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const repo = path.join(dir, 'repo')
  fs.mkdirSync(repo)
  git(repo, 'init', '-q', '-b', 'main')
  fs.writeFileSync(path.join(repo, 'a'), '1\n')
  git(repo, 'add', 'a')
  git(repo, 'commit', '-q', '-m', 'one')

  assert.strictEqual(passrecord.has(repo), false)
  fs.writeFileSync(path.join(repo, 'b'), 'untracked\n')
  assert.throws(() => passrecord.write(repo), /tree dirty/)
  fs.rmSync(path.join(repo, 'b'))
  fs.writeFileSync(path.join(repo, 'a'), '2\n')
  assert.throws(() => passrecord.write(repo), /tree dirty/)
  git(repo, 'checkout', '-q', 'a')

  const file = passrecord.write(repo, { jobs: 1 })
  assert.ok(file.startsWith(path.join(repo, '.git', 'claude-skins', 'checks-passed') + path.sep))
  assert.strictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).tree, passrecord.tree(repo))
  assert.strictEqual(passrecord.has(repo), true)

  // Another commit with the same tree keeps the record, as a rebase
  // that changes nothing does. Another tree has none.
  git(repo, 'commit', '-q', '--allow-empty', '-m', 'same tree')
  assert.strictEqual(passrecord.has(repo), true)
  fs.writeFileSync(path.join(repo, 'a'), '3\n')
  git(repo, 'commit', '-q', '-am', 'new tree')
  assert.strictEqual(passrecord.has(repo), false)
  assert.strictEqual(passrecord.has(repo, 'HEAD~1'), true)

  // A worktree writes to and reads from the same store.
  const wt = path.join(dir, 'wt')
  git(repo, 'worktree', 'add', '-q', '-b', 'side', wt)
  assert.strictEqual(passrecord.store(wt), passrecord.store(repo))
  passrecord.write(wt)
  assert.strictEqual(passrecord.has(repo, 'side'), true)
})

test('job passes are kept per tree, apart from the full record', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'passrecord-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const repo = path.join(dir, 'repo')
  fs.mkdirSync(repo)
  git(repo, 'init', '-q', '-b', 'main')
  fs.writeFileSync(path.join(repo, 'a'), '1\n')
  git(repo, 'add', 'a')
  git(repo, 'commit', '-q', '-m', 'one')

  assert.deepStrictEqual(passrecord.jobs(repo), {})
  passrecord.writeJob(repo, 'tabs-keys', { s: 12, alone: false })
  passrecord.writeJob(repo, 'p5', { s: 40, alone: true })
  const got = passrecord.jobs(repo)
  assert.deepStrictEqual(Object.keys(got).sort(), ['p5', 'tabs-keys'])
  assert.strictEqual(got.p5.alone, true)
  // A job's pass is not the full record publishing reads.
  assert.strictEqual(passrecord.has(repo), false)

  fs.writeFileSync(path.join(repo, 'b'), 'untracked\n')
  assert.throws(() => passrecord.writeJob(repo, 'menus-deck'), /tree dirty/)
  fs.rmSync(path.join(repo, 'b'))
  fs.writeFileSync(path.join(repo, 'a'), '2\n')
  git(repo, 'commit', '-q', '-am', 'new tree')
  assert.deepStrictEqual(passrecord.jobs(repo), {})
  assert.deepStrictEqual(Object.keys(passrecord.jobs(repo, 'HEAD~1')).sort(), ['p5', 'tabs-keys'])
})

test('every outcome is logged with its tree, and flaky.js rates clean runs per job', t => {
  const { summarize } = require('../scripts/checks/flaky')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'passrecord-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const repo = path.join(dir, 'repo')
  fs.mkdirSync(repo)
  git(repo, 'init', '-q', '-b', 'main')
  fs.writeFileSync(path.join(repo, 'a'), '1\n')
  git(repo, 'add', 'a')
  git(repo, 'commit', '-q', '-m', 'one')

  assert.deepStrictEqual(passrecord.outcomes(repo), [])
  passrecord.outcome(repo, { job: 'p5', outcome: 'fail', s: 30, load: 40 })
  passrecord.outcome(repo, { job: 'p5', outcome: 'timeout', s: 900, load: 60 })
  passrecord.outcome(repo, { job: 'p5', outcome: 'pass', s: 20, load: 10 })
  passrecord.outcome(repo, { job: 'p5', outcome: 'pass', s: 20, load: 12 })
  passrecord.outcome(repo, { job: 'menus-deck', outcome: 'pass', s: 9, load: 5 })
  const t1 = passrecord.tree(repo)
  // A dirty run is logged, marked, and not counted.
  fs.writeFileSync(path.join(repo, 'b'), 'untracked\n')
  passrecord.outcome(repo, { job: 'p5', outcome: 'fail', s: 30, load: 1 })
  fs.rmSync(path.join(repo, 'b'))
  fs.writeFileSync(path.join(repo, 'a'), '2\n')
  git(repo, 'commit', '-q', '-am', 'two')
  passrecord.outcome(repo, { job: 'menus-deck', outcome: 'fail', s: 9, load: 7 })
  // A torn last line is skipped.
  fs.appendFileSync(passrecord.outcomeLog(repo), '{"job":"p')

  const all = passrecord.outcomes(repo)
  assert.strictEqual(all.length, 7)
  assert.strictEqual(all[5].dirty, true)
  assert.strictEqual(all[0].tree, t1)
  assert.ok(passrecord.outcomeLog(repo).startsWith(path.join(repo, '.git', 'claude-skins') + path.sep))

  assert.deepStrictEqual(summarize(all), [
    { job: 'menus-deck', runs: 2, fails: 1, timeouts: 0, rate: 0.5, trees: 2, loadPass: 5, loadFail: 7 },
    { job: 'p5', runs: 4, fails: 2, timeouts: 1, rate: 0.5, trees: 1, loadPass: 11, loadFail: 50 }
  ].sort((a, b) => b.runs - a.runs))
  assert.deepStrictEqual(summarize(all, { tree: t1 }).map(r => [r.job, r.runs, r.fails]), [['p5', 4, 2], ['menus-deck', 1, 0]])
})
