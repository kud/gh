---
"@kud/gh-ink": patch
"@kud/gh-cockpit": patch
---

The row under the cursor no longer says so by turning its title orange. Selection is a recessed wash across the full row instead — darker than the terminal ground rather than lighter, so it reads as a track the row sits in rather than a second raised panel arguing with the overlay — while the ❯ gutter and the title's bold stay, since state is never colour alone. Task keys step down to the default foreground on every row as part of the same move; the PR number keeps its accent, which was always a reference rather than a selection signal. The wash stands down behind an overlay, and the header bands end on the same column as the PR rows they head.
