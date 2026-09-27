---
"@kud/gh": minor
---

The core can now tell a surface whether anything has moved, for a point, without reading the inbox.

A full inbox read costs tens of points of a 5000-an-hour budget, so a surface that wanted to feel live had two bad options: poll the whole thing every minute and burn the budget, or poll it every ten and show a board that was quietly out of date for most of that time. `buildPulseQuery` is the question in between. It asks for the single newest `updatedAt` across the same ground the inbox reads — anything involving you, the repos you own, and your review requests, resolved through the same `inboxScope` so the two cannot drift — plus the `mergeable` state and last-commit rollup of your own open PRs, because a check suite finishing does not move a PR's `updatedAt` and a timestamp-only pulse would sit on a green PR the board still showed as pending. Measured live, the whole document costs one point.

`pulseFingerprint` collapses the response to a string that changes when the board would and stays put when it would not: search order is ignored, and a partial response degrades to empty rather than throwing. It is a cursor, not a summary — compare it for equality and pay for a full read when it differs.

Both are also at `@kud/gh/pulse`, a subpath that pulls in nothing but the inbox builders, so a web route can import them without dragging the `gh` CLI transport into its bundle.
