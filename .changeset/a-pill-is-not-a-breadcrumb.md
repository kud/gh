---
"@kud/gh-ink": minor
---

A task row can carry a category as a filled pill.

`TaskRow` gains `pill` and `pillVariant`, drawn through `@kud/ink-ui`'s new
`Pill` after the summary. It is for a category the row BELONGS to — `epic`,
`blocked`, `spike` — where the word itself is the information and should read as
one object rather than as more prose at the end of a sentence.

Deliberately not a second spelling of `note`, which cockpit's epic marker had
been borrowing. The two want opposite weights: `note` is a reference the reader
follows — a parent ticket key, a source — and filling a breadcrumb gives it a
weight it has not earned. A row can carry both, and a story hanging under
someone else's epic does: its parent's key as the dim note, and its own
category as the pill.

The title's width budget charges for the pill including its two caps, via
`pillWidth`. Pricing a pill by its label alone overflows the row by exactly the
caps, and the frame is sized to fill the terminal, so one column too many
scrolls the whole panel rather than clipping the row — the same trap the indent
term taught this budget one release ago.

Requires `@kud/ink-ui` 0.17.0.
