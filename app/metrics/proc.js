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

module.exports = { tree }
