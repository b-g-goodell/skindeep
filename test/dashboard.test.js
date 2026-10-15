'use strict'
// The sessions dashboard's sampling (decision 0028), on a fake session.
const test = require('node:test')
const assert = require('node:assert')
const { Dashboard } = require('../app/dashboard')

test('a session whose history is still being read gives no values, so its replayed totals are no rise', t => {
  let replaying = true
  let snap = { 'tokens.out': 400000 }
  const tab = { bus: { snapshot: () => snap }, agent: { report: () => ({ replaying }) } }
  const entry = { s: { cwd: '/x' }, tab, row: { key: 'k', label: 'claude', folder: '~/x', state: 'running' } }
  const views = []
  const d = new Dashboard({ list: () => [entry], watcher: () => { throw new Error('a tab needs no watcher') }, send: v => views.push(v), view: { send () {}, onLoad () {} }, log: () => {}, intervalMs: 5000 })
  t.after(() => d.end(0))
  d.start()
  replaying = false
  snap = { 'tokens.out': 1000000 }
  d.sample()
  snap = { 'tokens.out': 1000600 }
  d.sample()
  const v = views[views.length - 1]
  assert.deepStrictEqual(v.rows[0].series.tokens, [null, 1000000, 1000600])
  assert.deepStrictEqual(v.across.tokensPerMin, [0, 0, 600])
})

test('a tab whose agent begins another session (/resume) shows that session\'s totals as no rise', t => {
  let session = 's1'
  let snap = { 'tokens.out': 100 }
  const tab = { bus: { snapshot: () => snap }, agent: { report: () => ({ replaying: false, session }) } }
  const entry = { s: { cwd: '/x' }, tab, row: { key: 'k', label: 'claude', folder: '~/x', state: 'running' } }
  const views = []
  const d = new Dashboard({ list: () => [entry], watcher: () => { throw new Error('a tab needs no watcher') }, send: v => views.push(v), view: { send () {}, onLoad () {} }, log: () => {}, intervalMs: 5000 })
  t.after(() => d.end(0))
  d.start()
  session = 's2'
  snap = { 'tokens.out': 2000000 }
  d.sample()
  snap = { 'tokens.out': 2000300 }
  d.sample()
  assert.deepStrictEqual(views[views.length - 1].across.tokensPerMin, [0, 0, 300])
})
