# @kud/gh-pr-health

Checks, reviews and merge state for a GitHub PR in the terminal — a thin CLI over
[`@kud/gh`](../gh) + [`@kud/gh-ink`](../gh-ink).

## Install

```sh
npm install -g @kud/gh-pr-health
```

Requires the [`gh`](https://cli.github.com) CLI, authenticated.

## Usage

```sh
gh-pr-health                 # the current branch's PR
gh-pr-health owner/repo#123  # a specific PR
gh-pr-health --retrigger     # re-fire the Jenkins PR-builder webhook (headless)
```

`↑↓` move · `↵` open the selected check · `r` retrigger failed CI · `m` merge
(with confirm) · `q` quit.

## Licence

MIT © Erwann Mest
