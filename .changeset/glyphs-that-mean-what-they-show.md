---
"@kud/gh-ink": minor
---

`merged` and `closed` get glyphs that mean something, and the tab rule slides.

**The two arbitrary health glyphs are gone.** `»` for merged and `×` for closed
were chosen to be distinguishable rather than to be read: `✓` and `✗` you never
have to think about, `»` you did. They are now Nerd Font's git-merge and
closed-pull-request icons. `×` had a second problem beyond being arbitrary — it
is one stroke from `✗` (ci failing) two rows up in the same map, and the
shape-distinctness this file turns on is a silhouette test, not a codepoint one.

The cost, stated rather than discovered: a terminal without a Nerd Font draws a
box where it used to draw a chevron. That trade was already made once here — the
inbox hardcodes the comment glyph — and two states degrading to tofu is cheaper
than ten states none of which say what they mean.

A new spec pins every glyph to a single column. That cell sits in the aligned
zone left of the title and every key on screen lines up off it, so a two-column
glyph shifts only the rows carrying one — the exact failure a fixed cell exists
to prevent, and no longer hypothetical now that glyphs are chosen for meaning
rather than for width.

**Requires `@kud/ink-ui` 0.20.0**, which brings the sliding tab rule: the active
tab's underline travels between tabs rather than blinking from one to the next,
stretching as it goes when the destination is wider.
