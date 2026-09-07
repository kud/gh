---
"@kud/gh-ink": patch
---

The row transit ramps run at 300ms a frame instead of 450ms.

A row leaving — merged, closed, or dropped off the board — dissolves through `◉ ◎ ○ ·` in the health cell, and an arriving one coalesces back the other way. Both took the shared 150ms ticker divided by three. Watched on the real board, 450ms overshot: a farewell that slow does not read as gentle, it reads as unresolved.

The divisor is 2 now. That is deliberately not the tab pulse's rate — the pulse takes the ticker undivided, and a goodbye running as fast as a summons would be saying the wrong thing about itself. Half the tab's rate is the only other stop on the dial, since ticks are integers off a shared period, and it happens to be the right one.

The interruption argument that put the divisor there in the first place is unharmed. It was calibrated against 6.7Hz beside text you are reading; this is 3.3Hz, the far side of where flicker discomfort falls away. Nothing about inline motion at 150ms has been relitigated — the merge sparkle, which was already undivided, is untouched, and so is the tab pulse.

What this does spend is the margin the sawtooth was living on. `TRANSIT_OUT_FRAMES` snaps `◉`→`·` at the end of each cycle and loops for the length of the hold; at 450ms that snap read as a restart, and the faster it comes round the more it reads as a blink — the same discontinuity `TAB_PULSE` was given six out-and-back frames to avoid. `MERGED_FRAMES` survives 150ms precisely because `✦✧✶✧` has no snap in it, which is the tell that the rate difference was always downstream of the shape difference.

So the note above the divisor now says what the standing fix is — play each ramp once and hold, rather than loop it — and says not to divide this any further before that lands. A goodbye that keeps restarting is the thing "too slow" gets reached for to describe.
