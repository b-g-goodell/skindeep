# 0015 Visualization window

Status: accepted 2026-10-11, revised 2026-10-12 for skin sounds
(decision 0024) and for the modes ported from Winamp's visualizations
and picked from the menu (maintainer), and 2026-10-13 for one pane per tab
(maintainer: "distinct visualizations for each open tab ... all within a
single visualizer window"), for the sound output as an input (maintainer:
"allow the app to record what's going through the sound output"), and
for five procedural modes (maintainer: "invent new procedural visuals.
One based on fractals and the Barnsley fern, one on the board game Go,
one that zooms out progressively and reveals surprises, one on
gravitational dynamics, and one on quantum mechanics").

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
- One window, one pane per tab with a session, in strip order: CLI tabs
  and monitor tabs (decision 0027), not the sessions dashboard (decision
  0028). The panes tile the window in equal cells, the column count the
  one that gives a pane the longest shorter side, by `app/viz/layout.js`,
  which the main process and the page both load. Each pane shows its
  tab's place in the strip and its mode. With more than one pane the
  active tab's is outlined.
- Its own preload exposes one receive-only channel of numeric frames,
  one entry per pane: the tab's id and place, whether it is active, the
  index of the mode to show, and its rates, levels and event codes from
  a fixed enum. No strings from the session, no pty input, no IPC send.
  Every tab's events are drained each frame, so none piles up for a tab
  out of view or while the window is closed.
- Signal: a synthesiser per pane in the viz renderer builds 1024-sample
  waveforms each frame from its tab's frame: a base tone whose amplitude follows `pty.out_bps`, a
  noise burst per tool call with a pitch per tool class (read, edit,
  shell, web, agent, other), a sweep on prompt submit and on stop, a low
  drone while idle, brightness from `tokens.out_rate`. Every mode draws
  from it.
- Modes: fifteen, listed once in `app/viz/modes.js`, which the main process
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
  - Fern, Go, Zoom out, Gravity and Quantum: the project's procedural
    modes, one file each, no image or video. Each reacts to its pane's
    events, a prompt, a tool call in its class's colour, a stop, a
    subagent, and calms at idle. Fern: the chaos game of an iterated
    function system, Barnsley's fern and three relatives, a prompt
    morphing to the next. Go: a 13 by 13 board, a stone per event,
    played by the rules (liberties, capture, no suicide, ko) and cleared
    when full. Zoom out: six scenes, each the detail of the next, the
    sixth the first's detail, so the camera loops. Gravity: Newtonian
    bodies by leapfrog, merging on contact, events adding bodies or
    mass, the rates setting the clock. Quantum: the Schroedinger
    equation by split-step Fourier on a 128 by 64 grid, packets through
    slits onto a screen that records detections, a stop measuring and
    collapsing the state. With the sound output alone, which brings no
    events, a rise of its loudness counts as one.
- Each pane's mode belongs to the main process. A left click steps the
  pane under it: the main process reads the click from the window's
  input events and finds the pane with `layout.js` over the window's
  content size, both in DIP, so the page sends nothing. The space bar
  steps the active tab's pane. The menu's Visualization mode flyout
  lists every mode, the active tab's marked, and shows the one picked in
  the active tab's pane, opening the window when it is hidden. Each pick
  is recorded as the last skin is (decision 0022), one file per window
  under `$XDG_STATE_HOME/claude-skins/last-viz/`. A new pane starts in
  the first mode no other pane shows, counting from the last pick, and a
  launch's first pane in the newest record's mode, else in Drift. The
  modes are not kept per tab across launches.
- A butterchurn pane holds a WebGL2 context, made the first time the
  pane shows a butterchurn mode and released with the pane. Chromium
  drops a page's oldest context past about 16, so at most 8 panes hold
  one, and a ninth pane in a butterchurn mode shows the scope and says
  so.
- CSP of the viz window adds `'unsafe-eval'` for butterchurn's preset
  equations, and `img-src data:` for the two textures butterchurn builds
  in as data URLs, clouds2 and an empty one. No shipped preset
  names either, but butterchurn hands clouds2 to any sampler it does not
  know. Only the app's own preset files are loaded.
- Input, from the menu's Visualization input flyout: Session (the
  synthesiser alone, the default), Sound output (what the machine plays,
  every pane alike, the session ignored) or Session and sound output
  (added). The pick is recorded as the mode is, under
  `$XDG_STATE_HOME/claude-skins/last-viz-input/`, and a launch starts on
  the newest record's input.
- The sound output is the default sink's monitor, recorded by the main
  process with `parec -d @DEFAULT_MONITOR@`, which PulseAudio and
  PipeWire's pulse server both answer, else `pw-record` with
  `stream.capture.sink`, mono 16-bit at 44.1 kHz. The recorder runs only
  while the window is open on an input that takes the sound output, and
  the app ends it, the pid it started, when either stops. Its newest
  1024 samples are kept in memory and sent as numbers in the frame. No
  microphone, nothing written to disk, nothing sent anywhere but the viz
  page. With no recorder, or none that starts, each caption says so and
  the log names each one's reason.
- No AudioContext in the visualization window: no stream on the user's
  audio device from the page. A skin's own sound files may play in the
  main window (decision 0024), and the sound output input records them
  too.

## Why

A numeric, receive-only channel keeps eval away from any session text.
The tab's place, not its label, names a pane, so the channel stays
numeric. One window keeps decision 0023's one window per app.
Synthetic levels drive butterchurn without audio hardware. Recording in
the main process keeps the page receive-only and numeric when it shows
the sound output, and a monitor source records what plays, never a
room. With the mode
in the main process the menu can mark it and the record keep it, and the
page still cannot send. A flyout keeps the drop-down short: fifteen more
rows would run past the bottom of a window at its minimum height.
The procedural modes are Canvas2D, as the Winamp ports are: they need no
WebGL context, so they never count against the eight, and every one
draws under swiftshader. Each draws on a canvas backed by the CPU and
blits it to the pane once a frame: under swiftshader a canvas on the
GPU rasterizes paths and gradients in software GL, and the zoom mode ran
at a fifth of the rate there.

## Rejected

- butterchurn-presets, and copying any MilkDrop preset: no license from
  the presets' authors.
- A send from the viz page for each click: the main process sees the
  input itself.
- The modes as a section of the drop-down: too long, see Why.
- A silent AudioContext: opens a device stream.
- `getUserMedia` on the monitor source in the page: the page would open
  a device stream itself, and whether Chromium lists a monitor source
  was not checked.
- Butterchurn or WebGL for the procedural modes: their pictures are
  state (a board, bodies, a wave function) drawn as it changes, not a
  feedback shader, and each pane would take one of the eight WebGL
  contexts.
- A window per tab: the maintainer asked for one window.
- One pane per window, the active tab's: the maintainer asked for every
  tab's.
