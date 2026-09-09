---
"@kud/gh-workflow": minor
---

A merge conflict is not a verdict on the code, so it no longer evicts a review that was asked of you.

The Review tab is `review-requested:@me` — GitHub stating outright that the next move is yours. `whoseMove` never reads that assertion directly, though: the standing only indexes `YOURS`, and the health token decides. So the four tokens missing from the `queued` row were four ways for GitHub's own request to become invisible, and `computeHealth` ranks two of them first and second, above everything else a PR could be carrying.

`conflict` was the wrong one to be in that group, and the line it sat on the wrong side of is one this codebase already draws. `isFailCheck` separates a check that reached a bad verdict from one that reached none at all, because a verdict means the code was examined and found wanting. CONFLICTING is not a verdict: nothing was examined, nobody decided anything, and the ordinary cause is a third party merging something else while this PR sat still. The diff you were asked to read is the same diff after the rebase, which makes "reviewing it is wasted" — the whole claim the `queued` column makes when it declines a row — false here.

The cost was larger than one token, because of where the ladder puts it. A conflicted PR carrying an unresolved thread addressed to you never surfaces as `threads`; `conflict` collapses it on the way past, and the row you owed a reply on was filed under Their move for a reason unconnected to the reply.

`ci-fail`, `changes-req` and `draft` are unchanged and stay the author's. The 2026-08-26 case that put them there was real — 20 rows in the Review tab, 18 of them red builds, conflicts and drafts, interleaved with the two that could be reviewed — and reading a red build as the author's problem is what made that tab usable. That reading was an observation rather than a principle, and this is the third of it that observation did not support.

Both ends stay pinned: `bands.test.ts` now separates the token that flips with your side of the PR from the one that does not, and the last-word guard from 2026-08-27 keeps its `authored` scope untouched.
