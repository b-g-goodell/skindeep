'use strict'
// The snapshots of New tab... (decision 0037): the tool's listing and
// bwrap line parsed, the shell form's words quoted so bash splits them
// back, and a path inside a snapshot mapped to the host's through the
// binds, symlinks followed as the snapshot resolves them.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const snapshots = require('../app/snapshots')

const LIST = '20261009-181110-37ec18\tcurrent\tlive\t2026-10-09T18:11:10-0600\tcurrent\n' +
  '20261010-184729-168f57\tfresh\tsandbox\t2026-10-10T18:47:29-0600\tLean Harness Builder\n' +
  'junk\n'

const STORE = '/home/u/.local/share/select-agent-config'
const ARGV = `bwrap --bind / / --dev-bind /dev /dev --bind ${STORE}/snapshots/s1/claude /home/u/.claude ` +
  `--bind ${STORE}/snapshots/s1/agent-config /home/u/.config/agent-config --bind ${STORE}/sandbox/claude-split /home/u/.claude-split ` +
  `--ro-bind /home/u/.codex/packages /home/u/.codex/packages --bind ${STORE}/sandbox/home-claude.json /home/u/.claude.json ` +
  '--die-with-parent --chdir /home/u/Repos/x bash --rcfile /opt/sac/rc.sh -i\n'

test('the listing: one row per snapshot, a name with blanks whole, junk skipped', () => {
  assert.deepStrictEqual(snapshots.parseList(LIST), [
    { id: '20261009-181110-37ec18', lineage: 'current', accounts: 'live', created: '2026-10-09T18:11:10-0600', name: 'current' },
    { id: '20261010-184729-168f57', lineage: 'fresh', accounts: 'sandbox', created: '2026-10-10T18:47:29-0600', name: 'Lean Harness Builder' }
  ])
  assert.deepStrictEqual(snapshots.parseList(''), [])
})

test('the binds of the bwrap line, in order, and null for another command', () => {
  const b = snapshots.parseBinds(ARGV)
  assert.strictEqual(b.length, 7)
  assert.deepStrictEqual(b[0], { src: '/', dst: '/' })
  assert.deepStrictEqual(b[2], { src: `${STORE}/snapshots/s1/claude`, dst: '/home/u/.claude' })
  assert.deepStrictEqual(b[5], { src: '/home/u/.codex/packages', dst: '/home/u/.codex/packages' })
  assert.deepStrictEqual(b[6], { src: `${STORE}/sandbox/home-claude.json`, dst: '/home/u/.claude.json' })
  assert.strictEqual(snapshots.parseBinds('bash -i\n'), null)
  assert.strictEqual(snapshots.parseBinds("bwrap 'unclosed"), null)
})

test('the shell form: the tool, shell, the id, --, then words bash splits back', () => {
  const cmd = ['claude', '--append-system-prompt', "it's \"quoted\" $HOME ~/x", '--settings', '/run/a b.json', '']
  const words = snapshots.wrap('s1', cmd)
  assert.deepStrictEqual(words.slice(0, 4), ['select-agent-config', 'shell', 's1', '--'])
  // The tool joins the words with blanks and bash -c splits the line.
  const back = execFileSync('bash', ['-c', 'printf "%s\\n" ' + words.slice(4).join(' ')], { encoding: 'utf8' })
  assert.deepStrictEqual(back.split('\n').slice(0, -1), cmd)
})

test('a path inside the snapshot, mapped through the binds, the last bind winning', () => {
  const binds = [{ src: '/', dst: '/' }, { src: '/store/a', dst: '/x' }, { src: '/store/b', dst: '/x/y' }]
  assert.strictEqual(snapshots.outside('/etc/hosts', binds), '/etc/hosts')
  assert.strictEqual(snapshots.outside('/x', binds), '/store/a')
  assert.strictEqual(snapshots.outside('/x/q/r', binds), '/store/a/q/r')
  assert.strictEqual(snapshots.outside('/x/y/z', binds), '/store/b/z')
  assert.strictEqual(snapshots.outside('/x/yz', binds), '/store/a/yz')
  assert.strictEqual(snapshots.outside('/x/y', []), '/x/y')
  assert.strictEqual(snapshots.outside('/x/y', null), '/x/y')
})

test('a symlink met on the way is followed as the snapshot resolves it', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshots-test-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  // A canonical home that exists nowhere on this host.
  const home = path.join('/nonexistent-home', path.basename(root))
  const snap = path.join(root, 'snap', 'claude')
  const split = path.join(root, 'sandbox', 'claude-split')
  fs.mkdirSync(path.join(snap, 'projects', 'p'), { recursive: true })
  fs.writeFileSync(path.join(snap, 'projects', 'p', 's.jsonl'), '')
  fs.writeFileSync(path.join(snap, 'settings.json'), '{}')
  fs.mkdirSync(path.join(split, 'acct', '.claude'), { recursive: true })
  // The account dir's links name the canonical home, as the sandbox's do.
  fs.symlinkSync(path.join(home, '.claude', 'projects'), path.join(split, 'acct', '.claude', 'projects'))
  fs.symlinkSync(path.join(home, '.claude', 'settings.json'), path.join(split, 'acct', '.claude', 'settings.json'))
  fs.symlinkSync('../dangling', path.join(split, 'acct', '.claude', 'skills'))
  const binds = [{ src: '/', dst: '/' }, { src: snap, dst: path.join(home, '.claude') }, { src: split, dst: path.join(home, '.claude-split') }]
  assert.strictEqual(snapshots.outside(path.join(home, '.claude', 'projects', 'p', 's.jsonl'), binds), path.join(snap, 'projects', 'p', 's.jsonl'))
  assert.strictEqual(snapshots.outside(path.join(home, '.claude-split', 'acct', '.claude', 'projects', 'p', 's.jsonl'), binds), path.join(snap, 'projects', 'p', 's.jsonl'))
  assert.strictEqual(snapshots.outside(path.join(home, '.claude-split', 'acct', '.claude', 'settings.json'), binds), path.join(snap, 'settings.json'))
  // A relative link resolves against its own directory inside the snapshot.
  assert.strictEqual(snapshots.outside(path.join(home, '.claude-split', 'acct', '.claude', 'skills', 'k'), binds), path.join(split, 'acct', 'dangling', 'k'))
  // A path that does not exist maps by the binds alone.
  assert.strictEqual(snapshots.outside(path.join(home, '.claude', 'none', 'f'), binds), path.join(snap, 'none', 'f'))
})

test('the tab\'s environment: every CLAUDE variable and CODEX_HOME gone, as the tool scrubs them', () => {
  const env = { PATH: '/bin', CLAUDE_CONFIG_DIR: '/p', CLAUDECODE: '1', CLAUDE_CODE_TMPDIR: '/run', CODEX_HOME: '/c', CODEX_OTHER: 'x', TMPDIR: '/t' }
  assert.deepStrictEqual(snapshots.scrub(env), { PATH: '/bin', CODEX_OTHER: 'x', TMPDIR: '/t' })
  assert.strictEqual(env.CLAUDE_CONFIG_DIR, '/p')
})

test('what the chooser shows for a row', () => {
  assert.strictEqual(snapshots.describe({ name: 'empty', lineage: 'fresh', accounts: 'sandbox' }), 'empty  (fresh install, sandbox accounts)')
  assert.strictEqual(snapshots.describe({ name: 'current', lineage: 'current', accounts: 'live' }), 'current  (fork of the live configuration, live accounts)')
})

test('without the tool on PATH: no list, no binds', () => {
  const env = { PATH: '/nonexistent' }
  assert.strictEqual(snapshots.tool(env), null)
  assert.deepStrictEqual(snapshots.list(env), [])
  assert.strictEqual(snapshots.binds('s1', env), null)
})
