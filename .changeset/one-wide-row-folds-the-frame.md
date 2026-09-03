---
"@kud/gh-ink": patch
---

A row too wide for its container no longer folds the whole frame.

The title budget floored at 20 columns. That is fine while the frame is wide and
fatal the moment something takes forty of them: a PR row carrying a long repo
name and two ages has nothing left, takes the floor anyway, and overflows by
exactly the difference.

Ink's answer to an overflowing row is not to clip it — it is to compress every
flexible child in that row. The key, the number and the title all shrink
together and wrap into a column of fragments, so the list stops looking like a
list and anything standing beside it is pushed off the screen. One row too wide
takes the entire layout with it.

The row now gives up its trailing context in order — author, then threads, then
repo, then age — before the title is squeezed, and the title floors at 1 rather
than at a legible minimum, because a floor above what is left is by definition
an overflow. A one-character title is a bad row; a row that folds the frame is a
bad screen. The two announcements are absent from that order on purpose: MERGED
and the transit labels are the news the row exists to carry that moment, and a
row that dropped its own headline to keep a repo name would have the priority
exactly backwards.

Found on a real board rather than in the suite. The specs that existed narrowed
the frame by mounting a smaller terminal, which cannot work: `COLS` is sampled
from the real terminal when the module loads, so the rows measured themselves
against whatever window was running the tests and the assertions passed
everywhere. The new spec narrows the rows the only way a test can — by opening
the rail.
