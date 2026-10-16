# 0011 Metric vocabulary

Status: accepted 2026-10-11, the usage limits' resets and spend limit
added 2026-10-13, the checklist family added 2026-10-14 (decision
0034), the list of every usage limit added 2026-10-15.

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
  `cost.usd`.
- Usage limits: `limits.five_hour_pct`, `limits.five_hour_resets_at`,
  `limits.seven_day_pct`, `limits.seven_day_resets_at`, and a gateway
  session's `limits.spend_pct`, `limits.spend_usd`,
  `limits.spend_limit_usd`, `limits.spend_resets_at`. A reset is Unix
  seconds. `limits.items` is every limit the provider sends now, a
  list of `{ key, label, window, model, pct, resets_at }`: the account's
  limits first, then each model's, so a model the provider adds later
  is one more item, never a new name. `window` is a short span (`5h`,
  `7d`, `30d`), null for a spend limit, `model` the provider's name for
  the model or null, `label` the two together, short enough for a
  quarter tile (`Spark 5h`). A limit with no reading is no item, and
  the list is null when there is none.
- Activity: `tools.total`, `tools.rate` (per minute), `tools.<Name>` per
  tool type, `agents.active`, `lines.added`, `lines.removed`,
  `state.busy` (1 between prompt submit and stop).
- Identity: `model.name` (text), `session.clock_s`, `session.compactions`.
- Checklist (decision 0034): `checklist.items`, a list of `{ text,
  state }`, `checklist.count`, `checklist.done`. It and
  `limits.items` are the list-valued names.
- Generic: `pty.out_bps`, `pty.in_kps`, `pty.idle_s`, `proc.cpu_pct`,
  `proc.mem_mb`.
- Events (pulse counters that only increase): `event.output`,
  `event.tool`, `event.prompt`, `event.stop`, `event.compact`,
  `event.agent`.

Codex fills the same names where its rollout carries the figure.

What each provider lists, and what reaches the app, read from Claude
Code 2.1.301 and codex-cli 0.162.1 (`docs/research/usage-limits.md`).
`/usage` fetches its figures from Anthropic itself. The app makes no
request of its own (the thin-wrapper ruling), so a figure no channel
carries is left out.

| Limit | channel | metric |
| --- | --- | --- |
| Current session (5 h) | statusline `rate_limits.five_hour`, the Codex account's window of 300 min or less | `limits.five_hour_pct`, `limits.five_hour_resets_at`, an item |
| Current week (all models) | statusline `rate_limits.seven_day`, the Codex account's window of about 7 days | `limits.seven_day_pct`, `limits.seven_day_resets_at`, an item |
| A Codex account's 30 day window (free plan) | Codex window of 43200 min | an item |
| Spend limit of a gateway session | statusline `rate_limits.spend_limit`, gateway sessions only | `limits.spend_pct`, `limits.spend_usd`, `limits.spend_limit_usd`, `limits.spend_resets_at`, an item |
| One model's limits, Codex (GPT-5.3-Codex-Spark: 5 h and 7 d) | Codex `token_count` snapshots of that `limit_id` | items |
| Current week of one model, Claude Code | none in 2.1.301: a gap. A further window under the statusline's `rate_limits` becomes an item | an item, once sent |
| Claude Code and Cowork credit, extra usage | none | none |
| Usage breakdown (last 24 h and the like) | none | none |

Every shipped skin draws `limits.items`, one meter per item, so a limit
the provider stops sending, or never sends, takes no room (decision
0007). The scalar names stay for a readout or dial that wants one
figure.

The statusline carries `rate_limits` only after the session's first
response, for a subscription session: before it, or on an API key,
`limits.items` is null and the skins draw no limit, as the CLI itself
knows no figure yet.

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
  `cost.`, `lines.`, `tools.`, `agents.`, `cache.`, `state.`,
  `checklist.` and `session.compactions` is forgotten, and in the same call the source
  reseeds its defaults and writes 0 to its rates. `event.*`,
  `model.name` and `limits.*` survive.
- A write to a name outside the vocabulary (`app/metrics/names.js`) is
  dropped and logged once per name.

## Why

One flat namespace keeps manifests readable. Null for "no data" lets a
widget show a dash instead of a false zero. The usage limits are one
list because the providers name their per-model limits themselves and
add them without notice: a skin binds the list once and draws whatever
it holds.

## Rejected

- Per-CLI names (`claude.*`, `codex.*`): skins would need one binding
  per CLI.
- One name per model's limit (`limits.model.<name>.pct`): a skin can
  bind only names it knows, so a new model would need a new skin.
- Reading the per-model weekly limit from `.claude.json`'s cache of
  `/usage`: the file can hold an API key (decision 0012), and the cache
  is written only when the user opens `/usage`.
