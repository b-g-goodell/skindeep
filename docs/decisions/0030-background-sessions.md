# 0030 Background sessions, subcommands and the last screen

Status: accepted 2026-10-12, from the maintainer's report of a crash on
`--resume` in a skinned window.

## Context

Claude Code 2.1.296 runs sessions in the background: the left arrow or
`/background` hands a session to its daemon, which starts it again from
the same command line, and `claude --resume` or `claude attach ID` opens
it. Measured 2026-10-12 on the maintainer's report:

- Picked in the `--resume` picker, a session that runs in the background
  opens in place: Claude Code replaces itself with `claude attach ID`.
  It refuses that while its command line carries session settings
  (`--settings`, `--model`, `--permission-mode` and others, its function
  XTe), since the new process would lose them. It prints `"TITLE" is
  running in the background (ID). Run \`claude attach ID\` to open it,
  ...` and exits 0. The app's injected `--settings` is such a setting,
  so the window closed at once and the message went with it: the crash.
- Claude Code takes a subcommand only as its first argument: `claude
  --settings F attach X` ran the prompt "attach". The injected option in
  front turned every subcommand into a prompt.
- A session sent to the background keeps the window's `--settings FILE`
  and outlives the window. The file was in the window's runtime dir and
  went with it, so the daemon could not start the session again
  (`Error: Settings file not found`). Its HTTP hooks then failed on every
  tool call with `hook error: connect ECONNREFUSED`, its own statusline
  was gone with the relay's chain file, and while the window lived its
  hooks reached the window's tab, whose meters then jumped between the
  two sessions.

## Decision

- Subcommands: when the first argument is a Claude Code subcommand (the
  list `claude --help` gives, its aliases, and the hidden daemon,
  design-login, project, remote-control and sandbox), the app injects
  nothing. `claude attach ID` follows the attached session's transcript,
  found by the session id and folder in `<profile>/jobs/ID/state.json`,
  every other field of that file dropped at once. The others run on
  Generic alone.
- Hooks and statusline by ancestry: the injected hooks are command hooks,
  `python3 -I -S app/relay/hook.py ROOT`, and the statusline relay takes
  `ROOT CHAIN`, CHAIN the profile's own statusline command in base64url
  or `-`. Each relay walks its process's ancestors and posts to the first
  one with a link `ROOT/pids/<pid>`, which a tab makes to its own Unix
  socket once its CLI has a pid. A session the window did not start,
  such as one in the background, finds none: the hook prints nothing and
  exits 0, and the statusline relay still runs the profile's statusline.
  ROOT is the runtime root of decision 0016.
- The settings text so names no port, token or tab, and the file is kept:
  `<state>/claude-skins/settings/<hash>.json`, named for the hash of its
  text, written once, never removed. A background session started from a
  closed window starts again from it.
- The last screen: a tab whose CLI exits by itself asks the renderer for
  its last screen (the bottom rows, blank ones at either end dropped),
  after the CLI's last bytes are drawn, at most 1 s. When that exit ends
  the window and the app's stdout is a terminal, the app writes that
  screen there, as the CLI would have left it without the app.
- Opening in place: when the last screen of a Claude tab ends with the
  refusal above and the user's own arguments only resume or continue a
  session (`--resume [ID]`, `-r [ID]`, `--resume=ID`, `--continue`, `-c`),
  the app runs `claude attach ID` in the tab's place, with the tab's
  environment and folder. The user's own session settings make a bare
  CLI refuse as well, so then the refusal stands and the window ends with
  the CLI, leaving the message in the terminal.

## Why

The app is a thin wrapper: a bare CLI opens the session, so the window
does. The background session must behave as it would without the app,
which a hook that fails or a missing file breaks. Ancestry tells the
window's sessions from the daemon's without a token on any command line.

## Rejected

- Settings in the environment (`CLAUDE_CODE_MANAGED_SETTINGS_PATH` or
  plugin dirs): every subprocess and the daemon inherit it, and the
  managed path would hide the real managed settings.
- `--settings` with inline JSON: the identity strip would show the whole
  of it, and the file problem is solved by keeping a file.
- Keeping HTTP hooks: Claude Code reports every failed one in the
  session. A command hook can fail silently.
- Holding the window open after the CLI exits: a terminal returns to its
  shell and keeps the text, which writing the last screen to the
  launching terminal reproduces.
- Opening the session whatever the user's arguments: it would drop
  restrictions such as `--disallowedTools`, which Claude Code refuses to
  drop.
