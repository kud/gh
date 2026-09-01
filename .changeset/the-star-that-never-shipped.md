---
"@kud/gh-cockpit": minor
---

The published package exports what it always claimed to — and knows a turn can be settled by a reaction.

`export * from "@kud/gh-ink"` sat in `lib.ts` for the package's whole life and
never once worked outside the workspace. esbuild cannot put a star re-export of
an EXTERNAL package into ESM's static export list, so tsup degraded it to a
runtime `__reExport` shim copying properties onto an object nothing re-exports.
The `.d.ts` kept the star, so every consumer's `tsc` agreed the symbols were
there. 0.2.2 shipped 17 exports against about 26 documented; `App`,
`configureInbox`, `layoutGHItems` and `whoseMove` were all `undefined`. A host
adopting it got a green typecheck and `Element type is invalid … got: undefined`
at first render.

Inside the monorepo the same star resolves from source and works perfectly,
which is exactly why it survived: the bug existed only in the artefact, and
every local check passed throughout. Same shape as the build-order trap already
recorded in this repo's CLAUDE.md — invisible locally, fatal once published.

Values are now named one by one. Types stay a star, deliberately: type-only
re-exports are erased before esbuild sees them, so they never hit the
degradation, and only the value list needs maintaining by hand.

`exports.test.ts` reads the BUILT `dist/index.js` and compares its keys against
gh-ink's own — never a hardcoded copy, which would drift silently in the same
direction as the bug. It needs no `npm pack` and no install: the degradation is
in the emitted module's export list rather than in resolution, so it is visible
from anywhere, which is what keeps the check offline and fast enough to run on
every commit. A missing `dist` fails it rather than skipping it.

Also, and separately: `conversationOf` and `toGHItem` now read the viewer's own
reactions, which had been living in one host's fork rather than here. 👀 on the
last comment settles that comment's turn — event-scoped, so a newer comment
brings the turn back, which is what makes it safe to use freely. 👍 on the PR
body sets `pinned`, which `whoseMove` honours above everything inferred. The
case both exist for: a bot commenting after the last push, on a green PR with no
open thread, produced a turn clearable by neither words nor a push.
