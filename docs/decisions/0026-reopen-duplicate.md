# 0026 Reopen closed tab and Duplicate tab

Status: accepted 2026-10-12, revised the same day for a
Codex fork's referenced history, measured on Codex 0.162.1.

## Context

A browser reopens a closed tab and duplicates a tab. Both CLIs can do
the same for a session: `claude --resume <id>` and `codex resume <id>`
continue a session, `claude --resume <id> --fork-session` and
`codex fork <id>` copy it into a new one.

## Decision

- File menu entry **Reopen closed tab** reopens the window's most
  recently closed tab, a tab the user closed or one whose CLI exited, in
  its agent, profile and folder, resuming its session. Choosing it again
  reopens the tab closed before that one, newest first. The entry is
  disabled while no tab has closed.
- File menu entry **Duplicate tab** opens a tab beside the active one
  that forks its session. The original keeps running.
- The session id is the one the tab's agent adapter follows (decision
  0021): Claude's session id from its hooks and statusline, Codex's
  thread from its rollout. The command keeps the options New tab carries
  (decision 0023) and drops those of one session:
  `claude <carried> --resume <id>`, with `--fork-session` to duplicate,
  and `codex resume <carried> <id>` or `codex fork <carried> <id>`, since
  both subcommands take those options.
- A tab with no session id, a plain command or a Codex session before
  its first prompt (decision 0013), is reopened or duplicated as a new
  session of the same command, by the rule of New tab, in its profile and
  folder. The entry says so: `Reopen closed tab (new session)`,
  `Duplicate tab (new session)`.
- The folder is the one the tab started in, not its live folder: Claude
  Code finds a session to resume among the sessions of its project
  folder.
- Never two writers on one session. A closed tab's entry is made only
  once its CLI has been reaped. Duplicate forks, so the original keeps its
  session alone. A closed session that another tab of the window now
  runs is not resumed again: that tab is made active instead.
- Closed tabs are kept in memory, per window, while the app runs. Each CLI's own picker lists every past session.
- A launch does not restore the tabs of an earlier window:
  a launch is one new session, as typing `claude` is.
- No shortcut: Ctrl+Shift+T is New tab (decision 0023).
- The meters of a reopened or duplicated tab start from the session's
  transcript or rollout, read as history (decisions 0009, 0013). A Codex
  `fork` makes a new thread, so discovery takes its argv id for the
  source, never ours, and finds the fork by the route of a new session,
  `forked` in the following report (decision 0013). Codex 0.162.1 copies
  none of the source's history into a fork: the fork's first line names
  it in `history_base`, the source thread and the byte its history ends
  at (measured 2026-10-12, a real `codex fork` with no prompt). The
  adapter reads that much of the source's rollout as history before the
  fork's own lines, the source's source first when it is a fork too, so
  a duplicated Codex tab starts with the meters the original had.

## Why

The session id each adapter already follows is what both CLIs resume
by. Taking the entry only after the reap makes the two-writer rule hold
by construction, not by timing.

## Rejected

- Disabling the entries for a tab with no session id: a plain command
  could never be reopened.
- Recording closed tabs under `$XDG_STATE_HOME`: the CLIs' own pickers
  already keep every session.
- The live folder: a Claude session moved away from its project folder
  would not resume.
