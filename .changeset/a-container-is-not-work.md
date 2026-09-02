---
"@kud/gh-ink": minor
---

A row can say it is context rather than work, and the tab badge believes it.

Rows gained `role?: "container"` — a row that exists to carry context rather
than to be done. The initiative a story hangs under is the case that forced it:
real, owned, selectable, openable, and worth seeing until it closes, but not
itself a thing on anyone's plate. `topLevelCount`, which feeds both the tab
badge and the whole-board total, now skips those rows. Four stories under one
container is four items, not five.

Before this, a board that had just learned to nest an epic over its stories
counted the epic as work, so a tab reading `(3)` could mean two things to do and
one heading — a number read at a glance and acted on, wrong in the direction
that makes you think you have more to do than you have.

It is `role`, not `uncounted`, because a host knows what a row *is* and should
not have to know what the tab badge does with that; a field named after one
consumer starts lying the moment a second one reads it. It is a union of one
rather than a boolean, because `indent` was a boolean that turned out to need a
scalar and widening it cost a deprecation still sitting in this file — adding a
second role later is additive, turning a boolean into a union is not.

And it is deliberately not spelled as a depth. A container is a genuine
top-level row with genuine children; pushing it a level down to drop it from a
count would mean lying about the tree to fix a number, and every site that draws
indentation reads that lie as truth.

Hosts that set nothing are unaffected — absent means the row is a unit of work,
which is what every row was before.
