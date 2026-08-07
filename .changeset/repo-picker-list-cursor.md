---
"@kud/gh-ink": patch
---

Move the repo picker's cursor onto `useListCursor` from `@kud/ink-ui`, replacing the local `useState` and its two arrow-key handlers. `vimKeys` is off and the hook is gated on `repoPicker`, so the keymap is unchanged.

The main tree keeps its own handlers on purpose — its cursor steps through `moveCursor`, which skips header rows, so the hook's ±1 would land on one. Both decisions are now noted at their call sites.
