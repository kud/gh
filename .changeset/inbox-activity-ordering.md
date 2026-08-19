---
"@kud/gh-ink": minor
---

Order rows by last activity within each repo, and show both dates

`sortItems` had no time component at all — repo priority, then repo name, then
whatever order GitHub's search happened to return. Two open PRs on the same repo
could sit in any order, so a thread someone had just replied to rendered below a
quieter one opened more recently.

Recency now breaks the tie **within** a repo. The grouping is untouched: repo
priority and repo name stay the outer keys, so `insertRepoHeaders` still emits
one header per repo and no repo is scattered down the list.

`GHItem` gains an optional `activityAge`, rendered beside `age` as `3h · 2d` —
active 3h ago, open for 2d. It collapses to a single value when the two agree,
so an untouched row does not read `2d · 2d`. What counts as activity is the
surface's decision; this layer only renders what it is handed.
