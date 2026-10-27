# 0038 Each provider's own readings: a balance and a peak price state

Status: accepted 2026-10-26, issue #211, under the maintainer's ruling
of 2026-10-12 that the app is a thin wrapper with the access of the
bare CLI, and the coordinator's ruling on the issue's questions of
2026-10-26. The live check on a real DeepSeek profile waits on the
owner's DeepSeek API key.

## Context

A Claude Code profile can run on another provider's model by pointing
`ANTHROPIC_BASE_URL` at that provider's Anthropic-format endpoint, and
Codex can by a `model_providers` entry in its `config.toml`. The CLI
stays the same, so the adapter dispatch (decision 0021) sees Claude
Code or Codex, but the account behind the session is the other
provider's. The limit readings (decision 0011) assume Anthropic or
OpenAI: such a session sends no `rate_limits`, so every skin drew no
limit, while the provider has readings of its own. DeepSeek, the one
such provider in use here, reports a prepaid balance on a read-only
account endpoint, publishes peak and off-peak prices, and caps
concurrency (`docs/research/usage-limits.md`).

Diary chapter 20 says the app never asks the internet for anything
itself. Decision 0029 already read a forge's issues with the user's own
login. This decision makes the second exception, on the same ground.

## Decision

- Two channels carry a provider's readings. What the CLI sends, the
  statusline and the rollouts, as before. And, where the provider
  documents a read-only account endpoint, one read of it by the app
  with the key the session's CLI already sends that provider. This is
  the thin-wrapper rule: the same access as the bare CLI, using what
  the CLI's environment already grants. The app asks no other host and
  keeps no credential of its own.
- The session's provider is the entry of the provider table whose
  hosts hold its base URL's host. Claude Code: `ANTHROPIC_BASE_URL` of
  the profile's settings env (managed, a `--settings` of the user's,
  local, project, user, the highest layer that sets it), else of the
  child's environment, else none: Anthropic. Codex: the `base_url` of
  the `model_providers` entry its `model_provider` names, in
  `config.toml`, a `--profile` of it, or a `-c` override; none or
  `openai` is OpenAI. A base URL is https, or http on the loopback host
  alone. A host the table does not list gets no provider readings and
  no request.
- The table is data, `app/metrics/provider/providers.json`, so a
  provider added later is a row: its id, name, hosts, its balance
  endpoint (an absolute path on the same host, the key's form, and the
  dotted paths of its fields), and its peak schedule. Anthropic and
  OpenAI are the CLIs' own entries and read nothing: their sessions
  keep today's readings unchanged. DeepSeek is the one other entry.
  `SKINNED_PROVIDERS` names another table, for the live checks, and is
  dropped from the child's environment.
- The key, read only for a listed provider with a balance endpoint,
  at each read, the way the CLI reads it. Claude Code:
  `ANTHROPIC_AUTH_TOKEN`, then `ANTHROPIC_API_KEY`, each from the
  settings env, then the child's environment, then the first line of
  the settings' `apiKeyHelper`, run by `/bin/sh` as Claude Code runs
  it, with no terminal, stderr dropped unread, 10 s at most. A helper
  that itself asks, such as a locked keyring's unlock dialog, is the
  helper's, as it would be for Claude Code, as decision 0029 rules for
  git's credential helper. Codex: the variable its provider's
  `env_key` names, else the provider's `experimental_bearer_token`. The helper and the bearer token go past
  the coordinator's ruling, which named the settings env and
  `env_key`: the profile this machine runs on DeepSeek holds its key
  in an `apiKeyHelper`, and DeepSeek's own Codex guide writes
  `experimental_bearer_token`, so without them the readings would
  never reach the sessions they are for.
- The read: `GET` of the balance path on the base URL's own scheme,
  host and port, the key as `Authorization: Bearer`, no redirect
  followed, 15 s and 1 MiB at most, at most once per 5 minutes (the
  board's refresh, decision 0029) per account, an account being the
  provider, the origin and the profile, so tabs of one profile share a
  read. The key lives in the request: never logged, never written,
  never sent to the page. A log line names the provider, the origin and
  the profile. A missing key, a status other than 2xx, a timeout or an
  answer that does not parse leaves the balance absent, logged once
  per read with its reason.
- Readings:
  - A balance: money, one item per currency, never a percent and with
    no reset. `limits.balances` is a list of `{ key, label, currency,
    amount }`, `limits.balance_available` 1 or 0 as the provider says.
    Both are absent, never 0, until a read succeeds, and again after a
    read fails.
  - A peak or off-peak price state, from the provider's published
    schedule, computed in the app with no request: `limits.peak` 1 or
    0, `limits.peak_changes_at` the next switch in Unix seconds. A
    schedule is the UTC weekdays and UTC hours of its peak and the
    holidays it skips, calendar days in a zone of its own, listed up to
    a date. Past that date the holidays are unknown, so the state is
    absent until the table lists the next year's. DeepSeek: 01:00 to
    04:00 and 06:00 to 10:00 UTC, Monday to Friday, Chinese public
    holidays off-peak, listed through 2026-12-31 from the State
    Council's notice.
  - No concurrency cap. A cap with no live count of the requests in
    flight is not a reading.
  The names sit in decision 0011's `limits.` family, which a new
  session keeps, and each is optional.
- The provider part: a part at the seam (decision 0021) beside a
  Claude Code or Codex adapter and Generic, for a session the app
  starts, not a Claude Code subcommand other than `attach`, and not a
  session the app did not start. Its prepare tells the provider and writes nothing. It
  polls on the seam's clock, writes the peak state every minute and at
  each switch, and reports a `balance` channel, waiting or live, for a
  provider with a balance endpoint.
- Every shipped skin draws them in its `limits` widget, after the
  limits and in the same rect, by the widget's `provider` option: a
  readout per currency, the amount in its currency and a note while it
  no longer pays, and a lamp lit in the peak hours with the time to
  the switch. Each is drawn only while it reads, so a session with none
  draws as before (`docs/SKINS.md`).

## Why

The key is the one the CLI already sends to that host, and the read
goes to that host alone, so the app reaches nothing the session could
not. A balance read once per 5 minutes is the board's rate, which no
provider's rate limit notices. A table keeps a provider's endpoint and
schedule out of the code, and the limits widget is where a skin
already gives a provider's limits their room, which a provider with no
windowed limit leaves free.

## Rejected

- Readings limited to what the CLI sends: a session on DeepSeek would
  draw nothing, since its CLI asks for no balance.
- A key the app keeps, or one the user gives it in a setting: a store
  of the app's own (decision 0029).
- A balance as a percent of a limit: a prepaid balance has no limit
  and no reset.
- The concurrency cap as a reading: the CLI exposes no count of the
  requests in flight, so a meter would show only a constant.
- The provider from the model's name or the statusline's payload: a
  name like `claude-opus-4` is mapped by DeepSeek's server, and the
  payload names no host.
- The peak state from a provider's header or endpoint: none publishes
  one, and the schedule is fixed text on its pricing page.
- A guess at the holidays past the list: a peak lamp lit on a holiday
  would overstate the price.
