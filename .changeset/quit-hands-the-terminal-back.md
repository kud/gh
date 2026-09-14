---
"@kud/gh-ink": patch
"@kud/gh-cockpit": patch
"@kud/gh-pr-comments": patch
"@kud/gh-pr-health": patch
"@kud/gh-webhook-replay": patch
---

`q` hands the terminal back.

The inbox quit with `process.exit(0)` from the browse screen and from the empty-and-failed screen, which killed the process under Ink before it could unmount — the alternate screen was left up and whatever was on it stayed on the user's terminal. Both now call Ink's own `exit()`, which unmounts, restores the screen and then lets the process end. The drills still close on `q` as well as `esc`; making `q` quit from inside them waits on their text fields reporting focus, or a letter typed into a reply would end the app.

Every package pins `@kud/ink-ui` 0.28.2 together, per the one-copy rule: it brings `useAppKeys`, `Page` and the footer tail that the rest of the fleet has moved to, so cockpit's hosts can adopt them without a second copy of the library in the process.
