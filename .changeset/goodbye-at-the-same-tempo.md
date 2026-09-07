---
"@kud/gh-ink": patch
---

Row transit ramps run at the ticker's own 150ms, the same tempo as the tab pulse and the merge sparkle.

The divisor went 3 → 2 → 1 over one afternoon, and the middle step is the one worth understanding, because the argument keeping it above 1 did not get overruled — it stopped applying.

At 450ms and then 300ms these ramps LOOPED for the length of the hold, and a sawtooth on a loop snaps `◉`→`·` at the end of every cycle. The faster it comes round, the more that snap reads as a blink — the exact discontinuity `TAB_PULSE` was given six out-and-back frames to avoid, and the reason `MERGED_FRAMES` survives 150ms is that `✦✧✶✧` has no snap in it. So the divisor was never really protecting against speed. It was protecting against **repetition** at speed.

Once each ramp plays once and holds, there is no second cycle and no snap to arrive at. A departure dissolves `◉ ◎ ○ ·` over 600ms and rests on `·`: one gesture, finished, at the tempo everything else on this screen already moves at. The interruption argument that put the divisor there still stands and is simply not engaged — it is about sustained motion beside text you are reading, and nothing here sustains.

This is not a floor to keep pushing. There is nowhere left to go: 1 is the ticker itself, and anything quicker means shortening the ramp, which spends a frame of the dissolve rather than time.

`TRANSIT_FRAME_MS` is exported now, because its spec had been carrying its own `MERGED_FRAME_MS * 2` — a test that passes against the arithmetic it wrote down rather than the arithmetic that ships, and goes on passing after the divisor moves. That is a spec which has quietly stopped watching, and it would have kept quiet through exactly this change.
