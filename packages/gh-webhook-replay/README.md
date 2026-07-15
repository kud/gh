# @kud/gh-webhook-replay

Replay the latest `pull_request` webhook delivery on a GitHub repo hook — a thin
CLI over [`@kud/gh`](../gh). Useful for re-firing a Jenkins PR-builder that missed
an event.

## Install

```sh
npm install -g @kud/gh-webhook-replay
```

Requires the [`gh`](https://cli.github.com) CLI, authenticated.

## Usage

```sh
gh-webhook-replay                        # pick a hook interactively (current repo)
gh-webhook-replay owner/repo             # …for a specific repo
gh-webhook-replay --hook ghprbhook       # headless: replay on the matched hook
gh-webhook-replay owner/repo --hook 42   # match by url substring or hook id
```

Interactive: `↑↓` move · `↵` replay the selected hook's latest `pull_request`
delivery · `q` quit.

## Licence

MIT © Erwann Mest
