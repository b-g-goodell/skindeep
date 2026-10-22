'use strict'
// The log form of a command line (app/identity.js logged): no value of
// the user's reaches the log, the app's own words do.
const test = require('node:test')
const assert = require('node:assert')
const { logged } = require('../app/identity')

const SECRET = 'sk-ant-hunter2'
const SETTINGS = '/home/u/.local/state/claude-skins/settings/1234-0.json'

test('L1 a secret value is absent and the injected --settings path present', () => {
  const cmd = ['claude', '--settings', SETTINGS, '--api-key', SECRET, `--token=${SECRET}`, `-p${SECRET}`, SECRET, '--', `--x=${SECRET}`]
  const line = logged(cmd, [1, 2])
  assert.ok(!line.includes(SECRET), line)
  assert.ok(!line.includes('hunter2'), line)
  assert.ok(line.includes(`--settings ${SETTINGS}`), line)
  assert.strictEqual(line, `claude --settings ${SETTINGS} --api-key <14> --token=<14> -p<14> <14> -- <18>`)
})

test('L2 the program, option names and short flags stay', () => {
  assert.strictEqual(logged(['codex', '-c', 'k=v', '--model', 'o3', '--full-auto']), 'codex -c <3> --model <2> --full-auto')
  assert.strictEqual(logged(['/usr/bin/my prog', 'x']), "'/usr/bin/my prog' <1>")
})

test('L3 a user --settings value is a value: only the injected one is kept', () => {
  assert.strictEqual(logged(['claude', '--settings', SETTINGS, '--settings', '/secret/path.json'], [1, 2]), `claude --settings ${SETTINGS} --settings <17>`)
})

test('L4 words the app built are kept whole and quoted', () => {
  assert.strictEqual(logged(['claude', 'attach', '1a2b3c4d'], [1, 2]), 'claude attach 1a2b3c4d')
  assert.strictEqual(logged(['claude', 'a b'], [1]), "claude 'a b'")
})
