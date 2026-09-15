---
"@kud/gh": minor
"@kud/gh-workflow": patch
---

The inbox windows `reviewThreads` at `first: 10` and selects `totalCount` beside it, taking the whole query from 114 points to 34.

The window was `first: 50` because fifty is a round number. It is also the dominant cost on every PR-bearing source, because it multiplies beneath five searches at once — the same multiplication the `myPRs` cap and the `minimal` shape were both introduced to fight, left untouched in the one selection that spends the most. Measured 2026-09-09 on a live account, the whole document, same selections that ship: `first: 50` cost 114 points at 27,230 nodes, `first: 20` cost 54, `first: 10` cost 34. Against 5,000 points an hour that is 147 loads where there were 44, on a query a naive poll has previously killed the board by refreshing.

The data never justified fifty. Across 13 pull-request rows on that account the deepest carried **two** review threads and the median carried none — nothing above ten on either PR source. Ten keeps five times the observed maximum.

`totalCount` is what makes the narrower window safe rather than merely cheap, and it is the half that has to ship with it. A window smaller than the world is the trap `sourceCoverage` already exists for one level up: count what came back, call it the total, and a truncated row reads as complete. `@kud/gh-workflow`'s `threadsTotal` now reads the scalar, falling back to `nodes.length` only for a caller whose own query omits it — so a PR carrying fourteen threads reports fourteen rather than ten. The coverage this buys is on the COUNT alone: `isResolved` beyond the window is still unseen, so a PR past ten threads can under-report unresolved ones to `computeHealth`. That is the direction to fail in, and it is why the window keeps five times the observed maximum rather than two.
