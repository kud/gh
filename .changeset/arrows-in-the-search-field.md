---
"@kud/gh-ink": patch
---

The row cursor now works while you are typing a search, and a query lands it on the first match.

Two faults stacked here. The `/` field swallowed every key, arrows included, so walking the matches meant `↵` out of the field, arrowing, then `/` again to refine — which starts the query over. And each keystroke reset the cursor to index 0 of the filtered tab, which is the band header the matches sit under and a place the arrows refuse to stand, so a fresh search left no row selected at all: `↵` and every row binding went nowhere until an arrow nudged it onto a row.

`↑↓` now fall through the field to the list, the hint under the query says so, and a new query puts the cursor on its first match. Everything else you type still goes to the query.
