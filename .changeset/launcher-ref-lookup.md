---
"@kud/gh": minor
"@kud/gh-workflow": minor
"@kud/gh-ink": minor
"@kud/gh-cockpit": patch
---

The Ctrl+K launcher opens a PR or issue by reference, whether or not the inbox lists it. Paste a github.com URL, type `acme/api-gateway#2926`, or a bare `#2926`, which is tried against the active row's repo and then the inbox's, and Enter opens the item's own drill with every action working. Until now the launcher took only ticket keys, and anything not on screen meant a trip to the browser. While the lookup runs the launcher says so and stays open; a miss lands in its message line and a failure in the error tone, with the input kept as typed. An item the inbox already holds opens as the listed row, and one it does not carries a `not in inbox` tag in its header. Underneath, `@kud/gh` gains `parseRef` and `fetchItemNode` (one item, with the inbox's own health and conversation selections), `@kud/gh-workflow` gains `resolveRef`, and `InboxExtension` gains `resolve`, so a host can make the launcher open its own kinds of thing by name; GitHub is asked first, then each extension in declaration order. The `/` filter is unchanged and still never leaves the list.
