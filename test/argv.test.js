'use strict'
// The command line of New tab... split into argv (decision 0025).
const test = require('node:test')
const assert = require('node:assert')
const { split } = require('../app/argv')
const { quote } = require('../app/identity')

test('blanks separate words, quotes and backslashes join them', () => {
  assert.deepStrictEqual(split('  claude --model  opus\t-c ').argv, ['claude', '--model', 'opus', '-c'])
  assert.deepStrictEqual(split(`codex -c 'model="o3"' a\\ b "x \\"y\\" \\n"`).argv, ['codex', '-c', 'model="o3"', 'a b', 'x "y" \\n'])
  assert.deepStrictEqual(split("a'b'\"c\"d ''").argv, ['abcd', ''])
})

test('nothing expands', () => {
  assert.deepStrictEqual(split('ls ~ $HOME *.js >out').argv, ['ls', '~', '$HOME', '*.js', '>out'])
})

test('the inverse of the quoting the strip uses', () => {
  const words = ['claude', '--append-system-prompt', "it's a test", 'two  spaces', 'a"b', 'back\\slash', '$x', '']
  assert.deepStrictEqual(split(words.map(quote).join(' ')).argv, words)
})

test('a malformed line is refused with a reason', () => {
  assert.match(split("claude 'open").error, /unclosed single quote/)
  assert.match(split('claude "open').error, /unclosed double quote/)
  assert.match(split('claude \\').error, /backslash/)
  assert.match(split('   ').error, /empty/)
})
