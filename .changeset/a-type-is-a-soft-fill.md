---
"@kud/gh-ink": minor
"@kud/gh-cockpit": patch
"@kud/gh-pr-health": patch
"@kud/gh-pr-comments": patch
"@kud/gh-webhook-replay": patch
---

A row's pill is now a soft fill; event pills stay solid.

The outline shipped this morning was a step too far: on a dark ground a
hue-only ring loses the label it exists to carry, and the point of a type pill
is to be read at a glance on every row. What was wrong was the colour, not the
fill. The law now reads: the column says where it sits, soft says what it is,
solid says something happened. `TaskRow.pill` takes `@kud/ink-ui`'s new
`tone="soft"` — a quiet, measured fill from `softColors` with white ink —
while `merged`, `NEW` and `GONE` keep the loud solid fill that marks news.
`pillVariant` also accepts the new `group` variant, for an epic that holds the
rows beneath it. Every package's `@kud/ink-ui` pin moves to 0.25.0 together.
