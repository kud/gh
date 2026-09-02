---
"@kud/gh-ink": minor
---

A row can say it is context rather than work, and the counts believe it.

Rows gained `role?: "container"` — a row that exists to carry context rather
than to be done. `topLevelCount`, which feeds both the tab badge and the
whole-board total, now skips those rows.

Since 0.34.0 a tree can be three levels deep, so a host can draw a grouping row
over the rows beneath it. Such a row is a real entity — selectable, openable,
worth seeing — but it is not itself a unit of work, and counting it as one
inflates every total it appears in. Four rows under one container is four items,
not five.

It is `role`, not `uncounted`: a host knows what a row *is* and should not have
to know what a badge does with that, and a field named after one consumer starts
lying the moment a second one reads it. It is a union of one rather than a
boolean, because `indent` was a boolean that turned out to need a scalar, and
widening it cost a deprecation still sitting in this file — adding a second role
later is additive, turning a boolean into a union is not.

And it is deliberately not spelled as a depth. A container is a genuine
top-level row with genuine children; pushing it a level down to drop it from a
count would mean lying about the tree to fix a number, and every site that draws
indentation reads that lie as truth.

Hosts that set nothing are unaffected — absent means the row is a unit of work,
which is what every row was before.
