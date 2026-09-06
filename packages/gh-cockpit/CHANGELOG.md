# @kud/gh-cockpit

## 0.4.6

### Patch Changes

- Updated dependencies [5e4b549]
  - @kud/gh@0.12.0
  - @kud/gh-workflow@0.3.0
  - @kud/gh-ink@0.45.0

## 0.4.5

### Patch Changes

- Updated dependencies [b18d54a]
  - @kud/gh-ink@0.44.5

## 0.4.4

### Patch Changes

- Updated dependencies [19330e4]
  - @kud/gh-workflow@0.2.1
  - @kud/gh-ink@0.44.4

## 0.4.3

### Patch Changes

- b5512f9: Extract the workflow semantics into `@kud/gh-workflow`, a pure package a browser can import.

  `whoseMove`, `sortItems`, `layoutGHItems`, the filters, the row types and the GraphQL node → row mapping were spread across `gh-ink`'s 5,600-line `inbox.tsx` and `gh-cockpit`'s shared layer, entangled with Ink, `zx`, iTerm pane launching and a `mkdirSync` that ran on import. None of it was ever terminal-specific — only its address was.

  `@kud/gh` splits `fetchHealth` out of `health.ts` so the health derivation is importable without `execa`, and gains `./health` and `./inbox` subpath exports for consumers that must not pull the CLI path. The terminal surfaces re-export by name, so nothing on their public API moves.

  Purity is asserted against the built output rather than the source: in the workspace every forbidden dependency is installed, so an accidental import compiles, typechecks and only fails in a consumer's bundle.

  Note for consumers: `@kud/gh-workflow@0.1.0` was published against `@kud/gh@0.9.0`, which predates the `./health` subpath it imports, so it fails to resolve outside this workspace. `0.1.1` pins the version that actually exports it.

- Updated dependencies [9e67e56]
- Updated dependencies [b5512f9]
  - @kud/gh-ink@0.44.3
  - @kud/gh-workflow@0.2.0
  - @kud/gh@0.11.0

## 0.4.2

### Patch Changes

- 089678d: The list actually recedes behind an overlay now. It was already meant to — the backdrop set `dimColor` on every `Text` in the subtree — and the mechanism did not survive contact with a terminal. SGR 2 is a single binary attribute whose meaning the terminal decides, and on iTerm2 it barely moves a 24-bit foreground: dumping the escape codes for one row either side of the overlay gave the same `38;2;255;135;0` orange both times. The panel had a modal over a list that was still shouting, and there was no "more dim" available to apply.

  So the backdrop **replaces** the colour rather than attenuating it, and drops faint on the way out. Both together would be worse than either — a flat colour with SGR 2 still on hands the result back to whatever this terminal does with faint, which is the failure being fixed one layer along.

  Two planes, not one, because a single tone collapses the list to a mat and the point of a backdrop is that something structured is behind the panel. `dimColor` at the call site is reused as the plane selector rather than re-encoded: every element that had already declared itself furniture — prefixes, repo, age, author — says so again, one step further back. Not one call site changed, which is the same trick as the original shadow, one turn further.

  The health glyphs and the turn arrows lose their hues while an overlay is up, and that is `health-display.ts`'s contract being spent rather than broken: the glyph distinguishes the state and colour only ever reinforced it, every one of those glyphs passes a silhouette test, and nobody diagnoses a PR through the list behind a dialog they are operating. It returns with the next frame.

  Pills stop being drawn behind an overlay. `Pill` is `@kud/ink-ui`'s and renders that package's `Text`, so it cannot see the context and keeps its fill — harmless while the backdrop merely lost its bold, and the loudest cell on screen once everything around it flattens. A pill is an announcement and there is nobody to announce to. Its width is still charged, so no row reflows as the panel opens over it.

  `backdropStyle` is exported so the decision can be pinned without rendering: chalk emits colour only when the runner is a TTY, so a spec grepping a frame for escape codes would pass vacuously wherever the suite is piped.

- Updated dependencies [089678d]
  - @kud/gh-ink@0.44.2

## 0.4.1

### Patch Changes

- a634508: An overlay no longer takes the list down with it. Opening the actions menu on a cockpit with no rail showing truncated every row behind it to about a dozen columns, spilled the remains outside the frame, and put the panel hard against the left edge instead of the middle — all four overlays, one code path.

  The list column was sized `showRail ? listCols : undefined`, applying the rail ternary a second time after `listCols` had already answered it, and withholding the width in exactly the case where `listCols` is `COLS` and correct. With no width and an overlay up, the column's only in-flow child is the panel — the list sits in an absolutely-positioned backdrop and contributes nothing to its parent's intrinsic size — so the column measured itself against the panel. `width="100%"` on the backdrop then resolved to the panel's width rather than the list's, and `alignItems="center"` centred the panel inside a box that WAS the panel. Two symptoms, one missing number.

  The general shape is worth carrying out of here: an absolutely-positioned child pays nothing towards its parent's size, so a percentage width inside it measures whatever the in-flow siblings happen to be. A layout can look obviously right and still have no width to resolve against.

  `HelpModal` is why this survived three existing overlay tests. It is nearly as wide as the frame, so a column collapsed to the panel is close enough to a column sized to the list that both "rows still visible" and "opaque over rows" held. The two new tests press `m` instead: `ActionMenu` is the narrowest of the four, and it measures the row's own content extent rather than the line length, since the frame's border pads every line to the terminal's width whatever the row did.

- 8be6855: `@kud/ink-ui@0.22.0`, which takes the sliding underline off the tab bar. The rule lands under the active tab on the frame the tab changes, and the highlight lands with it — no travel, no lead-and-follow.

  It reaches the cockpit through this bump rather than through anything here, and it is worth a line because the tab bar is the one component drawn across the top of every screen: a half-tuned animation there is the first thing the eye goes to and the last thing that should be asking for attention. The slide was three releases of tuning that had not converged, so it was parked whole on `feat/tabs-underline-animation` upstream — step count, ease shape and the lead/follow split intact — to be finished rather than rewritten. Tab markers are untouched.

  All six packages move together, which is the invariant this repo now states outright: a second copy of the component library in one process is a module-level singleton configured in one instance and read from the other.

- Updated dependencies [a634508]
- Updated dependencies [8be6855]
  - @kud/gh-ink@0.44.1

## 0.4.0

### Minor Changes

- 21cc38e: Rows say what KIND of thing they are, not only what state it is in. Health had eleven states, a glyph each and a legend on `?`; labels had nothing at all, so a `plan`-labelled issue and an ordinary one were indistinguishable in the list — on a cockpit whose whole worklist _is_ `plan`-labelled issues. The data was already being fetched and thrown away: `@kud/gh`'s inbox query has carried `labels(first: 10)` in `full` mode all along, under a comment reading "Nothing here renders labels."

  At most two per row, chosen against the host's new `labelPriority` — an ordered list where an entry ending in `*` matches by prefix, so `app:*` need not be enumerated — and by name after that. The cap is the design rather than a concession to width: a row showing every label has stopped being a row. `labelPriority` is empty in the library like every other default here, and that is load-bearing rather than tidy — `plan` and `app:*` are one reader's filing conventions, and a library that shipped them would be ranking a stranger's labels by a scheme they have never seen.

  Alphabetical was the obvious ordering and it is wrong on the exact case this exists for: on a repo where every issue carries `plan` plus `app:<name>`, `app:cockpit` sorts first and the label saying what KIND of thing the row is gets dropped. That is the ranking's whole job.

  The cell sits immediately after the title rather than out with the trailing furniture, because a label is read as part of the subject rather than scanned down a column. One tag glyph then the names, dim, verbatim casing, no per-label colour — GitHub's label hues are authored in a repo that knows nothing of this palette, and it would be the one place on the row where colour alone did the discriminating, which is the failure `health-display.ts` exists to prevent. There is no `+2` overflow marker: it would spend three columns to say something you cannot act on, on precisely the rows whose titles are already the most squeezed.

  It takes **two** rungs on the row's give-up ladder rather than one, degrading two labels → one → none, because the second label is the most speculative thing on the row and the first is what the row _is_. The repo still outlives both: on a nested row the repo is positional — it says the row is not where the header above it claims — so dropping it misattributes the row, where a dropped label is only less to go on.

  `GHItem` gains `labels`, and `CockpitItem` — which existed solely to widen `GHItem` with it — collapses to an alias.

### Patch Changes

- Updated dependencies [21cc38e]
  - @kud/gh-ink@0.44.0

## 0.3.16

### Patch Changes

- Updated dependencies [0f9e7ae]
  - @kud/gh-ink@0.43.3

## 0.3.15

### Patch Changes

- Updated dependencies [608e7db]
  - @kud/gh-ink@0.43.2

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
