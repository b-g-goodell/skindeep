# 0019 Tests and dev tools

Status: accepted 2026-10-11. Revised 2026-10-15: the live check suite
and its pass record.

## Context

Tests only where they pay.

## Decision

- `npm test` (node --test) covers: the skin validator (both sample skins
  pass, broken fixtures fail with the expected file and field), the
  Claude session core fed `test/fixtures/claude/` (statusline JSON, hook
  payloads, a reduced transcript) in arrival order, the Claude settings
  writer (`test/claude-settings.test.js`) on a temp profile, git root
  and runDir, the Codex rollout parser fed a reduced rollout, the
  auto-compact rule, and the asset manifest check.
  The metric writer (`test/writer.test.js`) on a fake clock passed to
  `bus.tick`: each rate, history dropped, defaults absent before
  `begin`, the reset, the name check, `close`. The Claude adapter shell
  (`test/claude-adapter.test.js`) on loopback and temp dirs: `prepare()`,
  payloads to the real port, a token check, and `stop()` releasing the
  port and the tail.
- The Session (`test/session.test.js`) runs real children on a real pty
  under `node --test`: exit statuses, the kill policy and its grace,
  bytes, input and environment. Every test awaits the end and kills the
  child's group, since a child that ignores SIGHUP outlives node. The
  view seam (`test/view.test.js`) runs on a fake BrowserWindow whose
  methods throw once it is destroyed.
- The agent adapter seam (`test/agent.test.js`): the dispatch and
  label rows, the failure rule with the hook port released, a close
  during an in-flight prepare, and the order of operations. The
  contract suite (`test/agent-contract.test.js`) runs one table of rows
  against Claude, Codex and plain on a fake clock: defaults absent
  before the first datum and present with it, the output rate, the
  reset, close, nothing moving without the clock, the report.
- The skin registry (`test/skin-registry.test.js`) runs on fixture
  skins under `test/fixtures/registry/`: `skin://` containment by
  realpath, serving the current skin only, selection, refusal, reload
  from disk and the identity rule of 0008.
- `scripts/drive.js`: Playwright's Electron driver for live checks
  under Xvfb, typing as a user would and capturing windows. The app
  exposes one probe to it, `global.skinnedProbe()`, returning `{
  childPid, following, snapshot }`: the child's pid, the agent's report
  (decision 0021) and the bus. `probe(app)` reads it.
- `npm run checks -- OUT` (`scripts/checks/suite.js`) runs every live
  check that runs on the fakes, each mode of it, under
  `scripts/clean-env xvfb-run` with `scripts/fake` first on PATH, a
  few at once, and names each failure with its error line. The checks
  that need a real agent or only measure are listed in it as excluded,
  with the reason. A job that fails runs once more, alone, after the
  others: a loaded host fails the checks that time real frames, and a
  defect fails both times. A job that passes alone counts as passed,
  and the summary and the record name it (issue #217). A full pass on
  a clean tree records the tree's hash
  under the checkout's git directory (`scripts/checks/passrecord.js`),
  and publishing refuses a branch whose tree has none, since `npm
  test` alone never runs a live check.
- `scripts/fake/claude`: a replay fake named `claude`, so the app injects
  its settings. It plays a synthetic scenario (coloured output bursts,
  tool calls of several types, a subagent, turns) through the real
  paths: the statusLine command with payloads built from the recorded
  fixture, the hook commands, and a transcript file it names. Skins and
  the viz can be iterated without spending real sessions.
- `scripts/clean-env`: strips the calling agent session's variables for
  nested runs.

## Why

Parsers and the validator have exact inputs and outputs, where tests are
cheap and catch regressions. Everything visual is checked by eye on
screenshots.

## Rejected

- Pixel-diff tests of skins: brittle, and the look is judged by eye.
- Tests of the widget animation maths: seen on frame sequences instead.
