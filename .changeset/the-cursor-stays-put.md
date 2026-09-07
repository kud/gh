---
"@kud/gh-ink": patch
---

The cursor follows the row it was on across a refresh, and stops being kicked off repo headers.

Two bugs, and the second fired every single time.

**Standing on a repo header and pressing `r` moved you onto an issue.** The reconciliation stepped the cursor off any header it landed on — a rule written when headers could not be selected at all. They can: `↵` opens the repo, `C` copies the group, and the footer advertises both. Only `subgroup-header` is genuinely unstandable-on, which is exactly what `moveCursor` already skips and nothing else, so that is now the only kind this steps off.

**And the cursor was restored by INDEX.** A refetch reshapes the list — rows arrive, rows leave, a group grows — so an index is a promise about a list that no longer exists. Applying a refresh silently landed you on whatever had moved into that slot, which is worse than not restoring at all: nothing on screen says you were moved, and the next keypress acts on the wrong row. It now follows the row's identity, and holds position only when that row is genuinely absent.

`rowKey` is the identity, extracted rather than invented. It was already written out inline as React's key and simply not available to the cursor, which is how the cursor came to be restored by position while the rows around it were being tracked properly. One function, both callers, so they cannot drift.

A row you were standing on that the refresh removes does not vanish under the cursor either — it keeps its place for the length of its farewell, wearing the departure mark, and the cursor stays with it. That was already true and is now pinned, because it is the case that would otherwise justify a jump: "the row is gone, where do we put them?" never has to be answered while the row is still drawn.

Worth recording the shape of the implementation bug found while writing the specs, since it is a trap rather than a typo: the previous items have to be read into a local **before** `setCursors` is called. The state updater is deferred while the ref assignment runs immediately, so a closure over the ref resolves every anchor against the list that just replaced the one the cursor was standing in — and restores the index unchanged, which looks exactly like the bug being fixed.
