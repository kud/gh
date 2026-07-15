# @kud/gh-pr-comments

Browse, reply to, and resolve GitHub PR review comments in the terminal — a thin
CLI over [`@kud/gh`](../gh) + [`@kud/gh-ink`](../gh-ink).

## Install

```sh
npm install -g @kud/gh-pr-comments
```

Requires the [`gh`](https://cli.github.com) CLI, authenticated.

## Usage

```sh
gh-pr-comments                 # the current branch's PR
gh-pr-comments owner/repo#123  # a specific PR
```

`↑↓` move · `x` resolve/unresolve · `r` reply · `R` show/hide resolved · `q` quit.

## Licence

MIT © Erwann Mest
