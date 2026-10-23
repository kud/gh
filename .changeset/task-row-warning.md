---
"@kud/gh-workflow": minor
"@kud/gh-ink": minor
"@kud/gh-cockpit": minor
"@kud/gh-pr-comments": patch
"@kud/gh-pr-health": patch
"@kud/gh-webhook-replay": patch
---

A task row had no way to say something about it was wrong. Its only trailing text was `note`, which is dim by contract because it is a breadcrumb, and a dimmed warning is a missed one, so a ticket sitting in a column its own PRs contradict looked exactly like one that was fine. `TaskRow` now takes an optional `warning`, a sentence drawn right after the pill in the warning colour and led by the status strip's warn mark (`SHOP-1234  Round statement totals  story  ⚠ PR merged · move to QA?`). The host decides what counts as wrong; the words are always there, never the mark alone. The tab holding such rows shows how many after its count, `Review 2 ⚠ 1`, through `@kud/ink-ui`'s new `TabItem.warning`. That figure is counted off the rows themselves, by the new `warningCount`, over distinct keys, so a tab can never warn about a row that says nothing, and one ticket drawn twice still counts once. Every package moves to `@kud/ink-ui` 0.42.0 together, and `@kud/gh-ink`'s peer range now starts there.
