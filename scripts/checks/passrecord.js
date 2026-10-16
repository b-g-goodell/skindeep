'use strict'
// The record of a full pass of the live check suite (decision 0019):
// one file per tested tree, named by the tree's hash, under
// <git common dir>/claude-skins/checks-passed/, so every worktree of a
// checkout shares the records and git tracks none of them. A tree is
// what a rebase that changes nothing keeps, so a record carries through
// a restack. ops/publish.py reads the same path.
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

function store (cwd) {
  return path.join(path.resolve(cwd, git(cwd, 'rev-parse', '--git-common-dir')), 'claude-skins', 'checks-passed')
}

function tree (cwd, ref = 'HEAD') {
  return git(cwd, 'rev-parse', `${ref}^{tree}`)
}

// Changes git does not hold in HEAD's tree: staged, unstaged and
// untracked paths, ignored ones aside. '' when the tree is clean.
function dirty (cwd) {
  return git(cwd, 'status', '--porcelain')
}

// Writes the record of HEAD's tree. Refuses a dirty tree, whose run
// tested files the tree does not hold.
function write (cwd, info = {}) {
  const changes = dirty(cwd)
  if (changes) throw new Error(`tree dirty, no pass record: ${changes.split('\n')[0]}`)
  const t = tree(cwd)
  const dir = store(cwd)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, t)
  fs.writeFileSync(file, JSON.stringify(Object.assign({ tree: t, head: git(cwd, 'rev-parse', 'HEAD'), at: new Date().toISOString() }, info)) + '\n')
  return file
}

function has (cwd, ref = 'HEAD') {
  return fs.existsSync(path.join(store(cwd), tree(cwd, ref)))
}

module.exports = { store, tree, dirty, write, has }

