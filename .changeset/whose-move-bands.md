---
"@kud/gh-ink": minor
---

Split each inbox tab into "Your move" / "Their move" bands

A tab already says which relationship you are looking at — it never said whether
there was anything to do once you got there, so red CI, merge conflicts and
drafts sat interleaved with the rows you could actually act on.

`layoutGHItems` now splits every tab but Done into two whose-move bands, each
keeping its own repo grouping. The band is decided by health AND tab together:
`✗` on a PR you wrote is yours, the same `✗` on one you were asked to review is
the author's. `threads` and `approved` are yours from either side. A tab whose
rows all land on the same side (Draft, Issues) keeps the plain list.

Exports `whoseMove(health, sectionId)` for hosts that want the same split.
