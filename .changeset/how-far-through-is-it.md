---
"@kud/gh-ink": minor
---

A rail row can say how far through its initiative is.

`SidebarRow` gains `done` and `total`, drawn as `4/9` before the live count —
progress first, because it is the question a roadmap is read to answer, and
`live` second because it qualifies it. An initiative sitting at `4/9 · 0 live` is
the one you most want to notice, which is why a counted zero is printed rather
than folded away.

Both or neither: `counts()` draws the fraction only when it has both halves,
because a numerator with no denominator is not progress, it is a number. Either
figure may be absent independently — `live` is what the surface already drew,
while progress generally means asking the source a second time, and a host that
could not ask says nothing rather than claiming zero.

`counts(row)` is exported for hosts laying out their own rail.
