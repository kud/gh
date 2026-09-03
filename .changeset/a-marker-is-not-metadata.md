---
"@kud/gh-ink": minor
---

A row's refresh marker is a pill, not more trailing text.

`NEW`, `GONE`, `UPDATED`, `MOVED` and `MERGED` are drawn through
`@kud/ink-ui`'s `Pill` in their existing colours, on both the ticket row and the
PR row. Nothing about the vocabulary changes: they are still words rather than
hues, because a marker that lives only in the colour is a marker a colourblind
reader does not have, and `NO_COLOR` degrades the pill to `[GONE]` rather than
to nothing.

What changes is the shape, and the shape was the bug. These markers sit at the
end of the row, immediately after the dim age, author and repo cells — so as
plain coloured text they read as one more column of trailing metadata. That is
the opposite of what they are: every other cell on the row is state you may
skip, while these are the one thing on screen reporting work that happened in
another window, and `TRANSIT_HOLD_MS` exists precisely so they survive being
NOTICED rather than merely seen. A fill is what makes them read as an
announcement about the row instead of another of its attributes.

Both width budgets charge for the caps — `pillWidth` on the ticket row, an
explicit term on the PR row. Pricing a pill by its label alone overflows by
exactly the two caps, and the frame is sized to fill the terminal, so one
column too many scrolls the whole panel rather than clipping the row. The PR
row charges for both its pills even though only one is ever non-empty (a merged
row never also says `GONE`), because a budget that leans on that invariant is
right only for as long as the invariant is.

Requires `@kud/ink-ui` 0.18.0, whose `Pill` takes an explicit fill and inks
itself legibly against it.
