---
"@kud/gh-ink": patch
---

Never gate the first fetch on the budget, and fill the frame while it runs

**The gate could strand a cold launch.** The startup fetch is not manual, so a
low budget made it decline itself — leaving the app on "loading" with no rows, no
error and no way forward, because the pause notice renders in BrowseScreen and
that is not mounted in the loading phase. A budget is a reason to stop refreshing
something you can already see; never a reason to show you nothing at all. Only a
refresh of an already-painted list is gated now.

**The loading frame was sized with the wrong chrome.** It reused the browse
view's `rows - 10`, which reserves rows for a tab strip, a filter line and a
footer that do not exist there — so the frame stopped short and left the terminal
visibly unfilled, reading as "not fullscreen" even under `alternateScreen: true`.
It counts its own chrome now, and errs a row short rather than a row long: Ink
clips overflow from the top, so guessing high eats the header.
