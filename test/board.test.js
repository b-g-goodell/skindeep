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
