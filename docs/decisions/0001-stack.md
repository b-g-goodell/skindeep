# 0001 Stack and process model

Status: accepted 2026-10-11.

## Context

The starting proposal was Electron with xterm.js and node-pty. A GTK VTE
app needs language bindings that are rarely installed, and Tauri needs
system packages. Ubuntu restricts unprivileged user namespaces, so
Chromium's sandbox fails.

## Decision

Electron 44 with xterm.js 6 and node-pty 1.1, run from the repository
with no packaging, started with `--no-sandbox`. The main process owns the
pty, the metrics bus and the side-channel receivers. Two renderer
windows: main (skin and terminal) and viz. Native window frame, so the
window manager draws the title and moves the window.

## Why

A first spike ran `claude --permission-mode default` in this stack under
Xvfb on the first try. node-pty 1.1 is N-API, so the binary built for
Node 22 loads in Electron without a rebuild. `--no-sandbox` is
acceptable because the app loads only local content and skins carry no
code (decision 0005).

## Rejected

- Tauri: apt packages, and a second language for the pty side.
- GTK VTE: language bindings few systems have.
- A local web server and a browser tab: no control of the window, worse
  focus and paste behaviour.
- A frameless window with skin-drawn title bar: more code, and the title
  is part of the identity guarantee (decision 0004).
