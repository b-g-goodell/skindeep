# 0034 The agent's task list in a list widget

Status: accepted 2026-10-14 (the maintainer's words of the same
day).

## Context

An agent that puts a checklist or a plan on the terminal leaves it in
the scrollback. The maintainer wants such a list beside the terminal, in
the deck skin's playlist area, where it stays in view while the
session goes on. No metric carried a list, and the transcript parser
read usage alone.

## Decision

- Three metrics (decision 0011): `checklist.items`, a list of
  `{ text, state }` with state `todo`, `doing` or `done`,
  `checklist.count` and `checklist.done`. `checklist.items` is the
  first list-valued metric: the bus takes a list for the names
  `app/metrics/names.js` marks as lists, and a number, a string or
  null for every other. The family is forgotten with the session.
- The Claude transcript is the source, so a monitored session shows
  its list too. The hooks carry tool metadata alone (decision 0009)
  and the statusline nothing of it. In an assistant line on the main
  chain: a `TodoWrite` call replaces the list with its `todos`
  (`content`, `status`); a `TaskCreate` call adds an item, pending,
  under the id its tool result names in `toolUseResult.task.id`, or
  in creation order until it does; a `TaskUpdate` call moves the item
  with its `taskId` to `in_progress` or `completed`, renames it with
  `subject`, or deletes it; a markdown task list, lines `- [ ]` and
  `- [x]`, in a text block replaces the list. Claude Code 2.1.284 on
  this host writes TaskCreate and TaskUpdate, the older tool wrote
  TodoWrite. An item's text is cut at 200 characters. A subagent's
  lines (`isSidechain`) are its own list, not shown.
- A widget type `list`, bound to a list-valued metric, draws one row
  per item: a mark, `[ ]`, `[>]` or `[x]`, and the text, with the
  classes `item`, `todo`, `doing` and `done`, at most `rows` rows. It
  is `nodata`, and hidden, while the list is empty or absent. It
  takes no click.
- While `checklist.items` holds an item, the skin's stage carries the
  class `checklist`, so a skin hides what the list replaces. Deck
  places the list over the playlist and hides the eighteen counters
  under `.skin.checklist`, which return when the list is cleared.
  Coffee chalks the list over the six menu lines of its slate.
  Phosphor and library have no list-shaped region and place none: a
  skinner may place a `list` where one fits.
- The replay fake writes a TodoWrite call at each turn: three items at
  the first turn of a cycle of five, one more done each turn, cleared
  at the fifth.

## Why

The transcript shows every session the app can follow, the window's
and a monitor's, and it carries the list's text, which the hook
relay drops on purpose. A stage class lets a skin decide what the
list replaces with one CSS rule, with no widget reaching another.

## Rejected

- The list from the PreToolUse hook's `tool_input`: the relay keeps
  metadata alone, and a monitored session has no hooks.
- Hiding the counters by painting the list over them: the list would
  need the panel's background, a seam on a textured skin such as
  coffee's slate.
- A per-widget `replaces` option naming the widgets to hide: more
  manifest for the same rule.
