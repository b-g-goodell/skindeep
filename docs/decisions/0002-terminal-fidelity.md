# 0002 Terminal fidelity

Status: accepted 2026-10-11, revised 2026-10-12 for the tab shortcuts
(decision 0023).

## Context

The pane must behave as a plain terminal: truecolor, resize, mouse,
bracketed paste, copy and paste, Ctrl-C and Esc, links through xdg-open,
wide characters. The app may never inject input or rewrite output.

## Decision

- Bytes: node-pty with `encoding: null`. The renderer writes the raw
  `Uint8Array` to `term.write`, whose UTF-8 decoder handles sequences
  split across chunks. The pane shows the CLI's bytes, nothing else.
- Env: `TERM=xterm-256color`, `COLORTERM=truecolor`.
- Width: the Unicode 11 addon.
- Renderer: the WebGL addon, falling back to the DOM renderer when it
  fails to load or loses its context.
- Menu: `Menu.setApplicationMenu(null)` before the first window, so no
  default accelerator (Ctrl+W, Ctrl+R, Ctrl+Q, Ctrl+Z, zoom) eats a
  terminal key.
- Keys: everything goes to the pty except Ctrl+Shift+C (copy),
  Ctrl+Shift+V and Shift+Insert (paste), and the tab shortcuts
  Ctrl+Shift+T, Ctrl+Shift+W, Ctrl+Tab and Ctrl+Shift+Tab (decision
  0023).
- Selection: copied to the X PRIMARY selection on change. Middle click
  pastes through Chromium's native handler, which xterm.js uses, so the
  app adds no handler of its own.
- Paste: through `term.paste`, which honours bracketed paste mode.
- Drop: a dropped file pastes its shell-quoted path through `term.paste`,
  as gnome-terminal does. Navigation and `window.open` are denied.
- Links: web-links addon and an OSC 8 `linkHandler`, opened on Ctrl+click
  by spawning `xdg-open` with an argv array, http, https and file URLs
  only.
- `spellcheck: false`, so Chromium fetches no dictionaries.

## Why

Raw bytes make "byte for byte" literally true. The default Electron menu
binds keys a terminal needs, and its absence is visible only on a real
display, since capturePage renders web contents alone.

## Rejected

- String decoding in node-pty: correct in practice but not byte for byte.
- An app middle-click handler: Chromium already pastes PRIMARY, so it
  would paste twice.
- Plain click on links: collides with the CLI's own mouse handling.
