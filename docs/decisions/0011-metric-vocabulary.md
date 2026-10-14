# 0011 Metric vocabulary

Status: accepted 2026-10-11.

## Context

Skins bind widgets to metric names. The names are the contract between
skinners and adapters, so they are fixed here and listed in
`docs/SKINS.md`.

## Decision

Dotted names. A metric absent for the current CLI reads as "no data"
(null), never 0.

- Context: `context.used_pct` (float), `context.used_tokens`,
  `context.window`, `context.window_inferred` (1 inferred, 0 read),
  `context.compact_threshold`, `context.compact_at_pct`,
  `context.compact_left_pct`, `context.uncached`, `context.cache_read`,
  `context.cache_write`, `context.output`.
- Tokens and cost: `tokens.in`, `tokens.out`, `tokens.cache_read`,
  `tokens.cache_write`, `tokens.out_rate` (per second), `cache.hit_ratio`,
  `cost.usd`, `limits.five_hour_pct`, `limits.seven_day_pct`.
- Activity: `tools.total`, `tools.rate` (per minute), `tools.<Name>` per
  tool type, `agents.active`, `lines.added`, `lines.removed`,
  `state.busy` (1 between prompt submit and stop).
- Identity: `model.name` (text), `session.clock_s`, `session.compactions`.
- Generic: `pty.out_bps`, `pty.in_kps`, `pty.idle_s`, `proc.cpu_pct`,
  `proc.mem_mb`.
- Events (pulse counters that only increase): `event.output`,
  `event.tool`, `event.prompt`, `event.stop`, `event.compact`,
  `event.agent`.

Codex fills the same names where its rollout carries the figure.

### Writing

The bus has one write path, its writer: an adapter writes through a
source, `bus.source({ defaults, rates })`. The Claude and Codex adapters
and Generic do, and the bus exports no other write.

- A defaulted name is present only while its channel is live. A source
  seeds its defaults at `begin()` and at `reset()`, never at
  construction. Claude begins at its first hook or statusline payload,
  with `tools.total`, `agents.active` and `state.busy` at 0. Before that
  they read null, so a run with no live channel shows `--`, not 0.
- Rates: one table in the writer, value = sum of the samples in the
  window times the unit over the window. `tokens.out_rate` 10 s per
  second, `tools.rate` 60 s per minute, `pty.out_bps` and `pty.in_kps`
  1 s per second. A rate reads null until its source begins, then 0 with
  no samples. `bus.tick(now)` recomputes them, every 250 ms.
- History: a sample or event marked as history (replayed transcript
  lines) is dropped. Counters apply.
- Reset, a new session: every name under `context.`, `tokens.`,
  `cost.`, `lines.`, `tools.`, `agents.`, `cache.`, `state.` and
  `session.compactions` is forgotten, and in the same call the source
  reseeds its defaults and writes 0 to its rates. `event.*`,
  `model.name` and `limits.*` survive.
- A write to a name outside the vocabulary (`app/metrics/names.js`) is
  dropped and logged once per name.

## Why

One flat namespace keeps manifests readable. Null for "no data" lets a
widget show a dash instead of a false zero.

## Rejected

- Per-CLI names (`claude.*`, `codex.*`): skins would need one binding
  per CLI.
