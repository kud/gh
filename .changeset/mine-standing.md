---
"@kud/gh-ink": patch
---

Recognise a folded `mine` tab as an authored standing

A host that merges its own open PRs and drafts into one tab — the split says
draft-ness twice, since the band already sinks a draft — would otherwise fall
through to the `queued` default and band every row backwards. `open` and `draft`
keep working unchanged.
