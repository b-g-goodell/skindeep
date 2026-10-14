# Chapter 3: No data is not zero

*Posted Wednesday, October 14, 2026, at 4:49 PM*

![Five round gauges, four lit green with needles and one dark gauge marked no data](heroes/03-meters.png)

Every gauge in a skin points at one named number,
and this chapter sets up those names and the board that holds their values.

One rule shows up everywhere: a number is allowed to be missing.
Before a reading arrives, its name holds "no data,"
and the skin shows a dark gauge or a dash,
never a zero it doesn't know,
because a zero says "nothing is happening," and that can be a lie.
The cost gauge in the picture stays dark,
since a plain program has no cost.

Early on, some readings broke that rule
by starting at zero before anything was measured,
so a window that never found its data showed a row of calm zeros.
Now there is one way to write a number,
and it fills in starting values only once their source is live.

The last piece reads a growing log file.
At first it read the whole history in one go,
and on the largest conversation log on my machine, 922 megabytes,
that froze the app for more than three seconds.
Now it reads one 8 megabyte piece at a time, four times a second,
and the longest pause dropped to under 60 milliseconds.

Filed under: numbers, gauges, honesty, bugs
