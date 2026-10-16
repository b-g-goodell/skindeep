# 0022 The menus and the last skin used

Status: accepted 2026-10-12, revised 2026-10-12 for
the tab entries and shortcuts of decision 0023 and for the
visualization's modes (decision 0015). Revised 2026-10-14 (maintainer):
several launches share one skin at once. Revised 2026-10-15 (#152,
owner): the one File menu splits into four, File, Agents, Skins and
Visualization.

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
- The drop-down, drawn by the app the same in every skin, with a bar
  of four menus at its top (2026-10-15, below):
  - File: the tab entries of decisions 0023 and 0026, New tab, New
    tab..., Close tab, Reopen closed tab, Duplicate tab, Next tab and
    Previous tab, then Settings, then Housekeeping: this launch's
    problems, Forget remembered skin, Open log folder, and Clear logs,
    which removes the logs of windows that have ended.
  - Agents: the Agent sessions of decision 0027 and Sessions dashboard
    (decision 0028).
  - Skins: Open skin... (a folder picker, folders only), then the
    skins with the current one marked.
  - Visualization: the visualization toggle, flyouts of its modes and
    inputs with the current one marked (decision 0015), and Mute skin
    sounds (decision 0024).

  A problem not yet seen puts a dot on the button. The right-click menu
  is gone.
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
  Alt+F, Alt+B and every other key reach the CLI, and no key opens the
  menus. While the drop-down is open it takes the keyboard: Left and
  Right step through the four menus, wrapping, Escape closes it and
  every other key is dropped, so an Escape meant for the menu never
  interrupts the agent. Closing returns focus to the terminal.
- The last skin used. Each window records its skin at launch and at
  each switch, `--skin` and `SKINNED_SKIN` included, in a file of its
  own, `$XDG_STATE_HOME/claude-skins/last-skins/<pid>`, by write and
  rename, so no two windows write one file. A bare launch opens the
  newest record. When windows recorded different skins within 5 s of
  the newest, a native dialog asks before the window opens: one button
  per skin, the newest first and default. The answer deletes every
  record and the launch records its choice. Records older than 5 s
  before the newest are pruned at each launch.
- Several launches share one skin at once (maintainer): each launch is
  its own process with its own window, runtime dir and record, nothing
  locks a skin, and no launch takes another's skin away. Two launches
  given one skin, and two bare launches beside their records, each
  open on it, with no refusal and no dialog, and a bare launch beside a
  live launch of one skin opens that skin. The windows of one launch
  stay on one skin (decision 0023). `scripts/checks/twoskins.js` shows
  it, with one state home for every launch. Measured 2026-10-14 under
  Xvfb, through the driver and through `bin/skinned`: nothing failed,
  so no code changed.
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

The four menus (2026-10-15, #152). The owner asked for File, Agents,
Skins and Visualization in place of the one menu, and named each
entry's menu.

- How they open: the skin's one button opens the drop-down on File,
  with a bar of the four titles at its top, the shown one lit. A press
  on a title shows its menu in place. The skins keep one button, so no
  manifest, art or validator rule changes, and a skin made for the one
  menu works unchanged. The buttons are 26 to 36 px wide and sit in
  each skin's art, coffee's on the chalkboard beside TONIGHT, deck's in
  its title bar: three more buttons would need new art in every skin
  and room the art does not have, and at the quarter tile (decision
  0006) the skins are drawn at 0.69 to 0.75 of their size, the
  buttons with them. The bar is app text at the app's own size, so it
  reads the same in every skin at every size, as the drop-down always
  has.
- It opens on File, the menu of the tab entries and of Housekeeping,
  whose problems the button's dot points at, so opening it marks them
  seen as before. It does not remember the last menu shown: one press
  always shows the same thing.
- Sessions dashboard goes to Agents: decision 0028 put it under Agent
  sessions, and it shows the same sessions.
- Settings goes to File, between the tab entries and Housekeeping. It
  belongs to the app, not to a skin: the same in every skin, out of a
  skin's reach, and kept across a skin switch. Skins was the other
  candidate, since each setting overrides a skin's value, but it would
  put an app setting among the skins.
- Keys: Left and Right move along the bar while it is open, as in a
  desktop menu bar. No key opens it, so Alt+F stays the CLI's. Every
  entry keeps its shortcut, shown at its right, and the tab shortcuts
  work with the drop-down closed, as before.
- Agent sessions refresh every 2 s only while Agents shows.

## Rejected

- Four buttons in each skin, or a bar drawn in each skin's art
  (2026-10-15): new art and manifest fields in every skin, no room on
  the art, and smaller than the app's text at the quarter tile.
- One drop-down with four flyouts: the agent sessions list is wide and
  refreshes, and a flyout closes as soon as the pointer leaves its row.
- An app-placed button in the identity strip, and a skin without a
  button getting a default one (maintainer).
- A widget type `menu` styled by skin CSS: CSS could hide it, and the
  validator cannot see CSS effects.
- Keeping the right-click menu beside the button (maintainer).
- Recording only the choices made in the menu (maintainer): the last skin
  used is one rule for every launch.
- One shared record file: concurrent windows would race on it.
- Zip files in Open skin... (maintainer): folders only, as `--skin PATH`.
