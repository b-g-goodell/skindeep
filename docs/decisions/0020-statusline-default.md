# 0020 Statusline injection default

Status: accepted 2026-10-11, reviewed 2026-10-12: `always` stands.

## Context

Any statusLine, even one printing nothing, hides most Claude Code footer
hints. Measured: with the injected statusline in a profile that has none
of its own, `? for shortcuts` disappears. The statusline is the
only channel for cost, rate limits, the cache hit ratio and the exact
window size.

## Decision

`--statusline=always|chain-only`, default `always`.

- `always`: inject in every profile. All meters work. The footer hint is
  lost where the profile has no statusline.
- `chain-only`: inject only when the profile has its own statusLine.
  Elsewhere the context meters come from the transcript, the window is
  inferred (decision 0012), and cost, rate limits and cache hit ratio
  read "no data".

Both modes were checked with screenshots before and after a prompt.
`claude-skins` uses the default. `skinned --statusline=chain-only --
claude` selects the other.

## Why

The meters are the app's purpose, so the default gives all of them. The
switch keeps the CLI's footer exactly as it is for anyone who prefers
that.

## Rejected

- Printing a substitute hint from the relay: the CLI would show app text
  as its own output.
