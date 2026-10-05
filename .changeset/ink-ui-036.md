---
"@kud/gh-ink": patch
"@kud/gh-cockpit": patch
"@kud/gh-pr-health": patch
"@kud/gh-pr-comments": patch
"@kud/gh-webhook-replay": patch
---

Built against `@kud/ink-ui` 0.36.0. Ticket keys now take their yellow from ink-ui's `ticket` token rather than a hex of their own, so every TUI draws a key alike; the `@kud/ink-ui` peer range moves to `>=0.36.0 <1` because an older host has no such token and would draw the key uncoloured. The inbox search also follows the new `useFilterMode`: `esc` while typing used to clear the term on the way out, throwing away the query a reflexive press was only meant to step out of, and now it keeps the filter just as `↵` does. `⌃u` empties the term inside the field, and `esc` on a kept filter still clears it, so two presses clear it from anywhere.
