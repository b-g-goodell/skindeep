# 0034 The agent's task list in a list widget

Status: accepted 2026-10-14 (the maintainer's words of the same
day), the toggle added 2026-10-15 (issue #143).

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
- A list may carry a `toggle`: a button of two options, the list and
  what it replaces, with its own rect, `labels` (two words, default
  `tasks` and `readouts`) and `class`. It shows while the list has an
  item. A click on the second option shows what the list replaces,
  which takes its clicks as before, and a click on the first shows the
  list again. The option shown carries `on`. While the list has an
  item the stage carries `checklist` if the list shows and
  `checklist-off` if what it replaces shows, and the app hides the
  list under `checklist-off`. The validator holds the toggle clear of
  the list and the terminal at the minimum and the initial window.
- The choice is the tab's, kept by main with the tab, so it survives
  a move to another window and a skin change. A list that appears in a
  tab for the first time shows itself. Once a tab shows what its list
  replaces it stays so while the list changes, is cleared and comes
  back, until a click on the list's option. A skin whose list has no
  toggle always shows its list.
- Deck puts the toggle as two tabs, `tasks` and `stats`, on the
  playlist's frame, in the gap between the right plate and the
  playlist, the tab shown joined to the playlist. Coffee chalks
  `tasks` and `menu` on the slate above the menu lines, right of the
  doodles, the word shown underlined.
- The replay fake writes a TodoWrite call at each turn: three items at
  the first turn of a cycle of five, one more done each turn, cleared
  at the fifth.

## Why

The transcript shows every session the app can follow, the window's
and a monitor's, and it carries the list's text, which the hook
relay drops on purpose. A stage class lets a skin decide what the
list replaces with one CSS rule, with no widget reaching another.

The toggle answers the maintainer's words of 2026-10-15: with a list
in the playlist area, a button gets back to the detailed menu. The
readouts open dials (decision 0033), and the list hid them for as
long as it lived. The toggle belongs to the list, so it lives in the
list's manifest entry, and a separate rect keeps it off the list's
rows and the readouts, where the playlist area has no free row: deck's
eighteen rows fill it at the minimum window. Both options show, as
tabs do, so the button names where it leads and where the tab is.
The choice is the user's, so no new list takes it back. The first
list shows itself, as before the toggle, since the owner asked to
see the list beside the terminal. Main keeps the choice with the tab,
as it keeps the tab's name and unseen mark, so the tab carries it
wherever it goes.

## Rejected

- The list from the PreToolUse hook's `tool_input`: the relay keeps
  metadata alone, and a monitored session has no hooks.
- Hiding the counters by painting the list over them: the list would
  need the panel's background, a seam on a textured skin such as
  coffee's slate.
- A per-widget `replaces` option naming the widgets to hide: more
  manifest for the same rule.
- The toggle as a widget type of its own: a second manifest entry
  bound to the same list, which a skin could place without the list.
- The toggle inside the list's rect, over its label row: in deck the
  rect lies over the first readout once the readouts show.
- The choice kept by the window's page: lost when the tab moves to
  another window.
- A list that appears hidden once the readouts were chosen in any tab:
  the owner's list would vanish from a tab where nobody chose.
