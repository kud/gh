---
"@kud/gh-ink": minor
"@kud/gh-cockpit": patch
---

Ctrl+K opens a launcher: type a ticket key, pick where it opens.

A ticket that was not a row could not be reached without leaving the cockpit — ↵ on a row mounted the ticket in-tree, but there was no way to name one. Ctrl+K now floats a centred palette over the list, dimming it the way the legend does. Typing a key yields two rows, the first already under the cursor: `Open KEY here`, through whichever extension declares `drills: ["task"]` (the same door ↵ takes on a ticket row, so a host that has not claimed the kind gets no such row), and `Open KEY in Jira`, through the one rule the row menu's `t` already used — extracted to `openInJira` so the two cannot drift. `/` stays "narrow the list in place"; the launcher is a different verb and does not share its key. The footer and the `?` legend advertise `⌃K` only where `jiraBase` is set, because without it the palette can only say `Jira not configured`, followed by the host's own words on how (`jiraSetupHint`, a new prop beside `jiraBase`). A key that matches nothing says `no ticket matches "…"` on one muted line and makes ⏎ a no-op.

`InboxExtension` gains `commands?: (target) => Command[]`, called on every keystroke, sync and pure; the host draws its own rows first and appends whatever comes back, so an extension can add verbs but never reorder the built-ins. `ExtensionTarget` carries `query` and `ticketKey` — the key matched once by the host against its `jiraKeyRe` and handed down normalised, so no extension parses the query itself. Nothing in the fleet produces a command yet; a spec with a stub extension pins the append and its ordering until something does.
