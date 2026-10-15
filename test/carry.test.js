'use strict'
// What a new tab carries from the window's command (decision 0023).
const test = require('node:test')
const assert = require('node:assert')
const { carry } = require('../app/metrics/agent')

const cases = [
  ['claude: setup carried, session and prompt dropped',
    ['claude', '--model', 'opus', '--permission-mode', 'plan', '--disallowedTools', 'Bash', 'Edit', '--resume', 'abc', 'fix it'],
    ['--model', 'opus', '--permission-mode', 'plan', '--disallowedTools', 'Bash', 'Edit'],
    ['--resume', 'abc', 'fix it']],
  ['claude: = forms, flags, an optional value, a value that starts with -',
    ['claude_work', '--model=sonnet', '--verbose', '-d', 'api', '--append-system-prompt', '-be terse', '--continue'],
    ['--model=sonnet', '--verbose', '-d', 'api', '--append-system-prompt', '-be terse'],
    ['--continue']],
  ['claude: print mode, fork, worktree, -- and what follows',
    ['claude', '-p', '--output-format', 'json', '--fork-session', '-w', 'x', '--settings', 's.json', '--', '--model', 'opus'],
    ['--settings', 's.json'],
    ['-p', '--output-format', 'json', '--fork-session', '-w', 'x', '--', '--model', 'opus']],
  ['claude: an unknown option is dropped with its operand',
    ['claude', '--new-thing', 'v', '--tools', 'Read', 'Grep', '--add-dir', '../lib'],
    ['--tools', 'Read', 'Grep', '--add-dir', '../lib'],
    ['--new-thing', 'v']],
  ['codex: setup carried, subcommand, image, cd and prompt dropped',
    ['codex', '-m', 'o3', 'resume', '--last', '-s', 'read-only', '-i', 'x.png', '-C', '/tmp', '-c', 'a.b=1', 'hello'],
    ['-m', 'o3', '-s', 'read-only', '-c', 'a.b=1'],
    ['resume', '--last', '-i', 'x.png', '-C', '/tmp', 'hello']],
  ['codex: attached short values and flags',
    ['codex', '-mo3', '-aon-request', '--search', '--worktree'],
    ['-mo3', '-aon-request', '--search'],
    ['--worktree']],
  ['plain: nothing carried',
    ['bash', '--norc', '-i'],
    [],
    ['--norc', '-i']]
]

for (const [name, cmd, args, dropped] of cases) {
  test(name, () => assert.deepStrictEqual(carry(cmd), { args, dropped }))
}
