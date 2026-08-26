---
"@kud/gh-ink": minor
---

Move host-specific opinions out of the library into `configureInbox`

`repoPriority` ranked one specific owner's repos first, with one specific repo
above them; `resolveRepoPath` and the clone path read an environment variable and assumed a
particular two-directory checkout layout; the cache claimed a directory named
after one consuming tool. All of it compiled in, and all of it published — a
ranking baked in at build time ranks its author's repos above its reader's, and
one of those constants named a private repository.

New `configureInbox({ repoPriority, profiles, checkoutDir, cacheNamespace })`,
set once before rendering. `RepoProfile` replaces the implicit work/home split
with any number of named slices, each optionally keeping its own checkout
directory.

**Every default is empty.** An unconfigured host gets flat repo ranking and no
local-checkout resolution — never a guess at where someone keeps their code, and
never a default that happens to suit whoever wrote it. `repoPriority` entries are
ordered, matching an owner by trailing slash (`acme/`) or a repo exactly
(`acme/monorepo`), so one repo can outrank the owner containing it.
