---
"@kud/gh-ink": minor
---

Somebody else's last word puts the row on your side

A PR where the other party commented last sat under **Their move** while its own
turn arrow drew `←` and the explain panel read "X spoke last, your reply is
owed". Two signals on one row pointing opposite ways: the arrow read
`lastActor`, the band never did.

Someone else having the last word now outranks every review state. It is the
plainest claim on you there is — a question, an objection, a "can you rebase" —
and none of it registers as a health, because a bare comment approves nothing,
fails nothing and opens no thread.

One direction only: you having spoken last does not hand the row over, since red
CI on your own PR is yours whether or not you commented after it.

`layoutGHItems` takes an optional `login` to read this. Omit it and the bands
fall back to health and standing alone, exactly as before.
