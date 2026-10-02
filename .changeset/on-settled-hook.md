---
"@kud/gh-ink": minor
---

A host can now learn how an optimistic action ended. The new optional `onSettled(item, result)` prop fires once when "Remove me as reviewer", "Close issue" or "Close PR" finishes, with `{ ok: true }` or `{ ok: false, reason }`, where `reason` is the first line of GitHub's error. Without it nothing changes: the row still leaves at once and comes back on the next refresh if GitHub refused.
