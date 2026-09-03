---
"@kud/gh-ink": minor
---

A row that moves between tabs now says so, at both ends.

The refresh diff asked one question of every row — is it anywhere on the board?
— so a row that moved from one tab to another was present in both snapshots and
earned no mark at all. It simply vanished from the tab you were reading, with
the header reporting nothing to apply.

The cockpit epic is where this cost the most. An epic's own summary and status
never change: it moves BECAUSE its children did, so a board-wide diff had
nothing to notice about it. Watching an epic and its stories disappear mid-read,
with no marker and no count, was indistinguishable from the cockpit losing them.

Marks are now keyed per row _per section_, and `Transient` gains `moved-in` and
`moved-out` alongside `in`, `out` and `changed`. A move dissolves the row where
it was and coalesces it where it landed, wearing `MOVED` at both ends — never
`GONE`, which is a claim about the board and would be a lie about a ticket still
open one tab over. The counts stay per row, so one move is one headline however
many tabs it touched, and an epic drawn in two tabs at once — which cockpit does
deliberately — now gets an answer per instance instead of one shared mark.

`transientOf` takes the section id as a third argument; a row drawn in two tabs
has two answers and there is no sensible default.
