# 0037 New tab... in a select-agent-config snapshot

Status: accepted 2026-10-18.

## Context

`select-agent-config` keeps named snapshots of the agent configuration:
a fresh install, what a new user has, or a fork of the live trees. It
opens a terminal inside one by binding the snapshot's trees over their
canonical paths with `bwrap`, so `claude`, `claude_<account>` and
`codex` work by their usual names and read the snapshot's configuration
instead of the live one. A tab on such a configuration needed that
terminal and lost the skin, the meters and the tabs (the owner,
2026-10-18).

## Decision

- New tab... (decision 0025) gains a **Config** row when
  `select-agent-config` is on PATH: Live configuration, then every
  snapshot the tool lists, named with its lineage and accounts axis.
  The row starts on the active tab's snapshot, else Live. Without the
  tool the dialog is as decision 0025 has it.
- A tab in a snapshot runs its command line through the tool's own
  shell form, `select-agent-config shell ID -- WORDS`: the tool binds
  the snapshot, scrubs every `CLAUDE*` variable and `CODEX_HOME`,
  marks the environment and runs the snapshot's interactive bash with
  the joined words as its command. Each word of the line is quoted
  first, so the line splits back into the same words and nothing
  expands. The shell's launchers and aliases apply, so `claude` is what
  the snapshot's `~/.bashrc` makes of it. The Profile row is disabled,
  since that shell sets the profile, and the command is not resolved on
  PATH before it runs, since a launcher is no file: a missing command
  is the shell's refusal in the tab.
- The wrapper is a spawn-time function of the Session (`wrap`), never
  the tab's command: the tab's `cmd` stays the CLI's words, so the
  adapter dispatch (decision 0021), the carried options (decision 0023),
  Reopen and Duplicate (decision 0026) and the label see the CLI. A
  reopened or duplicated tab keeps its snapshot. The label adds the
  snapshot's name in braces, `claude {empty}`, after a profile's
  brackets. The plain New tab and Ctrl+Shift+T keep decision 0023's
  rule, the window's command in the live configuration, in the live
  folder of the active tab's CLI at the end of its wrapper chain: only
  the dialog inherits the active tab's snapshot.
- Known edge: `claude attach ID` in a snapshot (decision 0030) meters on
  Generic alone when the snapshot shell's launcher runs the CLI on an
  account directory, whose `jobs/` is not among the links into
  `~/.claude` where the attached job is looked up.
- The strip's live command line follows the chain of wrappers, each a
  process of a sandbox, a shell or an interpreter with one child, to the
  command at its end. A hangup goes to the CLI and what it runs, never
  to a wrapper: the snapshot's interactive bash gives the CLI a process
  group of its own, and a shell that dies first takes the CLI down at
  once through `bwrap --die-with-parent`, before the CLI can exit on its
  own terms. The kill after the grace goes to every process of the
  tree.
- The host sees the live tree where the snapshot's processes see the
  snapshot's. Every path an adapter reads that a CLI inside names, the
  user settings layer it chains (decision 0010), the transcript a
  payload names (decision 0009), an attached session's job (decision
  0030), Codex's sessions and its thread index (decision 0013), goes
  through `outside`, the adapter seam's function of a path. In a
  snapshot it maps each component through the binds of the tool's
  `argv ID` line, the last bind over a path winning as bwrap mounts in
  order, and follows a symlink met on the way as the snapshot resolves
  it: the sandbox's account directories link into `~/.claude`, which is
  the snapshot's tree inside and the live one outside. Elsewhere it is
  the identity.
- The live checks run a fake `select-agent-config` in `scripts/fake`,
  so the suite never reads the owner's store: it binds one snapshot's
  `claude` over `~/.claude` with the real `bwrap` and its shell's rc
  sends the fake claude's transcripts into that tree, which witnesses
  the binds and the mapping at once.

## Why

The tool already decides what a snapshot binds, scrubs and exports, and
its shell form takes a command. Reusing it keeps that policy in one
place, and a change there reaches the tabs without a change here.
Running the CLI through the snapshot's shell, rather than the bare
binary, is what the owner's terminal does, so a tab shows what that
terminal would.

## Rejected

- The tool as the tab's command: the plain adapter, no meters, the
  tool's name as the label, and the injected `--settings` after the
  wrong word.
- Rebuilding the bwrap line in the app from the store's layout: a
  second copy of the tool's policy, drifting from the first.
- A profile chosen in the dialog inside a snapshot: the tool scrubs the
  variable, and the snapshot's launchers set their own.
- Reading the snapshot's paths through the host's view of them: the
  transcript channel waits forever and the gauge stays dark, a tab
  that is less than the bare CLI.
