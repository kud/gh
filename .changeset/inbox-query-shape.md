---
"@kud/gh": minor
---

Add `shape: "minimal" | "full"` to `buildInboxQuery`.

The inbox query costs **111 GraphQL points** against a 5000/hour budget — a nodeCount of 25,550, driven by `statusCheckRollup.contexts` appearing on five PR sources with `reviewThreads(first: 50)` multiplying beneath each. That is 45 refreshes an hour for any caller, however little of the result it reads.

`minimal` drops health, conversation and labels, keeping identity only: type, number, title, url, `isDraft`, timestamp and repo. Measured against GitHub's own `rateLimit { cost }`, that is **1 point and a nodeCount of 290** — a 99% cut, taking a poller from 45 refreshes an hour to effectively unbounded.

`full` remains the default, so every existing caller is untouched. Reach for `minimal` only when nothing downstream reads health: the fields do not degrade when absent, they vanish, and `computeHealth` resolves to a confidently wrong token rather than an empty one.

`isDraft` moves out of the health fragment into each source's base field list. It is identity rather than health, and a draft rendering as an open PR would have been a wrong answer rather than a missing one.
