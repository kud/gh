---
"@kud/gh": minor
"@kud/gh-workflow": minor
"@kud/gh-ink": minor
"@kud/gh-cockpit": patch
---

A PR row by someone else now says how big the diff is.

A review queue of forty rows gave no way to tell a six-line config bump from a
forty-file rewrite without opening each one; the size sat one keypress away in
the PR header, which is too late to decide whether to press the key. Every
open-PR search in `@kud/gh` now selects `additions deletions changedFiles` —
three scalars on nodes already fetched, measured at zero cost — in the base
identity list rather than the health set, so the `minimal` overflow tier
carries them too. `GHItem` gains the three fields, `toGHItem` sets them when
the node has them and leaves them undefined otherwise, and `sizeOf` and
`filesOf` move into `@kud/gh-workflow` beside `relativeTime` so the row and the
header format one string. The inbox row draws `+18 -4` at the head of its
trailing group on any PR not your own — plain, undimmed, one colour, magnitude
carried by width — and gives it up after the author and before the thread
count when the frame narrows. `@kud/gh-cockpit` re-exports `sizeOf` from its
summary view so existing imports keep resolving.
