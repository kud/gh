---
"@kud/gh-ink": minor
"@kud/gh-workflow": patch
---

A row's pill is now outlined; event pills stay solid.

The law: the column says where it sits, outline says what it is, solid says
something happened. `TaskRow.pill` is a classification — `epic`, `bug`, `spike`
— so the inbox draws it with `@kud/ink-ui`'s new `tone="outline"`: thin
Powerline caps and the label in the variant's hue, no fill. `merged`, `NEW` and
`GONE` are events and keep their solid fill, which is now the only thing on a
row that reads as news.

`@kud/ink-ui` moves to 0.24.0 across every package, which is where `tone` lands.
