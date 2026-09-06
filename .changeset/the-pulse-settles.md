---
"@kud/gh-ink": patch
---

The tab pulse settles after a minute instead of running for as long as the process is up.

Every other hold in the inbox is bounded by a timer. The tab pulse was not, and could not be, because it is gated on `markedTabs` — and a mark on a tab nobody has opened deliberately never expires. That promise is the point and it is unchanged: unread news still keeps its marker for as long as it takes you to come and collect it.

What had no bound was the **ticker**, and nothing about the code said so. It used to be scoped to the rows the visible tab draws, which left an untouched tab with the ticker stopped. Moving the marker to the tab bar widened the gate to "any marked tab" — correctly, since a marker you cannot see is the whole case the pulse exists for — but the gate's other end still had no ceiling, and the comment above the interval was left behind still claiming the old scope. It said the opposite of what the code did, which is how this survived review. Making the dot breathe at 150ms rather than 450ms then tripled the cost of the same loop.

Together: one uncollected mark on one tab re-rendered the entire inbox 6.7 times a second, for the lifetime of the process. Measured 2026-09-06 on a cockpit left open 22 hours — 4.15 GB resident and still climbing at roughly 1.4 GB/min, on a host that was down to 10 MB of free RAM with its swap full and its CPU thermally throttled to 46%. The sibling running `--here` on the same machine, up two days with no marked tabs, sat at 13 MB throughout.

`PULSE_SETTLE_MS` now stops the ticker after 60 seconds and rests the marker on `◉`, the widest frame in the cycle. Sixty seconds is chosen against the eye rather than the machine: a pulse nobody has looked at in a minute will not be noticed by pulsing for an hour. Resting on the widest frame is the half that keeps the feature — five of the six frames are narrower and one is a bare `·` that reads as no marker at all, so stopping on wherever the ticker happened to be would have quietly deleted the mark it was protecting.

The ceiling is keyed to what is being pulsed about rather than to the boolean, so news arriving on a second tab while the first is still marked buys its own minute instead of inheriting a spent one. It is also eight times the longest row hold, so no sparkle or transit animation can be cut short by it — the ceiling only ever ends the open-ended tab case.
