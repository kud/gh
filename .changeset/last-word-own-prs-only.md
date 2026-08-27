---
"@kud/gh-ink": patch
---

The last-word rule applies to your own PRs only

Shipped one release ago reading `lastActor` from every position, which destroyed
the distinction the whose-move table is built on: the mechanical blockers —
`ci-fail`, `conflict`, `changes-req` — are yours on your PR and theirs on theirs.
Read unconditionally, a colleague's failing build became your move the moment
they commented on their own work. Eleven rows of other people's PRs turned up
under Your move, which is the noise the bands exist to prevent.

It now applies on `authored` only. The other two positions never needed it: a
review actually wanted from you is `waiting`/`pending`, and a conversation you
are in is `threads` — both already listed. What is deliberately not claimed is a
plain reply on a PR you reviewed once: real, but indistinguishable from the
author saying "rebased" to nobody in particular.
