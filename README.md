# @kud/gh

The **gh family** — GitHub PR tooling as a layered, reusable ecosystem. A
surface-agnostic core, Ink components, and thin CLIs, so the logic lives once
and every surface (standalone command, cockpit dashboard, MCP) consumes it.

## Packages

| Package                  | Role                                                                         | Status                                    |
| ------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------- |
| [`@kud/gh`](packages/gh) | **core** — `gh` CLI primitives, PR review comments, health, webhook logic    | 🟢 comments landed; health + webhook next |
| `@kud/gh-ink`            | **components** — controlled Ink panels (health, comments) + token→colour map | ⚪ planned                                |
| `@kud/gh-pr-comments`    | CLI — browse / reply / resolve review threads                                | ⚪ planned                                |
| `@kud/gh-pr-health`      | CLI — checks / reviews / merge-state for a PR                                | ⚪ planned                                |
| `@kud/gh-webhook-replay` | CLI — replay the latest `pull_request` webhook delivery                      | ⚪ planned                                |

## Design

- **Core** (`tsc`, zero-UI): shells out to `gh` and returns plain data. The
  `ghGraphql` / `ghRest` primitives every tool used to reinvent now live here.
- **Ink layer** (`tsup`): presentation-only components — props in, no fetching,
  no input. The consuming surface owns selection, navigation, and loading.
- **CLIs**: arg-parsing + mounting the Ink body over a core client.

The core emits **semantic tokens**; the Ink layer maps token → colour. Same seam
as `@kud/jenkins` → `@kud/jenkins-ink`.

## Development

```sh
npm install          # install all workspaces
npm run typecheck    # across packages
npm run test
npm run build
```

Versioning & publishing is per-package via [changesets](https://github.com/changesets/changesets):

```sh
npm run changeset          # record a change
npm run version-packages   # apply version bumps
npm run release            # build + publish changed packages
```

## Licence

MIT © Erwann Mest
