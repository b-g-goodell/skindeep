# 0024 Skin sounds

Status: accepted 2026-10-12.

## Context

The coffee shop skin plays quiet ambient sounds. Skins are
data and run no code (decision 0005), and decision 0015 opened no audio
stream for the visualization. A skin's sounds need a declaration the
validator checks, a player the app owns, and a way to silence them.

## Decision

- The manifest's optional `sounds`: at most 16 entries `{ file, mode,
  volume?, interval? }`. `file` is a `.ogg`, `.opus`, `.mp3` or `.wav`
  file inside the skin. `mode` is `loop`, played without end, or
  `random`, played once after a wait drawn evenly from `interval`, `[min,
  max]` seconds with 1 <= min <= max <= 3600, then waiting again.
  `volume` is 0 to 1, default 0.3. A loop with an interval, an unknown
  field, a missing file or a file of another type is an error, as
  elsewhere in the manifest.
- The player, `app/renderer/sounds.js`, runs in the main window's page.
  It plays the current skin's declared files and nothing else, through
  `skin://` (decision 0005), as HTML media elements, at half the
  manifest's volume: the loudest a skin can play is half of full scale,
  the default 0.15. A random sound's first play waits its interval too,
  so no one-shot sounds at launch.
- Only while the skin is current: choosing another skin, or the same
  skin again (a reload), stops every sound and every wait, then starts
  the new skin's.
- Mute: per window. `--mute` of `bin/skinned` or `SKINNED_MUTE=1` starts
  muted, and the menu's Mute skin sounds and Unmute skin sounds toggle
  it. Muted, nothing plays and nothing waits. Unmuted, the skin's sounds
  start over. The page starts muted until the main process answers, so a
  muted launch never sounds. The CLI's environment never holds
  `SKINNED_MUTE`.
- `skin://` serves byte ranges (206) and the scheme is registered with
  `stream`, so a long loop has a duration and loops. The CSP adds
  `media-src skin:`.
- Nothing is captured. No microphone, no AudioContext, no analysis of
  the output: decision 0015's rule against an audio stream is about the
  visualization window, which still opens none.
- The live checks (`scripts/drive.js`) pass Chromium's `--mute-audio`
  and set `PULSE_SERVER` to no server, so a checked skin never reaches
  the speakers, and `scripts/checks/sounds.js` reads the player's state
  through `window.skinnedPage().sounds`.

## Why

Sound files a skin declares are data, like its images: the app decides
when and how loud they play, and the validator sees every file. Half
volume and a first wait keep a skin quiet by construction, and one mute
covers every skin.

## Rejected

- Sounds tied to session events (a cup set down when a turn ends): the
  issue left them optional, and the random plays already make the room.
- Remembering the mute across launches: `--mute` and `SKINNED_MUTE` say
  it once for every launch.
- An AudioContext for gapless loops: a media element loops a sound made
  to loop, with no new audio graph in the page.
- The menu entry only for a skin with sounds: muting before switching to
  such a skin would be impossible.
