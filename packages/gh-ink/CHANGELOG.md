# @kud/gh-ink

## 0.2.0

### Minor Changes

- f476456: `HealthPanel` only spaces a summary row from the list above it when that list has entries. On a PR with no checks and no reviewers, Checks / Reviews / Merge previously rendered with a blank line between each, spacing rows apart from nothing.

  `CommentsPanel` gains `showConversationHeading` (default `true`). Hosts that already name the section — cockpit puts the payload behind a "Conversation" tab — can turn off the panel's own heading instead of stacking the same word twice. The "Review threads" heading is unaffected, since it separates two genuinely different lists.

  The empty state no longer says "on this PR": the panel now also renders issue conversations, which have no review threads.

### Patch Changes

- Updated dependencies [f476456]
  - @kud/gh@0.2.0
