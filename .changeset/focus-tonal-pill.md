---
"@kud/gh-ink": patch
"@kud/gh-cockpit": patch
"@kud/gh-pr-comments": patch
"@kud/gh-pr-health": patch
"@kud/gh-webhook-replay": patch
---

The focus row's slot label now rides a tonal accent pill. The mark and the word `focus` used to sit as a bold glyph beside dim text, which read as one more run of prose; they are now one `Pill tone="tonal"`, the design system's quietest filled form, for what the frame says about itself rather than row data. The row's width budget prices the pill with `pillWidth`, so its two cap columns are counted and the title still truncates to exactly the room left instead of overflowing and folding the frame. A host's `markColor` still tints the list gutter but no longer reaches the pill, which takes its accent from its variant. Every package that bundles `@kud/ink-ui` moves from 0.39.0 to 0.41.0 together, which also draws the tab counts as tonal pills.
