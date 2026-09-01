---
"@kud/gh-ink": minor
---

A row you close now says goodbye before it goes.

Closing an issue or a PR removed the row on the keypress. The flash said
`✓ Closed #412` about something that was already off screen, so the one thing
that could have confirmed which row went — the row itself — was gone before the
sentence naming it arrived. Merging had exactly this fixed a while back and
closing never did, which left the two endings of a piece of work behaving
oppositely: one lingered and sparkled, the other vanished mid-blink.

A dismissed row now holds for `LEAVING_HOLD_MS` (2.5s) wearing the same GONE the
refresh puts on a row that left between two fetches — dissolving in the health
cell, dimmed and struck through — then drops. Same vocabulary rather than a
third one, because the row is saying the same thing either way: it is leaving.
Who caused it is the flash's business.

Shorter than the other two holds, and deliberately. The merge sparkle
celebrates; the refresh mark has to survive being _noticed_, since it reports
work done in another window. This one only has to be seen — you pressed the key
a second ago and are looking at the row it names.

It reaches every optimistic removal, not just Close: `x` on a review request,
Close PR + delete branch, and a row-scoped extension calling `target.onRemove`
(a mute list, a snooze) all get the farewell. The hold belongs to `App`, because
the row has to keep being rendered for the length of it and the sections it is
rendered from are App's — `BrowseScreen` hands the dismissal up through a new
`onLeave` and reads back `leavingUrls`, mirroring how `mergedUrls` already
worked.

One rough edge is inherited from the merge path rather than introduced: a close
GitHub then refuses still drops the row when the hold expires and lets the
failure's own refresh put it back, so that bounce is 2.5s longer than it was.
That path already says `restoring #412` out loud, and cancelling the hold
properly would mean threading a cancellation seam through every caller of an
action that essentially never fails.
