---
"@kud/gh-ink": patch
---

The turn column draws no rightward arrow. `→` is a blank now, `←` is kept, and the row's colour literals go through the design system's tokens.

The cursor sits at column 0 and the turn cell at column 4, and both were small rightward points. The collision is not that two marks are close together — it is that they **pointed the same way while only one of them is on every row**. At scan speed the eye is asking "which row am I on", and a rightward mark four columns in, present on some rows and not others, was a second candidate answer to that question.

Substituting a different rightward glyph would patch the symptom and land on a different neighbour — `▸` beside `◆` is two filled blobs in adjacent cells. Blanking separates the pair by **direction**, which is a shape channel and therefore survives the colourblind invariant `health-display.ts` exists to enforce; a hue change would not. Nothing else on the row is a horizontal arrow — not the health map, the transit frames, the merge sparkle, the thread glyph or the tag — and the tree run `└─` is furniture two tiers down and present on every nested row, which is what makes it scenery rather than a competitor.

Nothing the cell was carrying is lost. `→` said "you spoke last, nothing is being asked of you", which is the _absence_ of a claim — and absence already draws as a blank here, exactly as `none` health does. The band header says it in words, the unresolved-thread cell is already quiet in that state, and the explain action has room for a sentence. What it buys is a sparse column whose only ink is `←`, the one state that is a claim on you.

The accepted cost, stated rather than discovered: "you spoke last" and "we never learned who spoke" now draw alike. The second is a fetch fact rather than a domain one, and neither is actionable, so it is not worth a column in the aligned zone.

Three text sites moved with it, or the interface would go on teaching a glyph it no longer draws: the two explain lines lose their `(→)`, and the `?` legend drops that row. The pin gains a legend row for the first time — it has always sat in this column while the modal documented ten health states, two arrows, and nothing about the `+` beside them. A stale reference in the pin's own explain line, still naming the `!` it was moved off when it collided with `conflict`, is corrected to `+`.

Separately, fifteen hardcoded colour literals in the row — `"cyan"`, `"red"`, `"green"` — now go through `colors.info`, `colors.error` and `colors.success`. They render identically today; the point is that a literal stops tracking the token the moment the token moves.
