# skindeep design

Status: current, 2026-10-14. User documentation is `README.md`, the skin
format `docs/SKINS.md`.

Contents: Goal, Architecture, Decisions.

## Goal

A Winamp-style skinnable GUI shell for terminal coding agents on Linux.
`claude-skins` and `codex-skins` open the real, unmodified CLI in a
skinned window with live animated gauges fed by side channels, and a
visualization window, in any of four sample skins, one of which plays
quiet sounds of its place.

## Architecture

    bin/skinned  (sh: fd 3 = caller stderr, Electron stderr -> log)
        |
    Electron main process  (app/main.js)
        |-- cli.js        options, command resolution, exit codes
        |-- identity.js   label, title, /proc cmdline for the strip
        |-- runtime.js    per-pid runtime dir, userData, cleanup, logs
        |-- tabs.js       the window's tabs: order, the active one, the
        |                 app's end with the last tab's status
        |-- profiles.js   the config dirs New tab... offers, found, recorded
        |-- argv.js       New tab...'s command line split into words
        |-- sessions.js   the live agent sessions of this user, from /proc,
        |                 and the transcript or rollout of each
        |-- monitor.js    a read-only tab of a session started elsewhere
        |-- dashboard.js  the sessions dashboard's tab: samples every
        |                 session, history.js keeps the last 60 min
        |-- board.js      each session's issue board, read with the
        |                 user's gh login or git's credential helper
        |-- session.js    one tab's CLI child: adapter order, spawn, one
        |     |           kill policy, its exit status, its strip state
        |     `-- pty     node-pty, raw bytes, SIGHUP to the group on close
        |-- view.js       the main window as the modules see it, the
        |                 window-gone check once
        |-- metrics/      per tab: bus (named metrics, null = no data) and its
        |     |                writer: sources, rates, defaults, reset
        |     |-- agent.js     the adapter seam: dispatch, one object
        |     |                at the Session, Generic beside the agent,
        |     |                the one clock that polls them all,
        |     |                the options a new tab carries
        |     |-- carry.js     the option picker each provider's
        |     |                carry.js table feeds
        |     |-- generic.js   /proc tree CPU and RSS, pty rates, idle
        |     |-- plain.js     the adapter of any other CLI
        |     |-- tail.js      a followed JSONL file, read when polled
        |     |-- proc.js      the child's process tree
        |     |-- claude/      hook server (HTTP, 204), settings writer,
        |     |                statusline receiver, transcript tail, the
        |     |                session core, the compaction rule
        |     `-- codex/       rollout discovery and parser
        |-- skins/        manifest loader and validator, skin:// protocol,
        |                 the last skin used of each window
        |
        |-- main window renderer (app/renderer/)
        |     identity strip | tab strip from the second tab |
        |     contained skin wrapper > shadow root (panels, widgets) |
        |     one xterm.js pane per tab at the manifest insets |
        |     the skin's menu button > DOM drop-down (tabs, open skin,
        |     skins, viz toggle and modes, mute, housekeeping) |
        |     New tab... dialog |
        |     the skin's declared sounds (sounds.js)
        |
        `-- viz window renderer (app/viz/), one pane per tab
              receive-only numeric feed, the mode main chose, the
              sound output's samples when asked (app/viz/sound.js) ->
              synthesiser -> butterchurn (own presets) or Canvas2D
              (scope, classic analyzer, AVS ports)

    claude child  <-- --settings <state>/settings/<hash>.json
        statusLine: node app/relay/statusline.js <root> <chain>
                    (runs the profile's own statusline in parallel)
        hooks:      python3 app/relay/hook.py <root>
        both post to <root>/pids/<pid of the tab's CLI>, found by
        ancestry, a link to the tab's Unix socket

Data flow: each tab's pty bytes go to its xterm.js unchanged. Side
channels (statusline JSON, command hooks, transcript JSONL, Codex rollout,
`/proc`) feed the tab's bus. The active tab's bus pushes snapshots at
10 Hz to the main renderer (widgets) and a numeric frame to the viz. Nothing flows back into the pty but the user's
own keys, pastes and mouse reports.

## Decisions

| No. | Decision |
| --- | --- |
| [0001](decisions/0001-stack.md) | Stack and process model |
| [0002](decisions/0002-terminal-fidelity.md) | Terminal fidelity |
| [0003](decisions/0003-launcher.md) | Launcher, commands, exit status, stderr |
| [0004](decisions/0004-identity.md) | Identity strip and window title |
| [0005](decisions/0005-skin-isolation.md) | Skin isolation: data, not code |
| [0006](decisions/0006-skin-layout.md) | Skin layout model and manifest shape |
| [0007](decisions/0007-widgets.md) | Widget set and animation |
| [0008](decisions/0008-skin-switching.md) | Finding and switching skins |
| [0009](decisions/0009-claude-channels.md) | Claude Code side channels |
| [0010](decisions/0010-statusline-relay-and-chain.md) | Statusline relay and chaining |
| [0011](decisions/0011-metric-vocabulary.md) | Metric vocabulary |
| [0012](decisions/0012-context-gauge.md) | Context gauge and distance to auto-compact |
| [0013](decisions/0013-codex-channel.md) | Codex side channel |
| [0014](decisions/0014-generic-meters.md) | CLI-agnostic meters |
| [0015](decisions/0015-visualization.md) | Visualization window |
| [0016](decisions/0016-runtime-lifecycle.md) | Runtime files and lifecycle |
| [0017](decisions/0017-assets.md) | Assets, fonts and their licenses |
| [0018](decisions/0018-install.md) | install.sh and uninstall.sh |
| [0019](decisions/0019-tests.md) | Tests and dev tools |
| [0020](decisions/0020-statusline-default.md) | Statusline injection default |
| [0021](decisions/0021-agent-adapter-seam.md) | Agent adapter seam |
| [0022](decisions/0022-file-menu.md) | The File menu and the last skin used |
| [0023](decisions/0023-tabs.md) | Tabs in one window |
| [0024](decisions/0024-skin-sounds.md) | Skin sounds |
| [0025](decisions/0025-new-tab-chooser.md) | New tab... with another agent, profile or folder |
| [0026](decisions/0026-reopen-duplicate.md) | Reopen closed tab and Duplicate tab |
| [0027](decisions/0027-agent-sessions.md) | Agent sessions and the read-only monitor tab |
| [0028](decisions/0028-sessions-dashboard.md) | The sessions dashboard |
| [0029](decisions/0029-issue-board.md) | The issue board in the sessions dashboard |
| [0030](decisions/0030-background-sessions.md) | Background sessions, subcommands and the last screen |
| [0031](decisions/0031-fuzz.md) | Fuzz testing with written predictions |
| [0032](decisions/0032-rename.md) | A session's name in its tab, by /rename or a right click |
| [0033](decisions/0033-dials.md) | Readouts open dials on the sessions dashboard |
| [0034](decisions/0034-checklist.md) | The agent's task list in a list widget |

Channel facts: `docs/research/side-channels.md`.
