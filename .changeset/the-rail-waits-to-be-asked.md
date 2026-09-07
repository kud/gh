---
"@kud/gh-ink": patch
---

The initiatives rail starts closed, and `i` brings it in.

It used to open on mount wherever a host supplied one, on the reasoning that a rail you have to remember to ask for is a rail you never consult. That reasoning holds for the rail and ignores what it is standing next to. The rail is forty columns, and it takes them out of the list — every row, on every tab, for the whole session — while the roadmap it draws is something you check now and then. Living with it, the trade came out the other way round: a permanently narrower list to keep a panel warm that gets read in bursts.

Nothing else moves. `i` toggles it as it always did, `⇥` still crosses into it once it is up, and closing it while focused still hands the arrows back, because focus left behind on a hidden rail is the one state where nothing on screen says which region `↵` would act on.

What makes closed-by-default survivable is that the footer already named the key: with a rail available and away, the hints carry `i initiatives` — the host's own word for it, not "sidebar". A closed rail nobody can find would be the same as no rail at all, so that hint is now pinned by a spec rather than left as a nicety.

The specs that narrow a row by opening the rail — `narrow.test.tsx`, `labels.test.tsx` — now press `i` before they measure. Supplying a rail and showing one have come apart, and it is the showing that moves the width a row actually reads.
