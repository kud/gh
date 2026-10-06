---
"@kud/gh-ink": patch
---

The focus row now says how to reach what it points at. Pressing `g` already jumped to the focus item, but nothing on screen mentioned it, so the key was discoverable only from the help modal. The ready row ends with a quiet `g jump` after the reason, the key in the accent beside the focus mark and the word dim. The hint is priced into the row's width budget and spent last: the title truncates first, then the reason, and the hint drops only when even that cannot fit, so the row stays one line. The key is a single exported constant shared by the legend, the input handler and the hint, so they cannot drift.
