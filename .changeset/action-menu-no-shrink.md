---
"@kud/gh-ink": patch
---

The inbox action menu no longer gets squashed when it opens under a board that already fills the screen. The layout took the missing rows out of the menu, so its actions collapsed onto one line, one label landed on top of another and left stale fragments behind (a stray `cew` where "Copy link" overwrote "Request review"). The menu now keeps its full height and the board gives up the rows instead.
