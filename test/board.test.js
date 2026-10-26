'use strict'
// The issue board of the sessions dashboard (decision 0029): remotes to
// forges, the daily series, and one read per remote per refresh.
const test = require('node:test')
const assert = require('node:assert')
const { Boards, parseRemote, series, stamp } = require('../app/board')

const pick = r => r && [r.forge, r.key]

test('remotes: https, ssh and scp forms map to the forge on https', () => {
  assert.deepStrictEqual(pick(parseRemote('https://git.example.org/b-g/claude-skins.git')), ['gitea', 'https://git.example.org/b-g/claude-skins'])
  assert.deepStrictEqual(pick(parseRemote('https://github.com/o/r')), ['github', 'https://github.com/o/r'])
  assert.deepStrictEqual(pick(parseRemote('git@github.com:o/r.git')), ['github', 'https://github.com/o/r'])
  assert.deepStrictEqual(pick(parseRemote('ssh://git@git.example.org:2222/o/r.git')), ['gitea', 'https://git.example.org/o/r'])
  assert.deepStrictEqual(pick(parseRemote('https://git.example.org:8443/o/r/')), ['gitea', 'https://git.example.org:8443/o/r'])
})

test('remotes: a host spelled as a non-canonical IPv4 address is refused (#210)', () => {
  // Node 24.22.0's checkServerIdentity misjudges these spellings
  // (CVE-2026-106069, CVE-2026-106072): the scp-like form and ssh:// and
  // git:// URLs pass them through unchanged.
  const odd = ['0x7f.0.0.1', '0177.0.0.1', '0127.0.0.1', '2130706433', '127.1', '127.0.0.1.', '256.0.0.1', '127.0.0.0x1']
  for (const h of odd) {
    assert.strictEqual(parseRemote(`git@${h}:o/r.git`), null, `scp ${h}`)
    assert.strictEqual(parseRemote(`ssh://git@${h}/o/r.git`), null, `ssh ${h}`)
    assert.strictEqual(parseRemote(`git://${h}/o/r.git`), null, `git ${h}`)
  }
  // Fullwidth digits (CVE-2026-105483): ssh:// percent-encodes them.
  assert.strictEqual(parseRemote('ssh://git@\uff11\uff12\uff17.0.0.1/o/r.git'), null)
  // https:// canonicalizes the host before it is used.
  assert.deepStrictEqual(pick(parseRemote('https://0x7f.0.0.1/o/r')), ['gitea', 'https://127.0.0.1/o/r'])
  assert.deepStrictEqual(pick(parseRemote('https://\uff11\uff12\uff17.0.0.1/o/r')), ['gitea', 'https://127.0.0.1/o/r'])
  // Canonical IPv4, IPv6 and names whose labels hold digits still parse.
  assert.deepStrictEqual(pick(parseRemote('git@192.168.1.10:o/r.git')), ['gitea', 'https://192.168.1.10/o/r'])
  assert.deepStrictEqual(pick(parseRemote('ssh://git@10.0.0.1:2222/o/r.git')), ['gitea', 'https://10.0.0.1/o/r'])
  assert.deepStrictEqual(pick(parseRemote('ssh://git@[::1]/o/r.git')), ['gitea', 'https://[::1]/o/r'])
  assert.deepStrictEqual(pick(parseRemote('git@git2.example.org:o/r.git')), ['gitea', 'https://git2.example.org/o/r'])
  assert.deepStrictEqual(pick(parseRemote('git@0x7f.example.org:o/r.git')), ['gitea', 'https://0x7f.example.org/o/r'])
})

test('remotes: a user or password in the URL is dropped', () => {
  const r = parseRemote('https://me:secret-token@git.example.org/o/r.git')
  assert.strictEqual(r.key, 'https://git.example.org/o/r')
  assert.ok(!JSON.stringify(r).includes('secret-token'))
})

test('remotes: plain http only on the loopback host, no other form', () => {
  assert.deepStrictEqual(pick(parseRemote('http://127.0.0.1:3000/o/r.git')), ['gitea', 'http://127.0.0.1:3000/o/r'])
  assert.strictEqual(parseRemote('http://git.example.org/o/r.git'), null)
  assert.strictEqual(parseRemote('/srv/git/r.git'), null)
  assert.strictEqual(parseRemote('file:///srv/git/r.git'), null)
  assert.strictEqual(parseRemote('https://gitlab.example.org/group/sub/r.git'), null)
  assert.strictEqual(parseRemote(''), null)
  assert.strictEqual(parseRemote(null), null)
})

test('the daily series: open at each day\'s end, closed in each day, today last', () => {
  const now = new Date(2026, 9, 12, 15, 0).getTime()
  const day = (d, h = 12) => new Date(2026, 9, 12 + d, h).getTime()
  const issues = [
    { created: day(-20), closed: null },
    { created: day(-10), closed: day(-5) },
    { created: day(-3), closed: day(0, 9) },
    { created: day(0, 10), closed: null }
  ]
  const s = series(issues, now)
  assert.strictEqual(s.open.length, 14)
  assert.deepStrictEqual(s.open, [1, 1, 1, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2])
  assert.deepStrictEqual(s.closed, [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
  assert.strictEqual(s.openNow, 2)
  assert.strictEqual(s.closed14, 2)
})

test('stamps: gh\'s empty and zero-year closedAt read as open', () => {
  assert.strictEqual(stamp(''), null)
  assert.strictEqual(stamp('0001-01-01T00:00:00Z'), null)
  assert.strictEqual(stamp(null), null)
  assert.strictEqual(stamp('2026-10-12T10:00:00Z'), Date.parse('2026-10-12T10:00:00Z'))
})

const settle = () => new Promise(resolve => setImmediate(resolve))

test('one read per remote per refresh, shared by its folders, a miss kept as no access', async () => {
  let now = new Date(2026, 9, 12, 15, 0).getTime()
  const reads = []
  const remotes = { '/a': 'https://git.example.org/o/r.git', '/a/sub': 'git@git.example.org:o/r.git', '/b': 'https://git.example.org/o/locked', '/c': null }
  const boards = new Boards({
    now: () => now,
    remote: async f => remotes[f],
    fetch: async r => {
      reads.push(r.key)
      if (r.repo === 'locked') throw new Error('no login')
      return [{ created: now - 3600000, closed: null }]
    }
  })
  // A folder's board is read on the get after its remote is known.
  const pump = async folders => {
    for (let i = 0; i < 3; i++) {
      for (const f of folders) boards.get(f)
      await settle()
    }
  }
  assert.deepStrictEqual(boards.get('/a'), { state: 'loading' })
  await pump(['/a', '/a/sub', '/b', '/c'])
  assert.strictEqual(boards.get('/a').openNow, 1)
  assert.strictEqual(boards.get('/a/sub').openNow, 1)
  assert.deepStrictEqual(boards.get('/b'), { state: 'no access' })
  assert.strictEqual(boards.get('/c'), null)
  assert.deepStrictEqual(reads.sort(), ['https://git.example.org/o/locked', 'https://git.example.org/o/r'])
  now += 299000
  await pump(['/a', '/a/sub', '/b'])
  assert.strictEqual(reads.length, 2, 'no read before the refresh is due')
  now += 2000
  await pump(['/a', '/a/sub', '/b'])
  assert.strictEqual(reads.length, 4, 'one more read of each remote once due')
})
