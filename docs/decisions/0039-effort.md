# 0039 The effort level in an effort widget

Status: accepted 2026-11-20 (issue #239).

## Context

Claude Code runs each turn at an effort level: low, medium, high,
xhigh or max, a model offering a subset. Shift+Up raises it and
Shift+Down lowers it (keybindings `chat:increaseEffort` and
`chat:decreaseEffort` of Claude Code 2.1.330). Issue #239 asks for a
widget that shows the level, with a button that acts as those keys.

## Decision

- Two metrics (decision 0011): `effort.level`, 1 for low to 5 for
  max, and `effort.name`, the level's name. They are forgotten with
  the session.
- The statusline is the source: Claude Code 2.1.330 sends
  `effort: { level }` while the model takes an effort level, and
  runs the statusline again when the level changes. Hook payloads
  carry the same `effort: { level }`, so a session whose statusline
  is overridden still shows the level after its next hook. A
  statusline that carries the level claims the family, as it claims
  the context family, and a subagent's hooks, which carry the
  subagent's own level, never write it.
- A widget type, `effort`, bound to `effort.level`: a label, a lower
  and a raise button either side of the level's name, and five pips
  lit up to the level. A click on a button writes Shift+Down
  (`ESC [1;2B`) or Shift+Up (`ESC [1;2A`) to the active tab's
  terminal, as the key typed there would, and the level shown changes
  when Claude Code's next statusline names it. While the session
  reports no level the buttons do nothing, so a plain or Codex tab
  takes no stray key. The mousedown is swallowed, so the terminal
  keeps the keyboard (decision 0033). `buttons` sets the two buttons'
  texts, and the class `across` lays the widget out in one row.
- Every shipped skin carries one, in its own idiom: a row in deck's
  display, a paper tag on coffee's record shelf, a brass plate on
  library's shelf, a row in phosphor's header.

## Why

The key is the CLI's own control, so the widget changes the level by
the CLI's rules: the model's own subset of levels and the bounds at
low and max. The level
shown is the one the CLI reports, never one the app guesses.

## Rejected

- Setting the level by `/effort` or the settings file: the first types
  into the prompt and the second needs a restart, where the keys act
  at once.
- One button that cycles: the issue names both keys, and a cycle
  cannot lower the level without passing max.
