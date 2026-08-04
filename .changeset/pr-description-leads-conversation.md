---
"@kud/gh": minor
---

`fetchPrComments` now returns the PR description as the conversation's first entry, the way GitHub's own Conversation tab treats it. A PR whose body carries its whole argument previously rendered as having nothing said on it, which reads as empty rather than unanswered.

Conversation comments also carry `createdAt`, and a null body (what GitHub returns for a description-less PR) no longer throws.
