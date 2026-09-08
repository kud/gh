---
"@kud/gh": minor
---

`InboxQueryOptions.limits` lets a caller override any source's `first`, so the two-tier fetch a truncated source needs is expressible from outside this file.

The cap and the SHAPE are one decision and were split across two scopes: `shape` has always been a per-call option, `SOURCE_LIMITS` is a module constant. So the one combination that answers — a hundred rows of the cheap fragment — could not be spelled at all. Measured against a live account on `reviewRequests`, 99 matching rows: the full fragment costs 11 points at `first: 20`, 28 at `first: 50`, and 502s twice at `first: 100` after ~11s; the minimal fragment at `first: 100` costs 1 point and answers in 2.1s. The 502 is the search timing out at GitHub's proxy rather than a node-count refusal — cutting the review-thread window by 65% still 502s — so no full-fragment window reaches 99, and `first: 50` is the ceiling with a foot over the line.

Purely additive: every default is unchanged, and a caller that passes no `limits` builds byte-for-byte the query it built before. `limitsFor` is exported alongside, and clamps to 1–100 rather than trusting a number GitHub would reject outright — `first: 0`, a negative or a fraction costs the whole search, not a few rows.
