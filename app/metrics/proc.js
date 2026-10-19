'use strict'
// The child's process tree from /proc, shared by Generic (CPU and
// memory) and Codex discovery (held files).

const fs = require('fs')

function read (p) {
  try { return fs.readFileSync(p, 'utf8') } catch (e) { return null }
}

// pid and its descendants, through /proc/<pid>/task/*/children.
function tree (pid) {
  const out = []
  const stack = [pid]
  while (stack.length && out.length < 4096) {
    const p = stack.pop()
    out.push(p)
    let tasks = []
    try { tasks = fs.readdirSync(`/proc/${p}/task`) } catch (e) { continue }
    for (const t of tasks) {
      const kids = read(`/proc/${p}/task/${t}/children`)
      if (kids) for (const k of kids.trim().split(/\s+/)) if (k) stack.push(Number(k))
    }
  }
  return out
}

// The direct children of pid.
function children (pid) {
  const out = []
  let tasks = []
  try { tasks = fs.readdirSync(`/proc/${pid}/task`) } catch (e) { return out }
  for (const t of tasks) {
    const kids = read(`/proc/${pid}/task/${t}/children`)
    if (kids) for (const k of kids.trim().split(/\s+/)) if (k) out.push(Number(k))
  }
  return out
}

function comm (pid) {
  const s = read(`/proc/${pid}/comm`)
  return s ? s.trim() : null
}

// The wrappers a launch runs through: a sandbox, a shell and the
// interpreter of a launcher script.
const WRAPPERS = new Set(['bwrap', 'bash', 'sh', 'dash', 'python3', 'python'])

const isWrapper = pid => WRAPPERS.has(comm(pid))

// The command a wrapped pid runs: down the chain of only children while
// the process is a wrapper, else pid itself.
function leaf (pid) {
  let p = pid
  for (let i = 0; i < 16; i++) {
    if (!isWrapper(p)) return p
    const kids = children(p)
    if (kids.length !== 1) return p
    p = kids[0]
  }
  return p
}

module.exports = { tree, children, comm, isWrapper, leaf }
