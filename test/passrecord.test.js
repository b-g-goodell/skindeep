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
