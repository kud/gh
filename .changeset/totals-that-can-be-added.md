---
"@kud/gh": patch
"@kud/gh-ink": patch
---

Merged tabs report a true total, and draw it as `Issues (20/97)` instead of `Issues +129 (20)`.

Two problems, one visible and one not.

**The notation misread.** A tab whose rows are a window onto a larger result set had nowhere to say so — `Tabs` offered `label` and `count` and nothing else — so the overflow got smuggled into the label as `Issues +129 (20)`. `+` is an operator: it tells the reader to add, with nothing on screen to add it to. The arithmetic even works, which is what makes it vicious — a reader who obeys gets a real number for a question nobody asked, with no signal they have misread anything.

`@kud/ink-ui` now has a `total` field, so the notation is a fraction: part-of-whole, page 3 of 12, the most over-learned notation there is, and nobody tries to compute with a slash. It rides on a glyph rather than a hue, so it survives dimming, greyscale and colourblindness — and it keeps magnitude, which is the half that matters: `(30/37)` and `(20/149)` say very different things about how far a tab can be trusted, where a bare truncation flag says only "incomplete". It is also narrower than what it replaces. One number now means the tab is whole; two mean you are looking at a sample.

**The total was wrong.** A merged tab summed its sources' `issueCount`s, which is only valid if the sets cannot intersect — and `Issues` merged `repoIssues` with an `authoredIssues` that asked for the superset. Measured on a real account: 94 own-repo issues, 95 authored, **92 of them the same issues**. The sum claimed 189 where the truth was 97, and `+129` double-counted the overlap the same way. Overlap is the normal case rather than an edge — a plans repo you own and file into is in both sets by construction.

The fix is not to measure the overlap but to remove it: `authoredIssues` now asks for `-user:@me`, which is what the host already documented it wanted ("issues I filed on repos I don't own") and already achieved at row level by deduping. Only `issueCount` never knew. 94 + 3 = 97, and the sum is trivially right because the sets cannot intersect. `reviewed` has carried this shape all along via `-review-requested:@me`, which is why `Review` was never wrong and `Issues` was.

**The invariant, now written next to the queries:** the negations in a merged tab's queries mirror the order `pick` claims rows in. It composes at any number of sources, where measuring the overlap does not — and it is exactly what gets forgotten when a source is added.

Cost goes down rather than up. No new selection, no new request, and `authoredIssues` returns 3 rows instead of 30 — of which about 27 were duplicates thrown away, while the handful of external issues that are the source's whole purpose might not have been in that window at all. Better rows, fewer nodes.

Under a `repo:` scope the source is dropped entirely: `user:@me` is replaced rather than joined there, so the negation has nothing to name and the search degrades to a strict subset of `repoIssues` — every row discarded, paid for on every scoped fetch. Both query builders resolved the source list independently, which is precisely the shape where a change like that half-lands, so they share a `sourcesFor` helper now.

The fraction is dropped while a search or repo filter is active. `sampled.total` is what the searches matched and `count` is what this frame draws, so a filter moves the numerator and cannot move the denominator — a fraction of two different populations reads as precise and is worse than none. That decision lives in the package rather than the host because the package is the only layer that knows a filter is on, which is also why the total arrives as a number rather than baked into a label.
