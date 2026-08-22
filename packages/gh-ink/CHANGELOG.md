# @kud/gh-ink

## 0.12.0

### Minor Changes

- 0fc3007: Say what a refresh did, and let something else ask for one.

  Applying a refresh used to swap one list for another and leave you to spot the difference against a frame the terminal had already scrolled away — the reason the manual `r` gate felt like a cost rather than a control. Now the indicator counts what is waiting (`● 2 new · 1 gone · 3 moved · r apply`), and applying marks each row that moved with `NEW` / `GONE` / `UPDATED` for a short hold, with departing rows still drawn where they actually were. Words and shapes, never colour alone.

  Adds an optional `watchPath`: a stamp file that something else touches when it has changed GitHub on your behalf. Touching it makes the inbox refetch in the background — it never repaints on its own, so the apply stays yours.

## 0.11.1

### Patch Changes

- bc5459b: Stop the inbox frame jumping a row when a scrolled list starts on a repo header. The gap above a header was decided on the absolute row index while `fitCount` prices the window's first row at one line, so the list drew one row more than its budget — and since the frame is sized to fill the terminal exactly, that overflow scrolled the whole panel instead of clipping.

## 0.11.0

### Minor Changes

- fabc8cb: A merged PR now says so before it goes. Merging from the drill view returns you to the list, sparkles the row with a `MERGED` label for three seconds, then drops it. Before, the row sat there until some later refresh removed it, so the one action that finishes a piece of work was the only one with no acknowledgement.

  `DetailContext` gains an optional `onMerged`, and `HealthPanel` an optional `onMerged` prop. Both are optional: a host that wires neither keeps the previous behaviour, including the post-merge reload.

## 0.10.0

### Minor Changes

- 0ac0503: Order rows by last activity within each repo, and show both dates

  `sortItems` had no time component at all — repo priority, then repo name, then
  whatever order GitHub's search happened to return. Two open PRs on the same repo
  could sit in any order, so a thread someone had just replied to rendered below a
  quieter one opened more recently.

  Recency now breaks the tie **within** a repo. The grouping is untouched: repo
  priority and repo name stay the outer keys, so `insertRepoHeaders` still emits
  one header per repo and no repo is scattered down the list.

  `GHItem` gains an optional `activityAge`, rendered beside `age` as `3h · 2d` —
  active 3h ago, open for 2d. It collapses to a single value when the two agree,
  so an untouched row does not read `2d · 2d`. What counts as activity is the
  surface's decision; this layer only renders what it is handed.

## 0.9.1

### Patch Changes

- ed3aa1e: Render the empty and failed states instead of printing them and exiting.

  A first fetch that came back with nothing, or that threw, used to `console.log`
  / `console.error` and `process.exit`. Hosts mount this App under Ink's
  `alternateScreen`, which restores the primary buffer on teardown without
  replaying anything written to the alternate one — so the message went into a
  buffer that was immediately discarded and the user was left staring at a blank
  terminal, unable to tell "nothing is open" from "the fetch died" from "the scope
  resolved somewhere I did not mean".

  Both are now states rendered inside the usual frame, so the header still names
  what was looked at, with `r` to retry and `q` to quit. Hosts can pass
  `emptyHint` to say what came back empty in their own vocabulary.

## 0.9.0

### Minor Changes

- fcd8a26: Overlays now float over the browse list instead of replacing it. Pressing `?`, `m`,
  `f` or `e` used to blank the screen and show the panel alone; the list stays put
  underneath, dimmed, so the panel reads as a modal over the app rather than as a
  different screen. The panel is opaque (a background, since Ink leaves an unpainted
  Box transparent) and sits in normal flow with the backdrop lifted out, so one taller
  than the list area grows the row rather than being centre-clipped.

## 0.8.1

### Patch Changes

- 5c867a0: Fix the `?` legend coming apart on terminals narrower than ~118 columns. The three
  legend columns were laid out at a fixed width with no fallback, so Ink wrapped every
  row mid-word and the modal's border fell out of step. The modal now reads the live
  terminal width and falls down a ladder of layouts — three columns across, then Status
  and Tabs stacked beside Keys, then a single column — and the cell gutter is derived
  from the widest cell rather than hardcoded per column.

## 0.8.0

### Minor Changes

- 7be0454: Gate the glance's launch fetch behind a 120s TTL, and drop the cache when an action lands.

  The disk cache already existed: launch painted from it, then called `revalidate()` **unconditionally**. So it bought a fast first frame and saved nothing — every launch spent the inbox query's **111 GraphQL points** against a 5000/hour account-wide pool, however recently the last launch ran. A cache that records rather than prevents; the store was there, the freshness policy was not.

  Now a cached glance younger than the TTL launches without fetching. `r` still refetches on demand, so nothing strands you on stale rows.

  Two things that only matter once an entry is _trusted_ rather than immediately overwritten:

  - **Cache files carry a version.** `readCache` validated only that `sections` was an array, so a file written by an older `Section` shape would have deserialised into new code and rendered wrong. An unrecognised version is a miss, costing one cold fetch on upgrade.
  - **An action drops the entry synchronously.** Handlers schedule their refresh behind a 1500ms delay to let GitHub settle; quitting inside that window used to leave pre-action rows on disk. Harmless when every launch refetched — a visible wrong answer once the TTL trusts them. The delay now lives with the invalidation rather than being repeated at each call site.

  120s bounds the pathological case rather than the typical one: nobody launches thirty times an hour, but at 120s even that ceiling stays inside budget, and "nobody does that" is precisely what was believed about the process that exhausted this pool.

### Patch Changes

- Updated dependencies [7be0454]
  - @kud/gh@0.5.1

## 0.7.1

### Patch Changes

- Updated dependencies [37586f4]
  - @kud/gh@0.5.0

## 0.7.0

### Minor Changes

- 9fcc195: Trim the inbox footer strip to six orientation hints (nav, tab, open, actions, help, quit). Extension hints are no longer injected into it, so the strip keeps a fixed width no matter how many extensions a host registers — previously every extension widened it until it wrapped onto a second line. Every key stays bound and every one of them is still listed in the `?` legend.

## 0.6.0

### Minor Changes

- Surface a failed background refresh in the flash instead of swallowing it.

  Once something is on screen, a rejected `fetcher()` was caught and dropped: the list kept rendering from cache with no hint it had gone stale, and the only thing a user saw was whatever the fetcher's child process leaked to stderr — outside the Ink frame, where nothing can lay it out.

  `BrowseScreen` takes an optional `refreshError`, flashed inside the border like every other transient outcome. It carries a timestamp so two identical failures in a row are two distinct values; a bare string would compare equal and fire only once, reading as a recovery.

## 0.5.3

### Patch Changes

- Updated dependencies
  - @kud/gh@0.4.1

## 0.5.2

### Patch Changes

- Updated dependencies [67c40eb]
  - @kud/gh@0.4.0

## 0.5.1

### Patch Changes

- Updated dependencies [1bdf706]
  - @kud/gh@0.3.0

## 0.5.0

### Minor Changes

- cd60c53: Make extensions discoverable, not just dispatchable. 0.4.0 honoured `InboxExtension.key` generically but left every surface that _advertises_ a key naming Jenkins by hand, so a second extension worked and was invisible: no footer hint, no line in the `?` legend, and no entry in a row's action menu.

  All three now derive from the `extensions` array:

  - The footer strip takes each extension's new optional `hint` (short, columns are scarce), falling back to a lowercased `title`.
  - The `?` legend takes `title` spelled out. `HelpModal` receives `extensions` instead of a `hasCi` boolean — a flag could only ever say "Jenkins exists", which is precisely why a second extension went unlisted.
  - `buildActions` accepts a trailing `{ extensions, onOpenExt }` bag and appends an entry per **item-scoped** extension, so delegation appears under `m` where you would look for it.

  New optional `scope: "item" | "global"` on `InboxExtension` distinguishes an extension that acts on the selected row from one that is host-wide. It defaults to `global`, making the action-menu listing opt-in: a host that has not thought about scope does not get Jenkins offered as something to do _to_ a pull request.

  **Not breaking.** `hint` and `scope` are optional, and `buildActions`' new parameter is a trailing optional. An existing extension keeps working; it simply stays out of row action menus until it declares `scope: "item"`.

## 0.4.0

### Minor Changes

- 2779c4c: Make `InboxExtension.key` a real binding. `BrowseScreen` now receives the `extensions` array and dispatches on each extension's declared `key`, replacing a hardcoded `input === "J"` arm that could only ever open Jenkins — so a second extension could declare a key and nothing would read it.

  `ExtensionTarget` replaces the bare `string` that `body` received. It carries `{ item?: AnyItem; ciJob?: string; login: string }`, so a row-scoped extension gets the selected row (which no string could carry) while Jenkins keeps reading its job name. Both contexts travel together rather than being chosen by inspecting the extension's id, which would make `key` decorative again. `login` rides along because extensions are declared at module scope, before the viewer has been fetched, so a body cannot close over it.

  Extensions are matched below every built-in binding, so a declared key cannot shadow navigation, refresh or quit, and above the active-row guard, so a domain-scoped extension still opens on an empty tab.

  **Breaking for extension authors:** `body(onExit, target)` now receives `ExtensionTarget | undefined` instead of `string | undefined`. A Jenkins-style extension reads `target?.ciJob` where it previously used `target`.

### Patch Changes

- 2779c4c: Stop child-process output painting outside the Ink frame. Closing an issue or PR, or moving a Jira ticket, briefly printed a stray confirmation line outside the inbox border.

  zx captures a child's stdout but passes its **stderr** straight to the terminal, and `gh`/`jira` print status lines like `✓ Closed issue #42` there so stdout stays pipeable. Ink owns a region of stdout and repaints it; it has no view of stderr, so that line landed raw at the cursor, outside the frame, until the next render scrolled it away — a duplicate of a message the inbox was already rendering properly through `showFlash`.

  All eleven child-process calls in the inbox now run through a single quiet wrapper, `open`'s failure text included.

## 0.3.1

### Patch Changes

- abb024f: Move the repo picker's cursor onto `useListCursor` from `@kud/ink-ui`, replacing the local `useState` and its two arrow-key handlers. `vimKeys` is off and the hook is gated on `repoPicker`, so the keymap is unchanged.

  The main tree keeps its own handlers on purpose — its cursor steps through `moveCursor`, which skips header rows, so the hook's ±1 would land on one. Both decisions are now noted at their call sites.

- c5ad810: Keep the tab you are on when the work ⇄ home switch flips. `filterByOrigin` drops sections that end up empty, so the two sides expose different section sets — following the tab index handed you a different tab, and on Done it was reliably the wrong one.

  `w` now resolves the active section by id and only falls back to the clamp when that tab has no counterpart at all. `cursors` and `viewStarts` moved from position-keyed arrays to records keyed by section id for the same reason: landing on the right tab was not enough while the saved row still came from whichever section used to sit at that index.

## 0.3.0

### Minor Changes

- 04ffe69: Add the inbox shell — the browse screen, action menu, layout, navigation and `App` extracted from ambre's cockpit, so a second surface can have the same interface with different queries.

  Host-supplied where the shell used to assume its first host: `detailFor` (the drill-in view, on the same seam as `extensions`), `title` (the header brand, loading line and empty message), and `isWorkRepo` / `initialIncludeWork` (the work ⇄ home split). The duplicated `Health` union and its display tables are gone in favour of `@kud/gh` and this package's own `health-display`.

## 0.2.0

### Minor Changes

- f476456: `HealthPanel` only spaces a summary row from the list above it when that list has entries. On a PR with no checks and no reviewers, Checks / Reviews / Merge previously rendered with a blank line between each, spacing rows apart from nothing.

  `CommentsPanel` gains `showConversationHeading` (default `true`). Hosts that already name the section — cockpit puts the payload behind a "Conversation" tab — can turn off the panel's own heading instead of stacking the same word twice. The "Review threads" heading is unaffected, since it separates two genuinely different lists.

  The empty state no longer says "on this PR": the panel now also renders issue conversations, which have no review threads.

### Patch Changes

- Updated dependencies [f476456]
  - @kud/gh@0.2.0
