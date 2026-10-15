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
gravitational dynamics, and one on quantum mechanics"), and 2026-10-15
for the pointer (maintainer: "the visualizations should respond to
clicks and be moderately interactive. example: the quantum physics
visualizer should allow me to click and drag to put up barriers"),
and 2026-10-15 for the fern forest (maintainer: "a full forest of fern
leaves with drifting psychedelic colors and an infinite zoom-in").

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
    subagent, and calms at idle. Fern: a forest of fronds, iterated
    function systems of Barnsley's fern and three relatives grown by the
    chaos game, in drifting hues, under an endless zoom into the hero
    frond's copy of itself, each leaflet waving, a prompt morphing every
    frond to the next species (Fern forest, below). Go: a 13 by 13 board, a stone per event,
    played by the rules (liberties, capture, no suicide, ko) and cleared
    when full. Zoom out: six scenes, each the detail of the next, the
    sixth the first's detail, so the camera loops. Gravity: Newtonian
    bodies by leapfrog, merging on contact, events adding bodies or
    mass, the rates setting the clock. Quantum: the Schroedinger
    equation by split-step Fourier on a 128 by 64 grid, packets through
    slits onto a screen that records detections, a stop measuring and
    collapsing the state. With the sound output alone, which brings no
    events, a rise of its loudness counts as one.
- Each pane's mode belongs to the main process. The space bar steps the
  active tab's pane: the main process reads it from the window's input
  events, so the page sends nothing. A click steps no mode: it goes to
  the mode, save a click on the pane's drop-down (see 2026-10-15
  below). The menu's Visualization mode flyout
  lists every mode, the active tab's marked, and shows the one picked in
  the active tab's pane, opening the window when it is hidden. Each pick
  is recorded as the last skin is (decision 0022), one file per window
  under `$XDG_STATE_HOME/claude-skins/last-viz/`. A new pane starts in
  the first mode no other pane shows, counting from the last pick, and a
  launch's first pane in the newest record's mode, else in Drift. The
  modes are not kept per tab across launches.
- The pointer belongs to the page, which reads it and sends nothing,
  save a press on a drop-down: the left button's press, moves and release go to the pane under the
  press, found with `layout.js`, in the pane's canvas pixels, through
  the renderer's optional `pointer(kind, x, y, down)`. The press holds
  the pointer to its pane until the release. Nothing the pointer does
  changes a mode, the pane layout or the tab, and the keyboard stays
  with the terminal. Each mode answers in its own way:
  - Quantum: a press and drag paints a barrier along the path, a ridge
    of potential 2.5 high and about three points wide, above the
    packets' energy of 0.4 to 1 and below the wall's 4. Fresh, it
    lets through about one part in 100000 of a packet, so a packet
    scatters off it, and it leaks only as it fades toward their energy,
    after about 5 s. It fades
    with a time constant of 4 s and is gone in about 16. A click drops a short
    one. The barrier is drawn in amber over the wave.
  - Gravity: the release throws a moon from the press: a click puts it
    on a circular orbit about the heaviest body, a drag gives it a
    velocity in proportion to the drag, its aim drawn while pressed.
  - Go: a click on a point plays it for the side to move, if the rules
    allow it.
  - Zoom out: a click leaves a white ring where it lands on the scene
    in view, which recedes with the scene, and sets off that scene's
    surprise.
  - Fern: a click lights the fronds on its side of the pane in gold
    and blows a gust.
  - Every other mode, the five butterchurn presets, Scope, the two
    analyzers, Superscope and Dot plane, has no method of its own: a
    press adds a short tone to the pane's signal, its pitch on the
    bands' scale by the pointer's place across the pane and its
    loudness by its height, again every 60 ms of a drag, so a band
    display rises under the pointer and a drag sweeps it. The tone is
    no event and no beat, and it sounds on every input.
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

### Fern forest

Revised 2026-10-15 (maintainer: "the barnsley fern visualization is
very boring").

- Forest: the hero frond and its companions, of the four species and
  of several sizes, overlapping. A companion hangs in the frame of one
  of the hero's self-similar copies, its place, size, lean, mirror and
  species a hash of the copy's depth, so it stays put as the zoom
  passes. It fades in while small and out while larger than the pane.
- Colour: each point takes a hue from a wheel that turns with time and
  with the point's place and depth in the frond, over the full range.
  An idle spell pulls the hues toward amber.
- Zoom: each species is conjugated into one frame, the stem's foot at
  the origin and the tip, the fixed point of the copy map, at (0, 1),
  the copy map made a similarity. The camera at depth d sits at copy
  floor(d), seen through the power d - floor(d) of the next copy map
  about its fixed point. The path is continuous in d, so the loop has
  no reset: a copy enters when it is a fiftieth of the view and leaves
  when it is four times the view, each with no visible weight. A unit
  test pins the frames across an integer depth, and
  `scripts/checks/vizfern.js` captures 60 frames over more than an
  octave and refuses a step between neighbouring frames that stands
  out of the rest.
- Waving: each map of a frond at depth k is composed with a rotation
  of angle A sin(1.3 t - 0.55 k), the copy map by that angle and the
  leaflets by three times it, so a wave runs out along each frond. A
  companion carries its own phase and sways about its foot.
- Warp: kept. The picture passes through a Moebius map
  z -> (a z + b) / (c z + 1), its parameters eased from one random
  draw near the identity to the next every 9 s. On the recorded run
  the fronds bend and the forest swirls, and each frond stays
  readable. `WARP` in `app/viz/fern.js` turns it off.
- Cost: points are budgeted by the buffer's area, as before, and each
  point takes six waved maps. Frame rate with three panes, the median
  of five rounds on a loaded host (load average 16 to 20 on 16 cores),
  fern 39.5, gravity 46.5, quantum 30.5.

| Signal | Fern forest |
| --- | --- |
| bass, busy | zoom speed and growth rate |
| prompt | every frond morphs to the next species, the old picture dims |
| tool call | the fronds on one side light in the class's colour |
| stop, treble | a gust: the waving's amplitude rises and settles |
| subagent | a frond sprouts near the camera and grows |
| idle | the zoom, the waving and the hue drift slow, the trails linger |
| click | the fronds on its side light in gold, and a gust |

## Why

A numeric, receive-only channel keeps eval away from any session text.
The tab's place, not its label, names a pane, so the channel stays
numeric. One window keeps decision 0023's one window per app.
Synthetic levels drive butterchurn without audio hardware. Recording in
the main process keeps the page receive-only and numeric when it shows
the sound output, and a monitor source records what plays, never a
room. With the mode
in the main process the menu can mark it and the record keep it, and the
page still cannot send. The pointer acts on what the page draws, so the
page reads it, and nothing of it needs to reach the main process. A
click that stepped the mode would take the click from the modes. The
pointer's tone, for the modes that only draw the signal, makes each of
them answer with no code of its own, and it is kept out of the events
so a procedural mode never takes it for one. A flyout keeps the drop-down short: fifteen more
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
  space bar itself, and the page answers the pointer itself.
- A click, or a right click, that steps the mode: the maintainer wants the
  click to go to the mode, and each pane has its own mode drop-down.
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

## 2026-10-15: each pane's drop-down, and a lost GPU context

Maintainer: "clicking on a visualization should manipulate the vis ...
not cycle through the vis options. and the vis window itself should
have drop down menus in each split screen to switch modes easily".

- Each pane carries a button at its top left naming its mode. A click
  on it opens a list of every mode, in the order of `modes.js`, the
  pane's own marked, laid over the window below the button in as many
  columns as the window's height needs. A click on a row shows that
  mode in that pane alone and is recorded as the menu's pick is. A
  press anywhere else closes the list and reaches no mode, and the
  button closes its own list. One list is open at a time.
- The channel: the main process reads the presses, as it reads the
  space bar. `layout.js` gives the button and the rows in CSS pixels
  from the pane's place, the mode count and the window's size, with no
  text measured, and the main process and the page both load it. The
  main process takes each left `mouseDown` of the window's input events,
  whose x and y are CSS pixels at any device scale, finds what it hits,
  and keeps which pane's list is open. The frame carries that as one
  number per pane. The page draws the button and the open list, and
  hands no press on a button, or any press while a list is open, to a
  mode. The page still sends nothing.
- A butterchurn pane whose WebGL2 context is lost, as every context of
  the page is when the GPU process exits, drops its butterchurn and its
  canvas, and the next frame shows its mode on a new context, or on the
  scope with the reason. Before this, the pane stayed black while its
  mode stepped through the five butterchurn modes, so stepping seemed
  to stop part way. The maintainer's launch that ran overnight before
  the report logged two GPU process exits.

Why: the window never takes focus, and a native `<select>` opens its
list only in a focused window, so the list is the page's own. Reading
the presses in the main process keeps the channel receive-only, as the
space bar did, at the cost of the geometry living in `layout.js` rather
than in the page's CSS.

Rejected:

- A native `<select>` per pane: it needs the window focused.
- A send from the page of the picked mode's index: one validated
  number would do, but it would be the page's first send, and the main
  process can read the press itself.
