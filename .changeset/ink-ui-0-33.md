---
"@kud/gh-ink": patch
"@kud/gh-cockpit": patch
"@kud/gh-pr-comments": patch
"@kud/gh-pr-health": patch
"@kud/gh-webhook-replay": patch
---

Every package moves to `@kud/ink-ui` 0.33.0 together. A host that also draws with ink-ui at that version — the Jira board does — was loading a second copy beside these packages' 0.31.0, and two copies of the component library in one process configure one instance and read the other. The skeleton rows also pick up 0.33.0's shimmer.
