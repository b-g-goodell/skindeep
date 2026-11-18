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

function jobStore (cwd, t) {
  return path.join(path.dirname(store(cwd)), 'checks-passed-jobs', t)
}

// Records job's pass on HEAD's tree. Refuses a dirty tree, as write.
function writeJob (cwd, job, info = {}) {
  const changes = dirty(cwd)
  if (changes) throw new Error(`tree dirty, no pass record of ${job}: ${changes.split('\n')[0]}`)
  const dir = jobStore(cwd, tree(cwd))
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, job)
  fs.writeFileSync(file, JSON.stringify(Object.assign({ job, at: new Date().toISOString() }, info)) + '\n')
  return file
}

// The jobs that passed on ref's tree: { name: record }.
function jobs (cwd, ref = 'HEAD') {
  const dir = jobStore(cwd, tree(cwd, ref))
  if (!fs.existsSync(dir)) return {}
  return Object.fromEntries(fs.readdirSync(dir).map(f => [f, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))]))
}

// Every outcome of every job, pass or not, one JSON line each, beside
// the pass records: the sample from which a check's failure rate on
// unchanged code is read (scripts/checks/flaky.js).
function outcomeLog (cwd) {
  return path.join(path.dirname(store(cwd)), 'checks-outcomes.jsonl')
}

// Appends one outcome: { job, outcome: 'pass' | 'fail' | 'timeout', s,
// load, ... }, stamped with HEAD's tree and whether the tree was dirty.
function outcome (cwd, rec) {
  const file = outcomeLog(cwd)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const line = Object.assign({ at: new Date().toISOString(), tree: tree(cwd), dirty: Boolean(dirty(cwd)) }, rec)
  fs.appendFileSync(file, JSON.stringify(line) + '\n')
  return file
}

// The outcomes logged so far, oldest first. A torn last line is skipped.
function outcomes (cwd) {
  const file = outcomeLog(cwd)
  if (!fs.existsSync(file)) return []
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap(l => {
    try { return [JSON.parse(l)] } catch (e) { return [] }
  })
}

function has (cwd, ref = 'HEAD') {
  return fs.existsSync(path.join(store(cwd), tree(cwd, ref)))
}

module.exports = { store, tree, dirty, write, has, writeJob, jobs, outcomeLog, outcome, outcomes }

