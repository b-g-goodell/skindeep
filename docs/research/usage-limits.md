# Usage limits: what each provider lists, and how each reaches the app

Status: current for Claude Code 2.1.301 and codex-cli 0.162.1, gathered
2026-10-15 from strings in the installed binaries, the rollouts Codex
wrote on this machine, and the files Claude Code writes in its config
directory. No CLI was run and nothing was fetched. Re-check after a CLI
upgrade. Decision 0011 holds the metric names.

## Claude Code

What `/usage` lists, from the usage endpoint the CLI asks itself
(`/api/oauth/usage`). Its rows are the endpoint's `limits[]`, each
`{ kind, group, percent, resets_at, severity, is_active, scope }`, which
the CLI renders as sent, in the server's order:

- `session`: Current session, the five-hour limit.
- `weekly_all`: Current week (all models).
- `weekly_scoped` with `scope.model.display_name`: Current week of one
  model, named by the server ("Fable" on this machine's accounts, "Sonnet
  only" in older builds). The CLI shows only the models on its
  `tengu_usage_overage_included_models` allowlist.
- Claude Code and Cowork credit, extra usage: a monthly credit, not a
  windowed limit.
- A gateway session's spend limit, in place of the above.

What reaches the app, and through which channel:

| Limit | Channel | Metric |
| --- | --- | --- |
| Current session | statusline `rate_limits.five_hour.{used_percentage, resets_at}` | `limits.five_hour_pct`, `limits.five_hour_resets_at`, an item of `limits.items` |
| Current week (all models) | statusline `rate_limits.seven_day` | `limits.seven_day_pct`, `limits.seven_day_resets_at`, an item |
| Gateway spend limit | statusline `rate_limits.spend_limit`, gateway sessions only | `limits.spend_*`, an item |
| Current week of one model | none: a gap | none |
| Credit, extra usage | none: a gap | none |

The statusline builder of 2.1.301 emits exactly three keys under
`rate_limits`: `five_hour`, `seven_day` and, behind a gateway,
`spend_limit`. Each is present only while the API reports it and its
`resets_at` has not passed, and `rate_limits` is absent before the
session's first response and on an API key.

### The per-model weekly limit: a gap

The CLI knows the per-model window on every response: it reads
`seven_day_overage_included` from the `anthropic-ratelimit-unified-*`
response headers into its in-memory limit state. It hands it on only to
SDK clients, as `rate_limit_event.unifiedWindows` in stream-json output
and as `model_scoped[]` of the `get_usage` control request. The app runs
the interactive CLI on a pty, where neither arrives.

Two other places hold it, and neither is a channel the app reads:

- `.claude.json` in the config directory caches the endpoint's whole
  answer as `cachedUsageUtilization`, `limits[]` included. The CLI
  writes it only when the endpoint is asked, by `/usage` and the SDK's
  usage reads, at most once a minute, and trusts it for an hour. The
  file can also hold an API key, so decision 0012 keeps the app from
  reading it.
- The transcript carries `quotaLimits` on an assistant line only when a
  limit refuses a turn: the refusing limit's type and reset, no reading.

What would close the gap: Claude Code adding the per-model window to the
statusline's `rate_limits`. The parser takes every further window there
that carries `used_percentage`, named by its `display_name` or by its key
(`seven_day_<model>` is that model's 7 d limit), so such a window becomes
an item and is drawn with no change to the app. That shape is the app's
anticipation, not one any build sends: the replay fake sends it so a
check can draw it.

## Codex

Every `event_msg` of type `token_count` in the rollout carries one
limit's snapshot in `rate_limits`:

    { limit_id, limit_name, primary, secondary, credits,
      individual_limit, spend_control_reached, plan_type,
      rate_limit_reached_type }

`primary` and `secondary` are windows of `{ used_percent,
window_minutes, resets_at }`, either may be null. Seen in this machine's
rollouts of codex-cli 0.162:

| limit_id | limit_name | Windows | Meaning |
| --- | --- | --- | --- |
| `codex` | null | 10080 (Pro), 43200 (free) | the account's limit |
| `codex_bengalfox` | `GPT-5.3-Codex-Spark` | 300 and 10080 | one model's limit |
| `premium` | null | none | no reading |

Snapshots of different limits interleave in one rollout: a session of
another model wrote the account's 7 d snapshot on each turn, then the
Spark limit's 5 h and 7 d snapshots. Each becomes its own items, keyed by
`limit_id`. Only the account's limit fills `limits.five_hour_*` and
`limits.seven_day_*`. Until this change the parser took any snapshot for
the account's, so the Spark limit's 0 percent replaced the account's
10, and a 30 day window counted as the seven-day limit.

`credits.balance` is a balance, not a windowed limit, and is not drawn.

## Not drawn

A limit with no reading is no item, so no skin draws it, never as 0.
An item whose `resets_at` has passed is not drawn either: its window has
started over and the app has no reading of the new one until the
provider sends it.
