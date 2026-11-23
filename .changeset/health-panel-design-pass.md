---
"@kud/gh-ink": minor
"@kud/gh-pr-health": patch
"@kud/gh-cockpit": patch
---

The health panel now answers its question first and draws what it found more honestly. The Merge line leads the panel, in the same words as before, rather than sitting under two lists that grow with the PR, where on a busy one it was the line most likely to be off screen. Checks are listed worst first — failures, then runs that were cancelled or are waiting on an approval, then those still running, then those that finished without a verdict, then passes — with every row still drawn, so the cursor opens on the check you came for. The glyphs separate what used to be conflated: `◌` for a check still running or queued, `-` for one that finished without a verdict (skipped, neutral, cancelled), and `·` only as a separator; a skipped job no longer wears a green tick, and the summary counts it as skipped rather than passed. The summary marks are coloured, and two lies are gone: a list in which every check was cancelled no longer earns `✓`, and a failed action such as `✗ retrigger CI failed` is drawn in the error colour instead of the success green. Cockpit's Health tab shows the same panel and changes with it.
