'use strict'
// A Codex thread's name (decision 0032). Codex CLI 0.162.1 appends one
// line {"id":THREAD,"thread_name":NAME,"updated_at":TIME} to
// <CODEX_HOME>/session_index.jsonl each time a thread is named, by the
// user or by Codex itself, and the last line of a thread wins (measured
// 2026-10-14). The file is re-read only when its size or mtime changed.

const fs = require('fs')
const path = require('path')
const os = require('os')

const MAX = 120

function indexFile (env) {
  return path.join(env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'session_index.jsonl')
}

// The last name `text` gives thread `id`, else null.
function threadName (text, id) {
  let name = null
  for (const l of text.split('\n')) {
    if (!l.includes(id)) continue
    let obj
    try { obj = JSON.parse(l) } catch (e) { continue }
    if (obj && obj.id === id && typeof obj.thread_name === 'string') name = obj.thread_name.trim().slice(0, MAX) || null
  }
  return name
}

class ThreadNames {
  // outside: the app's path of the home the CLI names (decision 0037).
  constructor (env, outside = p => p) {
    this.file = outside(indexFile(env))
    this.stamp = null
    this.text = ''
  }

  // The current name of thread `id`, reading the index when it changed.
  of (id) {
    if (!id) return null
    try {
      const st = fs.statSync(this.file)
      const stamp = `${st.size}:${st.mtimeMs}`
      if (stamp !== this.stamp) {
        this.text = fs.readFileSync(this.file, 'utf8')
        this.stamp = stamp
      }
    } catch (e) {
      this.stamp = null
      this.text = ''
    }
    return threadName(this.text, id)
  }
}

module.exports = { threadName, ThreadNames, indexFile }
