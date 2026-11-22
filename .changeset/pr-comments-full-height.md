---
"@kud/gh-pr-comments": patch
---

The standalone `gh-pr-comments` showed one line of the review at a time. The comments panel sizes its scrolling window by measuring the space it is given, and the CLI's root gave it none, so the window measured a single row and stayed there — one line of text above an indicator such as `18–18 / 37`, in every terminal and at every size. The root now takes the terminal's full height, so the window fills the screen between the title and the key hints and scrolls from there. Cockpit was never affected, since it already hands the panel a sized region.
