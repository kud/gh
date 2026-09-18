---
"@kud/gh-ink": minor
"@kud/gh-cockpit": minor
---

A standing status strip, a stack of rails, and `c` on a rail row.

`App` takes a `stripFetcher`: a row of things and the state each is in — `ok` / `warn` / `fail` / `unknown`, drawn as `✓ ! ✗ ○` so the shape survives a monochrome terminal — polled on its own clock like the CI line and drawn beneath it. Wide, every item is named; narrow, what is fine is counted and what is not is named, worst first, so a small terminal loses the roll call and never the failures. An item can carry an `alarm` beside its state (`▲`), for a fire that is independent of the reading, and the row ends with the snapshot's age. `null` from the fetcher draws "no signal / not configured"; a rejected poll keeps the last strip up.

`sidebar` accepts `Rails` — one section or an array — and `SidePanel` draws them stacked under one rule, each with its heading and its own window, the height shared so a short section hands its surplus down. The cursor is one number across the stack, so `↵` / `o` work on a row in any section. An empty stack is no rail. The cache format bumps to 5 for the shape.

`c` on a focused rail row copies the URL `o` would open, and says so.
