---
"@kud/gh": minor
---

The inbox can be confined to named accounts with a new `owners` option, applied as `user:` qualifiers on every search. A login that authors work and personal PRs alike used to fetch both and throw half away, and on one such account that wasted half was what pushed the request past GitHub's proxy into a steady HTTP 502, so the board never loaded. Under `owners` the sources that only mean "repos I own" are no longer asked, since beside the owner qualifiers they would widen the search rather than narrow it. Separately, your own PRs are now fetched 25 at a time instead of 100, because a 100-row page with full check and review detail took close to the proxy's eleven-second limit by itself; the page ceiling rose to match, so up to 500 PRs are still shown.
