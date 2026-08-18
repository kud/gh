---
"@kud/gh-ink": patch
---

Render the empty and failed states instead of printing them and exiting.

A first fetch that came back with nothing, or that threw, used to `console.log`
/ `console.error` and `process.exit`. Hosts mount this App under Ink's
`alternateScreen`, which restores the primary buffer on teardown without
replaying anything written to the alternate one — so the message went into a
buffer that was immediately discarded and the user was left staring at a blank
terminal, unable to tell "nothing is open" from "the fetch died" from "the scope
resolved somewhere I did not mean".

Both are now states rendered inside the usual frame, so the header still names
what was looked at, with `r` to retry and `q` to quit. Hosts can pass
`emptyHint` to say what came back empty in their own vocabulary.
