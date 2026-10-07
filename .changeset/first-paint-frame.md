---
"@kud/gh-ink": patch
---

A cockpit launch no longer jumps. The inbox read its cache in an effect after the first render, so every launch, warm cache included, drew one frame of the loading screen and then snapped to the board about 80ms later; the cache is now read during the first render, and a trusted cache's first frame is the board. The loading, empty and failed frames also ran one row short of the board, because their body budgeted a footer line that already sits inside it, so the bottom border dropped a row when the fetch landed. They are now exactly the terminal height, the same as the board.
