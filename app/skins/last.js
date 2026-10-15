'use strict'
// The last skin used (decision 0022). Each window writes one file of its
// own, <dir>/<pid>, at launch and at each switch, by write and rename, so
// no two windows ever write one file. A file holds the time in ms and
// the skin's spec: a shipped name, or the folder of a skin opened by
// path.

const fs = require('fs')
const os = require('os')
const path = require('path')

const RACE_MS = 5000

function dir (env = process.env) {
  return path.join(env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state'), 'claude-skins', 'last-skins')
}

function record (d, pid, spec, now = Date.now()) {
  fs.mkdirSync(d, { recursive: true })
  const tmp = path.join(d, `.${pid}.tmp`)
  fs.writeFileSync(tmp, JSON.stringify({ t: now, spec }) + '\n')
  fs.renameSync(tmp, path.join(d, String(pid)))
}

// Every window's newest record, newest first. A file another window is
// renaming, or one that is not a record, is skipped.
function read (d) {
  let names
  try { names = fs.readdirSync(d) } catch (e) { return [] }
  const out = []
  for (const n of names.filter(n => /^\d+$/.test(n))) {
    try {
      const r = JSON.parse(fs.readFileSync(path.join(d, n), 'utf8'))
      if (typeof r.t === 'number' && typeof r.spec === 'string' && r.spec) out.push({ pid: Number(n), t: r.t, spec: r.spec })
    } catch (e) {}
  }
  return out.sort((a, b) => b.t - a.t)
}

// What a bare launch opens: null with no record, { spec } for the newest,
// or { choices } when windows recorded different skins within RACE_MS of
// the newest, the newest first, each spec once.
function pick (records, raceMs = RACE_MS) {
  if (!records.length) return null
  const near = records.filter(r => records[0].t - r.t <= raceMs)
  const choices = [...new Set(near.map(r => r.spec))]
  return choices.length > 1 ? { choices } : { spec: choices[0] }
}

// Records older than the race window before the newest can never be
// picked again: removed at each launch, so the files stay few.
function prune (d, records, raceMs = RACE_MS) {
  for (const r of records) if (records[0].t - r.t > raceMs) fs.rmSync(path.join(d, String(r.pid)), { force: true })
}

function forget (d) {
  let names
  try { names = fs.readdirSync(d) } catch (e) { return }
  for (const n of names) fs.rmSync(path.join(d, n), { force: true })
}

module.exports = { RACE_MS, dir, record, read, pick, prune, forget }
