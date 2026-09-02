---
"@kud/gh-cockpit": patch
---

Two things the package knew and never said.

It shells out to the GitHub CLI for every fetch and every action, and neither
README mentioned `gh` anywhere — not that it must be installed, not that it must
be authenticated. A reader following the Quick Start had no way to learn the
prerequisite except by hitting it.

And `engines` claimed Node 20 while `@kud/gh`, which it depends on, requires 22.
Anyone who believed the looser number got an `EBADENGINE` from a transitive
dependency after being told their runtime was supported.

The Quick Start now leads with what has to be true before `npm install`, and
`engines` agrees with the dependency it cannot run without.
