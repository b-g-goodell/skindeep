# 0008 Finding and switching skins

Status: accepted 2026-10-11, identity rule added 2026-10-12, the menu
moved to the skin's button and the default to the last skin used by
decision 0022 the same day.

## Context

Both sample skins must load and switching between them must work, seen
in screenshots. A broken skin fails loudly, naming the file and field.

## Decision

- Skins live in `<repo>/skins/<name>/`. `--skin` takes a name from there
  or a path to any skin directory, which serves skinners.
- Default skin: `deck`, where no last skin used is recorded (decision
  0022).
- Identity: a skin's id is its name. A shipped skin's manifest name
  equals its directory name (a test checks it). A skin opened by path
  takes its manifest name as its id, and when a shipped skin has that
  name, the path skin replaces it for the rest of the run. The menu then
  shows the id with the path skin's folder, so the replacement is never
  hidden. Opening the shipped folder itself restores the shipped skin.
  `app/skins/registry.js` holds the rule.
- Runtime switch: the skin's menu button (decision 0022) opens an
  app-owned DOM menu, above the skin and below the strip, listing the
  skins (a path skin with its folder) and the viz toggle. Selecting the current skin reloads it from disk, manifest and
  files, which serves a skinner editing it. It is DOM, not a native
  popup, so a headless capture shows it and a test can click it.
- A skin that fails validation at launch: the error goes to the caller's
  stderr (fd 3) in the form `skins/x/skin.json: widgets[3].bind: unknown
  metric "foo"`, and the app exits 125 before spawning the CLI.
- A skin that fails at runtime switch: the current skin stays, and the
  menu area shows the same error text.

## Why

A DOM menu can be captured and clicked headlessly. Exiting at launch is
the loud failure the requirements ask for, and keeping the current skin on a
runtime failure never drops a live session.

## Rejected

- Collisions refused (one namespace): a copy of a sample skin, a
  skinner's likely first step, would not load until renamed.
- The directory as identity and the name a label (maintainer, 2026-10-12):
  opaque ids in `skin://` and two entries of one name in the menu.
- A native context menu: capturePage cannot show it and Playwright
  cannot click it.
- An XDG data directory of user skins: `--skin PATH` covers it.
- Running with a fallback skin on a launch failure: hides the error.
