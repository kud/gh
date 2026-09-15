---
"@kud/gh": minor
"@kud/gh-workflow": patch
---

The review-thread window is anchored at the **newest** threads. It was taking the oldest, which made a busy pull request read as clear while a reviewer was waiting.

`first: N` on a Relay connection returns the OLDEST N, and the inbox had been asking that way since the window was introduced. Verified on `kud/ambre#69`, which carried 67 review threads and was open for eleven days: `reviewThreads(first: 3)` returns threads first commented on at 2025-08-12, while `last: 3` returns 2025-08-20 and 2025-08-23. For the whole time that pull request sat in the inbox, the mapper was handed the oldest 50 and never saw the newest 17 — and its newest ten alone carry eight unresolved threads.

Both consumers in `@kud/gh-workflow`'s `map.ts` were wrong, in different directions and both in the unsafe one. `conversationOf` builds `lastEventAt` as a max over thread comment times, so the whose-move clock read stale by days on exactly the pull requests with live discussion. Worse, `computeHealth` tests `unresolvedThreads > 0` — and threads get RESOLVED over time, so sampling the oldest end systematically sampled the threads most likely to be resolved already. The token fell through to `waiting` or `approved` and the row read clear. A false `threads` costs a glance; a false clear costs a missed review.

`last` biases both the other way, and costs exactly what `first` cost at the same window size. The query-side pin lives in `@kud/gh`'s `inbox.test.ts` and the consumer-side pin in `@kud/gh-workflow`'s `map.test.ts`, so they fail together if the anchor is ever swapped back for symmetry with the other windows in that file — a change that would compile cleanly and silently reintroduce the false clear.

`GHDetail` also gains `threadsSampled`, how many threads the fetch actually returned, beside the `threadsTotal` that now reads the connection's own count. Two numbers rather than a truncation flag, so a consumer can say how many it is not showing rather than only that something was cut. One honest limit remains: `totalCount` counts resolved and unresolved alike and GitHub offers no `isResolved` argument, so `unresolvedThreads` past the window is permanently a sample.
