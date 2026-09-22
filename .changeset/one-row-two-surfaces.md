---
"@kud/gh-ink": minor
"@kud/gh-cockpit": minor
---

The PR row is a component now, and anything holding a `GHItem` can draw one.

Until now the only way to render a pull request the way the inbox renders one was to be the inbox. The layout — the aligned health, turn and number cells, the give-up ladder that sheds author, then a label, then size, then threads, then the repo, then the age rather than flooring the title, the two-tier age, the label cell, the diff-size colouring — lived inside a 700-line `ItemRow` in `inbox.tsx`, reachable only through `App`. Any second surface wanting the same row had the choice of mounting the whole inbox or writing the ladder again, and a second copy of that arithmetic is a second place for a row to overflow its container, which Ink answers by compressing every flexible child until the list wraps into a column of fragments.

`PrRow` is that branch, lifted whole and exported: `item`, `active`, `login` and the `cols` it may actually use. It holds no timers and reads no clock. Everything the inbox does to a row over time — the merge sparkle, the transit ramps, the one-shot arrival and departure frames, how long GONE is held — stays in the inbox and reaches the row as three props after the decisions are made: `icon` puts a caller's glyph in the health cell, `motion` says whether the title is arriving, departing or struck off, and `announcements` are the solid pills the row ends on. That is the whole seam, and it is what lets the choreography stay in one place while the layout is shared.

Two things moved with it. `truncate` is its own module, since both row renderers measure against the same budget. The backdrop — the `DimContext` that dims the list behind an overlay, its `Text` wrapper and `backdropStyle` — is its own module too, and that one is load-bearing: the context has to be a single instance, and two modules each calling `createContext` would compile, render, and silently never dim. Both keep their existing addresses on `@kud/gh-ink`.

One behaviour changed on the way. A row wearing GONE was charged two columns for its pill's caps but nothing for the word inside them, so its title was priced eight columns wider than the row it was about to draw — invisible at a normal width and an overflow at a narrow one. Announcements are now charged in full, the same as MERGED always was.
