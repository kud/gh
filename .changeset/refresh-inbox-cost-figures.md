---
"@kud/gh": patch
"@kud/gh-ink": patch
---

Correct the inbox cost figures quoted throughout the cache and budget comments.

They said **111 points / 25,550 nodes**, which stopped being true when the own-PR search was capped at 30. The measured figures are **73 points / ~16,870 nodes**. Nothing reads these numbers, but they are the sort quoted back later, and a cache doc that overstates what a fetch costs argues for a longer TTL than the evidence supports.

The `MY_PRS_LIMIT` note still cites 111 and 25,550 — deliberately, in the past tense, since it is explaining why the cap dropped from 100. `budget.test.ts` keeps `cost: 111` as a fixture: it is a chosen constant the arithmetic hangs off, not a claim about the real query.

Also updates the TTL note, which blamed the 502s on missing the cache. The cause was asking all eight sources in one request, and `buildInboxQueries` now covers that.
