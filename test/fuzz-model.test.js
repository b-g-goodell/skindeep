'use strict'
// The fuzz harness's prediction model: a seed gives one sequence,
// and the predictions follow the README and decisions 0006 and 0023.
const test = require('node:test')
const assert = require('node:assert')
const { generate, initial, ACTIONS, claims } = require('../scripts/fuzz/model')

test('one seed gives one sequence and its predictions, another seed another', () => {
  assert.deepStrictEqual(generate(23, 40), generate(23, 40))
  assert.notDeepStrictEqual(generate(23, 40), generate(24, 40))
  for (const s of generate(5, 200)) assert.ok(s.claims.tabs.includes(s.claims.active), `step ${s.k}: the active tab is a tab`)
})

test('a closed active tab passes to its right neighbour, else its left, and Reopen adds a new id', () => {
  const s = initial()
  ACTIONS.chordNew.run(s)
  ACTIONS.chordNew.run(s)
  ACTIONS.chordPrev.run(s)
  assert.deepStrictEqual([s.tabs, s.active], [[1, 2, 3], 2])
  ACTIONS.chordClose.run(s)
  assert.deepStrictEqual([s.tabs, s.active], [[1, 3], 3])
  ACTIONS.menuClose.run(s)
  assert.deepStrictEqual([s.tabs, s.active], [[1], 1])
  ACTIONS.reopen.run(s)
  assert.deepStrictEqual([s.tabs, s.active, s.closed], [[1, 4], 4, 1])
})

test('a resize predicts the width at the skin\'s floor and the scale of decision 0006', () => {
  const s = initial('phosphor')
  ACTIONS.resize.run(s, { width: 400 })
  assert.deepStrictEqual([claims(s).width, claims(s).scale.toFixed(3)], [654, (654 / 1180).toFixed(3)])
  ACTIONS.skin.run(s, { skin: 'coffee' })
  assert.deepStrictEqual([claims(s).width, claims(s).scale], [550, 0.5])
})
