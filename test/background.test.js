'use strict'
// Background sessions seen from a tab (decision 0030): Claude Code's
// refusal to open one in place, the arguments that let the app open it
// instead, the subcommands it injects nothing into, and the transcript
// `claude attach ID` follows.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { refusal, bareResume, attachFor } = require('../app/background')
const { subcommand, attachedTranscript, create } = require('../app/metrics/claude')
const { Bus } = require('../app/metrics/bus')

// As Claude Code 2.1.296 prints it (function Sfe), wrapped by the
// terminal's width, under the picker's last rows.
const SCREEN = [
  '  Resume Session',
  '> Sort the photos   2 minutes ago',
  '',
  '"Sort the photos" is running in the background (5e3a91c0). Run',
  '`claude attach 5e3a91c0` to open it, or `claude stop 5e3a91c0` first to',
  'resume it here.'
].join('\n')

test('the refusal names the job, wrapped or not, only at the end of the screen', () => {
  assert.strictEqual(refusal(SCREEN), '5e3a91c0')
  assert.strictEqual(refusal(SCREEN.replace(/\n/g, ' ')), '5e3a91c0')
  assert.strictEqual(refusal(SCREEN + '\n' + 'more\n'.repeat(10)), null, 'scrolled out of the tail')
  assert.strictEqual(refusal(SCREEN.replace('attach 5e3a91c0', 'attach 00000000')), null, 'two ids')
  assert.strictEqual(refusal('That session is running in the background. Run `claude agents` to find it'), null)
  assert.strictEqual(refusal(null), null)
})

test('only resume and continue arguments let the app open the session', () => {
  for (const args of [[], ['--resume'], ['-r'], ['--resume', 'abc'], ['-r', 'abc'], ['--resume=abc'], ['--continue'], ['-c']]) {
    assert.strictEqual(bareResume(args), true, args.join(' '))
  }
  for (const args of [['--model', 'opus'], ['--resume', '--disallowedTools', 'Bash'], ['--settings', 'f'], ['--permission-mode', 'plan', '-r'], ['--resume', 'abc', 'prompt']]) {
    assert.strictEqual(bareResume(args), false, args.join(' '))
  }
  assert.deepStrictEqual(attachFor(['claude', '--resume'], SCREEN), ['claude', 'attach', '5e3a91c0'])
  assert.deepStrictEqual(attachFor(['claude_work', '-r'], SCREEN), ['claude_work', 'attach', '5e3a91c0'])
  assert.strictEqual(attachFor(['claude', '--resume', '--model', 'opus'], SCREEN), null, 'the refusal is the user\'s own')
  assert.strictEqual(attachFor(['claude', '--resume'], 'Goodbye!'), null)
})

test('a subcommand is the first argument only', () => {
  assert.strictEqual(subcommand(['claude', 'attach', 'x']), 'attach')
  assert.strictEqual(subcommand(['claude', 'mcp', 'list']), 'mcp')
  assert.strictEqual(subcommand(['claude', '--model', 'opus', 'attach']), null, 'Claude Code reads it as a prompt')
  assert.strictEqual(subcommand(['claude', 'fix the bug']), null)
  assert.strictEqual(subcommand(['claude']), null)
})

function tempProfile (t) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'background-'))
  t.after(() => fs.rmSync(d, { recursive: true, force: true }))
  return d
}

test('claude attach ID follows the job\'s transcript, keeping two fields of its state', t => {
  const cfg = tempProfile(t)
  fs.mkdirSync(path.join(cfg, 'jobs', '5e3a91c0'), { recursive: true })
  fs.writeFileSync(path.join(cfg, 'jobs', '5e3a91c0', 'state.json'), JSON.stringify({ sessionId: '5e3a91c0-7b2d-4c1e-9f00-1a2b3c4d5e6f', cwd: '/home/u/Repos', bridgeOwnerAccountUuid: 'x', respawnFlags: ['--settings', 'f'] }))
  const want = { file: path.join(cfg, 'projects', '-home-u-Repos', '5e3a91c0-7b2d-4c1e-9f00-1a2b3c4d5e6f.jsonl'), session: '5e3a91c0-7b2d-4c1e-9f00-1a2b3c4d5e6f' }
  assert.deepStrictEqual(attachedTranscript({ CLAUDE_CONFIG_DIR: cfg }, '5e3a91c0'), want)
  assert.strictEqual(attachedTranscript({ CLAUDE_CONFIG_DIR: cfg }, 'Sort'), null)
  assert.strictEqual(attachedTranscript({ CLAUDE_CONFIG_DIR: cfg }, '../jobs'), null)
})

test('a subcommand gets nothing injected: attach watches its transcript, the others run plain', async t => {
  const cfg = tempProfile(t)
  const ctx = cmd => ({ cmd, cwd: cfg, env: { CLAUDE_CONFIG_DIR: cfg, PATH: process.env.PATH }, runDir: cfg, root: cfg, store: path.join(cfg, 'store'), options: { statusline: 'always' }, bus: new Bus(), log: () => {} })
  const attach = create(ctx(['claude', 'attach', '5e3a91c0']))
  assert.deepStrictEqual(await attach.prepare(), { args: [], notice: null })
  assert.deepStrictEqual(attach.report().channels.map(c => c.name), ['transcript'])
  attach.close()
  const mcp = create(ctx(['claude', 'mcp', 'list']))
  assert.deepStrictEqual(await mcp.prepare(), { args: [], notice: null })
  assert.deepStrictEqual(mcp.report().channels, [])
  assert.ok(!fs.existsSync(path.join(cfg, 'store')))
})
