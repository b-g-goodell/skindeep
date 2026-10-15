'use strict'
// The options of Claude Code 2.1.296 (`claude --help`) a new tab carries
// (decision 0023): those that set up any session the same way, the
// restricting ones above all. Not carried: those of one session or one
// run (--resume, --continue, --fork-session, --session-id, --from-pr,
// --teleport, --name, --worktree, --tmux, --remote-control, --cloud,
// --desktop, --bg, --file, --debug-file, --print and its output
// options) and any option missing here.

const { pick } = require('../carry')

const OPTIONS = {
  '--allow-dangerously-skip-permissions': 0,
  '--ax-screen-reader': 0,
  '--bare': 0,
  '--brief': 0,
  '--chrome': 0,
  '--no-chrome': 0,
  '--dangerously-skip-permissions': 0,
  '--disable-slash-commands': 0,
  '--exclude-dynamic-system-prompt-sections': 0,
  '--ide': 0,
  '--no-session-persistence': 0,
  '--restricted': 0,
  '--safe-mode': 0,
  '--strict-mcp-config': 0,
  '--verbose': 0,
  '--agent': 1,
  '--agents': 1,
  '--append-system-prompt': 1,
  '--append-system-prompt-file': 1,
  '--autocompact': 1,
  '--effort': 1,
  '--fallback-model': 1,
  '--max-budget-usd': 1,
  '--model': 1,
  '--permission-mode': 1,
  '--plugin-dir': 1,
  '--plugin-url': 1,
  '--setting-sources': 1,
  '--settings': 1,
  '--system-prompt': 1,
  '--system-prompt-file': 1,
  '--system-prompt-snapshot': 1,
  '--add-dir': '+',
  '--allowedTools': '+',
  '--allowed-tools': '+',
  '--betas': '+',
  '--disallowedTools': '+',
  '--disallowed-tools': '+',
  '--mcp-config': '+',
  '--tools': '+',
  '-d': '?',
  '--debug': '?',
  '--prompt-suggestions': '?'
}

const carry = argv => pick(argv, OPTIONS)

module.exports = { carry, OPTIONS }
