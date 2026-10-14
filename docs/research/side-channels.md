# Side channels: what each carries

Status: current for Claude Code 2.1.296 and codex-cli 0.162.1, gathered
2026-10-11 from the official docs (code.claude.com/docs/en/statusline,
/settings, /hooks, /monitoring-usage, github.com/openai/codex), strings in
the installed binaries, and live captures, reduced into
`test/fixtures/claude/`. Re-check after a CLI upgrade.

## Claude Code statusline

- Config `{"type":"command","command","padding","refreshInterval",
  "hideVimModeIndicator"}`. `refreshInterval` is in seconds, minimum 1.
- Runs at start, on each assistant message, after /compact, on mode,
  model and effort changes, on each refresh tick. Debounced 300 ms. A
  new trigger cancels a script still running.
- Stdin JSON: see `test/fixtures/claude/statusline.json`. Key fields:
  `context_window.{used_percentage, context_window_size, current_usage}`,
  `cost.{total_cost_usd, total_lines_added, total_lines_removed,
  total_duration_ms, total_api_duration_ms}`, `prompt_cache.hit_ratio`,
  `rate_limits.{five_hour, seven_day}.used_percentage` (Pro and Max only,
  after the first response), `model`, `effort.level`, `transcript_path`.
- `used_percentage` = (input + cache_creation + cache_read) / window,
  output excluded. `current_usage` is null before the first call and
  after /compact.
- Empty output blanks the status line and hides most footer hints
  (measured: `? for shortcuts` disappears).
- Skipped until workspace trust is accepted.

## Claude Code settings and hooks

- `--settings <file-or-json>`. Precedence: managed > --settings > local >
  project > user. Arrays concatenate and deduplicate, objects deep-merge,
  so hooks from --settings add to the profile's hooks (measured: the
  profile's Stop hook still ran beside ours).
- Hook types include `command` and `http`
  (`{"type":"http","url","timeout","headers"}`). An http hook answered 2xx
  with an empty body is a success with no output. A refused connection,
  a non-2xx or a non-JSON body is a non-blocking error shown in the
  transcript.
- Stdout of a command hook on exit 0 enters the model's context for
  UserPromptSubmit, SessionStart and a few others. A hook must print
  nothing.
- Events used here: PreToolUse, PostToolUse, PostToolUseFailure
  (tool_name, tool_use_id, duration_ms), SubagentStart, SubagentStop
  (agent_id, agent_type), UserPromptSubmit, Stop, PreCompact, PostCompact
  (trigger), SessionStart (source, model), Notification
  (notification_type). Payloads also carry prompt text and tool input and
  output, which the app drops on receipt.

## Claude Code transcript

- `$CLAUDE_CONFIG_DIR/projects/<slug>/<session>.jsonl`, slug =
  cwd with every non-alphanumeric byte replaced by `-`. The path also
  arrives in every hook and statusline payload.
- Assistant lines carry `message.id`, `message.model`, `message.usage`
  (`input_tokens`, `cache_creation_input_tokens`,
  `cache_read_input_tokens`, `output_tokens`). One response spans several
  lines that repeat the usage: deduplicate by `message.id`.
- Subagents write `<session>/subagents/agent-<id>.jsonl`.
- The /context per-category breakdown reaches only SDK clients
  (`getContextUsage`). No pty-side channel carries it.

## Auto-compact rule (from the binary)

W = compactWindow - min(maxOutputTokens, 20000). Compaction at W - 13000,
warning 20000 earlier. compactWindow, highest first: env
`CLAUDE_CODE_AUTO_COMPACT_WINDOW`, `--autocompact`,
`modelSettings.<model>.autoCompactWindow`, `autoCompactWindow`, capped at
the model window. Example: 1,000,000 window, no override: 967,000.

## OpenTelemetry (not used)

`CLAUDE_CODE_ENABLE_TELEMETRY=1`, `OTEL_METRICS_EXPORTER=otlp`,
`OTEL_LOGS_EXPORTER=otlp`, `OTEL_EXPORTER_OTLP_PROTOCOL=http/json`,
endpoint env. Metrics every 60 s and logs every 5 s by default. See
decision 0009 for why the app does not use it.

## Codex

- Rollout: `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-<local stamp>-
  <thread_id>.jsonl`, `CODEX_HOME` defaults to `~/.codex`. Lines are
  `{timestamp, type, payload}`. First line `session_meta` (id, cwd,
  source, cli_version).
- Usage: `event_msg` with `payload.type == "token_count"`,
  `info.{total_token_usage, last_token_usage, model_context_window}`,
  `rate_limits.{primary, secondary}.{used_percent, window_minutes,
  resets_at}`. TokenUsage: input_tokens, cached_input_tokens,
  output_tokens, reasoning_output_tokens, total_tokens.
- Tools: `response_item` of type function_call, custom_tool_call,
  local_shell_call, web_search_call.
- A session with subagents writes one rollout per subagent thread, so
  the newest file is not reliably the session's.
- Codex 0.162 runs the TUI through a shared app-server daemon (`codex
  agents` browses its sessions). The daemon, not the CLI's process
  tree, holds the rollout open, so `/proc/<pid>/fd` of the child tree
  rarely shows it. Such a thread's `session_meta.source` can read
  `vscode` rather than `cli`.
- Measured live on Codex 0.162.1, 2026-10-12 (one new session, then
  `codex resume --last` of it):
  - A new thread's rollout file is created at its first prompt, not
    when the TUI starts: born 10 s after the thread, as the prompt was
    sent. Until the first prompt there is no file to find.
  - `session_meta.payload.timestamp` is the thread's creation, the
    stamp in the file name. The line's top-level `timestamp` is when it
    was written, at the first prompt.
  - `resume --last` appends an `event_msg` of type
    `thread_settings_applied` to the old rollout 1.7 s after launch,
    before any prompt, and writes no second `session_meta`.
- Flags: `-s read-only|workspace-write|danger-full-access`,
  `-a on-request|never`.

## Butterchurn

butterchurn 2.6.7 is MIT. butterchurn-presets is MIT by its packager, but
the MilkDrop authors' licensing of the presets is unconfirmed, so the
project ships its own presets. `render({audioLevels: {timeByteArray,
timeByteArrayL, timeByteArrayR}})` takes synthetic Uint8Array(1024) data
centred on 128 with no AudioContext. Preset equations compile through
`new Function`, so the viz page needs `'unsafe-eval'`.
