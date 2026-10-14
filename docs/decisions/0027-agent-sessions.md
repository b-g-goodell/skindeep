# 0027 Agent sessions and the read-only monitor tab

Status: accepted 2026-10-12, the first slice of the agent manager, with
the maintainer's ruling of one window: the sessions of different agents
are tabs of it, never separate windows (decision 0023). Revised the
same day by the maintainer's ruling to read three fields of Claude
Code's per-pid record.

## Context

claude-skins showed only the sessions it started. A user runs several
agents at once, some in other terminals, and wants one place that lists
them all and shows any of them on the meters.

## Decision

- The File menu has a section **Agent sessions**: every live Claude
  Code and Codex session of this user on the machine, this window's
  tabs first, each with its label, folder, state and running time, and
  `tab` or `monitor` when this window shows it. The list refreshes every
  2 s while the menu is open, so sessions that start appear and
  sessions that end leave. A session is started from here by New tab...
  (decision 0025), in the window's skin.
- Discovery reads `/proc` alone: every process of this user named
  `claude` or `codex`, or a `node` running a script of that name as an
  npm install does, but Codex's `app-server` and `mcp-server` daemons,
  with its folder, its start time and its command line. A process whose
  parent is a session of its own agent, such as the native `codex` an npm
  `codex` runs, is that session. A session inside a tab's own session,
  such as a `claude -p` its agent runs, is left out. A process's
  environment is never read: it can hold a key.
- A session's channel is found among the known profiles: the default,
  the window's, the open tabs' and those New tab... recorded. Codex's
  rollout is found by the routes of decision 0013, with the session's
  start as the launch, and its profile is the one known home whose
  `sessions` folder holds the rollout.
- Claude Code 2.1.296 keeps `<profile>/sessions/<pid>.json` while a
  session runs, naming its current session id, a `/clear`'s included
  (measured 2026-10-12). Of it the app keeps `pid`, `sessionId` and
  `procStart`, drops every other field at once (among them a socket
  path and `bridgeSessionId`), and never opens the `.key` file beside it
  (maintainer, 2026-10-12). The record counts only when its pid is the
  session's, its `procStart` equals the start in `/proc/<pid>/stat`,
  and its id is a plain name. The transcript is then
  `<profile>/projects/<folder>/<id>.jsonl`, followed once Claude Code
  writes it, and the profile is the one whose `sessions` folder holds
  the record, or, among profiles that share that folder, the one that
  holds `session-env/<id>/`.
- With no record, as of a Claude Code that writes none, Claude's
  transcript is the newest `.jsonl` written since the session started
  in `<profile>/projects/<its folder, each character but a letter or a
  digit a dash>/`, and its profile is the one known profile that holds
  `session-env/<the session id>/`, a folder Claude Code 2.1.296 makes in
  the profile itself even when its `projects` folder is linked from
  another (measured 2026-10-12), tested by name alone. Two sessions of
  one profile in one folder may then show each other's transcript, as
  Codex's inexact routes may.
- With no such evidence, a profile never chosen here or a channel not
  found, the label says `[?]`: `claude [?]`, never the default's name.
- State, from when the channel was last written: working within 10 s,
  waiting within 10 min, else idle, unknown with no channel. A tab of the
  window gives its own: working while `state.busy` is 1.
- Choosing a session in a tab makes the tab active. Choosing any other
  opens a **monitor tab**: a read-only tab with no pty and no child of
  the app's (`app/monitor.js`). Its meters come from the session's own
  side channels, Claude's transcript as when nothing is injected
  (decision 0009), followed again every 5 s so a `/clear` is followed,
  or Codex's rollout, beside Generic on the session's pid (decision
  0014). Its pane says what it watches, and its strip names the session's
  command line and folder with `read-only monitor`. Keys typed into it go
  nowhere.
- A monitor tab never types into the session and never signals it: its
  pid is null, so the kill policy of decision 0016 has no target, and
  closing the tab ends the monitor, not the session. It closes when the
  session ends (the pid gone, or reused by a process started later).
  Reopen closed tab does not record it, and Duplicate tab is disabled
  on it.
- Exit status (decision 0003): a monitor tab has no status of its own.
  The app exits with the status of the last tab with a CLI to end, so a
  window whose CLI tab ended before its monitor tab exits with that CLI's
  status.

## Why

`/proc` names every session, of any terminal, and reading a process's
name, folder, start and command line is what `ps` shows. The side
channels are those the app already reads for its own sessions, so a
monitor shows nothing the app could not show of a session it started.
A monitor with no pid cannot reach the session by any path the app's
children are ended by.

## Rejected

- A manager window beside the skinned windows (maintainer): one window, tabs.
- A skin chosen per session: the skin is the window's (decision 0023).
- Reading `/proc/<pid>/environ` for the profile: exact, but it reads a
  buffer that can hold an API key.
- Reading Claude Code's per-pid session record whole: three fields
  serve, and the rest is no business of the app's.
- The directory a session holds open for its tasks: it names the
  session's id at start, which a `/clear` leaves stale (measured
  2026-10-12).
- Attaching to sessions run under tmux, and resuming a session that
  runs elsewhere: the first needs a dependency, the second gives one
  session two writers.
- Graphs over time per session, across sessions, and of the project's
  issue board in this slice: they are decisions 0028 and 0029.
