---
"@kud/gh-cockpit": minor
---

The PR summary line degrades by dropping the least valuable cell rather than the only elastic one, so a narrow terminal no longer wraps a line the module says never wraps.

The header has always claimed "the numbers are never truncated and the line never wraps". The first half held; the second did not. The ladder was **one rung** — the head branch went, and everything else stayed — so there was no step at all between fitting and wrapping: once `kud · opened 3 months ago` exceeded the width on its own, nothing could give and the line wrapped.

The ranking, most expendable first, which is now the order cells are dropped: the **author**, because it is `kud` on very nearly every row of a solo cockpit; **`opened Nd ago`**, because staleness is the inbox's question and by the time you have drilled in you have already decided to look; then the **head branch**; and `→ base` is kept longest, because since the previous release it is drawn only when it is _not_ the repo default — so its presence already means it is the notable fact on the line.

That inverts what the old single rung sacrificed. It gave up the branch name and kept both provenance cells, which is backwards: it protected the two facts you can most afford to lose.

The size, file count and draft marker are never dropped. The numbers are never truncated, and a draft changes the meaning of the whole panel below the line.

`trail` on the returned `Summary` splits into `author` and `opened`, since dropping them independently is the whole point.
