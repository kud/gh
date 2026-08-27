---
"@kud/gh-ink": minor
---

Unsubscribe from a PR or issue, on `u`

A row you no longer want to hear about had to be dealt with on github.com, which
means leaving the inbox to do the one thing the inbox is for. `u` — and an
`Unsubscribe` entry in the `↵` menu — drops your notification subscription in
place.

It resolves the node id when the action runs rather than carrying one on every
row: `updateSubscription` is GraphQL-only, and widening the inbox query to serve
a single action would cost every fetch. The state is `UNSUBSCRIBED`, never
`IGNORED` — ignoring is sticky in a way that is hard to notice months later, and
repo-level unwatching is a different verb this deliberately does not offer.
