---
"@kud/gh-ink": minor
"@kud/gh-cockpit": patch
---

PR rows line up better on both ends. The `#n` cell was a fixed seven cells, so `#31805` sat one cell from its title while `#172` sat three, and a six-digit number would have run straight into its title; it is now as wide as the section's widest number plus a two-cell gutter, so every title starts on one column (exported as `numberColumnsOf`, with a matching `numberCols` prop on `PrRow`). On a wide window the inbox also stops each PR row at 140 cells, so threads, size and age right-align to a line you can read across rather than to the far edge of the terminal; the header rule and tab strip still span the frame, and narrower windows are unchanged.
