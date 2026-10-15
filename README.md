# skindeep

Skindeep Knickknacks, Instruments, and Needles, Delivering Essentially Equivalent Performance.

Winamp-style skins for terminal coding agents on Linux. Claude Code or
Codex runs, unmodified, inside a skinned window full of live gauges,
needles and lamps, beside a visualizer that pulses with what the agent
is doing. Its commands are `claude-skins`, `codex-skins` and `skinned`.

![skindeep running Claude Code in the deck skin, two tabs open, with the visualization window](docs/screenshot.png)

## What it is for

A coding agent's terminal tells you little at a glance. skindeep
puts the numbers around it: how full the context window is and how far
it is from auto-compact, what the session has cost, how much of the
five-hour and weekly limits is used, tokens in and out, the cache hit
ratio, which tools the agent is calling, how many subagents are working,
and the CPU and memory of everything the CLI started. It is also simply
fun to watch.

It stays honest about what runs inside:

- The pane is the real CLI in a real terminal, byte for byte. The app
  never types into it, never rewrites its output, never stores or
  forwards credentials, and never calls a model API itself.
- It has the access your Claude Code session has, and no more. The
  sessions dashboard reads a project's issue board with the logins you
  already set up: `gh` for GitHub, which keeps its login to itself, and
  for a Gitea host the password git's credential helper gives for it,
  sent only to that host and never written down or logged.
- A strip at the top, which no skin can hide or cover, names the command,
  shows its live command line as the kernel sees it, and the working
  directory. The window title says the same, for example
  `claude in claude-skins`.
- The meters come from side channels the CLIs offer (below). Your
  settings files are never edited.
- A skin is data: a JSON manifest, images, fonts and CSS. It cannot run
  code.

## Requirements

- Linux with a graphical desktop session.
- `git`, and `claude` (Claude Code) or `codex` (Codex CLI) on PATH.
- Node.js 22.12 or newer with npm. It runs only the install: the app
  itself runs on the Node.js built into Electron.
- `python3`, `make` and `g++`. npm compiles node-pty, the terminal
  layer, which ships no Linux binary. The app also needs `python3` on
  PATH at run time: it starts every command through a small Python
  helper.
- The fonts DejaVu Sans Mono and DejaVu Sans, which the app draws its
  own text with, and fontconfig. Most desktops have them already.

The system packages, by distribution:

| Distribution | Command |
| --- | --- |
| Debian, Ubuntu | `sudo apt-get install -y build-essential python3 git fontconfig fonts-dejavu-core` |
| Fedora, RHEL | `sudo dnf install -y gcc-c++ make python3 git fontconfig dejavu-sans-mono-fonts dejavu-sans-fonts` |
| Arch | `sudo pacman -S --needed base-devel python git fontconfig ttf-dejavu` |
| openSUSE | `sudo zypper install -y gcc-c++ make python3 git fontconfig dejavu-fonts` |

Many distributions package a Node.js older than 22.12. Without root, nvm
installs a current one into your home directory (the commands from
<https://nodejs.org/en/download>):

    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
    . "$HOME/.nvm/nvm.sh"
    nvm install 22

nvm puts that Node.js on PATH in the shell that loaded it. Run
`./install.sh` in the same shell, or load nvm again in a new one.

## Install

    git clone https://github.com/b-g-goodell/skindeep.git
    cd skindeep
    ./install.sh

`install.sh` first checks every prerequisite and, if any is missing,
lists them all, with the command for the system packages on this
distribution and where to get Node.js, then stops. Otherwise
it runs `npm ci`, downloads Electron (about 120 MB, once), checks that
Electron starts, and writes three commands into `~/.local/bin`:
`claude-skins`, `codex-skins` and `skinned`. Set `BINDIR` to put them
elsewhere. Outside the checkout it writes nothing else but the download
caches of npm (`~/.npm`) and Electron (`~/.cache/electron`).

Run `./install.sh` again after `git pull` or after moving the checkout.
`./uninstall.sh` removes the three commands and leaves the checkout.

### Installing with an agent

Tell your agent:

> Install skindeep from https://github.com/b-g-goodell/skindeep
> following its README: clone it, run ./install.sh, install whatever
> prerequisites it reports, and run ./install.sh again until it
> succeeds.

The install needs root only for the system packages, and only when
they are missing. If your agent cannot use sudo, run that one command
yourself when it asks.

## Use

Type `claude-skins` where you would type `claude`, and `codex-skins`
where you would type `codex`. Every argument goes to the CLI, the
working directory is yours, and the command exits with the CLI's own
status. When the CLI exits by itself, its last screen is left in the
terminal you started it from, as it would be without the app.
Subcommands such as `claude-skins mcp list` or `claude-skins attach ID`
run as they would without the app.

    claude-skins
    claude-skins --resume
    codex-skins
    SKINNED_SKIN=phosphor claude-skins

A session on another config directory works as it does without the app,
and the title names the directory: `CLAUDE_CONFIG_DIR=~/.claude-work
claude-skins` runs as `claude [work] in claude-skins`. `CODEX_HOME` does
the same for Codex.

In the window:

- Click the skin's menu button, three bars near the top left in every
  shipped skin, for the menu: tabs, open a skin folder, switch skin,
  show or hide the visualization, pick its mode, mute or unmute the
  skin's sounds, and housekeeping (problems of this launch, forget the
  remembered skin, open or clear the logs). Escape closes it.
- Ctrl+Shift+T opens a new tab: the same command in the current tab's
  folder, with the options that set up a session, such as `--model`,
  `--permission-mode` or `--disallowedTools`, but none of one session,
  such as `--resume`, `--continue` or a prompt. Its strip names what it
  did not carry. **New tab...** in the menu opens a tab of another
  agent, profile or folder: pick Claude Code or Codex, a profile (a
  config directory, set as `CLAUDE_CONFIG_DIR` or `CODEX_HOME` for that
  tab alone), the folder, and edit the command line it shows before it
  runs. Profiles you pick are offered again, and Forget removes one.
  **Reopen closed tab** brings back the last tab closed, resuming its
  session (`claude --resume`, `codex resume`), and **Duplicate tab**
  forks the current tab's session into a new tab beside it
  (`--fork-session`, `codex fork`). A tab with no session yet starts a
  new one, and the menu says so.
  Ctrl+Shift+W closes a tab,
  Ctrl+Tab and Ctrl+Shift+Tab move between tabs. From the second tab on
  a tab strip shows: click a tab to switch, drag it to reorder,
  middle-click or click its x to close, + for a new tab. Each tab keeps
  running in the background, and the meters follow the tab you see. The
  window closes when its last tab does, with that tab's exit status, and
  asks first when several tabs are open.
- **Agent sessions** in the menu lists every Claude Code and Codex
  session you are running on this machine, in any terminal, with its
  profile, folder, whether it is working or waiting, and how long it has
  run. Click one of this window's tabs to switch to it. Click any other
  to open a read-only monitor tab: the skin's meters follow that session
  from its transcript or rollout, and the tab never types into it.
  Closing the monitor tab leaves the session running. A Claude session
  is found exactly by the record Claude Code keeps of each running
  session, of which the app keeps the process id, its start time and the
  session id alone. A profile the app cannot tell shows as `[?]`.
  **Sessions dashboard** opens a tab that graphs them all over the last
  hour while it is open: output tokens and tool calls per minute and
  cost across sessions, and per session tool
  calls, output tokens, cost, context fill and compactions, beside the
  issues open on its project's board over the last 14 days (the git
  remote `origin` of its folder, read at most every 5 minutes).
- A plain `claude-skins` opens the skin you used last. When windows
  chose different skins at nearly the same time, it asks which.
- Click the visualization, or press space in it, to cycle its modes,
  or pick one under **Visualization mode** in the menu, which opens the
  window if it is hidden. The next launch starts in the last mode shown.
- In the terminal: Ctrl+Shift+C copies, Ctrl+Shift+V and Shift+Insert
  paste, selecting text also puts it in the primary selection, and
  Ctrl+click opens a link. A bare Ctrl+V reaches the CLI, as in any
  terminal.
- Closing the window ends every CLI in it, as closing a terminal would.

`skinned` runs any command in a window, with the full set of options:

    skinned [--skin NAME|PATH] [--statusline=always|chain-only] [--no-viz] [--mute] -- COMMAND [ARGS...]
    skinned --skin phosphor -- htop

Any command gets the generic meters (CPU, memory, output rate, idle
time). `claude` and `codex` get the rest.

Exit status: the CLI's own. 128+n when it dies by signal n, 127 when the
command is not found. When it is found but cannot run, 127 if its
interpreter is missing, else 126, as bash gives, with the reason on
stderr. 125 when the app itself fails, for example on a broken skin or
with no `python3` on PATH. Each launch writes a log, with the command it ran and its
exit status, to `~/.local/state/claude-skins/`.

## Where the meters come from

| CLI | Channel | Meters |
| --- | --- | --- |
| Claude Code | statusline JSON | context fill and window, cost, five-hour and weekly limits, cache hit ratio, model |
| Claude Code | command hooks, a small python3 helper that posts to its window | tool calls by type, prompts, turns, subagents, compaction |
| Claude Code | the session transcript | tokens in and out, cache reads and writes |
| Codex | the session rollout file | context, tokens, cache, limits, model, turns, subagents |
| any command | `/proc` and the terminal | CPU, memory, output rate, idle time, session clock |

For Claude Code the app adds `--settings <file>` to the command line: a
file under `~/.local/state/claude-skins/settings/` that registers the
hooks and a statusline relay. Your own statusline, if you have one,
still runs and still shows: the relay runs it and passes its output
through. The injected `--settings` is visible in the identity strip. If
you pass `--settings` yourself, the app injects nothing and the strip
says the meters are limited.

A session you send to the background (the left arrow, or `/background`)
keeps that option and goes on after the window closes. The hooks find
their window by process ancestry, so once the window is gone they stay
silent and the session keeps your own statusline. Picked in the
`--resume` picker, a background session opens in the tab, as it does
without the app: Claude Code refuses to open it in place while its
command line carries `--settings`, so the app runs `claude attach ID`
for it. If your own options carry session settings, such as `--model`,
Claude Code refuses without the app too, and its message is left in
your terminal.

One visible effect: Claude Code hides its `? for shortcuts` footer hint
whenever any statusline is set. If you have no statusline of your own and
want the footer untouched, run `skinned --statusline=chain-only --
claude`. Cost, limits and the cache ratio then read no data.

## Visualization

The visualization window has ten modes, all driven by a synthetic
signal built from the session's events: output bursts thump, each tool
call rings at a pitch of its own, a new prompt chirps, and the picture
calms when the agent idles. The visualization captures and plays no
audio.

- **Drift**, **Rings**, **Plasma**, **Star dust** and **Whirlpool**:
  animated presets in the style of MilkDrop, drawn by butterchurn. Star
  dust and Whirlpool are the project's own recreations of the look of
  two presets by Ryan Geiss, from his screenshots named cosmic dust and
  vortex.
- **Scope**: an oscilloscope over spectrum bars.
- **Spectrum analyzer** and **Fire analyzer**: the analyzer of Winamp's
  main window, redrawn, with its peak caps and its normal and fire
  colours.
- **Superscope** and **Dot plane**: two effects of Winamp's Advanced
  Visualization Studio, ported from its BSD-licensed source.

## Skins

Four skins come with the app:

- `deck`, a dark metal MP3-player face with green LCD readouts, needles,
  sliders and a spectrum analyzer (above).
- `phosphor`, a green phosphor console with a radar sweep.
- `library`, a reading room: shelves of books, chalk meters on a
  chalkboard, marker bars on a whiteboard, readouts on card catalog
  labels, and a green banker's lamp that lights while the agent works.
- `coffee`, a bohemian basement cafe: a chalkboard of readouts under
  string lights that flare at each tool call, handbills on a corkboard,
  a lava lamp that bubbles while the agent works, a turntable whose
  record turns while the terminal prints and whose platter rings the
  context, a tube amp whose VU meter reads tokens per second, a French
  press and jars of cold brew for the cache and the limits, mismatched
  mugs for the subagents, and the quiet sounds of the room: a murmur of
  voices and, each now and then, a mug set down, a typewriter, a pour,
  a bead curtain, a hand grinder, bongos, a needle dropped on a record,
  snapping fingers and a few bars of guitar.

Each shot below is the same earlier Claude Code session, resumed in
that skin:

| deck | phosphor |
| --- | --- |
| ![deck: a dark metal MP3-player face with LCD readouts and needles](docs/skins/deck.png) | ![phosphor: a green phosphor console with a radar sweep](docs/skins/phosphor.png) |
| **library** | **coffee** |
| ![library: shelves of books, a chalkboard and a banker's lamp](docs/skins/library.png) | ![coffee: a basement cafe with a turntable, a tube amp and a lava lamp](docs/skins/coffee.png) |

A skin's sounds play only while it is the current skin, at a low
volume. Mute them from the menu, or start muted with `skinned --mute`
or `SKINNED_MUTE=1`.

To write your own, read [docs/SKINS.md](docs/SKINS.md): a directory with
`skin.json`, images, fonts and CSS. Put it under `skins/` in the
checkout to list it in the menu, or pass its path:
`SKINNED_SKIN=~/my-skin claude-skins`. A broken skin fails at launch,
naming the file and the field. To try a skin without spending tokens,
run it on the bundled fake agent, which moves every meter, from the
checkout:

    skinned --skin ~/my-skin -- scripts/fake/claude

## Known limits

- Linux only.
- Electron runs with `--no-sandbox`: Ubuntu restricts the user
  namespaces Chromium's sandbox needs. The app loads only local content,
  and skins carry no code.
- Codex: `codex resume <id>` finds the session's rollout file exactly.
  Otherwise the app matches the directory and the time the session
  began, so two sessions started in one directory within 2 s of each
  other, or two old sessions of one directory resumed and written at
  once, may follow each other's file. `codex resume --all` of a session
  from another directory, `--worktree`, and a `CODEX_HOME` set inside a
  wrapper script rather than in the app's environment usually find no
  file, and the Codex meters show nothing. They follow a wrong file only
  when another session of the same directory matches.
- Claude Code's `/context` breakdown by category has no side channel.
  The context gauge shows uncached, cache-write, cache-read and output
  tokens instead.

## Development

    npm test

The tests cover the skin validator, the Claude and Codex parsers on
recorded fixtures, and the asset manifest. `scripts/drive.js` drives the
app through Playwright for live checks under Xvfb. The design and its
decisions are in [docs/DESIGN.md](docs/DESIGN.md), and how it was built,
chapter by chapter, in the [dev diary](docs/diary/README.md). Every font,
image and library asset is listed with its license in `ASSETS.json`.

## License

MIT, see [LICENSE](LICENSE). The fonts, images and libraries keep their
own licenses, listed in `ASSETS.json`.

skindeep is an independent project, not affiliated with Anthropic,
OpenAI or the makers of Winamp.
