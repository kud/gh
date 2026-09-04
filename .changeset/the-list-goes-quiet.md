---
"@kud/gh-ink": patch
"@kud/gh-cockpit": patch
---

The list actually recedes behind an overlay now. It was already meant to — the backdrop set `dimColor` on every `Text` in the subtree — and the mechanism did not survive contact with a terminal. SGR 2 is a single binary attribute whose meaning the terminal decides, and on iTerm2 it barely moves a 24-bit foreground: dumping the escape codes for one row either side of the overlay gave the same `38;2;255;135;0` orange both times. The panel had a modal over a list that was still shouting, and there was no "more dim" available to apply.

So the backdrop **replaces** the colour rather than attenuating it, and drops faint on the way out. Both together would be worse than either — a flat colour with SGR 2 still on hands the result back to whatever this terminal does with faint, which is the failure being fixed one layer along.

Two planes, not one, because a single tone collapses the list to a mat and the point of a backdrop is that something structured is behind the panel. `dimColor` at the call site is reused as the plane selector rather than re-encoded: every element that had already declared itself furniture — prefixes, repo, age, author — says so again, one step further back. Not one call site changed, which is the same trick as the original shadow, one turn further.

The health glyphs and the turn arrows lose their hues while an overlay is up, and that is `health-display.ts`'s contract being spent rather than broken: the glyph distinguishes the state and colour only ever reinforced it, every one of those glyphs passes a silhouette test, and nobody diagnoses a PR through the list behind a dialog they are operating. It returns with the next frame.

Pills stop being drawn behind an overlay. `Pill` is `@kud/ink-ui`'s and renders that package's `Text`, so it cannot see the context and keeps its fill — harmless while the backdrop merely lost its bold, and the loudest cell on screen once everything around it flattens. A pill is an announcement and there is nobody to announce to. Its width is still charged, so no row reflows as the panel opens over it.

`backdropStyle` is exported so the decision can be pinned without rendering: chalk emits colour only when the runner is a TTY, so a spec grepping a frame for escape codes would pass vacuously wherever the suite is piped.
