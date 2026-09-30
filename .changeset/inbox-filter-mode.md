---
"@kud/gh-ink": patch
---

The inbox search now runs on ink-ui's `useFilterMode`, the filter every @kud TUI is moving to, so it behaves the same as theirs. Nothing you'd notice changes, with two small exceptions: pressing `↵` on an empty search now drops the filter instead of leaving a blank one that needed `esc`, and `/` no longer opens a search underneath an open action menu.
