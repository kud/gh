---
"@kud/gh-ink": patch
---

Bump `CACHE_VERSION` for the `jira` → `task` row rename.

The rename changed `Section`'s shape, which is exactly what `CACHE_VERSION`
exists to guard, and the previous release did not bump it. A v1 cache full of
`kind: "jira"` rows deserialised into a build with no branch for them, so every
row fell through to the GitHub renderer and crashed on
`healthDisplay[item.health]` — a full-screen React error on launch, cleared only
once the background refetch landed underneath it.

Costs one cold fetch on upgrade, which is the documented price of a version bump.
