---
"@kud/gh-ink": patch
"@kud/gh-cockpit": patch
---

An overlay no longer takes the list down with it. Opening the actions menu on a cockpit with no rail showing truncated every row behind it to about a dozen columns, spilled the remains outside the frame, and put the panel hard against the left edge instead of the middle — all four overlays, one code path.

The list column was sized `showRail ? listCols : undefined`, applying the rail ternary a second time after `listCols` had already answered it, and withholding the width in exactly the case where `listCols` is `COLS` and correct. With no width and an overlay up, the column's only in-flow child is the panel — the list sits in an absolutely-positioned backdrop and contributes nothing to its parent's intrinsic size — so the column measured itself against the panel. `width="100%"` on the backdrop then resolved to the panel's width rather than the list's, and `alignItems="center"` centred the panel inside a box that WAS the panel. Two symptoms, one missing number.

The general shape is worth carrying out of here: an absolutely-positioned child pays nothing towards its parent's size, so a percentage width inside it measures whatever the in-flow siblings happen to be. A layout can look obviously right and still have no width to resolve against.

`HelpModal` is why this survived three existing overlay tests. It is nearly as wide as the frame, so a column collapsed to the panel is close enough to a column sized to the list that both "rows still visible" and "opaque over rows" held. The two new tests press `m` instead: `ActionMenu` is the narrowest of the four, and it measures the row's own content extent rather than the line length, since the frame's border pads every line to the terminal's width whatever the row did.
