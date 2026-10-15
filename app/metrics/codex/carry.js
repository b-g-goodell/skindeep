'use strict'
// The options of Codex CLI 0.162.1 (`codex --help`) a new tab carries
// (decision 0023): those that set up any session the same way, the
// restricting ones above all. Not carried: subcommands such as resume,
// fork and exec with their operands, --image (it belongs to the first
// prompt), --cd (the tab has its folder), --worktree, and any option
// missing here.

const { pick } = require('../carry')

const OPTIONS = {
  '--strict-config': 0,
  '--oss': 0,
  '--approve-for-me': 0,
  '--dangerously-bypass-approvals-and-sandbox': 0,
  '--dangerously-bypass-hook-trust': 0,
  '--search': 0,
  '--no-alt-screen': 0,
  '--no-daemon': 0,
  '-c': 1,
  '--config': 1,
  '--enable': 1,
  '--disable': 1,
  '--remote': 1,
  '--remote-auth-token-env': 1,
  '-m': 1,
  '--model': 1,
  '--local-provider': 1,
  '-p': 1,
  '--profile': 1,
  '-s': 1,
  '--sandbox': 1,
  '--add-dir': 1,
  '-a': 1,
  '--ask-for-approval': 1
}

const carry = argv => pick(argv, OPTIONS)

module.exports = { carry, OPTIONS }
