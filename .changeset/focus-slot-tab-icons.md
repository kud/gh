---
"@kud/gh-ink": minor
"@kud/gh-workflow": minor
"@kud/gh-cockpit": minor
"@kud/gh-pr-comments": patch
"@kud/gh-pr-health": patch
"@kud/gh-webhook-replay": patch
---

The inbox knew every row but could not point at one. A host with an opinion
about what the reader should look at next — the ticket whose payout totals are
wrong, the PR with two threads waiting — had no channel for it: the rows were
all equally lit, and the reader re-triaged the whole board on every glance to
find the one thing that mattered.

`App` now draws a focus slot, one fixed-height row directly above the tab
strip. The fetch result carries `focus` beside the rows (and the cache keeps it
beside them, so a trusted launch paints the slot with the rows); `focusLabel`
and `focusEmpty` name the row in the host's words, and passing either reserves
it from the first paint. The matching row wears the mark in its gutter, `g`
jumps the tab and cursor to it — opening the collapsed tail it is folded into —
and the `?` legend names the key only while there is somewhere to jump to. A
host that wires nothing draws byte-identical output.

Sections also gain an optional `icon`, passed through to the tab strip, where
an inactive tab folds down to it when the strip does not fit. Every package
now builds against `@kud/ink-ui` 0.39.0, the release the tab icons shipped
in, and `gh-ink`'s peer range moves to `>=0.39.0 <1` because an older host
has no `TabItem.icon` to pass the glyph to. `gh-cockpit` re-exports the slot,
its mark and its defaults so a host can build on them.
