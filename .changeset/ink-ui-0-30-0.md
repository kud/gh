---
"@kud/gh-ink": patch
"@kud/gh-cockpit": patch
"@kud/gh-pr-comments": patch
"@kud/gh-pr-health": patch
"@kud/gh-webhook-replay": patch
---

`@kud/ink-ui` 0.29.0 → 0.30.0 on every package at once, which is what brings `CommandPalette` in. All five pins move together so npm keeps one deduped copy: two copies of a component library in one process is a module-level singleton configured in one instance and read from the other.
