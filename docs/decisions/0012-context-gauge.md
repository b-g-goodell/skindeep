# 0012 Context gauge and distance to auto-compact

Status: accepted 2026-10-11, managed sources added 2026-10-12.

## Context

"A live /context like a spaceship console": a context-fill gauge that
tracks the live session, with the per-category breakdown where a channel
provides one. The /context categories reach only SDK clients.
`used_percentage` in the statusline is an integer, so on a 1,000,000
token window a small prompt does not move it.

## Decision

- `context.used_tokens` = input + cache_creation + cache_read of the
  statusline's `current_usage` (fallback: the last main-chain response
  in the transcript). `context.used_pct` = used_tokens / window as a
  float. Null when `current_usage` is null (before the first call, after
  /compact).
- Breakdown: four buckets, labelled `uncached`, `cache-write`,
  `cache-read`, `output`. Never the /context category names.
- `context.compact_threshold` = W - 13000, W = compactWindow -
  min(maxOutputTokens, 20000), with maxOutputTokens taken as 20000.
  compactWindow, highest first: env `CLAUDE_CODE_AUTO_COMPACT_WINDOW`,
  `--autocompact` in the child's argv, `autoCompactWindow` from
  settings.json files (user, project, local, then managed, decision
  0010, the highest), else the window, capped
  at the window. No threshold when `DISABLE_AUTO_COMPACT` or
  `DISABLE_COMPACT` is set in the child env or a settings env block.
- `context.compact_left_pct` = 1 - used_tokens / threshold.
- `.claude.json` is never read (it can hold an API key), so the /config
  toggle `autoCompactEnabled` stored there is not seen. The tick is
  labelled "auto-compact threshold".
- Statusline off: window = compactWindow if configured, else 200000
  unless usage exceeded it, flagged as inferred.
- `context.window_inferred` reads 1 while the window is inferred from
  the transcript, 0 once a statusline reports it, null before either.
- Precedence per metric: a statusline payload wins each metric it
  carries (the context family when it carries the window size,
  `model.name`, `cache.hit_ratio`) for the rest of the session, and
  writes every metric it overrides. The transcript writes those metrics
  only while no statusline has carried them. The figures of a session
  therefore do not depend on where transcript lines fall relative to
  statusline payloads.

## Why

Tokens move visibly where an integer percent of 1,000,000 does not. The
rule is the binary's own (`docs/research/side-channels.md`).

## Rejected

- Synthesising system-prompt, tools and memory categories: no channel
  gives them.
- Reading `.claude.json`: credentials.
