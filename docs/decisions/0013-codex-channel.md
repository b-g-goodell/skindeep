# 0013 Codex side channel

Status: accepted 2026-10-11, discovery amended 2026-10-12, and for
`fork` (decision 0026), limits by `limit_id` 2026-10-15.

## Context

Codex writes a rollout JSONL per thread under `$CODEX_HOME/sessions`,
in `YYYY/MM/DD` date directories. A session with subagents writes one
rollout per subagent thread, so most rollouts can be subagent threads,
and a resumed session may append to an old file in an older date
directory. Codex 0.162 runs the TUI through a shared app-server daemon
that holds the rollout open, so the child tree rarely holds it.

## Decision

- Discovery, first hit wins, each route over every date directory with
  no window:
  1. A thread id in the child's argv (`resume <id>`): the rollout named
     `rollout-*-<id>.jsonl`.
  2. `/proc/<pid>/fd` of the child tree: a link to a top-level
     `rollout-*.jsonl` under the realpath of `$CODEX_HOME/sessions/`.
  3. A top-level rollout whose `session_meta.cwd` equals the session's
     cwd, the child's cwd or its `-C`/`--cd` directory, split by what
     argv implies, by the thread's creation stamp
     (`session_meta.payload.timestamp`, not the line's own timestamp,
     which is written at the first prompt). `new`, without `resume` in
     argv: created at or after launch minus 2 s, and the earliest wins.
     `resumed`, with `resume` but no id: created before launch minus
     2 s and written at or after it, and the latest write wins.
     `forked`, with `fork`: a fork is a new thread, so it takes the rule
     of `new`, and the id after `fork` names the source thread, never
     taken by route 1. A rollout whose first line has `history_base`
     continues another's history, read first (decision 0026).
- Routes 1 and 2 are exact, route 3 is not. A miss is reported as
  `none`, with the routes tried.
- Parser: `token_count` events give `tokens.in`, `tokens.out`,
  `tokens.cache_read` (cached_input_tokens), reasoning tokens counted in
  `tokens.out`. Each `token_count` carries one limit's snapshot, keyed
  by `limit_id`: the account's (`codex`) fills `limits.five_hour_*` and
  `limits.seven_day_*` from primary and secondary by `window_minutes`,
  and every limit's windows, a model's such as GPT-5.3-Codex-Spark
  among them, are items of `limits.items` (decision 0011). Context fill =
  `last_token_usage.input_tokens / model_context_window` (cached tokens
  are inside input_tokens, never added on top). Tool calls by type from
  `function_call`, `custom_tool_call` and `local_shell_call` names.
  Model from `turn_context`. Busy from turn start and complete events.
  Each tool call is also a `tools.rate` sample, so Codex fills
  `tools.rate` as Claude does.
- Codex writes through one writer source (decision 0011). Its defaults
  (`tools.total`, `agents.active`, `state.busy`) and its rates appear
  once a rollout is followed, never before: until then they read no
  data.
- While no rollout is followed, the strip's notice reads `meters
  waiting: no rollout found` (maintainer, 2026-10-12). A new session shows it
  until its first prompt creates the rollout, and it stays when
  discovery fails, which is then the only sign on screen.
- No notify and no OTel: both need `-c` on the user's command line, and
  the rollout carries everything.
- Resume by id was tested live in the first Codex check, and
  `resume --last` on 2026-10-12: Codex appends to the old rollout at
  resume, before any prompt, and `resumed` found it within 3 s. A new
  session's rollout appears only at its first prompt, so its meters wait
  for it (docs/research/side-channels.md).
- Route 3 misses when the rollout's cwd or `$CODEX_HOME` is not the one
  the app sees: `codex resume --all` of a session from another
  directory, `--worktree`, and a `CODEX_HOME` set inside a wrapper
  script rather than in the app's environment. The meters then show
  nothing, and follow a wrong rollout only when another session of the
  same directory matches. Two old sessions of one directory resumed and
  written at once may follow each other's rollout.

## Why

The argv and fd routes are exact, but the daemon holds the rollout, so
the fd route rarely applies and route 3 serves most sessions. Splitting
route 3 by argv keeps a fresh session from taking an older session of
the same cwd that writes after launch, and keeps a resumed session from
taking a fresh unrelated one. Date directories are read by their
contents and mtimes, not stepped back from the clock, so no window and
no change of local time hides a rollout.

## Rejected

- The newest file: usually a subagent's.
- `codex exec --json`: not the interactive TUI.
- A fixed window of date directories stepped back from the clock: a
  resumed thread older than the window is never found, and a DST change
  skips a local date.
- The newest mtime as route 3's tie rule: an older live session of the
  same cwd that writes after launch wins over ours.
- The daemon's fds: the daemon is outside the child tree, and it holds
  every session's rollouts, so its fds would not say which is ours.
