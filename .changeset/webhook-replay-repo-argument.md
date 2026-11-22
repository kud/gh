---
"@kud/gh-webhook-replay": patch
---

`gh-webhook-replay owner/repo` ignored the repo it was given. The argument parser skips the value that follows `--hook`, and when there was no `--hook` it computed that position as the first argument — so the repo, which is the first argument in the picker's only invocation, was always the one skipped, and the run quietly fell back to the repository of the current directory, or failed with "No repo" outside one. The value after `--hook` is now skipped only when `--hook` is present, and the named repo is the one whose webhooks are listed.
