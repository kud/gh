---
"@kud/gh-workflow": minor
"@kud/gh-ink": minor
"@kud/gh-cockpit": patch
---

A task row can carry a one-cell mark before its key.

`TaskRow.marker` and `markerColor` — ink-ui `Tabs`' pair, meaning-named so the package grows no Jira vocabulary — draw in a fixed cell after the tree stem and before the key, where jira-ink's board draws its priority arrow. The list measures the cell once, over the whole section: every task row draws the same width or none, so a mark on one row never shifts the keys of the others, and a surface that marks nothing is drawn exactly as before.
