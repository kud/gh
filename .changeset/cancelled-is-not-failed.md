---
"@kud/gh": minor
"@kud/gh-ink": minor
---

A cancelled check is no longer a failing one.

`isFailCheck` counted `CANCELLED` alongside `FAILURE`, `TIMED_OUT` and
`ACTION_REQUIRED`, which is a claim the token cannot support. Those three are
verdicts — something was examined and found wanting. `CANCELLED` is the absence
of a verdict: the run was killed, and nothing was learnt about the code either
way. The two readings only agree on "not green", and the whose-move bands need
the other distinction.

gnachman/iTerm2#731 is what made it visible. Its `xcode-tests` job waited six
hours for a macOS runner on a repo nobody here owns and was killed by Actions;
`python-api-tests` passed. That banded under **Your move** with a red glyph
against a PR where nothing was wrong and nothing could be done — the exact
over-claiming the bands exist to prevent.

`CANCELLED` and `STALE` now answer to a new `isInconclusiveCheck`, and a PR
whose only unfinished check is one of them reads as `waiting` rather than
`ci-fail`. No new health token: a "stale" one would band identically to
`waiting` from all three standings, and a token that flips no outcome is a
label. The panel is where labels belong, so it grows a fourth glyph and counts
cancelled runs in their own column, and `checksSentence` stops dropping them
from the total.

`STARTUP_FAILURE` was in no set at all — the same bug pointing the other way, a
workflow file too broken to start reading as neither failing nor pending nor
passing. It is a verdict on the code and joins the failures.

`r` in the health panel still finds a cancelled run. That is deliberate rather
than incidental: it looked up its target through `isFailCheck`, so moving
`CANCELLED` out without a second home for it would have removed the one action
that fixes a starved job along with the false alarm.
