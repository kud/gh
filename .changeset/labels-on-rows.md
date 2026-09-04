---
"@kud/gh-ink": minor
"@kud/gh-cockpit": minor
---

Rows say what KIND of thing they are, not only what state it is in. Health had eleven states, a glyph each and a legend on `?`; labels had nothing at all, so a `plan`-labelled issue and an ordinary one were indistinguishable in the list — on a cockpit whose whole worklist *is* `plan`-labelled issues. The data was already being fetched and thrown away: `@kud/gh`'s inbox query has carried `labels(first: 10)` in `full` mode all along, under a comment reading "Nothing here renders labels."

At most two per row, chosen against the host's new `labelPriority` — an ordered list where an entry ending in `*` matches by prefix, so `app:*` need not be enumerated — and by name after that. The cap is the design rather than a concession to width: a row showing every label has stopped being a row. `labelPriority` is empty in the library like every other default here, and that is load-bearing rather than tidy — `plan` and `app:*` are one reader's filing conventions, and a library that shipped them would be ranking a stranger's labels by a scheme they have never seen.

Alphabetical was the obvious ordering and it is wrong on the exact case this exists for: on a repo where every issue carries `plan` plus `app:<name>`, `app:cockpit` sorts first and the label saying what KIND of thing the row is gets dropped. That is the ranking's whole job.

The cell sits immediately after the title rather than out with the trailing furniture, because a label is read as part of the subject rather than scanned down a column. One tag glyph then the names, dim, verbatim casing, no per-label colour — GitHub's label hues are authored in a repo that knows nothing of this palette, and it would be the one place on the row where colour alone did the discriminating, which is the failure `health-display.ts` exists to prevent. There is no `+2` overflow marker: it would spend three columns to say something you cannot act on, on precisely the rows whose titles are already the most squeezed.

It takes **two** rungs on the row's give-up ladder rather than one, degrading two labels → one → none, because the second label is the most speculative thing on the row and the first is what the row *is*. The repo still outlives both: on a nested row the repo is positional — it says the row is not where the header above it claims — so dropping it misattributes the row, where a dropped label is only less to go on.

`GHItem` gains `labels`, and `CockpitItem` — which existed solely to widen `GHItem` with it — collapses to an alias.
