---
"@kud/gh-ink": patch
"@kud/gh-cockpit": patch
---

`o` on a rail row opens the initiative's URL again.

The commit that moved ↵ onto the drill lost the two interpolations behind `o` on the way in: it ran a bare `open` with no argument, and the flash read "↗ Opened " with no key after it, so the press looked acknowledged and did nothing. Both are restored, and a spec now pins the exact shell the key spawns and the key the flash names, against a mocked zx so the suite never opens a real browser tab.
