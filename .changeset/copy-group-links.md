---
"@kud/gh-ink": minor
---

Standing on a repo fence and pressing `c` now copies every item link in that group, newline-separated and in display order, and the `»` band headers (`Your move`, `Their move`) are rows the cursor can land on at last, with `c` copying the whole band the same way. A fence used to hand over the repo page's own URL, which meant collecting a group's links one row at a time, and a band header was scenery the arrows stepped over, so there was nowhere to stand that meant "all of this". The footer now names the count before it is pressed (`copy 3 links`) and the flash confirms it afterwards (`Copied 3 links`), both read off the same collection the key copies so the two cannot disagree, and `c` on a single row is untouched — still that row's URL alone.
