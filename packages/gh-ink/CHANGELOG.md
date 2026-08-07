# @kud/gh-ink

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
