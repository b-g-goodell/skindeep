# 0004 Identity strip and window title

Status: accepted 2026-10-11, label rule revised 2026-10-12, and again
2026-10-12 to follow the dispatched adapter, for tabs (decision 0023),
and for the home directory written as ~ in the strip.

## Context

Nobody may be fooled about what runs inside. The title and a fixed strip
that no skin can hide name the wrapped command, for example
`claude [work] in claude-skins`.

## Decision

- Label: derived, never given. The basename of CMD. For a command the
  Claude adapter serves (decision 0021: `claude` or `claude_<x>`) on a
  `CLAUDE_CONFIG_DIR` other than `~/.claude`, and one the Codex adapter
  serves on a `CODEX_HOME` other than `~/.codex`, the config dir's name
  follows in brackets: its basename, or its parent's when the basename is `.claude`
  or `.codex`, without a leading dot or a `claude-` or `codex-` prefix.
  `~/.claude-work` and `~/profiles/work/.claude` both give
  `claude [work]`.
- Window title: `<label> in claude-skins`. `page-title-updated` is
  prevented. The viz window's title is `visualization: <label> in
  claude-skins`.
- Strip: a fixed-height bar at the top of the main window, outside the
  skin's coordinate space, showing the label, then the live command line
  of the child read from `/proc/<pid>/cmdline` after exec (so a flag a
  wrapper script adds is visible, as is the `--settings` the app
  injects), then the cwd. An unquoted word under the home directory is
  written with `~`, as in the cwd: the injected settings file lives
  under `~/.local/state` (decision 0030).
- The strip is app DOM, a later sibling of the skin's containment wrapper
  with a higher z-index (decision 0005). No manifest field or CSS rule
  reaches it.
- Tabs (decision 0023): each tab has its own label by the rule above,
  and tabs with one label add their folder's name in the tab strip. A
  tab cannot be renamed. The strip and the titles follow the active
  tab.

## Why

A derived label cannot be made to lie by a wrapper script. The live
cmdline shows what really runs, including flags a wrapper adds and the
settings the app injects.

## Rejected

- A free-text `--label`: anyone could title any process `claude [work]`.
- The cwd basename in place of the app name: the title names the app,
  and saying "this is a wrapper" is the point. The cwd is shown in the
  strip instead.
