---
"@kud/gh-ink": minor
"@kud/gh-cockpit": patch
"@kud/gh-pr-health": patch
"@kud/gh-pr-comments": patch
"@kud/gh-webhook-replay": patch
---

`@kud/ink-ui` is now a peer dependency of gh-ink (`^0.33.0`) rather than a pinned dependency, so a host and gh-ink always share one copy. ink-ui keeps the icon mode in module state, and a second nested copy meant a host's `setIconMode("nerd")` never reached it. The CLIs move to ink-ui 0.33.2.
