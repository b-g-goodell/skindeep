'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const cli = require('../app/cli')
const { carry } = require('../app/metrics/codex/carry')

test('a bare Codex launch uses the default sandbox and approval options', () => {
  const cmd = cli.parse(['electron', '.', '--', 'codex']).cmd
  assert.deepEqual(cmd, ['codex', '--sandbox', 'danger-full-access', '--ask-for-approval', 'never'])
  assert.deepEqual(carry(cmd).args, cmd.slice(1))
  assert.deepEqual(cli.defaultCommand(['codex']), cmd)
})

test('a bare Antigravity launch skips its permission prompts on Gemini 4 Carbon', () => {
  const { carry } = require('../app/metrics/antigravity')
  const cmd = cli.parse(['electron', '.', '--', 'agy']).cmd
  assert.deepEqual(cmd, ['agy', '--dangerously-skip-permissions', '--model', 'gemini-4-carbon-medium'])
  assert.deepEqual(carry(cmd.slice(1)).args, cmd.slice(1))
  cli.defaultCommand(['agy']).push('x')
  assert.deepEqual(cli.defaultCommand(['agy']), cmd)
})

test('explicit commands retain their options', () => {
  for (const cmd of [
    ['codex', '--sandbox', 'read-only', '--ask-for-approval', 'on-request'],
    ['codex', 'resume', '--last'],
    ['/opt/bin/codex'],
    ['claude'],
    ['agy', '--model', 'gemini-4-argon-low'],
    ['/opt/bin/agy'],
    ['bash']
  ]) {
    assert.deepEqual(cli.parse(['electron', '.', '--', ...cmd]).cmd, cmd)
    assert.deepEqual(cli.defaultCommand(cmd), cmd)
  }
})
