---
"@kud/gh-ink": patch
"@kud/gh-cockpit": patch
"@kud/gh-pr-comments": patch
"@kud/gh-pr-health": patch
"@kud/gh-webhook-replay": patch
---

←→ on a tab bar wrap, and belong to the hook.

`@kud/ink-ui` 0.29.0's `useTabs` binds ←→ itself, so the PR drill's own arrow binding comes out — left in, every press would have switched tabs twice. The inbox does not mount the hook (its tab is a position over sections that come and go), but its arrows now wrap at the ends exactly as Tab already did four lines below: one bar, one end behaviour.

Every package pins `@kud/ink-ui` 0.29.0 together, per the one-copy rule.
