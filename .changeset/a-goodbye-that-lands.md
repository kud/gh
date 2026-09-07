---
"@kud/gh-ink": patch
---

Row transit ramps play once and hold, instead of looping for the length of the hold.

A row on its way out dissolves `◉ ◎ ○ ·` in the health cell, and an arriving one coalesces the other way. Both were indexed with `%` off the shared ticker, so they looped: at the 7s transit hold the dissolve played roughly four times over, and at 2.5s a departure played about one and a half.

That is what "the animation feels too slow" turned out to mean. Not the tempo — the lack of an ending. These ramps are sawtooths, and a sawtooth on a loop restarts rather than arrives: the row thins to nothing, snaps back to solid, and thins again. It never says the thing it was drawn to say. `TAB_PULSE` was given six out-and-back frames specifically to avoid that snap, and `MERGED_FRAMES` gets away with 150ms precisely because `✦✧✶✧` has no snap in it — the rate difference between the two was always downstream of the shape difference.

So the index is clamped rather than wrapped, and a departure now comes to rest on `·`. That is the reading which was wrong for the tab marker and is exactly right here: the tab mark rests on its widest glyph because staying legible is its whole promise, while the row is genuinely going, the GONE pill carries the state, and dissolving to nothing IS the message.

Playing once needs each row to know when its own transit began, which the shared counter cannot say — it only knows how long the ticker has been running, so dividing it puts every row on screen in identical phase however far apart they actually started. `rampFrame` counts off wall time from a per-row origin instead, threaded down as `transitSince`.

Two origins, because the two kinds of transit begin at different moments. A departure starts when you pressed the key. A refresh mark starts when you **arrived on the tab holding it** — not when the refresh found it, which may have been minutes earlier behind a tab you were not on, and a ramp that played out unwatched would leave you the last frame and nothing else. That is the same instant `heldSince` already stamps for the hold, so the ramp and the hold now start together rather than merely overlapping.

A row with no recorded origin keeps the old looping behaviour rather than defaulting to frame zero, which sounds like the safer default and is not: `now - 0` clamps to the last frame, so a missing origin would render as an animation that had already finished instead of one that visibly never ran.
