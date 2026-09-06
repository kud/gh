# @kud/gh-workflow

## 0.2.1

### Patch Changes

- 19330e4: Fix `toGHItem` throwing on any pull request that has status checks.

  The extraction moved `toGHItem` out of `@kud/gh-cockpit` but left behind the adapter that reshapes a GraphQL node into `computeHealth`'s transport-agnostic input — checks live under `statusCheckRollup.contexts.nodes`, not on the node. Every real PR produced `checks is not iterable`, which took both the terminal and web surfaces down at the first row.

  The adapter now lives beside the mapper, and `map.test.ts` feeds a realistically nested node through it. The previous suite asserted only what the package imported, never what it did, which is exactly why a green release shipped a mapper that could not map.

## 0.2.0

### Minor Changes

- b5512f9: Extract the workflow semantics into `@kud/gh-workflow`, a pure package a browser can import.

  `whoseMove`, `sortItems`, `layoutGHItems`, the filters, the row types and the GraphQL node → row mapping were spread across `gh-ink`'s 5,600-line `inbox.tsx` and `gh-cockpit`'s shared layer, entangled with Ink, `zx`, iTerm pane launching and a `mkdirSync` that ran on import. None of it was ever terminal-specific — only its address was.

  `@kud/gh` splits `fetchHealth` out of `health.ts` so the health derivation is importable without `execa`, and gains `./health` and `./inbox` subpath exports for consumers that must not pull the CLI path. The terminal surfaces re-export by name, so nothing on their public API moves.

  Purity is asserted against the built output rather than the source: in the workspace every forbidden dependency is installed, so an accidental import compiles, typechecks and only fails in a consumer's bundle.

  Note for consumers: `@kud/gh-workflow@0.1.0` was published against `@kud/gh@0.9.0`, which predates the `./health` subpath it imports, so it fails to resolve outside this workspace. `0.1.1` pins the version that actually exports it.

### Patch Changes

- Updated dependencies [b5512f9]
  - @kud/gh@0.11.0
