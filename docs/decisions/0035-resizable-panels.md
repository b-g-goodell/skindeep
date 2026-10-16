# 0035 Resizable panels: a dragged boundary between the terminal and a panel

Status: accepted 2026-10-15 (issue #145, the owner's words "resizable
panels").

## Context

A skin places the terminal and every panel and widget by rects anchored
to the window's edges (decision 0006). The terminal takes every pixel
the window gains, and the panels beside it keep their size. The owner
asked for panels the user resizes by dragging, so the terminal and the
panels take the share of the window the user wants. Every shipped skin
is packed at its minimum size: its instruments fill the panels there,
and deck's eighteen counters fill its playlist.

## Decision

- A skin declares its draggable boundaries in `splits`: `[{ id, edge,
  min, max }]`. A split is one edge of the terminal, at most one on
  each. Its size is the terminal rect's offset on that edge, the
  manifest's value by default, and the default lies from `min` to
  `max`.
- A panel, a widget or a list's toggle may carry `follow`: `{ rectKey:
  splitId }`. That key of its rect takes the split's change from its
  default. The key is the split's own edge, which moves the element
  with the boundary or, on a frame that stretches around the terminal,
  moves its edge, or the `width` or `height` of a rect anchored at that
  edge, which grows or shrinks the element toward the terminal. The
  validator refuses any other key, so a follow never runs against the
  boundary.
- Room: a split grows past its default only as far as the skin area,
  on the split's axis, is no smaller than at the skin's initial window
  size. Below that size the growth gives way pixel for pixel, down to
  none. A split shrinks to its `min` at any size. So the validator
  checks two layouts: the splits at their `min` at the minimum window,
  and at their `max` at the initial window. In each the terminal keeps
  40 x 10 cells, an element that follows keeps a size, and no two
  boxes that are apart with the splits at their defaults meet, the
  terminal's among them. A layout that holds there holds at every
  window size, since a smaller window takes back the growth by as much
  as it shrinks. `app/renderer/splits.js` holds the rule, loaded by the
  validator and the page.
- The window's minimum size stays the one the default rects give
  (decision 0006), so a drag never grows the window or holds it large,
  and the quarter tile holds.
- Art: a panel's box grows or shrinks, and its CSS paints it as it does
  at any window size: tiled textures, covers and gradients fill it. Of
  the widgets, a bar, a limits widget, a list, a readout and a led
  stretch. A gauge, a needle and a knob keep their shape inside a
  stretched box, so they stay centred and grow only as far as the
  box's other side allows. A sprite keeps its frame's size. A skin
  makes what stretches follow a size key and moves what does not with
  an edge key.
- The handle: an 8 px strip just outside the terminal's edge, along its
  whole length, drawn by the app above the skin and the same width at
  any scale. It shows a grip at its middle, lights under the pointer
  and shows the resize cursor. A drag moves the split by the pointer's
  travel in the skin's own pixels, within its range at that window
  size, and the terminal reflows as it moves. A handle whose split the
  window leaves no room to move is hidden.
- The sizes are kept on release in `settings.json`, under `panels`, by
  the skin's name and the split's id, beside the terminal font size,
  and read at launch. Every window of the skin follows. A skin opened
  by path under a shipped skin's name shares that skin's sizes. A kept
  size the window cannot hold is drawn smaller and kept.
- Settings in the menu holds Reset panel sizes: every split of the
  current skin back to its own size, forgotten for that skin.
- The shipped skins:
  - deck: `playlist`, right, 236 to 600 px, the counters' rows and the
    task list stretch with the playlist and the toggle moves with its
    edge. `meters`, top, 174 to 254 px: the LCD windows and plates grow
    down, the analyzer's columns and the limit bars grow taller, the
    dials stay centred, and the playlist moves down.
  - phosphor: `systems`, bottom, 168 to 288 px: the needles grow into
    the taller band and the upper row of readouts rises with it.
  - coffee: `slate`, top, 172 to 252 px: the chalkboard grows down and
    shows more of the task list, and the cabinet's turntable and amp
    move down, the records' shelf giving the room.
  - library: `desk`, bottom, 192 to 292 px: the whiteboard grows up,
    its limit bars taller and the cache bar rising with its top, while
    the card catalog stays.
- A list's rows keep their height, so a list taller than its items
  shows more of them and the rect cuts the rest, as `docs/SKINS.md`
  says. Coffee's list drops its `rows` cap of three for that.
- The visualization window's panes keep the even split of decision
  0015.

## Why

A split on the terminal's edge is the boundary the owner drags: the
terminal is on one side of every boundary in every skin, and its rect
already names the four edges. One key per element and one rule, the
key takes the split's change, cover both a moving and a stretching
element, and keep the two-of-three rect model of decision 0006 as it
is. The room rule makes the validator's two layouts enough: the
shipped skins' art is packed at the minimum window, so growth there
would run into it, while at the initial window the skins have room to
give. Keeping the window's floor from the default rects keeps every
size a window could take before. The handle belongs to the app, as
the menu button does, so a skin cannot hide it and it keeps its width
when the skin is drawn scaled. The settings file already keeps what
the user picks across launches, and the menu already holds Settings.

The skins' boundaries are those whose panels hold something that uses
the room: rows, a list, bars, a band of instruments with space to
grow. Their minimum is the drawn size wherever the instruments fill
the panel, which is every panel but deck's playlist, whose rows narrow
as far as their labels allow.

## Rejected

- Scaling a panel's instruments with its boundary: drawn larger the
  bitmaps blur, and the packed skins have no room for them at the
  minimum window. Drawn smaller they gain the terminal a row or two.
  The whole-skin scale of decision 0006 already shrinks every
  instrument at once.
- A fraction of the change per key, to keep an element centred: the
  dials centre themselves inside a stretched box, and no shipped skin
  needs it.
- Growth bounded by the terminal's 40 x 10 alone: the moved art of
  deck's playlist rows, phosphor's readouts, coffee's cabinet and
  library's cache bar runs into the packed layout at the minimum
  window.
- The window's minimum from the dragged sizes: a drag at the minimum
  would grow the window, and a quarter tile could hold no skin with a
  grown panel.
- Splits between two panels, or on the window's edges: the owner's
  boundary is the terminal's, and each panel beside it is reached from
  the terminal's edge.
- The handle inside the skin's shadow root: scaled with the skin, it is
  3 px wide at a quarter tile, and the skin's CSS could hide it.
- Draggable boundaries between the visualization window's panes: the
  grid is chosen from the tab count each time a tab opens or closes, so
  a dragged size would need a memory per count and per tab, a feature
  of its own. Each pane is a picture without a meter to give room to.
