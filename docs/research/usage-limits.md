# Usage limits: what each provider lists, and how each reaches the app

Status: current for Claude Code 2.1.301 and codex-cli 0.162.1, gathered
2026-10-15 from strings in the installed binaries, the rollouts Codex
wrote on this machine, and the files Claude Code writes in its config
directory, with no CLI run and nothing fetched. The section By
provider was added 2026-10-26 (issue #211) from the providers'
documentation, fetched that day, with no API called and no key used.
Re-check after a CLI upgrade. Decisions 0011 and 0038 hold the metric
names.

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

## By provider

A Claude Code or Codex session can run on another provider than the
CLI's own: Claude Code by `ANTHROPIC_BASE_URL`, Codex by a
`model_providers` entry. What each provider in use here reports, and
the channel by which it reaches the app, if any (decision 0038). A
limit with no channel is a gap.

### Anthropic

| Limit or balance | Channel | Metric |
| --- | --- | --- |
| Subscription: current session (5 h), current week, a gateway's spend limit | statusline `rate_limits` | `limits.items` and the scalar names, as above |
| Subscription: current week of one model, extra usage credit | none: a gap (above) | none |
| API organization: rate limits per model class in RPM, ITPM and OTPM, a token bucket [A1] | response headers `anthropic-ratelimit-requests-*`, `-tokens-*`, `-input-tokens-*`, `-output-tokens-*` [A1], which the CLI hands to no channel the app reads: a gap | none |
| API organization: monthly spend cap of its tier ($500 Start, $1,000 Build, $200,000 Scale) and a spend limit of its own below it [A1] | none: a gap. The Console's Billing page shows it | none |
| API organization: usage and cost history | the Usage and Cost Admin API, `/v1/organizations/usage_report/messages` and `/v1/organizations/cost_report`, which needs an Admin API credential, not a workspace key [A2]. History, not a balance. Not read: an Anthropic session keeps its readings (decision 0038) | none |
| A prepaid credit balance | no API documented on the pages read: a gap | none |

### OpenAI

| Limit or balance | Channel | Metric |
| --- | --- | --- |
| ChatGPT plan: the account's windows (5 h, 7 d, 30 d) and a model's own (GPT-5.3-Codex-Spark) | rollout `token_count` `rate_limits` (above) | `limits.items` and the scalar names |
| ChatGPT plan: `credits.balance` | rollout `token_count` `rate_limits.credits` | sent, not drawn: an OpenAI session keeps its readings (decision 0038) |
| API organization: RPM, RPD, TPM, TPD, IPM [O1] | response headers `x-ratelimit-limit-*`, `-remaining-*`, `-reset-*` for requests, tokens and project tokens [O1]. Not seen in a rollout: no API-key Codex session has run here, so whether Codex writes them is unverified | none |
| API organization: approved monthly usage limit of its tier ($100 Free, $500 Build, $5,000 Launch, $200,000 Grow) and the spend limits an owner sets [O1] | none: a gap | none |

### DeepSeek

Claude Code reaches it at `https://api.deepseek.com/anthropic`, Codex
at `https://api.deepseek.com/` by a `model_providers` entry [D4][D5].

| Limit or balance | Channel | Metric |
| --- | --- | --- |
| A Claude Code session's `rate_limits` | none expected: the session has no claude.ai login. Not yet seen, no live session has run, and the replay fake sends none | none |
| A Codex session's rollout `rate_limits` | none expected, for the same reason. Not yet seen, and the replay fake sends none | none |
| Prepaid balance: `is_available` and `balance_infos[]` of `{ currency, total_balance, granted_balance, topped_up_balance }`, currency CNY or USD, amounts as strings [D1] | `GET https://api.deepseek.com/user/balance` with the session's own key as a bearer token [D1][D2], read by the app at most every 5 minutes (decision 0038) | `limits.balances` (`total_balance` per currency), `limits.balance_available` |
| Peak and off-peak price: peak 01:00 to 04:00 and 06:00 to 10:00 UTC, Monday through Friday, excluding Chinese public holidays, off-peak at half the peak price [D3] | none needed: the published schedule, computed by the app, with the 2026 holidays of the State Council's notice [D7] | `limits.peak`, `limits.peak_changes_at` |
| Concurrency: 2500 for `deepseek-flash`, 500 for `deepseek-v4-pro`, per account, a request counted from its send to the end of its response, HTTP 429 past it [D6] | none: no header or endpoint reports the requests in flight [D6], so the cap alone is no reading | none |

What the CLI sends on DeepSeek, its statusline and rollouts above all,
waits on a live session with the owner's key.

### Sources

Fetched 2026-10-26.

- [A1] Rate limits. https://platform.claude.com/docs/en/api/rate-limits
- [A2] Usage and Cost API. https://platform.claude.com/docs/en/manage-claude/usage-cost-api
- [O1] Rate limits. https://developers.openai.com/api/docs/guides/rate-limits
- [D1] Get user balance. https://api-docs.deepseek.com/api/get-user-balance
- [D2] DeepSeek API, authentication (HTTP bearer). https://api-docs.deepseek.com/api/deepseek-api
- [D3] Models and Pricing. https://api-docs.deepseek.com/quick_start/pricing/
- [D4] Anthropic API guide. https://api-docs.deepseek.com/guides/anthropic_api
- [D5] Integrate with Codex. https://api-docs.deepseek.com/quick_start/agent_integrations/codex
- [D6] Rate Limit. https://api-docs.deepseek.com/quick_start/rate_limit
- [D7] State Council General Office, notice on the 2026 holiday
  arrangements, 2025-11-04.
  https://www.news.cn/politics/20251104/88bcffd88ae249e58c699b8772548e3d/c.html
