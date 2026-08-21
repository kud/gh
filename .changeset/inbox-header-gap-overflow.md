---
"@kud/gh-ink": patch
---

Stop the inbox frame jumping a row when a scrolled list starts on a repo header. The gap above a header was decided on the absolute row index while `fitCount` prices the window's first row at one line, so the list drew one row more than its budget — and since the frame is sized to fill the terminal exactly, that overflow scrolled the whole panel instead of clipping.
