# 0016 Runtime files and lifecycle

Status: accepted 2026-10-11, revised 2026-10-12 for the Session, again
2026-10-12 for tabs (decision 0023), and for the hook links, the kept
settings and the last screen (decision 0030), and 2026-10-13 for the launch's
pages.

## Context

The app writes a generated settings file, runs a local hook server, keeps
Electron's user data and a log. Several instances may run at once.
Closing the window must end the session the way closing a terminal does.

## Decision

- Runtime dir: `$XDG_RUNTIME_DIR/claude-skins/<pid>/` (else
  `$TMPDIR/claude-skins-<uid>/<pid>/`), mode 0700, holding Electron's
  userData and one dir per tab, `tab-<id>/`, mode 0700, for that tab's
  hook socket. A tab's dir is removed when the tab ends, the runtime dir
  on exit. At start, dirs whose pid is dead are removed.
- The launch's pages: at start every file of `app/renderer` and
  `app/viz`, and each `node_modules` file their pages name, about 1.1 MB,
  is read into memory and served as `shell://launch/<path>`. The two
  preloads are copied into the runtime dir's `preload/`. A window opened
  later, such as a visualization window closed and shown again, runs the
  build its main process started with, even after a pull or
  `./install.sh` changed the checkout. Before, it loaded the new page
  against the old main process, which drew nothing.
- The runtime root's `pids/`, mode 0700: one link per tab's CLI, named
  for its pid, to that tab's socket (decision 0030). The tab's end
  removes it, and at start a link whose socket is gone is removed.
- The generated Claude settings live in
  `${XDG_STATE_HOME:-~/.local/state}/claude-skins/settings/`, kept: a
  session sent to the background outlives the window and starts again
  from them (decision 0030).
- Log: `${XDG_STATE_HOME:-~/.local/state}/claude-skins/<stamp>-<pid>.log`,
  Electron's stderr. The newest 10 are kept.
- One kill policy, `app/session.js`, for a close of a tab or of the main
  window, SIGINT, SIGTERM or SIGHUP to the app, and an internal error:
  SIGHUP to each child's process group (the recorded pid, a session
  leader after node-pty's setsid), wait up to 2 s, then SIGKILL of that
  group. The app exits once the last child is reaped, with the status
  of decision 0023.
- Child exit: the tab closes, after its last screen is read when the
  child exited by itself (at most 1 s). The last tab's child exit ends
  the app, its last screen written to the app's stdout when that is a
  terminal. A Claude tab whose CLI refused to open a background session
  in place is followed by `claude attach ID` in its place (decision
  0030).
- The app never exits while any tab's child lives.
- The Session closes its tab's agent adapter (decision 0021) at every
  end, so no hook server, tail or timer outlives the session.
- A close before the CLI started ends the app without starting it, even
  when an adapter's preparation settles later.
- The viz window closes alone, and the menu reopens it.
- userData per instance, so concurrent instances never share a profile
  lock or cache.

## Why

SIGHUP to the group is what a terminal emulator does, and it reaches the
CLI's own children (MCP servers, shells). Electron cannot exit while a
node-pty child lives (measured 2026-10-12): an internal error that
exited at once left the app running without a window, and the launcher
blocked, until a child that ignored SIGHUP ended. Per-instance runtime dirs keep
instances apart and leave nothing behind.

## Rejected

- `/tmp`: shared by every user of the machine, where the runtime dir is
  private to the user and emptied at logout. `$TMPDIR` or `/tmp` is the
  fallback only without `XDG_RUNTIME_DIR`.
- One shared userData: two instances would contend for its lock.
