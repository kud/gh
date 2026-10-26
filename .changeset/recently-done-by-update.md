---
"@kud/gh": patch
---

`recentlyDone` now asks for the most recently updated PRs first. Search ordered them by creation, so with more closed PRs in the window than the page holds, a long-lived PR merged today could be missing while newer, older-closed ones filled the page.
