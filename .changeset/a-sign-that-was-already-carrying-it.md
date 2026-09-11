---
"@kud/gh-workflow": minor
"@kud/gh-ink": patch
"@kud/gh-cockpit": patch
---

The diff size is coloured, additions green and deletions red, on the inbox row and the PR header alike.

It had been plain on the row and a single orange on the header, both on the argument that a hue per sign hands a colourblind reader two near-identical hues with nothing else to tell them apart. That argument treated colour as the discriminator, and it never was: the `+`/`-` sign and the fixed `+`-first order carry the meaning, and colour on top of them is reinforcement — the contract `health-display.ts` had been applying to `✓` and `✗` on the same row all along, in the same two tokens. So `+9470 -124` now reads the way every diffstat since `git` has, with no new hue on the screen.

`@kud/gh-workflow` gains `sizePartsOf`, the same string split into its two halves so a surface can paint each without re-deriving the compaction or the sign; `sizeOf` is now built on it, so the two forms cannot drift.
