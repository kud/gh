---
"@kud/gh-pr-health": patch
---

`gh-pr-health` now speaks the cli-shot contract, so its screens can be recorded without a PR, a token or the network. `--screen list` prints the three screens — `failing`, `pending` and `ready` — and `--mock --screen <name>` opens the health panel on an invented PR caught at that moment, with fixture checks, reviewers and merge state that never touch `gh`. Before this there was no way to show the panel except against a real repository, which put real names into every screenshot. Without the flags nothing changes: a PR ref or the current branch is resolved and fetched as before.
