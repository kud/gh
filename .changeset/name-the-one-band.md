---
"@kud/gh-workflow": patch
---

A single-sided tab keeps its band header instead of collapsing to a plain list.

```
Mine (8)

  Their move (8)
  ── gnachman/iTerm2 ──────────
  ~ → #733  feat(compact-tabs): …
```

The old rule was "one band is not a band": if every row landed on the same side, the two headers said nothing the split hadn't, so the list stood bare. That reasoning holds for the header **pair** and not for the surviving one. "Their move (8)" is the answer the tab was opened to get — nothing here is owed by you — and a bare list gives it only to a reader who already knows how the bands work and can infer it from their absence. The label is cheap to read and the inference is not.

It also removes a shape that changes under you: a tab that showed two headers yesterday and none today, because a single row flipped sides, reads as a rendering bug rather than as the count going to zero.

The empty side is still omitted rather than printed as `(0)` — a header naming a band with nothing in it is the ceremony the original rule was right about. Draft and Issues are single-sided by construction, so they gain exactly one line each. Done is unchanged: it is a timeline, and whose-move is a question about live work.
