'use strict'
// The JSONL tail shared by the Claude and Codex adapters, on temp files.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { Tail } = require('../app/metrics/tail')

function tmpFile (t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-skins-tail-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  return path.join(dir, 'log.jsonl')
}

function follow (t, file) {
  const got = []
  const tail = new Tail(file, (obj, history) => got.push([obj, history]))
  t.after(() => tail.stop())
  return { tail, got }
}

test('T1 a file larger than 8 MiB is delivered once, all of it as history', t => {
  const file = tmpFile(t)
  const pad = 'x'.repeat(1000)
  const n = 9000
  const text = []
  for (let i = 0; i < n; i++) text.push(JSON.stringify({ i, pad }))
  fs.writeFileSync(file, text.join('\n') + '\n')
  assert.ok(fs.statSync(file).size > 8 * 1024 * 1024)
  const { tail, got } = follow(t, file)
  tail.poll(1000)
  assert.strictEqual(got.length, n)
  assert.deepStrictEqual(got.map(([o]) => o.i), [...Array(n).keys()])
  assert.strictEqual(got.filter(([, history]) => !history).length, 0, 'lines delivered as live')
})

test('T2 appended lines arrive live when polled, a partial line waits for its newline', t => {
  const file = tmpFile(t)
  fs.writeFileSync(file, '{"h":1}\n')
  const { tail, got } = follow(t, file)
  assert.deepStrictEqual(got, [[{ h: 1 }, true]])
  fs.appendFileSync(file, '{"a":1}\n{"b":')
  assert.strictEqual(got.length, 1, 'nothing arrives unpolled')
  tail.poll(1000)
  assert.deepStrictEqual(got.slice(1), [[{ a: 1 }, false]])
  fs.appendFileSync(file, '2}\n')
  tail.poll(1200)
  assert.strictEqual(got.length, 2, 'polled again within 500 ms')
  tail.poll(1500)
  assert.deepStrictEqual(got.slice(1), [[{ a: 1 }, false], [{ b: 2 }, false]])
})

test('T3 after stop, appended lines are not delivered', t => {
  const file = tmpFile(t)
  fs.writeFileSync(file, '{"h":1}\n')
  const { tail, got } = follow(t, file)
  tail.stop()
  fs.appendFileSync(file, '{"a":1}\n')
  tail.poll(1000)
  assert.deepStrictEqual(got, [[{ h: 1 }, true]])
})

test('T4 a character split across the 8 MiB read boundary arrives whole', t => {
  const file = tmpFile(t)
  const chunk = 8 * 1024 * 1024
  const e = Buffer.from([0xc3, 0xa9]) // U+00E9
  const head = Buffer.from('{"p":"')
  const fill = Buffer.alloc(chunk - 1 - head.length, 'x')
  const line = Buffer.concat([head, fill, e, Buffer.from('"}\n{"q":1}\n')])
  assert.strictEqual(line.indexOf(e), chunk - 1)
  fs.writeFileSync(file, line)
  const { tail, got } = follow(t, file)
  tail.poll(1000)
  assert.strictEqual(got.length, 2)
  assert.strictEqual(got[0][0].p.slice(-1), '\u00e9')
  assert.ok(!got[0][0].p.includes('\ufffd'), 'replacement character delivered')
  assert.deepStrictEqual(got[1][0], { q: 1 })
})

test('T5 a history over 8 MiB is read a chunk at start and a chunk per poll, then appended lines', t => {
  const file = tmpFile(t)
  const pad = 'x'.repeat(1000)
  const n = 18000
  const text = []
  for (let i = 0; i < n; i++) text.push(JSON.stringify({ i, pad }))
  fs.writeFileSync(file, text.join('\n') + '\n')
  const size = fs.statSync(file).size
  assert.ok(size > 16 * 1024 * 1024 && size < 24 * 1024 * 1024)
  const { tail, got } = follow(t, file)
  const first = got.length
  assert.ok(first > 0 && first < n / 2, `the start read ${first} lines, want at most one chunk`)
  assert.ok(tail.replaying)
  fs.appendFileSync(file, '{"live":1}\n')
  tail.poll(1000)
  assert.ok(got.length > first && got.length < n, 'one chunk per poll')
  tail.poll(1001)
  assert.strictEqual(got.length, n)
  assert.ok(!tail.replaying)
  assert.deepStrictEqual(got.map(([o]) => o.i), [...Array(n).keys()])
  assert.strictEqual(got.filter(([, history]) => !history).length, 0, 'history delivered as live')
  tail.poll(1002)
  assert.deepStrictEqual(got.slice(n), [[{ live: 1 }, false]])
})

test('T6 a stopped tail reads no more history and is not replaying', t => {
  const file = tmpFile(t)
  const pad = 'x'.repeat(1000)
  fs.writeFileSync(file, Array.from({ length: 9000 }, (_, i) => JSON.stringify({ i, pad })).join('\n') + '\n')
  const { tail, got } = follow(t, file)
  const first = got.length
  tail.stop()
  assert.ok(!tail.replaying)
  tail.poll(1000)
  assert.strictEqual(got.length, first)
})

test('T7 a tail with an end reads the file to that byte as history, and nothing after, ever', t => {
  const file = tmpFile(t)
  fs.writeFileSync(file, '{"a":1}\n{"b":2}\n')
  const end = Buffer.byteLength('{"a":1}\n')
  const got = []
  const tail = new Tail(file, (obj, history) => got.push([obj, history]), { end })
  t.after(() => tail.stop())
  fs.appendFileSync(file, '{"c":3}\n')
  tail.poll(1000)
  tail.poll(2000)
  assert.deepStrictEqual(got, [[{ a: 1 }, true]])
  assert.ok(!tail.replaying)
})
