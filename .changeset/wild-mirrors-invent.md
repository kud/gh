---
"@kud/gh": minor
---

Add `buildInboxQuery` — the account-wide "what's on my plate" query in one
GraphQL round-trip: my PRs, review requests, reviews given, assigned work,
issues and PRs on my repos, and recently closed.

Extracted from ambre's cockpit, where it was the last piece of shared GitHub
logic still living in a consumer. Query only — assembling the result into
sections stays with the surface, since a terminal inbox and a web dashboard
group the same rows differently.

Two changes on the way across: `repo` and the done-window are now named options
(`buildInboxQuery({ repo, doneWithinDays })`), and the window date is computed
per call rather than at module load — a long-running server would otherwise
freeze "recently done" to the day it booted.
