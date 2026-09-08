---
"@kud/gh-workflow": minor
"@kud/gh-ink": patch
---

`whoseMove` answers `unknown` where it previously guessed, and a row may now be present without a verdict.

Every row had to resolve to `you` or `them`, so a row that could not answer still got an answer. `YOURS[position].includes(health)` with an absent health is `includes(undefined)`, which is false — and false means `them`. It failed twice, both times in the direction that looks like nothing is wrong. Every issue carries `none`, so all 44 rows matching `assignee:@me` filed under Their move while the column counting them read 0. And the two-tier fetch a truncated source needs would have filed 79 overflow rows the same way, on the exact column that was reported missing: the complaint reproduced by its own fix.

`Move` is now `"you" | "them" | "unknown"`, `GHItem.health` is optional, and `toGHItem` reports no health rather than inventing one. That second half is what makes the first honest: `computeHealth`'s ladder falls THROUGH an absent `reviewDecision`, `mergeable` and check rollup to `waiting`, so a row nobody looked at asserted "nothing red, nothing running, nobody has reviewed it" — which from the `queued` standing reads as Your move. The cheapest possible fetch produced the most confident possible verdict. `merged`, `closed`, `draft` and `none` are exempt, being readable off `state` and `isDraft`, which the minimal shape keeps.

The band sorts BETWEEN the other two, not after them. The bands rank claims on the reader's attention rather than confidence in the reading, and `them` is the one band that exists to be skipped — so a row we could not rule out outranks one we ruled out. Sorting it last would have left these rows exactly where `includes(undefined)` already had them, with a type to make it look deliberate.

It is labelled `Unclassified`, breaking the possessive pattern the other two share on purpose: a third phrase of the same shape reads as a third owner, which is precisely the misreading the band exists to prevent. `@kud/gh-ink` draws it as a muted hollow `○`, outside `healthDisplay` — `Health` is a fact about a pull request and the absence of one is a fact about the fetch, so folding it in would put it in the legend and in every exhaustive switch that has nothing to say about it.
