# 0021 Agent adapter seam

Status: accepted 2026-10-12, one clock added the same day.

## Context

main.js knew each agent adapter's internals: two predicates chose one,
their constructors took different options, only Claude had a prepare
and a notice, attach was guarded, Generic was fed by hand, and no
adapter was ever closed. A failed Claude prepare left its hook server
listening. The dispatch rule lived in three places and disagreed:
`codex_work` got the Codex adapter but no profile in its label, and
`claude_work` got no adapter.

## Decision

- `app/metrics/agent.js` holds the seam. `kindOf(cmd)` reads the
  command's basename against a table of adapter modules, each exporting
  `{ kind, matches(basename), create(ctx) }`, first match wins, else
  the plain adapter of `app/metrics/plain.js`. Claude matches
  `^claude(_.+)?$`, Codex `^codex(_.+)?$` (maintainer, 2026-10-12): a
  launcher such as `claude_work` or `codex_lab` gets its CLI's adapter,
  and hyphen names, where other tools live, never get Claude's
  `--settings`.
- `open(ctx)` builds the chosen adapter beside Generic and returns one
  object, the Session's only adapter (`app/session.js`). `ctx` is
  `{ cmd, cwd, env, runDir, options, bus, log }`. It writes nothing to
  the bus and starts no channel.
- Operations, in order: `prepare()` once, before the spawn, resolving
  `{ args, notice }`, `attach(pid)` once, after it, `onOutput(bytes)`
  and `onInput()` per pty chunk and input, `report()`, and `close()`.
  Every adapter has every operation, so no caller checks for one.
- The failure rule: `prepare()` never rejects. A part whose prepare
  throws is closed at once, its port released, the error logged, and
  the notice reads `meters limited: adapter failed`. The session runs
  on what remains.
- `attach` before `prepare`, or twice, throws: a programming error.
  `close()` is idempotent and valid at any point, also during an
  in-flight prepare, after which nothing stays listening. The Session
  closes the agent at every end (decision 0016).
- One clock. The seam owns the only timer of the metrics, through
  `ctx.clock`, `{ now(), every(ms, fn) }`, an unref'd interval by
  default. Every 250 ms it calls each part's `poll(now)`, then
  `bus.tick(now)`. Adapters hold no timer and throttle their own reads:
  a followed file (`app/metrics/tail.js`) every 500 ms, Codex discovery
  and its subagent count every 1000 ms, `/proc` every 1000 ms. An error
  from a poll is logged once per message and reaches nobody else.
  `close()` cancels the timer.
- The following report: `report()` returns `{ agent, session, title,
  channels, notice, replaying }`. `session` is Claude's session id or
  Codex's thread id, `title` the session's name in the CLI's own record
  or null (decision 0032). Each channel (`hooks`, `statusline`, `transcript`,
  `rollout`, `pty`, `proc`) is `off` (not injected), `waiting` or
  `live`, with the file it follows and the route that found it. The
  notice derives from the states: `meters limited: --settings given`,
  `meters limited: adapter failed`, `meters waiting: no rollout found`
  (decision 0013). The Session re-sends the strip when the notice
  changes, at its 2 s poll.
- The window label names the profile of the dispatched adapter
  (decision 0004).

## Why

One seam makes a provider a row and a module, with no caller change,
which an agent manager listing many sessions would need. The failure
rule holds for every adapter, so a broken channel costs its meters,
never the session.

## Rejected

- Widening dispatch to hyphen names: any program named `claude-<x>`
  would get Claude's `--settings` file and break.
- A `{ argv, notice }` result: the Session already takes `{ args,
  notice }`.
