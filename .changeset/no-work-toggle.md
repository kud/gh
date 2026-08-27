---
"@kud/gh-ink": minor
---

Retire the in-app work ⇄ home toggle

**Breaking**: `workToggle` is gone and `initialIncludeWork` is now `includeWork`.
A host that used to pass `workToggle={cond}` with `initialIncludeWork={side}`
passes `includeWork={cond ? side : undefined}` — `undefined` means no split at
all, which is what a falsy `workToggle` used to mean.

Which side you are looking at is decided when the command starts, from the
directory it was run in. A key that flipped it afterwards could only ever put
the inbox out of step with the scope it was launched in, with nothing on screen
to explain the disagreement — and it made `w` a promise the scoped runs
(`--here`, the home profile) could not keep.

The header keeps a static `work` / `home` label where the switch used to be.
Every row on screen depends on which side you are on, and the two inboxes look
alike enough that dropping the word entirely would leave "where are my other
PRs" unanswerable.
