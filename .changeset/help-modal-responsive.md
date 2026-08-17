---
"@kud/gh-ink": patch
---

Fix the `?` legend coming apart on terminals narrower than ~118 columns. The three
legend columns were laid out at a fixed width with no fallback, so Ink wrapped every
row mid-word and the modal's border fell out of step. The modal now reads the live
terminal width and falls down a ladder of layouts — three columns across, then Status
and Tabs stacked beside Keys, then a single column — and the cell gutter is derived
from the widest cell rather than hardcoded per column.
