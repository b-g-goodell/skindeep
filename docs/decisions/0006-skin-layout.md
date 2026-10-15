# 0006 Skin layout model and manifest shape

Status: accepted 2026-10-11, rect model revised during the build,
scaling below `minWidth` added 2026-10-13, below `minHeight` 2026-10-15.

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
stretches with the window. Below `minWidth`, or below the minimum skin
area height (`minHeight` less the 22 px identity strip), the skin is
drawn scaled by k, the smaller of width / `minWidth` and area height /
(`minHeight` - 22), laid out at the area's size divided by k: one CSS
transform on the skin's root. One factor for both axes keeps the skin's
proportions, and the layout is never smaller than the minimum the
validator checked. The terminal and the menu button live outside the
skin, so their rects are multiplied by k. The terminal keeps its font
and loses columns and rows. The window's minimum width is the larger of
half of `minWidth` and the width at which the terminal keeps 40 columns
of the skin's font, capped at `minWidth`. Its minimum height is the
identity strip and the larger of half the minimum skin area and the
height at which the terminal keeps 10 rows, capped at `minHeight`, plus
the tab strip while it shows (`app/skins/scale.js`). Every shipped skin
so fits half a 1920 px screen, and a quarter of a 1920 x 1080 one under
GNOME, whose work area is 1048 px tall and whose title bar takes 37 px.
Validation rules beyond the shape: every file
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
- Lowering each skin's `minHeight` to fit a quarter of a screen: the
  same overlap, vertically.
- A separate factor per axis: it stretches the skin's bitmaps and
  round dials out of shape.
- A second, compact layout per skin: four hand-placed layouts to redraw,
  and every new skin owes two.
- Scaling the terminal with the skin: it keeps its columns, but its
  text shrinks below the size the skin and the user chose.
- Terminal colours from CSS: xterm.js renders to canvas and ignores most
  CSS.
