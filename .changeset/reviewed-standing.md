---
"@kud/gh-ink": patch
---

Fix the whose-move band on the Reviewed tab

`reviewed` was classified as an ordinary reviewer tab, so "awaiting review",
"checks running" and "approved" all landed under **Your move** there. Its search
is `reviewed-by:@me -author:@me -review-requested:@me` — that last exclusion means
GitHub is provably not waiting on you, and a PR you reviewed that gets
re-requested leaves the tab for `review`. The band was claiming work that was
certainly somebody else's.

`whoseMove` now reads three standings rather than two — `authored`, `queued` and
`spoken` — and on `spoken` only `threads` (your reply is owed) is yours. An
unrecognised tab defaults to `queued`.
