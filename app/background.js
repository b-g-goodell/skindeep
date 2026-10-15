'use strict'
// Claude Code background sessions seen from a tab (decision 0030).
// Picked in the --resume picker, a session that runs in the background
// opens in place: Claude Code replaces itself with `claude attach ID`.
// It refuses that while its command line carries session settings, and
// the app's injected --settings is such a setting, so it prints how to
// open the session and exits. When the user's own arguments carried
// none, a bare CLI would have opened it, and the app runs `claude
// attach ID` in the tab's place. When they carried some, the refusal is
// the CLI's own and stands.

// The tail of the screen the refusal is looked for in, in non-blank
// rows: the CLI prints it last.
const TAIL_ROWS = 8

// Claude Code 2.1.296, function Sfe: `"TITLE" is running in the
// background (ID). Run \`claude attach ID\` to open it, or ...`. ID is
// the 8 hex digits of a job.
const REFUSAL = /is running in the background \(([0-9a-f]{8})\)\..{0,400}?Run `claude attach \1` to open it/

// The job id of the refusal at the end of screen, or null.
function refusal (screen) {
  if (typeof screen !== 'string') return null
  const rows = screen.split('\n').filter(r => r.trim())
  const text = rows.slice(-TAIL_ROWS).join(' ').replace(/\s+/g, ' ')
  const m = text.match(REFUSAL)
  return m ? m[1] : null
}

// True when args, the user's arguments, only resume or continue a
// session: then nothing of the user's makes Claude Code refuse.
function bareResume (args) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--continue' || a === '-c' || a.startsWith('--resume=')) continue
    if (a === '--resume' || a === '-r') {
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) i++
      continue
    }
    return false
  }
  return true
}

// The command that opens the session tab's Claude refused to open, or
// null. cmd: the tab's command. screen: its final screen.
function attachFor (cmd, screen) {
  if (!bareResume(cmd.slice(1))) return null
  const id = refusal(screen)
  return id ? [cmd[0], 'attach', id] : null
}

module.exports = { refusal, bareResume, attachFor }
