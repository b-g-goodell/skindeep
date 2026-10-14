# 0025 New tab... with another agent, profile or folder

Status: accepted 2026-10-12.

## Context

New tab (decision 0023) runs the window's command, so every tab of a
window shared one agent and one config dir. A Claude Code tab on one
profile beside a Codex tab on another needed a second launch. Decision
0003 rejected wrappers per profile, since they assume one machine's
layout of config dirs.

## Decision

- File menu entry **New tab...** opens an app-owned dialog above the
  skin and the tab strip, under the identity strip, out of reach of skin
  CSS (decision 0005): the agent (Claude Code or Codex), its profile, the
  folder, and the command line the tab will run. The plain New tab, its
  shortcut and `+` stay as decision 0023 has them. Enter opens, Escape
  cancels. While the dialog is open the terminal has no focus, the tab
  chords do nothing and a dropped file is not pasted.
- A profile is a config dir. The tab runs with `CLAUDE_CONFIG_DIR` or
  `CODEX_HOME` set to it, as a user would for the bare CLI (decision
  0003). The default profile, `~/.claude` or `~/.codex`, runs with the
  variable unset, even when the window's own environment sets it. The
  dialog shows the variable as the tab will have it. The rest of the
  window's environment is the tab's.
- The profile list of an agent: its default profile, the profiles of the
  open tabs of that agent in tab order, then every profile a tab was
  opened on, newest first, each once. The default is always listed, so
  the bare CLI, and its login, is one choice away. **Other profile...**
  opens a folder picker that shows hidden folders. A recorded profile
  can be forgotten. The dialog starts on the active tab's agent and
  profile, else Claude Code on its default.
- Each profile a tab was opened on, the default excepted, is recorded in
  a file of its own, `$XDG_STATE_HOME/claude-skins/profiles/<agent>-<hash>`,
  by write and rename, as the last skins are (decision 0022), so no two
  windows write one file. Nothing inside a profile is read for the list:
  its path, and whether the default one exists.
- The folder starts as the active tab's live folder (decision 0023).
  `~` and a relative path are taken as typed in a shell: the home
  directory, the active tab's folder. A folder picker sits beside it.
- The command line is shown and editable. For the
  window's own agent it starts as the window's command with the options
  New tab carries (decision 0023), and the dialog names what it does not
  carry. For the other agent it starts as the bare CLI. The line is split
  into words as a shell splits them, by `app/argv.js`, and no shell runs:
  quotes and backslashes work, `~`, `$VAR`, globs and redirection do not.
  A wrapper on PATH (`claude_work`) gets its CLI's adapter (decision
  0021). The command resolves on the tab's PATH, a relative path against
  the tab's folder. A command that is not found, a folder or a profile
  that does not exist, and a malformed line are refused in the dialog,
  which stays open.
- Each tab has its own environment, so its label names its own profile
  (decision 0004), its statusline relay chains to its own profile's
  statusline (decisions 0010, 0020), and a Codex tab follows rollouts
  under its own `CODEX_HOME` (decision 0013).

## Why

The variable each CLI already reads is the portable profile, as decision
0003 found. A list made of what this user chose needs no scan and
assumes no layout. Showing the command line, editable, makes what runs
visible before it runs and serves wrappers and one-off options, which
`skinned -- CMD ARGS` already allows, so it widens nothing.

## Rejected

- A scan of the home directory for config dirs:
  it searches the whole home and reads a layout the user never declared.
- A file of profiles the user edits: a second place to keep in step.
- Agent and profile only, no command line: a wrapper or a one-off option
  would need a new launch.
- A shell running the line: the dialog would run more than it shows.
- Recording the default profile: it is always listed.
