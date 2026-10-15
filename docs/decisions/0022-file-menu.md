# 0022 The File menu and the last skin used

Status: accepted 2026-10-12, revised 2026-10-12 for
the tab entries and shortcuts of decision 0023 and for the
visualization's modes (decision 0015).

## Context

The only way to switch skins was a right click outside the terminal
(decision 0008), which few people found, and a skin outside `skins/`
could be given only at launch. Every launch opened `deck` unless told
otherwise.

## Decision

- The button. Every skin places it: the manifest's top-level `menu`
  field is required, `{ rect, image, hover?, pressed? }`. The app draws
  it in the page, outside the skin's shadow root, above every panel and
  widget, so skin CSS cannot reach, hide or cover it. A state without
  its own image gets the app's effect: brighter with an outline on
  hover, one pixel down and darker while pressed or open. The validator
  refuses a skin without the field, an image that is missing, and a
  rect smaller than 16 x 16, outside the skin area or over the terminal,
  each at the minimum and the initial window size.
- The drop-down, drawn by the app the same in every skin: the tab
  entries of decision 0023, Open skin...
  (a folder picker, folders only), the skins with the current one
  marked, the visualization toggle, a flyout of the visualization's
  modes with the current one marked, Settings, and Housekeeping: this
  launch's
  problems, Forget remembered skin, Open log folder, and Clear logs,
  which removes the logs of windows that have ended. A problem not yet
  seen puts a dot on the button. The right-click menu is gone.
- Settings: one list in `app/settings.js`, the same in every skin.
  A skin cannot add, remove or rename a setting. Each overrides one
  manifest value, offers the skin's own value first as Skin default,
  applies at once to every tab, survives a skin switch, and is kept in
  `$XDG_STATE_HOME/claude-skins/settings.json`. The first and only one
  is the terminal font size, 8 to 32 px. It sizes the terminal alone:
  the menu, the chooser and the dashboard keep their own sizes. Another
  launch reads the file at its start, so two windows open at once each
  keep their own until relaunched. The window's minimum width stays
  that of the skin's own font (decision 0006).
- Keys. No native menu bar and no accelerators. The app takes only the
  copy and paste keys of decision 0002 and the tab shortcuts of decision
  0023, none of which sends the CLI a byte it would otherwise get, so
  Alt+F, Alt+B and every other key reach the CLI. While the drop-down is open it takes
  the keyboard: Escape closes it and every other key is dropped, so an
  Escape meant for the menu never interrupts the agent. Closing returns
  focus to the terminal.
- The last skin used. Each window records its skin at launch and at
  each switch, `--skin` and `SKINNED_SKIN` included, in a file of its
  own, `$XDG_STATE_HOME/claude-skins/last-skins/<pid>`, by write and
  rename, so no two windows write one file. A bare launch opens the
  newest record. When windows recorded different skins within 5 s of
  the newest, a native dialog asks before the window opens: one button
  per skin, the newest first and default. The answer deletes every
  record and the launch records its choice. Records older than 5 s
  before the newest are pruned at each launch.
- A remembered skin that no longer loads gives way to the default skin.
  The fallback is not recorded, so a skin fixed on disk comes back on
  the next launch. The problem shows under Housekeeping. A given skin
  that fails still exits 125 (decision 0008).

## Why

A visible button is the fix for an undiscoverable menu, and a skin that
places it can make it look native without being able to lose it. The
record per window removes the write race between windows, and the
dialog settles the remaining one, two windows choosing at once, by
asking instead of guessing.

## Rejected

- An app-placed button in the identity strip, and a skin without a
  button getting a default one (maintainer).
- A widget type `menu` styled by skin CSS: CSS could hide it, and the
  validator cannot see CSS effects.
- Keeping the right-click menu beside the button (maintainer).
- Recording only the choices made in the menu (maintainer): the last skin
  used is one rule for every launch.
- One shared record file: concurrent windows would race on it.
- Zip files in Open skin... (maintainer): folders only, as `--skin PATH`.
