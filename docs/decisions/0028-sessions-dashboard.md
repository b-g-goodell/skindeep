# 0028 The sessions dashboard

Status: accepted 2026-10-12, the second slice of the agent manager,
under the maintainer's ruling of one window (decision 0023), revised
the same day for
the issue board of each row (decision 0029), for a session whose
history is still being read, and for the rate rule.

## Context

Agent sessions (decision 0027) lists every live session and shows one at
a time on the skin's meters. The agent manager also asks for live graphs per
session and across sessions: tool calls, tokens, cost, context fill and
compactions over time.

## Decision

- File menu entry **Sessions dashboard**, under Agent sessions, opens one
  dashboard tab per window, labelled `sessions`. Choosing it again makes
  that tab active. Like a monitor tab it has no pty and no child, its pid
  is null, it has no exit status of its own (the app exits with the last
  CLI tab's), Reopen closed tab does not record it and Duplicate tab is
  disabled on it.
- Its pane is app DOM in place of a terminal, at the skin's terminal
  rect, in the terminal theme's foreground, out of reach of skin CSS
  (decision 0005). At the top, the sums across sessions: output tokens
  per minute, tool calls per minute, and cost. Below, one row per session
  as Agent sessions lists it (label, folder, state) with a sparkline and
  the last value of tool calls, output tokens, cost, context fill and
  compactions. A click on a live row does what the menu's row does: its
  tab made active, else a monitor tab opened.
- Tokens are output tokens: input tokens count every request's whole
  context again, so their sum says little about work done. A per-minute
  rate is the rise of a counter over the last 60 s, never scaled: before
  a minute of samples exists, the time before the first sample counts as
  no rise, so a burst reads its own size for one minute whenever it
  comes (maintainer, 2026-10-12, replacing a rule that scaled the first
  minute's rises up to a minute and drew early bursts up to 12 times
  their size). 0 where the counter fell or had no data. The minute never
  reaches back past a change of the agent's session (`/clear`,
  `/resume`), so a resumed session's totals are no rise. Tool calls and
  compactions come from Claude's hooks, so a session outside the window
  shows `--` for them, as its monitor tab does.
- Sampling: every 5 s while the dashboard tab exists, nothing before or
  after. A session in a tab, its own or a monitor's, is read from that
  tab's bus. Any other gets a headless watch agent (decision 0027) on a
  bus of its own, closed when the session ends, when a tab comes to show
  it, or when the dashboard closes. So a session outside the window is
  read only as a monitor tab would read it. A session whose transcript
  or rollout history is still being read (decision 0009) gives no
  values in that sample, so the history it has yet to read never counts
  as a rise.
- History: in memory, per dashboard tab, a ring of 720 samples (60 min
  at 5 s) per meter per session, nothing written to disk. It starts when
  the dashboard opens. A session that ends keeps its row, greyed, for 10
  minutes or until the dashboard is opened again.
- The page gets numbers and the strings the menu already shows (label,
  folder, state), as the viz feed gets numbers (decision 0015).

## Why

A tab keeps the one-window rule and gives the graphs the terminal's
room. Reading the buses the window already has, and watching the rest
only while the dashboard shows them, costs nothing when no dashboard is
open.

## Rejected

- A dashboard window: one window (maintainer).
- Graphs in the menu: a drop-down closes on the first click elsewhere.
- Sampling while no dashboard is open, to show history from launch: a
  watch agent per session elsewhere for the app's whole life.
- History on disk: per-window state with no use after the window ends.
- Input tokens in the sums: dominated by repeated context.
- The issue-board graph here: it reads a forge, decision 0029, which
  adds a board column to each row.
