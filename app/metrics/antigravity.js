'use strict'
// The adapter of the Antigravity CLI, `agy`: like plain it injects
// nothing and has no channel, so the session runs on Generic alone, but
// a new tab carries its setup options (decision 0023). Options of agy
// 1.5.9 (`agy --help`). Not carried: --continue, --conversation and the
// print mode with its formats, timeout and schema, which belong to one
// session, --new-project, --remote-agent and --remote-control, and any
// option missing here.

const { pick } = require('./carry')

const kind = 'antigravity'

function matches (base) {
  return base === 'agy'
}

const OPTIONS = {
  '--dangerously-skip-permissions': 0,
  '--sandbox': 0,
  '--disable-slash-commands': 0,
  '--model': 1,
  '--mode': 1,
  '--effort': 1,
  '--agent': 1,
  '--add-dir': 1,
  '--settings': 1,
  '--project': 1,
  '--log-file': 1
}

const carry = argv => pick(argv, OPTIONS)

function create () {
  return {
    prepare: async () => ({ args: [], notice: null }),
    attach () {},
    poll () {},
    report: () => ({ session: null, channels: [], notice: null }),
    close () {}
  }
}

module.exports = { kind, matches, create, carry, OPTIONS }
