# Chapter 2: What to run, and what to call it

*Posted Wednesday, October 14, 2026, at 4:29 PM*

![A command typed in a terminal, over three boxes: what to run, what to call it, and where its files go](heroes/02-command-line.png)

Using skindeep is meant to feel as if nothing changed.
You type claude-skins where you would type claude,
or codex-skins where you would type codex,
and the rest goes straight to the program.

When a program quits, it hands back a small number,
with zero meaning "all good,"
and skindeep always hands back the program's own number.
When something fails before the program starts,
127 means it wasn't found,
126 means it couldn't start,
and 125 means the fault is skindeep's own, such as a broken skin.

The window's label is worked out from what is running, never typed in.
Claude on its usual settings folder is labeled claude,
and on a second settings folder kept for work, claude [work].
If people could type their own label,
anyone could call any program claude [work],
and the label would stop meaning anything.

The thin bar across the top shows the full command that is really running,
exactly as Linux reports it.
The first version looked while the program was still starting,
so the bar could briefly show the little helper that starts the program.
Now the bar begins with the exact command the app launched,
then it follows what Linux reports.

Filed under: names, honesty, small fixes
