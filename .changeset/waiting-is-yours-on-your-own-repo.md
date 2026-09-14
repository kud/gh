---
"@kud/gh-workflow": minor
"@kud/gh-ink": patch
"@kud/gh-cockpit": patch
---

An unreviewed PR on a repo you own is yours, and the login the bands read against is no longer optional.

`waiting` — "awaiting review" — was deliberately absent from what is yours on an authored PR, because the ball is with the reviewer. That is right wherever a reviewer exists and wrong on a repo you own with nobody asked: no review is outstanding because none was requested, the only action that advances the row is you merging it, and the band filed it under Their move for as long as it stayed open. `whoseMove` takes a sixth argument, `ownsRepo`, which `layoutGHItems` computes as the `login/` prefix of the row's repo, and `waiting` from `authored` is yours when it holds. `pending` stays theirs on any repo — a check still running is the machine's turn — and ownership is the prefix and nothing looser: `viewerPermission` would have claimed every PR on an employer's org, where WRITE is ordinary and a review is expected.

`login` is now required on `layoutGHItems`, `filterByOrigin`, `filterBySearch` and `filterByRepos`. It was optional so an un-updated host would degrade rather than break, and one did exactly that for weeks: ambre's work/home split called `filterByOrigin` without it, the re-layout read every row against nobody, and a PR somebody had replied to on your own repo came out under Their move with the turn arrow beside it still pointing at you. Nothing failed; one band was simply wrong. A host without a viewer yet shows its loading state rather than bands laid out against nobody, and a host that forgets now fails at typecheck instead of in front of you.
