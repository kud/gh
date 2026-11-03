---
"@kud/gh-ink": minor
---

PR rows carry a weight meter just ahead of `+adds -dels`: four cells that rise as a staircase, `▁▁▁▁` for a typo fix up to `▂▄▆█` for a sprawling change. The weight is the heavier of the lines touched and the files touched, so a forty-file rename no longer reads as small because each file changed one line, and the file count reaches the row for the first time. A diff confined to one or two files tops out at large, since that shape is usually a lockfile, a vendored SDK or a snapshot. Huge rows light up in amber; a row whose size was never fetched leaves the meter blank rather than claiming it is tiny.
