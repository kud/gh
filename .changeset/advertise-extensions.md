---
"@kud/gh-ink": minor
---

Make extensions discoverable, not just dispatchable. 0.4.0 honoured `InboxExtension.key` generically but left every surface that _advertises_ a key naming Jenkins by hand, so a second extension worked and was invisible: no footer hint, no line in the `?` legend, and no entry in a row's action menu.

All three now derive from the `extensions` array:

- The footer strip takes each extension's new optional `hint` (short, columns are scarce), falling back to a lowercased `title`.
- The `?` legend takes `title` spelled out. `HelpModal` receives `extensions` instead of a `hasCi` boolean — a flag could only ever say "Jenkins exists", which is precisely why a second extension went unlisted.
- `buildActions` accepts a trailing `{ extensions, onOpenExt }` bag and appends an entry per **item-scoped** extension, so delegation appears under `m` where you would look for it.

New optional `scope: "item" | "global"` on `InboxExtension` distinguishes an extension that acts on the selected row from one that is host-wide. It defaults to `global`, making the action-menu listing opt-in: a host that has not thought about scope does not get Jenkins offered as something to do _to_ a pull request.

**Not breaking.** `hint` and `scope` are optional, and `buildActions`' new parameter is a trailing optional. An existing extension keeps working; it simply stays out of row action menus until it declares `scope: "item"`.
