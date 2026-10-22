# 0001 Stack and process model

Status: accepted 2026-10-11, revised 2026-10-22 for Chromium's
sandbox (#190).

## Context

The starting proposal was Electron with xterm.js and node-pty. A GTK VTE
app needs language bindings that are rarely installed, and Tauri needs
system packages. Chromium's sandbox confines each renderer with user
namespaces, or else with its setuid-root helper `chrome-sandbox`.
Ubuntu 23.10 and later restricts unprivileged user namespaces
(`kernel.apparmor_restrict_unprivileged_userns = 1`) to binaries an
AppArmor profile grants them, and npm installs `chrome-sandbox` owned by
the user, so out of the box the sandbox cannot start and Electron
aborts.

The renderers' input is not only the app's own pages. The terminal draws
every byte the CLI prints, web pages and files the agent fetched or read
among them, through xterm.js and its WebGL addon. A skin carries images,
fonts and sounds, all decoded by Chromium's parsers, the surface of
libwebp's CVE-2023-4863 and FreeType's CVE-2020-15999. A skin someone
shares is untrusted input.

## Decision

Electron 44 with xterm.js 6 and node-pty 1.1, run from the repository
with no packaging, with Chromium's sandbox on. The main process owns the
pty, the metrics bus and the side-channel receivers. Two renderer
windows: main (skin and terminal) and viz. Native window frame, so the
window manager draws the title and moves the window.

## Why

A first spike ran `claude --permission-mode default` in this stack under
Xvfb on the first try. node-pty 1.1 is N-API, so the binary built for
Node 22 loads in Electron without a rebuild.

## Sandbox

- `install.sh` makes the sandbox start, with root once
  (decision 0018). It probes first, by `electron --version`, which
  aborts where the sandbox cannot start, so a rerun where it starts
  asks for nothing.
- Where AppArmor restricts user namespaces, Ubuntu's own route: the
  profile `/etc/apparmor.d/skindeep-electron`, `profile
  skindeep-electron "<electron>" flags=(unconfined) { userns, }` as
  Ubuntu's profile for Chrome, loaded with `apparmor_parser -r`. AppArmor
  attaches it by the path the kernel resolved, so `<electron>` is the
  checkout's `node_modules/electron/dist/electron` through `readlink -f`.
- Elsewhere, where the sandbox still fails: a setuid-root copy of
  `chrome-sandbox`. Root never opens a path the user can write: the user
  reads the helper and feeds it on stdin to one root shell, which runs
  `install -o root -g root -m 4755 /dev/stdin` into
  `/usr/local/lib/claude-skins/electron-<version>/chrome-sandbox`, a
  directory root owns. Install then removes the helper beside Electron,
  since Chromium takes the copy, by `CHROME_DEVEL_SANDBOX`, only where
  no `chrome-sandbox` sits beside the binary and the user owns the
  binary (witnessed on Electron 44.9.3: with the helper beside it the
  variable is ignored, without it Chromium names the variable's path).
  `bin/skinned`, `scripts/drive.js` and `npm start` set the variable by
  `sandbox_env` of `scripts/sandbox.sh`. npm ci and each Electron
  download put the helper back, and the next install's probe removes it
  again, with no root while the copy equals it. A helper that is a link
  or not a regular file is refused. Root is needed once per Electron
  version.
- The AppArmor profile reaches root the same way, its text on stdin,
  and root runs `apparmor_parser` from `/usr/sbin` or `/sbin`, never
  from the user's `PATH`.
- `bin/skinned` runs the same probe before any window, and where it
  fails refuses with 125, naming `install.sh` and the unsafe option.
  `scripts/drive.js` refuses the same way, so a live check runs with the
  sandbox, or with `SKINNED_UNSAFE_NO_SANDBOX=1` on a machine where it
  cannot start.
- Costs. The profile lets whatever binary sits at that path, which the
  user can write, make user namespaces: for that path it lifts Ubuntu's
  restriction. One profile name serves the machine, so an install from a
  second checkout replaces the first's profile, and the first's launches
  are refused until its install runs again. The setuid helper is
  Chromium's own, root only to make the namespaces, but root trusts its
  bytes at install time: root makes setuid whatever `chrome-sandbox`
  sits in the user's `node_modules` when install runs, so code with the
  user's rights that ran before then chooses them, and gains root by
  that install. No path of the user's is swapped under root. A
  checkout whose Electron another user owns gets no sandbox from the
  copy. Uninstall leaves the profile and the copies: `sudo
  apparmor_parser -R /etc/apparmor.d/skindeep-electron` and removing the
  file, and `sudo rm -r /usr/local/lib/claude-skins`, undo them.

## Rejected

- Tauri: apt packages, and a second language for the pty side.
- GTK VTE: language bindings few systems have.
- A local web server and a browser tab: no control of the window, worse
  focus and paste behaviour.
- A frameless window with skin-drawn title bar: more code, and the title
  is part of the identity guarantee (decision 0004).
- `--no-sandbox` by default, the choice until 2026-10-22: Electron's
  switch turns the sandbox off for every process, so any renderer bug
  would run as the user, beside the user's credentials. It stays as
  `skinned --unsafe-no-sandbox` or `SKINNED_UNSAFE_NO_SANDBOX=1`, named
  for its cost, for a machine where root is not to be had.
