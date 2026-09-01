---
"@kud/gh-ink": minor
---

`GHItem.pinned` — a turn the viewer claims by hand, outranking every inference.

The bands read health, tab, standing and who spoke last, and between them they
are right nearly always. The gap is not accuracy, it is reach: a row can be
genuinely yours while every signal available says otherwise — nothing red, no
unresolved thread, nobody waiting on a word — and that knowledge lives with the
viewer, where no query can go and get it. There was nowhere to put it.

So `whoseMove` takes a fifth argument and `layoutGHItems` reads it off the item.
Set, the row is yours; unset or false, everything is decided exactly as before,
which is what keeps every existing caller unchanged.

It is a **pin**, not a correction — it applies whether or not the row was
already yours, so it does not evaporate the moment something else claims the
turn, and it has no opposite. There is deliberately no way to pin a row away:
"not mine" is what the bands already conclude unaided, and a control for it
would only be a way to hide work from the one person who can still act on it.

The other direction is real but belongs elsewhere. "No reply is owed for this
particular comment" is a fact about one event with its own expiry — a newer
comment has to undo it — so it is read where the events are read, and a host
expresses it by handing back a `lastActor` that no longer claims a turn. That
needs nothing from this package.

A pinned row gets its own mark in the turn cell: `!` in the same orange the
incoming arrow uses. The arrows report who SPOKE last, and a pin is not a turn
in the conversation — left to them it would sit under Your move wearing a grey
`→` saying the opposite. Single-width ASCII because that cell is in the aligned
zone, where a codepoint that renders double-width in some fonts would shift only
the rows carrying one; mark and colour each say it independently, so neither is
load-bearing alone. The explain panel spells it out ahead of everything else,
including the untouched-PR case, where a pin is the most informative thing there
is to report.
