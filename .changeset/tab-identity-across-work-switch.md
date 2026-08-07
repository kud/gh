---
"@kud/gh-ink": patch
---

Keep the tab you are on when the work ⇄ home switch flips. `filterByOrigin` drops sections that end up empty, so the two sides expose different section sets — following the tab index handed you a different tab, and on Done it was reliably the wrong one.

`w` now resolves the active section by id and only falls back to the clamp when that tab has no counterpart at all. `cursors` and `viewStarts` moved from position-keyed arrays to records keyed by section id for the same reason: landing on the right tab was not enough while the saved row still came from whichever section used to sit at that index.
