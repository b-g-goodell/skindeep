'use strict'
// A Claude Code session's custom title (decision 0032). Claude Code
// 2.1.296 records a /rename twice: a transcript line
// {"type":"custom-title","customTitle":NAME,"sessionId":ID} and
// <project>/<session id>/custom-title.json holding {"customTitle":NAME},
// beside the transcript. titleOf reads the line, record writes both as
// the CLI does.

const fs = require('fs')
const path = require('path')

const MAX = 120

// The name a custom-title line sets for `session`, else null. A line of
// another session is not this one's.
function titleOf (obj, session) {
  if (!obj || obj.type !== 'custom-title' || typeof obj.customTitle !== 'string') return null
  if (typeof obj.sessionId === 'string' && obj.sessionId !== session) return null
  const t = obj.customTitle.trim().slice(0, MAX)
  return t || null
}

// The CLI's record of a rename: one line appended to the transcript,
// and the json file written whole through a temp file. Claude Code
// holds no fd on the transcript between writes (measured 2026-10-14),
// so one appended line cannot tear one of its own.
function record (transcript, session, name) {
  fs.appendFileSync(transcript, JSON.stringify({ type: 'custom-title', customTitle: name, sessionId: session }) + '\n')
  const dir = path.join(path.dirname(transcript), session)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 'custom-title.json')
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify({ customTitle: name }))
  fs.renameSync(tmp, file)
}

module.exports = { titleOf, record, MAX }
