---
"@kud/gh-ink": minor
---

A real tree, a way off a review, and a refresh that stays quiet

**The tree actually branches.** Every indented row drew `└─`, so a parent with
three children drew three closing corners and no trunk. Rows now draw `├─` until
the last one, and a parent row opens its branch with `┬`. Both facts are about
the row _below_, so the list supplies them — computed against the full section
rather than the visible slice, or a window boundary would draw a corner wherever
the scroll happened to cut.

**`x` removes you as a reviewer**, on PRs where a review was actually requested
of you. This is the answer that Unsubscribe is not: unsubscribing stops
notifications and leaves every search matching, because `review-requested:@me`
does not consult subscription state, so the row comes straight back. Dropping
the request removes it at the cause. Two things can undo it and neither is a bug
here — a CODEOWNERS rule re-requests you on the next push, and a request that
arrived through a team cannot be withdrawn for one person.

**A refresh over an unchanged inbox no longer asks to be applied.** `signatureOf`
stripped `age` but not `activityAge`, and both are strings rendered from a
timestamp — so a row that said `5m` said `6m` a minute later and the clock alone
lit up `● new · r apply`. Every relative time is stripped now, and as a second
guard a signature change whose diff finds nothing added, removed or moved swaps
silently instead of asking.
