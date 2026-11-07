'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = path.join(__dirname, '..')
const tmpBase = process.env.XDG_RUNTIME_DIR || os.tmpdir()

for (const cached of [false, true]) {
  test(`the installer removes shared write access before running a ${cached ? 'cached' : 'downloaded'} runtime`, t => {
    const dir = fs.mkdtempSync(path.join(tmpBase, 'skindeep-install-'))
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    const repo = path.join(dir, 'repo')
    const tools = path.join(dir, 'tools')
    const electron = path.join(repo, 'node_modules', 'electron')
    fs.mkdirSync(electron, { recursive: true })
    fs.mkdirSync(path.join(repo, 'scripts'))
    fs.mkdirSync(tools)
    fs.copyFileSync(path.join(root, 'install.sh'), path.join(repo, 'install.sh'))
    fs.writeFileSync(path.join(repo, 'package-lock.json'), '{}')
    fs.writeFileSync(path.join(repo, 'node_modules', '.claude-skins-lock'), '{}')
    fs.writeFileSync(path.join(repo, 'scripts', 'sandbox.sh'), 'sandbox_env() { :; }\nsandbox_starts() { return 0; }\n')
    for (const name of ['fc-list', 'make', 'g++', 'python3']) fs.writeFileSync(path.join(tools, name), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
    fs.writeFileSync(path.join(tools, 'npm'), '#!/bin/sh\nexit 88\n', { mode: 0o755 })

    const fake = '#!/bin/sh\nif [ -n "$(find "$(dirname "$0")" -perm /022 -print -quit)" ]; then\n  echo "runtime still writable by other users" >&2\n  exit 9\nfi\necho v44.10.0\n'
    const download = `
const fs = require('fs')
const path = require('path')
const dist = path.join(__dirname, 'dist')
if (!fs.existsSync(dist)) {
  fs.mkdirSync(path.join(dist, 'resources'), { recursive: true })
  fs.writeFileSync(path.join(dist, 'electron'), ${JSON.stringify(fake)})
  fs.writeFileSync(path.join(dist, 'resources', 'data.pak'), 'resource')
  fs.writeFileSync(path.join(dist, 'private'), 'private')
  fs.chmodSync(dist, 0o777)
  fs.chmodSync(path.join(dist, 'resources'), 0o777)
  fs.chmodSync(path.join(dist, 'electron'), 0o777)
  fs.chmodSync(path.join(dist, 'resources', 'data.pak'), 0o666)
  fs.chmodSync(path.join(dist, 'private'), 0o600)
}
`
    const installer = path.join(electron, 'install.js')
    fs.writeFileSync(installer, download)
    if (cached) assert.equal(spawnSync(process.execPath, [installer]).status, 0)
    const result = spawnSync('sh', [path.join(repo, 'install.sh')], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${tools}:${path.dirname(process.execPath)}:${process.env.PATH}`, BINDIR: path.join(dir, 'bin') }
    })
    assert.equal(result.status, 0, result.stderr)
    const dist = path.join(electron, 'dist')
    for (const [file, mode] of [['', 0o755], ['resources', 0o755], ['electron', 0o755], ['resources/data.pak', 0o644], ['private', 0o600]]) {
      assert.equal(fs.statSync(path.join(dist, file)).mode & 0o777, mode, file || 'dist')
    }
    assert.match(result.stdout, /Chromium's sandbox starts/)
  })
}
