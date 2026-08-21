---
"@kud/gh-ink": minor
---

A merged PR now says so before it goes. Merging from the drill view returns to the list, sparkles the row with a `MERGED` label for three seconds, then drops it — where before the row simply sat there until some later refresh quietly removed it, leaving the one action that ends a piece of work as the only one with no acknowledgement.

`DetailContext` gains an optional `onMerged`, and `HealthPanel` an optional `onMerged` prop. Both are optional: a host that wires neither keeps exactly the previous behaviour, including the post-merge reload.
