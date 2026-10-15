# Chapter 11: One plug for every program

*Posted Wednesday, October 14, 2026, at 7:29 PM*

![A plug marked one tab, fitted into the Codex slot between Claude Code and anything else, with a clock above](heroes/11-seam.png)

Each tab in the window will run some program,
whether it's Claude Code, Codex, or anything else.
This chapter adds the one piece in the middle that every tab talks to.

It picks a reader by the program's name:
claude, or claude followed by an underscore and anything at all,
gets Claude's meters, and codex works the same way.
Everything else gets the plain meters from chapter 3.

Every reader answers the same six requests, always in the same order,
so nothing else has to check which reader it's talking to.
If one part breaks while getting ready,
it's shut down on the spot,
and the bar across the top says the meters are limited.
A broken part costs only its own meters, and never the conversation.

The rule for picking a reader lived in three places that disagreed.
Five separate timers drove the meters, and none was ever stopped,
so now a single clock ticks four times a second and stops when the tab closes.

Pretend versions of Claude Code and Codex
play back a made-up conversation
through the same routes the real ones use,
so skins and the visualizer can be tried out
without spending real usage.

Filed under: plumbing, testing, pretend programs
