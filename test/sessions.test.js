'use strict'
// Finding the transcript of a Claude session the app did not start
// (decision 0027), on temp profiles, with this test's own process as the
// session.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const sessions = require('../app/sessions')

const PID = process.pid
const CWD = '/work/shared'
const ID_A = 'aaaaaaaa-0000-4000-8000-000000000001'
const ID_B = 'bbbbbbbb-0000-4000-8000-000000000002'

function startTicks () {
  const s = fs.readFileSync(`/proc/${PID}/stat`, 'utf8')
  return s.slice(s.lastIndexOf(')') + 2).split(' ')[19]
}

// A profile with a projects folder for CWD, its sessions folder, and
// session-env folders for the ids given.
function profile (root, name, ids = []) {
  const p = path.join(root, name)
  fs.mkdirSync(path.join(p, 'projects', sessions.slug(CWD)), { recursive: true })
  fs.mkdirSync(path.join(p, 'sessions'), { recursive: true })
  for (const id of ids) fs.mkdirSync(path.join(p, 'session-env', id), { recursive: true })
  return p
}

function transcript (p, id, mtimeS) {
  const f = path.join(p, 'projects', sessions.slug(CWD), `${id}.jsonl`)
  fs.writeFileSync(f, '{}\n')
  fs.utimesSync(f, mtimeS, mtimeS)
  return f
}

function record (p, over = {}) {
  const d = Object.assign({ pid: PID, sessionId: ID_A, cwd: CWD, procStart: startTicks(), bridgeSessionId: 'kept-nowhere', messagingSocketPath: '/x.sock' }, over)
  fs.writeFileSync(path.join(p, 'sessions', `${PID}.json`), JSON.stringify(d))
}

function tempRoot (t) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sessions-test-'))
  t.after(() => fs.rmSync(d, { recursive: true, force: true }))
  return d
}

const now = () => Date.now() / 1000
const scanEntry = () => ({ pid: PID, cwd: CWD, started: (now() - 60) * 1000 })

test('R1 the record names the session: its transcript, not the one of its folder written last', t => {
  const p = profile(tempRoot(t), 'lab')
  const mine = transcript(p, ID_A, now() - 30)
  transcript(p, ID_B, now() - 1)
  record(p)
  const f = sessions.claudeTranscript(scanEntry(), [p])
  assert.deepStrictEqual([f.file, f.session, f.profile], [mine, ID_A, p])
})

test('R2 a record of another process with this pid (another start) is ignored', t => {
  const p = profile(tempRoot(t), 'lab')
  transcript(p, ID_A, now() - 30)
  const newest = transcript(p, ID_B, now() - 1)
  record(p, { procStart: String(Number(startTicks()) - 1) })
  assert.strictEqual(sessions.claudeRecord(PID, [p]), null)
  assert.strictEqual(sessions.claudeTranscript(scanEntry(), [p]).file, newest)
})

test('R3 a session named before its transcript is written: no file, the profile known', t => {
  const p = profile(tempRoot(t), 'lab')
  transcript(p, ID_B, now() - 1)
  record(p)
  assert.deepStrictEqual(sessions.claudeTranscript(scanEntry(), [p]), { file: null, session: ID_A, mtime: 0, profile: p })
})

test('R4 a sessions folder two profiles share: the profile is the one that holds session-env/<id>', t => {
  const root = tempRoot(t)
  const a = profile(root, 'a', [ID_A])
  const b = profile(root, 'b')
  fs.rmSync(path.join(b, 'sessions'), { recursive: true })
  fs.symlinkSync(path.join(a, 'sessions'), path.join(b, 'sessions'))
  record(a)
  const r = sessions.claudeRecord(PID, [a, b])
  assert.deepStrictEqual([r.session, r.profiles.length], [ID_A, 2])
  assert.strictEqual(sessions.claudeTranscript(scanEntry(), [a, b]).profile, a)
})

test('R5 a session id that is no plain name is refused, so no path leaves the projects folder', t => {
  const p = profile(tempRoot(t), 'lab')
  record(p, { sessionId: '../../etc/passwd' })
  assert.strictEqual(sessions.claudeRecord(PID, [p]), null)
})
