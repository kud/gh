---
"@kud/gh-workflow": minor
"@kud/gh-ink": minor
"@kud/gh-cockpit": patch
---

Your own PRs band by what kind of move, not only whose.

From a review queue "your move" is one verb. On the tab of PRs you wrote it is three — merge it, work on it, finish writing it — and seven of yours under one `Your move (7)` header was true while saying nothing about which: two were green, one red, three were drafts sitting at the top because `sortItems` sinks drafts only within their repo. On the `authored` standing the two ends now peel off, ordered by cost to clear: `Ready to merge` (`approved`, which the health ladder already guarantees is green and quiet; or `waiting` on a repo you own), then `Your move`, `Unclassified`, `Their move`, and `Drafts` last. Repo grouping restarts inside each band as it always has; the review standings are untouched.

`bandOf` is exported beside `whoseMove` — the same six arguments, answering `Band`, which is `Move` plus `"merge"` and `"draft"`. The token beats the turn arrow for the two carve-outs (an approved PR whose reviewer said "squash please" is answered by merging; a commented-on draft is still a draft) and the pin beats both.
