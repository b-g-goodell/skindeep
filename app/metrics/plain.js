'use strict'
// The adapter of any CLI that is neither Claude Code nor Codex: it
// injects nothing and has no channel. The session runs on Generic alone.

const kind = 'plain'

function matches () {
  return false
}

// Nothing is known of the CLI's options, so a new tab carries none.
function carry (argv) {
  return { args: [], dropped: argv.slice() }
}

function create () {
  return {
    prepare: async () => ({ args: [], notice: null }),
    attach () {},
    poll () {},
    report: () => ({ session: null, channels: [], notice: null }),
    close () {}
  }
}

module.exports = { kind, matches, create, carry }
