# Writing a skin

Status: current for claude-skins 0.1. This is the whole skin format: a
skinner needs nothing from the code.

A skin is a directory of data: one manifest (`skin.json`), one stylesheet,
images, fonts and, if you like, sounds. It carries no code. The app
draws the widgets, places them where the manifest says, binds them to
live metrics, and lets your CSS style them.

## Try it

    bin/skinned --skin path/to/myskin -- bash

Any command works in place of `bash`. To see the meters move without a
real session, run the replay fake, which drives every metric:

    bin/skinned --skin path/to/myskin -- scripts/fake/claude

The skin's menu button opens the app's menu: Open skin... loads a skin
folder at runtime, and choosing the current skin again reloads it from
disk while you edit it. A skin with an error refuses to load and says
why (see Errors).

## Layout of a skin directory

    myskin/
      skin.json           the manifest, required
      skin.css            the stylesheet named by "stylesheet"
      images/             PNG, JPEG, GIF, WebP or SVG
      fonts/<Family>/     font files beside their license file (OFL.txt)
      sounds/             Ogg, Opus, MP3 or WAV, if the skin has sounds

Allowed file types: `.json .css .png .jpg .jpeg .gif .webp .svg .ttf .otf
.woff .woff2 .ogg .opus .mp3 .wav .txt .md`, and license files named
LICENSE, COPYING, OFL and the like. Any other file, a script above all, makes the skin invalid.

## The skin area

The window is the identity strip (22 px, at the top, drawn by the app,
naming the command that runs) and below it the skin area. Every rect in
the manifest is in pixels from the skin area's edges. The strip and the
terminal always paint above the skin. Nothing a skin does can cover them.

A window with two tabs or more shows the tab strip (24 px) below the
identity strip, and the skin area is that much shorter. The window's
minimum height grows by as much, so at the minimum window the skin area
is never smaller than the one the validator checks.

## skin.json

A minimal skin:

    {
      "name": "myskin",
      "window": { "width": 1100, "height": 760, "minWidth": 800, "minHeight": 520 },
      "menu": { "rect": { "right": 8, "top": 8, "width": 24, "height": 24 }, "image": "images/menu.png" },
      "terminal": {
        "rect": { "left": 12, "top": 100, "right": 12, "bottom": 12 },
        "theme": { "foreground": "#d0d0d0", "background": "#101010" }
      },
      "stylesheet": "skin.css",
      "panels": [ { "class": "top", "rect": { "left": 0, "right": 0, "top": 0, "height": 90 } } ],
      "widgets": [
        { "id": "ctx", "type": "gauge", "bind": "context.used_pct", "label": "context",
          "rect": { "left": 12, "top": 6, "width": 80, "height": 80 } }
      ]
    }

Top-level fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `name` | yes | lowercase letters, digits and dashes. A shipped skin's name is its directory's. A skin opened with `--skin PATH` under a shipped skin's name replaces that skin for the run, and the menu shows its folder |
| `version`, `author`, `description`, `license` | no | strings, shown nowhere yet |
| `window` | yes | `width`, `height` (initial content size), `minWidth`, `minHeight`, all at least 200 |
| `terminal` | yes | see below |
| `menu` | yes | the menu button, see below |
| `fonts` | no | `[{ "family", "file", "weight"?, "style"? }]`, registered by the app so CSS and the terminal can use the family |
| `stylesheet` | no | one CSS file, relative to the skin |
| `panels` | no | `[{ "class", "rect" }]`: empty boxes your CSS paints (frames, bezels, backgrounds) |
| `widgets` | no | the widgets, see below |
| `sounds` | no | sounds the skin plays, see Sounds |

Unknown fields are errors, so a typo never fails silently.

### rect

A rect follows CSS absolute positioning. Give exactly two of `left`,
`right`, `width`, and exactly two of `top`, `bottom`, `height`, in pixels
from the skin area's edges:

- `{ "left": 10, "top": 10, "width": 100, "height": 40 }` stays at the top
  left.
- `{ "right": 10, "top": 10, "width": 100, "height": 40 }` stays at the top
  right as the window grows.
- `{ "left": 0, "right": 0, "top": 0, "height": 90 }` stretches across the
  top.

### menu

Every skin places the button that opens the app's menu:

    "menu": { "rect": { "left": 4, "top": 0, "width": 34, "height": 20 },
              "image": "images/menu.png", "pressed": "images/menu-down.png" }

| Field | Meaning |
| --- | --- |
| `rect` | where it sits, at least 16 x 16, inside the skin area and clear of the terminal at both the minimum and the initial window size |
| `image` | its picture, required |
| `hover`, `pressed` | optional pictures for the pointer over it and for pressed or open. Without them the app brightens the picture on hover and moves it down a pixel while pressed |

The app draws the button above all your panels and widgets, and your CSS
cannot reach it: you choose where it sits and what it looks like, never
whether it is there.

### terminal

| Field | Meaning |
| --- | --- |
| `rect` | all four of `left`, `top`, `right`, `bottom`: the terminal stretches with the window |
| `theme` | xterm.js colours: `foreground` and `background` required (opaque `#rgb` or `#rrggbb`), optional `cursor`, `cursorAccent`, `selectionBackground`, `selectionForeground`, `selectionInactiveBackground`, and the 16 ANSI colours `black` ... `white`, `brightBlack` ... `brightWhite` |
| `fontFamily` | a family from `fonts`, or DejaVu Sans Mono, the default, which every install has. A skin that names a font only your machine has looks different everywhere else |
| `fontSize` | 8 to 32, default 14 |

Two rules keep the CLI readable: foreground and background must have a
contrast ratio of at least 4.5, and the terminal must keep at least 40
columns by 10 rows at the minimum window size.

## Widgets

Every widget has:

| Field | Meaning |
| --- | --- |
| `id` | unique, lowercase letters, digits, dashes |
| `type` | `gauge`, `needle`, `knob`, `bar`, `led`, `readout` or `sprite` |
| `bind` | the metric it shows, see Metrics |
| `rect` | where it sits |
| `class` | optional extra CSS classes (lowercase, space separated) |
| `label` | optional caption |
| `min`, `max` | the value range, default 0 and 100 |
| `format` | how numbers print: `int` (default), `fixed:N` (N decimals, 0 to 4), `pct`, `usd`, `tokens` (12.3k, 1.20M), `duration` (m:ss or h:mm:ss), `bytes`, `text` |
| `damping` | spring damping, 1 = no overshoot (default), lower = bouncier |

Values glide to each new reading on a spring, so widgets move smoothly
between the 10 updates a second the app sends. A metric with no data
yet shows `--` and gives the widget the class `nodata`.

Type options:

| Type | Options |
| --- | --- |
| `gauge` | an arc that fills. `startAngle` (-135), `endAngle` (135), degrees clockwise from 12 o'clock. `thickness` (10, of a 100 unit box). `ticks` (0). `marks`: `[{ "bind": metric } or { "value": n }, "class"?]`, a line across the arc at that value, for example the auto-compact threshold |
| `needle` | an analog dial, the needle pivots at the bottom centre. `startAngle` (-60), `endAngle` (60), `ticks` (0), `face` (an image behind the needle). Default damping 0.55 for a little overshoot |
| `knob` | a rotating knob. `image` (rotated about its centre, else a drawn knob), `startAngle` (-135), `endAngle` (135) |
| `bar` | a linear meter. `orientation` (`horizontal` or `vertical`), `segments` (0 = continuous, n = n LED-style segments), `gap` (2 px between segments) |
| `led` | a lamp. Either `on`: lit while the value is at least this, or `pulse: true`: lit for `pulseMs` (250) each time an event counter rises. `blink` (ms): flashes while lit |
| `readout` | a number or text. `prefix`, `suffix` |
| `sprite` | a sprite sheet, as in Winamp's sliders. `sheet` (a PNG), `frames`, `frameWidth`, `frameHeight`, `layout` (`row` or `column`). `mode`: `value` (default) picks the frame from the value between min and max, `run` cycles the frames at `fps` (12) while the value is above 0. The PNG must be exactly frames x frame size |

## Styling with CSS

Your stylesheet loads into a shadow root that holds only your skin, after
the app's base widget styles, so any rule of yours wins. Relative `url()`
paths resolve against the stylesheet.

Class names you can style:

- Panels: `.panel` plus the classes you gave.
- Every widget: `.w`, `.w-<type>` (for example `.w-gauge`), your
  classes, `.nodata` while it has no data.
- Parts: `.label`, `.value`, `.track`, `.fill` (gauge arc, bar fill),
  `.tick`, `.mark`, `.needle`, `.pivot`, `.face`, `.knob-face`,
  `.knob-pointer`, `.knob-image`, `.seg` and `.seg.on` (bar segments),
  `.lamp` and `.lamp.on` (led), `.sheet` (sprite).

Colours come from custom properties you can set on `.w` or any widget:
`--fill`, `--track`, `--needle`, `--glow`, `--on`, `--off`, `--text`.
SVG parts (gauge, needle, knob) take `stroke` and `fill`, the rest take
ordinary CSS.

What does not work, on purpose:

- `@import` and any `url()` with a scheme (`https:`, `file:`). Only files
  inside the skin, or `data:image/...`.
- `@font-face`: declare fonts in the manifest's `fonts` instead. Your CSS
  may also name DejaVu Sans Mono and DejaVu Sans, which every install has.
- Anything that would escape the skin area. `position: fixed`, huge
  z-indexes and `:host` rules stay inside it, under the strip and the
  terminal.
- Scripts of any kind.

## Metrics

Bind a widget to any of these. Claude Code fills them from its
statusline, hooks and transcript, Codex from its session rollout, and
any command fills the `pty.*`, `proc.*` and `session.clock_s` meters.
`tools.<Name>` counts one tool type, for example `tools.Read` or
`tools.Bash`. Counters named `event.*` only rise: use them with
`led` `pulse: true`.

| Metric | Meaning |
| --- | --- |
| `context.used_pct` | percent of the context window in use |
| `context.used_tokens` | tokens in the context window |
| `context.window` | context window size in tokens |
| `context.window_inferred` | 1 when the window size is inferred, 0 when read |
| `context.compact_threshold` | tokens at which auto-compact fires |
| `context.compact_at_pct` | auto-compact threshold as a percent of the window |
| `context.compact_left_pct` | percent of the way left before auto-compact |
| `context.uncached` | context tokens sent uncached |
| `context.cache_read` | context tokens read from the prompt cache |
| `context.cache_write` | context tokens written to the prompt cache |
| `context.output` | output tokens of the last response |
| `tokens.in` | input tokens this session, cached and uncached |
| `tokens.out` | output tokens this session |
| `tokens.cache_read` | cache-read input tokens this session |
| `tokens.cache_write` | cache-write input tokens this session |
| `tokens.out_rate` | output tokens per second over the last 10 s |
| `cache.hit_ratio` | share of input read from the prompt cache, 0 to 1 |
| `cost.usd` | session cost in US dollars as the CLI reports it |
| `limits.five_hour_pct` | percent of the five-hour usage limit used |
| `limits.seven_day_pct` | percent of the seven-day usage limit used |
| `tools.total` | tool calls this session |
| `tools.rate` | tool calls in the last 60 s |
| `agents.active` | subagents running now |
| `lines.added` | lines added this session |
| `lines.removed` | lines removed this session |
| `state.busy` | 1 while the agent works on a prompt, else 0 |
| `model.name` | model name (text) |
| `session.clock_s` | seconds since launch |
| `session.compactions` | compactions this session |
| `pty.out_bps` | terminal output bytes per second |
| `pty.in_kps` | input writes (keys, pastes) per second |
| `pty.idle_s` | seconds since the last terminal output |
| `proc.cpu_pct` | CPU percent of the CLI process tree |
| `proc.mem_mb` | resident memory of the CLI process tree in MiB |
| `event.output` | counter: output bursts |
| `event.tool` | counter: tool calls |
| `event.prompt` | counter: prompts submitted |
| `event.stop` | counter: turns finished |
| `event.compact` | counter: compactions |
| `event.agent` | counter: subagents started |

`context.*` counts the tokens of the current request (fresh input, cache
write and cache read), as the CLI's statusline reports them. No side
channel carries the per-category breakdown of `/context`, so no skin can
show it.

## Sounds

A skin may play quiet sounds of its place, as the shipped `coffee` skin
does. Declare each file:

    "sounds": [
      { "file": "sounds/room.ogg", "mode": "loop", "volume": 0.5 },
      { "file": "sounds/cup.ogg", "mode": "random", "volume": 0.25, "interval": [25, 90] }
    ]

| Field | Meaning |
| --- | --- |
| `file` | a `.ogg`, `.opus`, `.mp3` or `.wav` file inside the skin, required |
| `mode` | `loop`: plays without end. `random`: plays once after a wait of `interval` seconds, then waits again, required |
| `volume` | 0 to 1, default 0.3 |
| `interval` | for a `random` sound only, required there: `[min, max]` seconds, 1 <= min <= max <= 3600. Each wait is drawn evenly from the range, the first one too |

At most 16 sounds. The app plays every sound at half the volume you
give, so the loudest a skin can be is half of full scale, and the
default is quiet. Sounds play only while your skin is the current one:
choosing another skin, or yours again, stops them all. The user can mute
every skin's sounds from the menu, or start muted with `skinned --mute`
or `SKINNED_MUTE=1`. A loop meant to run for minutes should end where it
begins, so its seam cannot be heard.

## Fonts and art: licenses

Ship only what you may, sounds included: CC0, public domain, MIT, BSD,
Apache-2.0, zlib, Unlicense, or CC-BY with credit, and for fonts also SIL
OFL. Never
CC-BY-SA, GPL, NC, ND or an unknown license. Keep each font family in its
own directory beside its license file. List every file you ship in the
repository's `ASSETS.json`: path, source URL, author, license. Art you
drew yourself is listed with your name. No logos, names or art of other
products.

## Errors

A skin that fails validation never loads. At launch the app prints every
error and exits with status 125 before the command starts. From the menu,
the current skin stays and the menu shows the errors. Each error names the
file, the field and the fault:

    skins/myskin/skin.json: widgets[3].bind: unknown metric "foo"
    skins/myskin/skin.json: widgets[1].image: "images/knob.png": file not found
    skins/myskin/skin.json: widgets[2].sheet: is 512 x 32 px, 12 frames of 32 x 32 in a row need 384 x 32
    skins/myskin/skin.json: sounds[1].interval: required for a random sound: [min, max] in seconds
    skins/myskin/skin.json: terminal.theme.foreground: contrast with background is 1.26, needs at least 4.5
    skins/myskin/skin.json: terminal.rect: leaves about 22 x 10 cells at the minimum window, needs 40 x 10
    skins/myskin/skin.css: line 2: @import is not allowed
    skins/myskin/tool.js: (file): file type not allowed in a skin

The fixtures under `test/fixtures/skins/` show one of each, and
`npm test` checks the shipped skins.
