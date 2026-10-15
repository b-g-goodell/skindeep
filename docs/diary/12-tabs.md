# Chapter 12: One tab, start to finish

*Posted Wednesday, October 14, 2026, at 7:51 PM*

![The top of the deck window with two tabs open and a plus sign for a new one](heroes/12-tabs.png)

Closing a tab works like closing a terminal.
skindeep tells the program to hang up,
then waits up to two seconds before it forces the program to stop.
The app ends when its last tab ends,
and the row of tabs only shows up once there's a second tab.
Ctrl+Shift+T opens a tab, Ctrl+Shift+W closes one,
and Ctrl+Tab moves to the next.

Most of the bugs were about timing.
Closing the window while Claude was getting ready
could end in three different ways,
and a race of a hundredth of a second decided which one you got:
a clean exit, a forced stop two seconds later,
or an invisible hang for as long as the program lived.
Now a close before the start always ends cleanly.

In 3 of 40 starts the hang-up went out
before the program was set up to receive it,
so now skindeep sends it to the program directly.

One test insisted the forced stop come no sooner than 2,000 milliseconds,
and in 240 runs it failed twice, with 1,999.
Two clocks were rounding down in slightly different ways,
so the test now allows a few milliseconds of slack.

Filed under: tabs, timing, bugs
