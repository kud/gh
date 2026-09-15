---
"@kud/gh-ink": minor
---

The initiatives rail reads by name.

Each row was a key in orange with the initiative's title dimmed beneath it and `0/5 · 4 live` in the same grey — the reference brighter than the thing it referred to, and progress a number you did arithmetic on across rows. A row is now the label first, bright, cut at a word boundary; under it a fixed facts grid: the key in the secondary tier, a ten-column progress bar beside its `done/total` fraction, and the live count in words. The heading drops the `»` for a bold title and the title row's own dotted rule, so the rail's one accent is the `←` that says an initiative wants you.

`Sidebar` gains `liveLabel?: (live: number) => string`, so a host can say `4 on board` / `off board` in its own vocabulary; the default stays `N live`, with `nothing live` for a counted zero. `counts()` takes the same function as an optional second argument. `truncateWords` is exported.

The inbox's `#FF8700` literals become `colors.accent` in the same change: the rail moving to the token alone would have put two oranges on one screen.
