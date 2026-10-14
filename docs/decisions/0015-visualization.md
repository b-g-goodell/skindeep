# 0015 Visualization window

Status: accepted 2026-10-11, revised 2026-10-12 for skin sounds
(decision 0024) and for the modes ported from Winamp's visualizations
and picked from the menu (maintainer).

## Context

A separate window, like Winamp's, animates procedurally from the
session's event stream, in at least two modes. Butterchurn is MIT, and
its preset equations compile through `new Function`. The maintainer asked for
a handful of Winamp's visualizations and for the menu to pick them.
Nullsoft opened the AVS source under a BSD license in 2005, and the
MilkDrop 2.25c source in 2013, but that release holds no preset. No
MilkDrop preset pack states a license from the presets' authors:
butterchurn-presets is MIT for its conversion only.

## Decision

- Window: created with `show: false`, then `showInactive()`, so it never
  takes focus from the terminal. Opened at launch unless `--no-viz`,
  toggled from the menu. Title per decision 0004.
- Its own preload exposes one receive-only channel of numeric frames:
  rates, levels, event codes from a fixed enum, and the index of the
  mode to show. No strings from the session, no pty input, no IPC send.
- Signal: a synthesiser in the viz renderer builds 1024-sample waveforms
  each frame: a base tone whose amplitude follows `pty.out_bps`, a
  noise burst per tool call with a pitch per tool class (read, edit,
  shell, web, agent, other), a sweep on prompt submit and on stop, a low
  drone while idle, brightness from `tokens.out_rate`. Every mode draws
  from it.
- Modes: ten, listed once in `app/viz/modes.js`, which the main process
  and the page both load, in the order they cycle and the menu lists
  them:
  - Drift, Rings, Plasma, Star dust and Whirlpool: butterchurn presets
    the project writes, fed by `render({audioLevels})`. Star dust and
    Whirlpool recreate the look of two presets by Ryan Geiss from his
    screenshots named cosmic dust and vortex, with none of their
    equations.
  - Scope: a Canvas2D oscilloscope over spectrum bars, also shown for a
    butterchurn mode without WebGL2.
  - Spectrum analyzer and Fire analyzer: Winamp's main-window analyzer,
    drawn from its look in its normal and fire styles: 19 bars on a
    dotted panel, peak caps that hold and fall.
  - Superscope and Dot plane: AVS's two render effects of those names,
    ported from its BSD source with its license in the file: three
    examples of the Superscope's built-in list over a fade, and the Dot
    Plane in its default colours.
- The mode belongs to the main process. A left click or the space bar
  in the viz window steps it: the main process reads them from the
  window's input events, so the page sends nothing. The menu's
  Visualization mode flyout lists every mode, the current one marked,
  and shows the one picked, opening the window when it is hidden. Each
  change is recorded as the last skin is (decision 0022), one file per
  window under `$XDG_STATE_HOME/claude-skins/last-viz/`, and a launch
  starts in the newest record's mode, else in Drift.
- CSP of the viz window adds `'unsafe-eval'` for butterchurn's preset
  equations. Only the app's own preset files are loaded.
- No AudioContext in the visualization window: no stream on the user's
  audio device. This rule is the visualization's. A skin's own sound
  files may play in the main window (decision 0024), and capturing or
  analysing audio stays forbidden everywhere.

## Why

A numeric, receive-only channel keeps eval away from any session text.
Synthetic levels drive butterchurn without audio hardware. With the mode
in the main process the menu can mark it and the record keep it, and the
page still cannot send. A flyout keeps the drop-down short: ten more
rows would run past the bottom of a window at its minimum height.

## Rejected

- butterchurn-presets, and copying any MilkDrop preset: no license from
  the presets' authors.
- A send from the viz page for each click: the main process sees the
  input itself.
- The modes as a section of the drop-down: too long, see Why.
- A silent AudioContext: opens a device stream.
- A particle mode: not asked for.
