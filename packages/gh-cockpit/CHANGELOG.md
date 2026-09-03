# @kud/gh-cockpit

## 0.3.14

### Patch Changes

- Updated dependencies [154daf6]
  - @kud/gh-ink@0.43.1

## 0.3.13

### Patch Changes

- Updated dependencies [07dd4f5]
  - @kud/gh-ink@0.43.0

## 0.3.12

### Patch Changes

- Updated dependencies [c426058]
  - @kud/gh-ink@0.42.1

## 0.3.11

### Patch Changes

- Updated dependencies [cbcbd71]
  - @kud/gh-ink@0.42.0

## 0.3.10

### Patch Changes

- Updated dependencies [9caaa21]
- Updated dependencies [9caaa21]
  - @kud/gh-ink@0.41.0

## 0.3.9

### Patch Changes

- Updated dependencies [1eccd9f]
  - @kud/gh-ink@0.40.0

## 0.3.8

### Patch Changes

- Updated dependencies [3d39e01]
  - @kud/gh-ink@0.39.0

## 0.3.7

### Patch Changes

- Updated dependencies [5c5ac59]
  - @kud/gh-ink@0.38.1

## 0.3.6

### Patch Changes

- Updated dependencies [9a8b4f4]
  - @kud/gh-ink@0.38.0

## 0.3.5

### Patch Changes

- Updated dependencies [734b44b]
  - @kud/gh-ink@0.37.0

## 0.3.4

### Patch Changes

- Updated dependencies [bbd0093]
  - @kud/gh-ink@0.36.0

## 0.3.3

### Patch Changes

- Updated dependencies [a172214]
  - @kud/gh-ink@0.35.0

## 0.3.2

### Patch Changes

- 6de6467: Two things the package knew and never said.

  It shells out to the GitHub CLI for every fetch and every action, and neither
  README mentioned `gh` anywhere — not that it must be installed, not that it must
  be authenticated. A reader following the Quick Start had no way to learn the
  prerequisite except by hitting it.

  And `engines` claimed Node 20 while `@kud/gh`, which it depends on, requires 22.
  Anyone who believed the looser number got an `EBADENGINE` from a transitive
  dependency after being told their runtime was supported.

  The Quick Start now leads with what has to be true before `npm install`, and
  `engines` agrees with the dependency it cannot run without.

- Updated dependencies [73ae70c]
- Updated dependencies [6de6467]
  - @kud/gh-ink@0.34.0

## 0.3.1

### Patch Changes

- Updated dependencies [84bfccd]
  - @kud/gh-ink@0.33.0

## 0.3.0

### Minor Changes

- 7db3723: The published package exports what it always claimed to — and knows a turn can be settled by a reaction.

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

### Patch Changes

- Updated dependencies [7db3723]
  - @kud/gh-ink@0.32.2

## 0.2.2

### Patch Changes

- Updated dependencies [ea0cf29]
  - @kud/gh-ink@0.32.1

## 0.2.1

### Patch Changes

- Updated dependencies [2abcca7]
- Updated dependencies [2abcca7]
  - @kud/gh-ink@0.32.0
  - @kud/gh@0.9.0

## 0.2.0

### Minor Changes

- 20ba290: What a delegated agent is told to do is now the host's to say.

  `seedPromptFor` and `portablePromptFor` wrote four templates naming `/k-pr` and
  `/k-project`. Those are slash commands this package's author has and nobody else
  does, so `a` on a fresh install launched an agent and handed it a command it
  would refuse. The failure surfaced inside the agent, in a pane that had just
  opened, rather than in the cockpit — so nothing here looked wrong, and the
  reader was left to work out that the TUI had seeded the nonsense.

  Same class as the repo priority and checkout layout taken out of `gh-ink` in
  0.20.0, and missed in the same sweep for the same reason: an opinion in a string
  does not read as an opinion. A constant gets audited; a template literal in the
  middle of a launcher does not.

  The obvious fix was to delete the panel, and it was the wrong size. Twenty lines
  of `ai-panel.tsx` were personal out of two hundred and sixty-seven. The rest —
  detecting which of `claude`, `opencode` and `codex` are actually on PATH, the
  two-step agent-then-placement choice, iTerm pane and tab placement, the notice
  that opencode takes no prompt and starts cold — carries no opinion about anyone's
  tooling and is the part worth having. Dropping it to remove the templates would
  have cost every future reader a working launcher to spare them a bad string.

  So `registerPrompts({ seed, portable })`, shaped exactly like
  `registerCheckDrills` beside it. Two forms rather than one because they are
  addressed to different places: `seed` reaches an agent the cockpit has already
  `cd`'d into the checkout, so a repo-relative reference is safe, while `portable`
  lands on the clipboard and gets pasted somewhere unknown, where a bare number
  resolves against whatever repo the reader happens to be sitting in.

  The defaults are the point. Nothing registered means `seed` returns nothing and
  the agent opens cold in the right checkout, which is a real feature rather than
  a degraded one. `portable` falls back to the row's URL — a link pasted into a
  session that is already warm is the habit `y` exists to serve, it is portable by
  construction, and an agent handed a URL can fetch the rest itself.

  `registerPrompts` is the fourth way a host configures this package, after
  `configureInbox`, `registerCheckDrills` and `defineCockpit`'s config object.
  That is one too many and the honest consolidation is folding the registries into
  the config object that already exists. Not here: this release fixes published
  code that misbehaves for everyone but its author, and the tidy is a separate
  change with a separate blast radius.

## 0.1.20

### Patch Changes

- Updated dependencies [dc24239]
  - @kud/gh-ink@0.31.0

## 0.1.19

### Patch Changes

- Updated dependencies [b21b0d3]
- Updated dependencies [bed906b]
  - @kud/gh@0.8.0
  - @kud/gh-ink@0.30.0

## 0.1.18

### Patch Changes

- Updated dependencies [66f4202]
  - @kud/gh-ink@0.29.1

## 0.1.17

### Patch Changes

- Updated dependencies [6da6332]
  - @kud/gh-ink@0.29.0

## 0.1.16

### Patch Changes

- Updated dependencies [9838fef]
  - @kud/gh-ink@0.28.0

## 0.1.15

### Patch Changes

- Updated dependencies [e4c3104]
  - @kud/gh-ink@0.27.0

## 0.1.14

### Patch Changes

- Updated dependencies [27ee390]
- Updated dependencies [f7f2386]
  - @kud/gh-ink@0.26.5
  - @kud/gh@0.7.1

## 0.1.13

### Patch Changes

- 230f4f0: Let the account-wide inbox be asked for in several requests instead of one.

  GitHub's proxy answers a request, not a query, so the ceiling on the inbox is wall clock rather than cost. Measured against an account-wide inbox on 2026-08-28: the eight-source query returns HTTP 502 on roughly two runs in three, after 10–30s, while the same eight sources asked one at a time return 200 every time — for the same 73 points and the same ~16,870 nodes. Adding sources one at a time shows a clean gradient: five is reliable, six starts failing, eight mostly fails. Repo-scoped queries were never affected, because `repo:` narrows what the search index has to walk and `author:@me` across an account does not.

  - `buildInboxQuery` takes `sources`, so any subset can be asked for. Every subset is still a complete document carrying its own `rateLimit` and `viewer`.
  - `buildInboxQueries` splits the inbox into independent queries — two sources each by default (`INBOX_SOURCES_PER_QUERY`) — to be issued in parallel.
  - `mergeInboxData` reassembles them: aliases merge by assignment, `cost` and `nodeCount` sum, and `remaining`/`resetAt` take the scarcest reading.
  - `INBOX_SOURCES` and the `InboxSource` type name the eight sources.

  `buildInboxQuery()` with no arguments emits the same query it always did, byte for byte.

- Updated dependencies [230f4f0]
  - @kud/gh@0.7.0
  - @kud/gh-ink@0.26.4

## 0.1.12

### Patch Changes

- Updated dependencies [c040209]
  - @kud/gh-ink@0.26.3

## 0.1.11

### Patch Changes

- Updated dependencies [03960d1]
  - @kud/gh-ink@0.26.2

## 0.1.10

### Patch Changes

- Updated dependencies [8ad4867]
  - @kud/gh-ink@0.26.1

## 0.1.9

### Patch Changes

- Updated dependencies [d06a81b]
- Updated dependencies [aa9ae55]
  - @kud/gh-ink@0.26.0
  - @kud/gh@0.6.0

## 0.1.8

### Patch Changes

- Updated dependencies [189b758]
- Updated dependencies [e0c7f1a]
  - @kud/gh-ink@0.25.0

## 0.1.7

### Patch Changes

- Updated dependencies [90abb23]
  - @kud/gh-ink@0.24.0

## 0.1.6

### Patch Changes

- Updated dependencies [4295ada]
- Updated dependencies [48d06d8]
  - @kud/gh-ink@0.23.3

## 0.1.5

### Patch Changes

- Updated dependencies [352a7e9]
  - @kud/gh-ink@0.23.2

## 0.1.4

### Patch Changes

- Updated dependencies [fd2a3ca]
  - @kud/gh-ink@0.23.1

## 0.1.3

### Patch Changes

- Updated dependencies [09c027c]
- Updated dependencies [e8bb5d2]
  - @kud/gh-ink@0.23.0

## 0.1.2

### Patch Changes

- Updated dependencies [bf0b639]
  - @kud/gh-ink@0.22.1

## 0.1.1

### Patch Changes

- 6e1cf11: Export `DrillView`

  A host registering its own `CheckDrill` renders inside the cockpit's frame and
  needs the same chrome the built-in drills use. Without it the only way to match
  them is to reimplement the border, title and footer by eye.

- Updated dependencies [812676e]
- Updated dependencies [d670704]
  - @kud/gh-ink@0.22.0
