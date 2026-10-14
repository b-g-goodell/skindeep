# 0029 The issue board in the sessions dashboard

Status: accepted 2026-10-12, the last slice of the agent manager, under
the maintainer's ruling of 2026-10-12: "i'm imagining this as a thin wrapper
around claude code so it should have identical functionality as claude
code (to the extent possible)."

## Context

The agent manager asks for a graph of the issues opened and closed on each
session's project board. Reading a board needs the user's forge login,
and the app had promised never to read a credential (decisions 0009,
0027). The maintainer's ruling settles it: the app has the access the user's
own Claude Code session has, through the same tools, and no store or
token of its own.

## Decision

- A session's project is the git remote `origin` of its folder, as git
  reads it (`git -C <folder> remote get-url origin`). An https remote, or
  an ssh or scp-like one, names its forge on https. A user or password
  in the URL is dropped. A plain http remote is read only on the loopback
  host, so the live check can run a fake forge. A file path, another
  scheme, or a path that is not `owner/repo` has no board.
- github.com is read through `gh issue list --repo O/R --state all
  --json createdAt,closedAt --limit 500`, with the user's own gh login,
  which gh keeps to itself.
- Any other host is taken as Gitea: `GET /api/v1/repos/O/R/issues?
  state=all&type=issues&limit=50&page=N` on that host, pages until a
  short one, at most 10. The token is the password `git credential fill`
  gives for that host, as git itself would use it. It is sent as an
  `Authorization`
  header to that host alone, no redirect is followed, and it is dropped
  after the read: never written to disk, never logged, never sent to the
  page. `tea` is not used: the API needs nothing more installed.
- Nothing prompts. git and gh run with `GIT_TERMINAL_PROMPT=0`,
  `GH_PROMPT_DISABLED=1`, no `GIT_ASKPASS` or `SSH_ASKPASS`, and
  `core.askPass` empty. stderr of both is dropped unread. A credential
  helper that itself asks, such as a locked keyring's unlock dialog, is
  the helper's, as it would be for git.
- A miss, no remote login, a gh or git error, a timeout or a status
  other than 2xx, shows `no access` in the board column, logged once
  with its reason and the remote, never a token. A host with no login
  gets no request.
- Each remote is read at most once per 5 minutes, and only while a
  dashboard tab asks, by every session of that remote together, in a
  cache per window that a dashboard opened again keeps.
- Only counts leave `app/board.js`: per local day of the last 14, today
  last, the issues open at its end and those closed in it. The dashboard
  draws a board column per row, headed `open / closed`: a
  sparkline of the open issues and `N / M`, open now and closed in the
  14 days, with both spelled out on hover, `no access`, or nothing for a
  session with no project. It is as narrow as the other columns, so the
  folder keeps its room, and the folder's full path shows on hover.

## Why

Claude Code reads an issue list the same way: gh with its login, or
git's credential helper for a Gitea API, through the commands the user
already set up. Reading through them gives the app no access the session
lacks and keeps no credential the user did not already keep.

## Rejected

- A token the app keeps, or one the user hands it in a setting: a store
  of the app's own, which a thin wrapper does not need.
- No credential at all, public boards only: a private board, the usual
  case, would show nothing.
- An anonymous read of a host with no login: a request with nothing to
  gain for a private repository, and two code paths for one board.
- git-bug: a board inside the repository, not the forge's, which none
  of the sessions' projects here keep.
- Following redirects: the header could reach another host.
