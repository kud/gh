---
"@kud/gh-ink": minor
---

An extension can now declare which row kinds it is the in-tree view for, and ↵ on such a row mounts it the way ↵ on a PR mounts `PrView`.

`InboxExtension` gains an optional `drills?: AnyItem["kind"][]`. An item-scoped extension declaring `drills: ["task"]` becomes what ↵, `d` and the menu's drill action open on a ticket row — instead of the action menu, or the iTerm pane running `jira issue view`, which is what a task row has always done because nothing in-tree could show a ticket. The pane stays as the fallback for a host that declares nothing, so existing hosts see no change. A declaration rather than a new `onOpenTask` seam beside `onOpenPr`: the shell already knows more about Jira than it should, and the extension door was built to be the generic one.

The target an extension body receives is now built in one place (`extensionTargetFor`), so the key dispatch and the ↵ drill cannot hand a body two different shapes.
