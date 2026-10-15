# Chapter 9: Plugging into Claude Code

*Posted Wednesday, October 14, 2026, at 6:50 PM*

![Claude Code, a go-between and the window, joined by arrows, with every message answered first](heroes/09-claude.png)

When skindeep starts Claude Code,
it adds one extra settings file to the command.
That file sets up two tiny go-betweens,
one that passes along a short note on each event
and one for the bar along the bottom.
Your own settings files are only ever read, and never edited.

Every note gets an answer of "got it" before skindeep even reads it,
so a note can never slow down or change the conversation.

Chasing a crash turned up two bugs.
Claude Code only treats a word like "attach" as a command
when it comes first,
but skindeep's extra setting went in front of it,
so typing claude-skins attach
sent Claude a message that just said "attach."
Now nothing gets added when the first word is one of Claude Code's own commands.

A conversation sent to the background keeps going after you close the window,
but its settings file lived in the window's own scratch folder,
so once the window closed, the conversation couldn't start up again.
Now each go-between traces the chain of programs that started it,
looking for a skindeep window,
and stays silent if it finds none.
The settings file also moved to a lasting folder.

Filed under: Claude Code, settings, background, privacy
