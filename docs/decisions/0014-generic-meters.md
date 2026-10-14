# 0014 CLI-agnostic meters

Status: accepted 2026-10-11.

## Context

Any CLI, Claude, Codex or a shell, should still drive some meters.

## Decision

- `proc.cpu_pct`, `proc.mem_mb`: the child's process tree, sampled from
  `/proc` once a second (utime and stime deltas over the clock tick,
  RSS sum). Tree from `/proc/<pid>/task/*/children`, falling back to a
  scan of `/proc/*/stat` parents.
- `pty.out_bps`: pty output bytes per second over a 1 s window.
- `pty.in_kps`: input writes per second (keystrokes and pastes) over
  1 s. The count only, never the content.
- `pty.idle_s`: seconds since the last pty output.
- `session.clock_s`: seconds since launch.
- `event.output`: a pulse per output burst (output after 250 ms of
  silence).
- Generic writes through a writer source (decision 0011): the two 1 s
  windows are the writer's, and every name above appears once the child
  exists, never before. It holds no timer: the seam's clock (decision
  0021) polls it every 250 ms, and it samples `/proc` once a second.

## Why

These come from the app's own pty and `/proc`, so they need no CLI
cooperation. Reading `stat` and `statm` only, never `environ` or
`cmdline` of other processes than the child (decision 0004 reads the
child's cmdline), keeps credentials out of reach.

## Rejected

- Polling faster than 1 Hz for CPU: noise, and a cost on a busy machine.
- Recording input content: never needed, and the requirements forbid storing
  it.
