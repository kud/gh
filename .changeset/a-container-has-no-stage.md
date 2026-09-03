---
"@kud/gh-ink": minor
---

An optional rail for containers of work, beside the list.

A tab files a row by the stage it is in. A container has no stage of its own — an
epic moves only because its children did — so it has never had anywhere honest to
be drawn, and hosts have been squeezing it into the list anyway.

`App`'s fetcher may now return a `sidebar: { title, rows }`, rendered as a rail on
the right by `SidePanel`. Each row is a key, a label, an optional count of what is
live under it, and whether something under it wants you — marked with the same
arrow, in the same orange, that a PR row uses for the same question. Deliberately
not a `TaskRow`: the two want opposite fields, and sharing a shape would have
meant carrying a `status` neither side agrees on.

It costs nothing unless asked for. No `sidebar` in the fetch result and there is
no rail, no `i` key, no footer hint and no columns spent — a key that visibly does
nothing reads as a broken feature rather than as a surface without one. Where
there is a rail, `i` toggles it and the hint names what it shows rather than the
furniture.

The rail's width comes out of the LIST, not the frame. `ItemRow` takes a `cols`
prop, defaulted to the frame width, and the list hands down the frame minus
`SIDEBAR_COLS` while the rail is open. A row cannot see the rail, so a budget that
did not know about it would overflow by the rail's whole width — and the frame is
sized to fill the terminal, so that scrolls the panel rather than clipping a row.

The rail applies straight from each fetch rather than waiting behind `r`. The
manual-apply gate exists so the list cannot reshuffle under you mid-read; the rail
holds no cursor and nothing is being read down it, so holding it back would only
leave a stale panel standing beside fresh rows.
