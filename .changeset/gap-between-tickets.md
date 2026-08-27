---
"@kud/gh-ink": patch
---

A blank line between ticket groups, and one rule that draws it

Ticket groups ran straight into each other: the last PR of one and the ticket
line of the next sat on adjacent rows, so several small trees read as one long
list — the grouping was in the glyphs and nowhere in the spacing. A ticket row
now takes a blank line above it. PR rows still take none, or the tree under a
ticket would be pulled apart by the very spacing meant to separate it from the
next.

Also fixes a latent overflow. The gap rule existed twice — the renderer drew it,
`fitCount` priced it — and they already disagreed: `fitCount` charged two lines
for headers only, while the renderer also gapped a task following a header. Any
tab with that shape drew one line more than the window had bought, and the frame
is sized to fill the terminal exactly, so it scrolled rather than clipped. Both
now call `gapsAbove`.
