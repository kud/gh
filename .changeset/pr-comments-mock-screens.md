---
"@kud/gh-pr-comments": patch
---

`gh-pr-comments` now speaks the cli-shot contract, so its screens can be recorded without a PR, a token or the network. `--screen list` prints the two screens — `review`, with threads still open and one outdated, and `resolved`, the same review once settled — and `--mock --screen <name>` opens the comments panel on that invented review without touching `gh`. Before this the panel could only be shown against a real repository, which put real reviewers and real comments into every screenshot. Without the flags nothing changes: a PR ref or the current branch is resolved and fetched as before.
