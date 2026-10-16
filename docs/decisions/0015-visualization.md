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
(issue #144).

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
    rates setting the clock. Gravity 3D: Gravity's bodies in three
    dimensions with black holes, spinning ones among them, before
    distant stars they lens (see 2026-10-15: Gravity 3D). Quantum: the
    Schroedinger equation by split-step Fourier on a 128 by 64 grid,
    packets through slits onto a screen that records detections, a stop
    measuring and collapsing the state. Carbon: the neutral carbon atom
    on NIST's levels and lines, a side-on view of its electron density
    in three dimensions beside its level diagram and spectrum, the
    session's events exciting it and its photons leaving by NIST's
    branching ratios (see 2026-10-15: Carbon). With the sound output alone,
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
  - Gravity 3D: a drag turns the camera, a click throws a moon (see
    2026-10-15: Gravity 3D).
  - Carbon: a drag turns the camera, a click on the atom absorbs a
    photon from the present level, a click on the level diagram excites
    the level under it by a collision (see 2026-10-15: Carbon).
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
- Capture: a body whose centre crosses $r_+$ is swallowed, its mass,
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
  equator between 3.3 and 8 $r_s$, a companion star of 80 at 175 and
  three planets. Within 10 $r_s$ of a hole and outside $3 r_s$, the
  disc's viscosity relaxes a grain's velocity, at a rate of 0.01 per
  unit of time, toward 99.5% of the circular velocity in the plane of
  its orbit: grains settle on circles, spiral to the last stable orbit
  and plunge. The star nearest a hole sheds grains from the point
  between them where the pulls balance, L1, at 1.1 to 1.45 times its
  own angular speed: a stream that feeds the disc.
- Drawing: the camera, 620 from the centre of mass with a half view
  angle of 0.42 rad, turns about it. Bodies, grains and trails fall
  into layers between the holes' depths, so a hole's shadow hides what
  lies behind it, and bodies are sized and dimmed with distance. A
  trail is the places a body passed, kept every 1.5 units of time or 4
  of travel and projected each frame. Matter at $d$ from a hole heats
  as $\min(1, (2.3 r_s/d)^2)$, toward orange, white and then blue
  white, larger and brighter, a hot grain beamed by
  $(1 + 0.6 v_\parallel/c)^2$ toward the camera. Merger rings and the
  idle dimming are the Gravity mode's.
- A hole is drawn as its shadow, black, of radius
  $\frac{\sqrt{27}}{2} r_s \approx 2.6 r_s$, the image of its photon
  sphere at $1.5 r_s$, ringed by its photon ring over a soft glow. The
  ring brightens as the hole swallows. A spinning hole's shadow is
  flattened on its approaching side by $0.22 \chi \sin i$ and shifted
  toward its receding side by $2a \sin i$, $i$ the angle between the
  spin and the line of sight.
- Background: 3000 stars at infinity, a third of them in a band about
  a great circle, a galaxy's disc seen from inside, under 120 soft dots
  of its glow, warm toward one point. They are directions, turned with
  the camera and never moved by it, so they show no parallax, in the
  foreground's hues. Six bright ones lie on the circle that the line
  from the camera through the centre sweeps at the camera's first
  height, so a hole lines up with one now and then.
- Lensing, per star on the CPU: the point-mass lens of Einstein angle
  $\theta_E^2 = 2 r_s (D_s - D_l)/(D_l D_s)$, $2 r_s/D_l$ for a star at
  infinity. A star at $\beta$ from a hole has its images at
  $\theta_\pm = (\beta \pm \sqrt{\beta^2 + 4\theta_E^2})/2$, the outer
  brightened by its magnification, the inner drawn above 2%. Within
  $0.3 \theta_E$ both images are arcs, as a disc of radius
  $0.05 \theta_E$ would make, and within $0.05 \theta_E$ an Einstein
  ring. Dust behind a hole is lensed the same way, so the disc's far
  side bends over the shadow. Bodies and trails are not.
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
- Frame rate: under swiftshader, three panes of a 720 by 460 window all
  in one mode, each mode in turn for five rounds and counted as
  `vizmodes.js` counts its sets, ran at a median of 46 frames per second
  in Gravity 3D and 43.5 in Gravity. `vizmodes.js` itself gave 35.5 for
  Gravity, Gravity 3D and Quantum together, 47 for Fern, Go and Zoom out
  and 40 for three butterchurn presets. Each soft dot of glow is drawn
  from a canvas of the CPU: one on the GPU, drawn onto the CPU's layer,
  is read back at every draw, and that alone held three panes to about
  15.

Rejected:

- Lensing per pixel: a ray traced per pixel on the CPU is far too slow,
  and on WebGL the mode would take one of the eight contexts.
- Geodesics of the Kerr metric: the pseudo-Newtonian potential and the
  Lense-Thirring term keep the known radii and the frame dragging at a
  fraction of the cost.
- Lensing the bodies and their trails: a trail's places bent near the
  Einstein ring drew zigzags, and a body apart from its trail.

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
from `docs/research/carbon-atom.md` and its data, and for the photon
from `docs/research/carbon-photon.md`.

Interim: the owner is reshaping the mode's dynamics (the clock of the
events, the cloud's rendering and the photon's). Each sits behind a
small interface in `carbon.js`, `Clock`, `Cloud` and `Photon`, and the
bullets on them below describe what is built now.

- Carbon is a mode of its own, after Quantum in `modes.js`, drawn by
  `app/viz/carbon.js` on a canvas of the CPU as the other procedural
  modes are. Its data is `app/viz/carbon-data.js`, written by
  `scripts/research/carbon_slim.js` from
  `docs/research/carbon-atom-data.json`: the 68 levels, all 559 lines,
  the Rydberg ladders, the outer-electron model and the Bunge 1993 basis.
  `test/viz-carbon.test.js` rewrites it and fails if the file differs,
  and checks it against the research data: every energy, $A$ and
  branching ratio, the Ritz wavelengths $10^7/(E_k - E_i)$ against
  NIST's within $2\times10^{-7}$, each level's branches summing to 1 and
  $1/\sum A$ its lifetime, every level reaching the ground term by listed
  decays.
- Sources: NIST ASD 5.12 (Kramida, Ralchenko, Reader and NIST ASD Team
  2024) for the levels, lines, $A$ and branching, Haris and Kramida 2017
  for the ionization limit, Bunge, Barrientos and Bunge 1993 for the
  ground orbitals, CIE 1931 and CSS Color 4 for the visible lines'
  colours, as the research cites them. The photon: Scully and Zubairy
  ch. 6, Berman, Kuzmich and Milonni 2025, and Jackson ch. 9, as
  `carbon-photon.md` cites them.
- The pane: the atom on the left, the level diagram on the right (below
  in a tall pane), the spectrum along the bottom, the last jump's
  caption at the top beside the drop-down.
- The atom: a side-on view in three dimensions, its camera turning
  slowly about the vertical. Its density is points drawn from the
  orientation-summed density, round: each electron's radius from an
  inverse-CDF table of $P(r)^2$ built once per orbital, its direction
  uniform. $2s^2 2p^2$: Bunge's 1s, 2s and 2p. $2s2p^3$: one 2s electron
  in 2p, in the same orbitals, an approximation. $2s^2 2p\,nl$: the
  1s2 2s2 2p core and one outer electron of the research's
  quantum-defect model, drawn in amber and labelled a model with its
  mean radius. A jump replaces the cloud at once. 1.2 % of the points
  are drawn afresh each 60th of a second: samples of where the electron would be
  found, none of them moving. The view eases to 2.5 times the widest
  orbital's mean radius, at least 5 bohr, with a scale bar in bohr and
  nm, so an excited atom's growth shows as the core shrinking under a
  scale that reads larger.
- The level diagram: every level at its energy, 0 to the C II limit
  $90\,820.348\ \mathrm{cm^{-1}}$ dashed at the top, in five columns,
  singlet and triplet by parity and the quintet. The Rydberg ladders
  of $2pnp\,{}^3D_3$ and $2pnd\,{}^3F^o_4$ are faint ticks toward the
  limit. The present level is lit and named. The last jump is an arrow
  in its light's colour, or grey and dashed outside 380 to 780 nm, with
  its wavelength. The ground term's fine structure is an inset,
  magnified, its present $J$ lit.
- The spectrum: a log wavelength axis from 110 nm to 10 $\mu$m, every
  line a faint tick in its colour or grey, the visible band marked, and
  an off-scale bin for the ground term's three lines at 230 to 609
  $\mu$m. A line flashes when one of its photons is detected and keeps
  a bar that grows as the square root of its count. No gradient is
  drawn for the band: the CIE table is not in the repository, and each
  line carries its own colour.
- The clock (research section 10, question 1): an allowed decay's
  lifetime times $2\times10^7$, a slower one at its real lifetime up to
  8 s, each wait drawn from the exponential about that mean. The pane
  prints the real $\tau$, the factor or the cap, and the time to the
  next jump. A $2p3s$ level waits 58 ms, a $2p4p$ one 2.8 to 4.9 s,
  $2s2p^3\,{}^5S^o_2$ 33 ms and ${}^1S_0$ 1.66 s as they are, and
  ${}^1D_2$ 8 s against its 57 min.
- The ground term rests (question 6): a cascade stops on the $J$ it
  reached, and the ${}^3P_{1,2}$ M1 decays of 44 and 146 days are not
  run. A cap of 8 s on them would walk every cascade to ${}^3P_0$ in
  16 s, which the answer forbids.
- Colour (questions 2 and 3): a visible photon at full brightness in
  its line's colour from the data, a line outside the visible grey and
  dashed with its wavelength and band printed.
- Questions 7 to 9, the builder's: a signal excites by collision or by
  a photon absorbed from the present level, as the table says. The
  slim file holds all 559 lines, 96 kB, so no branching ratio is
  renormalized.
- The photon, by `carbon-photon.md` section 4, in place of the owner's
  first ruling of a photon from a point S toward a point F, which that
  research finds has no basis: at a jump the source region, the
  transition density $\psi_f^*\psi_i$ of the one electron the line
  moves, drawn as points at the atom's scale for 1.1 s, in the line's
  colour where positive and blue grey where negative, labelled. Its
  radial part is an inverse-CDF table of $|P_f P_i|$, its angular part
  $P_{l}^{|m|}(\cos\theta)\,P_{l'}^{|m'|}(\cos\theta)\cos(q\varphi)$,
  the real part at one instant, by rejection. A jump of two electrons,
  $2s^2 2p\,nl$ to or from $2s2p^3$, which only configuration mixing
  allows, draws no source and says so. Then the shell: a sphere about
  the atom, its front and four wavefronts behind it as points, each
  point's brightness the radiation pattern of one $M$ component about
  the atom's $z$ axis, drawn dashed and labelled "chosen" while a
  photon flies. The component $q = \Delta M$ is drawn at random, each of
  a multipole's components carrying an equal share, so the sum is the
  isotropic emission of an unoriented atom: E1 and M1 $\sin^2\Theta$
  for 0 and $(1 + \cos^2\Theta)/2$ for $\pm1$, E2 $\sin^2\Theta\cos^2\Theta$,
  $1 - 3\cos^2\Theta + 4\cos^4\Theta$ and $1 - \cos^4\Theta$ for 0,
  $\pm1$ and $\pm2$. The pane names the component and its pattern. A
  photon outside the visible draws its shell grey, broken into dashes.
  The shell reaches the pane's nearest edge in 1.5 s. There it is
  detected: it collapses to one point, in a direction drawn from the
  pattern, and the spectrum lights the line then, not at the jump.
- Scales the pane states: the wavelength against the atom, for
  example "538.0 nm = 699 x this atom" for $2p4p\,{}^1P_1$, whose outer
  electron's mean radius is 14.55 bohr, and that the wavefront spacing,
  the shell's thickness and its speed are symbols. The spacing grows as
  $\lambda^{0.35}$, 4.5 pixels at 119 nm.
- Checked by `scripts/checks/vizcarbon.js`: one pane watched by its
  probe through the fake session's turns, a frame each of a visible
  photon's source and shell, its detection, a photon outside the
  visible and the spectrum after, then the frame rate below.
  `vizmodes.js` captures Carbon in its phases with the other procedural
  modes, `vizpointer.js` clicks it.
- Frame rate, under swiftshader on a loaded host (load average 30 to
  37 on 16 cores): drawn alone on a 400 by 380 canvas, a frame of Carbon
  costs a median 3.2 ms, Gravity 0.7 and Quantum 1.1. Three panes of a
  720 by 460 window all in one mode, five rounds in turn, ran at a
  median of 20 frames per second in Carbon, 21 in Gravity and 19.5 in
  Quantum. `vizmodes.js` gave 10.5 for Carbon, Fern and Go together,
  15.5 for Fern, Go and Zoom out and 14.5 for Gravity, Gravity 3D and
  Quantum.

| Signal | Carbon |
| --- | --- |
| prompt | an electron collision lifts the atom to a $2p4d$ or $2p5s$ level, by statistical weight $g$: the longest cascades, the red lines and the 119 nm VUV |
| stop | an electron collision onto a $2p4p$ level, by $g$: the blue, cyan, green and yellow lines, which no photon from the ground term can reach (even parity) |
| tool call | a photon absorbed from the present level, by the E1 rule: the lines up from it, sorted by the upper level's energy and cut in five bands, read, edit, shell, web and agent taking the first to the fifth, other any. Within a band a line by $f_{ik}\lambda$, a lamp of flat spectral energy density. Nothing, and the pane says so, when no E1 line leads up |
| subagent | a spin-exchange collision onto $2s2p^3\,{}^5S^o_2$, which no cascade reaches: the 296.5 and 296.7 nm intercombination lines after a real 33 ms |
| output event | in the ground term, a thermal collision: $J$ drawn by Boltzmann's populations at 300 K, $g_J e^{-E_J/kT}$, 0.128 : 0.354 : 0.518, seen in the inset. Nothing while excited |
| compaction | a superelastic collision quenches the atom to the ground term, $J$ as above, without light |
| idle | no excitation: the cascade runs down to the ground term and rests, the camera slows, the cloud dims |
| sound output alone | its rises count as output events |
| drag on the atom | turns the camera, which holds 4 s |
| click on the atom | a lamp: a photon absorbed from the present level, any band |
| click on the level diagram | an electron collision onto the level nearest the click in that column, any level, spin and parity |

Rejected:

- A photon from a point S sampled from the upper density toward a point
  F from the lower, the owner's first ruling: `carbon-photon.md` finds no
  basis for it, and its section 4 replaces it.
- One $M_L$ component of the cloud (question 4): a free atom has no
  axis, so the cloud is round, and only the photon's component, drawn
  for its pattern, takes the chosen axis.
- A gradient for the visible band: no source in the repository.
