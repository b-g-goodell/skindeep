# 0009 Claude Code side channels

Status: accepted 2026-10-11, revised 2026-10-12 for the history read a
chunk a tick, and again 2026-10-12 for command hooks found by ancestry
(decision 0030). Facts: `docs/research/side-channels.md`.

## Context

Meters come from side channels only, never from typing into the session.
The profile's settings files are never edited.

## Decision

Three channels, injected on the child only with one generated
`--settings` file (decision 0030), never into a Claude Code
subcommand:

1. Statusline JSON, through a relay command (decision 0010), for context
   fill and window, cost, lines, rate limits, cache hit ratio, model.
   Switch `--statusline=always|chain-only`, default `always` (decision
   0020).
2. Command hooks, `python3 -I -S app/relay/hook.py ROOT`, which post the
   event's JSON to the tab's receiver, a Unix socket in the tab's dir
   found by process ancestry (decision 0030): PreToolUse, PostToolUse,
   PostToolUseFailure, SubagentStart, SubagentStop, UserPromptSubmit,
   Stop, PreCompact, PostCompact, SessionStart, Notification. Each entry
   `timeout: 1`. No SessionEnd (it fires while the app shuts down). The
   hook prints nothing and exits 0 in every case, with no window too.
   The receiver answers `204` with an empty body to every request before
   parsing, caps bodies at 64 KiB, never logs a body, and keeps only
   metadata fields (event, tool name, ids, duration, trigger, agent
   type, transcript path, session id). Prompt text, tool input and
   output, assistant messages and compact summaries are dropped inside
   the handler.
3. Transcript tail, path taken from the payloads and retargeted whenever
   a payload's `transcript_path` or `session_id` changes (/clear,
   /resume). A new `session_id` resets the session family (`context.`,
   `tokens.`, `cost.`, `lines.`, `tools.`, `agents.`, `cache.`,
   `state.`, `session.compactions`) and keeps `event.*`. The metric
   writer executes the reset and reseeds the defaults in the same call
   (decision 0011). The lines a file holds when the tail starts are
   history: they add to totals and level metrics, never to a rate or
   the event feed. The tail reads them 8 MiB at its start and 8 MiB a
   tick (250 ms) after, so a large transcript holds the main process
   for at most two chunks at once (a tick that starts a tail and polls
   it reads two), never the whole file, and lines appended meanwhile
   follow the history. Usage deduplicated by `message.id`: output token
   rate, per-response tokens, model, and the context figures when the
   statusline is off.

When the user passes their own `--settings`, the app injects nothing,
runs on pty and `/proc` meters only, and the strip says "meters limited:
--settings given". No hook-fed meter is seeded and a hook payload is
not taken: `tools.total`, `tools.rate`, `agents.active` and
`state.busy` read null, never 0. The live check verifies that all eleven hook
entries load without a settings error on the startup screen.

## Why

A command hook costs one python3 start per event (about 10 ms measured
2026-10-12) and fails silently, where an HTTP hook with no listener is
reported in the session on every tool call (decision 0030). The hook
prints nothing, so nothing reaches the model's context. The three
channels cover every meter the requirements list that any channel
carries.

## Rejected

- HTTP hooks to 127.0.0.1 with a token: a session that outlives its
  window reports a hook error on every tool call (decision 0030).
- OpenTelemetry: an OTLP receiver and exporter machinery for figures the
  statusline and transcript already give, with slow default intervals.
- Merging the user's own `--settings` with ours: rewriting a user's
  argument is out of bounds.
