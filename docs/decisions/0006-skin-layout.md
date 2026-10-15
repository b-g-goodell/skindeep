# 0006 Skin layout model and manifest shape

Status: accepted 2026-10-11, rect model revised during the build,
scaling below `minWidth` added 2026-10-13.

## Context

Winamp skins are fixed-size bitmaps. A terminal must resize. Skinners
should place widgets without reading code.

## Decision

`skin.json` in the skin directory:

- `name`, `version`, `author`, `description`.
- `window`: `width`, `height` (initial), `minWidth`, `minHeight`.
- `terminal`: `rect` with all four of left, top, right, bottom, so it
  stretches with the window, `theme` (an xterm.js theme object:
  foreground, background, cursor, the 16 ANSI colours), `fontFamily`,
  `fontSize`.
- `fonts`: `[{family, file, weight?, style?}]`, registered by the app.
- `stylesheet`: one CSS file, loaded into the skin's shadow root.
- `panels`: `[{class, rect}]`, empty divs the CSS styles.
- `widgets`: `[{id, type, bind, rect, ...type options}]`.
- `rect` follows CSS absolute positioning: horizontally exactly two of
  `left`, `right`, `width`, vertically exactly two of `top`, `bottom`,
  `height`, in pixels from the skin area's edges. An element with left
  and right stretches, one with right and width keeps its distance from
  the right edge.

The skin area is the window minus the identity strip. The terminal
stretches with the window. Below `minWidth` the skin is drawn scaled by
k = width / `minWidth`, laid out at the area's size divided by k: one
CSS transform on the skin's root. The terminal and the menu button live
outside the skin, so their rects are multiplied by k. The terminal keeps
its font and loses columns. The window's minimum width is the larger of
half of `minWidth` and the width at which the terminal keeps 40 columns
of the skin's font, capped at `minWidth` (`app/skins/scale.js`). Height
is not scaled: `minHeight` stays the window's minimum height. Validation rules beyond the shape: every file
the manifest or the CSS names exists inside the skin, the terminal keeps
at least 40 columns by 10 rows at `minWidth` x `minHeight`, and the
terminal theme's foreground and background differ by a contrast ratio of
at least 4.5.

## Why

Two-of-three offsets per axis is CSS's own model, so skinners already
know it, and it keeps Winamp-style absolute placement while the terminal
grows. It replaced named corner anchors, which could not express a panel
pinned to one edge and stretched along it. The contrast floor and the
minimum terminal stop a skin from hiding the CLI's output.

## Rejected

- CSS grid or flex layouts written by the skin: needs layout knowledge,
  and lets CSS shrink the terminal.
- A fixed-size window: the terminal must resize.
- Lowering each skin's `minWidth` to fit half a screen: every
  skin's fixed widgets span 1100 to 1216 px and overlap below that.
- A second, compact layout per skin: four hand-placed layouts to redraw,
  and every new skin owes two.
- Scaling the terminal with the skin: it keeps its columns, but its
  text shrinks below the size the skin and the user chose.
- Terminal colours from CSS: xterm.js renders to canvas and ignores most
  CSS.
