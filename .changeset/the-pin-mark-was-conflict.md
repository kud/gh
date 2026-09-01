---
"@kud/gh-ink": patch
---

The pin mark is `+`, not `!` — `!` was already `conflict`.

`health-display.ts` keeps one glyph per state and says why in its own comment:
the glyph is what distinguishes states, because colour cannot be relied on. The
pin mark landed in 0.32.0 as `!` in accent orange, which is exactly `conflict` —
in the same orange, one cell to the left. A PR that was both conflicted and
pinned rendered `! !`, twice, identically, with nothing to tell the two apart.

Caught by running the cockpit rather than by reading the diff: the row that
exposed it was `gnachman/iTerm2#731`, wearing a health `!` beside a turn `→`,
which made it obvious what a pinned row would have looked like.

The invariant was right and its scope was too narrow. Uniqueness inside the
health map does not help when the neighbouring column can draw the same glyph,
so `PIN_MARK` is exported and `health-display.test.ts` now asserts it against
every health glyph. That is the test that would have caught this.
