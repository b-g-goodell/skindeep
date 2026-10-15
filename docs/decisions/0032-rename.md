# 0032 A session's name in its tab

Status: accepted 2026-10-14 (maintainer).

## Context

A tab's title was its derived label, the command's name and the profile
mark (decision 0004), set once and never changed. A user who names a
session with Claude Code's `/rename` saw no change in the strip, and
had no way to name a tab from the app.

## Decision

- A tab shows its session's name as the CLI's own record gives it, else
  the name given in the tab, else the derived label. The window title
  and the visualization's follow the active tab's shown name as they
  follow its label, within the strip's 100 ms refresh.
- Claude Code 2.1.296 records a `/rename` twice (read 2026-10-14 from
  the maintainer's profile): a transcript line
  `{"type":"custom-title","customTitle":NAME,"sessionId":ID}`, and
  `<project>/<session id>/custom-title.json` holding
  `{"customTitle":NAME}` beside the transcript. The session core reads
  the line from the transcript it already follows, for a tab the app
  started and for a monitored session alike (decision 0027). A line
  whose `sessionId` is another session's is passed over, the name is
  cut at 120 characters, and a new session (a `/clear`) clears it. The
  json file is not read: the transcript carries the same name and is
  already open.
- Codex CLI 0.162.1 keeps thread names in
  `<CODEX_HOME>/session_index.jsonl`, one line
  `{"id":THREAD,"thread_name":NAME,"updated_at":TIME}` per naming, the
  last line of a thread winning (measured 2026-10-14 on the maintainer's
  file: 92 lines, 76 threads, of 365 rollouts since the index began, so
  a name is not given to every thread). The index does not tell a name
  the user typed (Codex's "Rename thread" prompt) from one Codex gave,
  and the Codex UI shows both the same, so a Codex tab shows whichever
  stands. The adapter reads the index every 5 s, and only when its size
  or mtime changed.
- A right click on a tab in the strip opens a drop-down of one entry,
  Rename. Rename puts an input in the tab's place with the shown name:
  Enter commits, Escape cancels, leaving the field commits. The strip
  holds its redraw while the drop-down or the input is open, as it does
  during a drag. The strip shows from the second tab (decision 0023),
  so a window of one tab is renamed through the CLI alone. An empty
  name is a cancel.
- A name given in the tab is kept with the record's name at that
  moment, so the newer of the two shows: a `/rename` made later wins,
  and a name given in the tab after a `/rename` wins over it.
- Open point, decided: a name given in the tab of a Claude session the
  app started goes into the CLI's own record, the transcript line and
  `custom-title.json`, so the CLI's `/resume` picker shows it too, by
  the thin-wrapper rule (the app uses what the CLI leaves). The
  transcript line is appended once the session id and transcript are
  known. Claude Code holds no file descriptor on the transcript between
  its writes (measured 2026-10-14: no running `claude` of the maintainer's
  held a `.jsonl`), so one appended line cannot tear one of its own. The
  json file is written through a temp file and a rename. A monitor tab
  is read-only (decision 0027) and writes nothing. A Codex name stays
  the app's own: Codex also keeps thread state in sqlite, and which
  store its picker reads is unmeasured, so the index is read and not
  written.
- The adapter report (decision 0021) gains `title`, the probe each
  tab's shown `title`, and the live check `scripts/checks/rename.js`
  drives both parts with the fake agent, which records a typed
  `/rename NAME` as the real CLI does.

## Why

The CLI already keeps the name, in a format read from its own files, so
reading it keeps the app a thin wrapper and the tab honest. Writing the
same record from the tab gives one path for the title: whatever the
record says, the tab shows, and the picker agrees.

## Rejected

- The name in the identity strip or as the label's replacement
  everywhere: the strip names the command line and folder, which a name
  does not replace. Labels stay derived (decision 0004).
- Reading `custom-title.json` instead of the transcript line: a second
  file to watch, with nothing the line lacks.
- A store of the app's own for names, surviving the tab: a session's
  name belongs to the CLI's record, and a tab with no record keeps its
  name for its life, as asked.
- Writing Codex's index: unmeasured whether Codex reads it back.
- More entries in the drop-down: not asked.
