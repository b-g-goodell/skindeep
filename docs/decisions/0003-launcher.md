# 0003 Launcher, commands, exit status, stderr

Status: accepted 2026-10-11, revised 2026-10-12 for portable commands,
for the Session's exit status, for tabs (decision 0023), for `--mute`
(decision 0024), for the one exec route through `exec-clean.py`, and
for Chromium's sandbox (decision 0001).

## Context

A user types `claude-skins` or `codex-skins` where they would type
`claude` or `codex`. Arguments pass through, cwd is the caller's, the app
exits with the CLI's status. Electron and Chromium write warnings to
stderr, which would land in the user's shell.

## Decision

- `bin/skinned [--skin NAME|PATH] [--statusline=always|chain-only]
  [--no-viz] [--mute] [--unsafe-no-sandbox] -- CMD [ARGS]`, a POSIX sh
  script. It resolves the
  repository, keeps the caller's stderr on fd 3 (`exec 3>&2`), sends
  Electron's own stderr to a per-launch log, and runs
  `electron <repo> ...`. Where Chromium's sandbox cannot start it
  refuses with 125 before any window, unless `--unsafe-no-sandbox` or
  `SKINNED_UNSAFE_NO_SANDBOX=1` asks for `--no-sandbox` (decision 0001).
- User-facing errors (bad skin, missing command) go to fd 3.
- Exit status: the child's status, of the tab that ends last when the
  window has several (decision 0023). 128+n when the child dies by
  signal n. 127 when CMD is not found on PATH, checked before any window opens.
  125 when the app itself fails (bad skin at launch, Electron error).
  An internal error ends the child first, by the kill policy of 0016,
  then exits 125. 125 too when the pty cannot be spawned, with
  `cannot start CMD: <reason>` on fd 3.
- 127 or 126 when CMD resolved but its exec fails, as bash gives: 127
  when the file or the interpreter it names is missing, else 126. The
  reason goes to fd 3 as `cannot start CMD: <reason>`, and to the
  problem a tab's end shows when other tabs remain.
- Every CLI is exec'd through `app/exec-clean.py`, so it holds only fds
  0 to 2 and a failed exec ends as above. With no `python3` on the
  tab's PATH nothing spawns: 125, with `cannot start CMD: python3 not
  found on PATH, the app needs it to start a command` on fd 3. node-pty
  can exec the CLI itself, but it ends every failed exec with status 1
  and its own message, and the child keeps Electron's fds.
- 129 when the window is closed, or the app is signalled, before the CLI
  started: the status a hung-up child usually reports, so the caller
  sees the same status for a close before the start as after it.
- The first decided status stands. An app error after the child's exit
  is logged, and the child's status is reported: the CLI's work is done
  and its status is known.
- `bin/claude-skins` execs `skinned -- claude "$@"` and `bin/codex-skins`
  execs `skinned -- codex "$@"`. Every argument goes to the CLI, so no
  option of the app can shadow one of the CLI's. `SKINNED_SKIN` picks
  the skin. A session on another config dir sets `CLAUDE_CONFIG_DIR` or
  `CODEX_HOME`, as it would for the bare CLI, and New tab... sets it per
  tab (decision 0025).
- The working directory is inherited, never changed.

## Why

fd 3 keeps the user's terminal clean of Chromium noise while errors
meant for the user still reach it. The 125/127/128+n convention is
env(1)'s and the shell's, so it cannot collide with a CLI's own status in
the ordinary range.

## Rejected

- A `--label` option: free text in the identity strip could lie
  (decision 0004).
- Printing app errors on stderr: they would vanish into the log.
- Exit 2 for a bad skin: collides with CLI statuses.
- Generated wrappers per profile directory: they assume one machine's
  layout of config dirs, where the environment variable each CLI already
  reads works everywhere.
