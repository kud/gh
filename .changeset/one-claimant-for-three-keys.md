---
"@kud/gh-ink": minor
---

`q`, `esc` and `backspace` belong to the app now, bound once at the root through `@kud/ink-ui`'s `useAppKeys`. The browse screen publishes a _peel_ instead of claiming the keys itself.

Ink runs every active `useInput` on every key, with no order and no propagation — so "who gets `esc`" cannot be settled by layering handlers. It is settled by there being one claimant, and there were five for `q` and eight for `esc`.

**A hole this closes for free:** during the cold-fetch loading phase **nothing bound `q` at all**. `App` returns above the browse screen and the empty/failed screen only mounts once a fetch has resolved, so a slow first load could be left only with ctrl+c. The hook sits above every phase, so it now answers there too.

**Two behaviour changes you will notice.** `q` in the repo picker quits, where it previously did nothing at all — the picker's branch returned unconditionally and swallowed it. And `esc` with the repo picker open over a search now closes the picker; before, the arms were written in source order rather than priority order, so an inner layer plus a filter meant one press cleared the filter and left the inner layer standing.

The peel is a plain function per screen — a priority order over that screen's own booleans, published through a ref — and deliberately not a back stack, which `@kud/ink-ui`'s own manual is explicit about. The search field has no arm in it: the root hook is inactive while a text field has focus, so `esc` there never reaches the peel and the field's own handler stays live. That inactivity is also what keeps `q` a letter while you are typing.

`hidden` keeps both of its jobs — don't render, and don't act on keys. It looks like one boolean doing two things, but the listen half is not simply `isActive`: four lines above that guard re-arm the idle pulse deliberately, because a key pressed at a hidden tab is still evidence of a person at the keyboard. Gating the handler itself would have stopped an idle return from re-arming it.

The drill views are untouched in this release and still own their own `esc`; the root defers to them and behaviour inside a drill is unchanged.
