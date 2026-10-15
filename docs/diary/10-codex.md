# Chapter 10: Codex, one log at a time

*Posted Wednesday, October 14, 2026, at 7:10 PM*

![A sheet of Codex's log with arrows fanning out to five readouts](heroes/10-codex.png)

Codex gives skindeep one window into its work,
which is the log file it writes for each conversation.
Every reading comes from there,
from how full its memory is
to how much of the five-hour and weekly usage limits is gone.
skindeep reads no other file of Codex's,
and nothing from any other program.

Until a log turns up, the bar across the top says the meters are waiting,
so dark gauges always come with a reason.

The worst bug only showed up with the real Codex.
skindeep will be able to duplicate a conversation into a new tab,
and Codex makes the copy itself.
But the real Codex doesn't copy the old history into the new log.
Instead, the first line of the new log points back to the original,
along with the spot where the two part ways,
so a duplicated conversation showed empty gauges until its first message.
No test caught this,
because the pretend Codex used for testing did copy the history.

Now skindeep reads the original log up to that spot,
then the new one.
After the fix, a second real copy opened with the same readings
as the conversation it came from.

Filed under: Codex, logs, copies, testing
