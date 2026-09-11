---
"@kud/gh-workflow": minor
"@kud/gh-ink": minor
"@kud/gh-cockpit": minor
"@kud/gh-pr-health": patch
"@kud/gh-pr-comments": patch
"@kud/gh-webhook-replay": patch
---

A row's labels now read as their own tier, and a repo can declare the labels
its convention puts on every issue so rows there stop repeating the header.

Labels and age both inked in `dimColor`, so the row that was designed with
three tiers — title, labels, furniture — rendered two, and the labels read as
noise beside the date. The cell now takes `@kud/ink-ui`'s new
`colors.secondary`, measured one clear step above the faint; the turn arrow
and the answered thread count, which were the same register in a hand-picked
`#888888`, move to the same token, so the row has exactly three neutrals.

`configureInbox` gains `impliedLabels`, keyed by `owner/name`: a worklist repo
whose every issue carries `plan` names it once, and rows under that header omit
it — filtered before the rank and the two-slot cut, so it never takes a slot and
then vanishes. A row whose only label was implied draws no cell at all, which is
what an unlabelled row draws. The same label still shows on a repo that did not
imply it, where it is exactly what separates a plan from a bug report. Every
package's `@kud/ink-ui` pin moves to 0.26.0 together.
