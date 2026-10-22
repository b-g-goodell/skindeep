'use strict'
// The runtime root and the launch's dir (decision 0016): where they lie
// without XDG_RUNTIME_DIR, and the refusal of a dir another user could
// have made or could rename away.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const runtime = require('../app/runtime')

function scratch (t) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-skins-runtime-'))
  t.after(() => fs.rmSync(d, { recursive: true, force: true }))
  return d
}

function env (t, vars) {
  const was = {}
  for (const k of Object.keys(vars)) {
    was[k] = process.env[k]
    if (vars[k] === undefined) delete process.env[k]
    else process.env[k] = vars[k]
  }
  t.after(() => {
    for (const k of Object.keys(was)) {
      if (was[k] === undefined) delete process.env[k]
      else process.env[k] = was[k]
    }
  })
}

test('R1 owned takes a dir of this uid, mode 700, under a private parent', t => {
  const d = path.join(scratch(t), 'ok')
  fs.mkdirSync(d, { mode: 0o700 })
  assert.strictEqual(runtime.owned(d), d)
})

test('R2 owned refuses group or other bits, a link, and another uid\'s dir', t => {
  const s = scratch(t)
  const open = path.join(s, 'open')
  fs.mkdirSync(open)
  fs.chmodSync(open, 0o777)
  assert.throws(() => runtime.owned(open), { message: `${open}: mode 777, want 700` })
  const real = path.join(s, 'real')
  fs.mkdirSync(real, { mode: 0o700 })
  const link = path.join(s, 'link')
  fs.symlinkSync(real, link)
  assert.throws(() => runtime.owned(link), { message: `${link}: not a directory` })
  if (process.getuid() !== 0) assert.throws(() => runtime.owned('/'), { message: `/: owned by uid 0, not ${process.getuid()}` })
})

test('R3 owned refuses a dir whose parent others may write without the sticky bit, and takes one with it', t => {
  const s = scratch(t)
  const shared = path.join(s, 'shared')
  fs.mkdirSync(shared)
  fs.chmodSync(shared, 0o777)
  const d = path.join(shared, 'd')
  fs.mkdirSync(d, { mode: 0o700 })
  assert.throws(() => runtime.owned(d), { message: `${d}: ${fs.realpathSync(shared)} writable by others` })
  fs.chmodSync(shared, 0o1777)
  assert.strictEqual(runtime.owned(d), d)
  // Group write by this uid's primary group, a user private group.
  fs.chmodSync(shared, 0o770)
  assert.strictEqual(fs.statSync(shared).gid, process.getgid())
  assert.strictEqual(runtime.owned(d), d)
})

test('R4 without XDG_RUNTIME_DIR the root lies in the state dir, never in TMPDIR, and the launch\'s dir is private', t => {
  const s = scratch(t)
  fs.chmodSync(s, 0o700)
  const state = path.join(s, 'state')
  env(t, { XDG_RUNTIME_DIR: undefined, XDG_STATE_HOME: state, TMPDIR: path.join(s, 'tmp'), SKINNED_RUNTIME_DIR: undefined })
  assert.strictEqual(runtime.base(), path.join(state, 'claude-skins-run'))
  const dir = runtime.create()
  assert.strictEqual(dir, path.join(state, 'claude-skins-run', String(process.pid)))
  assert.strictEqual(fs.statSync(dir).mode & 0o777, 0o700)
  assert.ok(!fs.existsSync(path.join(s, 'tmp')), 'nothing is made in TMPDIR')
})

test('R5 create refuses a root that another made open to all', t => {
  const s = scratch(t)
  fs.chmodSync(s, 0o700)
  const root = path.join(s, 'run', 'claude-skins')
  fs.mkdirSync(root, { recursive: true, mode: 0o700 })
  fs.chmodSync(root, 0o777)
  env(t, { XDG_RUNTIME_DIR: path.join(s, 'run'), SKINNED_RUNTIME_DIR: undefined })
  assert.throws(() => runtime.create(), { message: `${root}: mode 777, want 700` })
  assert.deepStrictEqual(fs.readdirSync(root), [], 'nothing is made in it')
})
