---
"@kud/gh-pr-comments": patch
"@kud/gh-pr-health": patch
"@kud/gh-webhook-replay": patch
---

One `@kud/ink-ui` in the tree instead of two. These three CLIs sat on `0.8.0` while `gh-ink` and `gh-cockpit` moved to `0.21.0`, so npm hoisted one copy and nested the other — and two copies of a component library in one process is the shape of bug where a module-level singleton is configured in one instance and read from the other. It had not bitten yet because ink-ui's only such singleton is `setIconMode`/`getIconMode`, which nothing here calls; that is luck rather than design, and luck is not a dependency policy.

Nothing renders differently. All three import exactly one thing — `colors` — and the token object is unchanged across the seven minors. What the bump actually buys is the hazard going away and, incidentally, `node_modules/@kud/ink-ui/AGENTS.md`, which `0.16.0` began shipping inside the package: the brief that says which components own their own Ink `useInput` and which are presentational. A pin below `0.16.0` left nothing there to read.

`npm ls @kud/ink-ui` now reports a single version with every line `deduped`. That is the check worth re-running after any dependency edit here, and the repo's `CLAUDE.md` says so.
