---
"@kud/gh-ink": minor
---

The rail opens by default, is wider, has a rule of its own, and you can walk into it.

**Open by default.** A rail you have to remember to ask for is a rail you never
consult, and the roadmap is the half of the picture the tabs cannot show at all —
it earns its columns by being there. `i` still closes it for the stretches where
the list wants the whole width.

**Forty columns, not thirty**, and a single left rule separating it from the list.
A rule rather than a full box: the other three edges already have the frame's
border a column or two away, and a second rectangle inside the first reads as a
nested panel — something you could focus and act on. The rule is the whole claim,
that what is left of it is the list and what is right of it is not. It matches the
frame's own border rather than picking a second grey.

**It is now a focus region.** Tab crosses into the rail and back — the one key in
this UI that means "somewhere else on this screen", where ←→ already mean another
tab and ↑↓ another row. While it holds focus the arrows move its cursor, `↵` opens
the row's new optional `url`, and esc hands the arrows back. The footer swaps to
the rail's own keymap, because advertising `m actions` beside a cursor that cannot
reach a row names a key that does nothing where you are standing.

Two marks in two fixed cells, never one cell doing both jobs: `❯` is where you
are, `←` is what wants you, and a row can easily be both. Focus itself is stated
in a word — `● focus` — for the same reason every other state here is: a marker
living only in a hue is a marker a colourblind reader does not have.

A rail longer than its height scrolls to follow the cursor rather than clamping at
the last visible row. Clamping would have made the rows counted in `+N more`
visible and unreachable in the same breath.

`SidePanel` still owns no keyboard and calls no `useInput`. It DRAWS a cursor;
where that cursor is, and whether the arrows point at this rail at all, stay the
host's state — which is what lets a screen with two regions have exactly one lit.
