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
(issue #158) and for its flashes and its slowed clocks (issues #164
and #166), and 2026-10-18 for its field's calibration (issue #169) and its
photons at their true scale (issue #167), and 2026-10-22 for its
invisible fronts on a grid (issue #168) and its cloud as a flow (issue
#165), and for the gravitational waves of the Gravity modes
(issue #163), and 2026-10-17 for Gravity 3D's optics (issue #170) and
for Quantum play (owner: "creatively
improve the interactivity of the quantum visualizer, and to add maybe
particles of various wavelengths interacting instead of just one
particle of one wavelength, and procedurally generated walls of
potential instead of always using the same 2 apertures"), and
2026-10-22 for the Savannah hunt mode and the flocking core it shares
with the flocking modes to come (issue #186), for the Murmuration
mode (issue #187), and for the Sunset clouds mode (issue #189).

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
- Modes: twenty-one, listed once in `app/viz/modes.js`, which the main process
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
  - Fern, Go, Zoom out, Gravity, Gravity 3D, Quantum, Carbon, Savannah
    hunt, Murmuration and Sunset clouds: the project's
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
    spectrum (see 2026-10-15: Carbon). Savannah hunt: a herd of
    wildebeest and zebra on a dry plain, seen from a helicopter, run
    down by a cheetah, a pride of lions or a pack of wild dogs, the herd
    and the predators steered by the flocking core `app/viz/flock.js`
    (see 2026-10-22: Savannah hunt). Murmuration: a murmuration of
    starlings over a clearing in a forest, seen from the forest floor
    looking up through the canopy, folding and turning as falcons dive
    at it, by the same core in three dimensions (see 2026-10-22:
    Murmuration). Bait ball: a school of sardines in open water, seen
    by a scuba diver below it, packing into a ball, splitting and
    reforming as dolphins, a shark, sailfish and gannets hunt it, by
    the same core (see 2026-10-22: Bait ball).
    Sunset clouds: cumulus over the plains of the US Southwest as the sun sets, in watercolour after
    Georgia O'Keeffe, each cloud a volume lit through by the low sun
    (see 2026-10-22: Sunset clouds). With the sound output alone,
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
  - Savannah hunt: a drag moves the helicopter over the plain, and it
    drifts back to the herd after the release. A click: a cheetah
    breaks cover where it lands and sprints at the nearest animal (see
    2026-10-22: Savannah hunt).
  - Murmuration: a drag holds a hawk's lure under the pointer, at the
    flock's distance, and the starlings shy from it, a hole following
    the pointer through the flock. A click: a peregrine stoops on the
    bird nearest it (see 2026-10-22: Murmuration).
  - Bait ball: a drag turns the diver's gaze, which eases back to the
    school after the release. A click: a shark cuts through the school
    at the fish nearest it (see 2026-10-22: Bait ball).
  - Sunset clouds: a drag blows the clouds under it along, and they
    keep a little way on after the release. A click in the sky raises
    a cloud there, a click on the land drops clean water on it (see
    2026-10-22: Sunset clouds).
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
so a procedural mode never takes it for one. A flyout keeps the drop-down short: twenty-one more
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
- Drawing: the camera, 620 from the heaviest hole with a half view
  angle of 0.42 rad, turns about it (see 2026-10-18: Gravity 3D's
  centre). Bodies, grains and trails are
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
  under it, on the plane through the heaviest hole facing the camera, on a
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
- The event clock: every NIST rate divided by $5\times10^6$, one factor,
  so the ratios between levels stay true (see 2026-10-16: Carbon's
  flashes and its clocks, which slowed it from $10^6$). A $2p3s$ level
  waits 13.6 to 14.4 ms on screen, a $2p4p$ one 0.37 to 1.22 s. Each atom jumps by Monte Carlo,
  Gillespie's method over each frame: its decay at $1/\tau$ competing
  with the field, a jump at a random time, instant, a quantum trajectory
  (the Monte Carlo wave-function method of Dalibard, Castin and Molmer,
  1992, as the Phase 2 plan page names it). The pane
  prints the real $\tau$ and the screen's.
- The energy field: the session's activity, $0.45$ busy $+ 0.35$ output
  $+ 0.2$ token rate, nothing while idle, drives electron collisions at
  up to 0.24 a second per atom into any radiating level above the
  present one, by statistical weight $g$, as a hot discharge does, its
  Boltzmann factors flat. Weighted by $e^{-\Delta E/kT}$ at a cool
  discharge's temperature, the collisions would fill $^1D_2$, $^1S_0$ and
  $^5S^o_2$, which radiate nothing on this clock. The rate is
  $1.2\times10^6/E$ for an event clock of $E$, so it keeps its place
  below the slowest allowed decay, $2p4p\,{}^3D$ at 0.82 a second on
  screen, $3.4$ times faster, and the visible lines still leave. At
  full activity the ensemble gave a mean of 70 photons a second and 154
  fronts at once (scripts/checks/vizflash.js).
- Under one factor the forbidden lines (462 nm, 873 nm, 981 to 985 nm,
  the far infrared) and the $^5S^o_2$ intercombination lines are never
  emitted: $^1D_2$ waits $3.4\times10^9$ s. The field lifts atoms out of
  those levels, as collisions do in a real discharge. An idle ensemble
  rests in the ground configuration's terms, $^3P$, $^1D$ or $^1S$, and
  in $^3P$ on the $J$ its cascade reached (question 6). This replaces
  the earlier cap of 8 s on the forbidden waits.
- The light clock: light at $c/(5\times10^{17})$, 0.5996 nm a second,
  11.33 bohr a second on screen, so a front crosses a $2p4p$ cloud's
  diameter, 1.54 nm, in about 2.6 s, and the view's radius in 2.1 s. The view is fixed at 24 bohr so every
  front keeps that pace: an excited atom fills it, the ground atom is its
  bright core. The pane states both clocks.
- The cloud (question 4, revised): particles of $|\psi|^2$ for the
  drawn atom's $M_L$ about the chosen axis $z$, which flow by Nelson's
  stochastic mechanics (see 2026-10-22: Carbon's cloud as a flow, which
  replaced the Monte Carlo stippling and its seethe). Each subshell with
  an entry in the research's Clebsch-Gordan table gives each particle
  its $m$ by $n_m$ and its density in direction $|Y_{lm}|^2$, its radius
  the orbital's. $2s2p^3$ has no entry and is drawn round. A particle of
  $m \ne 0$ turns about $z$ at Madelung's $m/\rho^2$ in atomic units on
  the light clock, $12.09$ s on screen per atomic unit of time, at
  most 0.6 rad/s near the axis, where the density of $m \ne 0$
  vanishes: the clip is $3\times10^{17}/L$ rad/s, so it keeps its radius
  for a light clock of $L$.
  A collision draws the atom's $M_L$ anew. A jump of component $q$ takes
  $M_L$ to $M_L - q$, $q$ drawn by the squared Clebsch-Gordan
  coefficient (see 2026-10-16: Carbon in a magnetic field, which
  replaces the uniform draw). The core is Bunge's, the outer electron the
  quantum-defect model, drawn in amber and labelled a model.
- The jump, by `carbon-photon.md` section 4: the drawn atom's
  particles move to the lower level's density over 1 s (see 2026-10-22:
  Carbon's cloud as a flow, which replaced the snap), and for 0.4 s of
  wall time its transition density $\psi_f^*\psi_i$, of the one
  electron the line moves, flashes as the source on that electron's
  particles, mint where positive, pink where negative, labelled. A jump of
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
  sphere as the packet's leading edge and a trail inside it,
  $\lambda/10^4$ long, with no crest (see 2026-10-18: Carbon's photons
  at their true scale, which replaced the symbolic crests). Ultraviolet
  fronts sharpen the picture and lift its contrast across that trail.
  Infrared fronts refract it, shifting pixels along the radius by one
  lobe across it, heat haze. Both are one pass over the atom's pixels: every
  front adds to tables by integer radius and pattern kind, and a pixel
  takes its radius's tables times each kind's shape in its direction,
  radii with no front skipped. A faint grid in bohr lies under the atom
  for them to act on, since on black they would show nothing (see
  2026-10-22: Carbon's invisible fronts on a grid, which replaced the
  random grain).
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
| busy, output, token rate | the field: collisions at up to 0.24 a second per atom into any radiating level above, by $g$ |
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
  2022), divided by the event clock's $5\times10^6$: 2.80 Hz on screen per mT
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
  $B$ starts at 0.15 mT at 60 degrees, so the mode precesses unasked
  (0.30 mT until #169's calibration, 2026-10-18 below).
  $B$ lies in the $x$-$z$ plane: every excitation here is round about
  $z$, so $B$'s azimuth about $z$ changes nothing. The 3D view draws $B$
  as a violet axis through the atom with its arrow and name. A small
  pane keeps the dial and writes no text over its atom: the field and
  the drawn atom's rate go with the ensemble's caption above it.
- The pane states the field ("B 0.15 mT at 60 deg to z, in the x-z
  plane"), the drawn atom's rate on screen and its real value ("turns
  about B at 0.630 Hz on screen, 3.15 MHz real"), and its $g_J$ marked
  measured or "LS: a model". With $B$ along $z$ it says that an $M$
  state about $B$ is stationary and nothing turns, with $B$ at 0 that
  nothing precesses, and at $J = 0$ that the level has no moment.
- The pulse: a click on the pulse button. A pulse of light linearly
  polarized along $z$ lifts every atom in the ground term ${}^3P$ by two
  photons to $2p4p\,{}^3P_2$ at one instant, each in $M_L = 0$ about $z$
  and its axis $z$: a model of the alignment such a pulse makes, at its
  largest. ${}^3P_2$ is spin-allowed from the ground term, keeps 703 ms
  on screen, about 1.5 Larmor turns at 0.5 mT, and has a visible line,
  477.2 nm, the filter's.
- The beat (the issue's second question, how it is drawn): a detector
  along $y$, perpendicular to $z$ and to $B$, where an aligned atom's
  beat is deepest, drawn as a small square where $y$ meets the circle
  on which fronts are detected, and named. It counts the 477.2 nm line
  of $2p4p\,{}^3P_2$ through a filter, as a quantum-beat experiment
  watches one line. Its rate is drawn as a trace of the last 5 s
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
  pattern is even in $\Theta$: 4.20 Hz on screen at 0.5 mT. The trace
  marks the pulse in violet and says "pulse: beat at 2f = 4.20 Hz";
  without a pulse in the last 5 s it says "no pulse: M incoherent,
  no beat". The trace needs an atom 260 pixels wide and 200 tall at
  text size 1, and a smaller atom keeps the pulse button and the dial.
- Checked by `scripts/checks/vizzeeman.js`, a suite job, on the fakes:
  the drawn atom's axis read over time with $B$ set at 90 degrees by a
  drag on the dial, the angle it turns about $B$ between readings at one
  level against $2\pi g_J\mu_B B/h/E$ times the time between them, $E$
  the event clock's factor read from the mode,
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
  or 90000 a window when a pane fills more of it, by default (the
  setting of 2026-10-18 moves both). A split window's
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

## 2026-10-16: Carbon's flashes and its clocks

Owner, 2026-10-16, issue #164: "the carbon atom visualization is almost
strobe-like, too active", and issue #166: "the 3 flashes per second
should accompany a slower speed of light/slowing down the simulation".
#164 sets the bound, no region of the pane flashing more than three
times in any one second (WCAG 2.2, success criterion 2.3.1), and #166
the means: the two clocks slowed, each one factor, and nothing dimmed,
thinned or hidden. Issue #169 calibrates the field afterwards, the
dial's range kept.

- The count: `scripts/flash.js`, from the WCAG 2.2 definition of the
  general flash and red flash thresholds (w3.org/TR/WCAG22, read
  2026-10-16). Each frame's pixels are averaged in cells of 4 pixels a
  side, 0.1 degree at the definition's 1024 by 768, the finest pattern
  its exception lets flash. A cell's transitions follow its relative
  luminance between peaks and valleys (Note 2), 0.1 or more with the
  darker below 0.80, so a slow fade counts. A red flash is a change of
  more than 0.2 in u'v' to or from R/(R+G+B) >= 0.8 (Note 3). A field
  of 341 by 256 pixels (Note 1), placed every 32 pixels, flashes when
  the cells completing a flash in it concurrently cover 0.006 sr, a
  quarter of it, 21 824 pixels. The Understanding page for 2.3.1 says
  the combined area "becomes 341 x 256 CSS pixels", the whole field,
  four times the normative quarter: the counter takes the quarter, the
  stricter. The definition fixes no window for "concurrently", so the
  count is read twice: within one frame, as written, and within 0.1 s,
  about the eye's integration time (Bloch's law), which saturates at 10
  a second. `test/flash.test.js` checks it on frames of known flashes.
- The measurement: `scripts/checks/vizflash.js`, a suite job, draws
  Carbon alone in the page frame by frame, fed through Synth's input,
  at full activity (every level held at 1, as vizcarbon.js holds it,
  and a tool call every 2 s), moderate (levels 0.5, a tool call every
  4 s), idle and a single prompt on a quiet session, in a full pane of
  1200 by 760 at 60 frames a second and in panes of 240 by 460 and 360
  by 230 at 20, after a warm-up of three of the field's slowest times.
  `--event 1e6 --light 1e17` replays d18161f's clocks, since every
  constant that moves with them is derived from them.
- Measured at d18161f's clocks: in every scene and pane, 0 general and
  0 red flashes a second within one frame, the largest concurrent area
  0.48 of the threshold. Within 0.1 s: 6 general and 7 red at full
  activity, 6 and 3 moderate, 0 idle, 0 and 1 red after a prompt, and
  0 in the small panes. So the literal bound was already met, and the strobe the
  owner saw lies under it. Ablations at full activity, one part at a
  time: without fronts the 0.1 s count falls from 7 to 0, and without
  the field, the outer cloud, the seethe, the source's flash or the
  camera's turn it stays at 5 to 8. The fronts in flight carry it.
- The 0.1 s count against the factors, 12 s at full activity, two runs
  each (the count is the extreme of rare events, and runs of one setting
  differ by up to 6): equal factors 1, 2, 3 and 4 gave 8 and 8, 8 and 7,
  9 and 4, 10 and 6, the fronts in flight held at 132 to 154 as #166's
  arithmetic says. Events alone slowed 3, 4 or 6 times gave 3 and 4, 3,
  1, the fronts in flight falling to 25 to 50. Light alone slowed 3
  times, in an earlier scene with a prompt every 4/3 s, gave 10 against
  5 at d18161f's clocks, the fronts in flight rising from 151 to 453.
  The 0.1 s count
  follows the fronts in flight, which only fewer fronts lower, and #166
  forbids thinning them. It is reported by the check and asserts
  nothing.
- The factors: events NIST / $5\times10^6$, light $c/(5\times10^{17})$,
  each five times slower, `EVENT` and `LIGHT` in `app/viz/carbon.js`.
  The count does not fix them, so the rule is the region the owner
  named in #169, the drawn atom's axis: a line with no arrowhead, it
  looks the same after half a turn, so it repeats at $2f_L$, 12.6 a
  second for $2p^2\,{}^3P_2$ at the dial's start, 0.30 mT, at $10^6$.
  The smallest whole factor that brings that under three a second is 5:
  2.52 a second, under the Nyquist rate of the split of three's 20
  frames a second. Light is slowed by the same factor, as #166 designs,
  so the fronts in flight and the picture's density stay as they were
  and only the tempo falls. This rule is the one the lead must confirm.
  At the dial's 2 mT the repeat is still 16.8 a second, which #169's
  calibration settles.
- After: 0 general and 0 red flashes a second within one frame in every
  scene and pane, the largest concurrent area 0.29 of the threshold at
  full activity. Within 0.1 s: 10 at full activity, 3 moderate, 0 idle,
  after a prompt and in the small panes. A busy session shows 154
  fronts and 70 photons a second, a moderate one 87 and 40, an idle one
  none, and its frames are brighter. A single prompt reads as one burst:
  nine tenths of its 48 photons within 2.1 s in a full pane, 2.7 s in a
  small one, against 0.45 and 0.25 s at d18161f, and no quarter second
  after that holds a tenth of them. The check holds the burst to 0.8 s
  at $10^6$, scaled with the event clock: 4 s.
- Rescaled with the clocks, each derived from `EVENT` or `LIGHT`, so
  their relations hold by construction. The field's rate,
  `FIELD_MAX` $= 1.2\times10^6/E$, 0.24 a second, 3.4 times below the
  slowest allowed decay, $2p4p\,{}^3D$ at 0.82 a second. The Madelung
  swirl's clip, `SPIN_MAX` $= 3\times10^{17}/L$, 0.6 rad/s, the swirl
  itself on the light clock already. The detector's trace,
  `TRACE_DT` $= 2\times10^{-9}E$ and `TRACE_T` $= 10^{-6}E$, 10 ms and
  5 s, its store and its catch-up in `TRACE_T`, and the probe's beat
  window $\pm$`TRACE_T`. The Larmor rates fall by 5 with the event
  clock, 2.80 Hz on screen per mT per unit $g_J$, so an emitter turns
  as many times a lifetime as before and the beat keeps as many
  periods in the trace: the dial's range and start are kept, 0 to 2 mT
  from 0.30 mT. `test/viz-carbon.test.js` pins the factors, the
  lifetimes and the light on screen, the field below the slowest decay,
  the clip, the trace and the Larmor rate on screen.
- In wall time, kept: the source's flash, 0.4 s, a detection's square,
  0.6 s, a line's flash in the spectrum, the camera's turn and the
  cloud's seethe, a sampling on neither clock (the seethe replaced by
  Nelson's flow on the light clock, see 2026-10-22: Carbon's cloud as a
  flow). Scaled with the clocks
  they would linger and overlap five times as long. The session's
  events arrive in wall time, so a prompt's cascade now spreads over
  about 2 s.
- `scripts/checks/vizzeeman.js` reads `EVENT` from the mode: the
  precession against $g_J\mu_B B/h/E$, the beat's spectrum searched from
  3 / 5 to 80 / 5 Hz, the wait for the trace's window 5 s.
  `scripts/checks/vizcarbon.js` waits five times as long for its 60
  fronts at full activity.

Rejected:

- Dimming the flashes, fewer fronts, a share of them drawn, or fades
  and eased snaps in place of the steps, #164's candidates: #166, the
  owner's later word, asks the bound of the clocks and not of what is
  drawn.
- Slowing the events alone: it lowered the 0.1 s count, by fewer fronts
  in flight, but #166 asks both clocks slowed, and the light's factor
  then has no measured floor.
- A factor of 100, every photon counted as a flash: fronts would take
  about 42 s to cross the view, and WCAG counts a flash only over its
  area.

## 2026-10-18: Gravity 3D's sharpness as a setting

Owner, 2026-10-18: Gravity 3D's traced pixel cap as a setting. The cap
of 30000 pixels a pane and 90000 a window (see 2026-10-17) is what
spreads a star or a grain over 2 to 3 pixels, and a larger one costs
frame rate: in the runs of 2026-10-17 three panes of 240 by 460 ran at
a median 25 frames per second at 45000 and 135000, and in the second
run at 27.5 at 30000 and 90000.

- A setting in File, Settings: Gravity 3D sharpness, 15000, 45000,
  60000, 90000 or 135000 pixels a pane, the window's cap three times
  the pane's, or Default, 30000 and 90000 as before. `viz.trace` in
  `settings.json`, null for Default. The menu writes each as "45000 px
  a pane". 15000 is for a slow host. 45000 and 135000 is the budget
  before 2026-10-17, and at 135000 a lone pane of the default 720 by
  460 window traces whole. The default is left out of the list, as
  each setting's is, and `settings.TRACE_OWN` is the mode's `PANE`,
  which `test/settings.test.js` holds equal.
- The trace's scale is
  $k = \min(1, \max(\sqrt{P/(w h)}, \sqrt{3P/\max(A, w h)}))$, $P$
  the setting, $w h$ the pane and $A$ the window, in device pixels.
  The mode reads $P$ each frame through `env.trace()`, which the
  window's numeric frame carries (`r`), so a change shows on the next
  frame.
- `scripts/checks/vizcaps.js` sets the default, 135000 and 15000 and
  wants the traced frame of the size this formula gives each.

## 2026-10-18: Gravity 3D's centre

Owner, issue #171: "the gravity 3d simulation can stay visually
centered on the central black hole".

The camera turned about the origin, where `centre` puts the centre of
mass. The seed's hole of 900 circles that centre at about 14 units,
since the companion of 80 at 175 and the planets pull it, so it moved
on screen by some 20 pixels of a full pane, and every recentring after
a swallowing, a merger or an event moved the whole frame by the centre
of mass's drift since the last.

- The view's centre is the heaviest hole: the seed's, which nothing in
  a run outweighs (a subagent's hole is 150 to 300, and a stop grows
  the heaviest body), and after it swallows a body or a hole, the
  merged hole, which is the same body. With no hole the view takes the
  origin, the centre of mass. `anchor` in `app/viz/gravity3d.js`
  chooses it each frame.
- Only the camera follows it. The camera stands 620 from it, turns
  about it by itself and by the pointer's drag, and every world point
  is taken relative to it: `place` for the bodies, the dust, the
  trails, the flares and the waves' sources, and so the slices, their
  depths and the waves' ground, and `frameOf` for the holes the trace
  reads, so each lens plane and the hole's traced shadow sit where the
  hole is, at the pane's centre and on the trace's axis. A click's moon
  starts on the plane through the hole facing the camera. The distant
  stars are directions and do not move.
- The physics is as before: `centre` still sets total momentum to zero
  and the centre of mass at the origin, at the seed, after each event
  and after each merger or swallowing, and the culls of far bodies and
  grains still measure from it. A recentring moves the hole with
  everything else, so it moves nothing on screen.
- A swallowing moves the hole itself: the merged hole stands at the
  pair's centre of mass, so the trails, fixed in the world, move on
  screen by its recoil, $m_b/(m_h + m_b)$ of the distance between them,
  and by the hole's own fall toward the body in that step. Measured for
  a trail point 150 from the seed's hole in a pane of 1200 by 760, the
  body sent in at 20 from 1.2 times the sum of the horizons: 0.99
  pixels for a star of 50, 1.7 for the companion's hole of 80, after it
  has taken its star, and 6.5 for a subagent's hole of 300. The view is
  not eased across it: the hole stays at the centre on every frame.
- Checked by `test/viz-gravity3d.test.js`. The seed's system, stepped
  2000 times and recentred every 50, the camera turning and its height
  moving, keeps total momentum zero and the heaviest hole at the pane's
  centre to $10^{-6}$ pixels and on the trace's axis, while the hole
  strays more than 8 from the centre of mass and the companion crosses
  more than 100 pixels. A recentring after a planet leaves moves no
  body or trail point on screen by $10^{-9}$ pixels. A star of 50
  swallowed leaves the merged hole at the centre and moves the trails
  by its recoil alone, 0.64 pixels there. Without the offset the hole
  stands 3.2 and 3.6 pixels off at the first step and the recentring moves
  the screen by 1.1 pixels. `scripts/checks/vizmodes.js` reads the probe's `held` at
  every poll of Gravity 3D's full pane while its pair turns three
  times, and at its small pane's frames: the hole within a pixel of
  the pane's centre and on the trace's axis.

Rejected:

- Translating the world each step so the hole sits at the origin: the
  same picture, but the waves' history, the trails and the dust would
  move every frame, and the culls would measure from the hole.
- Easing the view across a merger, so the trails glide rather than
  move by the recoil: the hole would leave the centre for the glide.

## 2026-10-18: Carbon's field, calibrated

Owner, 2026-10-16, issue #169: "the drawn atom's own axis is what is
flickering in such a confusing way from my pov, but reducing the
magnitude of the magnetic field helped *A TON*. keep the min and max
magnetic field values where they are though". The clocks are slowed
five times (#166, above), so the axis's look, a line with no
arrowhead, repeats on screen at $2f_L = 2g_J\mu_B B/h/E$, 8.40 a
second per mT at $g_J$ 1.501 ($2p^2\,{}^3P_{1,2}$, the levels the atom
rests in) and 11.21 at $g_J$ 2.002 ($2s2p^3\,{}^5S^o_2$, where a
subagent's start leaves it, at rest for good, and $2p3p\,{}^3S_1$).

- The count. The axis is 1.5 pixels wide, so no field of the WCAG
  count can see it. `scripts/checks/vizflash.js` now draws it alone,
  each frame its segment as the probe reports it (`axisLine`), in its
  own stroke on black on a canvas of its own, and counts that canvas's
  cells, each flashing as the line passes. It counts twice: the axis
  whole, and its turning alone, a fresh count after each time the axis
  is set anew, the most of the stretches kept. New scenes: full
  activity at B_MAX in the full pane and the split of three, a pulse on
  a quiet session at the start and at B_MAX, so the cloud that turns
  with the pulsed level and its beat come under the field count, and a
  subagent's start, which leaves the drawn atom in 5So2. The field,
  B_MAX at the start's 60 degrees, and the pulse are set by the
  renderer's pointer, as a press.
- What the count found: a cell flashes faster than $2f_L$. The axis
  lies on a cone of 60 degrees about $B$, so its line does not repeat
  after half a turn, and with the camera turning (0.25 rad/s at
  activity) the view leaves the cone and the line swings back and
  forth over some cells. At 0.30 mT, $2f_L$ 2.52 a second, its turning
  reads 4 a second.
- The frame rates, `xvfb-run node scripts/checks/vizcarbon.js OUT`,
  which now counts one pane's rate too, twice, load (1-minute
  `/proc/loadavg`) 35.05 before and 19.37 after the first, 24.75 and
  41.72 the second: one pane of 1200 by 760 at full activity 29, 30
  and 30 frames a second, then 12.5, 14 and 15.5, and three panes of
  720 by 460 in Carbon at full activity 25, 22, 32.5, 29.5 and 17.5,
  median 25, then 16.5, 17.5, 9.5, 7 and 18.5, median 16.5.
- Aliasing, the repeat against half the frame rate. At the start,
  0.15 mT: 1.26 and 1.68 a second, under 3.5, half the slowest round's
  7: none. At 2 mT: 16.81 and 22.42 a second, over 15, half the one
  pane's best 30, and over 12.5, half the split's best median 25: the
  axis aliases in both on this loaded host. In an unloaded pane at 60
  frames a second both stay under 30 and neither aliases. The counter
  shows it: at 2 mT the axis's cells read 12 to 17 a second at 60
  frames a second against the 16.81 stated, and 7 or 8 at 20, the
  alias.
- The axis's turning alone, the most flashes of a cell in any one
  second, `xvfb-run node scripts/checks/vizflash.js OUT --only
  full,moderate,idle,beat,prompt,subagent,split-full --set
  B_START=0.15e-3` and the like, loads 38.55 before and 87.35 after,
  and the check as committed, `xvfb-run node scripts/checks/vizflash.js
  OUT`, loads 33.95 to 64.04:

  | start | idle | pulse | prompt | subagent, $g_J$ 2 | full | moderate | split |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | 0.30 mT | 4 | 2 | 4 | 4 | 2 | 4 | 3 |
  | 0.18 mT, two runs | 2, 2 | 2, 2 | 2, 2 | 3, 3 | 2, 2 | 2, 2 | 2, 2 |
  | 0.15 mT | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
  | 0.15 mT, the check as committed, two runs | 2, 2 | 2, 2 | 2, 2 | 2, 2 | 2, 2 | 2, 2 | 2, 2 |

  At $g_J$ 1.5 the turning reads 2 at $2f_L$ 1.51 and 4 at 2.52, at
  $g_J$ 2 it reads 3 at 2.02. The count is the extreme of a few
  thousand cells, so it moves by one between runs.
- Resets and jumps (item 4 of #169). Every session event lifts the
  drawn atom (`some` takes atom 0 always), and a lift sets its axis to
  $z$ turned about $B$ by a random phase: at full activity 7 to 10
  times in 12 s, the line jumping a median of 15 to 79 degrees on the
  pane, by run and scene. A jump keeps the axis where it is and changes
  only its rate, 0 to 9 times in 12 s. Once slow, the reset is what adds to the
  confusion: counted with the axis whole, its leap adds about one flash
  to a cell, and some run read 4 at every start tried from 0.12 to
  0.30 mT (`--only full,idle,beat,prompt,split-full --set
  B_START=0.25e-3` and the like, loads 6.90 to 87.35), the reading 4
  even after a single prompt at 0.18 mT. No field removes it. A change
  of rate shows in no count. A change to the reset, an eased turn to
  the new axis or a reset only at a collision, is its own decision,
  left to the owner. The axis whole is reported, its turning asserted.
- The calibration. `B_START` = 0.15 mT, the start at which the turning
  read 2 at both $g_J$, a count under the bound of three at $g_J$ 2,
  which at 0.18 mT read 3. The dial's range is the owner's, 0 to 2 mT,
  `B_MAX` kept, and its law is kept: the radius's share squared is
  $B$'s share of 2 mT, so 0.15 mT sits at 0.27 of the radius, the band
  where a $2p4p\,{}^3P_2$ emitter turns 1 to 5 times a lifetime, 0.34
  to 1.69 mT, at 0.41 to 0.92, and aliasing in a split begins at 1.49
  mT, 0.86 of the radius, at its median 25 frames a second, and at
  0.98 mT, 0.70, at the second run's median 16.5. No measurement
  singled out another law, the clocks scale rates and lifetimes
  together so the reason for the square law holds, and both ends are
  fixed.
- The beat at the start: $2f_L$ of $2p4p\,{}^3P_2$ is 1.26 Hz against
  its 0.70 s on screen, 0.89 periods a lifetime. Looked at, the trace
  after a pulse shows a plateau, a fall and one shoulder: the beat is
  barely legible, where at 0.18 mT it showed a peak, a dip and a second
  bump. The calm start is taken over it, and turning the dial up shows
  the beat. At 2 mT it is a comb of 16.8 Hz.
- Asserted by `vizflash.js` at the start field, in every scene: no cell
  of the axis's turning over 3 a second, the drawn atom turning for 2 s
  in all, the pulse lifting the drawn atom, the subagent leaving it in
  5So2, and B_MAX taken from the press. With `B_START` set back to 0.30
  mT it fails. The axis whole and the scenes at B_MAX are reported. The
  field count holds every scene at 0 general and 0 red flashes a second
  within one frame, the pulse's turning cloud included. `vizzeeman.js`
  reads `B_START` and `B_MAX` from the mode, and
  `test/viz-carbon.test.js` pins 0.15 mT and the repeats at it.
- Kept: the cloud, counted per cell, flickers far above three a second
  from its seethe, in wall time, and its stipple's motion: idle, with
  no fronts, a cell reads 5. #165 replaced the seethe (see 2026-10-22:
  Carbon's cloud as a flow).

## 2026-10-18: Carbon's photons at their true scale

Owner, 2026-10-16, issue #167: "no crests behind a ring indicating a
photon, i would prefer some representation that more correclty and
realisticially takes the wavelength into account." The crests behind a
visible front, at a spacing of $4.5\,(\lambda/119\ \mathrm{nm})^{0.35}$
pixels, go, and so does the readout's "crest spacing a symbol".

- The near zone. Every length is the line's vacuum wavelength, the
  light's at the atom (NIST's air wavelength stays on the spectrum's
  axis and in the captions). On the light clock of $c/(5\times10^{17})$,
  11.33 bohr a second, a period is $\lambda$ over that speed:

  | Line | $\lambda$, vacuum | in bohr | over the view's 24 bohr | $\lambda/2\pi$, bohr | period on the light clock | trail, $\lambda/10^4$ |
  | --- | --- | --- | --- | --- | --- | --- |
  | VUV, $2p4d\,{}^3F^o_2$ to $2p^2\,{}^3P_1$ | 119.43 nm | 2257 | 94 | 359 | 199 s | 0.226 bohr |
  | $2p3s\,{}^3P^o_1$ to $2p^2\,{}^3P_1$ | 165.74 nm | 3132 | 130 | 498 | 276 s | 0.313 bohr |
  | visible, $2p4p\,{}^1P_1$ to $2p3s\,{}^1P^o_1$ | 538.18 nm | 10170 | 424 | 1619 | 898 s | 1.017 bohr |
  | near IR, $2p3p\,{}^3P_2$ to $2p3s\,{}^3P^o_2$ | 909.73 nm | 17191 | 716 | 2736 | 1517 s | 1.719 bohr |
  | edge of the spectrum | 10 $\mu$m | 188973 | 7874 | 30076 | 4.6 h | 18.9 bohr |
  | ground term, ${}^3P_1$ to ${}^3P_0$ | 609 $\mu$m | $1.15\times10^7$ | $4.8\times10^5$ | $1.8\times10^6$ | 282 h | 1151 bohr |

  The periods are five times the issue's, which predate the light
  clock's slowing (#166). A front is detected where it reaches the
  pane's nearest edge: 24.5 bohr from the site in a pane of 1200 by
  760, 33.7 in one of 360 by 230, 37.4 in one of 240 by 460 (the edge
  over the atom's pixels a bohr). The shortest line, 118.88 nm, has
  $\lambda/2\pi$ = 358 bohr. So every front lives and dies in the near
  zone, $r \ll \lambda/2\pi$, where the field of the jump's oscillating
  multipole is quasi-static and has one phase across the whole view: no
  crest exists behind any front, at any zoom, and in the 2.2 to 3.3 s a
  front is in flight its phase moves by at most $2\pi \times 3.3/198$,
  a sixtieth of a turn.
- The representation. A visible front is the packet's leading edge, the
  limb as before, and a trail inside it, $\lambda/T$ long with
  $T = 10^4$ (`TRAIL`), drawn in three bands of a third each at 0.42,
  0.24 and 0.10 of the edge's brightness, fading inward. The trail's
  length is a length standing for the wavelength, in the true ratio of
  the lines' wavelengths (538.2 / 119.4 = 4.5) and in the view's bohr
  against the scale bar by the factor $T$, which the pane prints:
  "fronts: an edge and a trail $\lambda$ / 1e4 long, $\lambda$ in
  vacuum", kept in a narrow atom, written over no atom in a small pane,
  as the scale bar is not. Nothing is drawn ahead of the edge, where no
  field has come, and nothing oscillates, so no oscillation runs off
  the light clock. $T$ puts the 538 nm trail at 13 pixels in a pane of
  1200 by 760, about the old two crests' 15, and the visible lines' at
  11 to 19.
- The readout. The drawn atom's photon now states "538.2 nm vac = 699
  x this atom, 424 x the view: in phase across it" and "a period 15 min
  on the light clock, no crest in view". The true comparison the pane
  printed before stays, in vacuum.
- The ultraviolet and infrared passes (item 4) are re-based on the same
  trail: each acts behind the edge only, across $\lambda/T$ and at
  least `BAND_MIN` = 1.6 pixels, the edge's stroke, so a 119 nm band in
  a small pane does not fall under a pixel. The sharpening falls from
  the edge inward as $1-u$, $u$ the share of the band. The haze's
  ripple at the crest spacing, a spatial oscillation at a false
  wavelength, becomes one lobe of displacement, $16u(1-u)$ pixels per
  unit amplitude, 4 at its peak as the ripple's was: a refracting
  shell. Before, both bands also reached a band's width ahead of the
  edge. An infrared line past 2 $\mu$m has a trail over 3.8 bohr, and
  one at 10 $\mu$m 18.9, most of the view, uncapped: its amplitude
  $\sqrt{\nu/\nu_{538}}$ keeps it faint.
- What #168 inherits: the grain under the atom, untouched. The
  harmonic pass by integer radius, untouched. A band that is the trail,
  $\lambda/10^4$ behind the edge and at least 1.6 pixels, and two
  strengths to raise, the sharpening's contrast lift (0.5 of the
  Laplacian and 0.35 of the pixel per unit amplitude) and the haze's
  peak shift (4 pixels per unit amplitude). Lengths are in bohr, as its
  item 4 asks.
- Checked by `test/viz-carbon.test.js`: for the 119.4 and 538.2 nm
  lines, the wavelengths in bohr against the issue's 2256 and 10170, 94
  and 424 times the view, the periods against its 40 and 180 s times 5,
  the trails and their ratio 4.507, no crest in the source, and the
  invisible pass run on a fake canvas, whose changed pixels lie in the
  band behind the edge, the haze one lobe of one sign. With the old
  profiles restored the pass's test fails, a 119.4 nm front changing
  pixels to 64 against its edge at 60.
- The flashes (#164). `xvfb-run node scripts/checks/vizflash.js OUT`
  at 3a54b9c, before, loads (1-minute `/proc/loadavg`) 31.07 to 66.16,
  and after, 41.69 to 53.07: both pass, every scene 0 general and 0 red
  flashes a second within one frame. Nothing is drawn across the view,
  so no large-area change enters. The largest share of a quarter field
  within a frame, before and after: full 0.281 and 0.183, moderate
  0.389 and 0.146, a prompt 0.139 and 0.103, the split of three 0.172
  and 0.061, the small pane 0.196 and 0.061, and in the pulse's scenes,
  whose cloud turns, 0.557 and 0.587, 0.480 and 0.554 at B_MAX, full at
  B_MAX 0.317 and 0.325. Within 0.1 s: full 5 and 0, moderate 3 and 0,
  full at B_MAX 7 general and 8 red and 7 and 0, a prompt 6 red and 0,
  the pulse's 10 and 10, the rest 0 and 0. A cell's most a second fell
  in every scene but idle, the subagent's and the pulse at B_MAX, held
  at 5, 8 and 16. The
  fronts in flight held, 148 and 152 at full activity, the frame's mean
  light 0.0459 and 0.0432.
- The frames, looked at: a visible front in a pane of 1200 by 760 is a
  thin limb in its hue with a soft band inside it, 16 to 19 pixels for
  the red lines at 12.75 pixels a bohr, and in one of 360 by 230, at
  2.06, a ring with a trail of 1.8 to 3 pixels about the cloud. The
  ultraviolet fronts show as thin rings of crisper grain and the
  infrared ones as broad shells of shifted grain, plain only in a
  difference of two frames: as faint as before, which #168 takes up.

Rejected:

- A true-scale inset, the atom a point and the wave's crests at the
  true $\lambda$: on the light clock a front is detected 25 to 38 bohr
  out, 2 nm, so in an inset of a micrometre the packet is a dot for as
  long as it flies. Crests show there only on a second clock, hundreds
  of times faster, printed, and in a box over the cloud that a small
  pane has no room for.
- The near field drawn across the view at the line's frequency: at its
  true period, 198 s to 282 h, nothing moves while a front flies. At a
  multiple large enough to see, it is the made-up timing the owner
  refused, and with dozens of fronts at one site a large-area luminance
  change against #164's bound.
- A trail on a law other than linear, $\lambda^{0.35}$ or a logarithm:
  it breaks the true ratio of the wavelengths.

## 2026-10-22: Carbon's invisible fronts on a grid

Owner, 2026-10-16, issue #168: "the sharpening front and the infrared
shimmers are not very clear and are very subtle. we may need a better
background than subtle noise." The random grain under the atom goes:
sharpening noise of at most 24 of 255 and shifting random pixels by a
pixel or two both read as more noise.

- The backdrop. A Cartesian grid about the site, drawn once a resize
  (`drawBackdrop`). A radial shift leaves a ring about the site a ring
  and a spoke a spoke, so a polar grid would hide the haze. Its spacing
  is the least of 1, 2, 5, 10, 20 or 50 bohr that divides the scale
  bar's length and is `GRID_PX` = 10 pixels or more (`gridStep`), so the
  bar spans whole cells: 1 bohr under a 5 bohr bar in a pane of 1200 by
  760, 5 under 10 in one of 360 by 230. Its lines are Gaussian across,
  $\sigma$ 0.7 pixel, at 22, 30, 50 of 255 over a floor of 4, 6, 10, and
  from 0.55 of the atom box's half side out to the half side they fall
  linearly to 0.4 of that, so the captions in the box's corners stand on
  a dimmer grid. The dashed equator and meridian stay.
- The ultraviolet sharpening. Per unit of the front's drawn amplitude it
  takes 1.5 of the Laplacian and lifts the pixel by 4 (`SHARP`, `LIFT`),
  against 0.5 and 0.35, across the trail as before. It moves a channel
  by `SHARP_MAX` = 56 levels at most, which keeps a lifted grid line
  under a relative luminance of 0.1, and above 64 that most falls
  linearly to 0.15 of it at 172, so the cloud's dense points are crisped
  and barely lifted. A front reads as a thin bright crisp ring.
- The infrared haze. One lobe across the trail as before, peak shift
  `HAZE` = 8 pixels per unit amplitude, against 4. The lobe $A\,4u(1-u)$
  folds the picture where $A > w/4$, $w$ the band: a 909.7 nm front 10
  bohr out in a full pane has $a = 0.62$, $A$ = 5.0 pixels and $w$ = 22,
  a lens that bends each line it crosses without folding it. Closer to
  the site, where $a$ is larger, and in every small pane, whose band is
  3.5 pixels, it folds, a mirage. A front reads as a broad shell of bent
  lines with no change of brightness, so the two kinds are told apart by
  brightness and width: the ultraviolet ring bright and thin, the
  infrared shell dim and broad.
- The measure (`scripts/checks/vizcarbon.js`). Carbon alone on a quiet
  canvas, its levels at 0, one front sent from the site by the
  renderer's `send` hook and caught 10 bohr out. `Warp.apply` keeps the
  mean change its pass makes to the atom box's pixels, levels of 255 a
  channel, the frame with the front against without it. At 43a4dd1, the
  grain, and at 9f6260d, the grid, 165.7 nm: 0.0364 and 0.1667 in a full
  pane (4.6 times), 0.0477 and 0.3125 in a small one (6.6 times). 909.7
  nm: 0.2163 and 0.3016 (1.39 times), 0.1854 and 0.2913 (1.57 times).
  The infrared figure was high at 43a4dd1 though nothing showed:
  shifting random pixels changes nearly every pixel of the band by the
  grain's own spread, while a shift of the grid changes only its line
  pixels, about a third of the band at a 1 bohr spacing, and a pixel
  once however far its line moves. Only a denser or brighter grid raises
  it, and both make the frame with no front a mesh that competes with
  the cloud and the captions (sigma 0.8 and lines at 26, 36, 58 gave
  1.86 and 1.99 times and were refused on sight). The check holds the
  ultraviolet front to 3 times today's figure and the infrared one to
  1.3.
- The flashes (#164). `xvfb-run node scripts/checks/vizflash.js OUT`,
  exit 0 at 43a4dd1 and at 7287dc6: every scene 0 general and 0 red
  flashes a second within one frame. The count within 0.1 s, reported
  and not asserted, in three runs of each (one whole, two of the full
  and moderate scenes alone): full activity 0, 4 and 4 general at
  43a4dd1 against 7, 2 and 6, moderate 0, 0 and 5 against 1, 0 and 6,
  the cells flashing more than three times a second at full activity
  2174, 3186 and 2699 against 4264, 3134 and 4796. So the count sits
  within one setting's spread, up to 6 (2026-10-16 above), leaning a
  little higher. The pulse's scenes stay at 10 and 10. The frame's mean
  light at full activity 0.0445 against 0.0679, the grid's. While
  tuning, unlogged and on code never committed: the sharpening
  uncapped saturated the count at 10 over 14 863 cells (a920cb7's
  message records it at its parent), with the sharpening off it fell to
  1 and with the haze off it stayed at 10, and a cap of 56 levels for
  every pixel left the moderate scene at 9, its heat map on the cloud,
  hence the cap's fall above 64.
- The frame rate. Per draw alone at 400 by 380 at full activity, 7.3 ms
  at 9f6260d against 10.7 at 43a4dd1, run back to back on a loaded
  host (1-minute load 20 and 26): the grid is one image a resize. The
  split of three, median of five rounds, Carbon 16 and 17.5 frames a
  second against 19 and 20.5, Gravity 21 and 21.5 against 18.5 and 23,
  rounds of one set ranging 9 to 39.5: within the host's noise.
- The frames, looked at at 9f6260d. With no front, a full pane shows a
  dim blue-grey grid, brightest about the cloud and dimmer under the
  captions, the cloud the brightest thing in it. One 165.7 nm front is a
  thin continuous grey ring with brighter beads where it crosses the
  lines. One 909.7 nm front is a shell about 22 pixels deep in which the
  lines kink outward. In a pane of 360 by 230 the grid is a 10 pixel
  mesh, the ultraviolet ring a faint thin ring about the cloud, and the
  infrared shell a ring of broken line pieces, faint: its band is 3.5
  pixels. At full activity the grid carries many thin bright rings and
  broad bent shells, the cloud still brightest.

Rejected:

- A polar grid about the site: a radial shift leaves its rings and
  spokes in place.
- A low-frequency pattern of features a few pixels wide: it raises the
  measure by changes the eye does not resolve as a shift, as the grain
  did.
- A wider band floor for the invisible fronts in a small pane: the band
  is the trail, $\lambda/10^4$, from #167.
- A haze that changes brightness by the mapping's Jacobian: a lens keeps
  an extended background's surface brightness.

## 2026-10-22: Carbon's cloud as a flow

Owner, 2026-10-16, issue #165: "replace the monte carlo stippling
electrons with either fluid dynamics simulations or flocking behavior
or something like that, driven by the electron's pdf." The issue left
the dynamics, its time factor, the clip and the jump's morph to the
builder, settled here. The points drawn afresh, 1.2 % of them each 60th
of a second, go, and so does the snap of a new cloud at each change of
level.

- The dynamics: Nelson's stochastic mechanics (E. Nelson, Phys. Rev.
  150, 1079, 1966). Each particle belongs to one electron and moves in
  that electron's density $\rho = |R_{nl} Y_{lm}|^2$ by
  $d\mathbf{x} = (\mathbf{v} + \mathbf{u})\,dt + d\mathbf{W}$, in
  atomic units, each axis of $d\mathbf{W}$ of variance
  $(\hbar/m_e)\,dt$, with the current velocity
  $\mathbf{v} = \mathrm{Im}(\nabla\psi/\psi) = (m/\rho_\perp)\,\hat\phi$,
  the Madelung swirl the mode drew already, and the osmotic velocity
  $\mathbf{u} = \frac{1}{2}\nabla\ln\rho$. Its stationary density is
  $|\psi|^2$: in the Fokker-Planck equation $\rho\mathbf{u}$ cancels the
  diffusion and $\nabla\cdot(\rho\mathbf{v}) = 0$. Taken over the
  issue's other candidates: the overdamped Langevin with a free
  diffusion constant is this process on another clock, and a flock or a
  smoothed-particle fluid keeps $\rho$ only by a correction measured
  after the fact.
- Exact at a frame's step. A step is two parts, each of which keeps
  $\rho$ exactly: the swirl, a turn about $z$ by an angle of $\rho_\perp$
  alone, which keeps any density round about $z$, and the osmotic drift
  with the noise as one step of the Metropolis-adjusted Langevin
  algorithm (G. O. Roberts and R. L. Tweedie, Bernoulli 2, 341, 1996):
  the proposal $\mathbf{y} = \mathbf{x} + h\,\mathbf{u}(\mathbf{x}) + \sqrt{h}\,\boldsymbol\xi$,
  taken with the chance
  $\min(1, \rho(\mathbf{y})\,q(\mathbf{x}|\mathbf{y}) / \rho(\mathbf{x})\,q(\mathbf{y}|\mathbf{x}))$,
  a refused one leaving the particle where it stands. The chain's
  $\rho$ is $\ln R^2$ piecewise linear in $r$ on the radial table's grid,
  4096 steps dense near the nucleus, times $\ln (P_l^m)^2$ piecewise
  linear in $c = \cos\theta$ on 1024 steps, and $\mathbf{u}$ is the
  gradient of the same pieces. A step is at most $(0.3\,\langle r\rangle)^2$
  atomic units of time for an orbital of mean radius $\langle r\rangle$
  (`STEP`), 0.0065 for 1s, where 98 % of proposals are taken: a frame is
  one step down to 13 frames a second, a longer one several.
- The clip: $|\mathbf{u}|$ at most `U_MAX` = 10 bohr per atomic unit of
  time. $\mathbf{u}$ grows without bound at a node of $\rho$, a radial
  node of 2s, 4s or 4p, a plane or cone of $Y_{lm}$, and on the axis
  for $m \ne 0$, where it is $|m|/\rho_\perp$ outward as $\mathbf{v}$ is
  $m/\rho_\perp$ about it. Carbon's 1s reaches 6 at the nucleus, Kato's
  cusp at $Z = 6$, so the clip acts only near the nodes and the axis.
  The swirl keeps its clip, `SPIN_MAX`, 0.6 rad/s. Under the Metropolis
  step neither clip moves the stationary density: each changes the
  proposal, not the law.
- Nodes. In continuous time a particle never crosses a node of $\rho$,
  so each nodal domain keeps its share, a known property of Nelson's
  process. The discrete chain crosses rarely. Every start the mode
  makes, a new cloud and each morph, draws each domain's share right.
- The time factor: `NELSON` = 1, Nelson's process on the light clock,
  the clock of the swirl and the fronts, an atomic unit of time 12.09 s
  on screen. A particle wanders $\sqrt{3t/12.09}$ bohr in $t$ seconds,
  rms: 0.50 bohr in a second, 6.4 pixels in a pane of 1200 by 760 at
  12.75 pixels a bohr, 1.0 in one of 360 by 230, and 2.2 bohr, 28
  pixels, in 20 s. The 2p core, 1.7 bohr, churns, and a 2p4p level's
  outer cloud, 15 bohr, drifts. The factor scales $\mathbf{v}$ and
  $\mathbf{u}$ alike, Nelson's process run faster, the swirl under its
  clip.
- The drawn point. A particle is drawn at its path's exponential mean
  over `SMOOTH` = 0.25 s of wall time, and at the path itself while a
  morph carries it, so it arrives on time. Unsmoothed, the noise moves
  every point 0.47 pixels an axis a frame in a full pane, back and
  forth, and
  the cloud twinkles, a seethe by other means. The mean lags the path by
  $\sqrt{D\tau}$ an axis, rms, $D = \frac{1}{2}$ atomic unit on the
  light clock: 0.10 bohr, 0.08 in 1s where the drift holds the path in,
  a blur of 6 % of the 2p cloud's radius. The drawn path glides at about
  $\sqrt{D/\tau}$, 0.4 bohr a second an axis, 5 pixels in a full pane
  and 0.8 in a small one. The dynamics and the tests are on the true
  positions, which stay $|\psi|^2$ exactly. The flash's sign is read at
  the drawn point.
- The measure that set the factor and the mean: the cloud alone, on
  black, no axis, grid or front, at a fixed camera (yaw 0.4, pitch
  0.32), dim 1, 12 s after 1 s, each frame to the counter of
  `scripts/flash.js`, at 12.75 pixels a bohr and 60 frames a second and
  at 2.06 and 20, in the ground term $^3P_1$, $M_L = 1$, and in
  $2p4p\,{}^3D_3$, $M_L = 2$: a scratch harness, not committed. A
  cell's most flashes in a second and the cells over 3, in that order
  of panes and levels:
  | cloud | full, $^3P_1$ | full, $2p4p$ | small, $^3P_1$ | small, $2p4p$ |
  | --- | --- | --- | --- | --- |
  | the seethe, two runs | 4, 1 and 3, 0 | 4, 1 and 4, 1 | 2, 0 and 2, 0 | 3, 0 and 4, 1 |
  | `NELSON` 1, drawn bare, two runs | 10, 82 and 10, 83 | 10, 301 and 11, 325 | 1, 0 and 1, 0 | 2, 0 and 5, 1 |
  | `NELSON` 3, bare | 14, 109 | 14, 1054 | 2, 0 | 4, 5 |
  | `NELSON` 10, bare | 18, 141 | 17, 1466 | 2, 0 | 6, 95 |
  | `NELSON` 30, bare | 21, 144 | 21, 1205 | 4, 3 | 7, 238 |
  | `NELSON` 1, mean over 0.25 s | 3, 0 | 3, 0 | 1, 0 | 2, 0 |
  | `NELSON` 1, mean over 0.5 s | 2, 0 | 3, 0 | 1, 0 | 1, 0 |
  | `NELSON` 3, mean over 0.5 s | 4, 1 | 3, 0 | 1, 0 | 2, 0 |
  | `NELSON` 10, mean over 0.5 s | 4, 13 | 4, 20 | 1, 0 | 2, 0 |
  No field flashed in any, within a frame or within 0.1 s. Only a mean
  brings the flow to the seethe's count, and the smallest blur that does
  is `NELSON` 1 over 0.25 s. In the pane, at idle, the cloud is dimmed
  to 0.7 and the camera turns, and `vizflash.js`'s idle scene read a
  cell's most at 5 and 33 cells over 3 at every factor from 1 to 30
  bare, as at the base: that cell, at 348,432, is the detector's label
  passing, not the cloud.
- The particles. Six electron slots, 1s, 1s, 2s, 2s, 2p, and the slot
  of the electron a level raises: in $2s^2 2p^2$ it is in 2p, in
  $2s2p^3$ the second 2s slot is in 2p too, in $2s^2 2p\,nl$ it is the
  outer electron, the model's. `PTS_CORE` = 230 particles a slot and
  `PTS_OUTER` = 1300 in the raised slot, 2450 in every level, where the
  ground term drew 1380 points. The raised slot's particles stay in
  every level, each with $230/1300$ of a particle's ink while in a core
  orbital, so each electron carries a core electron's ink there and the
  cloud keeps the stippling's shape and brightness by the same orbitals
  (Bunge 1993 for the core, the quantum-defect model for the outer
  electron, labelled a model), the same $M_L$ and the same $n_m$. A
  particle's $m$ is the inverse of its subshell's $n_m$ at a share drawn
  once with the cloud, so a change of level sets every $m$ anew and
  draws nothing.
- The morph, for every change of the drawn atom's level, a jump, a
  collision, a lamp or the pulse, since the issue's item 2 forbids a
  redraw for any cause: displacement interpolation. A particle whose
  density changes is carried from its quantile of the old density to
  the same quantile of the new, its radius by the two radial tables and
  its $\cos\theta$ by the two tables of $|Y_{lm}|^2$, its azimuth kept,
  linear in $r$ and $\theta$ and eased by smoothstep, over `MORPH` =
  0.5 s of wall time: 30 frames at 60 a second and 10 in a split of
  three, and within the 0.37 to 1.22 s a $2p4p$ level lives on the event
  clock, so a lifted cloud mostly reaches its level before it jumps. At
  1 s, the first choice, the captures showed a lamp's lift into $2p3d$
  cut off by its jump at 139 ms, the cloud barely grown. A $2p3s$ level,
  13.6 to 14.4 ms, is passed through: its cloud is not reached. A
  carried particle takes no Nelson step. A second change before it
  arrives sends it on from where it stands to the new level's density
  at the quantiles of its first move. The raised slot's ink and
  colour pass from the old orbital's to the new, amber to blue half way.
  A two-electron jump moves both of its slots. A collision still sets
  the drawn atom's axis anew (#169), which turns the cloud whole at
  once: that reset is the owner's to change.
- The source rides on the same particles: for its 0.4 s the particles
  of the slot the line moves, the raised slot within $2s^2 2p^2$, are
  drawn again in mint where $\psi_f^*\psi_i$ is positive at the particle
  and pink where negative, its sign from
  $P_f P_i\,P_{l_f}^{|m|} P_{l_t}^{|m'|} \cos q\phi$ as before, the rest
  of the cloud dimmed as before, each at $\min(1, 700/n)$ of the
  brightness of a source point for $n$ particles, the ink of the 700
  points it had. Its magnitude $|\psi_f^*\psi_i| = \sqrt{\rho_f\rho_i}$
  lies between the two densities, where the moving particles are.
- Precession about $B$ and the camera's turn act on the particles as on
  the points: the particles live in the atom's frame, turned by it and
  projected.
- Checked by `test/viz-carbon.test.js`, seeded, each bound the
  Kolmogorov-Smirnov statistic's critical value at a share 0.001,
  $1.95/\sqrt{n}$. From a stationary start, 2400 steps of a 20th of a
  second: in the ground term $^3P_1$, $M_L = 1$, and in
  $2p4p\,{}^3D_3$, $M_L = 2$, each slot's radii against its orbital's
  $P(r)^2$ and its $\cos\theta$ by $|m|$ against $(P_l^{|m|})^2$, both
  integrated from the orbitals and not from the mode's tables, and the
  drawn points behind the paths by 0.7 to 1.1 times 0.10 bohr. From a
  wrong start, every particle of $^3P_1$ at three times its mean radius
  within 0.3 rad of the axis, half each way: every slot fails at the
  start and passes after 240 s. A jump of $2p4p\,{}^1P_1$ to
  $2p3s\,{}^1P^o_1$ and on to $^3P_1$, and a second change before the
  first move ends: every particle kept, under 2 bohr a frame, each slot
  at its new density, the raised slot in 2p at $230/1300$ of the ink.
  The swirl's circulation through the noise: $M_L = \pm1$ turn each
  way, $M_L = 0$ under a fifth of that. With $\ln (P_l^m)^2$ left out of
  the target both density tests fail, and with the morph aimed at the
  old orbital the jump's fails.
- The cost (`scripts/checks/vizcarbon.js`, Carbon drawn alone on a
  400 by 380 canvas at full activity, the median of a draw). The step
  of 2450 particles takes 0.4 to 0.46 ms in node. Against the base at
  38bf72f, run back to back: 7.7 ms at the base and 8.7 at 2de4cfc,
  1-minute load 13.71 and 13.39 before each. At e65bb66 9.4, the base
  8.6 and e65bb66 again 10.8, load 19.45, 37.53 and 37.95 before each.
  The issue's 6.3 ms was read on 2026-10-16: the base read 7.7 to 9.5
  on this host on 2026-10-22. Three panes of 720 by 460 all in Carbon,
  the median of five rounds, on the fake session's activity and at full
  activity: the base 28.5 and 33, then 13 and 14.5, this change 22.5
  and 29.5 (2de4cfc), then 19 and 13 and 15.5 and 16.5 (e65bb66),
  rounds ranging 9 to 38.5, Gravity's medians moving as far (10 to
  29.5) between the same runs: within the host's noise.
- The flashes (#164). `xvfb-run node scripts/checks/vizflash.js OUT`,
  exit 0 at 38bf72f and at e65bb66, loads 55.59 and 10.07 before:
  every scene 0 general and 0 red flashes a second within one frame,
  the bound. A cell's most in a second, base and e65bb66: full 13 and
  10, full at B_MAX 22 and 20, the pulse 13 and 13, at B_MAX 16 and 17,
  moderate 10 and 9, idle 5 and 5, a prompt 8 and 8, a subagent 8 and
  8, the split of three at full activity 5 and 4, at B_MAX 7 and 7, the
  small pane 5 and 4, a prompt there 3 and 4. Within 0.1 s, reported
  and not asserted: full 2 and 5, full at B_MAX 6 and 1, the pulse's 10
  and 10, moderate 2 and 0, the rest 0 and 0. A run at 2de4cfc read 1,
  3, 10 and 0, within one setting's spread. The frame's mean light at
  full activity 0.0691 and 0.0698.
- The frames, looked at at e65bb66 and 2b1ce51, Carbon alone on a
  canvas of 1200 by 760 and one of 360 by 230 (a scratch capture, not
  committed). At rest in the ground term the cloud is the small bright
  2p core as the stippling drew it, its 1s dot a few pixels wide. A
  difference of frames 1 s apart moves every point, by the flow and the
  camera's turn. During a jump, the jump's flash lies on the moving
  particles in mint and pink, then the cloud contracts over half a
  second: with the event clock slowed ten times so a $2p4p\,{}^3D_3$
  cloud settles first, its amber particles spread over the view, then
  on a jump to $2p4s$ and on to the ground term within 0.4 s they
  gather toward the core, the last of them still on the way at 0.6 s.
  With $M_L = \pm2$ in a $2p4p$ level held by an event clock of
  $10^{15}$, the 4p cloud of $m = \pm1$ thins along the cyan axis. In
  the small pane the 4p cloud fills the atom's square, and the ground
  term is a dot of a few pixels.

Rejected:

- Euler-Maruyama of Nelson's equation: biased at a frame's step and at
  the clip, where the Metropolis step is exact.
- A flock or a smoothed-particle fluid: livelier, but neither keeps
  $\rho$, and the correction is a measured drift.
- A time factor above 1: at 3 over 0.5 s the mean lags 0.25 bohr an
  axis, 15 % of the 2p cloud's radius, a change of the cloud's shape,
  and at 10 over 0.5 s the cells over 3 rise to 13 and 20 against the
  seethe's 0 and 1.
- The flow drawn bare, its points at the true positions: a cell's most
  10 to 11 a second against the seethe's 3 to 4.
- Particles of the moving electron alone, the rest stippled: the issue
  asks every particle a trajectory.

## 2026-10-22: Savannah hunt

Owner, 2026-10-22: "file 3 issues for new visualizers based on
flocking behavior with individual and small groups of predators giong
after large groups of prey". Issue #186 is the first of the three, a
predator hunt on an open plain seen from a helicopter. #187
(Murmuration) and #188 (Bait ball) are the others. The design is the
builder's.

### The flocking core

`app/viz/flock.js` is a module of its own, loaded by the page before
the flocking modes and by the tests, and it draws nothing. Its
interface: `new Flock({ dim, cap, params, rnd })`, `add`, `remove`,
`hunter(o)` for a predator, `pick(q, how)`, `centre()`, and
`step(dt)`, which returns the prey taken. `dim` is 2 for a plane, where
z stays 0, or 3 for space, for the Murmuration's sky and the Bait
ball's water. `rnd` takes a seeded generator, mulberry32 as
`quantum.js` has it. The parameters the Murmuration added are off by
default, so a flock that sets none moves as before, bit for bit (see
2026-10-22: Murmuration).

- Each prey steers by separation, alignment and cohesion with its
  neighbours (Reynolds, "Flocks, Herds, and Schools", SIGGRAPH 1987),
  each term a steer capped at length 1 and weighted, the sum scaled to
  the steering limit and capped there. The neighbours are by distance,
  every prey within $r$ up to 24, or by rank, the nearest $k$ within
  $r$, which the Murmuration needs (Ballerini et al., PNAS 105, 2008).
  Both are found on a hashed grid, rebuilt each step, the rank rule
  searching ring by ring until no farther ring can hold a nearer prey.
- Fear, in $[0, 1]$ for each prey, moves it from its resting rule to
  its flight rule. A predator within sight, $55$ m for the herd, raises
  it to $0.55 + 0.45\,t$, $t$ falling from 1 at the predator to 0 at
  the sight's edge. A prey takes up $0.88$ of its most afraid
  neighbour's fear at a rate of 4 a second, so alarm runs across the
  herd ahead of the predator, and fear fades by $0.18$ a second. With
  fear $f$ the top speed runs from the resting $0.8$ m/s to the
  flight's $16$, the steering limit from 3 to 26 m/s$^2$, alignment is
  weighted $1 + 3f$ and cohesion $1 + 2f$, the distance kept from a
  neighbour shrinks to $1 - 0.45f$ of its $5$ m, and above $f = 0.2$ a
  prey steers to a place behind its nearest neighbour ahead, within 45
  degrees of its heading. So a herd that grazes loose bunches at a
  threat and streams in file in flight.
- Flight from every predator in sight: away from it, turned toward the
  side of the predator's run by $0.7$, so a dash into the group splits
  it and the halves flow past and close behind (the fountain effect of
  fish schools).
- At rest a slow random steer, a drift the mode sets, and a pull to the
  centre of all the prey past the radius of the whole group at rest,
  $0.4 \cdot sep \cdot \sqrt{n}$, so split groups trot back and rejoin.
  A prey that runs hard tires after `endurance` seconds and has lost
  `tire` of its top speed after twice that, which the herd sets to 20 s
  and 0.4 and the core leaves off.
- Each predator, a plain object the mode extends, picks a target by
  `pick`: `'straggler'`, the prey most alone and farthest from the
  group's centre, the nearer ones first, `'edge'`, the nearest prey, or
  `'middle'`, the prey nearest the centre of the group, a dash that
  splits it. It reads the prey within its range, or within that range
  of the nearest when none is. It pursues the target's place
  $\min(1.5, d/v)$ seconds ahead at its top speed and steering limit,
  or heads to a goal point when it has none, and takes the target
  within its reach. One predator or a small group both use it.
- `step(dt)` advances in substeps of at most 1/30 s, or the mode's
  `substep`, so the motion is the same at any frame rate.
- `test/viz-flock.test.js`, seeded, by distance and by rank: 120 prey
  held 120 s with no predator stay one group, linked by steps under 14
  m, their spread within 1.5 times the start's, in the plane and in
  space. Every prey within a standing predator's sight is farther from
  it 3 s later, by more than 10 m on average, while with no predator
  the same prey move under 2 m from the point on average. A
  predator at 24 m/s picking each of the three targets is nearer it at
  every look until it takes it.

### The mode

`app/viz/savannah.js`, a Canvas2D mode as the others are.

- The camera looks down at 60 degrees through a long lens, as wildlife
  crews film from helicopters, so the view is near orthographic: the
  ground foreshortened by $\sin 60$, heights by $\cos 60$, north up. It
  follows the herd and the hunters near it, eased over 1.6 s, and
  scales to frame them over 2.5 s, from 0.5 to 10 pixels a metre. The
  helicopter sways by a pixel or two.
- The herd: 180 animals, a fifth of them zebra, the rest wildebeest in
  two shades, each a body and a head, the head down at a grazing pace,
  legs that swing with the distance run when the view is near enough,
  and a long shadow. A grazing animal faces its own way, the core's
  random steer, and a running one where it runs. A thinned herd is
  made up by stragglers walking in from behind it while no predator
  runs.
- The ground: dry grass from a tile at 24 m and paler and darker
  patches from a tile at 600 m, three families of winding game trails
  repeated across the plain, acacias and bush from a seeded hash of 70
  m cells, every shadow cast by a sun 15 degrees high, and dust kicked
  up where the animals run faster than 7 m/s, drifting on the wind.
  The grass, the trails and the trees' shadows are painted at the
  view's scale on a canvas with a margin of a quarter of the pane's
  larger side and blitted each frame, painted again only when the view
  leaves it or the scale or the shadows change by 3 percent. The haze, the dusk and
  the vignette are one overlay, painted again when the dusk changes.
- The hunts, each predator a phase of its plan:
  - A cheetah (29 m/s, 14 s of sprint) stalks a straggler at 5 m/s,
    seen at 0.3 of the herd's sight, and sprints within 55 m or once
    its target is afraid.
  - A pride of three or four lions (19 m/s, 8 s) takes places around
    the herd, at angles spread over 0.9 of the circle, and when all are
    placed, or one is seen, charges: the first at the middle, the rest
    at the edge.
  - A pack of five or six wild dogs (18.5 m/s, 9 s) trots up openly at
    8 m/s, then two run at a straggler while the rest follow at the
    leaders' heels, and a leader spent hands its target to the freshest
    dog behind it, for up to 75 s: the herd tires at 20 s and the pack
    runs it down.
  - A spent predator rests 12 s and leaves. A catch takes the animal
    from the herd, leaves a carcass for 90 s, and keeps the hunt's
    predators at it for 30 s. Two hunts run at most, a third starting
    makes the oldest give up, and a hunt starts of its own every 60 to
    90 s of the clock while the session works.

| Signal | Savannah hunt |
| --- | --- |
| prompt | a hunt, in turn a cheetah, a pride of lions, a pack of wild dogs |
| tool call | an animal startles, marked by a bracket in the class's colour, and its fear runs to its neighbours |
| stop | every predator still closing in charges now |
| subagent | one more predator joins the newest hunt, or a lone cheetah's hunt begins |
| compaction | a stampede: the whole herd runs and its drift turns a quarter |
| output event | an animal stots, kicking up dust |
| bass | the herd's drift, 0.15 to 0.5 m/s, and with busy the clock, 0.8 to 1.2 times real time |
| treble | the wind that carries the dust |
| idle | the clock slows to a fifth, the sun sinks toward dusk and the shadows lengthen, every hunt rests |
| drag | moves the helicopter over the plain, which drifts back to the herd |
| click | a cheetah breaks cover there and sprints at the nearest animal |

- Cost, under swiftshader on this host, by the method of
  `vizcarbon.js`, each mode alone at full activity, median and p90 ms
  a draw, at load average 44 to 49: at 400 by 380 Savannah hunt 3.3
  and 5.7, Gravity 2.0, Quantum 3.0, Fern 2.9, Zoom out 5.3, Carbon
  9.0, and at 1200 by 760 Savannah hunt 8.2 and 24.6, the p90 the
  ground's repaints, Gravity 7.4, Quantum 7.5, Zoom out 21.6, Carbon
  42.8. Painting the ground every frame cost 23 ms at 1200 by 760.
  `vizmodes.js` ran three panes of Carbon, Savannah hunt and Fern at 5,
  8, 8, 6.5 and 13 frames a second over its five rounds, median 8,
  beside Fern, Go and Zoom out at median 8, Gravity, Gravity 3D and
  Quantum at 6 and the butterchurn panes at 6.5, at load average 41 to
  73, which sets the rate more than the mode.

Rejected:

- Perspective from the helicopter: the ground would need a projective
  map, which Canvas2D cannot draw, and a long lens makes the view near
  orthographic anyway.
- A camera that turns with the run: the ground's canvas would be
  painted again on every frame, at three times the cost.
- A stop that ends the hunt: a session's turns are often seconds long,
  so no hunt would reach its end.
- Fear without a fade of its own, only from sight: the herd would calm
  the moment a predator passed, and no alarm would run ahead of it.

## 2026-10-22: Murmuration

Issue #187, the second of the owner's three flocking modes (see
2026-10-22: Savannah hunt): a murmuration of starlings answering
falcons, seen from the ground at a clearing in a forest. The design is
the builder's.

### The core in space

`app/viz/flock.js` as #186 left it ran a flock of 500 in space by rank
at about 78 ms a simulated second, 70 percent of it in the neighbour
search, too slow for thousands of starlings. The Murmuration adds five
parameters, each off by default, so a flock that sets none moves as
before, bit for bit: a seeded run of the Savannah's rule in the plane
and of the rank rule in the plane and in space gives the same hash of
positions, velocities and fears at the core of #186 and at this one.

- `substep`: the longest substep, 1/30 s unless the mode sets it.
- `relist`: the substeps between searches for each prey's neighbours.
  Between them a prey keeps the neighbours it found and measures them
  again, as a starling keeps track of its seven. Any add or remove
  forces a search, since indices move.
- `level`: in space, a steer to level flight, faded by fear, so a
  flock stays a thin sheet, as the real ones are.
- `gatherR`: the radius past which the rejoin pull acts, which the core
  sizes for a group packed in the plane.
- `push`: a steer per prey that the mode sets and the core adds as it
  stands, the length its weight, for a wave of turning the mode
  drives.

With `substep` 1/20 s and `relist` 3, the Murmuration's 600 birds cost
about 27 ms a simulated second on this host.

### The mode

`app/viz/murmuration.js`, a Canvas2D mode on a CPU canvas. Its
simulation, the flock, the waves, the attacks and the clock, is a
`world` with no canvas, which the tests run too.

- The camera stands on the forest floor at the clearing's edge, the eye
  1.7 m up, and looks north, up at 36 degrees, through a lens of focal
  length 0.6 times the pane's longer side. Two trees on each side lean
  in toward the zenith from the pane's edges, 9 to 20 m away, their
  crowns and the boughs of the trees overhead framing the top corners,
  and the treeline across the clearing, 80 to 140 m away in two hazier
  ranks, the bottom. The sky over the clearing fills the rest. The
  forest is painted once per pane size: the treeline and the trunks on
  one still layer, the canopy in a layer per side, cropped to what it
  covers, which the wind sways by up to 0.2 percent of the pane's
  longer side in a calm and 0.7 at full treble.
- The sky follows the local hour, from ten colours of its zenith and
  horizon through the day, a glow low at the right in the morning and
  at the left in the evening. The night is held at a deep twilight, so
  the birds still show.
- The flock: 600 birds, each following its nearest seven by rank
  within 12 m (Ballerini et al., PNAS 105, 2008), at 10 m/s, never
  under 8, keeping 1.8 m, held level by `level` 0.6, over a home 78 m
  ahead and 46 m up. Each bird is drawn as ten starlings at fixed
  places about it in its own frame, 6000 specks. A speck is a stroke
  along the bird's wings, its darkness the share of the wings' area
  that faces the eye: the bird's lift, up in level flight and tilted
  into a turn by its acceleration across its heading, smoothed over
  0.15 s. Seen from below, a level bird shows its whole underside and a
  banked one its edge, so a wave of turning crosses the flock as a
  band of changed shade, and a sheet seen edge on darkens. A speck
  under a pixel and a half is a dot as faint as the bird is small.
- Waves of turning: a front from a bird, at 20 m/s, turns each bird it
  reaches about an axis near the vertical, for the same time each, by
  the core's push, so a front crosses the whole shape and folds it. The
  front reaches a bird when it has run as far as the bird stood from
  its start, wherever the bird flies meanwhile: a band that turned each
  bird for as long as the front held it turned birds flying with the
  front three times as far as birds flying against it, and the flock
  split in two. The flock turns home by a wave from its leading edge
  when its centre strays 12 m from home across the ground and flies
  outward, at most every 4 s, and a gentle steer of every bird alike
  holds its height. The core's bounds, 45 m about home, are only a
  backstop.
- The falcons, each a phase of its plan:
  - A peregrine circles 70 m above the flock, then stoops on the bird
    nearest it at 38 m/s, seen at 1.6 times the flock's sight of 12 m.
    Within 25 m of its bird it slows to chase through the flock at 21
    m/s, and the birds within sight open a hole about it, burst away
    from it in a flash expansion, and the flock turns away from it in a
    wave from its bird. Past its bird, or after 5 s, it climbs for
    another pass, three at most, and leaves.
  - A sparrowhawk dashes in low from the trees across the clearing at
    a straggler at 17 m/s, for two passes.
  - A pair of peregrines circles and stoops, one on the edge, one
    through the middle, which splits the flock.
  - A catch is carried off. Starlings fly in from the trees in parties
    of three to six while no falcon dives, until the flock is whole.
    Two attacks run at most, a third sending the oldest off, and an
    attack starts of its own every 45 to 75 s of the clock while the
    session works.

| Signal | Murmuration |
| --- | --- |
| prompt | an attack, in turn a peregrine, a sparrowhawk, a pair of peregrines |
| tool call | a wave of turning across the flock from a bird marked by a ring in the class's colour |
| stop | every falcon circling or climbing stoops now |
| subagent | one more falcon joins the newest attack, or a lone peregrine's begins |
| compaction | the flock turns about, a wave from its leading edge |
| output event | a ripple: a short turn among the birds within 14 m of one |
| bass | with busy, the clock, 0.8 to 1.2 times real time |
| treble | the wind that sways the canopy |
| idle | the clock slows to a fifth, the flock settles 18 m lower toward the roost, the sky darkens toward dusk, the falcons leave and no attack starts |
| drag | holds a hawk's lure under the pointer, at the flock's distance, and the starlings shy from it |
| click | a peregrine stoops on the bird nearest the click |

- `test/viz-murmuration.test.js`, seeded, under the mode's rule: the
  mode's world, with no falcon, keeps its flock one group, linked by
  steps under 6 m, but for three birds at most, within 35 m of home and
  a spread under 30 m, for 60 s, wheeled by at least five of its waves.
  Birds within a falcon's sight are farther from it 0.6 s later than
  with no falcon, by more than 2 m on average. A falcon picking by
  edge, middle or straggler is nearer its bird at every look until it
  takes it. A push about the vertical on half the flock turns those
  birds left.
- Cost, each mode alone on a CPU canvas in an offscreen Electron page
  under xvfb, at full activity, 240 draws of 1/60 s after 300 of
  warm-up, as `vizcarbon.js` measures, median and p90 ms a draw, at
  load average 11 to 12: at 400 by 380 Murmuration 4.1 and 5.6,
  Savannah hunt 2.0 and 2.2, and at 1200 by 760 Murmuration 12.6 and
  15.1, Savannah hunt 6.5 and 9.0, under Zoom out's 21.6 and Carbon's
  42.8 of the Savannah's figures. `vizmodes.js` ran three panes of
  Carbon, Savannah hunt and Murmuration at 7, 8, 9.5, 11.5 and 8 frames
  a second over its five rounds, median 8, as Carbon, Savannah hunt and
  Fern ran for #186, beside Fern, Go and Zoom out at median 25, Gravity,
  Gravity 3D and Quantum at 22.5 and the butterchurn panes at 19.5, at
  load average 27 to 29.

Rejected:

- Every starling simulated: at about 45 microseconds a bird a
  simulated second under this rule, 6000 birds would take a quarter of
  every second of the clock, before any drawing.
- A wave of turning from the core's fear alone: fear speeds and
  tightens a flock but turns no bird, so no band would cross it.
- A stoop through the flock at full speed: at 38 m/s the falcon crossed
  the flock before a hole showed in the captures, so it slows to chase
  within 25 m.
- Falcons at their true size: a peregrine 80 m off is a few pixels,
  lost among the starlings, so a falcon is drawn at least 16 px across.
- A camera that turns to follow the flock: the forest's layers, some
  thousands of leaves, would be painted again on every move. The flock
  turns home instead.

## 2026-10-22: Bait ball

Issue #188, the third of the owner's three flocking modes (see
2026-10-22: Savannah hunt): ocean predators hunting a school, seen by a
scuba diver in open water. The design is the builder's.

### The core

`app/viz/flock.js` is unchanged. The two things the school needs that
the core lacks, the sea's surface and the packing of a bait ball, are
the mode's, both through the core's per-prey `push` (see 2026-10-22:
Murmuration). The core's `bounds` are a sphere and have no plane, so
within 2 m of the surface each fish is steered down, up to a weight of
1.5, and after each substep no fish is above $z = -0.4$ m, its upward
speed dropped. The seeded probe of the Savannah and the core's hashes
under the Savannah's rule, by rank in the plane and in space, are the
same at the base 2e51f54 and with the mode.

### The mode

`app/viz/baitball.js`, a Canvas2D mode on a CPU canvas. Its
simulation, the school, its waves of turning, the attacks and the
clock, is a `world` with no canvas, which the tests run too.

- The camera: the diver's eye is 14 m down, the lens's focal length
  0.6 times the pane's longer side. The diver stays in place, bobbing
  0.07 m with each breath, every 5 s, 7 at idle, and lets out a stream
  of bubbles that rise past the lens on each breath out. The gaze turns
  toward the school's centre over 2 s, looking out and up by 0.1 to
  0.42 rad, so the school stays in view as it wanders and as predators
  drive it up. Nothing is painted in world space, so the turn costs
  nothing.
- The water: a gradient by each row's elevation, navy below, blue
  level, brighter toward the surface, and Snell's window, a bright disc
  about the zenith whose edge stands $\arcsin(1/1.333)$, 48.6 degrees,
  from it, deep blue at dusk. The surface's waves are a height field
  $h$ of six waves on an 8 m tile, and the light they focus below,
  the caustics, is $1/|\det(I + D \nabla^2 h)|$ on a 64 by 64 tile,
  computed each draw. It is laid on the surface's underside in
  perspective, strip by strip, fading with the distance to it, plays on
  the fish's light and on the backs of predators within 20 m. Ten light
  shafts fall from the surface along the sun's refracted ray, 42 m
  long, fading down and flickering with the waves. The gradient, the
  window, the caustics and the shafts are drawn on a canvas of half the
  pane's size and scaled up. Snow drifts near the lens and turns with
  the gaze.
- Depth: every fish and predator is mixed toward the water's colour
  along its ray by $1 - e^{-d/24}$, $d$ its distance in metres. The fish
  are drawn in five bands of distance, the two beyond 23 m on a canvas
  of half the pane's size, scaled up, so far fish are softer than near
  ones, within the box they fill.
- The school: 700 fish, each following its nearest seven by rank
  within 4 m, at 1.2 m/s, bursting to 4, keeping 0.9 m, held level by
  `level` 0.5, about a home 15 m ahead and 7 m down, on a course that
  wanders and turns home past 4 m. The core's bounds, 10 m about home,
  are a backstop. A predator is seen at 8 m and fear is passed on at
  0.3, so a hole opens about a predator without alarming the whole
  school (Murmuration's finding), and flight weighs 1.4. Each fish is
  drawn as four sardines at fixed places about it in its own frame,
  2800 fish, a stroke as long and deep as a sardine, or within 11 m a
  spindle with a forked tail. A fish rolls into a turn by its
  acceleration across its heading, smoothed over 0.15 s, and its silver
  flank flashes as it mirrors the light from above to the eye: the
  light is $|n \cdot \hat h|^5$, $n$ the flank's normal and $\hat h$
  half way between the eye and the light, in five levels from the dark
  back to the silver flash. So a wave of turning crosses the school as
  a flash.
- The bait ball: while predators hunt within 18 m of the school, a
  level $p$ rises over 1.5 s to $0.45$ a predator, at most 1, and each
  fish is steered to the school's centre with weight
  $2.5p \min(1, (d - 1)/3)$, $d$ its distance from it past 1 m, and
  round it, milling about the vertical at 1.8 m/s, with weight $1.2p$,
  as each fish seeks the middle of a selfish herd (Hamilton, J. Theor.
  Biol. 31, 1971). Packed, the fish cruise up to 1.2 m/s faster and
  steer 10 m/s$^2$ harder, so a ball split by a dash closes again in a
  second or two. In seeded runs of 40 s a pod packs the school from a
  median distance of 4.4 to 4.7 m from its centre at rest to 1.7 to 2.3
  m.
- The attacks, each predator a phase of its plan, circling the ball
  and then dashing at it, seen at half the school's sight while it
  circles:
  - A pod of three to five dolphins (2.3 m, 9 m/s in the dash, 7 within
    6 m of its fish) circles 4 m outside the ball and 3.5 m below it,
    driving it up against the surface, and dashes at the middle and the
    edge in turn, four passes each.
  - A shark (2.8 m, 8 m/s, 6 within 6 m) circles 7 m out and cuts
    through the middle, three passes.
  - Two or three sailfish (3 m with the bill, 12 m/s, 8 within 5 m)
    slash at the edge, the sail raised and the bars lit in the dash,
    four passes each.
  - A volley of four to seven gannets enters the water over the school
    0.4 to 1.2 s apart at 13 m/s, a burst of bubbles and a trail behind
    each, slows by 5 m/s$^2$, takes the nearest fish within 6 m if it
    can, and floats up after 2.2 s.
  - The predators of an attack dash one at a time, 1.5 to 3 s apart,
    so the school packs again between dashes. A kill leaves a puff of
    scales. Fish swim in from the blue in schools of 8 to 12 while no
    predator dashes, until the school is whole. Two attacks run at
    most, a third sending the oldest away, and an attack starts of its
    own every 40 to 70 s of the clock while the session works.

| Signal | Bait ball |
| --- | --- |
| prompt | an attack, in turn a pod of dolphins, a shark, sailfish, a volley of gannets |
| tool call | a fish startles, marked by a ring in the class's colour, and a wave of turning flashes across the school from it |
| stop | every predator circling dashes now |
| subagent | one more predator joins the newest attack, three more gannets its volley, or a lone shark's attack begins |
| compaction | the school balls up for 12 s, and a wave of turning crosses it from its leading edge |
| output event | a glint: a short turn among the fish within 3 m of one |
| bass | with busy, the clock, 0.8 to 1.2 times real time |
| treble | the surface's chop: the caustics' speed and the shafts' flicker |
| idle | the clock slows to a fifth, the light fades toward dusk, the school sinks 3 m, the predators leave and no attack starts |
| drag | turns the diver's gaze, which eases back to the school 1.5 s after the release |
| click | a shark cuts through the school at the fish nearest the click |

- `test/viz-baitball.test.js`, seeded, under the mode's rule: the
  mode's world, with no predator, keeps its school one group, linked by
  steps under 2 m, but for three fish at most, within 12 m of home
  across the water and 4 m in depth, its spread under 7 m, for 60 s.
  Fish within a predator's sight are farther from it 1 s later than
  with no predator, by more than 1.5 m on average. A predator picking
  by edge, middle or straggler is nearer its fish at every look until
  it takes it. A pod of dolphins packs the school to under 0.6 of its
  resting median spread within 40 s, and no fish rises past the
  surface.
- Cost, each mode alone on a CPU canvas in an offscreen Electron page
  under xvfb, at full activity, 240 draws of 1/60 s after 300 of
  warm-up, as `vizcarbon.js` measures, median and p90 ms a draw, at
  load average 27 to 30: at 400 by 380 Bait ball 8.3 and 11.9,
  Murmuration 5.7 and 7.4, Savannah hunt 3.0 and 4.3, and at 1200 by
  760 Bait ball 19.4 and 23.1, Murmuration 18.2 and 21.4, Savannah hunt
  8.1 and 11.1. `vizmodes.js` ran
  three panes of Bait ball, Fern and Go at 7.5, 13.5, 12.5, 13.5 and
  13.5 frames a second over its five rounds, median 13.5, beside Fern,
  Go and Zoom out at median 14, Gravity, Gravity 3D and Quantum at 17,
  Carbon, Savannah hunt and Murmuration at 6.5 and the butterchurn
  panes at 14, at load average 28 to 30.

Rejected:

- A plane in the core's bounds for the surface: the mode's push and a
  hold after each substep do it, and the core, the Savannah and the
  Murmuration stay as they were, bit for bit.
- Packing by a pull to the centre alone, of weight 0.9: each dash blew
  the school to as much as 2.4 times its resting median spread and it
  never packed, its afraid fish running at their flight speed. The
  milling steer, the stronger pull and the faster packed fish make the
  ball.
- Predators dashing whenever ready: a pod kept the school in flight,
  and no ball formed between dashes.
- A gaze held still: the school, wandering and driven up to the
  surface, left the frame.
- A vignette over the pane: a full-pane composite each draw for a
  diving mask's dark corners.
- The water at full size: its gradient, window, caustics and shafts
  cost 7.7 ms a draw at 1200 by 760 over the half-size canvas, for
  detail too smooth to show.
- The caustics at full strength on the surface: the underside read as
  a tiled ceiling over half the pane.

## 2026-10-22: Sunset clouds

Owner, 2026-10-22: "a new visualizer: volumetric watercolor clouds at
sunset over the US southwest plains ala georgia o'keefe". Issue #189.
The method, the signal's mapping and the pointer's are the builder's.

### The scene

`app/viz/sunset.js`, a Canvas2D mode as the others are, drawn on a
canvas of the CPU and blitted to the pane once a frame.

- The view: a level camera on the plains, 76 degrees across, its
  horizon at 0.76 of the pane's height by a shifted principal point, so
  the sky takes three quarters of the pane and verticals stay upright.
  The sun stands 14 to 28 degrees to one side of the view's axis, the
  side drawn for each sunset, and is drawn large, 2.8 degrees across,
  as a painter makes it.
- A sunset is 300 s of the clock, the sun sinking from 10 degrees to 7
  below. A launch starts it somewhere in its first half. The light is
  a table of eight keys by the sun's elevation: the sun's colour and
  strength, the zenith, the horizon under the sun and away from it.
  The clouds' sky light and the land's warm bounce are mixed from
  those. When the sun reaches 7 below, a new sunset, with its own side,
  land and clouds, fades in over the old in 5 s.
- The clouds: 11 kept, 18 at most, each a base row of two to four
  flattened ovoids and up to four rounder crowns, 1.5 to 4 km wide,
  their flat bases near 1900 m, 2.6 to 40 km off. They drift across the
  view on the wind, so the near ones pass large overhead and the far
  ones lie in rows along the horizon. A thinned sky forms a new cloud
  every 2 to 4 s, growing from 0.15 of its size, and a crowded one
  thins its oldest cloud of more than a minute every 3 to 6 s, so the
  sky returns to its calm.
- The land: six bands far to near, a distant range, one to three
  flat-topped mesas, a pale plain and three rolling bands of earth,
  each a pigment lit by its share of sunlight and by the sky, and
  hazed toward the horizon's colour by its distance.

### The volume

Each cloud is a volume marched on its own. The issue named three
methods: a low-resolution march blurred up, a few layered slabs, and
2D shapes shaded as volumes. This is the first, done per cloud rather
than per pane.

- A cloud's sprite lies in the plane at the cloud's depth, a sprite
  pixel $s = \max(1.5, W/480)$ screen pixels, and the march samples it
  every two sprite pixels, along the view ray to the cloud's middle:
  12 steps across the span of the blobs the ray meets.
- The density at a point is $D = \sum_i w_i (1 - q_i)^2$ over those
  blobs, $q_i < 1$ the point's squared distance from blob $i$'s centre
  in its radii, cut flat at the base, and the extinction is
  $0.0042\,\mathrm{m}^{-1}$ times a smoothstep of $(D - 0.1)/0.4$.
- From each step the optical depth toward the sun is
  $0.011\,\mathrm{m}^{-1}$ times the integral of $1 - q_i$ along the
  sun's ray through every blob, in closed form, the ray cut at the
  base. The sun's light at the step is $e^{-\tau} + 0.2\,e^{-0.25\tau}$,
  the second term the light scattered deeper in, times a phase of
  Henyey-Greenstein's, $0.6$ of it at $g = 0.45$ and $0.4$ at
  $g = -0.15$. So a cloud is bright on its sunward side, shadowed and
  coloured within, and the thin edges of the clouds toward the sun
  glow. The sky's light grows with height in the cloud, the ground's
  bounce with depth below its top.
- The earth's shadow: a cloud loses the sun once the sun is below the
  cloud's own horizon, $\sqrt{2h/R}$ below the level, about 1.4
  degrees at 2 km, so the bases glow pink just after sunset and the
  clouds then go violet.
- A march keeps the sun, sky and ground sums and the alpha of every
  sample, so a change of the light's colour repaints a sprite without
  a march. A cloud is marched again when the sun has moved a degree,
  its size by a quarter or its shape, or the pane's width by 15
  percent, and repainted when the sun has moved 0.15 degree. Marches
  and repaints share 2.5 ms a frame, a march resuming row by row, the
  clouds without a sprite first. The first frame marches for up to
  60 ms, so the sky starts with its clouds: it took 154 ms in all at
  1200 by 760 and 63 ms at 400 by 300, with the sky's and the land's
  geometry.

### The watercolour

The pigment's density modulates a colour as Bousseau, Kaplan, Thollot
and Sillion do ("Interactive watercolor rendering with temporal
coherence and abstraction", NPAR 2006): $C' = C(1 - (1 - C)(d - 1))$,
$d$ above 1 darkening.

- Clouds: the march's alpha, interpolated to the sprite's resolution,
  is moved by two octaves of noise fixed to the cloud and cut by a
  smoothstep whose width a third noise sets, so an edge is wet and soft
  in places and dry and hard in others. Pigment pools in a band just
  inside the edge, less where it is wet.
  Low noise makes the pigment uneven, and a hash granulates it, more
  in the darker washes.
- Sky: a graded wash from the horizon's colours to the zenith's with
  the sun's glow on it, uneven pigment, granulation in the blue, and
  two tide lines where one wash dried against the next.
- Land: each band's wash pools along its top edge, lighter at its
  crest and darker into its fold, uneven and granulated.
- The sky and the land are painted small, 300 and 520 texels across,
  when the sun has moved 0.12 degree and at most every 0.3 s of the
  clock, then laid at the pane's size on a paper tile of tooth and
  fibres, made once, by multiply. A frame blits them.
- Drops on the paper: a pigment bloom with a ragged, darker rim, and
  clean water's backrun, which lifts the wash and dries with a dark
  rim.

| Signal | Sunset clouds |
| --- | --- |
| prompt | a cloud billows up in the open sky, from 0.15 of its size |
| tool call | a drop of pigment in the class's colour blooms on a cloud |
| stop | the sun's rays break through, fanned behind the clouds, for a few seconds |
| subagent | a cloudlet forms beside the newest cloud, at its depth, on its side toward the pane's centre, and held on the pane |
| compaction | the smaller half of the clouds thin away and the rest grow by a fifth |
| output event | a drop of clean water lands, its backrun drying with a dark rim |
| bass | the wind, 8 to 38 m/s, and with busy the clock, 0.8 to 1.2 times real time |
| idle | the clock slows to a fifth, the wind to 0.3, and the sun sinks up to 6 degrees more toward dusk |
| drag | blows the clouds within 0.12 of the pane's width of it along, and they keep a little way on |
| click | in the sky raises a cloud there, on the land drops clean water |

- Cost, in an offscreen Electron page under xvfb on this host, by the
  cost loop of `vizcarbon.js`, each mode alone at full activity, median
  and p90 ms a draw, at load average 21 to 22: at 400 by 380 Sunset clouds 1.7
  and 2.5, Savannah hunt 2.6 and 3.2, and at 1200 by 760 Sunset clouds
  5.2 and 6.4, Savannah hunt 5.6 and 6.1. With idle rising over the
  run, so the sun sinks and every cloud is marched and repainted
  again, Sunset clouds took 1.4 and 5.6 at 400 by 380 and 4.5 and 6.9
  at 1200 by 760, the p90 the marches' budget and the sky's and the
  land's repaints.
- `vizmodes.js` ran three panes of Carbon, Savannah hunt and Sunset
  clouds at 13.5, 15.5, 14.5, 20.5 and 13.5 frames a second over its
  five rounds, median 14.5, beside Fern, Go and Zoom out at median 17,
  Gravity, Gravity 3D and Quantum at 16.5 and the butterchurn panes at
  13, at load average 19 to 45, which sets the rate more than the mode.

Rejected:

- Layered slabs of 2D density with a light sweep across them: cheap and
  near the same cost at any size, but a slab of noise makes a deck of
  ragged cloud rather than O'Keeffe's few smooth rounded forms, and a
  slab seen at a low angle has no side for the sun to light.
- 2D shapes shaded as volumes, from a thickness map and its gradient:
  no light passes through the cloud, so no shadow within and no glow
  at a thin edge toward the sun.
- A march for every pixel of the pane each frame: the clouds change
  slowly, so a march per cloud, at a sample every few pixels and only
  when the light or the cloud moves, does the same work far less often.
- Drawing on the pane's own canvas, of the GPU: in the build, in the
  same offscreen page, a draw returned in 0.1 ms, but with a read of
  one pixel after it, which waits for the raster, it took 12 ms at 1200
  by 760.
- The paper multiplied over the whole pane every frame: 1.9 ms a frame
  at 1200 by 760. It is laid on the sky and the land when they are
  painted, and the clouds carry their own granulation.
