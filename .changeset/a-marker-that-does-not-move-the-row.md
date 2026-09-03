---
"@kud/gh-ink": minor
---

The refresh marker moves to the tab bar and the header, and stops strobing.

Three things were wrong with announcing a refresh on the rows themselves.

**It moved the row.** The trailing word sat inside the title's width budget, so a
row that gained one paid for it by shedding its repo name or squeezing its
summary — reflowing at the exact moment you were reading it. The glyph column
solved this years ago by reserving a cell whether or not it is occupied; the word
never got the same treatment. It is gone from both row kinds now. What stays is
free: the glyph in its reserved cell, bold for a row arriving, dim and struck
through for one leaving — which is also the pair that distinguishes the two
without reading a word.

**It reported news you could not see.** A marker on a row inside a tab you are
not looking at is invisible by construction, and that is the case the hold exists
for. The tab marker is now animated, pulsing through the same ramp the rows
dissolve along, so the bar says where. The cell is two columns on EVERY tab,
always — it used to collapse when the board was quiet, sliding the whole bar
sideways twice per refresh, and a bar that shifts is one you have to re-find.

**It said it too fast.** The transit frames shared the merge sparkle's 150ms.
That rate is right for a 2.5-second celebration of something you just did and
wrong for a 7-second notice about something that happened elsewhere: six blinks a
second beside text you are trying to read is an interruption, not a marker.
Transit frames now advance a third as often, off the same counter, so the two
animations still cannot drift.

The wording — `1 new · 1 gone · 1 moved` — lives in the header for the length of
the hold, in the same words the pending indicator used a keypress earlier. That
segment is the one place on screen where a changing width costs nothing: a dashed
filler absorbs the difference and nothing is aligned to its right.

`GONE` and `MERGED` still appear on the row itself, and the distinction is who
caused it. Those follow a key you pressed a second ago, on a row you are looking
at and which is leaving anyway, so the acknowledgement is the whole point and its
reflow is both expected and brief.

`tabLabel` is deprecated in favour of `tabMarker` plus `Tabs`' own `marker` field.
Requires `@kud/ink-ui` 0.19.0.
