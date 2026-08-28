---
"@kud/gh-ink": minor
---

Row-scoped inbox extensions can now act on the list, not just read it.

`ExtensionTarget` gains two optional fields: `onRemove(item)` drops the row from
the view immediately, and `showFlash(msg)` writes to the same status line the
built-in verbs use.

Previously an extension was handed the row and the login and nothing to act
with, so a host that hides rows by its own rule — a mute list, a snooze — had to
write its state, exit, and leave the row on screen until the next refetch was
applied. On screen that is indistinguishable from the keypress having done
nothing. The built-in verbs never had this problem: `x` drops the row before the
network call it started has answered.

Both fields are optional, so an existing extension is unaffected.
