# @kud/gh-workflow

## 0.3.0

### Minor Changes

- 5e4b549: A section that only shows part of what it matched no longer invents arrivals and departures.

  Three of the eight inbox searches return fewer rows than they match. Measured 2026-09-07 on a real account: `assigned` 37 against a cap of 30, `repoIssues` 94 against 30, `authoredIssues` 95 against 30 — two of them showing under a third of what they found.

  That is a display gap, and it was not the expensive half. A surface that marks arrivals and departures compares one fetch with the next: it asks what changed in the world and reads the answer off a fixed-size window. Where the window is smaller than the world those are different questions. Any update to any of those 95 issues reorders the window, evicts one, and the eviction gets reported as news about a row that never moved — every fetch, all day. The board reports its own scrolling, the header counts it as `12 new · 9 gone`, and the marks that do mean something get read as more of the same.

  `inbox.ts` already carried the fix in a comment: `issueCount` is fetched "so the cap can never drop rows in silence". It was fetched for `myPRs` and no other source, and read by nobody — the guarantee lived in prose and not in code. All eight sources now ask for it, the caps move into `SOURCE_LIMITS` so a cap and its query cannot drift into two numbers, and `sourceCoverage` reports what each source matched against what it was allowed to return.

  `Section` gains `sampled`, and `diffSections` raises no presence mark inside a sampled section — no `in`, no `out`, no `moved-in`, no `moved-out` — and keeps those rows out of the headline counts too. Three things are deliberately preserved:

  **`changed` still fires.** Truncation corrupts which rows you can see, never what a row you can see says. A title or a health token that moved between two fetches is real news about a row present in both, and suppressing it would throw away the half of the signal that still works.

  **Departing rows are still held in place.** Only the mark is suppressed; the row is still spliced back at the index it held, because a row vanishing from under the cursor mid-read is jarring whether or not anything is drawn beside it.

  **The quarantine is per section.** A whole section beside a sampled one keeps its arrivals, so one noisy source cannot silence the board.

  A section is treated as sampled if either fetch says so, since a source can cross its cap between two of them — reading the flag off the newer fetch alone would let the crossing report the entire backlog as arrivals, once. And a source that answers without an `issueCount` counts as whole: an invented sample silences real news, which is the worse of the two failures.

### Patch Changes

- Updated dependencies [5e4b549]
  - @kud/gh@0.12.0

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
