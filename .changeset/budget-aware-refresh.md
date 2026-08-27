---
"@kud/gh-ink": minor
---

The inbox knows its own API budget, and stops spending yours

GitHub answers `rateLimit { cost remaining resetAt }` **inside** the query
response, for free. The cockpit asked for it on every fetch and threw it away —
so it could exhaust a 5,000-point budget without ever mentioning it, and the
first sign was an action failing.

The fetcher may now return that as `budget`. Given it:

- **Automatic refreshes decline themselves** when fewer than two fetches remain.
  Launch-with-stale-cache and mutation-signal refreshes are the ones spending on
  your behalf; `r` is never gated, because a budget is a reason to stop spending
  it unasked, never a reason to refuse what you asked for. The pause is stated on
  screen — silence is indistinguishable from an inbox with nothing new.
- **The header warns** below eight fetches, red at zero. Silent above that: a
  counter on a healthy account is noise in a header already carrying four things.
- Priced in whole **fetches**, not points. "1,847 points" needs dividing before
  it means anything; "16 fetches left" is already the answer.

Cached to disk (cache version 3), because the budget is shared by every instance
and every other tool on the account — so the useful reading is the most recent
from anywhere, and a cockpit launching cold needs it *before* its first fetch,
the one moment it has no response to read it from.

Never from `GET /rate_limit`. That endpoint is served from replicas that do not
share state: on 2026-08-27 it reported `used: 0, remaining: 5000` while GraphQL
refused every call, and returned `used` values that *decreased* between two reads
one second apart.
