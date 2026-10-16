# 0007 Widget set and animation

Status: accepted 2026-10-11. A numeric readout takes a click since
decision 0033, an eighth type, `list`, shows the agent's task list
since decision 0034, and a ninth, `limits`, every usage limit since
2026-10-15.

## Context

The requirements name gauge, needle, knob, bar, LED, readout and sprite-sheet
animation, and prefers animated widgets.

## Decision

Seven display-only widget types, each bound to one metric:

- `gauge`: an arc that fills between `min` and `max`, optional `ticks`
  and `marks` (a mark at a fixed value, such as the compact threshold).
- `needle`: an analog dial, a needle swept over an angle range, an
  optional face image.
- `knob`: a rotating knob image or a drawn knob, angle from the value.
- `bar`: a linear fill, horizontal or vertical, optional `segments`.
- `led`: lit by threshold (`on` above a value), or pulsed by an event
  metric (lit for `pulseMs` after each event), optional blink.
- `readout`: formatted number or text (`format`: int, fixed:N, pct,
  usd, tokens, duration, text), optional label.
- `sprite`: a sprite sheet image, frames in a row or a grid. `mode:
  value` picks the frame from the value (Winamp's volume slider),
  `mode: run` cycles frames at `fps` while the bound metric is non-zero.

`limits` (2026-10-15, owner's ruling on issue #142: every limit the
provider lists, each needle optional) is bound to `limits.items`
(decision 0011) and draws one `bar` or `needle` per item, with that
type's options, the item's label and its time to reset. The meters
share the widget's rect, in a row or a column, so a limit the provider
does not send takes no room and leaves no gap: no placeholder, no empty
meter, never a zero. The widget carries `n-<count>` for a skin that lays
out three meters unlike two, and hides while the list is empty.

Values move toward their targets with a critically damped spring at the
display's frame rate. Needles get a slight overshoot setting
(`damping` below 1) for the analog feel. The metrics bus updates
renderers at 10 Hz. Widgets draw with DOM and inline SVG, styled by the
skin through `class` and CSS custom properties (`--fill`, `--track`,
`--needle`, `--glow`).

## Why

Display-only widgets keep skins as data. A spring between 10 Hz updates
gives smooth motion without a faster bus.

## Rejected

- Input widgets (knobs that change settings): the app sends nothing to
  the CLI.
- Canvas widgets: CSS could not style them.
- More types (graphs, sparklines): not asked for.
- A fixed widget per limit, hidden while its limit is absent: its rect
  stays, so an absent limit leaves a hole, and a skin can place only
  the limits it knows of.
