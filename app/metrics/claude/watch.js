'use strict'
// A Claude session the app did not start (decision 0027): its transcript
// alone, read by the session core as when no statusline and no hooks
// were injected (decision 0009). find() names the transcript, or null:
// it is asked again every 5 s, so a /clear, which starts a new
// transcript, is followed.

const { ClaudeCore, source } = require('./core')
const compact = require('./compact')
const { Tail } = require('../tail')

const FIND_MS = 5000

class ClaudeWatch {
  constructor (bus, { find, argv, log }) {
    Object.assign(this, { bus, find, argv, log })
    this.core = null
    this.src = null
    this.tail = null
    this.file = null
    this.closed = false
    this.lastFind = -Infinity
  }

  async prepare () {
    const facts = Object.freeze({ hooks: false, statusline: false, compaction: compact.inputs({ argv: this.argv }), log: this.log })
    this.src = this.bus.source(source(facts))
    this.core = new ClaudeCore(this.src, facts)
    return { args: [], notice: null }
  }

  attach () {}

  // Follow the transcript find() names. A new one is a new session. A
  // session named before its transcript is written is followed once it
  // is.
  follow (now) {
    this.lastFind = now
    const f = this.find()
    if (!f || !f.file || f.file === this.file) return
    if (this.tail) this.tail.stop()
    this.file = f.file
    this.core.enter({ session_id: f.session, transcript_path: f.file })
    this.tail = new Tail(f.file, (obj, replayed) => this.core.line(f.file, obj, replayed))
  }

  poll (now) {
    if (this.closed || !this.core) return
    if (now - this.lastFind >= FIND_MS) this.follow(now)
    if (this.tail) this.tail.poll(now)
  }

  report () {
    return {
      session: (this.core && this.core.session) || null,
      title: (this.core && this.core.title) || null,
      channels: [{ name: 'transcript', state: this.tail ? 'live' : 'waiting', target: this.file, how: this.file ? 'folder' : null }],
      notice: this.core && !this.file ? 'meters waiting: no transcript found' : null,
      replaying: !!(this.tail && this.tail.replaying)
    }
  }

  close () {
    this.closed = true
    if (this.tail) this.tail.stop()
    if (this.src) this.src.close()
  }
}

function create (ctx) {
  return new ClaudeWatch(ctx.bus, { find: ctx.find, argv: ctx.argv.slice(1), log: ctx.log })
}

module.exports = { create, ClaudeWatch }
