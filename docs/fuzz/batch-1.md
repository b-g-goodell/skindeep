# Fuzz batch 1

Status: collected, grouped and cut 2026-10-13, by
`scripts/fuzz/run.js` (decision 0031).

## Collected

Sixteen runs of 40 steps under Xvfb, three at a time: seeds 1001 to
1016, the four skins in turn, seeds 1001 to 1004 and 1009 to 1012 on
the fake claude, the others on the fake codex. Seeds 1004 and 1005
first ended in a harness crash: a click on the menu button timed out
behind a menu an earlier step had left open. The harness now records a
menu left open, and an action it cannot take, as findings of their
step, and those two seeds ran again. The first run of seed 1004 was
looked at before its record was replaced: at its step 16 a click aimed
at the skin "deck" left the menu open over "* coffee", the skin
unchanged.

The menu's Agent sessions list holds every live agent session of the
host, so its length during a run depends on what else runs: the
batch's own windows, the procedural modes' checks, and the maintainer's sessions.

Twelve findings, in two runs. Fourteen runs gave none.

| run | skin, agent | step | action | claim | predicted | observed | after |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1002 | phosphor, claude | 39 | skin phosphor | skin | phosphor | library | |
| 1002 | phosphor, claude | 40 | drag | skin | phosphor | library | 39 |
| 1010 | phosphor, claude | 30 | font Skin default | errors | 0 | click timed out | |
| 1010 | phosphor, claude | 35 | duplicate | errors | 0 | click timed out | 30 |
| 1010 | phosphor, claude | 36 | mode drift | mode | drift | superscope | 30 |
| 1010 | phosphor, claude | 36 | mode drift | menu | closed | open | 30 |
| 1010 | phosphor, claude | 36 | mode drift | errors | 0 | click timed out | 30 |
| 1010 | phosphor, claude | 37 | font 9 | mode | drift | superscope | 30 |
| 1010 | phosphor, claude | 37 | font 9 | errors | 0 | click timed out | 30 |
| 1010 | phosphor, claude | 38 | space | mode | rings | dotplane | 30 |
| 1010 | phosphor, claude | 39 | skin library | mode | rings | dotplane | 30 |
| 1010 | phosphor, claude | 40 | click | mode | plasma | drift | 30 |

## Groups

### A. The menu runs past the window's bottom, out of reach

Cause: `#menu` (`app/renderer/app.css:66`) has no maximum height and
no scrolling, and `open()` in `app/renderer/menu.js` places it below
the button, or at the stage's top when it does not fit, never shorter.
The Agent sessions list adds a row per live session of the host, so
with some 15 sessions the drop-down is taller than an 820 px window,
and every entry below the fold (Visualization input, Settings,
Housekeeping) cannot be clicked.

Evidence: `batch-1/1002-039-main.png`, the menu open in an 840 px
window, cut off after Visualization input. In run 1010 the clicks on
the Settings flyout (steps 30 and 37) and in the Visualization mode
flyout (step 36) timed out, and the menu stayed open (step 36).

Findings: 1010 steps 30, 36 (mode, menu, errors), 37 (errors), and the
later mode claims of 37, 38, 39 and 40, which follow from the pick of
step 36 that never happened.

### B. The sessions list moves the entries under the pointer

Cause: while the menu is open, `menu.js` refills the Agent sessions
list every 2 s (`setInterval` at `app/renderer/menu.js:183`). When a
session starts or ends in between, the list's row count changes and
every entry below it moves by a row. A click aimed at one entry lands
on its neighbour or on a rule, and the menu, which closes only after
an action, stays open.

Evidence: `batch-1/1002-039-main.png`: the click aimed at "phosphor"
left library current, the menu open, and the pointer two rows lower,
over "Hide visualization". The first run of seed 1004, step 16, the
same with "deck" aimed and "* coffee" under the pointer.

Findings: 1002 steps 39 and 40.

## Dropped

- 1010 step 35, Duplicate: its click reported a timeout, yet the
  duplicate took effect, since every tab claim of the step held. No
  replay or reading explains the timeout. It follows the mismatch of
  step 30, so the menu may have been in group A's state. Not cut.

## Issues cut

- Group A: the menu fits the window.
- Group B: the list moves no entry.

## On the fix of both

Seeds 1002, 1004 and 1010 ran again, three at a time, on the commit
that fixes both: 1002 and 1004 gave no finding, 1010 one: step 37's
font pick reported a click timeout although the size took effect, the
shape of the dropped step 35. Replayed alone to step 37 with the call
log kept, it gave none. It stays dropped, with the same reason.
