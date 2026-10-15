# Chapter 8: Who else is running?

*Posted Wednesday, October 14, 2026, at 6:30 PM*

![A list of running programs with Claude Code and Codex lit up, under a magnifying glass](heroes/08-finding-sessions.png)

skindeep can also watch a Claude Code or Codex conversation
you're running in some other terminal.

Linux keeps a live list of every running program,
with its name, its folder and the time it started,
and skindeep picks out Claude Code and Codex.
It skips the hidden values handed to a program when it starts,
which can hold a secret key.
It also skips the files that hold your login.

Codex writes one log file per conversation,
so skindeep matches the folder you're in and the time the conversation began.
Codex marks a new log with the moment the conversation began,
but it only writes the file at your first message.
So at first an idle Codex in the same folder, opened earlier but used later,
could win over yours.

Two Claude Code conversations in the same folder
started showing each other's logs.
Claude Code keeps a tiny record for each running copy,
naming its current conversation.
At first skindeep skipped that record in case it held a secret,
but the key sits in a separate file.
Now skindeep reads exactly three things from the record:
the program's number, the conversation's ID and the time it started.

Filed under: Codex, Claude Code, privacy, detective work
