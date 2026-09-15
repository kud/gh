---
"@kud/gh": minor
"@kud/gh-workflow": patch
---

The inbox windows `reviewThreads` at `last: 20` and selects `totalCount` beside it, taking the whole query from 114 points to 54.

The window was `first: 50` because fifty is a round number. It is also the dominant cost on every PR-bearing source, because it multiplies beneath five searches at once — the same multiplication the `myPRs` cap and the `minimal` shape were both introduced to fight, left untouched in the one selection that spends the most. Measured 2026-09-09 on a live account, the whole document, same selections that ship: a window of 50 cost 114 points at 27,230 nodes, 20 cost 54, and 10 cost 34. The anchor is free — `first: 20` and `last: 20` both measure 8 points on `myPRs`, so taking the window from the other end costs nothing. Against 5,000 points an hour that is 92 loads where there were 44, on a query a naive poll has previously killed the board by refreshing.

The data never justified fifty. Across 13 pull-request rows on that account the deepest carried **two** review threads and the median carried none — nothing above ten on either PR source. Twenty keeps ten times it — the step down to ten buys three more points and spends the only headroom there is against the next pull request that gets busy, and `kud/ambre#69` carried 67 threads while it was open.

`totalCount` is what makes the narrower window safe rather than merely cheap, and it is the half that has to ship with it. A window smaller than the world is the trap `sourceCoverage` already exists for one level up: count what came back, call it the total, and a truncated row reads as complete. `@kud/gh-workflow`'s `threadsTotal` now reads the scalar, falling back to `nodes.length` only for a caller whose own query omits it — so a PR carrying twenty-four threads reports twenty-four rather than twenty. The coverage this buys is on the COUNT alone: `isResolved` beyond the window is still unseen, so a PR past twenty threads can under-report unresolved ones to `computeHealth`. That is the direction to fail in, and it is why the window keeps room for a busy PR rather than for a quiet week.
