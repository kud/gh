---
"@kud/gh-ink": minor
---

Let a row carry its own whose-move standing

`GHItem.standing` ("authored" | "queued" | "spoken") now overrides the per-tab
inference in `whoseMove`, so one tab can hold rows from two searches and still
band each correctly. That is what lets a host fold "review asked of you" and
"you already reviewed" into a single tab: the two differ only in whether the ball
comes back, which is a fact about the search a row arrived from and never about
the PR.

`whoseMove` takes the standing as an optional third argument; leaving it unset
keeps the existing tab-derived behaviour. `Standing` is exported.
