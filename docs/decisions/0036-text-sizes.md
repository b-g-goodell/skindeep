# 0036 Text sizes: every text the app draws follows a setting

Status: accepted 2026-10-15 (issue #146, the owner's words "all font
sizes throughout should be modifiable").

## Context

The terminal's font size was the one size the user could change
(`terminal.fontSize`). Every other text was fixed in a skin's CSS or the
app's: a skin's labels, readouts, task list and limit meters, the
identity strip, the tab strip, the menus, the New tab dialog, the
sessions dashboard, and the visualization window's captions,
drop-downs and Carbon's canvas text. A skin's text sizes run from deck's
7 px Silkscreen labels to its 40 px DSEG7 clock, each placed in a rect
of the skin's art, and the skin scales as a whole below its minimum
size (decision 0006).

## Decision

- Four settings in File, Settings, kept in `settings.json` with the
  panel sizes and read at launch:
  - Terminal font size: 8 to 32 px, or the skin's own, as before.
  - Skin text size: every text a skin draws.
  - Window text size: the identity strip, the tab strip and its
    drop-down, the menus and their flyouts, the New tab dialog and the
    sessions dashboard.
  - Visualization text size: the visualization window's mode captions
    and drop-downs, and the text a mode draws, Carbon's.
  The last three are 70, 80, 90, 110, 125 or 150 percent of the size the
  skin or the app draws, or the default, 100. `app/settings.js` holds
  them, and `settings.scale` gives the factor.
- A skin's text: the skin's stylesheet is served with every px length
  of a font size or a line height, in `font-size`, `line-height` and
  the `font` shorthand, written as `calc(N px * var(--text-scale, 1))`
  (`app/skins/textscale.js`), and `widgets.css` is written so. Nothing
  else changes: widths, offsets, letter spacing and art keep the skin's
  pixels. The page sets `--text-scale` on the skin's stage. A size in
  em or % follows the size it is relative to. A text size in another
  unit or an absolute keyword would escape the setting, so the
  validator refuses it. A skin declares nothing new.
- A text that outgrows its rect: it grows as far as its rect holds it,
  and no further. Each of the stage's children, a panel, a widget or a
  list's toggle, is a holder. Above 100 percent each holder gets the
  largest factor up to the user's at which its texts stay inside its
  rect, or as far outside it as they were at the skin's own size,
  overlap no text of the holder they did not overlap at that size, and
  no text whole in its width at that size is cut by a clip, nor more
  of any text's height, save a list's rows, which the list's rect cuts
  as it always has, so a larger text shows fewer of them, and a text
  that moves, as deck's marquee does. The words a holder's CSS draws, which have no box of
  their own to read, must keep the holder's scroll extent of the skin's
  own size. The fit
  halves the interval from 1 to the user's factor five times, every
  holder at once, one layout a step (`app/renderer/textfit.js`). It
  runs after a layout, a change of size or a change of setting, and for
  a holder whose text changed, within a second of the change. Below 100
  percent a text always fits, and no holder is fitted. Nothing is
  wrapped or moved.
- The window's text: `app.css` writes every font size, and every
  width that holds a text, as a multiple of `--window-text`, set on
  the root from the setting. The identity strip (22 px) and the tab
  strip (24 px) keep their heights, which hold their 12 px text at 150
  percent, so the window's minimum size and decision 0006's floors do
  not change. The drop-down menu, taller than the window leaves it,
  scrolls under its bar, and a flyout is placed in the window beside
  it, so the scrolling drop-down does not clip it.
- The visualization's text: each frame carries the factor (`t`), and
  `app/viz/layout.js` sizes the drop-down's button, rows and columns
  by it, in the page that draws them and in the main process that reads
  their presses. Carbon draws every text through one font of the size
  times the factor, scales the bands its captions take, the diagram's
  margins and the spectrum's labels with it, and lays the pane out
  again when it changes. Its axis labels are written, as its captions
  were, only where they overlap no text before them, and the energy
  axis steps by 2, 5 or 10 eV as its rows need.
- The quarter tile: the skin is drawn at one factor k below its minimum
  size, text and rects alike, so a skin whose text holds at its layout
  holds at the tile. The window's text keeps the window's floors, so
  the tile holds at every size. The floors keep reckoning the
  terminal's 40 x 10 cells in the skin's own font, as before: a
  terminal font larger than the skin's has fewer cells at the floor,
  and the tile still holds.
- Out of reach: the message boxes and file dialogs Electron opens
  natively are drawn by the desktop in its own font.
- `scripts/checks/textsize.js` witnesses it in each shipped skin.

## Why

One scale per surface follows the code: the skin's shadow root, the
window's document and the visualization's page are reached by three
different paths, and each fails its own way. Inside a skin, one factor
keeps the proportions the skinner drew between labels and readouts and
the art around them. A factor, not a size in px, because a skin's sizes
range from 7 to 40 px. Rewriting the stylesheet as it is served keeps a
skin data and every shipped and third-party skin working without an
edit, and the validator closes the one way around it.

The fit answers the issue's question of a text that outgrows its rect:
a widget's rect is the skin's art and the window does not grow, so the
text gives way. The shipped skins are packed at their minimum size, and
a text that grew without bound would run into its neighbours, as
phosphor's readouts do at 150 percent, where a label and a value need
64 px of a 56 px cell. Measured in a holder against its own size, the
fit needs no rule from the skin and never refuses a skin, and a skinner
who leaves room gets the growth. A smaller text needs no fit.

The strips keep their heights so that the window's floors, the quarter
tile and the skins' scale stay as decisions 0006 and 0023 made them,
which bounds the range at 150 percent.

## Rejected

- One setting for all text: a larger window text in a packed skin, or a
  smaller skin text beside a large terminal, could not be chosen.
- A size per kind of skin text (labels, readouts): one more path for
  nothing the fit does not already do, and two factors in one skin
  undo the proportions the skinner drew.
- Font sizes in em or a custom property, written by the skinner and
  enforced by the validator: every skin, shipped or not, would have to
  be rewritten, and a skin is data the app can scale itself.
- Text that wraps: a row grows and collides with the one below.
- Text cut with an ellipsis: a cut number misleads, and clipping
  breaks deck's marquee and the labels a skin places outside its
  widget's box.
- The skin's layout giving way, the skin drawn larger with its text:
  the window does not grow, so below its minimum size the whole-skin
  scale of decision 0006 takes the growth back, and the art blurs.
- Strips that grow with their text: the window's floors would grow,
  and the quarter tile would hold no skin with two tabs.
- The fit run every frame: a readout's value changes ten times a
  second. A value that widens may run past its fit for up to a second.

## 2026-10-18: the visualization's frame rate

Owner, 2026-10-18: a frame-rate cap for every visualization, in the
settings.

- A fifth setting in File, Settings: Visualization frame rate, 15, 20,
  24, 30 or 60 frames a second, or Uncapped, the default, which draws
  at the display's own rate as before. `viz.fps` in `settings.json`,
  null for Uncapped. 60 caps a display faster than 60 Hz, and a rate
  above the display's draws at the display's.
- The visualization window's page draws only the display frames the
  cap lets through (`app/viz/pace.js`): each frame drawn is due one
  gap of 1000 / fps ms after the one before was due, so the frames
  drawn keep to the cap over any run and never exceed it by more than
  one in a second, and a frame up to 2 ms early counts as on time, so
  that the jitter of the display's clock skips none. A loop more than a
  gap behind starts again from now.
- The modes' clocks do not change. Every mode advances by the time
  since the frame drawn before, as it did by the time since the
  display's frame before: the synthesiser's levels and samples, the
  Canvas2D modes' physics and fades, Superscope's steps of 1/60 s and
  Dot plane's of 1/30 s, and butterchurn's clock, which reads the time between
  the frames it renders. The page's bound of 0.1 s a frame, against a
  stall, is above the gap at 15.
- Butterchurn applies a preset's warp once a frame it renders, as
  MilkDrop does, so the presets' steps are scaled to the frame
  (`app/viz/presets.js`). The page sets k = 60 dt before each render,
  dt the time since the frame drawn before, bounded at 0.1 s, so k is
  in frames of 1/60 s. A factor a frame becomes its k-th power: the
  zoom, the stretch sx and sy, and the warp shader's fade by a colour.
  A term a frame becomes k times itself: the rotation, the shift dx
  and dy, the warp's amplitude and the warp shader's fade by
  subtraction. What a frame draws into the feedback, the waveform, the
  custom waves' dots, the borders and the motion vectors, has k times
  its alpha, so as much light a second goes in as fades out, until the
  alpha meets 1, where GL clamps it. A cap, a 144 Hz display and a slow
  host then move at one speed. Terms in `time`, and the warp's
  animation, which butterchurn drives by its clock, need none, and q1,
  which butterchurn resets each frame, smooths nothing to scale.
- Left: butterchurn's darkened centre (Drift's `darken_center`), a
  fan drawn into the feedback each frame at an alpha of its own, which
  no preset term reaches. The decay base values are unused: the
  presets' own warp shaders fade the feedback, and butterchurn applies
  `decay` only in its default one.
- It applies at once: each numeric frame to the window carries the
  cap (`c`), as it carries the text size.
- `test/viz-pace.test.js` replays 60 Hz and 144 Hz displays with and
  without jitter against each cap, and `scripts/checks/vizcaps.js`
  counts the frames the window draws at 15 and uncapped, reads the
  synthesiser's and butterchurn's clocks against the page's, and
  Drift's zoom a second at 15 against uncapped.
  `test/viz-presets.test.js` runs each preset's equations at k of 0.6
  to 6 against k = 1.

Rejected: a cap by a timer instead of the display's frames, which
would draw between them.
