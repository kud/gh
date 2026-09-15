---
"@kud/gh-ink": minor
"@kud/gh-cockpit": minor
---

The drill views hand `q` and `esc` back to the app. `esc` goes back one level, `q` quits from any depth, and the footers say so.

This is the second half of the navigation contract. `@kud/ink-ui`'s manual puts it plainly: _a view exported from a `*-ink` package takes `onBack` and never binds `esc` or `q` itself_ — the host's peel routes to it. Five views were binding both, which is why `q` inside a drill went _back_ rather than quitting, and why leaving the app from three levels down meant three presses of a key labelled "quit".

Each drill now publishes a **peel** through `DetailContext.registerPeel` — its own layers, innermost first, reporting whether there was one to close. When a drill says no, closing the drill is the root's next layer out. `FilePicker` and `CheckLogView` publish nothing at all, because they are leaves: they push no layers, so the drill above closes them.

`AiLauncher` is the exception that proves the shape. It is not a leaf — agent → placement is two screens — so it publishes just the step it can pop itself, and backing out of the placement returns to the agent list rather than throwing the launcher away. Its `step` stays inside it, where it belongs; lifting it into both callers would have put the launcher's internal state in two places that do not own it.

**What you will notice:** `q` in a drill now quits instead of going back, and every drill footer reads `esc back` rather than `q/esc back`. A reply box is unaffected — the root stands its keys down while a text field has focus, so `q` types a `q` and backspace deletes.

The `process.exit(0)` after `runHere()` in the AI panel is deliberately untouched. It is not a quit binding: a shell command is taking the terminal over, and Ink's async unmount would race the handover.
