---
"@kud/gh-ink": minor
---

Add an optional `note` to `JiraRow`, rendered dim after the summary.

For a secondary annotation on a row — a recurrence marker, a source hint —
without concatenating it into `summary`. Its own node so it can be dimmed, and
so its width is subtracted from the title budget rather than smuggled past the
truncation maths: a suffix hidden inside `summary` is cut off exactly when the
row is long enough to need it.
