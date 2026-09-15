---
"@kud/gh-workflow": minor
"@kud/gh-ink": minor
"@kud/gh-cockpit": patch
---

A row the search index forgets is held for five minutes.

GitHub's search is eventually consistent: a PR being re-indexed after a burst of updates — an `atlantis apply`, a status churn — drops out of `search` results for a fetch or two and comes back, with nothing about it changed. The inbox read every fetch as the whole truth, so one such fetch announced the row as gone and the next as new. Found 2026-09-15 on an open PR with two approvals and six green checks that one fetch omitted while a direct query returned it.

`reconcile` in gh-ink's diff carries forward any `pr` or `issue` row that was on the board and appears in no fresh section, in the section it had and beside the neighbour it had, stamped `GHItem.heldSince` on the first absence, until `HOLD_MS` (five minutes) has passed. Present anywhere in the fetch — another tab, or `done`, the positive sign it merged — and it is not held. Nothing marks a held row; the diff reads it as unchanged and the apply gate does not fire. Expiry leaves through the ordinary `out` at the fetch where the inbox stops believing. The hold survives a relaunch: the cache is written after reconciliation. Task rows and sampled sections are not held.
