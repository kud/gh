---
"@kud/gh-ink": minor
---

Add pattern-based repo filtering

`matchesFilter(repo, { include, exclude })` with `parsePatterns` for
comma-separated flag values. `*` matches within one path segment and never
across the `/`, a bare owner is sugar for all its repos, exclude is applied after
include and wins.

Groundwork for replacing the built-in two-way repo split, which was never a
concept — it was two hard-coded filter presets and a `w` key, unable to express a
third slice or the common case of having one. Its tests pin that the old split is
reproducible as data (`include: [org/*, me/org-*]` and the same list under
`exclude`), covering every repo between them with no overlap.

The split itself is unchanged for now; nothing consumes this yet.
