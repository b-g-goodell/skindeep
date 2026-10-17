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
leaves with drifting psychedelic colors and an infinite zoom-in") and
then the fern garden (maintainer: "re: fern, get more creative"), and
2026-10-15 for each tab's visualization in the tab strip (maintainer:
"visualizations in the tabs"), and 2026-10-15 for the Carbon mode
(issue #144), and 2026-10-16 for the Carbon atom in a magnetic field
(issue #158) and for the gravitational waves of the Gravity modes
(issue #163), and 2026-10-17 for Gravity 3D's optics (issue #170) and
for Quantum play (owner: "creatively
improve the interactivity of the quantum visualizer, and to add maybe
particles of various wavelengths interacting instead of just one
particle of one wavelength, and procedurally generated walls of
potential instead of always using the same 2 apertures").

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
- Modes: seventeen, listed once in `app/viz/modes.js`, which the main process
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
  - Fern, Go, Zoom out, Gravity, Gravity 3D, Quantum and Carbon: the project's
    procedural modes, one file each, no image or video. Each reacts to
    its pane's events, a prompt, a tool call in its class's colour, a
    stop, a subagent, and calms at idle. Fern: a night garden of fronds,
    one a turn, each rising as a fiddlehead and unrolling as the turn
    works, in drifting hues, before a still forest of Barnsley's fern
    and three relatives grown by the chaos game (2026-10-15: the fern
    garden, below). Go: a 13 by 13 board, a stone per event, played by
    the rules (liberties, capture, no suicide, ko) and cleared when
    full. Zoom out: six scenes, each the detail of the next, the sixth
    the first's detail, so the camera loops. Gravity: Newtonian bodies
    by leapfrog, merging on contact, events adding bodies or mass, the
    rates setting the clock, and the gravitational waves they radiate
    at quadrupole order, exaggerated, drawn in the plane: a pair of
    stars in close orbit spins a two-armed spiral of $h_+$ (see
    2026-10-16: gravitational waves). Gravity 3D: Gravity's bodies in
    three dimensions with black holes, spinning ones among them, before
    distant stars, every pixel a ray traced past the holes (see
    2026-10-15: Gravity 3D, and 2026-10-17: Gravity 3D's optics), and their
    waves, both polarizations, which carry energy away, so a tight pair
    inspirals and chirps until it merges (see 2026-10-16). Quantum: the
    Gross-Pitaevskii equation by split-step Fourier on a 128 by 64
    grid, packets of the session's wavelengths, drawn in the colour of
    their wavelength, at a wall generated from a seed, onto a screen
    that records detections, a stop measuring and collapsing the state
    (see 2026-10-17: Quantum play). Carbon: the neutral carbon atom
    on NIST's levels and lines, an ensemble at one site that an energy
    field from the session excites and that jumps by Monte Carlo at
    NIST's rates, one atom's cloud drawn in three dimensions, every
    jump's front crossing the pane, beside the level diagram and the
    spectrum (see 2026-10-15: Carbon). With the sound output alone,
    which brings no events, a rise of its loudness counts as one.
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
  - Quantum: a drag throws a packet, a press held still for a quarter
    second then dragged paints a barrier along the path, a ridge of
    potential 2.5 high and about three points wide, above the packets'
    energy of 0.1 to 2, and a click measures softly where it falls
    (see 2026-10-17: Quantum play). Fresh, the barrier lets through
    about one part in 100000 of a packet of energy 0.5, so a packet
    scatters off it, and it leaks only as it fades toward their energy,
    after about 5 s. It fades with a time constant of 4 s and is gone
    in about 16. The barrier is drawn in amber over the wave.
  - Gravity: the release throws a moon from the press: a click puts it
    on a circular orbit about the heaviest body, a drag gives it a
    velocity in proportion to the drag, its aim drawn while pressed.
  - Gravity 3D: a drag turns the camera, a click throws a moon (see
    2026-10-15: Gravity 3D).
  - Carbon: a drag turns the camera, a click on the atom lets the drawn
    atom absorb a photon from its present level, a click on the level
    diagram lifts it to the level under the click by a collision (see
    2026-10-15: Carbon). A press or drag on the dial sets the magnetic
    field, a click on the pulse button fires a polarized pulse (see
    2026-10-16: Carbon in a magnetic field).
  - Go: a click on a point plays it for the side to move, if the rules
    allow it.
  - Zoom out: a click leaves a white ring where it lands on the scene
    in view, which recedes with the scene, and sets off that scene's
    surprise.
  - Fern: a click curls the fronds near it, which unroll again, and
    gold spores rise from it.
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
very boring"), and replaced the same day by the fern garden, below.

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
so a procedural mode never takes it for one. A flyout keeps the drop-down short: seventeen more
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

## 2026-10-15: Gravity 3D

Maintainer: "make a 3dgrav visualizer with the same visual style as the
first 2d gravity visualizer, but which allows blackholes (schwarzchild
radii, rotating black holes, etc) and has a thematically consistent,
distant background of stars".

- Gravity 3D is a mode of its own, after Gravity in `modes.js`, drawn by
  `app/viz/gravity3d.js` on a canvas of the CPU as the other procedural
  modes are. Its id, `gravity3d`, is the first with a digit, so an id is
  a lowercase letter, then letters or digits. It copies the Gravity
  mode's step, softening and drawing rather than sharing them: in three
  dimensions and with horizons every term of the step differs, and the
  Gravity mode stays as it was.
- Units: $G = 1$ and $c = 11.5$, so a hole of mass $M$ has
  $r_s = 2GM/c^2$, 13.6 for the seed's 900, which reads on screen.
  Stars, planets, comets and dust are the Gravity mode's, in pairs
  attracted by softened Newtonian gravity, stepped by leapfrog in the
  frame of their centre of mass, merging on contact.
- Potential: a hole pulls by Paczynski and Wiita's
  $\Phi = -GM/(r - r_+)$, $r_+$ its horizon, $r_s$ at rest. Its
  circular orbits have $v^2 = GMr/(r - r_s)^2$ and
  $L^2 = GMr^3/(r - r_s)^2$, least at $r = 3 r_s$: the last stable
  circular orbit, at $6GM/c^2$ as in Schwarzschild's geometry. The pair
  force is symmetric, so momentum holds. Near a hole the step is cut
  into substeps of at most 3% of the gap to the horizon over the speed
  across it.
- Spin: a hole carries $a = \chi GM/c^2$, $0 \le \chi \le 0.95$, about
  a unit axis $\hat{j}$, and its horizon shrinks to
  $r_+ = GM/c^2 + \sqrt{(GM/c^2)^2 - a^2}$. What moves at $\mathbf{v}$
  relative to it, at $r \hat{n}$ from it, feels the Lense-Thirring
  acceleration $\mathbf{a} = \mathbf{v} \times \mathbf{B}_g$ with
  $\mathbf{B}_g = \frac{2GMa}{c r^3} (\hat{j} - 3 (\hat{j} \cdot \hat{n}) \hat{n})$,
  the post-Newtonian term of the IERS conventions with $J = Mac$, and
  the hole takes the reaction. It does no work. It pushes a prograde
  orbit in the equator out and pulls a retrograde one in, and turns an
  inclined orbit's node in the spin's sense at
  $\dot{\Omega} = 2GJ/(c^2 r^3)$.
- Capture: a body whose centre crosses $r_+$ is swallowed, a crossing
  within a substep caught by the least distance of the pair's relative
  motion taken as straight over it, its mass,
  momentum and angular momentum about the hole the hole's, whose spin
  follows, capped at $\chi = 0.95$. A grain of dust weighs 0.004. Two
  holes merge when their horizons touch.
- Checked by `test/viz-gravity3d.test.js`: $r_+ = r_s$ at rest and
  $0.9 r_s$ at $\chi = 0.6$, the least $L$ at $3 r_s$ to within 0.002,
  orbits at 3.3, 4 and 6 $r_s$ started 0.1% slow staying above $3 r_s$
  for 30 periods, orbits at 2.5 and 2.9 $r_s$ started so falling in
  within 5 with mass and momentum kept, a body inside the horizon
  swallowed in one step, and an orbit at 8 $r_s$ inclined 60 degrees
  about a hole of $\chi = 0.9$ turning its node to within 10% of the
  Lense-Thirring rate, the other way for the opposite spin and not at
  all at rest.
- The seed: a hole of 900 spinning at $\chi = 0.7$, 420 grains in its
  equator between 3.3 and 8 $r_s$, a companion of 80 at 175, a star of
  50 and a hole of 30 in a tight pair 16 apart (see 2026-10-16:
  gravitational waves), and two planets, at 215 and 245. Within 10 $r_s$ of a hole and outside $3 r_s$, the
  disc's viscosity relaxes a grain's velocity, at a rate of 0.01 per
  unit of time, toward 99.5% of the circular velocity in the plane of
  its orbit: grains settle on circles, spiral to the last stable orbit
  and plunge. The star nearest a hole sheds grains from the point
  between them where the pulls balance, L1, at 1.1 to 1.45 times its
  own angular speed: a stream that feeds the disc.
- Drawing: the camera, 620 from the centre of mass with a half view
  angle of 0.42 rad, turns about it. Bodies, grains and trails are
  drawn flat on slices of depth and seen through the trace (see
  2026-10-17: Gravity 3D's optics), and bodies are sized and dimmed
  with distance. A
  trail is the places a body passed, kept every 1.5 units of time or 4
  of travel and projected each frame. Matter at $d$ from a hole heats
  as $\min(1, (2.3 r_s/d)^2)$, toward orange, white and then blue
  white, larger and brighter, a hot grain beamed by
  $(1 + 0.6 v_\parallel/c)^2$ toward the camera. Merger rings and the
  idle dimming are the Gravity mode's.
- A hole is not drawn. Its shadow, of radius
  $\frac{\sqrt{27}}{2} r_s \approx 2.6 r_s$, the image of its photon
  sphere at $1.5 r_s$, and its photon ring are what the trace makes of
  the light near it (see 2026-10-17). A hole's flash, as it swallows,
  brightens the hot matter about it.
- Background: 3000 stars at infinity, a third of them in a band about
  a great circle, a galaxy's disc seen from inside, under 120 soft dots
  of its glow, warm toward one point. They are directions, turned with
  the camera and never moved by it, so they show no parallax, in the
  foreground's hues. Six bright ones lie on the circle that the line
  from the camera through the centre sweeps at the camera's first
  height, so a hole lines up with one now and then.
- Lensing: one rule for every pixel, the stars, the dust, the bodies,
  their trails and the holes alike (see 2026-10-17: Gravity 3D's
  optics).
- Signal: a tool call adds a planet in its class's colour on a near
  circular orbit about the heaviest body, tilted up to 0.5 rad, outside
  a hole's disc. A prompt sends a comet from the edge, aimed to miss a
  hole by 1.5 to 4.5 $r_s$, so some are swallowed, and rings the
  heaviest body. A stop flares the heaviest body and adds 12% to its
  mass, up to 1500. A subagent adds a black hole of 150 to 300 spinning
  at $\chi$ of 0.3 to 0.9 about any axis, with a small disc, the next a
  star, three of each at most, and a star first when none is left. A
  compaction slows every body and grain to 0.6 of its speed, so
  everything falls inward. An output event puffs 16 grains from a body
  that is not a hole. The rates set the clock as in Gravity: an idle
  spell all but stops it, shortens the trails and slows the camera.
- Pointer: a drag past 5 pixels turns the camera, across about the
  vertical and up and down in height, which holds for 4 s before the
  camera turns by itself again. A click throws a moon from the point
  under it, on the plane through the centre facing the camera, on a
  circular orbit about the heaviest body in the plane of that body's
  spin, at least 3.3 $r_s$ out. `scripts/checks/vizpointer.js` drags
  and clicks it.
- Frame rate: see 2026-10-17: Gravity 3D's optics. The sky's soft dots
  of glow are drawn from a canvas of the CPU: one on the GPU, drawn
  onto a canvas of the CPU, is read back at every draw, and that alone
  held three panes to about 15.

Rejected:

- Geodesics of the Kerr metric for the dynamics: the pseudo-Newtonian
  potential and the Lense-Thirring term keep the known radii and the
  frame dragging at a fraction of the cost.

## 2026-10-15: each tab's visualization in the tab strip

Maintainer: "visualizations in the tabs (i find the visualizations are
helpful at determining if an agent has finished something". The test
of every choice below: a glance at the tab strip tells a working agent
from a finished one.

- Where: in the tab strip, a canvas 44 by 16 CSS pixels in each tab
  with a session, CLI tabs and monitor tabs, between the unseen mark
  and the name, the active tab's too. The dashboard's tab has none.
  When the tabs crowd, the canvas gives up to half its width to the
  name. The strip shows from the second tab on (decision 0023), so a
  lone tab draws none: no other tab is there to tell it from, and the
  skin's meters and its pane show its state.
- What: not the pane's mode. A band of the session's loudness that
  scrolls right to left, a column every 125 ms, so a tab holds the last
  5.5 s. A column's height is the level the pane's synthesiser eases
  from the same numbers, its output and keys, its token rate and its
  busy state, and an event lights its column in the scope's colour for
  its kind or tool class. While the agent is busy the band shimmers, so
  a tool call that prints nothing still reads as work.
- Done: the busy state is not 1 and the tab has been quiet 2 s, no
  terminal output and no event. Within about a second the band greys
  and fades to a quarter, and a flat green line, the sessions
  dashboard's colour for waiting, runs through it. The band scrolls out
  in 5.5 s and leaves the line alone. A tab with no busy state, a plain
  command or a Claude session watched from its transcript alone
  (decision 0027), also needs its token rate over 10 s at zero. A
  monitor tab has no terminal of its own, so its events alone count.
- The numbers: `feed()` in `app/viz.js` drains each tab's events as
  before, and hands the same numbers, whether the window is open or
  not, to each main window that shows a strip, on the channel
  `tab:viz`, each window its own tabs, 30 times a second, with two
  numbers more: whether the tab lacks a busy state, and its quiet
  seconds. One drain feeds both, so the pane and the tab see the same
  events. The page eases the levels itself and runs no synthesiser.
- The pulsing mark of a background tab at work (decision 0023) is gone:
  the band says the same of every tab. The mark of output not yet seen
  stays, so a finished tab whose result is unread shows both.
- Cost: the page draws on a canvas backed by the CPU, and redraws
  every tab at once as a column closes, 8 times a second, since under
  software GL each new frame of the strip recomposites the window. A
  done tab whose line has settled is not redrawn. Measured by
  `scripts/checks/tabviz.js cost` against c5d1a70, the commit before,
  six tabs of the fake claude at work, three alternating rounds on a
  host at load average 26 to 40 on 16 cores, under swiftshader, the
  medians:

  | | before | after |
  | --- | --- | --- |
  | no viz window: main window frame rate | 29.2 | 29.0 |
  | main window frame median, p95 (ms) | 16.7, 116.6 | 16.7, 66.8 |
  | main renderer timer lag p95 (ms) | 2.2 | 1.7 |
  | main renderer CPU (% of a core) | 11.3 | 12.4 |
  | viz window open: its frame rate | 5.5 | 7.3 |
  | main window frame rate | 7.6 | 8.1 |

  The difference is within the rounds' spread but for the main
  renderer's CPU, about one point of a core more. With the window open
  both are bound by the GPU process, whose five butterchurn panes run
  in software GL.
- Checked by `scripts/checks/tabviz.js look`: four tabs of the fake
  claude, two held idle, in deck and phosphor, then at a quarter tile
  and at eight tabs there. Each held tab shows the flat line alone,
  each working tab a band, the strip stays 24 px high, and a held tab
  let go works again.

Why: the strip is the one place where every tab shows at once. The
pane's modes do not survive the size: a fern, a Go board or a wave
function is a smear in 44 by 16 pixels, butterchurn needs a WebGL
context, and the main window's terminals already hold theirs (xterm's
WebGL addon), and a mode per tab would run in the renderer that draws
the terminal. Motion against a flat line is what the eye catches in a
strip. The synthesiser's 1024 samples and 48 bands per frame per tab
are the work that would compete with the terminal, and the band needs
only its levels.

Rejected:

- The tab's body beside the terminal: only the active tab's body shows,
  so it tells nothing of the others, and the room belongs to the skin's
  insets, of which a quarter tile has none to spare (decision 0006).
- The pane's own mode, drawn small: unreadable, and the cost above.
- Copying each pane's picture from the window: nothing while the window
  is closed, and a read back from the GPU for every frame.
- A taller strip: a quarter tile's skin area would lose the rows.

## 2026-10-15: the fern garden

Maintainer, after the fern forest above: "re: fern, get more creative".
The forest was rainbow point dust under an endless zoom: no figure to
follow, and no event a viewer could name from a frame.

Four sketches were built and looked at on one scripted session: a
garden of fiddleheads that unroll as the session works, a walk through
a forest of fern sprites at night, a fern mandala of N mirrored copies
of a chaos-game frond, and the first and second together. The mandala
read as a flower and lost the fern. The walk was a place without a
story. The fiddlehead unrolling was the one frame worth stopping for,
and the night forest gave it a stage, so the two together were kept.

- Garden: each turn grows a frond. A prompt sends up a fiddlehead:
  the stipe, the stalk below the blade, stands open, and the blade is
  a coil whose curvature grows to its tip, about two and a half turns.
  As the turn works the coil unrolls, its pinnae opening from the foot
  behind it, each pinna a small coil of its own. The stop opens the
  frond the rest of the way. Six turns' fronds stand at most, the
  oldest withering past that.
- Geometry: a rachis or a pinna is a strand, its open part bent by a
  constant and by the wind, the rest a coil whose turning per unit
  length grows as $s^{3/2}$ to the tip. The pinnae sit at fixed
  stations of the blade, so they stay put as the rachis opens. A unit
  test pins the strand: straight when open, its length kept, its
  heading turned by $2 \pi T$ for a coil of $T$ turns.
- Forest: kept as the backdrop, a still forest of the four species
  grown by the chaos game, once per pane size, under mist on the
  ground.
- Colour drift: kept. Each frond takes a new hue, drifting with time
  and from foot to tip. A tool call's pinna keeps its class's colour,
  so an open frond shows the turn's tools as bands.
- Waving: kept. A wave runs out along each rachis, its phase its own,
  and the pinnae flutter. A stop and the treble blow a gust.
- Zoom: dropped. The garden is a stage the session writes on, and a
  camera always moving on would carry each frond out of view before it
  opened.
- Warp: dropped. It bent the forest as a whole, and here each
  frond's shape is what tells the session, so the garden was not tried
  under it.
- Drawing: lines of light, a dot a pixel, into a buffer of the CPU,
  faded each frame and blitted once over the backdrop, as the forest's
  points were. Canvas2D strokes of a like garden cost 80 to 110 ms a
  frame in a prototype at 600 by 380. Drawn alone at that size, a
  frame of the garden costs a median 2.9 ms, quantum 2.2, gravity 0.3
  and the fern forest before it 4.6. Frame rate with three panes, the
  median of five rounds on a loaded host (load average 33 to 43 on 16
  cores), fern 9.5, gravity 10.5, quantum 8.5: the rounds ran from 4.5
  to 21.5, so the host's load sets them more than the modes.

| Signal | Fern garden |
| --- | --- |
| prompt | a fiddlehead rises, the last turn's frond opens fully |
| bass, busy | the turn's frond unrolls faster |
| output event | light runs up the rachis to the coil |
| tool call | the next pinna up from the foot lights in the class's colour, keeps it, and looses spores of it |
| stop | the frond opens fully, and a gust |
| treble | wind and flutter |
| subagent | a small frond sprouts at the turn's foot, withering with it |
| compaction | the older half of the garden curls back and sinks |
| idle | the fronds curl half shut, the hues pale, fireflies come out, the light lingers |
| sound output alone | a frond fully open sprouts the next while the sound goes on |
| click | the fronds near it curl as a sensitive plant's do and unroll again, gold spores rise |

## 2026-10-15: Carbon

Maintainer, on issue #144: "a quantum-theoretically-accurate model of
the carbon atom as one of the visualizations (changes in electron
energy levels is the dynamic part ... NIST-posted energy levels". Built
from `docs/research/carbon-atom.md` and its data, the photon from
`docs/research/carbon-photon.md`, and the owner's answers in the
comments on #144 of 2026-10-15: the ruling on the photon and a
spectrum, and the answers on the Phase 2 plan, which replace that
ruling's starting point by `carbon-photon.md`.

- Carbon is a mode of its own, after Quantum in `modes.js`, drawn by
  `app/viz/carbon.js` on a canvas of the CPU as the other procedural
  modes are. Its data is `app/viz/carbon-data.js`, written by
  `scripts/research/carbon_slim.js` from
  `docs/research/carbon-atom-data.json`: the 68 levels, all 559 lines,
  the Rydberg ladders, the outer-electron model, the M_L components'
  subshell occupations and the Bunge 1993 basis. `test/viz-carbon.test.js`
  rewrites it and fails if the file differs, and checks it against the
  research data: every energy, $A$ and branching ratio, the Ritz
  wavelengths $10^7/(E_k - E_i)$ against NIST's within $2\times10^{-7}$,
  each level's branches summing to 1 and $1/\sum A$ its lifetime, every
  level reaching the ground term by listed decays. It also pins the two
  clocks, the ensemble's jumps and M_L, the radial samplers, the
  patterns and a jump's source.
- Sources: NIST ASD 5.12 for the levels, lines, $A$ and branching, Haris
  and Kramida 2017 for the ionization limit, Bunge, Barrientos and Bunge
  1993 for the ground orbitals, CIE 1931 and CSS Color 4 for the visible
  lines' colours, CODATA 2022 for $c$, the bohr and the atomic unit of
  time, as the research cites them. The photon: Scully and Zubairy ch. 6,
  Berman, Kuzmich and Milonni 2025 and Jackson ch. 9, as
  `carbon-photon.md` cites them.
- The pane: the atom on the left, the level diagram on the right (below
  in a tall pane), the spectrum along the bottom, the drawn atom's last
  jump as a caption at the top beside the drop-down. An atom under 240
  pixels a side, as in a split of three panes, is small: a band of two
  rows above it holds the jump's caption and the ensemble's, and nothing
  is written over the cloud. Every text is written only where it
  overlaps no text written before it, in this order: the jump's
  caption, the ensemble's, the lit level's name, the arrow's
  wavelength (left to the caption in a small pane), the atom's rows,
  the axis's name and the scale bar, so that a crowded pane drops the
  last first. The code keeps each part behind a small interface:
  `Clock`, `Ensemble`, `Cloud`, `Front` and `Warp`.
- One site, many atoms: an ensemble of 160 atoms at one site, so that
  hundreds of photons a second come from a picture of one atom. The pane
  says "one site, 160 atoms: cloud of 1, fronts of all". The cloud, the
  source, the lit level and the arrow are one atom's, the fronts and the
  spectrum every atom's, the level diagram's bars the populations.
- The event clock: every NIST rate divided by $10^6$, one factor, so the
  ratios between levels stay true. A $2p3s$ level waits 2.7 to 2.9 ms on
  screen, a $2p4p$ one 74 to 243 ms. Each atom jumps by Monte Carlo,
  Gillespie's method over each frame: its decay at $1/\tau$ competing
  with the field, a jump at a random time, instant, a quantum trajectory
  (the Monte Carlo wave-function method of Dalibard, Castin and Molmer,
  1992, as the Phase 2 plan page names it). The pane
  prints the real $\tau$ and the screen's.
- The energy field: the session's activity, $0.45$ busy $+ 0.35$ output
  $+ 0.2$ token rate, nothing while idle, drives electron collisions at
  up to 1.2 a second per atom into any radiating level above the
  present one, by statistical weight $g$, as a hot discharge does, its
  Boltzmann factors flat. Weighted by $e^{-\Delta E/kT}$ at a cool
  discharge's temperature, the collisions would fill $^1D_2$, $^1S_0$ and
  $^5S^o_2$, which radiate nothing on this clock. 1.2 a second stays below
  the slowest allowed decay, $2p4p\,{}^3D$ at 4.1 a second, so the
  visible lines still leave. At full activity the ensemble gave 311 to
  373 photons a second and 117 to 184 fronts at once.
- Under one factor the forbidden lines (462 nm, 873 nm, 981 to 985 nm,
  the far infrared) and the $^5S^o_2$ intercombination lines are never
  emitted: $^1D_2$ waits $3.4\times10^9$ s. The field lifts atoms out of
  those levels, as collisions do in a real discharge. An idle ensemble
  rests in the ground configuration's terms, $^3P$, $^1D$ or $^1S$, and
  in $^3P$ on the $J$ its cascade reached (question 6). This replaces
  the earlier cap of 8 s on the forbidden waits.
- The light clock: light at $c/10^{17}$, 2.998 nm a second, 56.65 bohr
  a second on screen, so a front crosses a $2p4p$ cloud's diameter,
  1.54 nm, in about half a second. The view is fixed at 24 bohr so every
  front keeps that pace: an excited atom fills it, the ground atom is its
  bright core. The pane states both clocks.
- The cloud (question 4, revised): Monte Carlo stippling of $|\psi|^2$
  for the drawn atom's $M_L$ about the chosen axis $z$, labelled. Each
  subshell with an entry in the research's Clebsch-Gordan table draws
  each point's $m$ by $n_m$ and its direction from $|Y_{lm}|^2$, its
  radius from the orbital's inverse-CDF table. $2s2p^3$ has no entry
  and is drawn round. 1.2 % of the points are drawn afresh each 60th of
  a second, so the cloud seethes and keeps its shape. A point of
  $m \ne 0$ turns about $z$ at Madelung's $m/\rho^2$ in atomic units on
  the light clock, $2.4189$ s on screen per atomic unit of time, at
  most 3 rad/s near the axis, where the density of $m \ne 0$ vanishes.
  A collision draws the atom's $M_L$ anew. A jump of component $q$ takes
  $M_L$ to $M_L - q$, $q$ drawn by the squared Clebsch-Gordan
  coefficient (see 2026-10-16: Carbon in a magnetic field, which
  replaces the uniform draw). The core is Bunge's, the outer electron the
  quantum-defect model, drawn in amber and labelled a model.
- The jump, by `carbon-photon.md` section 4: the drawn atom's cloud
  snaps to the lower level's, and for 0.4 s its transition density
  $\psi_f^*\psi_i$, of the one electron the line moves, flashes as the
  source, mint where positive, pink where negative, labelled. A jump of
  two electrons, $2s^2 2p\,nl$ to or from $2s2p^3$, which only
  configuration mixing allows, flashes none and says so.
- The front: a sphere about the site, its brightness the radiation
  pattern of the jump's component about $z$: E1 and M1 $\sin^2\Theta$ for
  $q = 0$ and $(1 + \cos^2\Theta)/2$ for $\pm1$, E2 $\sin^2\Theta\cos^2\Theta$,
  $1 - 3\cos^2\Theta + 4\cos^4\Theta$ and $1 - \cos^4\Theta$ for 0, $\pm1$
  and $\pm2$ (Jackson ch. 9). Its amplitude follows the physics
  (question 3): intensity $h\nu$ times the pattern over $r^2$, drawn as
  its square root, $\sqrt{\nu/\nu_{538}}\sqrt{P(\Theta)/P_{max}}\,R_0/r$,
  $R_0 = 8$ bohr, 1 at most. Fronts from separate atoms add their
  brightness and never cancel. Where two thin rings cross, the drawn
  brightness adds amplitudes, and crossings are brief.
- Visible fronts (question 2, revised) in their hue, the limb of the
  sphere and two crests behind it at a spacing that grows as
  $\lambda^{0.35}$, a symbol: the pane prints, for example, "538.0 nm =
  699 x this atom". Ultraviolet fronts sharpen the picture and lift its
  contrast across a band as wide as their crest spacing. Infrared fronts
  refract it, shifting pixels along the radius by a ripple of their
  spacing, heat haze. Both are one pass over the atom's pixels: every
  front adds to tables by integer radius and pattern kind, and a pixel
  takes its radius's tables times each kind's shape in its direction,
  radii with no front skipped. A faint fixed grain lies under the atom
  for them to act on, since on black they would show nothing.
- Detection: a front that reaches the pane's nearest edge collapses to
  one point, in a direction drawn from its pattern, and its line lights
  in the spectrum then, not at the jump. At most 500 fronts fly, and past
  that the oldest is detected at once.
- The level diagram: every level at its energy, 0 to the C II limit
  $90\,820.348\ \mathrm{cm^{-1}}$ dashed, in five columns, singlet and
  triplet by parity and the quintet, the Rydberg ladders faint toward
  the limit. Each level's bar lights with its share of the ensemble. The
  drawn atom's level is white and named, its last jump an arrow in its
  light's colour, or grey and dashed outside 380 to 780 nm. The ground
  term's fine structure is an inset, magnified, with the populations
  and the drawn atom's $J$ (question 5).
- The spectrum: a log wavelength axis from 110 nm to 10 $\mu$m, every
  line a faint tick in its colour or grey, the visible band marked, an
  off-scale bin for the ground term's far-infrared lines. A line flashes
  at each detection and keeps a bar that grows as the square root of its
  count.
- Checked by `scripts/checks/vizcarbon.js`: one pane watched by its
  probe through the fake session's turns, frames of a source flash,
  visible, ultraviolet and infrared fronts, hundreds of fronts at full
  activity and the spectrum, then the frame rate below. At every frame
  it captures, at 1200 by 760 and in each Carbon pane of the 720 by 460
  split, no two texts overlap: the ink box of every text the probe
  reports, and the drop-down's box. `vizmodes.js`
  captures Carbon in its phases with the other procedural modes,
  `vizpointer.js` clicks it, `vizzeeman.js` checks the magnetic field.
- Frame rate, under swiftshader on a loaded host: at full activity,
  drawn alone on a 400 by 380 canvas with 158 fronts, a frame of Carbon
  costs a median 7.9 ms, Gravity 0.8 and Quantum 2.2. Three panes of a
  720 by 460 window all in one mode, five rounds in turn, ran at a
  median of 7.5 frames per second in Carbon, 10 in Gravity and 5 in
  Quantum on the fake session's activity, and 7, 8 and 8 at full
  activity, held there by an override of Synth's step in the check. The
  rounds ran from 2.5 to 20.5, so the host's load sets them more than
  the modes.

| Signal | Carbon |
| --- | --- |
| busy, output, token rate | the field: collisions at up to 1.2 a second per atom into any radiating level above, by $g$ |
| prompt | an electron collision lifts a quarter of the ensemble, the drawn atom among it, to a $2p4d$ or $2p5s$ level, by $g$: the longest cascades, the red lines and the 119 nm VUV |
| stop | the same onto a $2p4p$ level: the blue, cyan, green and yellow lines, which no photon from the ground term can reach (even parity) |
| tool call | a photon absorbed from the present level by 15 % of the ensemble, by the E1 rule: the lines up from it, sorted by the upper level's energy and cut in five bands, read, edit, shell, web and agent taking the first to the fifth, other any, within a band by $f_{ik}\lambda$, a lamp of flat spectral energy density |
| subagent | a spin-exchange collision of 10 % of the ensemble onto $2s2p^3\,{}^5S^o_2$, which no cascade reaches |
| output event | for 30 % of the atoms in the ground term, a thermal collision: $J$ by Boltzmann's populations at 300 K, $g_J e^{-E_J/kT}$, 0.128 : 0.354 : 0.518 |
| compaction | a superelastic collision quenches every atom to the ground term, $J$ as above, without light |
| idle | the field falls to nothing: cascades run down and the ensemble rests, the camera slows, the cloud dims |
| sound output alone | its rises count as output events |
| drag on the atom | turns the camera, which holds 4 s |
| click on the atom | a lamp: a photon absorbed by the drawn atom from its present level, any band |
| click on the level diagram | an electron collision lifts the drawn atom to the level nearest the click in that column |
| press or drag on the dial | sets the magnetic field $B$, 0 to 2 mT, at an angle to $z$ (see 2026-10-16) |
| click on the pulse button | a pulse aligns every atom in the ground term on $2p4p\,{}^3P_2$, and the detector's rate beats (see 2026-10-16) |

Rejected:

- A photon from a point S sampled from the upper density toward a point
  F from the lower, the owner's first ruling: `carbon-photon.md` finds no
  basis for it, and the owner's answers replace it.
- One atom on a clock fast enough for hundreds of photons a second: its
  cloud would snap every frame, and the owner chose one atom standing
  for many.
- A gradient for the visible band: the CIE table is not in the
  repository, and each line carries its own colour.

## 2026-10-16: Carbon in a magnetic field

Owner, 2026-10-15: "file a new issue to make the carbon atom precess",
filed as issue #158 from the research `docs/research/carbon-beyond.md`
section 5.2 and its candidate 1. The issue left two choices to the
builder, settled here, and the rest follows its text.

- The data: each level of `app/viz/carbon-data.js` carries `gJ` and
  `gJsrc`, written by `scripts/research/carbon_slim.js`: NIST's measured
  value for $2p^2\,{}^3P_1$ (1.5010623), ${}^3P_2$ (1.5010469) and
  $2p3s\,{}^1P^o_1$ (0.97), `measured`, and for every other level the LS
  formula $g_J = 1 + (g_s - 1)[J(J+1) + S(S+1) - L(L+1)]/[2J(J+1)]$ with
  $g_s = 2.00231930436092$ (CODATA 2022), `LS`, a model for the mixed
  levels. The twelve $J = 0$ levels carry null and do not precess.
  `test/viz-carbon.test.js` checks the three measured values, every LS
  value against the formula, and the nine distinct LS values from
  0.4988 to 2.0023 the research prints.
- The precession: an atom's $M_L$ is taken about its own axis, a unit
  vector, which turns about $B$ at the Larmor rate $g_J\mu_B B/h$ of its
  present level, $\mu_B/h = 1.39962449171\times10^{10}$ Hz/T (CODATA
  2022), divided by the event clock's $10^6$: 14.0 Hz on screen per mT
  per unit $g_J$. The turn is right-handed about $B$, as
  $d\mathbf J/dt = \boldsymbol\Omega\times\mathbf J$ with
  $\boldsymbol\Omega = g_J\mu_B\mathbf B/\hbar$. The level's $g_J$
  moves the whole $M_L$-resolved state, cloud and pattern alike, as the
  issue asks: the cloud is resolved by $M_L$ and the rate is the
  level's, a model of LS coupling the pane does not hide. A state of
  $M$ about $B$ stands. The drawn atom's cloud and its next photon's
  pattern are drawn about that axis, the axis itself in cyan. Its frame
  swings about $B$ and is turned back about its own axis by the share
  of the turn along that axis, so a state round about its axis shows no
  turn that is not a precession, and with $B$ along $z$ nothing turns.
  A collision lifts an atom with its $M_L$ drawn anew about $z$ and its
  axis $z$ turned about $B$ by a random phase: collisions are
  incoherent, so atoms lifted at one instant, as a prompt lifts a
  quarter of the ensemble, do not precess in step. A jump keeps the
  axis, and the lower level turns at its own rate. When $B$ changes,
  every atom keeps the axis it has then: an atom tilted from $z$ before
  $B$ was set along $z$ turns about $z$ until its next collision, and
  the pane says so.
- Every atom of the ensemble precesses, not only the drawn one (the
  issue's second question): the fronts are every atom's, and a beat
  needs the ensemble. Each atom is a unit vector and a time, and its
  photon's direction follows from them, so the cost is the vector's
  turn at a jump.
- The jump's component $q$ is drawn by the squared orbital
  Clebsch-Gordan coefficient $\langle L_l\,M-q;\,k\,q\,|\,L_u\,M\rangle$
  of the multipole's rank $k$, replacing the uniform draw of 2026-10-15:
  under the uniform draw every atom radiates isotropically whatever its
  $M$, and an aligned ensemble could not beat. Summed over $M$ every
  level's photon is isotropic, so the incoherent ensemble makes no beat;
  `test/viz-carbon.test.js` checks it. A line whose $L$ break the
  triangle, which LS coupling forbids and only mixing allows, takes
  every $q$ of its rank alike and radiates isotropically, and the jump
  keeps $M_L$ within the lower level's $L$ (the uniform draw had let it
  leave it on such lines).
- Fronts keep the pattern of their moment of emission: each front
  carries its atom's axis at the jump, its visible limb is bright by
  the pattern about that axis as the camera sees it, and its detection
  direction is drawn from the pattern about it. The invisible fronts'
  pass over the atom's pixels takes each front's shape about its own
  axis as harmonics of the screen angle, $\cos 2n\psi$ and $\sin 2n\psi$
  to $n = 4$, in tables by radius: a pixel sums the tables at its radius
  against its own angle's harmonics, so the cost does not grow with the
  number of axes. Cut at the fourth harmonic, each shape stays within
  0.14 of its largest value, the worst at the cusps of E2 with $q = 0$
  seen side-on.
- How the user sets $B$ (the issue's first question): a dial at the
  atom's lower right. The pointer's angle from up on the dial is $B$'s
  angle from $z$ toward $x$, in whole degrees, within 2 degrees of $z$
  taken as $z$. Its distance from the centre over the radius, squared,
  is $B$'s share of 2 mT, in steps of 0.01 mT, so the low fields where a
  $2p4p$ emitter turns 1 to 5 times a lifetime take most of the dial.
  $B$ starts at 0.30 mT at 60 degrees, so the mode precesses unasked.
  $B$ lies in the $x$-$z$ plane: every excitation here is round about
  $z$, so $B$'s azimuth about $z$ changes nothing. The 3D view draws $B$
  as a violet axis through the atom with its arrow and name. A small
  pane keeps the dial and writes no text over its atom: the field and
  the drawn atom's rate go with the ensemble's caption above it.
- The pane states the field ("B 0.30 mT at 60 deg to z, in the x-z
  plane"), the drawn atom's rate on screen and its real value ("turns
  about B at 6.30 Hz on screen, 6.30 MHz real"), and its $g_J$ marked
  measured or "LS: a model". With $B$ along $z$ it says that an $M$
  state about $B$ is stationary and nothing turns, with $B$ at 0 that
  nothing precesses, and at $J = 0$ that the level has no moment.
- The pulse: a click on the pulse button. A pulse of light linearly
  polarized along $z$ lifts every atom in the ground term ${}^3P$ by two
  photons to $2p4p\,{}^3P_2$ at one instant, each in $M_L = 0$ about $z$
  and its axis $z$: a model of the alignment such a pulse makes, at its
  largest. ${}^3P_2$ is spin-allowed from the ground term, keeps 141 ms
  on screen, about 1.5 Larmor turns at 0.5 mT, and has a visible line,
  477.2 nm, the filter's.
- The beat (the issue's second question, how it is drawn): a detector
  along $y$, perpendicular to $z$ and to $B$, where an aligned atom's
  beat is deepest, drawn as a small square where $y$ meets the circle
  on which fronts are detected, and named. It counts the 477.2 nm line
  of $2p4p\,{}^3P_2$ through a filter, as a quantum-beat experiment
  watches one line. Its rate is drawn as a trace of the last second
  beside the dial, by detection time, a sample the light's travel to
  the circle after its emission: the expected rate from the ensemble's
  state, each atom on the line's upper level the line's $A$ on the event
  clock times its photon's angular density toward $y$ over the
  isotropic one, times the detector's 5 % of the sphere. A pulse of
  about 130 atoms sends about 15 photons of the line, under one of them
  to such a detector, so its counts would show the beat only folded
  over many pulses; the expected rate is what their count converges to
  over many pulses. After a pulse the aligned atoms turn in step and
  the rate beats at $2g_J\mu_B B/h$, twice the Larmor rate since every
  pattern is even in $\Theta$: 21.0 Hz on screen at 0.5 mT. The trace
  marks the pulse in violet and says "pulse: beat at 2f = 21.0 Hz";
  without a pulse in the last second it says "no pulse: M incoherent,
  no beat". The trace needs an atom 260 pixels wide and 200 tall at
  text size 1, and a smaller atom keeps the pulse button and the dial.
- Checked by `scripts/checks/vizzeeman.js`, a suite job, on the fakes:
  the drawn atom's axis read over time with $B$ set at 90 degrees by a
  drag on the dial, the angle it turns about $B$ between readings at one
  level against $2\pi g_J\mu_B B/h/10^6$ times the time between them,
  $g_J$ from the data file, over 40 pairs and at least two turns; with
  $B$ dragged onto $z$ and the drawn atom lifted since, its axis on $z$
  and the pane saying why; after a click on the pulse button, the
  spectrum of the detector's rate, its fitted decay taken out, peaking
  within 5 % of $2g_J\mu_B B/h$, and detections drawn on the circle;
  frames of a full pane and of a 360 by
  230 one, no two texts overlapping in any.

Rejected:

- $B$ set in the pane's drop-down: the drop-down is the window's list
  of modes, drawn and read by the main process, and holds no mode's
  controls.
- $B$ driven by the session's activity, as the activity drives the
  excitation: $B$ is the viewer's instrument, and a field that moved
  with the session would change every atom's rate under the viewer.
- A handle at the tip of the drawn $B$ axis, dragged in 3D: its
  projection shrinks to a point when $B$ points at the viewer, and one
  drag would set the angle and the size at once.
- Only the drawn atom precessing: the fronts and the beat are the
  ensemble's.
- A histogram of the detector's actual counts, folded over pulses:
  at under one count a pulse, the beat stands above the shot noise only
  after many pulses.
- A static Zeeman split on the level diagram: 1 T spreads a $g = 1.5$,
  $J = 1$ level over 1.4 $\mathrm{cm^{-1}}$, under a pixel (research
  5.2).

## 2026-10-16: gravitational waves

Owner, 2026-10-16: "both gravity visualizations should have some
representation of gravity waves (obviously exagerrated)", filed as
issue #163: gravitational waves, the strain that accelerating masses
radiate at $c$, not the waves of a fluid. The issue left the drawing,
the 2D wave speed and radiation reaction to the builder, settled here.

- The formula, in `app/viz/waves.js`, which both modes load: quadrupole
  order, $G = 1$,
  $h_{ij}^{TT}(t, \mathbf{x}) = \frac{2}{c^4 r} \Lambda_{ij,kl}(\hat{n}) \ddot{I}_{kl}(t_r)$,
  with $\ddot{I}_{ij} = \sum_k m_k (2 v_{k,i} v_{k,j} + x_{k,i} a_{k,j} + a_{k,i} x_{k,j})$
  about the centre of mass, from the places, velocities and
  accelerations the modes hold: exact for any configuration, with no
  finite difference. Each is taken relative to the centre's, so a lone
  body moving uniformly radiates nothing.
- Sources: the formula holds far from its source, and a tight pair need
  not sit at the centre of mass. A pair whose members pull hardest on
  each other and are bound is a source of its own, about its own centre
  of mass, and every other body with each such pair's centre of mass
  is one more, about the centre of mass of all. By the parallel axis
  theorem their $\ddot{I}$ sum to the system's, so the far field is the
  system's, and near the pair its fronts leave the pair.
- Retarded field: each source keeps its $\ddot{I}$, its place and its
  near zone's radius in a ring buffer of 512 samples, one a step of
  0.25, 128 units of time, a front's travel of 1472 at $c = 11.5$. A
  point reads its source at $t_r = t - |\mathbf{x} - \mathbf{X}(t_r)|/c$,
  found by three steps of that map from $t_r = t$, which close on it as
  $(v/c)^3$: a moving pair's fronts are centred where they were sent.
  Before a source's first sample its field is nothing, so a seed's
  first front leaves its pair at $c$, and when a pair ends its last
  front leaves it.
- Polarizations, about a source's axis $\hat{L}$, its angular momentum:
  with $\hat{e}_\phi = \hat{L} \times \hat{n}$ and
  $\hat{e}_\theta = \hat{e}_\phi \times \hat{n}$ normalized,
  $h_+ = (\ddot{I}_{\theta\theta} - \ddot{I}_{\phi\phi})/(c^4 r)$ and
  $h_\times = 2 \ddot{I}_{\theta\phi}/(c^4 r)$. A circular pair gives
  both $4 m_1 m_2/(c^4 a r)$ along its axis, $h_+$ times
  $(1 + \cos^2 \iota)/2$ and $h_\times$ times $\cos \iota$ at
  inclination $\iota$, and in its plane $h_+$ halved and no $h_\times$.
- Near zone: within its reduced wavelength $c/(2\Omega)$, $\Omega$ the
  source's orbital frequency, $\Omega^2 = \sum m |x| |a| / \sum m |x|^2$
  about its centre, or twice its rms size if that is larger, a source's
  field is the Newtonian tide, not yet a wave. It fades there by
  $(r^2/(r^2 + r_0^2))^2$ instead of growing as $1/r$. A wide slow
  orbit, a star and a far companion, is near zone across the whole view
  and barely drawn, and a tight pair's spiral starts a reduced
  wavelength out.
- Bounded at a horizon: the Paczynski-Wiita pull grows without bound at
  $r_+$, a fall in general relativity does not. The part of a body's
  acceleration that the pull adds within $r_+$ of a horizon, beyond its
  value at a gap of $r_+$, is left out of the waves' $\ddot{I}$, and
  each body's term is held to $4 m c^2$ in norm, so a plunge's burst
  stays near $\mu c^2$. The dynamics keep the whole pull.
- The gain: the strain is drawn as $\tanh(5000\,h)$, one gain for both
  modes. Where a strong source's strain would turn from + to - within
  one drawn cell, so that the grid blurred up to the pane would show the
  turn as steps, the argument is divided by the local steepness, the
  largest step of $5000\,h$ to a neighbouring cell over 0.8: an
  antialiasing of the turn, not a second gain, and 1 wherever the field
  changes by less than that from cell to cell, the seeds' pairs among
  them. Their pairs radiate alike at the same $c$: the faded strain
  peaks at $0.325 A/r_0$, at $r = \sqrt{3} r_0$, $A = 4 m_1 m_2/(c^4 a)$
  along the axis and half in the plane, and 5000 brings that to about
  0.6: 0.63 for Gravity's pair in its plane, 0.87 on the axis of
  Gravity 3D's and 0.44 in its plane. The pane says so at its top
  right, "gravitational waves, exaggerated x5000", clear of the
  drop-down's button, else "waves exaggerated x5000", else that under
  the button, at the visualization text size.
- Gravity's wave speed: $c = 11.5$, the value of Gravity 3D's, so the
  one gain serves both. A front crosses the view of 480 in 42 units of
  time, 1 to 4 s at the clock's usual rates. It drives the waves alone,
  not the dynamics, which stay Newtonian.
- Gravity's seed: the star of 900, a planet at 60, the belt of dust,
  and two stars of 64 on a circular orbit 22 apart, their centre of
  mass 170 from the star, a third of their Hill radius, bound for 5000
  units of time in runs headless that started them at three phases.
  They turn every 58 units, and their waves, of wavelength
  $\pi c/\Omega = 334$, spin a two-armed spiral of $h_+$ in the plane,
  the only polarization there. A subagent adds a star while there are
  fewer than 5, not 3, so the pair does not end that event.
- Gravity 3D's seed: the companion of 80 at 175 is a star of 50 and a
  hole of 30, 16 apart, on a circular orbit in the plane of their orbit
  about the hole and in its sense, a third of their Hill radius. The
  star feeds the disc as the companion star did, and its own hole too.
  They turn every 44 units, wavelength 251.
- Radiation reaction, in Gravity 3D, where $c$ is the dynamics' own:
  every pair feels the 2.5PN relative acceleration in the Burke-Thorne
  gauge (Iyer and Will 1995),
  $\mathbf{a} = \frac{8}{5} \eta \frac{M^2}{c^5 r^3} [(3 v^2 + \frac{17}{3} \frac{M}{r}) \dot{r} \hat{n} - (v^2 + 3 \frac{M}{r}) \mathbf{v}]$,
  split by mass so momentum holds, and at most a tenth of the
  Newtonian pull. On a circular orbit it takes Peters' energy, so a
  pair shrinks at $\dot{a} = -\frac{64}{5} \frac{m_1 m_2 M}{c^5 a^3}$.
  The seed's pair, 2145 units of time from merging alone by Peters,
  lasted 330 to 2000 in five runs headless with the hole's tides and
  the planets: a minute or so at work, its waves chirping, their
  amplitude and frequency rising, until the hole swallows the star, a
  burst. In Gravity it is left out: its dynamics have no $c$, and at
  $c = 11.5$ it would merge the seed's pair in a few units of time. A
  chirp there comes only from orbits the dynamics tighten: a
  compaction, a comet's pass, a merger.
- Drawing, one look a mode, on a grid of cells 32 across the pane's
  shorter side and at least 8 pixels, blurred up to the pane, the
  frame's ground. Gravity: the sum over
  sources of $h_+$ in the plane, + in a cool blue, - in a warm amber.
  Gravity 3D: each source's field on the plane through it that faces
  the camera, in the camera's basis, the line of sight and the
  direction across it in that plane, which is the source's own basis
  where its axis lies in that plane or along the line of sight, never
  singular across the view: $h_+$ in blue and amber, $h_\times$ in teal
  and rose, each as $\tanh$ squared, its sign kept, which leaves the
  faint far field darker than the pair's lobes. A cell reads
  $\ddot{I}$ as its mean over a cell and a half's light time on either
  side, nothing outside a source's samples, so a front or a burst
  thinner than a cell is drawn ramped, not aliased into beads. In
  Gravity the ground is opaque, under everything else. In Gravity 3D
  it lies at its sources' mean depth and is traced as everything else
  is (see 2026-10-17: Gravity 3D's optics).
- Probe: both modes report their sources and, for the pair of shortest
  period, its separation, period, turns and the sign changes of its
  $h_+$ 80 from it, along its axis in Gravity 3D and in its plane in
  Gravity: four a turn at twice its orbital frequency.
- Checked by `test/viz-gravity.test.js`, `test/viz-gravity3d.test.js`
  and `test/viz-waves.test.js`. A circular binary's $\ddot{I}$, in the
  plane and inclined, equals $-2\mu a^2 \Omega^2$ times the cosine and
  sine of $2\Omega t$ to $10^{-9}$, and a lone body moving uniformly
  gives none. Gravity's pair stepped by the mode for 600 units of time
  changes its wave's sign four times a turn, to 0.6. In its plane
  $h_\times$ is nothing and $h_+$ is $2 m_1 m_2/(c^4 a r)$ to 2%. Along
  the axis both are $4 m_1 m_2/(c^4 a r)$, and at 1 rad they are
  $(1 + \cos^2 \iota)/2$ and $\cos \iota$ of it, to 1%. A change at a
  source is nothing at $r$ until $r/c$ after, then all of it. A moving
  source's front is centred where it was sent. The sources' $\ddot{I}$
  sum to the system's, and the filter takes the mean. In Gravity 3D two
  stars of 500 at 100 shrink at Peters' rate to 3% over 540 units of
  time, momentum kept. `scripts/checks/vizmodes.js` fills a 1200 by
  760 window with each mode, waits for the probe's pair to turn three
  times, checks four sign changes a turn to within one, and keeps
  three frames 0.5 s apart, then three more of each mode's small pane
  among the seven.
- Frame rate, under swiftshader on a loaded host, the tree of main and
  this one measured in turn, twice each, by one script that draws each
  mode alone at full activity, 240 frames after 300 of warm-up, then
  runs three panes of a 720 by 460 window all in one mode for five
  rounds. A draw's median cost went from 0.7 to 2.1 ms in Gravity and
  from 3.6 and 3.7 to 5.2 in Gravity 3D at 400 by 380, from 2.7 and 2.9
  to 8.2 and from 7.7 and 7.9 to 11.2 and 12.7 at 1200 by 760, and from
  0.4 and 0.5 to 2.1 and from 3.3 to 4.7 and 5.2 at 360 by 230: the
  field's reads, about 1 ms, and the blur of the grid up to the pane,
  about 2.4 ms at 1200 by 760. Three panes of 240 by 460 ran at a median
  of 16 and 15.5 frames per second in Gravity on main and 15 and 26.5
  here, 14.5 and 13 in Gravity 3D on main and 17 and 22 here: the split
  window holds, the host's load moving the rounds from 10 to 32.5.

Rejected:

- One source at the centre of mass: a tight pair off the centre would
  have its fronts leave the centre.
- The dust displaced by the strain: the strain is transverse, so a
  separation along the line from the source is never strained, and a
  disc about its source does not move.
- The distant stars jittered by the strain: the strain at the camera
  moves the whole sky at once, and shows no front.
- Drawing $r h$, the waveform, to even the far arms: it hides the
  falloff.
- A ring buffer read at one point per sample: a burst one sample long
  drew as beads, one bright cell in two.

## 2026-10-17: Gravity 3D's optics

Owner, issue #170: "the smallest particles appear to be lensed
correctly, but larger bodies disappear from view as they go around the
blackhole, mixing realistic gravitational lensing with unrealistic
gravitational lensing". On a first build that lensed the bodies by
paths of their own: "if an image of a black hole is coming in from
behind a black hole, that image will also be lensed. i don't
understand how you are doing the optics without a generic lensing
rule", and "audit and fix and just use good physics to start".

The optics before (`app/viz/gravity3d.js` at 6ee641f) had no rule.
Stars and dust were moved forward to the two images of the weak-field
point-mass lens, $\theta_\pm = (\beta \pm \sqrt{\beta^2 + 4\theta_E^2})/2$,
used down to the shadow, where the deflection is not $2 r_s/b$ and
diverges at $b_c$. Near alignment a star was stroked as two arcs of a
set half angle. Several holes were applied one after another, each
with its own $\theta_E$ for the source's depth, rather than by the
multi-plane recursion. Bodies, trails, flares and holes were not lensed
at all. Each hole was a painted disc, glow and ring, shifted and
flattened for spin, laid over the layer behind it, so a body or a hole
behind it vanished under paint.

- One rule, in `app/viz/trace.js`: each pixel is a ray traced backward
  from the camera. It is straight but where it crosses a hole's lens
  plane, the plane of the hole's depth across the camera's axis, in the
  order it crosses them. There it turns toward the hole, in the plane
  of its line and the hole, by the exact Schwarzschild deflection
  $\hat\alpha(b)$, $b$ the impact parameter of its line. A ray with
  $b \le b_c = \frac{3\sqrt{3}}{2} r_s$ is captured. For one hole on the
  axis this is the lens equation of Virbhadra and Ellis
  (astro-ph/9904193, eqs. 1 to 3),
  $\tan\beta = \tan\theta - \frac{D_{ds}}{D_s}[\tan\theta + \tan(\hat\alpha - \theta)]$,
  $\sin\theta = b/D_d$, which allows any $\hat\alpha$, loops included.
  For several holes it is the multi-plane recursion (McCully et al.,
  arXiv:1401.0197, eq. 16, after Schneider, Ehlers and Falco eq. 9.7a)
  with the exact $\hat\alpha$: each hole bends the ray where the holes
  before it sent it. A hole seen through a hole, arcs, Einstein rings,
  inner images, the shadow and the photon ring all come of it, and
  nothing of a hole is painted.
- The deflection, tabulated once on load from the exact integral
  $\hat\alpha + \pi = 2\int_0^{1/r_0} du \, [b^{-2} - u^2(1 - r_s u)]^{-1/2}$,
  by adaptive Simpson in $x = u r_0 = 1 - t^2$, which removes the
  endpoint's singularity. It is kept as
  $g(u) = \hat\alpha + \ln(1 - u)$, $u = b_c/b$, at 4096 points: Bozza
  (gr-qc/0208075, eqs. 47 to 50) shows
  $\hat\alpha = -\ln(b/b_c - 1) + \ln[216(7 - 4\sqrt{3})] - \pi + O(b - b_c)$
  for Schwarzschild, so $g$ is smooth up to $u = 1$, where it is his
  $\bar{b} = -0.4002$.
- The scene's sources are drawn flat, as before, on slices of depth:
  the bodies, their trails, the dust and the flares. The slices part at
  each hole's depth, and behind the nearest hole in eight more, even in
  $\sum_h \sqrt{(z - z_h)/z}$ over the holes in front, so that the
  Einstein radii within a slice differ little. Each slice is a plane at
  its content's mean depth. The waves' picture (see 2026-10-16) is a
  plane at its sources' mean depth that emits and hides nothing: it is
  a diagram of the strain on the planes through its sources, so it is
  bent as what else lies there is. The distant stars and the galaxy's
  glow are a cube of directions, built at about the pane's density,
  its faces in steps of 64 pixels so that panes of near sizes share
  it, read along a ray's last direction.
- A ray takes, front to back, the planes it crosses and, unless
  captured, the sky. A colour is taken as found: specific intensity
  is constant along a ray ($I_\nu/\nu^3$, Liouville, as James et al.,
  arXiv:1502.03808, use it, with no frequency shift here), so a lensed
  source is magnified by its area, not brightened. The Doppler beaming
  of the disc's hot grains is their emission's, as before.
- Spin is not in the optics: the light is Schwarzschild's for every
  hole, and nothing paints a shift. A spinning hole's shadow bulges on
  the side moving away and flattens on the side moving toward the
  camera (Bardeen at Les Houches in 1972, as James et al., section
  1.1, recount it), but
  tracing Kerr geodesics per ray, as they do, is beyond the frame's
  cost on a CPU. The spin moves matter, by the Lense-Thirring term,
  and #173 will move the spin.
- What the rule leaves out: it is a thin lens, exact for camera and
  source far from the hole that bends the ray, so matter within a few
  $b$ of a hole, the inner disc, is bent as if its light left the lens
  plane. A slice is one plane, so its content is bent as at its mean
  depth. Matter outside the view is not drawn, so its inner images,
  which would fall inside the view, are missing. The waves' picture is
  a grid of cells about 24 pixels wide blurred up, and where the lens
  magnifies it, near an Einstein ring, the cells show as blocks: the
  ground's own grid, not the lens map, whose interpolation differed
  from a pixel-by-pixel trace of the same scene by 0.4 to 1.3 of 255 on
  the mean.
- Cost. The lens map is traced at nodes 6 pixels apart, and a cell
  whose four corner rays met the same holes in the same order, none
  turned back, all captured or none, takes its rays' crossings and
  places on the sky bilinear from its corners. The light from far
  behind is bent by $\theta_E^2/\theta$, which a line across $S$ pixels
  misses by $S^2 r_s D^2/(2 f b^3)$ pixels, $f$ the focal length in
  pixels, so a cell nearer a hole than the $b$ where that is one pixel,
  or $1.5 b_c$, is traced pixel by pixel. The frame is traced at a
  reduced scale and drawn up to the pane: at most 30000 pixels a pane,
  or 90000 a window when a pane fills more of it. A split window's
  three panes of 240 by 460 trace at 0.52, 126 by 240, and a lone pane
  of 1200 by 760 at 0.314, 377 by 239. That costs the picture its
  sharpness: a star or a grain of 1 pixel spreads over about 2 pixels
  of a split pane and 3 of the full one, so the stars and the dust are
  soft dots and the small bodies blur, the full pane most. The sky's
  black tiles and the slices' empty tiles are skipped.
- Frame rate, under swiftshader on this host. A profile of the draw put
  its time in the trace: the smooth cells' fill, the planes' samples,
  the sky's adds, the rays traced pixel by pixel near the holes and the
  nodes' rays. Three cuts took time from the draw at the same scale: the
  sky's lit tiles read before its add, the waves' ground read from their
  grid instead of blurred onto a canvas and read back whole, and the
  frame drawn straight to the pane instead of through a layer. What is
  left is the trace's own cost per pixel, and the budget fell from 45000
  and 135000 pixels to 30000 and 90000. The trees of 6ee641f, of b43be36
  (the trace before the cuts) and of this one ran in turn, three rounds
  each, each round started at a load under 14, by one script that draws
  the mode alone at full activity, then runs one pane of a 1200 by 760
  window and three panes of a 720 by 460 window, five times 2 s each,
  once the lens record that its state queries start has lapsed: that
  record is a second trace a frame, and an earlier run that timed it put
  three panes now at 23.5 frames per second against 27 on 6ee641f. A
  draw at 400 by 380 cost a median 4.3 to 4.8 ms on 6ee641f, 12.1 to
  12.2 on b43be36, 10.3 to 11.1 after the cuts at the old budget and 8.4
  to 8.8 now. Over 15 times 2 s each, three panes of 240 by 460 ran at a
  median of 30.5 frames per second on 6ee641f, 26 on b43be36 and 25
  after the cuts at the old budget, and in a second run at 28 on
  6ee641f, 27.5 now and 28.5 at 20000 and 60000. One pane of 1200 by 760
  ran at 29, 29.5 and 29.5 in the first run, and at 27.5, 29 and 27 in
  the second. The times of 2 s moved from 13 to 39 frames per second,
  and the rounds' loads ended between 12.7 and 20.4.
- Checked by `test/viz-trace.test.js`: $\hat\alpha$ against Keeton and
  Petters' weak-deflection series (gr-qc/0511019, eqs. 24 and 25, six
  terms) to $2 \times 10^{-5}$ at 50, 200 and 1000 $m$, against Iyer and
  Petters' closed form (gr-qc/0611086, eq. 8) by Carlson's $R_F$ to
  $2 \times 10^{-5}$ for $r_0$ from 3.2 to 30 $m$, and against Bozza's
  limit to $2 \times 10^{-3}$ at $b/b_c - 1$ of $10^{-4}$ to $10^{-6}$,
  with his figure that the limit is off by about 0.06% where
  $\hat\alpha$ falls below $2\pi$ (0.04 to 0.08% here). The shadow's
  edge falls at $\sin\theta = b_c/D$ to $10^{-9}$ rad, and a ray just
  outside it turns by more than $2\pi$. One hole meets the
  Virbhadra-Ellis equation to $10^{-5}$. A dot behind a hole in the
  weak field draws a ring all round at
  $\theta_E^2 = 2 r_s D_{ls}/(D_l D_s)$, its mean radius to 1%. Two
  holes meet the recursion by hand to 1% of a bend of 15 or more,
  where composing them at the source's depth is off by far more. A ray
  turned back by one hole is bent by another it then meets, at the
  impact parameter of its outgoing line. A uniform sky is seen
  unchanged outside the shadow and black within. Each test was seen to
  fail with its behaviour removed: the table replaced by $2 r_s/b$,
  capture removed, the bend removed, each hole's $b$ taken from the
  unbent ray.
- `scripts/checks/vizlens.js`, in a full pane and a small one. A smoke
  pass of the running mode reads the slice audit of each frame and
  judges no lensing. Every judged frame is of a scene the check stages
  and the mode holds still (gravity3d stage, reached only through
  window.vizStage): no event, step or turn of the camera moves it, and
  it holds a hole of 900 at the centre, the thing judged, and grains
  before and behind the hole, a planet with a trail and a flare behind
  it, so every frame paints every class. A moon of 4, 250 beyond the
  hole, at u of 0.12, 0.25 and 0.36, wholly within the shadow, glow and
  all, so that a straight ray would hide it, its disc a radius of 1
  traced pixel or more: the mode draws that frame again without it and
  picks points where the two whole frames differ by 16 in a channel or
  more, outside the shadow and nearer the hole than any other, after
  everything nearer is drawn, and the pane's canvas is read there
  against the control: the moon is seen. At 40, the first threshold, a
  body far behind the hole, dimmed by its fog, lifted its image by 31 to
  39 on a lit ground and was counted unseen. In the full pane the outer
  image spreads across the line to the hole more than 1.5 times as far
  as along it. A hole of 200, 280 beyond the central one, at u of 0.06,
  0.12 and 0.18, is seen the same way, against a control traced without
  it. At every frame read, each grain, body, trail piece and flare is
  counted where it is painted, on the slice that holds its depth. Each
  fails with its behaviour removed: with the bend removed, "the body
  behind the hole is hidden", with the dust, the bodies, the trails or
  the flares listed on the nearest slice, or the dust painted on the
  farthest, "off the slices of their depths", and with the least disc
  made too large to meet, "the staged frame was not judged". The checks
  judged a live, random run before: a moon that took in a star kept its
  number, a second hole lensed the moon into its outer image, a hole
  merged before it was seen.

Rejected:

- Lensing each class by a path of its own (the first build of #170:
  analytic images for grains, a resampled sprite or a Jacobian for
  bodies, a painted shadow over them): the image of a thing depended
  on what it was, and a hole behind a hole was hidden under paint.
- Turning the ray about the hole onto its outgoing asymptote: exact
  for light that leaves the hole far behind, but off the lens equation
  for matter a few $b$ behind it. For a hole of $r_s = 13.6$ at 620 and
  a plane 120 behind it, a ray at $\theta_E$ met the plane 0.42
  $\theta_E$ from where the Virbhadra-Ellis equation puts it.
- The waves' picture as light at infinity, behind everything: the hole
  pulled its far field into rings that filled the frame, far from
  where the picture is drawn.
- A ray per pixel at full scale: in Node, on the host at a load of 19,
  the trace alone took 11 ms for a pane of 240 by 460 past one hole and
  27 ms past three, and 98 and 218 ms at 1200 by 760, before any
  sampling.
- Refining a cell near a hole at nodes 2 pixels apart, its bref
  scaled as $S^{2/3}$, before tracing what is left pixel by pixel: in
  Node, on the frame of a pane of 240 by 460, it cut the pixels traced one by one
  from 2196 to 632, and the render's time went from 3.66 to 3.71 ms,
  the new nodes' rays costing what the pixels' had.
- WebGL: the mode would take one of the eight contexts.
- Kerr geodesics per ray: see the spin, above.

## 2026-10-17: Quantum play

Owner, 2026-10-17: "creatively improve the interactivity of the quantum
visualizer, and to add maybe particles of various wavelengths
interacting instead of just one particle of one wavelength, and
procedurally generated walls of potential instead of always using the
same 2 apertures". The design is the builder's.

- The model: the Gross-Pitaevskii equation, $i\,\partial_t\psi =
  -\tfrac12\nabla^2\psi + (V + U(\rho))\psi$ with $\rho = |\psi|^2$,
  $\hbar = m = 1$, the mean-field equation of a repulsive condensate,
  so packets push on one another where they overlap, and a dense
  packet spreads faster than a free one. The plain Schroedinger
  equation superposes packets without any interaction. The term is
  saturable, $U = g\rho / (1 + \rho/\rho_s)$ with $g = 25$ and $\rho_s
  = 0.02$, so it never passes $0.5$ and the phase it adds in a half
  step stays small: at a fired packet's peak density of about $0.004$
  it is $0.08$, at a thrown packet's $0.01$ it is $0.17$, at a
  collapsed packet's $0.04$ it is $0.33$, against packet energies
  $k^2/2$ of $0.1$ to $2$. The step is split-step Fourier as before,
  the half steps of $V + U$ reading $U$ from the density they act on,
  each factor a phase, so the step is unitary, which
  `test/viz-modes.test.js` holds to $10^{-9}$ with the term on, and
  the same test sees a packet's variance grow more than 1.5 times
  faster with the term than without. The norm leaves through the
  absorbing mask at the edges, strongest at the left where reflected
  packets go, and through the screen. Not unitary, and said in the
  file's header: a measurement, which projects and rescales to the
  norm before, and the cap that rescales the state when its norm
  passes 3, which also lowers $U$. $U$ is applied from a table of
  1024 phases over $[0, g\rho_s]$, and skipped where $\rho < 2\times
  10^{-5}$.
- The wavelengths: a tool call fires a packet of its class's
  wavenumber, 0.5, 0.75, 1, 1.25, 1.5 or 1.75 by class 0 to 5, a
  prompt 1, a subagent two at once of 0.75 and 1.5, an output event
  0.6 to 1.5 by the bass, and a throw 0.4 to 2 by the drag's length.
  The drawing makes them readable: the hue at a point is the local
  wavenumber, the phase difference to the next point along $x$ and
  along $y$, on a spectral scale from red at 0.4 through yellow, green
  and blue to violet at 2, the brightness is the amplitude, dimmed
  where the local wavenumber is under 0.4, a wave at rest or standing,
  and the phase itself modulates the brightness, so a red packet
  carries wide stripes and a violet one narrow. A point whose phase
  flips between neighbours, a node of a standing wave or of the beat
  of two packets, is drawn dark grey. A collapsed packet, at rest,
  starts red and spreads into rings from red at its centre to violet
  at its edge, the condensate's expansion.
- The walls: `wallgen(seed)` in `quantum.js`, a pure function of the
  seed through a mulberry32 generator, replaces the table of four
  layouts. The family is the seed modulo six, so consecutive prompts
  walk through slits (one to four, random centres and widths), a
  grating (pitch 6 to 12, half the time a second grating half a pitch
  over, a Talbot carpet), discs (two to five, a fifth of them wells),
  a cavity (two thin walls 10 to 24 apart, each 0.6 to 1.6 high, so
  each is half-silvered to the packets, sometimes with a slit), blocks
  (four to eight), and wells (a lens, a parabolic well 8 to 13 wide
  that focuses, a guide along $x$, or both), and the rest is drawn
  from the seed, with one or two discs added a third of the time.
  Heights are 0.5 to 1.8 three times in four and 2 to 3 otherwise,
  against the packets' energies of 0.1 to 2, so a slow red packet
  reflects where a fast violet one passes, and a wall of 3 stops
  everything. Wells go to $-1.2$. The wall lies in columns 34 to 109,
  clear of the firing point at 16 to 24, the screen at 114 and the
  absorber's rows, which the unit test holds for seeds 1 to 24 with
  the determinism and the bounds. A prompt takes the next seed. The
  wall is drawn in blue-grey, brighter the taller, wells in
  purple-blue, deeper the darker.
- The pointer, three gestures told apart by the press: a press moved 6
  pixels before a quarter second passes is a throw, its aim drawn from
  the press as a line in the colour of the wavenumber it will throw,
  with a ring at the press, and the release fires a packet 4 points
  wide from the press along the drag, $k = 0.4 + L/20$ for a drag of
  $L$ grid points, capped at 2. A press held still a quarter second
  arms the brush, an amber ring that closes on the pointer as the hold
  runs, and then paints the barrier of 2026-10-15 along its path. A
  press released before either is a click, a soft measurement of the
  position: the window $w = e^{-r^2/2R^2}$, $R = 5$ points, and its
  complement $\sqrt{1 - w^2}$ are the two outcomes' operators of an
  unsharp position measurement, the first drawn with the probability
  $\langle\psi|w^2|\psi\rangle / \langle\psi|\psi\rangle$. Found, the
  state collapses into the window and a white ring flashes out. Not
  found, the window is carved out of the wave and a blue ring marks the
  miss. A click with no wave to measure drops a packet at rest, which
  the mean-field term then spreads. The probe reports `presses`,
  `strokes`, `throws`, `pokes`, `catches`, the barrier's height and
  cells, and the wall's `seed` and `family`. `vizpointer.js` holds a
  press 400 ms before its drag and wants one stroke and a barrier of
  40 cells, then an immediate drag for one throw and no stroke, then a
  click for one measurement, and the fade as before. `vizmenu.js` reads
  `presses` where it read `strokes`.
- Cost, under swiftshader on this host: a frame of Quantum alone on a
  400 by 380 canvas at full activity costs a median 3.0 ms, p90 4.0,
  at load average 15 to 17, against 2.2 and 3.5 before the change at
  load average 8 to 10, measured by the method of `vizcarbon.js`. The
  extra is the two `atan2` per lit point of the hue and the mean-field
  pass. The grid and the FFT are unchanged. `vizmodes.js` ran three
  panes of Gravity, Gravity 3D and Quantum at 19.5, 20, 22, 15 and
  25.5 frames a second over its five rounds, median 20, at load
  average 15 to 32, and the host's load sets that more than the mode.

| Signal | Quantum |
| --- | --- |
| prompt | the next seed's wall, and a packet of $k = 1$ |
| tool call | a packet of the class's wavenumber, 0.5 to 1.75, red to violet |
| subagent | two packets at once, $k$ 0.75 and 1.5, the fast one leading |
| output event | a packet of $k$ 0.6 to 1.5 by the bass |
| bass, busy | the clock: steps a second |
| stop, compaction | a measurement: the state collapses to a narrow packet that spreads into rings |
| idle | the wall fades into a harmonic trap holding a packet set circling in it, which breathes under the term |
| drag | a throw along the drag, its wavelength by the drag's length |
| hold, then drag | an amber barrier along the path |
| click | a soft measurement under the click: a catch and a white ring, or a carved hole and a blue ring |

Rejected:

- Several species on separate grids coupled through their densities:
  twice the transforms a step for an interaction the one-field term
  already shows, and a packet's species would have to be drawn by a
  colour the local wavenumber already gives.
- A focusing term, $g < 0$: in two dimensions a dense enough packet
  collapses, and the saturation that would hold it is the same
  switch a repulsive term needs for nothing.
- The hue as the phase, as before: it showed the stripes but no
  wavelength as a colour, and two packets of different wavelength read
  as one rainbow.
- A click that drops a barrier, as before: the measurement is the
  interaction a wave function has and nothing else offers, and the
  brush keeps the barrier.
