'use strict'
// Tail a JSONL file (a Claude transcript, a Codex rollout): the file as
// it is at start first, every line of it flagged history, then appended
// lines, read when the owner polls. The history is read one 8 MiB chunk
// at start and one per poll, so a large file never holds the main
// process for long. The tail holds no timer.

const fs = require('fs')
const { StringDecoder } = require('string_decoder')

const POLL_MS = 500

class Tail {
  // end: read the file as history up to this byte and no further, for a
  // rollout another one references (decision 0026).
  constructor (file, onLine, { end = null } = {}) {
    this.file = file
    this.onLine = onLine
    this.end = end
    this.offset = 0
    this.rest = ''
    // A character split across two reads is held until it is whole.
    this.decoder = new StringDecoder('utf8')
    this.last = -Infinity
    this.stopped = false
    // The size at start: the bytes before it are history.
    this.historyEnd = 0
    try { this.historyEnd = fs.statSync(this.file).size } catch (e) {}
    if (end !== null) this.historyEnd = Math.min(this.historyEnd, end)
    this.replay()
  }

  // True until the history is read.
  get replaying () {
    return !this.stopped && this.offset < this.historyEnd
  }

  // One chunk of the history. A read that gets nothing ends it: the file
  // shrank or went away, and what comes next is read as appended.
  replay () {
    if (this.replaying && !this.read(true, this.historyEnd)) this.historyEnd = 0
  }

  // One chunk of at most 8 MiB, up to byte `end`. False when nothing was
  // read.
  read (history, end = Infinity) {
    let fd
    try {
      fd = fs.openSync(this.file, 'r')
      const size = Math.min(fs.fstatSync(fd).size, end)
      if (size < this.offset) { this.offset = 0; this.rest = ''; this.decoder = new StringDecoder('utf8') }
      if (size === this.offset) return false
      const buf = Buffer.alloc(Math.min(size - this.offset, 8 * 1024 * 1024))
      const n = fs.readSync(fd, buf, 0, buf.length, this.offset)
      this.offset += n
      const text = this.rest + this.decoder.write(buf.slice(0, n))
      const lines = text.split('\n')
      this.rest = lines.pop()
      for (const l of lines) {
        if (!l) continue
        let obj
        try { obj = JSON.parse(l) } catch (e) { continue }
        this.onLine(obj, history)
      }
      return n > 0
    } catch (e) {
      // Not there yet, or rotated. The next poll tries again.
      return false
    } finally {
      if (fd !== undefined) fs.closeSync(fd)
    }
  }

  // The next chunk of history while there is one, else appended lines,
  // at most once per POLL_MS of the caller's clock.
  poll (now) {
    if (this.replaying) return this.replay()
    if (this.stopped || this.end !== null || now - this.last < POLL_MS) return
    this.last = now
    this.read(false)
  }

  stop () {
    this.stopped = true
  }
}

module.exports = { Tail }
