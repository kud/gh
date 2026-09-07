---
"@kud/gh-ink": patch
---

The tab pulse arms when you arrive, not when the news does — and stops writing into the row animations' counter.

The 60s ceiling stopped the runaway ticker, but it was hung off the wrong clock. The window opened when NEWS ARRIVED; the eye it exists to catch arrives later and separately. A minute spent breathing into an empty room is a minute of full-inbox re-render bought for nobody, and what the reader finds when they do come back is a mark that settled while they were away — which reads as a feature somebody removed rather than as one that already did its job.

So the window is 12s now, and three things arm it: news landing (unchanged), the first keypress after a quiet stretch, and a tab change. The last two are the reader demonstrably being there — walking back to the window, or scanning the bar, which is the one place a mark on a tab you are not on can be seen at all.

Deliberately not every keystroke. Someone heads-down in one tab with an old uncollected mark would re-arm continuously and put sustained 6.7fps straight back. Presence is the gate; the arrival of presence is the trigger. `PULSE_IDLE_MS` is 60s, and that ratio is the real number here: 12 in 60 is a fifth of the old cost as a sustained worst case, where a 30s threshold would be two fifths. A spec now pins `PULSE_IDLE_MS > PULSE_SETTLE_MS`, because an idle threshold shorter than the window is a pulse that never stops — the original bug wearing a new hat.

**The settle no longer writes `sparkFrame`.** It set the shared counter to `PULSE_SETTLED_FRAME` to park the mark on its widest glyph, and `sparkFrame` is what the row ramps divide for their own frames. That was safe purely by accident: at 60s the ceiling sat eight times clear of the longest row hold, so nothing could still be animating when it landed. At 12s the margin is 1.7x and a keypress can arm at any moment, so the settle would eventually snap a row mid-dissolve. It is a `settled` boolean now, read at the marker. Same glyph, no shared mutable state.

That also makes `PULSE_SETTLE_MS > TRANSIT_HOLD_MS` load-bearing where it never was, so the spec that asserts it says so, and the perceptibility floor it sits beside is expressed in breaths rather than in a frame count that was only ever a fact about 60s.

**Unrelated, found in the same pass:** `holdTimers` was pushed to on every merge and every close and never spliced. Each entry retains its callback closure, which captures the `GHItem` it was holding, so the roster grew for the life of the process — one entry per action, each pinning a row that left the screen seconds later. Holds now take themselves off the list when they fire; the unmount sweep is unchanged.

`MERGED_HOLD_MS` goes back to 3000. It shipped at that, drifted to 5000, and the rationale block on `TRANSIT_FRAME_TICKS` went on describing the original the whole time — restored rather than re-chosen.
