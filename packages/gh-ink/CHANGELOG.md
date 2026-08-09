# @kud/gh-ink

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
