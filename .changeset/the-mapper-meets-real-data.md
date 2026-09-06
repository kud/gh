---
"@kud/gh-workflow": patch
---

Fix `toGHItem` throwing on any pull request that has status checks.

The extraction moved `toGHItem` out of `@kud/gh-cockpit` but left behind the adapter that reshapes a GraphQL node into `computeHealth`'s transport-agnostic input — checks live under `statusCheckRollup.contexts.nodes`, not on the node. Every real PR produced `checks is not iterable`, which took both the terminal and web surfaces down at the first row.

The adapter now lives beside the mapper, and `map.test.ts` feeds a realistically nested node through it. The previous suite asserted only what the package imported, never what it did, which is exactly why a green release shipped a mapper that could not map.
